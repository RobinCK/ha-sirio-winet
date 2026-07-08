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
- When the inverter stops responding, all its entities become `unavailable`,
  which you can use as an "offline" alert trigger.

## Requirements

- Home Assistant 2024.6 or newer.
- The WiNET module connected to your Wi-Fi network with a known (ideally static /
  DHCP-reserved) IP address. Verify you can open `http://<inverter-ip>/status.html`
  in a browser from the same network.

## Installation

### Option A — HACS (recommended)

1. Open **HACS** in Home Assistant.
2. Click the three-dot menu (top right) → **Custom repositories**.
3. Paste this repository URL, choose type **Integration**, click **Add**.
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

## Dashboard example

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

## Troubleshooting

- **"Cannot connect" during setup** — check that the IP is correct and that
  `http://<ip>/management.html` opens from the Home Assistant host's network.
- **Entities become unavailable intermittently** — the WiNET Wi-Fi signal may be
  weak; check `sensor.<name>_wi_fi_signal` (values below −85 dBm are poor).
- **Switch does not change state immediately** — the state refreshes on the next
  poll cycle (up to 10 s).

## Development

Run the unit tests:

```bash
python -m venv .venv
.venv/bin/pip install pytest aiohttp
.venv/bin/python -m pytest tests/ -v
```

## Disclaimer

This is an unofficial integration, not affiliated with Italtecnica. Tested with
WiNET firmware 0.17.
