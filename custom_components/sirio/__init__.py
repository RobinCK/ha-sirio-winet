from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_NAME, Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.start import async_at_start
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
LOADER_FILENAME = "sirio-pump-card-loader.js"
CARD_URL = f"/{DOMAIN}/{CARD_FILENAME}"
LOADER_URL = f"/{DOMAIN}/{LOADER_FILENAME}"

type SirioConfigEntry = ConfigEntry[SirioCoordinator]


def _lovelace_resources(hass: HomeAssistant):
    """Return the storage-mode Lovelace resource collection, or None."""
    lovelace = hass.data.get("lovelace")
    if lovelace is None:
        return None
    if isinstance(lovelace, dict):  # pre-2025.2 cores
        mode = lovelace.get("mode")
        resources = lovelace.get("resources")
    else:
        mode = getattr(lovelace, "mode", None)
        resources = getattr(lovelace, "resources", None)
    if mode != "storage" or resources is None:
        return None
    return resources


async def _async_register_resource(hass: HomeAssistant, url: str) -> bool:
    """Ensure exactly one Lovelace module resource for this base URL.

    Lovelace resources are re-imported by the frontend on every full page
    load, which is far more reliable on the mobile app than extra_js_url
    alone (that one is baked into the service-worker-cached app shell).
    Updates the cache-busting version in place and removes stray duplicates.
    Returns True when the registry contains the resource afterwards.
    """
    resources = _lovelace_resources(hass)
    if resources is None:
        return False
    # The collection must be loaded before we may inspect or mutate it —
    # async_get_info() performs the same lazy load the websocket API uses.
    if hasattr(resources, "async_get_info"):
        await resources.async_get_info()
    elif not getattr(resources, "loaded", False):
        await resources.async_load()
        resources.loaded = True
    if not hasattr(resources, "async_items"):
        return False
    base_url = url.partition("?")[0]
    found = False
    for item in list(resources.async_items()):
        if item.get("url", "").partition("?")[0] != base_url:
            continue
        if found:  # stray duplicate from an older version — clean it up
            await resources.async_delete_item(item["id"])
            continue
        found = True
        if item.get("url") != url:  # refresh the cache-busting version
            await resources.async_update_item(item["id"], {"url": url})
    if not found:
        await resources.async_create_item({"res_type": "module", "url": url})
    return True


async def _async_register_card(hass: HomeAssistant) -> None:
    """Serve the bundled Lovelace card and make sure it loads on dashboards."""
    frontend_dir = Path(__file__).parent / "frontend"
    paths = [
        (CARD_URL, str(frontend_dir / CARD_FILENAME)),
        (LOADER_URL, str(frontend_dir / LOADER_FILENAME)),
    ]
    if StaticPathConfig is not None and hasattr(
        hass.http, "async_register_static_paths"
    ):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(url, path, cache_headers=True) for url, path in paths]
        )
    else:  # pre-2024.6 cores
        for url, path in paths:
            hass.http.register_static_path(url, path, cache_headers=True)

    integration = await async_get_integration(hass, DOMAIN)
    versioned_card = f"{CARD_URL}?v={integration.version}"
    versioned_loader = f"{LOADER_URL}?v={integration.version}"

    async def _register_resources() -> bool:
        # Two module resources: the card itself for the fast common case, and
        # a tiny retrying loader that recovers when the one-shot import of the
        # card fails (404 right after a restart, flaky Wi-Fi on mobile) or
        # when the app returns from background. The card guards against
        # double definition, so overlapping deliveries are harmless.
        ok = await _async_register_resource(hass, versioned_card)
        return await _async_register_resource(hass, versioned_loader) and ok

    in_resources = False
    try:
        in_resources = await _register_resources()
    except Exception:  # noqa: BLE001 - resource registry APIs differ between cores
        _LOGGER.debug("Could not manage Lovelace resources", exc_info=True)

    if in_resources:
        # Lovelace resources are fetched fresh on every page load, bypassing
        # the service-worker-cached app shell entirely. Re-assert once HA is
        # fully started to cover any startup-ordering edge case.
        async def _reassert(_hass: HomeAssistant) -> None:
            try:
                await _register_resources()
            except Exception:  # noqa: BLE001
                _LOGGER.debug("Lovelace resource re-assert failed", exc_info=True)

        async_at_start(hass, _reassert)
    else:
        # YAML-mode dashboards (or cores without the resource registry): fall
        # back to extra_js_url. Deliberately NOT used otherwise — these URLs
        # are baked into the service-worker-cached index.html, which is served
        # one revision stale (StaleWhileRevalidate), so every version bump
        # would alternate good/bad shells between refreshes.
        frontend.add_extra_js_url(hass, versioned_card)
        frontend.add_extra_js_url(hass, versioned_loader)

    _LOGGER.info(
        "Sirio Pump Card registered at %s (lovelace storage resources: %s)",
        versioned_card,
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
