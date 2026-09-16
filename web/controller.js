// The supplied design remains the renderer; all domain actions below go to the API.
class Component extends DesignComponent {
  L(gu, en) {
    return this.P(gu, en);
  }
  O(value) {
    return singleLanguageStatus(value, this.state.lang);
  }
  printPdf(members) {
    const frame = document.createElement("iframe");
    frame.title = this.P("પ્રિન્ટ પૂર્વદર્શન", "Print preview");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0";
    frame.onload = async () => {
      try {
        await frame.contentDocument.fonts.ready;
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        this.flash(
          "પ્રિન્ટ ઉપલબ્ધ નથી.",
          "Printing is unavailable in this browser.",
        );
      }
      setTimeout(() => frame.remove(), 60000);
    };
    document.body.appendChild(frame);
    frame.srcdoc = printDocument(
      members.map((m) => ({
        ...m,
        village: this.V(m.village),
        tehsil: this.T(m.tehsil),
        district: this.D(m.district),
      })),
      this.state.lang,
    );
  }
  componentDidMount() {
    this._alive = true;
    try {
      const p = JSON.parse(localStorage.getItem("mvpmi-preferences") || "{}");
      this.setState({
        lang: p.lang === "en" ? "en" : "gu",
        theme: p.theme === "dark" ? "dark" : "light",
        fsPct: normalizeTextSize(p.fsPct),
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
    if (s.screen === "directory" && (s.query || s.dirMode !== "tiles")) {
      this.setState({ query: "", dirMode: "tiles" });
      return true;
    }
    return false;
  }
  componentDidUpdate() {
    document.documentElement.lang = this.state.lang;
    document.title = this.P(
      "MVPMl · સમાજ સંપર્ક યાદી",
      "MVPMl · Community Directory",
    );
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
      const preferences = JSON.stringify({
        lang: this.state.lang,
        theme: this.state.theme,
        fsPct: this.state.fsPct,
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
        "તમારું નામ, ફોન નંબર અને ગામ ફક્ત મંજૂર થયેલા સભ્યો જોઈ શકશે. રદ, નામંજૂર કે દૂર કરેલી માહિતી એડમિનના ખાનગી આર્કાઇવમાં રહેશે. ફક્ત તમારી પોતાની વિગતો મોકલો. આ પરીક્ષણ આવૃત્તિમાં ફોનની માલિકી SMS દ્વારા ચકાસાતી નથી.",
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
      : uiText("adminPhone", s.lang);
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
        [approve]: () => {
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
        onReject: () =>
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
          ),
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
            // Clipboard access can be denied or throw synchronously in embedded browsers.
            // It must never prevent the link's default action.
            if (kind === "call") {
              try {
                Promise.resolve(
                  navigator.clipboard?.writeText(links.number),
                ).catch(() => {});
              } catch {}
            }
            this.setState({
              dial: {
                icon:
                  kind === "call"
                    ? "ph-duotone ph-phone-call"
                    : "ph-duotone ph-whatsapp-logo",
                name: s.lang === "gu" ? m.nameGu : m.name,
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
          this.file("export.xlsx?lang=" + s.lang, "mvpmi-contacts.xlsx", true),
        () => this.file("backup", "mvpmi-backup.json"),
      ][i],
    }));
    v.restoreData = () => this.restore();
    v.textSizes = TEXT_SIZES.map((option) => ({
      ...option,
      active: s.fsPct === option.value,
      accessibleLabel: this.P(option.gu, option.label),
      onClick: () => {
        this.setState({ fsPct: option.value });
        requestAnimationFrame(() =>
          document
            .querySelector(".text-size-options")
            ?.scrollIntoView({ block: "nearest", inline: "nearest" }),
        );
      },
    }));
    v.ui = Object.fromEntries(
      Object.keys(UI_COPY).map((key) => [key, uiText(key, s.lang)]),
    );
    v.screenName = s.screen;
    v.aes = false;
    v.aesAttr = "off";
    v.languageSwitch = this.P("English", "ગુજરાતી");
    v.themeLabel = this.P(
      s.theme === "dark" ? "આછો દેખાવ" : "ઘેરો દેખાવ",
      s.theme === "dark" ? "Light" : "Dark",
    );
    v.preferencesOpen = !!s.preferencesOpen;
    v.openPreferences = () => this.set("preferencesOpen", true);
    v.closePreferences = () => this.set("preferencesOpen", false);
    v.chooseGujarati = () => this.set("lang", "gu");
    v.chooseEnglish = () => this.set("lang", "en");
    v.guSelected = s.lang === "gu";
    v.enSelected = s.lang === "en";
    v.waitBodyGu = UI_COPY.waitBody[0];
    v.waitBodyEn = UI_COPY.waitBody[1];
    v.submittedDate = s.requestAt
      ? new Date(s.requestAt).toLocaleString(
          s.lang === "gu" ? "gu-IN" : "en-IN",
          { dateStyle: "medium", timeStyle: "short" },
        )
      : "—";
    v.steps = v.steps.map((step, i) =>
      i === 1 ? { ...step, gu: "તપાસની રાહમાં", en: "Awaiting review" } : step,
    );
    v.memberHelp = () =>
      this.confirmAction(
        UI_COPY.help[0],
        UI_COPY.help[1],
        UI_COPY.helpBody[1],
        () => this.set("confirm", null),
        UI_COPY.helpBody[0],
        UI_COPY.helpAction[0],
        UI_COPY.helpAction[1],
      );
    v.reordering = !!s.reordering;
    v.reorderStatus = s.reorderStatus ? uiText("savedOrder", s.lang) : "";
    v.reorderLabel = uiText(s.reordering ? "done" : "reorder", s.lang);
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
    v.form = {
      ...v.form,
      tehsil: this.T(s.form.tehsil),
      district: this.D(s.form.district),
    };
    if (v.edit)
      v.edit = {
        ...v.edit,
        tehsil: this.T(v.edit.tehsil),
        district: this.D(v.edit.district),
      };
    v.shortQuery = !!s.query.trim() && !canSearch(s.query);
    v.ph = {
      ...v.ph,
      tehsil: this.T(TEHSIL_GU),
      district: this.D(DISTRICT_GU),
    };
    return v;
  }
}
