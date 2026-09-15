import { chromium } from "playwright";
import chrome from "@sparticuz/chromium";
import { brotliDecompressSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
export async function launchBrowser() {
  const libs = tmpdir() + "/mvpmi-browser-libs";
  mkdirSync(libs, { recursive: true });
  writeFileSync(
    libs + "/libs.tar",
    brotliDecompressSync(
      readFileSync("node_modules/@sparticuz/chromium/bin/al2023.tar.br"),
    ),
  );
  execFileSync("tar", ["xf", libs + "/libs.tar", "-C", libs]);
  return chromium.launch({
    executablePath: await chrome.executablePath(),
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
    ],
    env: { ...process.env, LD_LIBRARY_PATH: libs + "/lib" },
    headless: true,
  });
}
