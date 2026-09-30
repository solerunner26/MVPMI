#!/usr/bin/env python3
"""Summarise `am instrument -r` output (device-test-results/api-N).

Writes summary.md (also appended to the GitHub job summary) and exits 1 if
any test failed, crashed, or a class did not run at all. A test skipped by
an assumption (for example "no fingerprint on this emulator image") is
reported as SKIPPED, never as passed.
"""
import os
import re
import sys
from pathlib import Path

api, out = sys.argv[1], Path(sys.argv[2])
raw = (out / "instrument-raw.txt").read_text(errors="replace")
CODES = {0: "PASS", -1: "ERROR", -2: "FAIL", -3: "IGNORED", -4: "SKIPPED"}
rows, problems = [], []
for block in raw.split("=== ")[1:]:
    target, _, body = block.partition("\n")
    target = target.strip()
    current, stack, seen = {}, {}, 0
    for line in body.splitlines():
        m = re.match(r"INSTRUMENTATION_STATUS: (\w+)=(.*)", line)
        if m:
            current[m.group(1)] = m.group(2)
            continue
        m = re.match(r"INSTRUMENTATION_STATUS_CODE: (-?\d+)", line)
        if m:
            code = int(m.group(1))
            if code != 1:  # 1 = test started
                seen += 1
                name = current.get("class", target).split(".")[-1] + "#" + current.get("test", "?")
                why = (current.get("stack") or "").strip().splitlines()
                reason = why[0][:220] if why else ""
                rows.append((name, CODES.get(code, str(code)), reason))
                if code in (-1, -2):
                    problems.append(name)
            current = {}
    crash = re.search(r"INSTRUMENTATION_RESULT: shortMsg=(.*)", body)
    if crash:
        rows.append((target, "CRASH", crash.group(1)[:220]))
        problems.append(target)
    elif seen == 0:
        rows.append((target, "NOT RUN", "no test result reported"))
        problems.append(target)

# App or test-process crashes, straight from logcat.
crashes = []
logcat = out / "logcat.txt"
if logcat.exists():
    lines = logcat.read_text(errors="replace").splitlines()
    for i, line in enumerate(lines):
        if "FATAL EXCEPTION" in line and any("org.mvpmi.directory" in l for l in lines[i : i + 3]):
            crashes.append("\n".join(l.split("): ", 1)[-1] for l in lines[i : i + 14]))
env = (out / "environment.txt").read_text() if (out / "environment.txt").exists() else ""
upd = (out / "update-check.md").read_text() if (out / "update-check.md").exists() else ""
count = lambda s: sum(1 for r in rows if r[1] == s)
md = [
    f"### Android instrumented tests · API {api} (emulator)",
    "",
    "```",
    env.strip(),
    "```",
    "",
    upd.strip(),
    "",
    f"**{count('PASS')} passed · {count('FAIL') + count('ERROR') + count('CRASH') + count('NOT RUN')} failed · {count('SKIPPED')} skipped**",
    "",
    "| Test | Result | Note |",
    "|---|---|---|",
    *[f"| {n} | {r} | {w.replace('|', '/')} |" for n, r, w in rows],
    "",
    *(["**Crashes (logcat)**", "", *[f"```\n{c}\n```" for c in crashes[:3]], ""] if crashes else []),
]
text = "\n".join(md)
(out / "summary.md").write_text(text)
print(text)
if os.environ.get("GITHUB_ACTIONS"):
    # One annotation with the whole table: readable on the run page.
    enc = lambda t: t.replace("%", "%25").replace("\r", "").replace("\n", "%0A")
    level = "error" if problems else "notice"
    print(f"::{level} title=Android device tests API {api}::" + enc(text[:60000]))
if os.environ.get("GITHUB_STEP_SUMMARY"):
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
        f.write(text + "\n")
sys.exit(1 if problems else 0)
