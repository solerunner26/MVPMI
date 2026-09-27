// HTTP routes for the Google Drive backup (admin only, plus a cron hook).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createDriveBackup } from "./drive-backup.mjs";

export function installDriveBackup(app, store, { admin, rate, env, options }) {
  const drive = createDriveBackup(store, env, options);
  const cronToken = drive.configured
    ? createHmac("sha256", env.BACKUP_PASSPHRASE).update("mvpmi-cron-backup-v1").digest("hex").slice(0, 40)
    : "";
  const publicUrl = String(env.PUBLIC_URL || "").replace(/\/+$/, "");
  const cronCommand = cronToken
    ? `curl -fsS -X POST -H 'X-MVPMI-Client: 1' -H 'Content-Type: application/json' -H 'X-MVPMI-Cron: ${cronToken}' -d '{}' ${publicUrl}/api/cron/backup`
    : "";
  const view = () => ({ ...drive.status(), cronCommand });

  // An overdue backup starts on ordinary traffic (never delays the request).
  app.use("/api", (req, res, next) => {
    try {
      if (drive.due()) drive.backup("auto").catch(() => {});
    } catch {}
    next();
  });
  app.get("/api/admin/drive", admin, (req, res) => res.json(view()));
  app.post("/api/admin/drive/connect", admin, (req, res) => {
    const state = randomBytes(24).toString("hex");
    store.put("config", { id: "drive-oauth", state, session: req.session.id, until: Date.now() + 600000 });
    res.json({ url: drive.authUrl(state) });
  });
  // Google sends the administrator back here after consent.
  app.get("/api/drive/callback", async (req, res) => {
    const pending = store.get("config", "drive-oauth");
    store.put("config", { id: "drive-oauth" });
    const ok =
      pending?.state &&
      typeof req.query.state === "string" &&
      req.query.state.length === pending.state.length &&
      timingSafeEqual(Buffer.from(req.query.state), Buffer.from(pending.state)) &&
      pending.until > Date.now() &&
      req.isAdmin &&
      req.session?.id === pending.session &&
      typeof req.query.code === "string";
    if (!ok) return res.redirect(303, "/?drive=error");
    try {
      await drive.connect(req.query.code);
      store.audit(req.session.owner, "drive-backup.connect", drive.status().account || "google");
      drive.backup("first").catch(() => {});
      res.redirect(303, "/?drive=connected");
    } catch {
      res.redirect(303, "/?drive=error");
    }
  });
  app.post("/api/admin/drive/backup", admin, async (req, res, next) => {
    try {
      rate("drive-backup", 6, 3600000);
      await drive.backup("manual");
      store.audit(req.session.owner, "drive-backup.manual", "database");
      res.json(view());
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/admin/drive/disconnect", admin, async (req, res) => {
    await drive.disconnect();
    store.audit(req.session.owner, "drive-backup.disconnect", "google");
    res.json(view());
  });
  // Daily cPanel cron job (command shown in the admin Backup tab).
  app.post("/api/cron/backup", async (req, res) => {
    const given = String(req.get("X-MVPMI-Cron") || "");
    if (!cronToken || given.length !== cronToken.length || !timingSafeEqual(Buffer.from(given), Buffer.from(cronToken)))
      return res.status(403).json({ error: "Forbidden" });
    try {
      const r = await drive.backup("cron");
      res.json({ ok: true, name: r.name });
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e.message).slice(0, 200) });
    }
  });
  return drive;
}
