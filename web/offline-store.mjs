// Section 1: a local copy of the APPROVED directory, so a logged-in user can
// still view and call contacts without internet. It is kept only in this
// app's private storage, only for a logged-in approved account, and it is
// wiped on "Sign out of this phone", when the account is removed, and when
// another person logs in on this phone.
//
// When the app lock is on, a salted PBKDF2 verifier of the PIN (or the Main
// Admin password) lets the lock open offline too; the secret itself is never
// stored.
export const OFFLINE_KEY = "mvpmi.offline.v1";

export function loadOffline() {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && Array.isArray(data.members) && data.account?.id ? data : null;
  } catch {
    return null;
  }
}

function write(data) {
  try {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(data));
  } catch {
    /* storage full or unavailable: the app still works online */
  }
}

export function saveOffline({ account, members, villages, at = Date.now() }) {
  if (!account?.id || !Array.isArray(members)) return;
  const previous = loadOffline();
  const sameAccount = previous?.account?.id === account.id;
  write({
    account: {
      id: account.id,
      role: account.role,
      name: account.name,
      nameGu: account.nameGu,
      phone: account.phone,
      village: account.village,
      lockOn: !!account.lockOn,
    },
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      nameGu: m.nameGu,
      firstName: m.firstName,
      middleName: m.middleName,
      surname: m.surname,
      phone: m.phone,
      phone2: m.phone2,
      label2: m.label2,
      village: m.village,
      tehsil: m.tehsil,
      district: m.district,
      currentLocation: m.currentLocation,
    })),
    villages: Array.isArray(villages) ? villages.map((v) => ({ gu: v.gu, en: v.en })) : previous?.villages || [],
    at,
    unlock: sameAccount ? previous.unlock : null,
  });
}

// Keeps the offline copy's account details (lock setting) in step without
// replacing the member list while the app is locked.
export function updateOfflineAccount(patch) {
  const data = loadOffline();
  if (!data) return;
  write({ ...data, account: { ...data.account, ...patch } });
}

export function clearOffline() {
  try {
    localStorage.removeItem(OFFLINE_KEY);
  } catch {
    /* nothing to clear */
  }
}

// Called after a successful online unlock/login with the secret the person
// just typed, so the lock can also be opened without internet.
export function rememberOfflineUnlock(accountId, secret) {
  const data = loadOffline();
  if (!data || data.account.id !== accountId || !secret) return;
  const salt = randomSaltHex();
  write({ ...data, unlock: { salt, hash: derivePinHash(String(secret), salt, 20000) } });
}

export function verifyOfflineUnlock(secret) {
  const data = loadOffline();
  if (!data?.unlock) return false;
  return derivePinHash(String(secret), data.unlock.salt, 20000) === data.unlock.hash;
}
