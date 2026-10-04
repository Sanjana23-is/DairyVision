"""
weather.py
==========
Fetches real-time ambient conditions from the Open-Meteo API.
Returns (temperature_C, relative_humidity_pct).

Design notes
------------
- Uses the 'current' endpoint (v1) which returns a flat dict — no
  hourly-array index lookup, so it does not break when the exact
  timestamp is absent from the hourly list (the bug in the original code).
- Falls back gracefully to config constants on any network or parse error.
- Logs every step so the calling code always knows which data source was used.
"""

import requests
import logging
from config import FALLBACK_TEMP, FALLBACK_HUM, WEATHER_LAT, WEATHER_LON

logger = logging.getLogger(__name__)


def fetch_weather(lat: float = WEATHER_LAT,
                  lon: float = WEATHER_LON,
                  timeout: int = 10) -> tuple[float, float]:
    """
    Fetch current temperature (°C) and relative humidity (%) for the
    given coordinates using the Open-Meteo free API.

    Parameters
    ----------
    lat, lon : float
        Geographic coordinates of the farm. Default: Bangalore, India.
    timeout : int
        HTTP request timeout in seconds.

    Returns
    -------
    (temperature_C, humidity_pct) : tuple[float, float]
        Falls back to (FALLBACK_TEMP, FALLBACK_HUM) on failure.
    """
    # Open-Meteo v1 'current' endpoint — returns data directly without
    # requiring an index lookup into a parallel hourly array.
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m"
        f"&wind_speed_unit=ms"
    )

    logger.info("[Weather] Requesting: %s", url)

    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        data = response.json()

        current = data.get("current", {})
        temp    = float(current["temperature_2m"])
        hum     = float(current["relative_humidity_2m"])

        logger.info("[Weather] OK  — Temp: %.1f°C  Humidity: %.1f%%", temp, hum)
        return temp, hum

    except requests.exceptions.ConnectionError:
        logger.warning("[Weather] Network unreachable. Using fallback values.")
    except requests.exceptions.Timeout:
        logger.warning("[Weather] Request timed out. Using fallback values.")
    except (KeyError, TypeError, ValueError) as exc:
        logger.warning("[Weather] Unexpected API response (%s). Using fallback.", exc)
    except Exception as exc:                        # noqa: BLE001
        logger.warning("[Weather] Unhandled error (%s). Using fallback.", exc)

    logger.info("[Weather] Fallback — Temp: %.1f°C  Humidity: %.1f%%",
                FALLBACK_TEMP, FALLBACK_HUM)
    return FALLBACK_TEMP, FALLBACK_HUM


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-8s  %(message)s")
    t, h = fetch_weather()
    print(f"Temperature: {t}°C   Humidity: {h}%")
