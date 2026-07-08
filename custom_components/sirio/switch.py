from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchDeviceClass, SwitchEntity
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import SirioConfigEntry
from .api import SirioApiError
from .coordinator import SirioCoordinator
from .entity import SirioEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: SirioConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    async_add_entities([SirioPumpSwitch(entry.runtime_data, entry)])


class SirioPumpSwitch(SirioEntity, SwitchEntity):
    _attr_name = "Pump"
    _attr_device_class = SwitchDeviceClass.SWITCH

    def __init__(self, coordinator: SirioCoordinator, entry: SirioConfigEntry) -> None:
        super().__init__(coordinator, entry)
        self._attr_unique_id = f"{entry.entry_id}_pump"

    @property
    def is_on(self) -> bool:
        return not self.coordinator.data.get("standBy")

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self._async_set_power(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._async_set_power(False)

    async def _async_set_power(self, desired_on: bool) -> None:
        try:
            await self.coordinator.api.set_power(desired_on)
        except SirioApiError as err:
            raise HomeAssistantError(f"Failed to switch pump: {err}") from err
        await self.coordinator.async_request_refresh()
