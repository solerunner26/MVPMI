import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, profile } from "../server/store.mjs";

test("SQLite data survives reopening and failed transactions roll back", () => {
  const folder = mkdtempSync(join(tmpdir(), "mvpmi-test-")),
    path = join(folder, "directory.sqlite");
  try {
    let store = new Store(path);
    const m = {
      ...profile({
        name: "Synthetic Member",
        phone: "9000000001",
        village: "Thorala",
      }),
      id: "member-1",
      owner: "owner-1",
    };
    store.put("members", m);
    store.archive(m, "Withdrawn test snapshot");
    store.db.close();
    store = new Store(path);
    assert.equal(store.get("members", "member-1").name, "Synthetic Member");
    assert.equal(store.all("archive").length, 1);
    assert.throws(() =>
      store.tx(() => {
        store.del("members", "member-1");
        throw new Error("Simulated write failure");
      }),
    );
    assert.equal(store.all("members").length, 1);
    store.db.close();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
