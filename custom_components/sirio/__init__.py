from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_NAME, Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration

from .api import SirioApi
from .const import DOMAIN
from .coordinator import SirioCoordinator

try:  # HA 2024.6+
    from homeassistant.components.http import StaticPathConfig
except ImportError:
    StaticPathConfig = None

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.BINARY_SENSOR, Platform.SENSOR, Platform.SWITCH]

CARD_FILENAME = "sirio-pump-card.js"
CARD_URL = f"/{DOMAIN}/{CARD_FILENAME}"

type SirioConfigEntry = ConfigEntry[SirioCoordinator]


async def _async_register_card(hass: HomeAssistant) -> None:
    """Serve the bundled Lovelace card and load it on every dashboard."""
    card_path = str(Path(__file__).parent / "frontend" / CARD_FILENAME)
    if StaticPathConfig is not None and hasattr(
        hass.http, "async_register_static_paths"
    ):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(CARD_URL, card_path, cache_headers=True)]
        )
    else:  # pre-2024.6 cores
        hass.http.register_static_path(CARD_URL, card_path, cache_headers=True)
    integration = await async_get_integration(hass, DOMAIN)
    frontend.add_extra_js_url(hass, f"{CARD_URL}?v={integration.version}")
    _LOGGER.info("Sirio Pump Card registered at %s", CARD_URL)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    try:
        await _async_register_card(hass)
    except Exception:  # noqa: BLE001 - the card must never block device setup
        _LOGGER.exception("Failed to register the bundled Lovelace card")
    return True


async def async_setup_entry(hass: HomeAssistant, entry: SirioConfigEntry) -> bool:
    api = SirioApi(entry.data[CONF_HOST], async_get_clientsession(hass))
    coordinator = SirioCoordinator(hass, api, entry.data[CONF_NAME])
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: SirioConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
