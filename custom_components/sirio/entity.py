from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_NAME
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, MANUFACTURER, MODEL
from .coordinator import SirioCoordinator


class SirioEntity(CoordinatorEntity[SirioCoordinator]):
    _attr_has_entity_name = True

    def __init__(self, coordinator: SirioCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator)
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.data[CONF_NAME],
            manufacturer=MANUFACTURER,
            model=MODEL,
            sw_version=str(coordinator.data.get("fwVer", "")) or None,
            configuration_url=f"http://{entry.data[CONF_HOST]}",
        )
