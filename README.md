<p align="center">
  <img src="https://raw.githubusercontent.com/RobinCK/ha-sirio-winet/main/docs/logo.png" alt="Italtecnica" width="320">
</p>

# Sirio Pump Inverter (WiNET) — Home Assistant Integration

Local-polling Home Assistant integration for **Italtecnica Sirio** pump inverters
equipped with the **WiNET** Wi-Fi module. No cloud, no account — it talks directly
to the inverter's built-in web server on your LAN.

## Features

- One Home Assistant device per inverter — add as many inverters as you own, each
  with its own IP address and name.
- **Sensors:** pressure, pressure setpoint, current, voltage, frequency, module
  temperature, IGBT temperature, power-on hours, running hours, start count,
  Wi-Fi signal, error code.
- **Binary sensors:** error (problem), standby, motor running.
- **Switch:** pump on/off (standby toggle) with stale-state protection — the
  command is sent only after re-reading the actual device state.
- **Bundled Lovelace card** (`custom:sirio-pump-card`) — an animated pressure
  gauge with status, one-tap power control and key metrics, registered
  automatically (no manual resource setup). See [Lovelace card](#lovelace-card).
- When the inverter stops responding, all its entities become `unavailable`,
  which you can use as an "offline" alert trigger.

## Requirements

- Home Assistant 2024.6 or newer.
- The WiNET module connected to your Wi-Fi network with a known (ideally static /
  DHCP-reserved) IP address. Verify you can open `http://<inverter-ip>/status.html`
  in a browser from the same network.

> **Tested hardware:** developed and tested on a **Sirio Universal** inverter
> with the WiNET module (firmware 0.17). Other Sirio models that carry the same
> WiNET module (Entry / M-T / X4, …) expose the same local web API and are
> expected to work, but are currently unverified — feedback is welcome.

## Installation

### Option A — HACS (recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=RobinCK&repository=ha-sirio-winet&category=integration)

**One click:** press the badge above — it opens HACS with this repository already
filled in; then click **Download** and restart Home Assistant. Prefer to add it
by hand?

1. Open **HACS** in Home Assistant.
2. Click the three-dot menu (top right) → **Custom repositories**.
3. Paste this repository URL (`https://github.com/RobinCK/ha-sirio-winet`),
   choose type **Integration**, click **Add**.
4. Search for **Sirio Pump Inverter (WiNET)** in HACS and click **Download**.
5. Restart Home Assistant (**Settings → System → Restart**).

### Option B — Manual

1. Copy the `custom_components/sirio` folder of this repository into the
   `custom_components` folder of your Home Assistant configuration directory, so
   you end up with `<config>/custom_components/sirio/manifest.json`.
2. Restart Home Assistant.

## Adding a device

1. Go to **Settings → Devices & Services**.
2. Click **+ Add Integration** and search for **Sirio Pump Inverter**.
3. Enter the inverter's **IP address** (e.g. `192.168.100.20`) and a **name**
   (e.g. `Pump House`, `Well Pump`).
4. Click **Submit**. The integration tests the connection and creates the device.

### Multiple inverters

Repeat the steps above once per inverter, entering each unit's own IP address and
a distinct name. Every inverter becomes a separate device; entity names are
prefixed with the device name (e.g. `sensor.well_pump_pressure`), so they never
collide. Adding the same IP twice is rejected automatically.

## Entities

| Entity | Description |
|---|---|
| `switch.<name>_pump` | Pump on/off (off = standby) |
| `sensor.<name>_pressure` | Current pressure, bar |
| `sensor.<name>_pressure_setpoint` | Target pressure, bar |
| `sensor.<name>_current` | Motor current, A |
| `sensor.<name>_voltage` | Supply voltage, V |
| `sensor.<name>_frequency` | Output frequency, Hz |
| `sensor.<name>_temperature` | Module temperature, °C |
| `sensor.<name>_igbt_temperature` | IGBT temperature, °C (diagnostic) |
| `sensor.<name>_power_on_hours` | Total powered-on hours (diagnostic) |
| `sensor.<name>_running_hours` | Total motor running hours |
| `sensor.<name>_start_count` | Number of motor starts |
| `sensor.<name>_wi_fi_signal` | WiNET RSSI, dBm (diagnostic) |
| `sensor.<name>_error_code` | Active error number (diagnostic) |
| `binary_sensor.<name>_error` | On when the inverter reports an active error |
| `binary_sensor.<name>_standby` | On when the inverter is in standby |
| `binary_sensor.<name>_running` | On when the motor is running |

> **Note on scaling:** pressure and current values are received ×10 from the
> device and divided by 10 by the integration (raw `28` → `2.8 bar`). If the
> values in Home Assistant do not match the inverter's own web page, please open
> an issue with both readings.

## Alerting examples

The integration deliberately ships no automations — build your own on top of the
entities. Examples:

**Notify when the inverter reports an error:**

```yaml
automation:
  - alias: "Pump error alert"
    trigger:
      - platform: state
        entity_id: binary_sensor.well_pump_error
        to: "on"
    action:
      - service: notify.mobile_app_your_phone
        data:
          title: "Pump error"
          message: >
            Inverter reports error code
            {{ state_attr('binary_sensor.well_pump_error', 'error_number') }}
```

**Notify when the pump enters standby:**

```yaml
automation:
  - alias: "Pump standby alert"
    trigger:
      - platform: state
        entity_id: binary_sensor.well_pump_standby
        to: "on"
        for: "00:01:00"
    action:
      - service: notify.mobile_app_your_phone
        data:
          message: "The pump has been switched to standby."
```

**Notify when the inverter goes offline:**

```yaml
automation:
  - alias: "Pump offline alert"
    trigger:
      - platform: state
        entity_id: sensor.well_pump_pressure
        to: "unavailable"
        for: "00:05:00"
    action:
      - service: notify.mobile_app_your_phone
        data:
          message: "The pump inverter is not responding."
```

## Lovelace card

The integration ships its own dashboard card — **Sirio Pump Card**. It is served
by the integration and registered with the frontend automatically, so there is
nothing to add under *Settings → Dashboards → Resources* and no separate HACS
frontend repository to install.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/RobinCK/ha-sirio-winet/main/docs/screenshots/card-desktop-dark.png">
  <img alt="Sirio Pump Card on a desktop dashboard — running, standby and error states" src="https://raw.githubusercontent.com/RobinCK/ha-sirio-winet/main/docs/screenshots/card-desktop-light.png">
</picture>

<p align="center">
  <img alt="Sirio Pump Card on mobile — light theme" src="https://raw.githubusercontent.com/RobinCK/ha-sirio-winet/main/docs/screenshots/card-mobile-light.png" width="300">
  &nbsp;
  <img alt="Sirio Pump Card on mobile — dark theme" src="https://raw.githubusercontent.com/RobinCK/ha-sirio-winet/main/docs/screenshots/card-mobile-dark.png" width="300">
</p>

What you get:

- **Status header** — pump name with a live state pill (Running / Idle /
  Standby / Error / Offline) and an animated pump icon.
- **Pressure gauge** — animated arc with the current pressure, scale ticks and
  a setpoint marker; a "flowing water" effect while the motor runs.
- **One-tap power button** with a busy spinner until the inverter confirms the
  new state.
- **Metric tiles** — current, voltage, frequency, temperature; **chips** —
  running hours, start count, Wi-Fi signal. Hidden automatically if the entity
  is disabled.
- **Error banner** with the active error code when the inverter reports a
  problem.
- Every element is **clickable** and opens the entity's more-info dialog
  (history, statistics, settings).
- **Offline-safe** — if the inverter drops off Wi-Fi the card shows an
  *Offline* state instead of erroring out, and never crashes the dashboard.
- **Mobile-friendly and theme-aware** — adapts to narrow screens, light/dark
  themes, honors `prefers-reduced-motion`; UI in English and Ukrainian.

### Adding the card

1. Open your dashboard → **Edit** → **+ Add card**.
2. Search for **Sirio Pump Card** (it appears in the picker with a live
   preview).
3. Pick your pump device in the visual editor. Done.

Or in YAML:

```yaml
type: custom:sirio-pump-card
device: 1234567890abcdef1234567890abcdef  # device id, picked via the UI editor
# entity: switch.well_pump_pump          # ...or any entity of the pump instead
# name: Well Pump                        # optional header override
```

> The card is loaded after the integration starts. If it does not appear in the
> card picker right after an update, hard-refresh the browser
> (Ctrl/Cmd+Shift+R) or clear the app cache in the mobile app.

### Plain entities card (alternative)

```yaml
type: entities
title: Well Pump
entities:
  - entity: switch.well_pump_pump
  - entity: sensor.well_pump_pressure
  - entity: sensor.well_pump_pressure_setpoint
  - entity: sensor.well_pump_current
  - entity: sensor.well_pump_frequency
  - entity: binary_sensor.well_pump_running
  - entity: binary_sensor.well_pump_error
```

## How it works

The WiNET module exposes a simple HTTP API used by its own web pages:

| Endpoint | Purpose |
|---|---|
| `POST /ajax/get-registers` (`key=001`) | Operating values |
| `POST /ajax/get-status` | Network / firmware status |
| `POST /ajax/set-registers` (`key=011`) | Toggle standby ↔ run |

The integration polls `get-registers` every 10 seconds and `get-status` roughly
once a minute. Because `key=011` is a *toggle*, the switch first re-reads the
actual `standBy` state and only sends the command when the state really needs to
change — stale data can never flip the pump the wrong way.

When the inverter becomes unreachable (its Wi-Fi drops, for example) the poller
**backs off exponentially** — 10 s → 20 → 40 → 80 → 120 s (capped) — instead of
hammering the network every 10 seconds, and returns to the normal 10 s rhythm on
the first successful poll. This keeps the log clean and the network quiet during
outages. Entities still go `unavailable` on the first failure, so offline alerts
keep working.

## Troubleshooting

- **Card not found in the picker / "Custom element doesn't exist:
  sirio-pump-card"** — check in this order:
  1. Open `http://<ha-host>:8123/sirio/sirio-pump-card.js` in a browser (same
     address you open Home Assistant with, plus the path). A **404** means the
     backend is not serving the card yet: make sure HACS actually downloaded
     the new version (HACS → integration → ⋮ → *Update information*, then
     *Redownload*) and **fully restart** Home Assistant — a config-entry
     reload is not enough, the card is registered at startup.
  2. Check **Settings → Dashboards → ⋮ → Resources**: after a restart the
     integration adds `/sirio/sirio-pump-card.js?v=<version>` there
     automatically (storage-mode dashboards).
  3. If the JS file opens but the card still errors, it is client cache:
     reload the page, or hard-refresh (Ctrl/Cmd+Shift+R). In mobile Chrome use
     *Site settings → Clear & reset* for the HA site; in the companion app,
     *Settings → Companion app → Debugging → Reset frontend cache*. The
     browser console should then show a `SIRIO-PUMP-CARD` banner.
- **Intermittent "Custom element not found: sirio-pump-card" (worst on
  mobile, often alternating between refreshes)** — two Home Assistant frontend
  behaviors cause this: the service worker serves the app shell one revision
  stale, and Lovelace imports each resource only once per page with no retry,
  so a single failed request (e.g. a 404 in the first seconds after a
  restart) kills the card until a full reload. Since v0.2.7 the integration
  counters both: the card is delivered purely as Lovelace *module resources*
  (fetched fresh on every page load, bypassing the stale shell) together with
  a tiny loader that retries a failed import with backoff and re-checks when
  the app returns from background. Verify under **Settings → Dashboards → ⋮ →
  Resources** that both `/sirio/sirio-pump-card.js` and
  `/sirio/sirio-pump-card-loader.js` are listed. Right after updating, one
  more hard refresh (or app *Reset frontend cache*) may be needed while old
  cached shells expire. YAML-mode dashboards: add both URLs as **JavaScript
  Module** resources manually.
- **"Cannot connect" during setup** — check that the IP is correct and that
  `http://<ip>/management.html` opens from the Home Assistant host's network.
- **Entities become unavailable intermittently** — the WiNET Wi-Fi signal may be
  weak; check `sensor.<name>_wi_fi_signal` (values below −85 dBm are poor).
- **Switch does not change state immediately** — the state refreshes on the next
  poll cycle (up to 10 s).

## Integration icon

The integration ships its brand icons **inline**, in
[`custom_components/sirio/brand`](custom_components/sirio/brand): `icon.png`
(256×256), `icon@2x.png` (512×512) and dark-theme variants.

Since **Home Assistant 2026.3** custom integrations serve their brand images
locally through the
[Brands Proxy API](https://developers.home-assistant.io/blog/2026/02/24/brands-proxy-api/)
(`/api/brands/integration/sirio/icon.png`). No submission to the central
`home-assistant/brands` repository is needed — that repository now auto-closes
custom-integration pull requests in favor of this inline mechanism.

The icon appears automatically once the integration is installed on Home
Assistant 2026.3 or newer (older cores simply ignore it). If it does not show up
right after an update, hard-refresh the browser — the proxy caches images with a
stale-while-revalidate strategy. Note that, due to a known HACS bug, the HACS
downloads panel may still show a placeholder for a while even though the
integration itself shows the icon correctly.

## Development

Run the unit tests:

```bash
python -m venv .venv
.venv/bin/pip install pytest aiohttp
.venv/bin/python -m pytest tests/ -v
```

## Disclaimer

This is an unofficial integration, not affiliated with Italtecnica. Tested on a
**Sirio Universal** inverter with WiNET firmware 0.17.
