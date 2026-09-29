// Shared vocabulary (Section 0). Use these exact meanings everywhere.
//
//   PASSWORD  – used only by the Main Admin. Any characters, at least 4
//               (owner decision 2026-09-30: no complexity rules).
//   PIN       – OPTIONAL. A 4-digit number a Member or Village Admin may
//               choose in My Profile to lock the app on THEIR phone. It is
//               not a login secret: Members and Village Admins log in with
//               their mobile number only (owner decision 2026-09-30).
import { randomInt } from "node:crypto";

export const ROLES = Object.freeze({
  MAIN_ADMIN: "MAIN_ADMIN",
  VILLAGE_ADMIN: "VILLAGE_ADMIN",
  MEMBER: "MEMBER",
});

export const STATUS = Object.freeze({
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REMOVED: "REMOVED",
});

// Easy PINs are refused everywhere a PIN is chosen.
export const WEAK_PINS = Object.freeze([
  "0000",
  "1111",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
  "1234",
  "4321",
]);

export const isPinFormat = (pin) => /^\d{4}$/.test(String(pin ?? ""));
export const isWeakPin = (pin) => WEAK_PINS.includes(String(pin ?? ""));

export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 128;
export const isPasswordFormat = (value) =>
  typeof value === "string" &&
  value.length >= PASSWORD_MIN &&
  value.length <= PASSWORD_MAX &&
  !/[\u0000-\u001f\u007f]/.test(value);

// A random TEMP PIN that is never one of the easy PINs.
export function randomTempPin() {
  for (;;) {
    const pin = String(randomInt(0, 10000)).padStart(4, "0");
    if (!isWeakPin(pin)) return pin;
  }
}

// Wrong PIN / password attempts: 5 wrong → locked for 5 minutes.
export const MAX_WRONG_ATTEMPTS = 5;
export const LOCKOUT_MS = 5 * 60000;
// App lock: lock when the app returns after this long in the background.
export const BACKGROUND_LOCK_MS = 60000;
