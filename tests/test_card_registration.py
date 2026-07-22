"""Tests for the Lovelace card resource registration against real HA code."""

import pytest
from homeassistant.setup import async_setup_component

from custom_components.sirio import CARD_URL, _async_register_resource


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


def _resources(hass):
    lovelace = hass.data["lovelace"]
    if isinstance(lovelace, dict):  # pre-2025.2 cores
        return lovelace["resources"]
    return lovelace.resources


def _urls(hass):
    return [item["url"] for item in _resources(hass).async_items()]


async def test_register_preserves_foreign_resources(hass, hass_storage):
    """Creating our resource must never wipe resources of other projects."""
    hass_storage["lovelace_resources"] = {
        "version": 1,
        "minor_version": 1,
        "key": "lovelace_resources",
        "data": {
            "items": [
                {"id": "aaa", "type": "module", "url": "/hacsfiles/mushroom.js"},
                {"id": "bbb", "type": "module", "url": "/hacsfiles/bubble-card.js"},
            ]
        },
    }
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()

    assert await _async_register_resource(hass, f"{CARD_URL}?v=1") is True

    urls = _urls(hass)
    assert "/hacsfiles/mushroom.js" in urls
    assert "/hacsfiles/bubble-card.js" in urls
    assert f"{CARD_URL}?v=1" in urls


async def test_register_is_idempotent(hass):
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()

    assert await _async_register_resource(hass, f"{CARD_URL}?v=1") is True
    assert await _async_register_resource(hass, f"{CARD_URL}?v=1") is True

    assert _urls(hass).count(f"{CARD_URL}?v=1") == 1


async def test_register_updates_version_in_place(hass):
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()

    assert await _async_register_resource(hass, f"{CARD_URL}?v=1") is True
    assert await _async_register_resource(hass, f"{CARD_URL}?v=2") is True

    ours = [u for u in _urls(hass) if u.partition("?")[0] == CARD_URL]
    assert ours == [f"{CARD_URL}?v=2"]


async def test_register_cleans_up_stray_duplicates(hass, hass_storage):
    """Duplicates of our own resource left by older versions get removed."""
    hass_storage["lovelace_resources"] = {
        "version": 1,
        "minor_version": 1,
        "key": "lovelace_resources",
        "data": {
            "items": [
                {"id": "d1", "type": "module", "url": f"{CARD_URL}?v=0.2.3"},
                {"id": "d2", "type": "module", "url": f"{CARD_URL}?v=0.2.4"},
                {"id": "keep", "type": "module", "url": "/hacsfiles/mushroom.js"},
            ]
        },
    }
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()

    assert await _async_register_resource(hass, f"{CARD_URL}?v=9") is True

    urls = _urls(hass)
    ours = [u for u in urls if u.partition("?")[0] == CARD_URL]
    assert ours == [f"{CARD_URL}?v=9"]
    assert "/hacsfiles/mushroom.js" in urls


async def test_register_on_unloaded_collection(hass, hass_storage):
    """Registration triggers the lazy load itself when nobody loaded resources."""
    hass_storage["lovelace_resources"] = {
        "version": 1,
        "minor_version": 1,
        "key": "lovelace_resources",
        "data": {"items": [{"id": "aaa", "type": "module", "url": "/keepme.js"}]},
    }
    assert await async_setup_component(hass, "lovelace", {})
    await hass.async_block_till_done()

    resources = _resources(hass)
    assert resources.loaded is False  # nobody touched the collection yet

    assert await _async_register_resource(hass, f"{CARD_URL}?v=1") is True
    urls = _urls(hass)
    assert "/keepme.js" in urls
    assert f"{CARD_URL}?v=1" in urls
