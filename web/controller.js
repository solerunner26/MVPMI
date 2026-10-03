// The supplied design remains the renderer; all domain actions below go to the API.
function formatRecovery(code) {
  return String(code || "").replace(/^(.{4})(.{4})(.{4})(.{4})$/, "$1-$2-$3-$4");
}
class Component extends DesignComponent {
  L(gu, en) {
    return this.P(gu, en);
  }
  O(value) {
    if (
      /^\d{4}-\d{2}-\d{2}T/.test(String(value)) &&
      Number.isFinite(Date.parse(value))
    )
      return new Date(value).toLocaleString(
        this.state.lang === "gu" ? "gu-IN" : "en-IN",
        { dateStyle: "medium", timeStyle: "short" },
      );
    return singleLanguageStatus(value, this.state.lang);
  }
  // Android app: the system print sheet (Save as PDF anywhere, including
  // Google Drive). Ordinary browsers: the print preview frame.
  printReport(titleGu, titleEn, html) {
    printHtml(this.P(titleGu, titleEn), html);
    this.flash(
      "પ્રિન્ટ શીટ ખૂલી — Save as PDF પસંદ કરો.",
      "Print sheet opened — choose Save as PDF.",
    );
  }
  printPdf(members) {
    members = [...members].sort(memberNameOrder(this.state.lang));
    this.printReport(
      "સમાજ સંપર્ક યાદી",
      "Community directory",
      printDocument(
        members.map((m) => ({
          ...m,
          villageGu:
            VILLAGE_LIST.find((v) => v.gu === m.village || v.en === m.village)
              ?.gu || m.village,
          villageEn:
            VILLAGE_LIST.find((v) => v.gu === m.village || v.en === m.village)
              ?.en || m.village,
          tehsilGu: TEHSIL_GU,
          tehsilEn: TEHSIL_EN,
          districtGu: DISTRICT_GU,
          districtEn: DISTRICT_EN,
        })),
        this.state.lang,
      ),
    );
  }
  // Android app: the system "save as" sheet offers phone memory and Google
  // Drive. Ordinary browsers: a normal download.
  // saveDownload() never enters run(): file() already holds the busy guard,
  // and a nested run() silently returns (test report A02, 30 Sep 2026).
  async saveDownload(name, data, type) {
    if (androidBridge()) {
      await saveFile(name, type || "application/octet-stream", data);
      this.flash(
        "ફાઇલ સેવ કરો — ફોન કે Google Drive પસંદ કરો.",
        "Choose where to save — phone or Google Drive.",
      );
      return;
    }
    return super.download(name, data, type);
  }
  download(name, data, type) {
    if (androidBridge()) return this.run(() => this.saveDownload(name, data, type));
    return super.download(name, data, type);
  }
  componentDidMount() {
    this._alive = true;
    if (typeof navigator !== "undefined" && navigator.userAgent.includes("MVPMlAndroid"))
      document.documentElement.classList.add("native-host");
    try {
      const p = JSON.parse(localStorage.getItem("mvpmi-preferences") || "{}");
      this.setState({
        lang: p.lang === "en" ? "en" : "gu",
        theme: p.theme === "dark" ? "dark" : "light",
        fsPct: normalizeTextSize(p.fsPct),
        effects: p.effects !== false,
      });
    } catch {}
    this._materialQueries = [
      "(prefers-reduced-transparency: reduce)",
      "(forced-colors: active)",
      "(prefers-reduced-motion: reduce)",
    ].map((q) => matchMedia(q));
    this._materialChanged = () => this.forceUpdate();
    for (const q of this._materialQueries) {
      if (q.addEventListener)
        q.addEventListener("change", this._materialChanged);
      else q.addListener(this._materialChanged);
    }
    this._onKey = (e) => {
      // The topmost (last) dialog is the active one.
    const dialog = [...document.querySelectorAll('.app [role="dialog"]')].pop() || null;
      if (e.key === "Escape") {
        // Escape behaves like the phone's Back button everywhere.
        if (this.handleBack()) e.preventDefault();
        return;
      }
      if (!dialog) return;
      if (e.key === "Tab") {
        const items = [
          ...dialog.querySelectorAll(
            'button,input,select,textarea,a[href],[tabindex="0"]',
          ),
        ].filter((el) => !el.disabled && el.getClientRects().length);
        const first = items[0],
          last = items[items.length - 1];
        if (!first) {
          e.preventDefault();
          dialog.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first ||
            !dialog.contains(document.activeElement))
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !dialog.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", this._onKey);
    // Liquid Glass presentation layer (tab lens, finger-following sheen).
    this._lqCleanup = liquidInstall(document.querySelector(".app"));
    // Returning from Google's consent page (Drive backup connection).
    try {
      const drive = new URLSearchParams(location.search).get("drive");
      if (drive) {
        history.replaceState(null, "", location.pathname);
        if (drive === "connected")
          this.flash("Google Drive જોડાયું. પહેલું બેકઅપ શરૂ થયું.", "Google Drive connected. The first backup has started.");
        else this.flash("Google Drive જોડાઈ શક્યું નહીં. ફરી પ્રયાસ કરો.", "Google Drive could not be connected. Please try again.");
      }
    } catch {}
    // The Android app asks the page first when the phone's Back is pressed.
    window.mvpmiBack = () => this.handleBack();
    window.mvpmiNav = { go: (target) => this.navGo(target) };
    // Fingerprint results from the Android app (see MainActivity.Bridge).
    window.mvpmiBiometricResult = (kind, key) => this._biometricResult(kind, key);
    // Old on-device lock records from earlier versions are removed.
    clearAppLock();
    // Section 5: the lock closes when the app comes back after 1 minute or
    // more in the background (the server applies the same rule on its own).
    this._onVisibility = () => {
      if (document.hidden) {
        this._hiddenAt = Date.now();
        if (this._lockable()) this._lockSignal("lock/hidden");
      } else if (this._hiddenAt && Date.now() - this._hiddenAt >= 60000) {
        this._hiddenAt = 0;
        this._engageLock();
      } else {
        this._hiddenAt = 0;
        if (this._lockable()) this._lockSignal("lock/visible");
      }
    };
    document.addEventListener("visibilitychange", this._onVisibility);
    this._lastActivity = Date.now();
    this._activity = () => {
      this._lastActivity = Date.now();
    };
    for (const type of ["pointerdown", "keydown", "touchstart", "wheel"])
      document.addEventListener(type, this._activity, {
        passive: true,
        capture: true,
      });
    // Section 1: the service worker keeps the app itself available offline
    // (inside the Android app too); Web Push is only used by browsers.
    try {
      if (window.isSecureContext && "serviceWorker" in navigator)
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    } catch {}
    // Back online: load the directory again without restarting the app.
    this._onOnline = () => this.refresh();
    window.addEventListener("online", this._onOnline);
    // Every app start begins locked when the lock is on (server-enforced).
    this.api("lock/engage", {})
      .catch(() => {})
      .finally(() => this.refresh(true).then(() => this._afterState()));
    this._poll = setInterval(() => {
      if (!document.hidden && !this._busy)
        this.refresh().then(() => this._afterState());
    }, 8000);
  }
  componentWillUnmount() {
    for (const q of this._materialQueries || []) {
      if (q.removeEventListener)
        q.removeEventListener("change", this._materialChanged);
      else q.removeListener(this._materialChanged);
    }
    document.removeEventListener("keydown", this._onKey);
    document.removeEventListener("visibilitychange", this._onVisibility);
    window.removeEventListener("online", this._onOnline);
    for (const type of ["pointerdown", "keydown", "touchstart", "wheel"])
      document.removeEventListener(type, this._activity, { capture: true });
    delete window.mvpmiBack;
    delete window.mvpmiNav;
    delete window.mvpmiBiometricResult;
    this._lqCleanup?.();
    this._alive = false;
    clearInterval(this._poll);
    clearTimeout(this._t);
  }
  // Fire-and-forget lock signal that survives the page being backgrounded.
  _lockSignal(path) {
    try {
      const headers = { "Content-Type": "application/json", "X-MVPMI-Client": "1" };
      if (this._transport) headers["X-MVPMI-Session"] = this._transport;
      const send = (keepalive) =>
        fetch("/api/" + path, { method: "POST", credentials: "same-origin", keepalive, headers, body: "{}" });
      // WebView older than 81 refuses keepalive with these headers; the
      // Android app keeps the page alive in the background, so a normal
      // request arrives too (API 29 emulator, 30 Sep 2026).
      send(true).catch(() => send(false).catch(() => {}));
    } catch {}
  }
  // An open (unlocked) login whose app lock is on.
  _lockable() {
    const s = this.state;
    return !!s.loaded && !!s.account && !!s.account.lockOn && !s.locked && !s.account.mustSetPin;
  }
  // Every overlay closes with the lock, so nothing (a contact sheet, a
  // dialog, a panel) stays usable or readable underneath the lock screen.
  _overlaysClosed() {
    return {
      confirm: null,
      picker: null,
      dial: null,
      alphaDialog: null,
      contact: null,
      workflowOpen: false,
      allAdminsOpen: false,
      searchOpen: false,
      createdAdmin: null,
      topError: null,
    };
  }
  _engageLock() {
    if (!this._lockable()) return;
    this._lockEngagedAt = Date.now();
    this._resumeScreen = this.state.screen;
    this.setState({
      ...this._overlaysClosed(),
      locked: true,
      members: [],
      screen: "lock",
    });
    this.api("lock/engage", {})
      .then(() => this.refresh())
      .catch(() => {});
  }
  // ---- Section 7: the phone's Back button ------------------------------
  // Returns true when the app handled it; false lets Android close the app.
  // There is no history stack to fall back through, so Back can never return
  // to an admin screen after logout or to the Login screen after logging in.
  handleBack() {
    const s = this.state;
    if (this._busy) return true;
    if (s.alphaDialog) {
      this.setState({ alphaDialog: null });
      return true;
    }
    if (s.createdAdmin) {
      this.setState({ createdAdmin: null });
      return true;
    }
    if (s.topError) {
      this.setState({ topError: null });
      return true;
    }
    if (s.webSplash) {
      this.setState({ webSplash: false });
      return true;
    }
    if (s.contact) {
      this.setState({ contact: null });
      return true;
    }
    if (s.confirm || s.picker || s.dial) {
      this.setState({ confirm: null, picker: null, dial: null });
      return true;
    }
    if (s.allAdminsOpen) {
      this.set("allAdminsOpen", false);
      return true;
    }
    if (s.workflowOpen) {
      this.setState({ workflowOpen: false, screen: s.role === "admin" ? s.screen : "directory" });
      return true;
    }
    switch (s.screen) {
      case "register":
        this.setState({ screen: s.myRequest ? "pending" : "login" });
        return true;
      case "directory":
        if (s.query) {
          this.setState({ query: "" });
          return true;
        }
        if (s.dirVillage) {
          this.set("dirVillage", "");
          return true;
        }
        return false;
      case "settings":
        this.set("screen", s.settingsFrom === "profile" ? "profile" : "directory");
        return true;
      case "profile":
        this.set("screen", s.profileFrom === "admin" && s.role === "admin" ? "admin" : s.profileFrom === "settings" ? "settings" : "directory");
        return true;
      case "edit":
      case "adminedit":
        this.leaveEdit();
        return true;
      case "admin":
        if (s.tab !== "home") {
          if (s.tab === "stats" && s.statsVillage) this.setState({ statsVillage: null });
          else this.set("tab", "home");
        } else this.set("screen", "directory");
        return true;
      default:
        // login, pending, set PIN and lock: Back leaves the app.
        return false;
    }
  }
  // Leaving a form: asks "Discard changes?" when something was typed.
  leaveEdit() {
    const s = this.state;
    const back = () =>
      this.setState(
        s.screen === "adminedit"
          ? { screen: "admin", tab: "stats", adminEditingId: null, editDirty: false, alphaDialog: null }
          : { screen: "profile", editDirty: false, alphaDialog: null },
      );
    if (!s.editDirty) return back();
    this.setState({ alphaDialog: { type: "discard", onDiscard: back } });
  }
  // ---- Bottom navigation (owner, 2 Oct 2026) ---------------------------
  // Five tabs, Search in the middle. In the Android app the bar is native
  // (Jetpack Compose) and drives the page through window.mvpmiNav; in a
  // browser the page draws the same bar itself (ABottomNav).
  _barState() {
    const s = this.state;
    const role = s.account?.role;
    const isAdmin = !s.offline && (role === "MAIN_ADMIN" || role === "VILLAGE_ADMIN");
    const overlay = !!(s.alphaDialog || s.webSplash || s.contact || s.confirm || s.workflowOpen || s.allAdminsOpen || s.createdAdmin || s.picker || s.dial);
    const visible = !!(s.loaded && s.account && !s.locked && ["directory", "profile", "settings", "admin"].includes(s.screen) && !overlay);
    const active = s.screen === "directory" ? "search" : s.screen;
    return { visible, active, isAdmin, adminBadge: isAdmin ? this.pendingAdminCount() || 0 : 0, dark: s.theme === "dark", lang: s.lang };
  }
  navGo(target) {
    const s = this.state;
    // The splash screen's "Main Admin / Village Admin" contacts: the admins
    // list works before login too (Contact admin on the Login screen).
    if (target === "admins") {
      if (!s.locked) this.setState({ allAdminsOpen: true });
      return;
    }
    if (!s.account || s.locked) return;
    const dark = s.theme === "dark";
    switch (target) {
      case "search":
        if (s.screen !== "directory") this.setState({ screen: "directory" });
        setTimeout(() => window.mvpmiFocusSearch?.(), 60);
        break;
      case "profile":
        this.setState({ screen: "profile", profileFrom: "directory" });
        break;
      case "settings":
        this.setState({ screen: "settings", settingsFrom: "directory" });
        break;
      case "admin":
        this.openAdmin();
        break;
      case "theme":
        this.set("theme", dark ? "light" : "dark");
        break;
      case "lang":
        this.set("lang", s.lang === "gu" ? "en" : "gu");
        break;
    }
  }
  // Tells the Android app what to show in its native bar and splash screen
  // (only counts and names; never phone numbers).
  _syncNav() {
    const bar = this._barState();
    const bridge = androidBridge();
    const native = !!(bridge && typeof bridge.navState === "function");
    const root = document.documentElement;
    root.classList.toggle("native-nav", native);
    root.classList.toggle("has-bottomnav", bar.visible);
    if (!native) return;
    const s = this.state;
    const v = VILLAGE_LIST.find((x) => x.gu === s.account?.village || x.en === s.account?.village);
    const members = s.members || [];
    const json = JSON.stringify({
      ...bar,
      screen: s.screen,
      loggedIn: !!s.account,
      villageGu: v ? v.gu : "",
      villageEn: v ? v.en : "",
      villageMembers: v ? members.filter((m) => m.village === v.gu).length : 0,
      totalMembers: members.length,
    });
    if (json === this._navJson) return;
    this._navJson = json;
    try {
      bridge.navState(json);
    } catch {}
  }
  componentDidUpdate() {
    this._syncNav();
    document.documentElement.lang = this.state.lang;
    document.title =
      t("app.community", this.state.lang) + " · " + t("app.title", this.state.lang);
    // The topmost (last) dialog is the active one.
    const dialog = [...document.querySelectorAll('.app [role="dialog"]')].pop() || null;
    // Restore background semantics before applying the current modal boundary.
    for (const [element, inert, hidden] of this._modalBackground || []) {
      element.inert = inert;
      if (hidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", hidden);
    }
    this._modalBackground = [];
    if (dialog && dialog !== this._dialog) {
      if (!this._dialog) this._returnFocus = document.activeElement;
      this._dialog = dialog;
      if (!dialog.contains(document.activeElement))
        (dialog.querySelector("input,button") || dialog).focus();
    } else if (!dialog && this._dialog) {
      this._dialog = null;
      if (this._returnFocus?.isConnected) this._returnFocus.focus();
    }
    if (dialog) {
      const root = document.querySelector(".app");
      for (
        let node = dialog;
        node && node !== root;
        node = node.parentElement
      ) {
        for (const sibling of node.parentElement?.children || []) {
          if (sibling === node) continue;
          this._modalBackground.push([
            sibling,
            !!sibling.inert,
            sibling.getAttribute("aria-hidden"),
          ]);
          sibling.inert = true;
          sibling.setAttribute("aria-hidden", "true");
        }
      }
    }
    // A new screen starts at the top.
    if (this._lastScreen !== this.state.screen) {
      this._lastScreen = this.state.screen;
      for (const el of document.querySelectorAll(".app .alpha-scroll, .app .alpha-list, .app .alpha-auth"))
        el.scrollTop = 0;
    }
    try {
      const preferences = JSON.stringify({
        lang: this.state.lang,
        theme: this.state.theme,
        fsPct: this.state.fsPct,
        effects: this.state.effects !== false,
      });
      if (preferences !== this._lastPreferences) {
        localStorage.setItem("mvpmi-preferences", preferences);
        this._lastPreferences = preferences;
      }
    } catch {}
  }
  async ensureTransport() {
    if (this._transportPromise) return this._transportPromise;
    this._transportPromise = (async () => {
      try {
        const saved = JSON.parse(
          sessionStorage.getItem("mvpmi-preview-session") || "null",
        );
        if (
          saved &&
          saved.expiresAt > Date.now() &&
          /^[a-f0-9]{64}$/.test(saved.token)
        ) {
          this._transport = saved.token;
          return;
        }
      } catch {}
      const response = await fetch("/api/session/transport", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-MVPMI-Client": "1" },
        body: "{}",
        signal: timeoutSignal(15000),
      });
      const data = await response.json();
      if (!response.ok)
        throw Object.assign(new Error(data.error || "Unable to connect"), {
          status: response.status,
        });
      if (data.enabled) {
        this._transport = data.token;
        try {
          sessionStorage.setItem(
            "mvpmi-preview-session",
            JSON.stringify({ token: data.token, expiresAt: data.expiresAt }),
          );
        } catch {}
      }
    })().catch((e) => {
      this._transportPromise = null;
      throw e;
    });
    return this._transportPromise;
  }
  async request(path, body, reconnect = true) {
    await this.ensureTransport();
    const headers = { "X-MVPMI-Client": "1" };
    if (this._transport) headers["X-MVPMI-Session"] = this._transport;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch("/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeoutSignal(15000),
    });
    if (response.status === 401 && this._transport) {
      const error = await response.clone().json();
      if (/Preview session expired/.test(error.error)) {
        // A recovery on another device revokes this transport. Invalidate the
        // in-memory promise as well as storage; otherwise every retry reuses it.
        if (this._transport === headers["X-MVPMI-Session"]) {
          this._transport = null;
          this._transportPromise = null;
          try {
            sessionStorage.removeItem("mvpmi-preview-session");
          } catch {}
          this.clearAccess();
        }
        // Only a read may reconnect once. Never replay a mutation, and never
        // retry a blocked-device 403 or restore a revoked member/admin role.
        if (reconnect && path === "state" && body === undefined)
          return this.request(path, undefined, false);
      }
    }
    return response;
  }
  async api(path, body) {
    let response, value;
    try {
      response = await this.request(path, body);
      value = await response.json();
    } catch (e) {
      // No internet, server unreachable or a non-JSON proxy page.
      throw Object.assign(new Error(e?.message || "Network error"), {
        network: true,
        status: 0,
      });
    }
    if (!response.ok)
      throw Object.assign(new Error(value.error || "Request failed"), {
        status: response.status,
        code: value.code,
        until: value.until,
        field: value.field,
        left: value.left,
      });
    return value;
  }
  // ---- Which screen belongs to this server state --------------------------
  home(data = this.state) {
    const a = data.account;
    if (a) {
      if (a.mustSetPin) return "setpin";
      if (data.locked) return "lock";
      return "directory";
    }
    if (data.myRequest || data.approvedHere) return "pending";
    if (data.lastDecision?.action === "reject" && !this._seenDecision) return "pending";
    return "login";
  }
  // Screens a given state may show (Section 7: the directory is NEVER
  // visible without an approved login).
  allowedScreen(screen, data) {
    const a = data.account;
    if (!a) {
      if (screen === "pending") return !!(data.myRequest || data.approvedHere || data.lastDecision);
      return screen === "login" || screen === "register";
    }
    if (a.mustSetPin) return screen === "setpin";
    if (data.locked) return screen === "lock";
    if (screen === "admin" || screen === "adminedit") return data.role === "admin";
    return ["directory", "settings", "profile", "edit"].includes(screen);
  }
  apply(data, initial = false, screen) {
    if (!this._alive) return;
    if (data.villages) {
      VILLAGE_LIST.splice(
        0,
        VILLAGE_LIST.length,
        ...data.villages.map((v) => ({ gu: v.gu, en: v.en })),
      );
      VILLAGES.splice(
        0,
        VILLAGES.length,
        ...data.villages.map((v) => [v.en, v.gu, TEHSIL_EN, TEHSIL_GU]),
      );
    }
    const current = this.state;
    const { created, ...rest } = data;
    const patch = {
      ...rest,
      connected: true,
      loaded: true,
      offline: false,
      lastConfirmed: Date.now(),
    };
    // A newly created Village Admin: hand-over dialog (call / WhatsApp).
    if (created) patch.createdAdmin = created;
    const accountChanged = (current.account?.id || null) !== (data.account?.id || null);
    const roleChanged =
      current.loaded &&
      (current.role !== data.role || current.account?.role !== data.account?.role);
    const wasLocked = current.screen === "lock";
    const target = screen || current.screen;
    if (initial || screen || accountChanged || !this.allowedScreen(target, data)) {
      let next = screen && this.allowedScreen(screen, data) ? screen : this.home(data);
      // Back from the lock screen to where the person was.
      if (wasLocked && next === "directory" && this._resumeScreen && this.allowedScreen(this._resumeScreen, data))
        next = this._resumeScreen;
      patch.screen = next;
    }
    if (accountChanged || roleChanged) {
      // Login, logout and role changes clear everything that was open.
      Object.assign(patch, this._overlaysClosed(), { adminEditingId: null, editDirty: false, tab: "home", statsVillage: null });
      if (!data.account) Object.assign(patch, { query: "", dirVillage: "" });
    }
    if (!data.villageAdmin && data.role !== "admin" && current.workflowOpen) patch.workflowOpen = false;
    if (data.locked) {
      // Close everything when the lock ENGAGES. Dialogs opened on the lock
      // screen itself ("Forgot PIN?" → sign out) must survive the periodic
      // refresh; they used to vanish after a few seconds (CI, 30 Sep 2026).
      if (!wasLocked) {
        this._resumeScreen = current.screen;
        Object.assign(patch, this._overlaysClosed());
      }
      patch.screen = "lock";
    }
    this.setState(patch);
    this.syncScreenPrivacy(!!data.account?.lockOn);
    // Approved on this phone: log in by itself, nothing to type.
    if (data.approvedHere && !data.account && !this._autoLogin) {
      this._autoLogin = true;
      this.api("login/approved", {})
        .then((d) => this.onLoggedIn(d))
        .catch(() => {})
        .finally(() => {
          this._autoLogin = false;
        });
    }
    this.persistOffline(data);
    // One-time notices for the member (approved, change approved …).
    if (data.account?.notice && this._noticeShown !== data.account.notice.at) {
      this._noticeShown = data.account.notice.at;
      if (data.account.notice.kind === "approved") this.flashKey("pending.approved");
    }
  }
  // Android: screenshots and the recent-apps preview are blocked only while the
  // person's optional PIN lock is on; otherwise the app is visible as usual.
  syncScreenPrivacy(on) {
    if (this._screenPrivacy === on) return;
    this._screenPrivacy = on;
    try {
      androidBridge()?.setScreenPrivacy?.(on);
    } catch {}
  }
  // Keep the offline copy in step with what the server just said.
  persistOffline(data) {
    try {
      if (!data.account) {
        // Not logged in (signed out, removed or never approved): nothing of
        // the directory may stay on this phone.
        clearOffline();
        return;
      }
      if (data.account.mustSetPin) return;
      updateOfflineAccount({ lockOn: !!data.account.lockOn, role: data.account.role });
      if (data.locked || !data.members?.length) return;
      saveOffline({
        account: {
          id: data.account.id,
          role: data.account.role,
          name: data.account.name,
          nameGu: data.account.nameGu,
          phone: data.account.phone,
          village: data.account.village,
          lockOn: !!data.account.lockOn,
        },
        members: data.members,
        villages: data.villages,
      });
    } catch {}
  }
  clearAccess() {
    if (!this._alive) return;
    clearOffline();
    this.syncScreenPrivacy(false);
    this.setState({
      ...clone(SEED),
      ...this._overlaysClosed(),
      meId: null,
      myRequest: null,
      account: null,
      role: "guest",
      villageAdmin: false,
      reviewQueue: [],
      villageAssignments: [],
      rejectedApplications: [],
      locked: false,
      createdAdmin: null,
      topError: null,
      screen: "login",
      query: "",
      dirVillage: "",
      edit: null,
      adminEditingId: null,
      editDirty: false,
      lastConfirmed: null,
      connected: true,
      loaded: true,
    });
  }
  // System notifications are produced by the server (see server/notify.mjs).
  // Inside the Android app the page hands the native side a device token so
  // a background job can deliver them even when the app is closed; in a
  // browser, Web Push does the same once the person turns notifications on.
  _afterState() {
    const s = this.state;
    if (!this._alive || !s.loaded || s.connected === false) return;
    if (androidSupportsDevice()) {
      // Only after signing in or applying (never on the Login screen at first
      // launch: Android would ask for notification permission over it —
      // found by the API 36 emulator test, 30 Sep 2026).
      const known = !!s.account || !!s.myRequest || !!s.approvedHere;
      if (known && this._deviceLang !== s.lang && !this._deviceBusy) {
        this._deviceBusy = true;
        this.api("notifications/device", { lang: s.lang })
          .then((r) => {
            if (androidRegisterDevice(r.token)) this._deviceLang = s.lang;
          })
          .catch(() => {})
          .finally(() => {
            this._deviceBusy = false;
          });
      }
      if (
        s.latestNotificationAt &&
        s.latestNotificationAt !== this._lastNotifyAt
      ) {
        if (this._lastNotifyAt !== undefined) androidPullNow();
        this._lastNotifyAt = s.latestNotificationAt;
      }
    } else if (
      !this._pushSynced &&
      pushSupported() &&
      Notification.permission === "granted"
    ) {
      // Keep this browser's subscription linked to the current sign-in.
      this._pushSynced = true;
      enableWebPush((path, body) => this.api(path, body), s.lang).catch(() => {});
    }
  }
  // Offered right after an action that will later produce a notification
  // (sending an application, logging in as an administrator).
  offerNotifications() {
    if (androidBridge() || !pushSupported() || Notification.permission !== "default")
      return;
    this.confirmAction(
      "ફોનમાં સૂચના મેળવશો?",
      "Get phone notifications?",
      "We will tell you when something needs you or your request moves ahead — for example when you are approved. Notifications never contain phone numbers.",
      () =>
        this.run(async () => {
          this.setState({ confirm: null });
          await enableWebPush((path, body) => this.api(path, body), this.state.lang);
          this._pushSynced = true;
          this.flash("સૂચનાઓ ચાલુ થઈ.", "Notifications are on.");
        }),
      "કંઈક તમારી રાહ જોતું હોય અથવા તમારી વિનંતી આગળ વધે ત્યારે — જેમ કે મંજૂરી મળે ત્યારે — અમે જણાવીશું. સૂચનામાં ફોન નંબર ક્યારેય હોતા નથી.",
      "હા, ચાલુ કરો",
      "Yes, turn on",
    );
  }
  async refresh(initial = false) {
    const started = Date.now();
    try {
      const data = await this.api("state");
      // A poll that left before the lock engaged must not re-open the list.
      if (this._lockEngagedAt > started && !data.locked) return;
      this.apply(data, initial);
    } catch (e) {
      if (this._alive) {
        if (e.status === 403 || e.status === 401) {
          this.clearAccess();
          this.flash(errorText(e.message, "gu"), errorText(e.message, "en"));
        } else if (!this.state.lastConfirmed && this.applyOffline()) {
          // Cold start without internet: show the saved directory copy.
        } else this.setState({ connected: false, loaded: true, offline: !!this.state.account });
      }
    }
  }
  // Section 1: open the saved copy of the directory (read-only) when the
  // server cannot be reached and this phone has a logged-in account.
  applyOffline() {
    const saved = loadOffline();
    if (!saved || !this._alive) return false;
    if (saved.villages?.length)
      VILLAGE_LIST.splice(0, VILLAGE_LIST.length, ...saved.villages);
    const locked = !!saved.account.lockOn;
    this.setState({
      ...this._overlaysClosed(),
      members: locked ? [] : saved.members,
      offlineMembers: saved.members,
      meId: saved.account.id,
      role: "member",
      villageAdmin: false,
      account: { ...saved.account, adminMode: false, mustSetPin: false, lockForced: false },
      offline: true,
      connected: false,
      loaded: true,
      lastConfirmed: saved.at,
      locked,
      screen: locked ? "lock" : "directory",
    });
    return true;
  }
  async run(fn) {
    if (this._busy) return;
    this._busy = true;
    this.setState({ busy: true, ...(this.state.topError ? { topError: null } : {}) });
    try {
      await fn();
    } catch (e) {
      this.showError(e);
      if (/authentication|approval|blocked/i.test(e.message) || e.code === "SESSION" || e.code === "LOCKED")
        await this.refresh();
    } finally {
      this._busy = false;
      if (this._alive) this.setState({ busy: false });
    }
  }
  // A persistent error at the very top of the screen (see AErrorBanner): it
  // says what went wrong and stays until dismissed.
  showError(e, action) {
    if (!this._alive) return;
    this.setState({ topError: { error: e, action: action ? String(action).replace(/^\/?(api\/)?/, "") : "" } });
  }
  showNotice(title, message) {
    this.setState({ topError: { title, message, error: {} } });
  }
  mutate(path, body = {}, screen) {
    return this.run(async () => {
      this.apply(await this.api(path, body), false, screen);
      this.setState({ confirm: null, submitted: false });
      this.flash("કાર્ય પૂર્ણ થયું.", "Saved successfully.");
    });
  }
  flashKey(key, vars) {
    this.flash(t(key, "gu", vars), t(key, "en", vars));
  }
  confirmAction(
    gu,
    en,
    body,
    onYes,
    bodyGu = gu,
    yesGu = "આગળ વધો",
    yesEn = "Continue",
  ) {
    this.setState({
      confirm: {
        icon: "ph-duotone ph-shield-check",
        iconBg: "var(--okBg)",
        iconFg: "var(--ok)",
        yesBg: "var(--grad)",
        titleGu: gu,
        titleEn: en,
        bodyGu,
        bodyEn: body,
        yesGu,
        yesEn,
        onYes,
      },
    });
  }
  async file(path, name, share = false) {
    return this.run(async () => {
      const response = await this.request("admin/" + path);
      if (!response.ok) {
        const b = await response.json();
        throw new Error(b.error);
      }
      const blob = await response.blob();
      if (share) {
        const file = new File([blob], name, { type: blob.type });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "MVPMl community directory",
          });
          return;
        }
        this.flash(
          "ફાઇલ ડાઉનલોડ કરો, પછી શેર કરો.",
          "File sharing is unavailable in this browser. Download and attach the file in WhatsApp.",
        );
      }
      await this.saveDownload(name, blob, blob.type);
      await this.refresh();
    });
  }
  restore() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () =>
      this.run(async () => {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024)
          throw new Error("Backup exceeds 10 MB");
        const backup = JSON.parse(await file.text());
        const diff = await this.api("admin/restore/validate", backup);
        this.confirmAction(
          "બેકઅપ પાછો લાવવો?",
          "Restore this backup?",
          `Replace ${diff.currentMembers} current members with ${diff.members} members, ${diff.requests} requests and ${diff.archive} archived records. Existing data will be replaced.`,
          () =>
            this.mutate("admin/restore", {
              backup,
              digest: diff.digest,
              currentDigest: diff.currentDigest,
            }),
          `${diff.currentMembers} વર્તમાન સભ્યોની જગ્યાએ ${diff.members} સભ્યો, ${diff.requests} વિનંતીઓ અને ${diff.archive} આર્કાઇવ નોંધો મૂકવામાં આવશે. વર્તમાન માહિતી બદલાઈ જશે.`,
          "માહિતી બદલીને પુનઃસ્થાપિત કરો",
          "Replace directory data",
        );
      });
    input.click();
  }
  // ---- Alpha screens: actions ---------------------------------------------
  alphaApi() {
    return (path, body) => this.api(path, body);
  }
  // Login succeeded (Section 2): land on the Member Directory (or "Set new
  // PIN" after a TEMP PIN) with a clean slate.
  onLoggedIn(data, secret) {
    this._resumeScreen = null;
    this.apply(data, false, this.home(data));
    if (data.account && !data.account.mustSetPin) {
      if (data.account.lockOn && secret) rememberOfflineUnlock(data.account.id, secret);
      if (data.account.adminMode) this.offerNotifications();
    }
    this._afterState();
  }
  async unlock(secret) {
    const s = this.state;
    if (s.offline) {
      // Section 1 + 5: offline, the lock opens with the verifier saved on
      // this phone at the last online login/unlock (5 wrong → 5 minutes).
      const now = Date.now();
      if (this._offlineUntil > now)
        throw Object.assign(new Error("locked"), { code: "LOCKED_OUT", until: this._offlineUntil });
      if (!loadOffline()?.unlock) throw Object.assign(new Error("offline"), { network: true });
      if (!verifyOfflineUnlock(secret)) {
        this._offlineFails = (this._offlineFails || 0) + 1;
        if (this._offlineFails >= 5) {
          this._offlineFails = 0;
          this._offlineUntil = now + 5 * 60000;
          throw Object.assign(new Error("locked"), { code: "LOCKED_OUT", until: this._offlineUntil });
        }
        throw Object.assign(new Error("wrong"), {
          code: "WRONG_PIN",
          left: 5 - this._offlineFails,
        });
      }
      this._offlineFails = 0;
      this.setState({ locked: false, members: s.offlineMembers || [], screen: this._resumeScreen && this._resumeScreen !== "lock" ? this._resumeScreen : "directory" });
      return;
    }
    await this.api("lock/unlock", { secret });
    rememberOfflineUnlock(s.account?.id, secret);
    this._lockEngagedAt = 0;
    await this.refresh();
  }
  // Fingerprint (Section 5): the Android app shows the phone's own biometric
  // prompt and hands back a random device key it keeps for this app.
  biometricAvailable() {
    try {
      return !!androidBridge()?.biometricAvailable?.();
    } catch {
      return false;
    }
  }
  _biometricResult(kind, key) {
    const pending = this._biometricPending;
    this._biometricPending = null;
    if (!pending) return;
    if (!key || !/^[a-f0-9]{64}$/.test(key)) {
      if (kind !== "cancel") this.flashKey("err.BIOMETRIC_FAILED");
      return;
    }
    pending(key);
  }
  biometricPrompt(mode) {
    return new Promise((resolve) => {
      this._biometricPending = resolve;
      try {
        const bridge = androidBridge();
        if (mode === "enroll") bridge.biometricEnroll(t("lock.fingerprint", this.state.lang), t("common.cancel", this.state.lang));
        else bridge.biometricUnlock(t("lock.fingerprint", this.state.lang), t("common.cancel", this.state.lang));
      } catch {
        this._biometricPending = null;
        this.flashKey("err.BIOMETRIC_FAILED");
      }
    });
  }
  unlockWithFingerprint() {
    this.biometricPrompt("unlock").then((key) =>
      this.run(async () => {
        await this.api("lock/unlock", { biometric: key });
        this._lockEngagedAt = 0;
        await this.refresh();
      }),
    );
  }
  toggleBiometric() {
    const on = !!this.state.account?.biometricOn;
    if (on) {
      this.run(async () => {
        await this.api("lock/biometric", { on: false });
        try {
          androidBridge()?.biometricForget?.();
        } catch {}
        await this.refresh();
        this.flashKey("lock.fingerprintOff");
      });
      return;
    }
    this.biometricPrompt("enroll").then((key) =>
      this.run(async () => {
        await this.api("lock/biometric", { key });
        await this.refresh();
        this.flashKey("lock.fingerprintOn");
      }),
    );
  }
  // My Profile → "Lock this app with a PIN". Turning it on asks for a 4-digit
  // PIN; turning it off needs nothing. Nothing else ever locks the app.
  toggleLock() {
    const a = this.state.account;
    if (!a) return;
    if (a.lockOn) {
      this.run(async () => {
        await this.api("lock/preference", { on: false });
        forgetOfflineUnlock();
        try {
          androidBridge()?.biometricForget?.();
        } catch {}
        await this.refresh();
        this.flashKey("lock.offDone");
      });
      return;
    }
    this.setState({ alphaDialog: { type: "lockPin", changing: false } });
  }
  signOutOfPhone() {
    this.setState({
      alphaDialog: {
        type: "confirm",
        title: t("settings.signout", this.state.lang),
        body: t("settings.signoutConfirm", this.state.lang),
        yes: t("settings.signout", this.state.lang),
        danger: true,
        onYes: () =>
          this.run(async () => {
            try {
              await this.api("logout", {});
            } catch (e) {
              if (!e.network) throw e;
            }
            try {
              androidBridge()?.biometricForget?.();
            } catch {}
            // The old session no longer exists: start a fresh one.
            this._transport = null;
            this._transportPromise = null;
            try {
              sessionStorage.removeItem("mvpmi-preview-session");
            } catch {}
            this._resumeScreen = null;
            this.clearAccess();
          }),
      },
    });
  }
  // Section 7: "Log out" in the admin tools ends ONLY the admin session.
  adminLogout() {
    this.run(async () => {
      const data = await this.api("admin/logout", {});
      this.setState({ workflowOpen: false });
      this.apply(data, false, "directory");
      this.flashKey("nav.adminLoggedOut");
    });
  }
  openAdmin() {
    const s = this.state;
    if (!s.account) return;
    if (!s.account.adminMode) {
      if (s.account.role === "MAIN_ADMIN") {
        this.setState({ alphaDialog: { type: "adminEnter" } });
        return;
      }
      // A Village Admin logs in with the mobile number only: open directly.
      this.run(async () => {
        const data = await this.api("admin/enter", {});
        this.apply(data);
        this._showAdminTools(data);
      });
      return;
    }
    // Always open the admin tools with the latest queue from the server.
    this.run(async () => {
      const data = await this.api("state");
      this.apply(data);
      this._showAdminTools(data);
    });
  }
  _showAdminTools(data) {
    if (data.account?.role === "MAIN_ADMIN") this.setState({ screen: "admin", tab: "home", statsVillage: null });
    else this.setState({ workflowOpen: true, workflowTab: "requests" });
  }
  pendingAdminCount(s = this.state) {
    if (s.role === "admin")
      return (s.newRequests || []).length + (s.updateRequests || []).length + (s.deleteRequests || []).length;
    if (s.villageAdmin) return (s.reviewQueue || []).length;
    return 0;
  }
  myMember(s = this.state) {
    return (s.members || []).find((m) => m.id === s.account?.id) || null;
  }
  // ---- Alpha screens: rendering -------------------------------------------
  renderAppScreen() {
    const s = this.state,
      lang = s.lang,
      api = this.alphaApi(),
      h = React.createElement;
    const onLang = (value) => this.set("lang", value);
    const goAdmins = () => this.setState({ allAdminsOpen: true });
    if (!s.loaded) return null;
    switch (s.screen) {
      case "login":
        return h(ALoginScreen, {
          key: "login",
          lang,
          onLang,
          api,
          initialMobile: s.loginMobile || "",
          approvedNotice: !!s.approvedHere,
          offline: s.connected === false,
          onRetry: () => this.refresh(),
          onLoggedIn: (data, secret) => this.onLoggedIn(data, secret),
          onRegister: () => this.setState({ screen: "register", registerEditing: false }),
          onAdmins: goAdmins,
        });
      case "register":
        return h(ARegisterScreen, {
          key: "register" + (s.registerEditing ? "-edit" : ""),
          lang,
          onLang,
          api,
          villages: s.villages || VILLAGE_LIST,
          editing: !!s.registerEditing,
          initial: s.registerEditing && s.myRequest ? s.myRequest : null,
          onBack: () => this.handleBack(),
          onSubmitted: (data) => {
            this.apply(data, false, "pending");
            this.flashKey("pending.sent");
            this.offerNotifications();
          },
          onGoLogin: (mobile) => this.setState({ screen: "login", loginMobile: mobile }),
        });
      case "pending":
        return h(APendingScreen, {
          key: "pending",
          lang,
          onLang,
          data: s,
          offline: s.connected === false,
          onRetry: () => this.refresh(),
          onEdit: () => this.setState({ screen: "register", registerEditing: true }),
          onWithdraw: () =>
            this.setState({
              alphaDialog: {
                type: "confirm",
                title: t("pending.withdraw", lang),
                body: t("pending.withdrawConfirm", lang),
                yes: t("pending.withdraw", lang),
                danger: true,
                onYes: () =>
                  this.run(async () => {
                    const data = await this.api("enrollment/withdraw", {});
                    this.apply(data, false, "login");
                    this.flashKey("pending.withdrawn");
                  }),
              },
            }),
          onGoLogin: () => {
            this._seenDecision = true;
            this.setState({ screen: "login", loginMobile: s.myRequest?.phone || "" });
          },
          onAdmins: goAdmins,
        });
      case "setpin":
        return h(ASetPinScreen, {
          key: "setpin",
          lang,
          onLang,
          api,
          account: s.account,
          onDone: (data) => {
            this.apply(data, false, "directory");
            this.flashKey("setpw.done");
          },
          onSignOut: () => this.signOutOfPhone(),
        });
      case "lock":
        return h(ALockScreen, {
          key: "lock",
          lang,
          onLang,
          account: s.account,
          offline: !!s.offline,
          unlock: (secret) => this.unlock(secret),
          biometricAvailable: !s.offline && !!s.account?.biometricOn && this.biometricAvailable(),
          onBiometric: () => this.unlockWithFingerprint(),
          onForgot: () => this.signOutOfPhone(),
        });
      case "settings":
        return h(ASettingsScreen, {
          key: "settings",
          lang,
          account: s.account,
          offline: !!s.offline,
          fsPct: s.fsPct,
          pendingChange: (s.updateRequests || []).some((u) => u.memberId === s.account.id),
          pendingRemoval: (s.deleteRequests || []).some((u) => u.memberId === s.account.id),
          notificationPanel: s.offline ? null : h(NotificationSettings, { lang, api }),
          version: this.appVersion(),
          onBack: () => this.handleBack(),
          onFs: (value) => {
            this.set("fsPct", normalizeTextSize(value));
            if (normalizeTextSize(value) === 100) this.flashKey("settings.textResetDone");
          },
          onProfile: () => this.setState({ screen: "profile", profileFrom: "settings" }),
          onRequestChange: () => this.openEditRequest(),
          onRequestRemoval: () => this.askRemovalRequest(),
          onAdmins: goAdmins,
          onSignOut: () => this.signOutOfPhone(),
        });
      case "profile":
        return h(AProfileScreen, {
          key: "profile",
          lang,
          account: s.account,
          member: this.myMember(),
          pendingChange: (s.updateRequests || []).some((u) => u.memberId === s.account.id),
          pendingRemoval: (s.deleteRequests || []).some((u) => u.memberId === s.account.id),
          offline: !!s.offline,
          biometricAvailable: this.biometricAvailable(),
          onBack: () => this.handleBack(),
          onChangePassword: () => this.setState({ alphaDialog: { type: "changePassword" } }),
          onToggleLock: () => this.toggleLock(),
          onChangeLockPin: () => this.setState({ alphaDialog: { type: "lockPin", changing: true } }),
          onToggleBiometric: () => this.toggleBiometric(),
          onSettings: () => this.setState({ screen: "settings", settingsFrom: "profile" }),
          onRequestChange: () => this.openEditRequest(),
          onRequestRemoval: () => this.askRemovalRequest(),
          onSignOut: () => this.signOutOfPhone(),
        });
      case "edit":
      case "adminedit": {
        const admin = s.screen === "adminedit";
        const member = admin
          ? (s.members || []).find((m) => m.id === s.adminEditingId)
          : this.myMember();
        if (!member) return null;
        return h(AEditProfileScreen, {
          key: s.screen + member.id,
          lang,
          villages: s.villages || VILLAGE_LIST,
          member,
          adminEdit: admin,
          api,
          onBack: () => this.leaveEdit(),
          onDirtyChange: (dirty) => {
            if (this.state.editDirty !== dirty) this.setState({ editDirty: dirty });
          },
          onSaved: (data) => {
            if (admin) {
              // Back to the member list (same village), refreshed, "Saved".
              this.apply(data, false, "admin");
              this.setState({ tab: "stats", adminEditingId: null, editDirty: false });
              this.flashKey("common.saved");
            } else {
              this.apply(data, false, "profile");
              this.setState({ editDirty: false });
              this.flashKey("edit.sent");
            }
          },
        });
      }
      case "directory":
        return h(ADirectoryScreen, {
          key: "directory",
          lang,
          members: s.members || [],
          villages: s.villages || VILLAGE_LIST,
          meId: s.account?.id,
          query: s.query || "",
          village: s.dirVillage || "",
          onQuery: (value) => this.set("query", value),
          onVillage: (value) => this.set("dirVillage", value),
          onOpenContact: (m) => this.setState({ contact: m }),
          onSun: () => {
            const bridge = androidBridge();
            if (bridge && typeof bridge.openSplash === "function") bridge.openSplash();
            else this.setState({ webSplash: true });
          },
          offline: s.connected === false,
          lastUpdated: s.lastConfirmed,
          onRetry: () => this.refresh(),
        });
      default:
        return null;
    }
  }
  renderAppOverlay() {
    const s = this.state,
      lang = s.lang,
      api = this.alphaApi(),
      h = React.createElement;
    const d = s.alphaDialog;
    const close = () => this.setState({ alphaDialog: null });
    const nodes = [];
    if (s.webSplash) nodes.push(h(AWebSplash, { key: "splash", lang, onEnter: () => this.setState({ webSplash: false }) }));
    if (s.contact)
      nodes.push(
        h(AContactSheet, {
          key: "contact",
          m: s.contact,
          lang,
          members: s.members || [],
          meId: s.account?.id,
          onClose: () => this.setState({ contact: null }),
          onShowVillage: (village) => this.setState({ contact: null, screen: "directory", dirVillage: village, query: "" }),
        }),
      );
    if (d?.type === "changePassword")
      nodes.push(
        h(AChangeSecretDialog, {
          key: "change",
          lang,
          api,
          onClose: close,
          onDone: (message) => {
            close();
            this.flash(message, message);
            this.refresh();
          },
        }),
      );
    if (d?.type === "lockPin")
      nodes.push(
        h(ALockPinDialog, {
          key: "lockPin",
          lang,
          api,
          changing: !!d.changing,
          onClose: close,
          onDone: (data, pin) => {
            close();
            rememberOfflineUnlock(s.account?.id, pin);
            this.flashKey("lock.setDone");
            this.refresh();
          },
        }),
      );
    if (d?.type === "adminEnter")
      nodes.push(
        h(AAdminEnterDialog, {
          key: "adminEnter",
          lang,
          api,
          onClose: close,
          onDone: (data) => {
            close();
            this.apply(data);
            this.openAdmin();
          },
        }),
      );
    if (d?.type === "discard")
      nodes.push(
        h(AConfirm, {
          key: "discard",
          title: t("nav.discardTitle", lang),
          body: t("nav.discardBody", lang),
          yes: t("nav.discard", lang),
          no: t("nav.keepEditing", lang),
          danger: true,
          testId: "Discard changes",
          onYes: () => d.onDiscard(),
          onNo: close,
        }),
      );
    if (d?.type === "confirm")
      nodes.push(
        h(AConfirm, {
          key: "confirm",
          title: d.title,
          body: d.body,
          yes: d.yes,
          no: t("common.cancel", lang),
          danger: d.danger,
          onYes: () => {
            close();
            d.onYes();
          },
          onNo: close,
        }),
      );
    if (s.createdAdmin)
      nodes.push(h(AVillageAdminCreatedDialog, { key: "created", issued: s.createdAdmin, lang, onClose: () => this.setState({ createdAdmin: null }) }));
    const bar = this._barState();
    if (bar.visible && !(androidBridge() && typeof androidBridge().navState === "function"))
      nodes.push(
        h(ABottomNav, {
          key: "bottomnav",
          lang,
          active: bar.active,
          isAdmin: bar.isAdmin,
          adminBadge: bar.adminBadge,
          dark: bar.dark,
          onProfile: () => this.navGo("profile"),
          onAdmin: () => this.navGo("admin"),
          onSettings: () => this.navGo("settings"),
          onSearch: () => this.navGo("search"),
          onTheme: () => this.navGo("theme"),
          onLang: () => this.navGo("lang"),
        }),
      );
    if (s.topError)
      nodes.push(h(AErrorBanner, { key: "topError", error: s.topError, lang, onClose: () => this.setState({ topError: null }) }));
    return nodes.length ? h(React.Fragment, null, ...nodes) : null;
  }
  openEditRequest() {
    if (this.state.offline) return this.flashKey("offline.readOnly");
    this.setState({ screen: "edit", editDirty: false });
  }
  askRemovalRequest() {
    if (this.state.offline) return this.flashKey("offline.readOnly");
    const lang = this.state.lang;
    this.setState({
      alphaDialog: {
        type: "confirm",
        title: t("removal.confirmTitle", lang),
        body: t("removal.confirmBody", lang),
        yes: t("removal.send", lang),
        danger: true,
        onYes: () =>
          this.run(async () => {
            this.apply(await this.api("profile/delete", {}));
            this.flashKey("removal.sent");
          }),
      },
    });
  }
  appVersion() {
    const ua = navigator.userAgent || "";
    const match = /MVPMlAndroid\/([\w.-]+)/.exec(ua);
    const build = /MVPMlBuild\/(\d+)/.exec(ua);
    return match ? match[1] + (build ? " · build " + build[1] : "") : "";
  }
  renderVals(primaryOnly = false) {
    const v = super.renderVals(),
      s = this.state;
    v.themeIcon =
      s.theme === "dark" ? "ph-duotone ph-sun" : "ph-duotone ph-moon";
    v.canReview = s.role === "admin" || !!s.villageAdmin;
    v.communityName = bilingual(
      "મહુવા વાળા રાજપૂત સમાજ",
      "Mahuva Vala Rajput Samaj",
      s.lang,
    );
    v.allAdminsPanel = s.allAdminsOpen
      ? React.createElement(AllAdminDirectory, {
          data: s,
          lang: s.lang,
          onClose: () => this.set("allAdminsOpen", false),
        })
      : null;
    v.isMainAdmin = s.role === "admin";
    // The Main Admin opens the review panel from the dashboard; a Village
    // Admin opens it from the Admin icon in the directory's top bar.
    v.openWorkflow = (tab = "requests") =>
      this.run(async () => {
        // The queue can change while the dashboard is open (a village
        // administrator may forward); always review the latest server state.
        const data = await this.api("state");
        this.apply(data);
        this.setState({ workflowOpen: true, workflowTab: typeof tab === "string" ? tab : "requests" });
      });
    v.workflowPanel =
      s.workflowOpen && v.canReview
        ? React.createElement(VillageWorkflow, {
            key: s.workflowTab || "requests",
            data: s,
            lang: s.lang,
            initialTab: s.workflowTab || "requests",
            flash: (message) => this.flash(message, message),
            onClose: () =>
              this.setState({
                workflowOpen: false,
                screen: s.role === "admin" ? s.screen : "directory",
              }),
            onAdminLogout: () => this.adminLogout(),
            onError: (e, path) => this.showError(e, path),
            onAction: async (path, body) => {
              if (this.state.topError) this.setState({ topError: null });
              const data = await this.api(path, body);
              this.apply(data);
            },
          })
        : null;
    v.loaded = !!s.loaded;
    v.busy = !!s.busy || (!s.loaded && s.connected !== false);
    v.connectionError = s.connected === false;
    v.adminConnectionError = s.connected === false && s.screen === "admin";
    v.retry = () => this.refresh(true);
    v.development = !!s.development;
    v.noResults = !v.showTiles && !v.shortQuery && v.sections.length === 0;
    v.index = [];
    v.resetAll = () => {};
    v.driveBackupPanel =
      s.role === "admin"
        ? React.createElement(DriveBackupPanel, {
            lang: s.lang,
            api: (path, body) => this.api(path, body),
          })
        : null;
    // Admin dashboard (Section 7): Back → dashboard home → Member Directory;
    // "Log out" ends the admin session only.
    v.adminBack = () => this.handleBack();
    v.adminBackLabel = s.tab === "home" ? t("common.back", s.lang) : uiText("backDashboard", s.lang);
    v.adminLogoutLabel = t("nav.adminLogout", s.lang);
    v.exitAdmin = () => this.adminLogout();
    v.logout = () => this.adminLogout();
    // Extra dashboard tiles: Village Admins, Forgot PIN requests, My Profile.
    v.tiles = [
      ...v.tiles,
      {
        gu: STR["va.title"][0],
        en: STR["va.title"][1],
        count: (s.villageAssignments || []).filter((a) => !a.disabled).length,
        hint: this.P("ગામ પસંદ કરો · બનાવો · બંધ કરો", "choose a village · create · disable"),
        onClick: () => v.openWorkflow("villages"),
      },
      {
        gu: STR["profile.title"][0],
        en: STR["profile.title"][1],
        count: 0,
        hint: this.P("પાસવર્ડ બદલો", "change password"),
        onClick: () => this.setState({ screen: "profile", profileFrom: "admin" }),
      },
    ];
    for (const [key, approve] of [
      ["newRequests", "onApprove"],
      ["updateRequests", "onAuthorize"],
      ["deleteRequests", "onApprove"],
    ])
      v[key] = v[key].map((row, i) => ({
        ...row,
        [approve]: () => {
          // Village-stage requests must be verified and forwarded in the
          // review panel; already-verified requests are approved here. The
          // stage is checked against the latest server state (a Village Admin
          // may have forwarded it a moment ago).
          const id = s[key][i].id;
          const approveRequest = () =>
            this.run(async () => {
              const fresh = await this.api("state");
              const queued = (fresh.reviewQueue || []).find((r) => r.id === id);
              if (queued && queued.stage === "village") {
                // Not ready for the Main Admin yet: open the review panel and
                // say clearly why, at the top.
                this.apply(fresh);
                const va = (fresh.adminDirectory?.villages || []).find((v) => v.village === queued.payload.village)?.admin;
                this.setState({ workflowOpen: true, workflowTab: "requests" });
                this.showError(
                  Object.assign(new Error("Village verification is required first"), { status: 409, code: "VERIFY_FIRST", info: { admin: va ? { name: va.name, nameGu: va.name, phone: va.phone } : null } }),
                  "admin/requests/approve",
                );
                return;
              }
              this.apply(await this.api("admin/requests/" + id + "/approve", {}));
              this.setState({ confirm: null });
              this.flash("કાર્ય પૂર્ણ થયું.", "Saved successfully.");
            });
          if (key === "deleteRequests")
            this.confirmAction(
              "સભ્યને યાદીમાંથી દૂર કરવા છે?",
              "Remove member from directory?",
              "The member loses directory access. Their details remain in the admin-only archive.",
              approveRequest,
              "સભ્યનો યાદીમાં પ્રવેશ બંધ થશે. વિગતો ફક્ત એડમિનના આર્કાઇવમાં રહેશે.",
              "યાદીમાંથી દૂર કરો",
              "Remove from directory",
            );
          else approveRequest();
        },
        onReject: () => {
          this.confirmAction(
            "વિનંતી નામંજૂર કરવી છે?",
            "Reject this request?",
            key === "newRequests"
              ? "This enrollment request will be rejected and retained in the admin-only archive."
              : "This request will be rejected. The current member profile will remain unchanged.",
            () => this.mutate("admin/requests/" + s[key][i].id + "/reject"),
            key === "newRequests"
              ? "આ નોંધણી વિનંતી નામંજૂર થશે અને ફક્ત એડમિનના આર્કાઇવમાં રહેશે."
              : "આ વિનંતી નામંજૂર થશે. સભ્યની હાલની પ્રોફાઇલ બદલાશે નહીં.",
            "વિનંતી નામંજૂર કરો",
            "Reject request",
          );
        },
      }));
    v.updateRequests = v.updateRequests.map((row, i) => {
      const r = s.updateRequests[i],
        keys = Object.keys(r.next).filter((k) => r.next[k] !== r.old[k]);
      const fieldValue = (key, value) =>
        !value
          ? "—"
          : key === "label2"
            ? fieldText(value, s.lang)
            : key === "village"
              ? this.V(value)
              : key === "tehsil"
                ? this.T(value)
                : key === "district"
                  ? this.D(value)
                  : value;
      return {
        ...row,
        oldRows: keys.map(
          (k) => fieldText(k, s.lang) + ": " + fieldValue(k, r.old[k]),
        ),
        newRows: keys.map(
          (k) => fieldText(k, s.lang) + ": " + fieldValue(k, r.next[k]),
        ),
      };
    });
    // The all-members list behind the Total members tile carries the
    // server-backed edit/delete actions (the old Members tile).
    v.statVillageMembers = (v.statVillageMembers || []).map((row) => ({
      ...row,
      // Section 7: Edit → Save returns to this list, refreshed, with "Saved".
      onAdminEdit: () => {
        const m = s.members.find((x) => x.id === row.id);
        if (!m) return;
        this.setState({ adminEditingId: m.id, screen: "adminedit", editDirty: false });
      },
      onAdminDelete: () =>
        this.confirmAction(
          "સભ્યને દૂર કરવા છે?",
          "Remove member?",
          row.name +
            " will leave the directory. A copy is retained in the archive.",
          () => this.mutate("admin/members/" + row.id + "/delete"),
          row.name +
            " યાદીમાંથી દૂર થશે. તેની નકલ ફક્ત એડમિનના આર્કાઇવમાં રહેશે.",
          "યાદીમાંથી દૂર કરો",
          "Remove from directory",
        ),
    }));
    v.alerts = v.alerts.map((row, i) => ({
      ...row,
      title:
        this.O(row.title) +
        (s.alerts[i].blocked ? this.P(" · અવરોધિત", " · Blocked") : ""),
      onBlock: () => this.mutate("admin/alerts/" + s.alerts[i].id + "/block"),
    }));
    v.exports = v.exports.map((x, i) => ({
      ...x,
      onClick: [
        () =>
          this.run(async () => {
            await this.api("state").then((data) => {
              if (data.role !== "admin")
                throw new Error("Admin authentication required");
              this.printPdf(data.members);
            });
          }),
        () => this.file("export.xlsx?lang=" + s.lang, "mvpmi-contacts.xlsx"),
        () =>
          this.file(
            "export.csv?type=members&lang=" + s.lang,
            "mvpmi-members.csv",
          ),
        () => this.file("backup", "mvpmi-backup.json"),
      ][i],
    }));
    v.restoreData = () => this.restore();

    // ---- Reports (PDF via the print sheet, CSV via the export endpoint) ----
    const villageLabelPair = (value) => {
      const row = VILLAGE_LIST.find((x) => x.gu === value || x.en === value);
      return row ? row.gu + " / " + row.en : value;
    };
    const reportWhen = (ms) =>
      ms
        ? new Date(ms).toLocaleString(
            s.lang === "en" ? "en-GB" : "gu-IN",
          )
        : "";
    const singleText = (gu, en) => (s.lang === "en" ? en : gu);
    // The archive table keeps removed members; the rejection ledger keeps
    // rejected and closed/withdrawn applications. Both are shown here with
    // separate tags so nothing is ever silently mixed.
    const lastLedgerEvent = (a) => a.events?.[a.events.length - 1] || {};
    const archiveTagDefs = {
      removed: {
        gu: "કાઢી નાખેલા સભ્યો",
        en: "Removed members",
        icon: "ph-duotone ph-user-minus",
        chipBg: "var(--danBg)",
        chipFg: "var(--dan)",
      },
      rejected: {
        gu: "નામંજૂર વિનંતીઓ",
        en: "Rejected applications",
        icon: "ph-duotone ph-x-circle",
        chipBg: "rgba(178,64,44,.14)",
        chipFg: "var(--ind)",
      },
      withdrawn: {
        gu: "બંધ / પાછી ખેંચેલી વિનંતીઓ",
        en: "Closed / withdrawn applications",
        icon: "ph-duotone ph-arrow-counter-clockwise",
        chipBg: "rgba(178,64,44,.14)",
        chipFg: "var(--ind)",
      },
    };
    const archiveSectionList = [
      {
        id: "removed",
        ...archiveTagDefs.removed,
        rows: s.archive.map((a) => ({
          ...a,
          status: this.O(
            a.history?.[a.history.length - 1]?.reason || a.status || "",
          ),
          when: reportWhen(a.history?.[a.history.length - 1]?.at),
        })),
      },
      {
        id: "rejected",
        ...archiveTagDefs.rejected,
        rows: (s.rejectedApplications || [])
          .filter((a) => lastLedgerEvent(a).action === "reject")
          .map((a) => ({
            id: a.id,
            nameGu: bothScripts(a.name).gu || a.name,
            name: bothScripts(a.name).en || a.name,
            phone: a.phone,
            village: a.village,
            place: villageLabelPair(a.village),
            status:
              singleText("નામંજૂર", "Rejected") +
              (lastLedgerEvent(a).reason
                ? " · " + lastLedgerEvent(a).reason
                : ""),
            when: reportWhen(lastLedgerEvent(a).at),
          })),
      },
      {
        id: "withdrawn",
        ...archiveTagDefs.withdrawn,
        rows: (s.rejectedApplications || [])
          .filter((a) => lastLedgerEvent(a).action === "closed")
          .map((a) => ({
            id: a.id,
            nameGu: bothScripts(a.name).gu || a.name,
            name: bothScripts(a.name).en || a.name,
            phone: a.phone,
            village: a.village,
            place: villageLabelPair(a.village),
            status:
              singleText("બંધ", "Closed") +
              (lastLedgerEvent(a).reason
                ? " · " + lastLedgerEvent(a).reason
                : ""),
            when: reportWhen(lastLedgerEvent(a).at),
          })),
      },
    ].filter((g) => g.rows.length);
    v.archiveSections = archiveSectionList.map((g) => ({
      ...g,
      rows: g.rows.map((a) => ({
        ...a,
        nameGu: a.nameGu || a.name || "—",
        name: a.name || a.nameGu || "—",
      })),
    }));
    const archiveDocSections = () =>
      archiveSectionList.map((g) => ({
        headingGu: g.gu,
        headingEn: g.en,
        columns: [
          ["નામ", "Name"],
          ["નંબર", "Phone"],
          ["ગામ", "Village"],
          ["સ્થિતિ", "Status"],
          ["સમય", "When"],
        ],
        rows: g.rows.map((a) => [
          a.nameGu || a.name || "—",
          a.phone || "—",
          villageLabelPair(a.village),
          a.status || "—",
          a.when || "",
        ]),
      }));
    v.archivePdf = () =>
      this.printReport(
        "આર્કાઇવ યાદી",
        "Archive list",
        reportDocument(
          {
            titleGu: "આર્કાઇવ યાદી",
            titleEn: "Archive list",
            summaryGu: s.archive.length + " નોંધો",
            summaryEn: s.archive.length + " records",
            sections: archiveDocSections(),
          },
          s.lang,
        ),
      );
    v.archiveCsv = () =>
      this.file("export.csv?type=archive&lang=" + s.lang, "mvpmi-archive.csv");
    const requestsDocSections = () => [
      {
        headingGu: "નવી નોંધણી વિનંતીઓ",
        headingEn: "New enrollments",
        columns: [
          ["નામ", "Name"],
          ["નંબર", "Phone"],
          ["ગામ", "Village"],
          ["તબક્કો", "Stage"],
          ["પહેલા નામંજૂર", "Rejected before"],
        ],
        rows: s.newRequests.map((r) => [
          r.nameGu || r.name || "—",
          r.phone,
          villageLabelPair(r.village),
          (s.reviewQueue || []).some((q) => q.id === r.id && !q.verification)
            ? singleText(
                "ગામ ચકાસણી બાકી",
                "Awaiting village verification",
              )
            : singleText("મુખ્ય એડમિન પાસે", "With main admin"),
          r.rejectedBefore
            ? singleText("હા — ચકાસી લેવા", "Yes — verify carefully")
            : "—",
        ]),
      },
      {
        headingGu: "ફેરફાર વિનંતીઓ",
        headingEn: "Change requests",
        columns: [
          ["નામ", "Name"],
          ["નંબર", "Phone"],
          ["ગામ", "Village"],
        ],
        rows: s.updateRequests.map((r) => [
          r.name || r.nameGu || "—",
          r.next?.phone || r.old?.phone || "—",
          villageLabelPair(r.next?.village || r.old?.village),
        ]),
      },
      {
        headingGu: "દૂર કરવાની વિનંતીઓ",
        headingEn: "Removal requests",
        columns: [
          ["નામ", "Name"],
          ["નંબર", "Phone"],
          ["ગામ", "Village"],
        ],
        rows: s.deleteRequests.map((r) => [
          r.name || "—",
          r.phone || "—",
          villageLabelPair((r.place || "").split(",")[0]),
        ]),
      },
    ];
    const villagesDocSections = () => [
      {
        headingGu: "ગામ પ્રમાણે સભ્યો",
        headingEn: "Members by village",
        columns: [
          ["ગામ", "Village"],
          ["સભ્યો", "Members"],
        ],
        rows: (s.villages || []).map((v) => [
          v.gu + " / " + v.en,
          s.members.filter((m) => m.village === v.gu).length,
        ]),
      },
    ];
    const rejectionsDocSections = () => [
      {
        headingGu: "નામંજૂર / બંધ વિનંતીઓ",
        headingEn: "Rejected / closed applications",
        columns: [
          ["નામ", "Name"],
          ["નંબર", "Phone"],
          ["ગામ", "Village"],
          ["છેલ્લો નિર્ણય", "Last decision"],
          ["સમય", "When"],
        ],
        rows: (s.rejectedApplications || []).map((a) => {
          const last = a.events?.[a.events.length - 1] || {};
          return [
            a.name || "—",
            a.phone,
            villageLabelPair(a.village),
            (last.action === "closed"
              ? singleText("બંધ", "Closed")
              : singleText("નામંજૂર", "Rejected")) +
              (last.reason ? " · " + last.reason : ""),
            reportWhen(last.at),
          ];
        }),
      },
    ];
    const activityDocSections = () => [
      {
        headingGu: "છેલ્લી પ્રવૃત્તિ",
        headingEn: "Recent activity",
        columns: [
          ["સમય", "When"],
          ["કરનાર", "Actor"],
          ["ક્રિયા", "Action"],
          ["લક્ષ્ય", "Target"],
        ],
        rows: (s.auditLog || []).map((a) => [
          reportWhen(a.at),
          a.actor,
          a.action,
          a.target,
        ]),
      },
    ];
    const summaryCount =
      s.newRequests.length + s.updateRequests.length + s.deleteRequests.length;
    v.reports = [
      {
        gu: "સંપૂર્ણ રિપોર્ટ",
        en: "Full report",
        descGu:
          "સભ્યો, ગામ, બાકી વિનંતીઓ, આર્કાઇવ, નામંજૂરી અને પ્રવૃત્તિ — બધું એક ફાઇલમાં.",
        descEn:
          "Members, villages, pending requests, archive, rejections and activity — everything in one file.",
        icon: "ph-duotone ph-files",
        bg: "rgba(178,64,44,.14)",
        fg: "var(--ind)",
        onPdf: () =>
          this.printReport(
            "સમાજ સંપૂર્ણ રિપોર્ટ",
            "Community full report",
            reportDocument(
              {
                titleGu: "સમાજ સંપૂર્ણ રિપોર્ટ",
                titleEn: "Community full report",
                summaryGu:
                  s.members.length +
                  " મંજૂર સભ્યો · " +
                  (s.villages || []).length +
                  " ગામ",
                summaryEn:
                  s.members.length +
                  " approved members · " +
                  (s.villages || []).length +
                  " villages",
                sections: [
                  ...villagesDocSections(),
                  ...requestsDocSections(),
                  ...archiveDocSections(),
                  ...rejectionsDocSections(),
                  ...activityDocSections(),
                ],
              },
              s.lang,
            ),
          ),
        onCsv: () =>
          this.file("export.csv?type=full&lang=" + s.lang, "mvpmi-full.csv"),
      },
      {
        gu: "સભ્યોની યાદી",
        en: "Members directory",
        descGu: "બધા મંજૂર સભ્યો નામ-નંબર સાથે.",
        descEn: "Every approved member with names and numbers.",
        icon: "ph-duotone ph-users-three",
        bg: "rgba(178,64,44,.14)",
        fg: "var(--ind)",
        onPdf: () =>
          this.run(async () => {
            const data = await this.api("state");
            if (data.role !== "admin")
              throw new Error("Admin authentication required");
            this.printPdf(data.members);
          }),
        onCsv: () =>
          this.file(
            "export.csv?type=members&lang=" + s.lang,
            "mvpmi-members.csv",
          ),
      },
      {
        gu: "ગામ પ્રમાણે સારાંશ",
        en: "Village summary",
        descGu: "દરેક ગામમાં કેટલા સભ્યો છે.",
        descEn: "How many members each village has.",
        icon: "ph-duotone ph-house-line",
        bg: "rgba(178,64,44,.14)",
        fg: "var(--ind)",
        onPdf: () =>
          this.printReport(
            "ગામ પ્રમાણે સારાંશ",
            "Village summary",
            reportDocument(
              {
                titleGu: "ગામ પ્રમાણે સારાંશ",
                titleEn: "Village summary",
                summaryGu: s.members.length + " મંજૂર સભ્યો",
                summaryEn: s.members.length + " approved members",
                sections: villagesDocSections(),
              },
              s.lang,
            ),
          ),
        onCsv: () =>
          this.file(
            "export.csv?type=villages&lang=" + s.lang,
            "mvpmi-villages.csv",
          ),
      },
      {
        gu: "બાકી વિનંતીઓ",
        en: "Pending requests",
        descGu: "નવી, ફેરફાર અને દૂર કરવાની વિનંતીઓ તબક્કા સાથે.",
        descEn: "New, change and removal requests with their stage.",
        icon: "ph-duotone ph-tray",
        bg: "rgba(178,64,44,.14)",
        fg: "var(--ind)",
        onPdf: () =>
          this.printReport(
            "બાકી વિનંતીઓ",
            "Pending requests",
            reportDocument(
              {
                titleGu: "બાકી વિનંતીઓ",
                titleEn: "Pending requests",
                summaryGu: summaryCount + " વિનંતીઓ",
                summaryEn: summaryCount + " requests",
                sections: requestsDocSections(),
              },
              s.lang,
            ),
          ),
        onCsv: () =>
          this.file(
            "export.csv?type=requests&lang=" + s.lang,
            "mvpmi-requests.csv",
          ),
      },
      {
        gu: "નામંજૂર / બંધ વિનંતીઓ",
        en: "Rejected / closed",
        descGu: "પહેલા નામંજૂર થયેલા નંબરોની નોંધ.",
        descEn: "The ledger of previously rejected numbers.",
        icon: "ph-duotone ph-x-circle",
        bg: "rgba(178,64,44,.14)",
        fg: "var(--ind)",
        onPdf: () =>
          this.printReport(
            "નામંજૂર / બંધ વિનંતીઓ",
            "Rejected / closed applications",
            reportDocument(
              {
                titleGu: "નામંજૂર / બંધ વિનંતીઓ",
                titleEn: "Rejected / closed applications",
                summaryGu: (s.rejectedApplications || []).length + " નોંધો",
                summaryEn: (s.rejectedApplications || []).length + " records",
                sections: rejectionsDocSections(),
              },
              s.lang,
            ),
          ),
        onCsv: () =>
          this.file(
            "export.csv?type=rejections&lang=" + s.lang,
            "mvpmi-rejections.csv",
          ),
      },
      {
        gu: "પ્રવૃત્તિ નોંધ",
        en: "Activity log",
        descGu: "છેલ્લા ૫૦૦ નિર્ણયો અને ક્રિયાઓ.",
        descEn: "The last 500 decisions and actions.",
        icon: "ph-duotone ph-clock-counter-clockwise",
        bg: "rgba(178,64,44,.14)",
        fg: "var(--ind)",
        onPdf: () =>
          this.printReport(
            "પ્રવૃત્તિ નોંધ",
            "Activity log",
            reportDocument(
              {
                titleGu: "પ્રવૃત્તિ નોંધ",
                titleEn: "Activity log",
                summaryGu: (s.auditLog || []).length + " નોંધો",
                summaryEn: (s.auditLog || []).length + " entries",
                sections: activityDocSections(),
              },
              s.lang,
            ),
          ),
        onCsv: () =>
          this.file(
            "export.csv?type=activity&lang=" + s.lang,
            "mvpmi-activity.csv",
          ),
      },
    ];


    v.setFs = (e) => this.set("fsPct", normalizeTextSize(e.target.value));
    v.resetFs = () => this.set("fsPct", 100);
    v.effectsEnabled = s.effects !== false;
    v.toggleEffects = () => this.set("effects", !v.effectsEnabled);
    v.material = materialCapability({
      enabled: v.effectsEnabled,
      reduceTransparency: matchMedia("(prefers-reduced-transparency: reduce)")
        .matches,
      forcedColors: matchMedia("(forced-colors: active)").matches,
      saveData: navigator.connection?.saveData,
      memory: navigator.deviceMemory,
      cores: navigator.hardwareConcurrency,
      blur:
        CSS.supports("backdrop-filter", "blur(1px)") ||
        CSS.supports("-webkit-backdrop-filter", "blur(1px)"),
    });
    v.motion =
      v.effectsEnabled &&
      v.material !== "opaque" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "on"
        : "off";
    v.largeText = s.fsPct >= 135 ? "large" : "normal";
    v.ui = Object.fromEntries(
      Object.keys(UI_COPY).map((key) => [key, uiText(key, s.lang)]),
    );
    if (v.connectionError)
      v.ui.connection = uiText(
        !navigator.onLine
          ? "offline"
          : s.lastConfirmed
            ? "stale"
            : "unavailable",
        s.lang,
      );
    if (v.connectionError && s.lastConfirmed)
      v.ui.connection =
        t("offline.banner", s.lang) +
        " · " +
        t("offline.lastUpdated", s.lang, {
          time: new Date(s.lastConfirmed).toLocaleString(
            s.lang === "gu" ? "gu-IN" : "en-IN",
            { dateStyle: "medium", timeStyle: "short" },
          ),
        });
    v.lastConfirmed =
      s.connected === false && s.lastConfirmed
        ? new Date(s.lastConfirmed).toLocaleString(
            s.lang === "gu" ? "gu-IN" : "en-IN",
          )
        : "";
    v.lastBackup = this.O(s.lastBackup);
    v.screenName = s.screen;
    v.aes = false;
    v.aesAttr = "off";
    v.languageSwitch = this.P("English", "ગુજરાતી");
    // The header button shows the language it will switch TO.
    v.languageSwitchShort = this.P("En", "ગુ");
    v.themeLabel = this.P(
      s.theme === "dark" ? "આછો દેખાવ" : "ઘેરો દેખાવ",
      s.theme === "dark" ? "Light" : "Dark",
    );
    for (const key of [
      "newRequests",
      "updateRequests",
      "deleteRequests",
      "archive",
    ]) {
      v[key] = v[key].map((row) => ({
        ...row,
        name: row.name || row.nameGu || "—",
        nameGu: row.nameGu || row.name || "—",
      }));
    }
    if (primaryOnly) return v;
    // Read-only language facade: no state mutation, requests or alternate handlers.
    const alternate = Object.create(this);
    alternate.state = { ...s, lang: s.lang === "gu" ? "en" : "gu" };
    const out = bilingualView(v, alternate.renderVals(true), s.lang);
    // Alpha screens (Sections 2–8) are rendered once, after the language merge.
    out.appScreen = this.renderAppScreen();
    out.appOverlay = this.renderAppOverlay();
    return out;
  }
}
