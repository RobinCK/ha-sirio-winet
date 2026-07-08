from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
    BinarySensorEntityDescription,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import SirioConfigEntry
from .coordinator import SirioCoordinator
from .entity import SirioEntity

BINARY_SENSORS: tuple[BinarySensorEntityDescription, ...] = (
    BinarySensorEntityDescription(
        key="errorActive",
        name="Error",
        device_class=BinarySensorDeviceClass.PROBLEM,
    ),
    BinarySensorEntityDescription(
        key="standBy",
        name="Standby",
    ),
    BinarySensorEntityDescription(
        key="motorOn",
        name="Running",
        device_class=BinarySensorDeviceClass.RUNNING,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: SirioConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator = entry.runtime_data
    async_add_entities(
        SirioBinarySensor(coordinator, entry, description)
        for description in BINARY_SENSORS
    )


class SirioBinarySensor(SirioEntity, BinarySensorEntity):
    def __init__(
        self,
        coordinator: SirioCoordinator,
        entry: SirioConfigEntry,
        description: BinarySensorEntityDescription,
    ) -> None:
        super().__init__(coordinator, entry)
        self.entity_description = description
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"

    @property
    def is_on(self) -> bool:
        return bool(self.coordinator.data.get(self.entity_description.key))

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        if self.entity_description.key != "errorActive":
            return None
        return {"error_number": self.coordinator.data.get("errorNumber")}
