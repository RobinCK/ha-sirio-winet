from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import SirioApi, SirioApiError
from .const import DOMAIN, REGISTERS_INTERVAL_SECONDS, STATUS_EVERY_N_CYCLES

_LOGGER = logging.getLogger(__name__)


class SirioCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    def __init__(self, hass: HomeAssistant, api: SirioApi, device_name: str) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=f"{DOMAIN} {device_name}",
            update_interval=timedelta(seconds=REGISTERS_INTERVAL_SECONDS),
        )
        self.api = api
        self._status: dict[str, Any] = {}
        self._cycle = 0

    async def _async_update_data(self) -> dict[str, Any]:
        try:
            registers = await self.api.get_registers()
            if not self._status or self._cycle % STATUS_EVERY_N_CYCLES == 0:
                self._status = await self.api.get_status()
        except SirioApiError as err:
            raise UpdateFailed(str(err)) from err
        self._cycle += 1
        return {**self._status, **registers}
