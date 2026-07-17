DOMAIN = "sirio"

MANUFACTURER = "Italtecnica"
MODEL = "Sirio"

REGISTERS_INTERVAL_SECONDS = 10
STATUS_EVERY_N_CYCLES = 6

# When the inverter is unreachable (e.g. its Wi-Fi dropped) back off the
# polling interval exponentially instead of hammering the network every
# REGISTERS_INTERVAL_SECONDS. Reset to the base interval on the first success.
MAX_BACKOFF_SECONDS = 120
