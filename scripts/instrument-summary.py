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
# Page errors (debug builds copy WebView console errors to logcat).
page_errors = []
if logcat.exists():
    for line in logcat.read_text(errors="replace").splitlines():
        if "MVPMIWEB" in line and line.split("): ", 1)[-1] not in page_errors:
            page_errors.append(line.split("): ", 1)[-1][:300])
# A class that failed once but passed on its retry is FLAKY, not failed.
retried_ok = set()
for block in raw.split("=== ")[1:]:
    head, _, body = block.partition("\n")
    if head.strip().endswith("(retry)") and not re.search(r"STATUS_CODE: -(1|2)$|shortMsg=Process crashed", body, re.M) and "STATUS_CODE: 0" in body:
        retried_ok.add(head.strip()[: -len("(retry)")].strip().split("#")[0])
flaky = []
for i, (n, r, w) in enumerate(rows):
    if r in ("FAIL", "ERROR", "CRASH") and n.split("#")[0] in retried_ok and not n.endswith("(retry)"):
        rows[i] = (n, "FLAKY", "failed once, passed on retry: " + w)
        flaky.append(n)
problems = [p for p in problems if p not in flaky and p.split("#")[0] not in retried_ok]
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
    f"**{count('PASS')} passed · {count('FAIL') + count('ERROR') + count('CRASH') + count('NOT RUN')} failed · {count('FLAKY')} flaky (passed on retry) · {count('SKIPPED')} skipped**",
    "",
    "| Test | Result | Note |",
    "|---|---|---|",
    *[f"| {n} | {r} | {w.replace('|', '/')} |" for n, r, w in rows],
    "",
    *(["**Crashes (logcat)**", "", *[f"```\n{c}\n```" for c in crashes[:3]], ""] if crashes else []),
    *(["**Page errors (WebView console)**", "", "```", *page_errors[:12], "```", ""] if page_errors else []),
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
