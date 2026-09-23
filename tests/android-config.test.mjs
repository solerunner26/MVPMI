import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const read = (p) => readFileSync("android/" + p, "utf8");
test("Android static configuration: minimal permissions, HTTPS-only, no device/cloud backup", () => {
  const manifest = read("app/src/main/AndroidManifest.xml");
  assert.deepEqual(
    [...manifest.matchAll(/uses-permission android:name="([^"]+)"/g)].map(
      (m) => m[1],
    ),
    [
      "android.permission.INTERNET",
      "android.permission.POST_NOTIFICATIONS",
      // Keeps the background notification check scheduled after a reboot.
      "android.permission.RECEIVE_BOOT_COMPLETED",
    ],
  );
  assert.ok(manifest.includes('android:allowBackup="false"'));
  assert.ok(manifest.includes('android:dataExtractionRules="@xml/data_extraction_rules"'));
  assert.ok(manifest.includes('android:usesCleartextTraffic="false"'));
  assert.ok(manifest.includes('android:networkSecurityConfig="@xml/network_security_config"'));
  assert.ok(manifest.includes('android:enableOnBackInvokedCallback="true"'));
  assert.ok(manifest.includes("uiMode"), "dark-mode switch must not reload the page");
  assert.match(manifest, /NotificationJob"[^>]*BIND_JOB_SERVICE/);
  const nsc = read("app/src/main/res/xml/network_security_config.xml");
  assert.ok(nsc.includes('cleartextTrafficPermitted="false"'));
  assert.ok(nsc.includes("@raw/isrg_root_x1"));
  assert.ok(existsSync("android/app/src/main/res/raw/isrg_root_x1.pem"));
});
test("Android static source: secure window, narrow bridge, no SSL bypass, no clipboard copy", () => {
  const source = read("app/src/main/java/org/mvpmi/directory/MainActivity.kt");
  assert.ok(source.includes("FLAG_SECURE"), "screenshots of the directory are blocked");
  assert.ok(source.includes("allowFileAccess = false"));
  assert.ok(source.includes("allowContentAccess = false"));
  assert.ok(source.includes("MIXED_CONTENT_NEVER_ALLOW"));
  assert.ok(source.includes("Intent.ACTION_DIAL"));
  assert.ok(source.includes("request.isForMainFrame"));
  assert.ok(source.includes("onReceivedHttpError"));
  // The web bridge is deliberate and narrow: exactly five annotated methods
  // (save sheet, print sheet, notification, device registration, pull now).
  assert.ok(source.includes('addJavascriptInterface(Bridge(), "mvpmiBridge")'));
  assert.equal(
    (source.match(/@android\.webkit\.JavascriptInterface/g) || []).length,
    5,
  );
  assert.ok(source.includes("printer.settings.javaScriptEnabled = false"));
  assert.equal(source.includes("handler.proceed"), false);
  assert.equal(source.includes("Intent.ACTION_CALL"), false);
  assert.equal(source.includes("ClipboardManager"), false);
  assert.ok(source.includes("BuildConfig.VERSION_NAME"));
  const notifications = read("app/src/main/java/org/mvpmi/directory/Notifications.kt");
  assert.ok(notifications.includes("X-MVPMI-Device"));
  assert.ok(notifications.includes("setPeriodic(15 * 60 * 1000L)"));
  assert.ok(notifications.includes("VISIBILITY_PRIVATE"));
});
test("Android Gradle: API 36 target, permanent release key from environment, site-root URL", () => {
  const gradle = read("app/build.gradle.kts");
  assert.match(gradle, /targetSdk\s*=\s*36/);
  assert.match(gradle, /minSdk\s*=\s*21/);
  assert.ok(gradle.includes("verifyReleaseReadiness"));
  assert.ok(gradle.includes('System.getenv("MVPMI_KEYSTORE_FILE")'));
  assert.ok(gradle.includes('gradleProperty("versionCode")'));
  assert.ok(gradle.includes("rawPath.isNullOrEmpty()"));
  assert.equal(gradle.includes("Release blocked:"), false);
  assert.equal(/\.jks"|storePassword\s*=\s*"/.test(gradle), false, "no key material in the repository");
});
