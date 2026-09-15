import test from "node:test";
import assert from "node:assert/strict";
import { contactLinks } from "../web/contact-actions.mjs";

test("contact links normalize Indian mobile numbers without duplicating the country code", () => {
  for (const raw of [
    "9000000001",
    "90000 00001",
    "+91 90000 00001",
    "919000000001",
    "(90000) 00001",
  ]) {
    const links = contactLinks(raw);
    assert.equal(links.call, "tel:+919000000001");
    assert.equal(links.whatsapp, "https://wa.me/919000000001");
    assert.equal(links.target, "_blank");
  }
  assert.equal(contactLinks("8000000002", true).target, "_self");
});

test("contact links reject malformed numbers, USSD, URL injection and non-Indian numbers", () => {
  for (const raw of [
    null,
    "",
    "123",
    "1234567890",
    "*123#",
    "9000000001?x=1",
    "javascript:9000000001",
    "+449000000001",
    "9000000001/",
    "9000000001abc",
    "9000000001\nhttps://evil.example",
  ]) {
    assert.equal(contactLinks(raw), null, String(raw));
  }
});
