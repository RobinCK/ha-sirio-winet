from __future__ import annotations

import asyncio
from typing import Any

import aiohttp

GET_REGISTERS_KEY = "001"
TOGGLE_POWER_KEY = "011"

SCALED_BY_TEN_FIELDS = ("press", "setPointPress", "amp", "ampMax")

REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10)


class SirioApiError(Exception):
    pass


def parse_registers(raw: dict[str, Any]) -> dict[str, Any]:
    data = dict(raw)
    for field in SCALED_BY_TEN_FIELDS:
        value = data.get(field)
        if isinstance(value, (int, float)):
            data[field] = value / 10
    return data


def needs_toggle(stand_by: Any, desired_on: bool) -> bool:
    return bool(stand_by) == desired_on


class SirioApi:
    def __init__(self, host: str, session: aiohttp.ClientSession) -> None:
        self._base_url = f"http://{host}"
        self._session = session

    async def _post(self, path: str, data: dict[str, str] | None = None) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        headers = {"X-Requested-With": "XMLHttpRequest"}
        try:
            async with self._session.post(
                url, data=data, headers=headers, timeout=REQUEST_TIMEOUT
            ) as response:
                response.raise_for_status()
                return await response.json(content_type=None)
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as err:
            raise SirioApiError(f"Request to {url} failed: {err}") from err

    async def get_raw_registers(self) -> dict[str, Any]:
        return await self._post("/ajax/get-registers", {"key": GET_REGISTERS_KEY})

    async def get_registers(self) -> dict[str, Any]:
        return parse_registers(await self.get_raw_registers())

    async def get_status(self) -> dict[str, Any]:
        return await self._post("/ajax/get-status")

    async def toggle_power(self) -> None:
        result = await self._post("/ajax/set-registers", {"key": TOGGLE_POWER_KEY})
        if not result.get("result"):
            raise SirioApiError(f"Device rejected power toggle: {result}")

    async def set_power(self, desired_on: bool) -> None:
        registers = await self.get_raw_registers()
        if needs_toggle(registers.get("standBy", 0), desired_on):
            await self.toggle_power()
