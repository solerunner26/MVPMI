import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync("android/" + p, "utf8");
test("Android static configuration: network permission only, no cleartext or device backup", () => {
  const manifest = read("app/src/main/AndroidManifest.xml");
  assert.deepEqual(
    [...manifest.matchAll(/uses-permission android:name="([^"]+)"/g)].map(
      (m) => m[1],
    ),
    ["android.permission.INTERNET"],
  );
  assert.ok(manifest.includes('android:allowBackup="false"'));
  assert.ok(manifest.includes('android:usesCleartextTraffic="false"'));
  assert.ok(manifest.includes('android:enableOnBackInvokedCallback="true"'));
});
test("Android static source: HTTPS navigation policy, no SSL bypass or JavaScript interface", () => {
  const source = read("app/src/main/java/org/mvpmi/directory/MainActivity.kt");
  assert.ok(source.includes("allowFileAccess = false"));
  assert.ok(source.includes("allowContentAccess = false"));
  assert.ok(source.includes("MIXED_CONTENT_NEVER_ALLOW"));
  assert.ok(source.includes("Intent.ACTION_DIAL"));
  assert.ok(source.includes("request.isForMainFrame"));
  assert.equal(source.includes("addJavascriptInterface"), false);
  assert.equal(source.includes("handler.proceed"), false);
  assert.equal(source.includes("Intent.ACTION_CALL"), false);
});
test("Android static Gradle declarations: API 36 target and explicit release blocker", () => {
  const gradle = read("app/build.gradle.kts");
  assert.match(gradle, /targetSdk\s*=\s*36/);
  assert.match(gradle, /minSdk\s*=\s*21/);
  assert.ok(gradle.includes("verifyReleaseReadiness"));
  assert.ok(gradle.includes("Release blocked:"));
});
