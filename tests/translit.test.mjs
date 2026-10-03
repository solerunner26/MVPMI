// Names and places are kept and shown in both scripts (owner, 3 Oct 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { toLatin, toGujarati, bothScripts, nameFor, placeFor } from "../web/translit.mjs";
import { Store, profile } from "../server/store.mjs";

test("Gujarati names read naturally in English", () => {
  assert.equal(toLatin("ભગીરથસિંહ જસવંતસિંહ ગોહિલવાડિયા"), "Bhagirathsinh Jaswantsinh Gohilvadiya");
  assert.equal(toLatin("મનોજભાઈ પરમાર"), "Manojbhai Parmar");
  assert.equal(toLatin("ભાવનગર"), "Bhavnagar");
  assert.equal(toLatin("અમદાવાદ, ગુજરાત"), "Ahmedabad, Gujarat");
});

test("English names and places get a Gujarati spelling", () => {
  assert.equal(toGujarati("Jaswantsinh Gohil"), "જસવંતસિંહ ગોહિલ");
  assert.equal(toGujarati("Kishor Chudasama"), "કિશોર ચુડાસમા");
  assert.equal(toGujarati("Surat"), "સુરત");
  assert.deepEqual(bothScripts("સુરત"), { en: "Surat", gu: "સુરત" });
});

test("a profile typed in either script stores both", () => {
  const gu = profile({ firstName: "હિતેશ", surname: "પરમાર", phone: "9876543210", village: "થોરાળા", currentLocation: "સુરત" });
  assert.equal(gu.nameGu, "હિતેશ પરમાર");
  assert.equal(gu.name, "Hitesh Parmar");
  assert.equal(gu.currentLocation, "સુરત", "what was typed is kept");
  assert.equal(gu.currentLocationEn, "Surat");
  const en = profile({ firstName: "Hitesh", surname: "Parmar", phone: "9876543210", village: "Thorala", currentLocation: "Ahmedabad" });
  assert.equal(en.name, "Hitesh Parmar");
  assert.equal(en.nameGu, "હિતેશ પરમાર");
  assert.equal(en.currentLocationGu, "અમદાવાદ");
  assert.equal(nameFor(en, "gu"), "હિતેશ પરમાર");
  assert.equal(placeFor(gu, "en"), "Surat");
});

test("existing records are given both scripts without losing what was typed", () => {
  const store = new Store(":memory:");
  store.put("members", { id: "m1", owner: "o1", firstName: "હિતેશ", surname: "પરમાર", name: "હિતેશ પરમાર", nameGu: "હિતેશ પરમાર", phone: "9876543210", village: "થોરાળા", currentLocation: "Surat" });
  store.put("members", { id: "m2", owner: "o2", firstName: "Asha", surname: "Vala", name: "Asha Vala", nameGu: "Asha Vala", phone: "9876543211", village: "થોરાળા" });
  store.initializeBothScripts();
  const m1 = store.get("members", "m1");
  assert.equal(m1.name, "Hitesh Parmar");
  assert.equal(m1.nameGu, "હિતેશ પરમાર");
  assert.equal(m1.currentLocation, "Surat");
  assert.equal(m1.currentLocationGu, "સુરત");
  assert.equal(m1.firstName, "હિતેશ", "typed parts untouched");
  const m2 = store.get("members", "m2");
  assert.equal(m2.name, "Asha Vala");
  assert.equal(m2.nameGu, "આશા વાળા");
  assert.equal(m2.phone, "9876543211");
});
