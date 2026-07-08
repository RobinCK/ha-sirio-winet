import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "custom_components" / "sirio"))

from api import needs_toggle, parse_registers


def test_parse_registers_scales_pressure_and_current():
    raw = {
        "press": 28,
        "setPointPress": 35,
        "amp": 43,
        "ampMax": 70,
        "volt": 225,
        "freq": 50,
        "temp": 45,
    }
    data = parse_registers(raw)
    assert data["press"] == 2.8
    assert data["setPointPress"] == 3.5
    assert data["amp"] == 4.3
    assert data["ampMax"] == 7.0
    assert data["volt"] == 225
    assert data["freq"] == 50
    assert data["temp"] == 45


def test_parse_registers_ignores_missing_and_non_numeric_fields():
    assert parse_registers({}) == {}
    data = parse_registers({"press": None, "amp": "n/a"})
    assert data["press"] is None
    assert data["amp"] == "n/a"


def test_parse_registers_does_not_mutate_input():
    raw = {"press": 28}
    parse_registers(raw)
    assert raw["press"] == 28


@pytest.mark.parametrize(
    ("stand_by", "desired_on", "expected"),
    [
        (1, True, True),
        (0, True, False),
        (0, False, True),
        (1, False, False),
    ],
)
def test_needs_toggle(stand_by, desired_on, expected):
    assert needs_toggle(stand_by, desired_on) is expected
