// The supplied design remains the renderer; all domain actions below go to the API.
class Component extends DesignComponent {
  componentDidMount() {
    this._alive = true;
    try {
      const p = JSON.parse(localStorage.getItem("mvpmi-preferences") || "{}");
      this.setState({
        lang: p.lang === "en" ? "en" : "gu",
        theme: p.theme === "dark" ? "dark" : "light",
        fsPct: Math.max(85, Math.min(165, Number(p.fsPct) || 100)),
        tileOrder:
          Array.isArray(p.tileOrder) &&
          p.tileOrder.length === 7 &&
          new Set(p.tileOrder).size === 7 &&
          p.tileOrder.every((g) => VILLAGE_LIST.some((v) => v.gu === g))
            ? p.tileOrder
            : null,
      });
    } catch {}
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
    this.refresh(true);
    this._clock = setInterval(() => this.forceUpdate(), 1000);
    this._poll = setInterval(() => {
      if (!document.hidden && !this._busy) this.refresh();
    }, 8000);
  }
  componentWillUnmount() {
    document.removeEventListener("keydown", this._onKey);
    delete window.mvpmiBack;
    this._alive = false;
    clearInterval(this._poll);
    super.componentWillUnmount();
  }
  handleBack() {
    if (this._busy) return true;
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
    if (s.screen === "directory" && (s.query || s.dirMode !== "tiles")) {
      this.setState({ query: "", dirMode: "tiles" });
      return true;
    }
    return false;
  }
  componentDidUpdate() {
    document.documentElement.lang = this.state.lang;
    const dialog = document.querySelector('.app [role="dialog"]');
    if (dialog && !this._dialog) {
      this._returnFocus = document.activeElement;
      this._dialog = dialog;
      (dialog.querySelector("button") || dialog).focus();
    } else if (!dialog && this._dialog) {
      this._dialog = null;
      if (this._returnFocus?.isConnected) this._returnFocus.focus();
    }
    try {
      localStorage.setItem(
        "mvpmi-preferences",
        JSON.stringify({
          lang: this.state.lang,
          theme: this.state.theme,
          fsPct: this.state.fsPct,
          tileOrder: this.state.tileOrder,
        }),
      );
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
  async request(path, body) {
    await this.ensureTransport();
    const headers = { "X-MVPMI-Client": "1" };
    if (this._transport) headers["X-MVPMI-Session"] = this._transport;
    if (body !== undefined) headers["Content-Type"] = "application/json";
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
        try {
          sessionStorage.removeItem("mvpmi-preview-session");
        } catch {}
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
    const current = this.state;
    const patch = { ...data, connected: true, loaded: true };
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
    this.setState(patch);
  }
  async refresh(initial = false) {
    try {
      this.apply(await this.api("state"), initial);
    } catch (e) {
      if (this._alive) {
        if (e.status === 403 || e.status === 401) {
          this.setState({
            ...clone(SEED),
            meId: null,
            myRequest: null,
            role: "guest",
            screen: "signup",
            confirm: null,
            dial: null,
            edit: null,
            connected: false,
            loaded: true,
          });
          this.flash("પ્રવેશ ઉપલબ્ધ નથી.", e.message);
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
      this.flash("કાર્ય પૂર્ણ ન થયું. ફરી પ્રયાસ કરો.", e.message);
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
  confirmAction(gu, en, body, onYes) {
    this.setState({
      confirm: {
        icon: "ph-duotone ph-shield-check",
        iconBg: "var(--okBg)",
        iconFg: "var(--ok)",
        yesBg: "var(--grad)",
        titleGu: gu,
        titleEn: en,
        bodyGu: "આગળ વધતા પહેલાં વિગતો ચકાસો.",
        bodyEn: body,
        yesGu: "હા, આગળ વધો",
        yesEn: "Confirm",
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
        );
      });
    input.click();
  }
  renderVals() {
    const v = super.renderVals(),
      s = this.state;
    v.loaded = !!s.loaded;
    v.busy = !!s.busy || !s.loaded;
    v.connectionError = s.connected === false;
    if (!s.loaded) v.isSignup = false;
    v.retry = () => this.refresh(true);
    v.development = !!s.development;
    v.passwordDue = !!s.passwordDue;
    v.editNoticeGu = s.adminEditingId
      ? "એડમિનનો ફેરફાર સીધો લાગુ થશે."
      : "એડમિન મંજૂરી આપશે પછી જ ફેરફાર યાદીમાં દેખાશે.";
    v.editNoticeEn = s.adminEditingId
      ? "Admin changes apply directly."
      : "Changes show in the directory only after the admin approves.";
    v.editSubmitGu = s.adminEditingId ? "ફેરફાર સાચવો" : "મંજૂરી માટે મોકલો";
    v.editSubmitEn = s.adminEditingId ? "Save changes" : "Send for approval";
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
        "Your name, numbers and village will be shared only with approved community members. Withdrawn, rejected and removed details are retained in an admin-only archive. Submit only your own details. In this development preview, phone ownership is not SMS-verified.",
        () =>
          this.mutate("enrollment", { ...s.form, consent: true }, "pending"),
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
    };
    v.goMyProfile = () => {
      if (s.meId) this.setState({ screen: "profile", adminEditingId: null });
    };
    v.goDirectory = () =>
      this.set("screen", s.adminEditingId ? "admin" : this.home());
    v.secretTap = () => {
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
    v.exitAdmin = () => this.mutate("admin/logout");
    v.logout = v.exitAdmin;
    v.keypad = v.keypad.map((k) => ({
      ...k,
      disabled: !k.label,
      accessibleLabel:
        k.label === "⌫"
          ? "છેલ્લો આંકડો કાઢો · Delete last digit"
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
    v.loginErrorMessage = s.loginErrorMessage || "Unable to sign in.";
    v.doLogin = () =>
      this.run(async () => {
        try {
          const data = await this.api("admin/login", {
            ...this.state.login,
            user: this.state.login.user.trim().toLowerCase(),
          });
          this.apply(data, false, "admin");
          this.setState({ login: { user: "", pass: "" }, loginError: false });
        } catch (e) {
          this.setState({ loginError: true, loginErrorMessage: e.message });
          throw e;
        }
      });
    v.goAdminForgot = () => {
      this.set("screen", "adminforgot");
    };
    v.resetPhone = s.resetPhone
      ? "••••••" + s.resetPhone
      : "Registered admin phone";
    v.resetOtp = s.resetOtp || "";
    v.resetPassword = s.resetPassword || "";
    v.setResetOtp = (e) => this.set("resetOtp", dg(e.target.value).slice(0, 6));
    v.setResetPassword = (e) => this.set("resetPassword", e.target.value);
    v.sendReset = () =>
      this.run(async () => {
        if (s.resendAt > Date.now())
          throw new Error("Please wait before resending");
        const r = await this.api("admin/reset/send", {});
        this.setState({ resetPhone: r.phone, resendAt: Date.now() + 60000 });
        this.flash("કોડ મોકલ્યો.", "Code sent to the registered admin phone.");
      });
    v.resendLabel =
      s.resendAt > Date.now()
        ? this.L(
            "ફરી મોકલવા રાહ જુઓ",
            `Resend in ${Math.ceil((s.resendAt - Date.now()) / 1000)}s`,
          )
        : this.L("કોડ મોકલો / ફરી મોકલો", "Send / resend code");
    v.resetPasswordSubmit = () =>
      this.run(async () => {
        await this.api("admin/reset", {
          otp: s.resetOtp,
          password: s.resetPassword,
        });
        this.setState({
          screen: "adminlogin",
          resetOtp: "",
          resetPassword: "",
        });
        this.flash("પાસવર્ડ બદલાયો.", "Password changed. Sign in again.");
      });
    for (const [key, approve] of [
      ["newRequests", "onApprove"],
      ["updateRequests", "onAuthorize"],
      ["deleteRequests", "onApprove"],
    ])
      v[key] = v[key].map((row, i) => ({
        ...row,
        [approve]: () =>
          this.mutate("admin/requests/" + s[key][i].id + "/approve"),
        onReject: () =>
          this.mutate("admin/requests/" + s[key][i].id + "/reject"),
      }));
    v.updateRequests = v.updateRequests.map((row, i) => {
      const r = s.updateRequests[i],
        keys = Object.keys(r.next).filter((k) => r.next[k] !== r.old[k]);
      return {
        ...row,
        oldRows: keys.map((k) => k + ": " + (r.old[k] || "—")),
        newRows: keys.map((k) => k + ": " + (r.next[k] || "—")),
      };
    });
    v.members = v.members.map((row, i) => ({
      ...row,
      onAdminEdit: () => {
        const m = s.members[i];
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
        ),
    }));
    v.alerts = v.alerts.map((row, i) => ({
      ...row,
      title: row.title + (s.alerts[i].blocked ? " · Blocked" : ""),
      onBlock: () => this.mutate("admin/alerts/" + s.alerts[i].id + "/block"),
    }));
    v.sections = v.sections.map((section) => ({
      ...section,
      items: section.items.map((m) => ({
        ...m,
        numbers: m.numbers.map((n) => ({
          ...n,
          onCall: () => {
            const number = "+91" + dg(n.phone);
            navigator.clipboard?.writeText(number).catch(() => {});
            window.location.href = "tel:" + number;
          },
          onWhats: () => {
            const url = "https://wa.me/91" + dg(n.phone);
            if (navigator.userAgent.includes("MVPMlAndroid"))
              window.location.href = url;
            else window.open(url, "_blank", "noopener,noreferrer");
          },
        })),
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
              const escape = (x) =>
                String(x || "").replace(
                  /[&<>"']/g,
                  (c) =>
                    ({
                      "&": "&amp;",
                      "<": "&lt;",
                      ">": "&gt;",
                      '"': "&quot;",
                      "'": "&#39;",
                    })[c],
                );
              this.printPdf(
                data.members.map((m) =>
                  Object.fromEntries(
                    Object.entries(m).map(([k, val]) => [k, escape(val)]),
                  ),
                ),
              );
            });
          }),
        () => this.file("export.xlsx", "mvpmi-contacts.xlsx"),
        () => this.file("export.xlsx", "mvpmi-contacts.xlsx", true),
        () => this.file("backup", "mvpmi-backup.json"),
      ][i],
    }));
    v.restoreData = () => this.restore();
    return v;
  }
}
