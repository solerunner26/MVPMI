// Greetings and the Message Centre (owner, 21 Oct 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, example } from "./helpers.mjs";

test("only the Main Admin sends greetings; everyone else (and Village Admins) receives them", async (t) => {
  const f = await fixture(t);
  const a = f.client(), b = f.client();
  await f.enroll(a, { ...example, phone: "9000000011", name: "Asha Vala" });
  await f.enroll(b, { ...example, phone: "9000000012", name: "Bhavesh Vala" });
  // A member cannot send.
  assert.equal((await a("admin/greetings", { text: "Hello", to: "all" }, 403)).code, "FORBIDDEN");
  await f.admin("admin/greetings", { text: "", to: "all" }, 400);
  const sent = await f.admin("admin/greetings", { text: "દિવાળીની શુભકામનાઓ 🪔\nHappy Diwali", to: "all" });
  // Two members + the Village Admin of Thorala; never the Main Admin himself.
  assert.equal(sent.sent.count, 3);
  assert.equal(sent.messages.length, 0, "the sender gets no copy");
  assert.equal(sent.greetingsSent[0].count, 3);
  let s = await a("state");
  assert.equal(s.messages.length, 1);
  assert.equal(s.messages[0].text, "દિવાળીની શુભકામનાઓ 🪔\nHappy Diwali");
  assert.equal(s.messagesUnread, 1);
  assert.equal(s.messages[0].closed, false);
  assert.equal(s.greetingsSent, undefined, "members do not see the sent list");
  const va = await f.va("થોરાળા")("state");
  assert.equal(va.messages.length, 1, "Village Admins receive greetings");
  // A phone notification is queued for the member.
  assert.ok(f.store.all("notifications").some((n) => n.kind === "greeting" && n.to.startsWith("owner:")));
  // X on the flash card: closed but still unread in the Message Centre.
  const id = s.messages[0].id;
  s = await a(`messages/${id}/close`, {});
  assert.equal(s.messages[0].closed, true);
  assert.equal(s.messagesUnread, 1);
  s = await a(`messages/${id}/read`, {});
  assert.equal(s.messagesUnread, 0);
  // Delete removes it for this member only.
  s = await a(`messages/${id}/delete`, {});
  assert.equal(s.messages.length, 0);
  assert.equal((await b("state")).messages.length, 1);
  // Nobody can touch someone else's message.
  await a(`messages/${id}/read`, {}, 404);
});

test("greetings to members picked by name reach only them", async (t) => {
  const f = await fixture(t);
  const a = f.client(), b = f.client();
  const ma = await f.enroll(a, { ...example, phone: "9000000021", name: "Asha Vala" });
  await f.enroll(b, { ...example, phone: "9000000022", name: "Bhavesh Vala" });
  await f.admin("admin/greetings", { text: "Meeting on Sunday", to: "some", ids: [] }, 400);
  const sent = await f.admin("admin/greetings", { text: "Meeting on Sunday", to: "some", ids: [ma.id, "not-a-member"] });
  assert.equal(sent.sent.count, 1);
  assert.equal((await a("state")).messages.length, 1);
  assert.equal((await b("state")).messages.length, 0);
});

test("nothing about greetings leaves the server while the app is locked", async (t) => {
  const f = await fixture(t, { requireAppLock: true });
  const a = f.client();
  await f.enroll(a, { ...example, phone: "9000000031" });
  await f.admin("admin/greetings", { text: "Hello", to: "all" });
  const s = await a("state");
  if (s.locked) assert.deepEqual(s.messages, []);
});
