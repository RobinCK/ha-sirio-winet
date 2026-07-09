/*
 * Sirio Pump Card — bundled Lovelace card for the Sirio Pump Inverter (WiNET)
 * Home Assistant integration. Served and registered automatically by the
 * integration itself; no manual resource configuration is required.
 *
 * https://github.com/RobinCK/ha-sirio-winet
 */
(() => {
  const CARD_TAG = "sirio-pump-card";
  const EDITOR_TAG = "sirio-pump-card-editor";
  const CARD_VERSION = "0.2.2";

  if (customElements.get(CARD_TAG)) {
    return;
  }

  // ---------------------------------------------------------------- i18n ---
  const STRINGS = {
    en: {
      pump: "Pump",
      running: "Running",
      idle: "Idle",
      standby: "Standby",
      error: "Error",
      offline: "Offline",
      target: "Setpoint",
      error_code: "Error code",
      current: "Current",
      voltage: "Voltage",
      frequency: "Frequency",
      temperature: "Temperature",
      runtime: "Runtime",
      starts: "Starts",
      wifi: "Wi-Fi",
      hours: "h",
      turn_on: "Turn pump on",
      turn_off: "Turn pump off",
      not_configured: "Select a Sirio pump to display",
      no_device: "Pump device not found. Check the card configuration.",
      device: "Pump (device)",
      name: "Name (optional)",
      name_helper: "Overrides the device name shown in the header",
    },
    uk: {
      pump: "Насос",
      running: "Працює",
      idle: "Очікує",
      standby: "Вимкнено",
      error: "Помилка",
      offline: "Не в мережі",
      target: "Задана межа",
      error_code: "Код помилки",
      current: "Струм",
      voltage: "Напруга",
      frequency: "Частота",
      temperature: "Температура",
      runtime: "Напрацювання",
      starts: "Пусків",
      wifi: "Wi-Fi",
      hours: "год",
      turn_on: "Увімкнути насос",
      turn_off: "Вимкнути насос",
      not_configured: "Оберіть насос Sirio для відображення",
      no_device: "Пристрій насоса не знайдено. Перевірте налаштування картки.",
      device: "Насос (пристрій)",
      name: "Назва (необовʼязково)",
      name_helper: "Замінює назву пристрою в заголовку картки",
    },
  };

  const localize = (hass, key) => {
    const lang = (hass?.locale?.language || hass?.language || "en")
      .split("-")[0]
      .toLowerCase();
    return (STRINGS[lang] || STRINGS.en)[key] || STRINGS.en[key] || key;
  };

  // ------------------------------------------------------------- helpers ---
  const fireEvent = (node, type, detail) => {
    node.dispatchEvent(
      new CustomEvent(type, { detail, bubbles: true, composed: true })
    );
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  // Angle in degrees, clockwise, 0 = 12 o'clock.
  const polar = (cx, cy, r, deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };

  const arcPath = (cx, cy, r, startDeg, endDeg) => {
    const [sx, sy] = polar(cx, cy, r, startDeg);
    const [ex, ey] = polar(cx, cy, r, endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  };

  // Gauge geometry.
  const CX = 100;
  const CY = 88;
  const R = 72;
  const A0 = -120;
  const A1 = 120;
  const ARC_LEN = 2 * Math.PI * R * ((A1 - A0) / 360);
  const ARC_D = arcPath(CX, CY, R, A0, A1);

  const TILES = [
    { role: "current", icon: "mdi:current-ac", label: "current", prec: 1, color: "#f59f00" },
    { role: "voltage", icon: "mdi:lightning-bolt", label: "voltage", prec: 0, color: "#7c4dff" },
    { role: "frequency", icon: "mdi:sine-wave", label: "frequency", prec: 0, color: "#00acc1" },
    { role: "temperature", icon: "mdi:thermometer", label: "temperature", prec: 0, color: "#ff5722" },
  ];

  const CHIPS = [
    { role: "runtime", icon: "mdi:timer-play-outline", label: "runtime", prec: 0 },
    { role: "starts", icon: "mdi:counter", label: "starts", prec: 0 },
    { role: "rssi", icon: "mdi:wifi", label: "wifi", prec: 0 },
  ];

  const CARD_CSS = `
    :host {
      --spc-running: var(--success-color, #43a047);
      --spc-idle: var(--info-color, #039be5);
      --spc-standby: var(--secondary-text-color, #727272);
      --spc-error: var(--error-color, #db4437);
      --spc-offline: var(--disabled-text-color, #9e9e9e);
      --spc-status: var(--spc-idle);
      --spc-soft: rgba(127, 127, 127, 0.1);
      display: block;
    }
    :host([data-status="running"]) { --spc-status: var(--spc-running); }
    :host([data-status="standby"]) { --spc-status: var(--spc-standby); }
    :host([data-status="error"])   { --spc-status: var(--spc-error); }
    :host([data-status="offline"]) { --spc-status: var(--spc-offline); }

    ha-card {
      display: flex;
      flex-direction: column;
      padding: 16px 16px 14px;
      overflow: hidden;
    }
    button {
      font: inherit;
      color: inherit;
      background: none;
      border: none;
      margin: 0;
      padding: 0;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    button:focus-visible,
    [role="button"]:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
      border-radius: 12px;
    }

    /* ------------------------------------------------------------ header */
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .ident {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      padding: 4px;
      margin: -4px;
      border-radius: 14px;
      text-align: left;
      transition: background 0.2s ease;
    }
    .ident:hover { background: var(--spc-soft); }
    .pump-ico {
      position: relative;
      flex: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--spc-status);
      background: var(--spc-soft);
      background: color-mix(in srgb, var(--spc-status) 14%, transparent);
      transition: color 0.3s ease, background 0.3s ease;
    }
    .pump-ico ha-icon { --mdc-icon-size: 24px; }
    :host([data-status="running"]) .pump-ico::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid var(--spc-running);
      animation: spc-ripple 2s ease-out infinite;
    }
    @keyframes spc-ripple {
      from { transform: scale(1); opacity: 0.5; }
      to   { transform: scale(1.55); opacity: 0; }
    }
    .titles { min-width: 0; }
    .name {
      font-size: 15px;
      font-weight: 600;
      line-height: 1.25;
      color: var(--primary-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 3px;
      padding: 2px 9px 2px 7px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.2px;
      color: var(--spc-status);
      background: var(--spc-soft);
      background: color-mix(in srgb, var(--spc-status) 13%, transparent);
      transition: color 0.3s ease, background 0.3s ease;
    }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }
    :host([data-status="running"]) .dot { animation: spc-pulse 1.6s ease-in-out infinite; }
    @keyframes spc-pulse {
      0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 45%, transparent); }
      50%      { box-shadow: 0 0 0 4px transparent; }
    }

    .power {
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--secondary-text-color);
      background: var(--spc-soft);
      transition: background 0.25s ease, color 0.25s ease, transform 0.1s ease, box-shadow 0.25s ease;
    }
    .power ha-icon { --mdc-icon-size: 24px; }
    .power.on {
      color: var(--text-primary-color, #fff);
      background: var(--primary-color);
      box-shadow: 0 3px 10px rgba(33, 150, 243, 0.3);
      box-shadow: 0 3px 10px color-mix(in srgb, var(--primary-color) 35%, transparent);
    }
    .power:active { transform: scale(0.9); }
    .power[disabled] { opacity: 0.4; pointer-events: none; }
    .power.pending ha-icon { display: none; }
    .power.pending::after {
      content: "";
      width: 20px;
      height: 20px;
      border: 2.5px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spc-spin 0.9s linear infinite;
    }
    @keyframes spc-spin { to { transform: rotate(360deg); } }

    /* ------------------------------------------------------------- gauge */
    .gaugewrap {
      position: relative;
      width: min(100%, 250px);
      margin: 10px auto 0;
      border-radius: 18px;
      cursor: pointer;
      container-type: inline-size;
    }
    .gauge { display: block; width: 100%; }
    .gauge .track {
      fill: none;
      stroke: var(--divider-color, rgba(127, 127, 127, 0.25));
      stroke-width: 14;
      stroke-linecap: round;
      opacity: 0.6;
    }
    .gauge .ticks line {
      stroke: var(--divider-color, rgba(127, 127, 127, 0.4));
      stroke-width: 1.5;
    }
    .gauge .val {
      fill: none;
      stroke: url(#spcGrad);
      stroke-width: 14;
      stroke-linecap: round;
      stroke-dasharray: ${ARC_LEN.toFixed(2)};
      transition: stroke-dashoffset 0.7s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .g1 { stop-color: var(--info-color, #03a9f4); }
    .g2 { stop-color: var(--primary-color, #2196f3); }
    :host([data-status="error"]) .g1,
    :host([data-status="error"]) .g2 { stop-color: var(--spc-error); }
    :host([data-status="standby"]) .g1,
    :host([data-status="standby"]) .g2,
    :host([data-status="offline"]) .g1,
    :host([data-status="offline"]) .g2 { stop-color: var(--spc-offline); }
    .gauge .flow {
      fill: none;
      stroke: rgba(255, 255, 255, 0.45);
      stroke-width: 5;
      stroke-linecap: round;
      stroke-dasharray: 3 9;
      stroke-dashoffset: ${ARC_LEN.toFixed(2)};
      display: none;
    }
    :host([data-status="running"]) .gauge .flow {
      display: block;
      animation: spc-flow 1.5s linear infinite;
    }
    @keyframes spc-flow { to { stroke-dashoffset: ${(ARC_LEN - 48).toFixed(2)}; } }
    .gauge .mline {
      stroke: var(--accent-color, #ff9800);
      stroke-width: 3;
      stroke-linecap: round;
    }

    .reading {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding-top: 10%;
      pointer-events: none;
    }
    .valrow { display: flex; align-items: baseline; gap: 5px; }
    .bigval {
      font-size: 34px;
      font-size: clamp(24px, 16cqi, 38px);
      font-weight: 700;
      letter-spacing: -0.5px;
      line-height: 1;
      color: var(--primary-text-color);
      font-variant-numeric: tabular-nums;
    }
    :host([data-status="offline"]) .bigval { color: var(--secondary-text-color); }
    .unit {
      font-size: 14px;
      font-weight: 500;
      color: var(--secondary-text-color);
    }
    .target {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 7px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 500;
      color: var(--secondary-text-color);
      background: var(--spc-soft);
      transition: background 0.2s ease, transform 0.12s ease;
    }
    .target:hover { background: color-mix(in srgb, var(--accent-color, #ff9800) 14%, transparent); }
    .target:active { transform: scale(0.95); }
    .target ha-icon {
      --mdc-icon-size: 14px;
      color: var(--accent-color, #ff9800);
    }
    .scale {
      position: absolute;
      bottom: 2px;
      font-size: 11px;
      color: var(--secondary-text-color);
      font-variant-numeric: tabular-nums;
      pointer-events: none;
    }
    .s0 { left: 13%; }
    .s1 { right: 13%; }

    /* ------------------------------------------------------------- alert */
    .alert {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 500;
      color: var(--spc-error);
      background: rgba(219, 68, 55, 0.12);
      background: color-mix(in srgb, var(--spc-error) 12%, transparent);
      cursor: pointer;
      text-align: left;
      width: 100%;
    }
    .alert ha-icon { --mdc-icon-size: 20px; flex: none; }
    .alert .chev { margin-left: auto; opacity: 0.7; }
    .alert[hidden] { display: none; }

    /* ------------------------------------------------------------- tiles */
    .tiles {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      gap: 6px;
      margin-top: 14px;
    }
    .tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      min-width: 0;
      padding: 8px 4px 7px;
      border-radius: 14px;
      background: var(--spc-soft);
      background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
      transition: transform 0.12s ease, background 0.2s ease;
    }
    .tile:hover { background: color-mix(in srgb, var(--primary-text-color) 9%, transparent); }
    .tile:active { transform: scale(0.95); }
    .tile[hidden] { display: none; }
    .tico {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--tc, var(--primary-color));
      background: rgba(127, 127, 127, 0.12);
      background: color-mix(in srgb, var(--tc, var(--primary-color)) 14%, transparent);
    }
    .tico ha-icon { --mdc-icon-size: 15px; }
    .tv {
      font-size: 13px;
      font-weight: 600;
      color: var(--primary-text-color);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tv .u {
      font-size: 10px;
      font-weight: 500;
      color: var(--secondary-text-color);
      margin-left: 2px;
    }
    .tl {
      font-size: 10px;
      color: var(--secondary-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    /* ------------------------------------------------------------- chips */
    .chips {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin-top: 12px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 11px;
      border-radius: 999px;
      font-size: 12px;
      color: var(--secondary-text-color);
      background: var(--spc-soft);
      background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
      transition: transform 0.12s ease, background 0.2s ease;
      font-variant-numeric: tabular-nums;
    }
    .chip:hover { background: color-mix(in srgb, var(--primary-text-color) 9%, transparent); }
    .chip:active { transform: scale(0.95); }
    .chip[hidden] { display: none; }
    .chip ha-icon { --mdc-icon-size: 15px; }
    .chip b { font-weight: 600; color: var(--primary-text-color); }

    /* ------------------------------------------------------- placeholder */
    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 28px 16px;
      text-align: center;
      color: var(--secondary-text-color);
      font-size: 14px;
    }
    .placeholder ha-icon { --mdc-icon-size: 42px; opacity: 0.6; }
    .placeholder[hidden] { display: none; }
    [hidden] { display: none; }

    @media (prefers-reduced-motion: reduce) {
      .gauge .val { transition: none; }
      :host([data-status="running"]) .gauge .flow,
      :host([data-status="running"]) .pump-ico::after,
      :host([data-status="running"]) .dot { animation: none; }
    }
  `;

  // ---------------------------------------------------------------- card ---
  class SirioPumpCard extends HTMLElement {
    static getConfigElement() {
      return document.createElement(EDITOR_TAG);
    }

    static getStubConfig(hass) {
      const reg = Object.values(hass?.entities || {}).find(
        (e) => e.platform === "sirio" && e.device_id
      );
      return reg ? { device: reg.device_id } : {};
    }

    setConfig(config) {
      this._config = { ...config };
      this._roles = null;
      this._regRef = null;
      this._sig = null;
      if (this._hass) {
        this._update();
      }
    }

    set hass(hass) {
      this._hass = hass;
      this._update();
    }

    getCardSize() {
      return 6;
    }

    getGridOptions() {
      return { columns: 6, rows: "auto", min_columns: 4 };
    }

    connectedCallback() {
      if (this._hass && this._config) {
        this._sig = null;
        this._update();
      }
    }

    disconnectedCallback() {
      clearTimeout(this._pendingTimer);
    }

    // ------------------------------------------------------------- build --
    _build() {
      const root = this.attachShadow({ mode: "open" });
      const tiles = TILES.map(
        (t) => `
          <button class="tile" data-role="${t.role}" style="--tc:${t.color}" hidden>
            <span class="tico"><ha-icon icon="${t.icon}"></ha-icon></span>
            <span class="tv"><span class="n">—</span><span class="u"></span></span>
            <span class="tl"></span>
          </button>`
      ).join("");
      const chips = CHIPS.map(
        (c) => `
          <button class="chip" data-role="${c.role}" hidden>
            <ha-icon icon="${c.icon}"></ha-icon><b class="n"></b><span class="u"></span>
          </button>`
      ).join("");

      root.innerHTML = `
        <style>${CARD_CSS}</style>
        <ha-card>
          <div class="content" hidden>
            <div class="head">
              <button class="ident">
                <span class="pump-ico"><ha-icon icon="mdi:water-pump"></ha-icon></span>
                <span class="titles">
                  <span class="name"></span>
                  <span class="pill"><span class="dot"></span><span class="stxt"></span></span>
                </span>
              </button>
              <button class="power"><ha-icon icon="mdi:power"></ha-icon></button>
            </div>
            <div class="gaugewrap" role="button" tabindex="0">
              <svg class="gauge" viewBox="0 0 200 146" aria-hidden="true">
                <defs>
                  <linearGradient id="spcGrad" x1="0%" y1="100%" x2="100%" y2="100%">
                    <stop offset="0%" class="g1"></stop>
                    <stop offset="100%" class="g2"></stop>
                  </linearGradient>
                </defs>
                <path class="track" d="${ARC_D}"></path>
                <g class="ticks"></g>
                <path class="val" d="${ARC_D}" style="stroke-dashoffset:${ARC_LEN.toFixed(2)}"></path>
                <path class="flow" d="${ARC_D}"></path>
                <g class="marker"></g>
              </svg>
              <div class="reading">
                <div class="valrow">
                  <span class="bigval">—</span><span class="unit"></span>
                </div>
                <button class="target" hidden>
                  <ha-icon icon="mdi:bullseye-arrow"></ha-icon><span class="tval"></span>
                </button>
              </div>
              <span class="scale s0">0</span>
              <span class="scale s1"></span>
            </div>
            <button class="alert" hidden>
              <ha-icon icon="mdi:alert-circle"></ha-icon>
              <span class="atext"></span>
              <ha-icon class="chev" icon="mdi:chevron-right"></ha-icon>
            </button>
            <div class="tiles">${tiles}</div>
            <div class="chips">${chips}</div>
          </div>
          <div class="placeholder" hidden>
            <ha-icon icon="mdi:water-pump"></ha-icon>
            <span class="ptext"></span>
          </div>
        </ha-card>`;

      this._el = {
        content: root.querySelector(".content"),
        placeholder: root.querySelector(".placeholder"),
        ptext: root.querySelector(".ptext"),
        ident: root.querySelector(".ident"),
        name: root.querySelector(".name"),
        stxt: root.querySelector(".stxt"),
        power: root.querySelector(".power"),
        gaugewrap: root.querySelector(".gaugewrap"),
        val: root.querySelector(".val"),
        ticks: root.querySelector(".ticks"),
        marker: root.querySelector(".marker"),
        bigval: root.querySelector(".bigval"),
        unit: root.querySelector(".unit"),
        target: root.querySelector(".target"),
        tval: root.querySelector(".tval"),
        s1: root.querySelector(".s1"),
        alert: root.querySelector(".alert"),
        atext: root.querySelector(".atext"),
        tiles: [...root.querySelectorAll(".tile")],
        chips: [...root.querySelectorAll(".chip")],
      };

      this._el.ident.addEventListener("click", () =>
        this._moreInfo(this._roles?.power || this._roles?.pressure)
      );
      this._el.power.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._togglePump();
      });
      this._el.gaugewrap.addEventListener("click", () =>
        this._moreInfo(this._roles?.pressure)
      );
      this._el.gaugewrap.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          this._moreInfo(this._roles?.pressure);
        }
      });
      this._el.target.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._moreInfo(this._roles?.setpoint);
      });
      this._el.alert.addEventListener("click", () =>
        this._moreInfo(this._roles?.problem || this._roles?.errorCode)
      );
      [...this._el.tiles, ...this._el.chips].forEach((btn) => {
        btn.addEventListener("click", () => this._moreInfo(btn.dataset.entity));
      });
    }

    // ----------------------------------------------------------- resolve --
    _deviceId() {
      const cfg = this._config || {};
      if (cfg.device) {
        return cfg.device;
      }
      if (cfg.entity) {
        return this._hass?.entities?.[cfg.entity]?.device_id || null;
      }
      return null;
    }

    _resolveRoles() {
      const deviceId = this._deviceId();
      if (!deviceId) {
        return null;
      }
      const roles = { deviceId };
      for (const reg of Object.values(this._hass.entities || {})) {
        if (reg.device_id !== deviceId) {
          continue;
        }
        const id = reg.entity_id;
        const st = this._hass.states[id];
        if (!st) {
          continue;
        }
        const domain = id.split(".")[0];
        const a = st.attributes || {};
        const diag = reg.entity_category === "diagnostic";
        if (domain === "switch") {
          roles.power = id;
        } else if (domain === "binary_sensor") {
          if (a.device_class === "running") roles.running = id;
          else if (a.device_class === "problem") roles.problem = id;
          else roles.standby = id;
        } else if (domain === "sensor") {
          const dc = a.device_class;
          if (dc === "pressure") {
            if (a.state_class === "measurement") roles.pressure = id;
            else roles.setpoint = id;
          } else if (dc === "current") roles.current = id;
          else if (dc === "voltage") roles.voltage = id;
          else if (dc === "frequency") roles.frequency = id;
          else if (dc === "temperature") {
            if (diag) roles.igbt = id;
            else roles.temperature = id;
          } else if (dc === "signal_strength") roles.rssi = id;
          else if (a.unit_of_measurement === "h") {
            if (diag) roles.powerOnHours = id;
            else roles.runtime = id;
          } else if (!dc && !a.unit_of_measurement) {
            if (diag) roles.errorCode = id;
            else roles.starts = id;
          }
        }
      }
      return roles;
    }

    // ------------------------------------------------------------ format --
    _t(key) {
      return localize(this._hass, key);
    }

    _locale() {
      return this._hass?.locale?.language || "en";
    }

    _num(entityId, defaultPrecision) {
      const st = entityId ? this._hass.states[entityId] : undefined;
      if (!st || st.state === "unavailable" || st.state === "unknown") {
        return null;
      }
      const value = Number(st.state);
      if (Number.isNaN(value)) {
        return null;
      }
      const prec =
        this._hass.entities?.[entityId]?.display_precision ?? defaultPrecision;
      let unit = st.attributes.unit_of_measurement || "";
      if (unit === "h") {
        unit = this._t("hours");
      }
      return {
        value,
        text: new Intl.NumberFormat(this._locale(), {
          minimumFractionDigits: prec,
          maximumFractionDigits: prec,
        }).format(value),
        unit,
      };
    }

    // ------------------------------------------------------------ update --
    _update() {
      if (!this._hass || !this._config) {
        return;
      }
      if (!this._el) {
        this._build();
      }
      if (!this._roles || this._regRef !== this._hass.entities) {
        this._roles = this._resolveRoles();
        this._regRef = this._hass.entities;
        this._sig = null;
      }
      const roles = this._roles;

      if (!roles || (!roles.power && !roles.pressure)) {
        this._el.content.hidden = true;
        this._el.placeholder.hidden = false;
        this._el.ptext.textContent = this._deviceId()
          ? this._t("no_device")
          : this._t("not_configured");
        this.setAttribute("data-status", "offline");
        return;
      }

      const watched = Object.values(roles).filter((v) => typeof v === "string");
      const sig =
        watched.map((id) => `${id}:${this._hass.states[id]?.state}`).join("|") +
        `|${this._locale()}|${this._config.name || ""}|${this._pending ? 1 : 0}`;
      if (sig === this._sig) {
        return;
      }
      this._sig = sig;

      this._el.placeholder.hidden = true;
      this._el.content.hidden = false;

      const state = (id) => (id ? this._hass.states[id] : undefined);
      const sw = state(roles.power);
      const primary = sw || state(roles.pressure);

      const offline = !primary || primary.state === "unavailable";
      const error = !offline && state(roles.problem)?.state === "on";
      const running = !offline && state(roles.running)?.state === "on";
      const standby =
        !offline && (state(roles.standby)?.state === "on" || sw?.state === "off");
      const status = offline
        ? "offline"
        : error
          ? "error"
          : running
            ? "running"
            : standby
              ? "standby"
              : "idle";
      this.setAttribute("data-status", status);

      // Header.
      const device = this._hass.devices?.[roles.deviceId];
      this._el.name.textContent =
        this._config.name ||
        device?.name_by_user ||
        device?.name ||
        this._t("pump");
      this._el.stxt.textContent = this._t(status);

      // Power button.
      if (this._pending && sw && sw.state !== this._pendingFrom) {
        this._pending = false;
        clearTimeout(this._pendingTimer);
      }
      const on = sw?.state === "on";
      this._el.power.classList.toggle("on", on && !offline);
      this._el.power.classList.toggle("pending", Boolean(this._pending));
      this._el.power.disabled = offline || !roles.power;
      this._el.power.hidden = !roles.power;
      this._el.power.setAttribute(
        "aria-label",
        this._t(on ? "turn_off" : "turn_on")
      );

      // Gauge.
      const press = offline ? null : this._num(roles.pressure, 1);
      const setpoint = offline ? null : this._num(roles.setpoint, 1);
      let max = 4;
      if (setpoint) max = Math.max(max, Math.ceil(setpoint.value * 1.5));
      if (press) max = Math.max(max, Math.ceil(press.value + 0.4));

      const frac = press ? clamp(press.value / max, 0, 1) : 0;
      this._el.val.style.strokeDashoffset = (ARC_LEN * (1 - frac)).toFixed(2);
      this._el.bigval.textContent = press ? press.text : "—";
      this._el.unit.textContent = press ? press.unit : "";
      this._el.s1.textContent = String(max);

      const scaleKey = `${max}|${setpoint ? setpoint.value : ""}`;
      if (scaleKey !== this._scaleKey) {
        this._scaleKey = scaleKey;
        let ticks = "";
        if (max <= 10) {
          for (let i = 1; i < max; i++) {
            const deg = A0 + (A1 - A0) * (i / max);
            const [x1, y1] = polar(CX, CY, R - 13, deg);
            const [x2, y2] = polar(CX, CY, R - 8, deg);
            ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"></line>`;
          }
        }
        this._el.ticks.innerHTML = ticks;
        if (setpoint) {
          const deg = A0 + (A1 - A0) * clamp(setpoint.value / max, 0, 1);
          const [x1, y1] = polar(CX, CY, R - 12, deg);
          const [x2, y2] = polar(CX, CY, R + 12, deg);
          this._el.marker.innerHTML = `<line class="mline" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"></line>`;
        } else {
          this._el.marker.innerHTML = "";
        }
      }

      this._el.target.hidden = !setpoint;
      if (setpoint) {
        this._el.tval.textContent = `${setpoint.text} ${setpoint.unit}`.trim();
        this._el.target.title = this._t("target");
        this._el.target.setAttribute("aria-label", this._t("target"));
      }

      // Error banner.
      this._el.alert.hidden = !error;
      if (error) {
        const code =
          state(roles.errorCode)?.state ??
          state(roles.problem)?.attributes?.error_number;
        const codeText =
          code === undefined || code === null || code === "" ? "" : `: ${code}`;
        this._el.atext.textContent = `${this._t("error_code")}${codeText}`;
      }

      // Tiles + chips.
      const fill = (btn, spec) => {
        const entityId = roles[spec.role];
        const num = offline ? null : this._num(entityId, spec.prec);
        btn.hidden = !num;
        if (!num) {
          return;
        }
        btn.dataset.entity = entityId;
        btn.title = this._t(spec.label);
        btn.setAttribute("aria-label", this._t(spec.label));
        btn.querySelector(".n").textContent = num.text;
        btn.querySelector(".u").textContent = num.unit ? ` ${num.unit}` : "";
        const label = btn.querySelector(".tl");
        if (label) {
          label.textContent = this._t(spec.label);
        }
      };
      this._el.tiles.forEach((btn, i) => fill(btn, TILES[i]));
      this._el.chips.forEach((btn, i) => fill(btn, CHIPS[i]));
    }

    // ----------------------------------------------------------- actions --
    _moreInfo(entityId) {
      if (entityId) {
        fireEvent(this, "hass-more-info", { entityId });
      }
    }

    _togglePump() {
      const entityId = this._roles?.power;
      const st = entityId ? this._hass.states[entityId] : undefined;
      if (!st || st.state === "unavailable") {
        return;
      }
      const turnOn = st.state !== "on";
      this._pending = true;
      this._pendingFrom = st.state;
      clearTimeout(this._pendingTimer);
      this._pendingTimer = setTimeout(() => {
        this._pending = false;
        this._sig = null;
        this._update();
      }, 15000);
      this._sig = null;
      this._el.power.classList.add("pending");
      fireEvent(window, "haptic", "light");
      this._hass.callService("switch", turnOn ? "turn_on" : "turn_off", {
        entity_id: entityId,
      });
    }
  }

  // -------------------------------------------------------------- editor ---
  const ensureFormHelpers = async () => {
    if (customElements.get("ha-form")) {
      return;
    }
    try {
      const helpers = await window.loadCardHelpers?.();
      const card = await helpers?.createCardElement?.({
        type: "entities",
        entities: [],
      });
      await card?.constructor?.getConfigElement?.();
    } catch (_err) {
      // The form still renders once the elements are defined elsewhere.
    }
  };

  class SirioPumpCardEditor extends HTMLElement {
    setConfig(config) {
      this._config = { ...config };
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      if (this._form) {
        this._form.hass = hass;
      }
      this._render();
    }

    connectedCallback() {
      this._render();
    }

    async _render() {
      if (!this._hass || !this._config) {
        return;
      }
      if (!this._loading) {
        this._loading = ensureFormHelpers();
      }
      await this._loading;
      if (!this.shadowRoot) {
        this.attachShadow({ mode: "open" });
      }
      if (!this._form) {
        this._form = document.createElement("ha-form");
        this._form.computeLabel = (schema) => localize(this._hass, schema.name);
        this._form.computeHelper = (schema) =>
          schema.name === "name"
            ? localize(this._hass, "name_helper")
            : undefined;
        this._form.addEventListener("value-changed", (ev) => {
          ev.stopPropagation();
          const value = ev.detail.value || {};
          const config = { type: `custom:${CARD_TAG}` };
          if (value.device) {
            config.device = value.device;
          }
          if (value.name) {
            config.name = value.name;
          }
          if (JSON.stringify(config) !== JSON.stringify(this._config)) {
            this._config = config;
            fireEvent(this, "config-changed", { config });
          }
        });
        this.shadowRoot.append(this._form);
      }
      this._form.hass = this._hass;
      this._form.schema = [
        {
          name: "device",
          required: true,
          selector: { device: { integration: "sirio" } },
        },
        { name: "name", selector: { text: {} } },
      ];
      this._form.data = {
        device:
          this._config.device ||
          this._hass.entities?.[this._config.entity]?.device_id ||
          "",
        name: this._config.name || "",
      };
    }
  }

  customElements.define(CARD_TAG, SirioPumpCard);
  customElements.define(EDITOR_TAG, SirioPumpCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: CARD_TAG,
    name: "Sirio Pump Card",
    description:
      "Pressure gauge, status and controls for Italtecnica Sirio pump inverters (WiNET).",
    preview: true,
    documentationURL: "https://github.com/RobinCK/ha-sirio-winet",
  });

  console.info(
    `%c SIRIO-PUMP-CARD %c v${CARD_VERSION} `,
    "color: #fff; background: #039be5; font-weight: 700; border-radius: 4px 0 0 4px; padding: 2px 0 2px 6px;",
    "color: #039be5; background: rgba(3,155,229,.15); font-weight: 700; border-radius: 0 4px 4px 0; padding: 2px 6px 2px 0;"
  );
})();
