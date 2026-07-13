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


async def _async_register_resource(hass: HomeAssistant, url: str) -> bool:
    """Ensure the card is listed in the Lovelace resource registry.

    Unlike extra_js_url (baked into the service-worker-cached app shell),
    resources are fetched dynamically on every dashboard load, so mobile
    clients pick the card up after a plain page reload.
    """
    lovelace = hass.data.get("lovelace")
    if lovelace is None:
        return False
    if isinstance(lovelace, dict):  # pre-2024 cores
        mode = lovelace.get("mode")
        resources = lovelace.get("resources")
    else:
        mode = getattr(lovelace, "mode", None)
        resources = getattr(lovelace, "resources", None)
    if mode != "storage" or resources is None:
        return False
    if not getattr(resources, "loaded", True):
        await resources.async_load()
        resources.loaded = True
    for item in resources.async_items():
        item_url = item.get("url", "")
        if item_url.partition("?")[0] != CARD_URL:
            continue
        if item_url != url:  # refresh the cache-busting version
            await resources.async_update_item(item["id"], {"url": url})
        return True
    await resources.async_create_item({"res_type": "module", "url": url})
    return True


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
    versioned_url = f"{CARD_URL}?v={integration.version}"
    in_resources = False
    try:
        in_resources = await _async_register_resource(hass, versioned_url)
    except Exception:  # noqa: BLE001 - registry APIs differ between cores
        _LOGGER.debug("Could not manage Lovelace resources", exc_info=True)
    if not in_resources:
        # YAML-mode dashboards (or very old cores): fall back to extra_js_url.
        frontend.add_extra_js_url(hass, versioned_url)
    _LOGGER.info(
        "Sirio Pump Card registered at %s (lovelace resource: %s)",
        CARD_URL,
        in_resources,
    )


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
