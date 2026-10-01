#!/usr/bin/env bash
# Runs the Android instrumented tests on a running emulator (CI, inside
# reactivecircus/android-emulator-runner). Needs:
#   - the test server on the host: node scripts/android-test-server.mjs 3900
#   - app-debug.apk built with -PcommunityDebugUrl=http://10.0.2.2:3900
#   - app-debug-androidTest.apk
# Writes device-test-results/api-<N>/ (environment, raw output, logcat,
# summary.md). Exit code 1 if any test failed or crashed.
set -uo pipefail
API="${1:?api level}"
OUT="device-test-results/api-$API"
mkdir -p "$OUT"
PKG=org.mvpmi.directory
RUNNER="$PKG.test/androidx.test.runner.AndroidJUnitRunner"
APK=android/app/build/outputs/apk/debug/app-debug.apk
TAPK=android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk

adb wait-for-device
adb shell 'while [ "$(getprop sys.boot_completed)" != "1" ]; do sleep 2; done'
adb shell svc power stayon true
adb shell input keyevent 82 || true
adb shell wm dismiss-keyguard || true
# Show the on-screen keyboard even though the emulator has a hardware one.
adb shell settings put secure show_ime_with_hard_keyboard 1
adb shell settings put system screen_off_timeout 1800000

{
  echo "API level: $API ($(adb shell getprop ro.build.version.release | tr -d '\r'))"
  echo "Emulator image: $(adb shell getprop ro.product.model | tr -d '\r') · $(adb shell getprop ro.build.fingerprint | tr -d '\r')"
  echo "WebView: $(adb shell dumpsys webviewupdate | grep -m1 -i 'Current WebView package' | tr -d '\r' | sed 's/^ *//')"
  echo "APK sha256: $(sha256sum "$APK" | cut -d' ' -f1)"
  echo "Test APK sha256: $(sha256sum "$TAPK" | cut -d' ' -f1)"
  echo "Source and test-server commit: ${GITHUB_SHA:-$(git rev-parse HEAD)}"
  echo "Test server: http://10.0.2.2:3900 (scripts/android-test-server.mjs, synthetic data)"
} > "$OUT/environment.txt"
cat "$OUT/environment.txt"

# Install/update signing: can this build update the published alpha.1 app?
PREV=https://github.com/solerunner26/MVPMI/releases/download/v1.2.0-alpha.1/mvpmi.apk
{
  echo "## Update over the published v1.2.0-alpha.1 APK"
  if curl -fsSL -o prev.apk "$PREV" && adb install prev.apk >/dev/null 2>&1; then
    if out=$(adb install -r "$APK" 2>&1); then echo "Result: installs as an UPDATE (same signing key)."
    else echo "Result: update REFUSED — $(echo "$out" | grep -o 'INSTALL_FAILED[A-Z_]*' | head -1). Testers must uninstall the old app first (debug-signed builds use a different key per build machine)."; fi
  else echo "Result: could not install the previous APK on this emulator; not checked."; fi
  adb uninstall "$PKG" >/dev/null 2>&1 || true
} > "$OUT/update-check.md"
cat "$OUT/update-check.md"
rm -f prev.apk

adb install -r "$APK" || exit 1
adb install -r "$TAPK" || exit 1
adb logcat -c

# Finger touches for the biometric tests: the tests write FINGER_GOOD /
# FINGER_BAD to logcat when the phone's fingerprint prompt is showing.
( adb logcat -v brief -s MVPMITEST:I | while read -r line; do
    case "$line" in
      *FINGER_GOOD*) adb -e emu finger touch 1 ;;
      *FINGER_BAD*) adb -e emu finger touch 2 ;;
    esac
  done ) &
WATCHER=$!

RAW="$OUT/instrument-raw.txt"
: > "$RAW"
# run <Class[#method]> [keep] [ask-notifications]
run() {
  local target="$1" keep="${2:-}" ask="${3:-}"
  if [ "$keep" != keep ]; then adb shell pm clear "$PKG" >/dev/null; fi
  if [ "$API" -ge 33 ] && [ "$ask" != ask ]; then
    adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
  fi
  echo "=== $target" | tee -a "$RAW"
  local once
  once=$(adb shell am instrument -w -r -e class "$PKG.$target" "$RUNNER" 2>&1 | tr -d '\r')
  echo "$once" | tee -a "$RAW" >/dev/null
  # One retry for a failed or killed class; the report marks it FLAKY.
  if echo "$once" | grep -qE "INSTRUMENTATION_STATUS_CODE: -(1|2)$|shortMsg=Process crashed"; then
    adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || true
    adb shell svc wifi enable >/dev/null 2>&1 || true
    echo "=== $target (retry)" | tee -a "$RAW"
    adb shell am instrument -w -r -e class "$PKG.$target" "$RUNNER" 2>&1 | tr -d '\r' | tee -a "$RAW" >/dev/null
  fi
  adb shell input keyevent 3 >/dev/null 2>&1 || true # Home between classes
  # Network back on even if a test stopped half-way (no cascade of failures).
  adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || true
  adb shell svc wifi enable >/dev/null 2>&1 || true
  adb shell svc data enable >/dev/null 2>&1 || true
}

run LaunchLoginBackTest
run NativeShellTest
for shot in splash bar; do
  adb pull "/sdcard/Download/mvpmi-$shot.png" "$OUT/native-$shot.png" >/dev/null 2>&1 || true
done
run RotationKeyboardTest
run ServerUnreachableTest
run ColdStartTest#phase1_loginAndTurnOnPinLock
adb shell am force-stop "$PKG" # the process is killed: a real cold start follows
run ColdStartTest#phase2_coldStartAsksForThePinThenTurnsItOff keep
run BackgroundLockTest
run CallWhatsAppIntentTest
run RealDiallerTest
run ExportSaveTest
run NotificationPermissionTest "" ask
run DeviceOfflineTest
# Fingerprint last: it sets a screen-lock PIN on the emulator.
run FingerprintSetup keep
run BiometricUnlockTest
adb shell locksettings clear --old 1111 >/dev/null 2>&1 || true

kill "$WATCHER" 2>/dev/null || true
adb logcat -d > "$OUT/logcat.txt"
grep -h "MVPMITEST" "$OUT/logcat.txt" | grep "ENV " | tail -1 | sed 's/^.*ENV /App-reported environment: /' >> "$OUT/environment.txt"
python3 scripts/instrument-summary.py "$API" "$OUT"
# Small previews of the native splash and glass bar in the run annotations
# (the artifacts hold the full-size screenshots).
if [ -n "${GITHUB_ACTIONS:-}" ]; then
  python3 -m pip install -q pillow >/dev/null 2>&1 || true
  python3 - "$API" "$OUT" <<'PY' || true
import base64, io, sys
from PIL import Image
api, out = sys.argv[1], sys.argv[2]
for name in ("splash", "bar"):
    try:
        im = Image.open(f"{out}/native-{name}.png").convert("RGB")
    except Exception:
        continue
    if name == "bar":
        im = im.crop((0, int(im.height * 0.62), im.width, im.height))
    im.thumbnail((300, 520))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=55)
    print(f"::notice title=API {api} native {name} preview::" + base64.b64encode(buf.getvalue()).decode())
PY
fi
