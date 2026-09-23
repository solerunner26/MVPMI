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
  download(name, data, type) {
    if (androidBridge()) {
      this.run(async () => {
        await saveFile(name, type || "application/octet-stream", data);
        this.flash(
          "ફાઇલ સેવ કરો — ફોન કે Google Drive પસંદ કરો.",
          "Choose where to save — phone or Google Drive.",
        );
      });
      return;
    }
    return super.download(name, data, type);
  }
  componentDidMount() {
    this._alive = true;
    try {
      const p = JSON.parse(localStorage.getItem("mvpmi-preferences") || "{}");
      this.setState({
        lang: p.lang === "en" ? "en" : "gu",
        theme: p.theme === "dark" ? "dark" : "light",
        fsPct: normalizeTextSize(p.fsPct),
        effects: p.effects !== false,
        tileOrder:
          Array.isArray(p.tileOrder) &&
          p.tileOrder.length <= 1000 &&
          new Set(p.tileOrder).size === p.tileOrder.length &&
          p.tileOrder.every((g) => typeof g === "string" && g.length <= 80)
            ? p.tileOrder
            : null,
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
      const dialog = document.querySelector('.app [role="dialog"]');
      if (!dialog) return;
      if (e.key === "Escape") {
        e.preventDefault();
        this.handleBack();
        return;
      }
      if (e.key === "Tab") {
        const items = [
          ...dialog.querySelectorAll(
            'button,input,select,a[href],[tabindex="0"]',
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
    window.mvpmiBack = () => this.handleBack();
    // The PIN now lives on the server; remove any old on-device PIN record.
    clearAppLock();
    // Lock after 30 seconds in the background…
    // The server applies the same 30-second rule even if the app is closed
    // or killed in the background and never comes back.
    this._onVisibility = () => {
      if (document.hidden) {
        this._hiddenAt = Date.now();
        if (this._lockable()) this._lockSignal("lock/hidden");
      } else if (Date.now() - (this._hiddenAt || Date.now()) > 30000)
        this._engageLock();
      else if (this._lockable()) this._lockSignal("lock/visible");
    };
    document.addEventListener("visibilitychange", this._onVisibility);
    // …and after 3 minutes without a touch or key press.
    this._lastActivity = Date.now();
    this._activity = () => {
      this._lastActivity = Date.now();
    };
    for (const type of ["pointerdown", "keydown", "touchstart", "wheel"])
      document.addEventListener(type, this._activity, {
        passive: true,
        capture: true,
      });
    this._idle = setInterval(() => {
      if (this._lockable() && Date.now() - this._lastActivity > 180000)
        this._engageLock();
    }, 15000);
    // Installable home-screen app + Web Push (not needed inside the Android app).
    try {
      if (!androidBridge() && window.isSecureContext && "serviceWorker" in navigator)
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    } catch {}
    // Every app start begins locked (the server keeps the lock state).
    this.api("lock/engage", {})
      .catch(() => {})
      .finally(() => this.refresh(true).then(() => this._afterState()));
    this._clock = setInterval(() => this.forceUpdate(), 1000);
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
    for (const type of ["pointerdown", "keydown", "touchstart", "wheel"])
      document.removeEventListener(type, this._activity, { capture: true });
    delete window.mvpmiBack;
    this._alive = false;
    clearInterval(this._poll);
    clearInterval(this._idle);
    clearInterval(this._clock);
    super.componentWillUnmount();
  }
  // Fire-and-forget lock signal that survives the page being backgrounded.
  _lockSignal(path) {
    try {
      const headers = { "Content-Type": "application/json", "X-MVPMI-Client": "1" };
      if (this._transport) headers["X-MVPMI-Session"] = this._transport;
      fetch("/api/" + path, {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers,
        body: "{}",
      }).catch(() => {});
    } catch {}
  }
  // Only an unlocked member / village-administrator session can be locked.
  _lockable() {
    const s = this.state;
    return (
      !!s.loaded &&
      s.role !== "admin" &&
      (!!s.meId || !!s.villageAdmin) &&
      s.locked === false &&
      !s.lockSetup
    );
  }
  // Every overlay closes with the lock, so nothing (a Call sheet, a dialog, a
  // panel) stays usable or readable underneath the lock screen.
  _overlaysClosed() {
    return {
      confirm: null,
      picker: null,
      dial: null,
      edit: null,
      adminEditingId: null,
      preferencesOpen: false,
      workflowOpen: false,
      allAdminsOpen: false,
      villageLoginOpen: false,
      recoveryOpen: false,
      pinResetOpen: false,
    };
  }
  _engageLock() {
    if (!this._lockable()) return;
    this._lockEngagedAt = Date.now();
    this.setState({
      ...this._overlaysClosed(),
      locked: true,
      members: [],
      screen: "applock",
      appLockInput: "",
      appLockFirst: "",
      appLockError: null,
    });
    this.api("lock/engage", {})
      .then(() => this.refresh())
      .catch(() => {});
  }
  handleBack() {
    if (this.state.locked || this.state.lockSetup) {
      if (this.state.pinResetOpen) this.set("pinResetOpen", false);
      return true;
    }
    if (this.state.workflowOpen) {
      this.set("workflowOpen", false);
      return true;
    }
    if (this.state.villageLoginOpen) {
      this.set("villageLoginOpen", false);
      return true;
    }
    if (this._busy) return true;
    if (this.state.recoveryOpen || this.state.recoveryIssued) {
      this.setState({
        recoveryOpen: false,
        recoveryIssued: null,
        recoveryCode: "",
        recoveryError: null,
      });
      return true;
    }
    if (this.state.preferencesOpen) {
      this.set("preferencesOpen", false);
      return true;
    }
    if (this.state.confirm || this.state.picker || this.state.dial) {
      this.setState({ confirm: null, picker: null, dial: null });
      return true;
    }
    const s = this.state;
    if (s.screen === "editprofile") {
      this.setState({
        screen: s.adminEditingId ? "admin" : "profile",
        edit: null,
        adminEditingId: null,
      });
      return true;
    }
    if (s.screen === "profile") {
      this.set("screen", "directory");
      return true;
    }
    if (s.screen === "admin" && s.tab !== "home") {
      this.set("tab", "home");
      return true;
    }
    if (s.screen === "adminforgot") {
      this.set("screen", s.role === "admin" ? "admin" : "adminlogin");
      return true;
    }
    if (s.screen === "adminlogin") {
      this.setState({ screen: "gate", gateInput: "" });
      return true;
    }
    if (s.screen === "gate") {
      this.set("screen", this.home());
      return true;
    }
    if (s.screen === "signup" && s.myRequest) {
      this.setState({ screen: "pending", editingRequest: false });
      return true;
    }
    if (s.screen === "directory" && (s.query || s.dirMode !== "all")) {
      this.setState({ query: "", dirMode: "all" });
      return true;
    }
    return false;
  }
  componentDidUpdate() {
    document.documentElement.lang = this.state.lang;
    document.title = this.P(
      "મહુવા ક્ષત્રિય રાજપૂત સમાજ · સમાજ સંપર્ક યાદી",
      "મહુવા ક્ષત્રિય રાજપૂત સમાજ · Community Directory",
    );
    const dialog = document.querySelector('.app [role="dialog"]');
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
      (dialog.querySelector("button") || dialog).focus();
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
    try {
      const preferences = JSON.stringify({
        lang: this.state.lang,
        theme: this.state.theme,
        fsPct: this.state.fsPct,
        effects: this.state.effects !== false,
        tileOrder: this.state.tileOrder,
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
        signal: AbortSignal.timeout(15000),
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
    // Tells the server the person is really using the app (idle-lock timer).
    if (
      typeof document !== "undefined" &&
      !document.hidden &&
      Date.now() - (this._lastActivity || 0) < 60000
    )
      headers["X-MVPMI-Active"] = "1";
    const response = await fetch("/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
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
    const response = await this.request(path, body);
    const value = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(value.error || "Request failed"), {
        status: response.status,
      });
    return value;
  }
  home(data = this.state) {
    return data.role === "admin"
      ? "admin"
      : data.meId
        ? "directory"
        : data.myRequest
          ? "pending"
          : "signup";
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
      const order = (this.state.tileOrder || []).filter((g) =>
        data.villages.some((v) => v.gu === g),
      );
      data.tileOrder = [
        ...order,
        ...data.villages.map((v) => v.gu).filter((g) => !order.includes(g)),
      ];
    }
    const current = this.state;
    const patch = {
      ...data,
      connected: true,
      loaded: true,
      lastConfirmed: Date.now(),
    };
    if (data.role !== "admin") {
      patch.recoveryIssued = null;
      patch.recoveryMember = null;
      patch.recoveryMemberGu = null;
      patch.recoveryMemberEn = null;
    }
    if (
      data.myRequest &&
      (!current.loaded || current.myRequest?.id !== data.myRequest.id)
    ) {
      patch.form = { ...data.myRequest };
      patch.showPhone2 = !!data.myRequest.phone2;
    }
    const restricted =
      ["directory", "profile", "editprofile"].includes(current.screen) &&
      !data.meId &&
      data.role !== "admin";
    const roleChanged = current.loaded && current.role !== data.role;
    if (
      initial ||
      screen ||
      restricted ||
      roleChanged ||
      (current.screen === "admin" && data.role !== "admin")
    ) {
      patch.screen = screen || this.home(data);
      patch.editingRequest = false;
      patch.edit = null;
      patch.adminEditingId = null;
      patch.confirm = null;
      patch.dial = null;
    }
    // While locked (or before a PIN exists) the app shows only the lock
    // screen; the server sends no directory records in that state.
    if (data.locked || data.lockSetup) {
      Object.assign(patch, this._overlaysClosed(), { screen: "applock" });
      if (current.screen !== "applock") {
        patch.appLockInput = "";
        patch.appLockFirst = "";
        patch.appLockError = null;
      }
    } else if (current.screen === "applock" || patch.screen === "applock")
      patch.screen = this.home(data);
    this.setState(patch);
  }
  clearAccess() {
    if (!this._alive) return;
    this.setState({
      recoveryIssued: null,
      recoveryMember: null,
      recoveryMemberGu: null,
      recoveryMemberEn: null,
      ...clone(SEED),
      meId: null,
      myRequest: null,
      role: "guest",
      villageAdmin: false,
      allAdminsOpen: false,
      villageLoginOpen: false,
      reviewQueue: [],
      villageAssignments: [],
      rejectedApplications: [],
      workflowOpen: false,
      locked: false,
      lockSetup: false,
      pinResetOpen: false,
      screen: "signup",
      confirm: null,
      dial: null,
      edit: null,
      preferencesOpen: false,
      recoveryOpen: false,
      lastConfirmed: null,
      connected: false,
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
      if (this._deviceLang !== s.lang && !this._deviceBusy) {
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
  // (sending an application, signing in as an administrator).
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
      if (this._lockEngagedAt > started && !data.locked && !data.lockSetup) return;
      this.apply(data, initial);
    } catch (e) {
      if (this._alive) {
        if (e.status === 403 || e.status === 401) {
          this.clearAccess();
          this.flash(errorText(e.message, "gu"), errorText(e.message, "en"));
        } else this.setState({ connected: false, loaded: true });
      }
    }
  }
  async run(fn) {
    if (this._busy) return;
    this._busy = true;
    this.setState({ busy: true });
    try {
      await fn();
    } catch (e) {
      this.flash(errorText(e.message, "gu"), errorText(e.message, "en"));
      if (/authentication|approval|blocked/i.test(e.message))
        await this.refresh();
    } finally {
      this._busy = false;
      if (this._alive) this.setState({ busy: false });
    }
  }
  mutate(path, body = {}, screen) {
    return this.run(async () => {
      this.apply(await this.api(path, body), false, screen);
      this.setState({ confirm: null, submitted: false });
      this.flash("કાર્ય પૂર્ણ થયું.", "Saved successfully.");
    });
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
      this.download(name, blob, blob.type);
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
  renderVals(primaryOnly = false) {
    const v = super.renderVals(),
      s = this.state;
    v.themeIcon =
      s.theme === "dark" ? "ph-duotone ph-sun" : "ph-duotone ph-moon";
    v.canReview = s.role === "admin" || !!s.villageAdmin;
    // Header buttons: "All admins" is visible to everyone; the shield opens
    // the village-admin sign-in (or the review panel once signed in) for every
    // session that is not the main administrator.
    v.communityName = bilingual(
      "મહુવા ક્ષત્રિય રાજપૂત સમાજ",
      "Mahuva Kshatriya Rajput Samaj",
      s.lang,
    );
    v.showAllAdmins = true;
    v.openAllAdmins = () => this.setState({ allAdminsOpen: true });
    v.allAdminsPanel = s.allAdminsOpen
      ? React.createElement(AllAdminDirectory, {
          data: s,
          lang: s.lang,
          onClose: () => this.set("allAdminsOpen", false),
        })
      : null;
    v.isAdminUser = s.role === "admin" || !!s.villageAdmin;
    v.isMainAdmin = s.role === "admin";
    // Signed-in village administrators reach their workspace through the
    // Dashboard button next to "My profile", not through the header shield.
    v.showVillageAdminButton = s.role !== "admin" && !s.villageAdmin;
    v.showDashboard = !!s.villageAdmin;
    // The village-administrator badge counts everything awaiting attention
    // in their village: new applications to verify and forward, plus the
    // change/removal proposals already waiting with the main administrator
    // (the same items the Members tab marks as pending).
    v.pendingCount = Math.min(
      99,
      (s.reviewQueue || []).length + (s.villageProposals || []).length,
    );
    v.dashboardLabel = bilingual("ડેશબોર્ડ", "Dashboard", s.lang);
    v.heroVillage = s.villageAdmin
      ? this.V(s.villageAdminVillage) +
        this.P(" · ગામ એડમિન", " · Village administrator")
      : "";
    v.villageAdminButtonLabel = s.villageAdmin
      ? bilingual("ગામની વિનંતીઓ તપાસો", "Review village requests", s.lang)
      : bilingual("ગામ એડમિન સાઇન ઇન", "Village admin sign in", s.lang);
    v.openVillageAdminHeader = () =>
      this.setState(
        s.villageAdmin
          ? { workflowOpen: true, workflowTab: "requests" }
          : { villageLoginOpen: true },
      );
    v.openVillageLogin = () => this.setState({ villageLoginOpen: true });
    v.closeVillageLogin = () => this.setState({ villageLoginOpen: false });
    v.villageLoginPanel = s.villageLoginOpen
      ? React.createElement(VillageAdminLogin, {
          lang: s.lang,
          onClose: () => this.setState({ villageLoginOpen: false }),
          onAction: async (path, body) => {
            const data = await this.api(path, body);
            this.apply(data);
            if (path === "village/login") {
              this.setState({ villageLoginOpen: false });
              this.offerNotifications();
            }
          },
          // The main administrator's entrance is also reachable here (in
          // addition to the hidden five-tap gesture on the sun logo).
          onMainAdmin: () =>
            this.setState({
              villageLoginOpen: false,
              screen: "gate",
              gateInput: "",
              gateError: false,
            }),
        })
      : null;
    v.workflowLabel = bilingual(
      s.role === "admin" ? "ગામ, એડમિન અને ચકાસણી" : "ગામની વિનંતીઓ તપાસો",
      s.role === "admin"
        ? "Villages, admins & verification"
        : "Review village requests",
      s.lang,
    );
    v.openWorkflow = () =>
      this.run(async () => {
        // The queue can change while the dashboard is open (a village
        // administrator may forward); always review the latest server state.
        const data = await this.api("state");
        this.apply(data);
        this.setState({ workflowOpen: true, workflowTab: "requests" });
      });
    v.workflowPanel =
      s.workflowOpen && v.canReview
        ? React.createElement(VillageWorkflow, {
            data: s,
            lang: s.lang,
            initialTab: s.workflowTab || "requests",
            onClose: () => this.set("workflowOpen", false),
            onAction: Object.assign(
              async (path, body) => {
                const data = await this.api(path, body);
                this.apply(data);
                // Signing out of the village-administrator role returns a
                // community member straight to the member list.
                if (path === "village/logout" && data.meId)
                  this.setState({ screen: "directory", workflowOpen: false });
              },
              { raw: (path, body) => this.api(path, body) },
            ),
          })
        : null;
    const registry = s.villages || VILLAGE_LIST;
    const villageField = (form, key) =>
      React.createElement(VillageField, {
        villages: registry,
        lang: s.lang,
        value:
          registry.find((v) => v.gu === form.village || v.en === form.village)
            ?.gu || "",
        onChange: (value) =>
          this.setState((st) => ({
            [key]: { ...(st[key] || form), village: value },
          })),
      });
    const locationField = (form, key) =>
      React.createElement(LocationField, {
        lang: s.lang,
        value: form.currentLocation || "",
        onChange: (value) =>
          this.setState((st) => ({
            [key]: { ...(st[key] || form), currentLocation: value },
          })),
      });
    v.signupVillage = villageField(s.form, "form");
    v.signupLocation = locationField(s.form, "form");
    v.editVillageField = villageField(s.edit || v.edit, "edit");
    v.editLocation = locationField(s.edit || v.edit, "edit");
    v.applicationFeedback =
      s.applicationStage || s.lastDecision
        ? React.createElement(
            "div",
            { className: "application-feedback", role: "status" },
            s.applicationStage
              ? bilingual(
                  s.applicationStage === "main"
                    ? "ગામની ચકાસણી પૂર્ણ. મુખ્ય એડમિનની મંજૂરી બાકી છે."
                    : "ગામના એડમિનની ચકાસણી બાકી છે.",
                  s.applicationStage === "main"
                    ? "Village verified. Waiting for main-admin approval."
                    : "Waiting for your village administrator to verify your application.",
                  s.lang,
                )
              : React.createElement(
                  React.Fragment,
                  null,
                  bilingual(
                    "પાછલી વિનંતી બંધ / નામંજૂર થઈ.",
                    "Previous application was closed / rejected.",
                    s.lang,
                  ),
                  s.lastDecision.reason
                    ? " " + s.lastDecision.reason
                    : "",
                ),
          )
        : null;
    v.loaded = !!s.loaded;
    v.busy = !!s.busy || (!s.loaded && s.connected !== false);
    v.connectionError = s.connected === false;
    if (!s.loaded || (s.connected === false && !s.lastConfirmed))
      v.isSignup = false;
    v.retry = () => this.refresh(true);
    v.development = !!s.development;
    v.passwordDue = !!s.passwordDue;
    v.editNoticeGu = s.adminEditingId
      ? "એડમિનનો ફેરફાર સીધો લાગુ થશે."
      : "મોબાઇલ નંબર કે ગામ બદલવાની વિનંતી પહેલા ગામના એડમિન ચકાસશે, પછી મુખ્ય એડમિન મંજૂર કરશે.";
    v.editNoticeEn = s.adminEditingId
      ? "Admin changes apply directly."
      : "A new mobile number or village is first verified by your village administrator, then approved by the main administrator.";
    v.editSubmitGu = s.adminEditingId ? "ફેરફાર સાચવો" : "મંજૂરી માટે મોકલો";
    v.editSubmitEn = s.adminEditingId ? "Save changes" : "Send for approval";
    if (v.me && s.meId) {
      // Blank rows waste space: હાલ location only appears when filled in.
      const currentLocation =
        s.members.find((m) => m.id === s.meId)?.currentLocation || "";
      if (currentLocation.trim())
        v.me.rows.push({
          gu: "હાલ :",
          en: "Current location",
          value: currentLocation,
        });
    }
    v.noResults = !v.showTiles && !v.shortQuery && v.sections.length === 0;
    v.index = [];
    v.resetAll = () => {};
    v.sendRequest = () => {
      if (Object.keys(this.errorsFor(s.form)).length) {
        this.setState({ submitted: true });
        this.flash("વિગતો તપાસો.", "Please correct the highlighted fields.");
        return;
      }
      this.confirmAction(
        "સંમતિ અને ગોપનીયતા",
        "Consent & privacy",
        "Your name, numbers, current location and village will be shared only with approved community members. Your village administrator will confirm who you are before the main administrator approves. Withdrawn, rejected and removed details are retained in an admin-only archive. Submit only your own details.",
        () =>
          this.mutate(
            "enrollment",
            { ...s.form, consent: true },
            "pending",
          ).then(() => this.state.myRequest && this.offerNotifications()),
        "તમારું નામ, ફોન નંબર, હાલનું સ્થળ અને ગામ ફક્ત મંજૂર થયેલા સભ્યો જોઈ શકશે. મુખ્ય એડમિનની મંજૂરી પહેલાં તમારા ગામના એડમિન તમારી ઓળખ ચકાસશે. રદ, નામંજૂર કે દૂર કરેલી માહિતી એડમિનના ખાનગી આર્કાઇવમાં રહેશે. ફક્ત તમારી પોતાની વિગતો મોકલો.",
        "વિનંતી મોકલો",
        "Submit request",
      );
    };
    const withdraw = v.askWithdraw;
    v.askWithdraw = () => {
      withdraw();
      this.setState((st) => ({
        confirm: {
          ...st.confirm,
          bodyGu: "રિક્વેસ્ટ કેન્સલ થશે. વિગતો ફક્ત એડમિનના આર્કાઇવમાં રહેશે.",
          bodyEn:
            "Your request leaves the queue. A copy is retained in an admin-only archive.",
          onYes: () => this.mutate("enrollment/withdraw", {}, "signup"),
        },
      }));
    };
    const removal = v.askRemoval;
    v.askRemoval = () => {
      removal();
      this.setState((st) => ({
        confirm: {
          ...st.confirm,
          onYes: () => this.mutate("profile/delete", {}, "profile"),
        },
      }));
    };
    v.sendUpdateRequest = () => {
      const p = s.edit || v.edit;
      if (Object.keys(this.errorsFor(p)).length) {
        this.flash(
          "વિગતો તપાસો.",
          "Enter a full name, valid phone numbers and a community village.",
        );
        return;
      }
      const me = s.members.find((m) => m.id === (s.adminEditingId || s.meId));
      const payload = {
        ...p,
        label2: p.label2 || me?.label2 || "work",
        nameGu: p.name === me?.name ? me.nameGu : p.name,
      };
      this.mutate(
        s.adminEditingId
          ? "admin/members/" + s.adminEditingId
          : "profile/update",
        payload,
        s.adminEditingId ? "admin" : "profile",
      );
    };
    const edit = v.goEditProfile;
    v.goEditProfile = () => {
      this.setState({ adminEditingId: null });
      edit();
      this.refresh();
      this.setState((st) => ({
        edit: {
          ...st.edit,
          currentLocation:
            s.members.find((m) => m.id === s.meId)?.currentLocation || "",
        },
      }));
    };
    v.goMyProfile = () => {
      if (s.meId) this.setState({ screen: "profile", adminEditingId: null });
    };
    v.goDirectory = () =>
      this.set("screen", s.adminEditingId ? "admin" : this.home());
    v.secretTap = () => {
      // The hidden gate belongs to the main administrator only; a signed-in
      // village administrator session must never reach it.
      if (this.state.villageAdmin) return;
      const now = Date.now();
      this._logoTaps = (this._logoTaps || []).filter((t) => now - t < 2500);
      this._logoTaps.push(now);
      if (this._logoTaps.length >= 5) {
        this._logoTaps = [];
        this.setState({ screen: "gate", gateInput: "", gateError: false });
      }
    };
    v.leaveGate = () =>
      this.setState({ screen: this.home(), gateInput: "", gateError: false });
    // ---- App lock (server-enforced four-digit PIN) ----
    v.isAppLock = s.screen === "applock";
    const settingUp = !!s.lockSetup;
    const confirming = settingUp && !!s.appLockFirst;
    v.lockTitleGu = settingUp
      ? confirming
        ? "પિન ફરી નાખો"
        : "નવો ચાર આંકડાનો પિન બનાવો"
      : "એપ લોક · પિન નાખો";
    v.lockTitleEn = settingUp
      ? confirming
        ? "Enter the same PIN again"
        : "Create a four-digit PIN"
      : "App lock · Enter PIN";
    v.lockHintGu = settingUp
      ? "સમાજના નંબર સુરક્ષિત રાખવા આ પિન દરેક વખતે એપ ખોલતાં પુછાશે. યાદ રહે તેવો પિન રાખો."
      : "";
    v.lockHintEn = settingUp
      ? "To keep community numbers safe, the app asks for this PIN every time it opens. Choose one you will remember."
      : "";
    v.showLockHint = settingUp;
    v.lockDots = [0, 1, 2, 3].map((i) => ({
      bg: (s.appLockInput || "").length > i ? "var(--ind)" : "var(--chip)",
    }));
    v.lockError = !!s.appLockError;
    v.lockErrorGu = s.appLockError ? errorText(s.appLockError, "gu") : "";
    v.lockErrorEn = s.appLockError ? errorText(s.appLockError, "en") : "";
    const lockWait = Math.max(
      0,
      Math.ceil(((s.lockWaitUntil || 0) - Date.now()) / 1000),
    );
    const waitText = (secs) =>
      secs >= 120
        ? this.P(
            Math.ceil(secs / 60) + " મિનિટ રાહ જુઓ, પછી ફરી પ્રયાસ કરો.",
            "Wait " + Math.ceil(secs / 60) + " minutes, then try again.",
          )
        : this.P(
            secs + " સેકન્ડ રાહ જુઓ, પછી ફરી પ્રયાસ કરો.",
            "Wait " + secs + " seconds, then try again.",
          );
    v.lockCooldown = s.lockFrozen
      ? this.P(
          "ઘણા ખોટા પ્રયાસો. 'પિન ભૂલી ગયા?' દબાવો.",
          "Too many wrong PINs. Tap 'Forgot PIN?'.",
        )
      : lockWait
        ? waitText(lockWait)
        : "";
    const submitPin = (code) =>
      this.run(async () => {
        try {
          if (!settingUp) {
            await this.api("lock/unlock", { pin: code });
            this._lastActivity = Date.now();
          } else if (!s.appLockFirst) {
            this.setState({ appLockFirst: code, appLockInput: "", appLockError: null });
            return;
          } else if (s.appLockFirst !== code) {
            this.setState({
              appLockFirst: "",
              appLockInput: "",
              appLockError: "બંને પિન એક જ નથી · The two PINs do not match. Start again.",
            });
            return;
          } else {
            await this.api("lock/setup", { pin: code });
            this._lastActivity = Date.now();
          }
          this.setState({ appLockInput: "", appLockFirst: "", appLockError: null });
          await this.refresh();
        } catch (e) {
          this.setState({
            appLockInput: "",
            appLockFirst: "",
            appLockError: e.message,
          });
          await this.refresh();
        }
      });
    v.lockKeyPad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "\u232b"].map(
      (k) => ({
        label: k,
        disabled: !k || (!settingUp && (!!lockWait || !!s.lockFrozen)),
        accessibleLabel:
          k === "\u232b"
            ? this.P("છેલ્લો આંકડો કાઢો", "Delete last digit")
            : k || this.P("ખાલી બટન", "Unused key"),
        onClick: () => {
          if (!k || this._busy) return;
          if (k === "\u232b") {
            this.setState({
              appLockInput: (this.state.appLockInput || "").slice(0, -1),
              appLockError: null,
            });
            return;
          }
          const code = ((this.state.appLockInput || "") + k).slice(0, 4);
          this.setState({ appLockInput: code, appLockError: null });
          if (code.length === 4) submitPin(code);
        },
      }),
    );
    v.showLockForgot = !settingUp;
    v.lockForgot = () => this.set("pinResetOpen", true);
    v.pinResetPanel = s.pinResetOpen
      ? React.createElement(PinResetPanel, {
          lang: s.lang,
          frozen: !!s.lockFrozen,
          onClose: () => this.set("pinResetOpen", false),
          onReset: async (code) => {
            await this.api("lock/reset", { code });
            this.setState({ pinResetOpen: false, appLockInput: "", appLockFirst: "" });
            await this.refresh();
          },
          onSignOut: () =>
            this.run(async () => {
              await this.api("logout", {});
              this.clearAccess();
            }),
        })
      : null;
    v.showPinSettings =
      s.role !== "admin" && (!!s.meId || !!s.villageAdmin) && s.locked === false;
    v.appLockPanel = v.showPinSettings
      ? React.createElement(PinSettings, {
          lang: s.lang,
          api: (path, body) => this.api(path, body),
        })
      : null;
    v.notificationPanel = React.createElement(NotificationSettings, {
      lang: s.lang,
      api: (path, body) => this.api(path, body),
    });
    v.exitAdmin = () => this.mutate("admin/logout");
    v.logout = v.exitAdmin;
    v.keypad = v.keypad.map((k) => ({
      ...k,
      disabled: !k.label,
      isBackspace: k.label === "⌫",
      accessibleLabel:
        k.label === "⌫"
          ? this.P("છેલ્લો આંકડો કાઢો", "Delete last digit")
          : k.label || "Unused key",
      onClick: () => {
        if (this._busy || !k.label) return;
        const code =
          k.label === "⌫"
            ? s.gateInput.slice(0, -1)
            : (s.gateInput + k.label).slice(0, 4);
        this.setState({ gateInput: code, gateError: false });
        if (code.length === 4)
          this.run(async () => {
            try {
              await this.api("admin/gate", { code });
              this.setState({ screen: "adminlogin", gateInput: "" });
            } catch (e) {
              this.setState({ gateInput: "", gateError: true });
              throw e;
            }
          });
      },
    }));
    v.loginErrorMessage = errorText(
      s.loginErrorMessage || "Unable to sign in.",
      "en",
    );
    v.loginErrorMessageGu = errorText(
      s.loginErrorMessage || "Unable to sign in.",
      "gu",
    );
    v.doLogin = () =>
      this.run(async () => {
        try {
          const data = await this.api("admin/login", {
            ...this.state.login,
            user: this.state.login.user.trim().toLowerCase(),
          });
          this.apply(data, false, "admin");
          this.setState({
            login: { user: "", pass: "" },
            loginError: false,
            // First sign-in issues the recovery code exactly once; the
            // overlay makes the administrator save it before anything else.
            recoveryNotice: data.recovery
              ? formatRecovery(data.recovery)
              : null,
          });
          if (!data.recovery) this.offerNotifications();
        } catch (e) {
          this.setState({ loginError: true, loginErrorMessage: e.message });
          throw e;
        }
      });
    v.goAdminForgot = () => {
      this.setState({
        screen: "adminforgot",
        resetError: null,
        resetDone: false,
      });
    };
    // Offline recovery code instead of SMS OTP: no per-message cost, no
    // phone-number dependency and far more entropy than a 6-digit code.
    v.resetRecovery = s.resetRecovery || "";
    v.resetPassword = s.resetPassword || "";
    v.setResetRecovery = (e) =>
      this.set(
        "resetRecovery",
        e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 19),
      );
    v.setResetPassword = (e) => this.set("resetPassword", e.target.value);
    v.resetCodeShown = !!s.resetCodeShown;
    v.resetPassShown = !!s.resetPassShown;
    v.resetCodeType = s.resetCodeShown ? "text" : "password";
    v.resetCodeIcon = s.resetCodeShown
      ? "ph-duotone ph-eye-slash"
      : "ph-duotone ph-eye";
    v.resetPassType = s.resetPassShown ? "text" : "password";
    v.resetPassIcon = s.resetPassShown
      ? "ph-duotone ph-eye-slash"
      : "ph-duotone ph-eye";
    v.toggleResetCode = () => this.set("resetCodeShown", !s.resetCodeShown);
    v.toggleResetPass = () => this.set("resetPassShown", !s.resetPassShown);
    v.resetCodeEyeLabel = this.L("કોડ બતાવો કે છુપાવો", "Show or hide the code");
    v.resetPassEyeLabel = this.L(
      "પાસવર્ડ બતાવો કે છુપાવો",
      "Show or hide the password",
    );
    const rpScore = pwStrength(s.resetPassword || ""),
      { labels: pwLabels, colors: pwColors } = v.pwPalette;
    v.resetPwWidth = (rpScore / 5) * 100 + "%";
    v.resetPwColor = pwColors[rpScore];
    v.resetPwLabel =
      pwLabels[rpScore] +
      " · " +
      this.L(
        "૧૦+ અક્ષર, નાના-મોટા, આંકડો, ચિહ્ન",
        "10+ chars, mixed case, number, symbol",
      );
    v.resetErrorGu = errorText(s.resetError || "", "gu");
    v.resetErrorEn = errorText(s.resetError || "", "en");
    v.resetDone = !!s.resetDone;
    v.newRecovery = formatRecovery(s.newRecovery || "");
    v.resetPasswordSubmit = () =>
      this.run(async () => {
        try {
          const r = await this.api("admin/recover", {
            recovery: s.resetRecovery,
            password: s.resetPassword,
          });
          this.setState({
            resetDone: true,
            newRecovery: r.recovery,
            resetRecovery: "",
            resetPassword: "",
            resetError: null,
          });
        } catch (e) {
          this.setState({ resetError: e.message });
          throw e;
        }
      });
    v.resetDoneNext = () =>
      this.setState({
        screen: "adminlogin",
        resetDone: false,
        newRecovery: "",
        loginError: false,
      });
    v.closeRecoveryNotice = () => this.set("recoveryNotice", null);
    v.recoveryNoticeLabel = this.L("રિકવરી કોડ", "Recovery code");
    v.regenerateRecovery = () =>
      this.confirmAction(
        "નવો રિકવરી કોડ બનાવો?",
        "Generate a new recovery code?",
        "The current code stops working immediately — save the new one somewhere safe.",
        async () => {
          const r = await this.api("admin/recovery/regenerate", {});
          this.setState({
            confirm: null,
            recoveryNotice: formatRecovery(r.recovery),
          });
        },
        "જૂનો કોડ તરત રદ થઈ જશે — નવો કોડ સુરક્ષિત જગ્યાએ સાચવી લેજો.",
      );
    for (const [key, approve] of [
      ["newRequests", "onApprove"],
      ["updateRequests", "onAuthorize"],
      ["deleteRequests", "onApprove"],
    ])
      v[key] = v[key].map((row, i) => ({
        ...row,
        [approve]: () => {
          // Village-stage requests must be verified and forwarded in the
          // review panel; already-verified requests are approved here.
          if (
            s.reviewQueue?.some((r) => r.id === s[key][i].id && !r.verification)
          ) {
            v.openWorkflow();
            return;
          }
          const approveRequest = () =>
            this.mutate("admin/requests/" + s[key][i].id + "/approve");
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
      onAdminEdit: () => {
        const m = s.members.find((x) => x.id === row.id);
        if (!m) return;
        this.setState({
          adminEditingId: m.id,
          edit: { ...m, name: s.lang === "gu" ? m.nameGu : m.name },
          screen: "editprofile",
        });
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
    v.sections = v.sections.map((section) => ({
      ...section,
      items: section.items.map((m) => ({
        ...m,
        currentLocation:
          s.members.find((row) => row.id === m.id)?.currentLocation || "",
        numbers: m.numbers.map((n) => {
          const links = contactLinks(
            n.phone,
            navigator.userAgent.includes("MVPMlAndroid"),
          );
          const contact = (kind, event) => {
            if (!links) {
              event?.preventDefault();
              this.flash("નંબર બરાબર નથી.", "This phone number is invalid.");
              return;
            }
            // Numbers are not copied to the clipboard: other apps could read them.
            this.setState({
              dial: {
                icon:
                  kind === "call"
                    ? "ph-duotone ph-phone-call"
                    : "ph-duotone ph-whatsapp-logo",
                name: s.lang === "gu" ? m.nameGu : m.name,
                nameGu: m.nameGu,
                nameEn: m.name,
                phone: links.number,
                href: links[kind],
                target: links.target,
                gu:
                  kind === "call"
                    ? "ડાયલર ખોલવાની વિનંતી મોકલી છે. ન ખૂલે તો ઉપરના નંબરને ટૅપ કરો અથવા ફોનમાં જાતે દાખલ કરો. કમ્પ્યુટર પર ફોન એપ જરૂરી છે; પ્રિવ્યૂમાં બહારની એપ અવરોધિત હોઈ શકે."
                    : "વોટ્સએપ ખોલવાની વિનંતી મોકલી છે. ન ખૂલે તો ઉપરના નંબરને ટૅપ કરો. પ્રિવ્યૂ અથવા પોપ-અપ અવરોધક અટકાવે તો એપને અલગ ટૅબમાં ખોલો.",
                en:
                  kind === "call"
                    ? "Requested your dialer. If nothing opens, tap the number above or enter it in your phone. A computer needs a calling app; an embedded preview may block external apps."
                    : "Requested WhatsApp. If nothing opens, tap the number above. If the preview or popup blocker prevents opening, open the directory in a separate tab. WhatsApp or WhatsApp Web must be available.",
              },
            });
          };
          return {
            ...n,
            callHref: links?.call,
            whatsHref: links?.whatsapp,
            externalTarget: links?.target,
            onContactKey: (event) => {
              if (event.key === " ") {
                event.preventDefault();
                event.currentTarget.click();
              }
            },
            onCall: (event) => contact("call", event),
            onWhats: (event) => contact("whatsapp", event),
          };
        }),
      })),
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
            nameGu: a.name,
            name: a.name,
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
            nameGu: a.name,
            name: a.name,
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
    v.villagesSelected = !v.hasQuery && s.dirMode !== "all";
    v.directoryHeading =
      v.hasQuery || !v.inVillageView || s.dirMode === "all"
        ? uiText("communityName", s.lang)
        : this.V(s.dirMode);
    v.allMembersSelected = s.dirMode === "all" && !s.query;
    v.chooseLight = () => this.set("theme", "light");
    v.chooseDark = () => this.set("theme", "dark");
    v.preferencesOpen = !!s.preferencesOpen;
    v.openPreferences = () => this.set("preferencesOpen", true);
    v.closePreferences = () => this.set("preferencesOpen", false);
    v.chooseGujarati = () => this.set("lang", "gu");
    v.chooseEnglish = () => this.set("lang", "en");
    v.guSelected = s.lang === "gu";
    v.enSelected = s.lang === "en";
    v.waitBodyGu =
      "ગામના એડમિનની ચકાસણી અને મુખ્ય એડમિનની મંજૂરી પછી યાદી ખુલશે. તમે એપ બંધ કરી શકો છો.";
    v.waitBodyEn =
      "Directory access opens after village verification and main-admin approval. You can close the app and return later.";
    v.submittedDate = s.requestAt
      ? new Date(s.requestAt).toLocaleString(
          s.lang === "gu" ? "gu-IN" : "en-IN",
          { dateStyle: "medium", timeStyle: "short" },
        )
      : "—";
    v.steps = v.steps.map((step, i) =>
      i === 1 ? { ...step, gu: "તપાસની રાહમાં", en: "Awaiting review" } : step,
    );
    v.memberHelp = () => {
      this.set("preferencesOpen", false);
      this.confirmAction(
        "પ્રવેશ માટે ફરી વિનંતી",
        "Apply again for access",
        "Access codes are no longer used. Submit your own details from the joining form. Your village administrator verifies you, then the main administrator approves access. A matching archived or active phone is reviewed, never automatically granted access.",
        () => this.set("confirm", null),
        "પ્રવેશ કોડ હવે વપરાતા નથી. જોડાવાના ફોર્મથી તમારી વિગતો મોકલો. ગામના એડમિનની ચકાસણી પછી મુખ્ય એડમિન મંજૂરી આપશે. જૂના નંબરનો મેળ હોય તો પણ આપમેળે પ્રવેશ મળતો નથી.",
        "સમજાયું",
        "Understood",
      );
    };
    v.reordering = !!s.reordering;
    v.reorderStatus = s.reorderStatus ? uiText("savedOrder", s.lang) : "";
    v.reorderLabel = uiText(s.reordering ? "done" : "reorder", s.lang);
    v.reorderActionLabel = v.reorderLabel;
    v.toggleReorder = () =>
      this.setState({ reordering: !s.reordering, reorderStatus: false });
    v.resetOrder = () =>
      this.setState({
        tileOrder: VILLAGE_LIST.map((v) => v.gu),
        reorderStatus: true,
      });
    v.villageTiles = v.villageTiles.map((row, index, list) => {
      const move = (delta) => {
        const order = (s.tileOrder || VILLAGE_LIST.map((v) => v.gu)).slice();
        const next = index + delta;
        if (next < 0 || next >= order.length) return;
        [order[index], order[next]] = [order[next], order[index]];
        this.setState({ tileOrder: order, reorderStatus: true });
      };
      return {
        ...row,
        first: index === 0,
        last: index === list.length - 1,
        earlierLabel: row.primary + " — " + uiText("earlier", s.lang),
        laterLabel: row.primary + " — " + uiText("later", s.lang),
        moveEarlier: () => move(-1),
        moveLater: () => move(1),
      };
    });
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
    for (const [key, value, choices] of [
      ["vSuggest", s.form.village, VILLAGES],
      ["tSuggest", s.form.tehsil, [[TEHSIL_EN, TEHSIL_GU]]],
    ]) {
      const match = bestMatch(value, choices);
      v[key] = match
        ? {
            msg: this.P(
              `શું તમે "${match.gu}" લખવા માંગતા હતા?`,
              `Did you mean "${match.en}"?`,
            ),
          }
        : null;
    }
    v.form = {
      ...v.form,
      village: this.V(s.form.village),
      tehsil: this.T(s.form.tehsil),
      district: this.D(s.form.district),
    };
    if (v.edit)
      v.edit = {
        ...v.edit,
        village: this.V(v.edit.village),
        tehsil: this.T(v.edit.tehsil),
        district: this.D(v.edit.district),
      };
    v.shortQuery = !!s.query.trim() && !canSearch(s.query);
    const location = s.screen === "editprofile" ? v.edit : v.form;
    const villageHint = VILLAGE_LIST.find(
      (x) =>
        x.gu === location?.village ||
        x.en.toLowerCase() === String(location?.village || "").toLowerCase(),
    );
    v.locationHints = {
      village: villageHint ? this.P(villageHint.gu, villageHint.en) : "",
      tehsil: this.P(TEHSIL_GU, TEHSIL_EN),
      district: this.P(DISTRICT_GU, DISTRICT_EN),
    };
    v.ph = {
      ...v.ph,
      tehsil: this.T(TEHSIL_GU),
      district: this.D(DISTRICT_GU),
    };
    if (primaryOnly) return v;
    // Read-only language facade: no state mutation, requests or alternate handlers.
    const alternate = Object.create(this);
    alternate.state = { ...s, lang: s.lang === "gu" ? "en" : "gu" };
    return bilingualView(v, alternate.renderVals(true), s.lang);
  }
}
