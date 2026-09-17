import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
function fixture(statuses) {
  const calls = [],
    removed = [];
  const scope = {
    DesignComponent: class {
      setState(patch) {
        this.state = { ...this.state, ...patch };
      }
    },
    SEED: {
      members: [],
      newRequests: [],
      updateRequests: [],
      deleteRequests: [],
      archive: [],
      alerts: [],
    },
    clone: structuredClone,
    AbortSignal,
    sessionStorage: { removeItem: (key) => removed.push(key) },
    fetch: async (path, options) => {
      calls.push({ path, ...options });
      const status = statuses.shift();
      return new Response(
        JSON.stringify(
          status === 401
            ? { error: "Preview session expired. Refresh to reconnect." }
            : status === 403
              ? { error: "Device blocked" }
              : { role: "guest" },
        ),
        { status },
      );
    },
  };
  runInNewContext(
    readFileSync("web/controller.js", "utf8") + ";this.Controller=Component;",
    scope,
  );
  const controller = new scope.Controller();
  controller._alive = true;
  controller._transport = "old-token";
  controller._transportPromise = Promise.resolve();
  controller.state = {
    role: "member",
    meId: "private",
    members: [{ id: "private" }],
  };
  controller.ensureTransport = async () => {
    if (!controller._transport) {
      controller._transport = "fresh-token";
      controller._transportPromise = Promise.resolve();
    }
  };
  return { controller, calls, removed };
}
test("expired preview GET clears private view and reconnects exactly once as a fresh guest", async () => {
  const { controller, calls, removed } = fixture([401, 200]);
  const response = await controller.request("state");
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers["X-MVPMI-Session"], "old-token");
  assert.equal(calls[1].headers["X-MVPMI-Session"], "fresh-token");
  assert.deepEqual(removed, ["mvpmi-preview-session"]);
  assert.equal(controller.state.role, "guest");
  assert.equal(controller.state.meId, null);
  assert.equal(controller.state.members.length, 0);
});
test("expired mutation is not replayed", async () => {
  const { controller, calls } = fixture([401]);
  const response = await controller.request("admin/approve", { id: "request" });
  assert.equal(response.status, 401);
  assert.equal(calls.length, 1);
  assert.equal(controller._transport, null);
  assert.equal(controller._transportPromise, null);
});
test("blocked devices do not get an automatic replacement transport", async () => {
  const { controller, calls, removed } = fixture([403]);
  const response = await controller.request("state");
  assert.equal(response.status, 403);
  assert.equal(calls.length, 1);
  assert.deepEqual(removed, []);
  assert.equal(controller._transport, "old-token");
});
test("a second expiry cannot create a reconnect loop", async () => {
  const { controller, calls } = fixture([401, 401]);
  assert.equal((await controller.request("state")).status, 401);
  assert.equal(calls.length, 2);
});
