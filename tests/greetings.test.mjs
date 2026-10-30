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

const jpeg = (fill = 7, size = 3000) => {
  const b = Buffer.alloc(size, fill);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff;
  return "data:image/jpeg;base64," + b.toString("base64");
};

test("picture greetings: ONE stored copy, likes with a count, seen/liked lists only for the Main Admin", async (t) => {
  const f = await fixture(t);
  const a = f.client(), b = f.client(), c = f.client();
  const ma = await f.enroll(a, { ...example, phone: "9000000041", name: "Asha Vala" });
  const mb = await f.enroll(b, { ...example, phone: "9000000042", name: "Bhavesh Vala" });
  await f.enroll(c, { ...example, phone: "9000000043", name: "Chetan Vala" });
  await f.admin("admin/greetings", { text: "", to: "all" }, 400);
  await f.admin("admin/greetings", { image: "data:image/png;base64,iVBORw0KGgo=", to: "all" }, 400);
  const sent = await f.admin("admin/greetings", { text: "", image: jpeg(), to: "all" });
  const id = sent.sent.id;
  // One picture row, however many recipients.
  assert.equal(f.store.all("greetingImages").length, 1);
  assert.ok(!JSON.stringify(f.store.all("inbox")).includes("base64"), "inbox rows never hold the picture");
  let s = await a("state");
  assert.ok(s.messages[0].image, "members get the picture's version");
  assert.equal((await a(`greetings/${id}/image`)).length, 3000);
  // Likes: count for everyone, no notification for anybody.
  const before = f.store.all("notifications").length;
  s = await a(`messages/${id}/like`, {});
  assert.equal(s.messages[0].liked, true);
  assert.equal(s.messages[0].likes, 1);
  await b(`messages/${id}/like`, {});
  assert.equal((await c("state")).messages[0].likes, 2, "everyone sees the like count");
  await b(`messages/${id}/unlike`, {});
  assert.equal((await a("state")).messages[0].likes, 1);
  assert.equal(f.store.all("notifications").length, before, "likes and views never notify");
  // The Main Admin sees who saw and who liked, any time.
  const st = await f.admin(`admin/greetings/${id}/stats`);
  assert.deepEqual(st.liked.map((x) => x.id), [ma.id]);
  assert.deepEqual(st.seen.map((x) => x.id).sort(), [ma.id, mb.id].sort());
  assert.equal(st.notSeen, st.count - 2);
  const sentList = (await f.admin("state")).greetingsSent[0];
  assert.equal(sentList.liked, 1);
  assert.equal(sentList.seen, 2);
  // Members cannot see the lists.
  await a(`admin/greetings/${id}/stats`, undefined, 403);
});

test("the Main Admin edits or removes a greeting for everyone", async (t) => {
  const f = await fixture(t);
  const a = f.client(), b = f.client();
  await f.enroll(a, { ...example, phone: "9000000051" });
  await f.enroll(b, { ...example, phone: "9000000052" });
  const id = (await f.admin("admin/greetings", { text: "Meeting at 5", image: jpeg(), to: "all" })).sent.id;
  await a(`admin/greetings/${id}/edit`, { text: "x" }, 403);
  await f.admin(`admin/greetings/${id}/edit`, { text: "Meeting at 6", image: jpeg(9) });
  let s = await a("state");
  assert.equal(s.messages[0].text, "Meeting at 6");
  assert.ok(s.messages[0].edited);
  assert.equal(f.store.all("greetingImages").length, 1, "still one copy");
  await f.admin(`admin/greetings/${id}/edit`, { image: null });
  assert.equal((await a("state")).messages[0].image, 0);
  assert.equal(f.store.all("greetingImages").length, 0);
  await f.admin(`admin/greetings/${id}/edit`, { text: "" }, 400);
  await f.admin(`admin/greetings/${id}/delete`, {});
  assert.equal((await a("state")).messages.length, 0);
  assert.equal((await b("state")).messages.length, 0);
  assert.equal(f.store.all("inbox").length, 0);
  await f.admin(`admin/greetings/${id}/delete`, {}, 404);
});

test("a member who deleted the greeting, or never got it, cannot open its picture", async (t) => {
  const f = await fixture(t);
  const a = f.client(), b = f.client();
  const ma = await f.enroll(a, { ...example, phone: "9000000061" });
  await f.enroll(b, { ...example, phone: "9000000062" });
  const id = (await f.admin("admin/greetings", { image: jpeg(), to: "some", ids: [ma.id] })).sent.id;
  await b(`greetings/${id}/image`, undefined, 404);
  await a(`messages/${id}/delete`, {});
  await a(`greetings/${id}/image`, undefined, 404);
  assert.equal((await f.admin(`greetings/${id}/image`)).length, 3000, "the Main Admin always can");
});
