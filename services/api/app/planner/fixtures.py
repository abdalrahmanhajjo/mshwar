"""Recorded provider fixtures. No live credentials."""

from __future__ import annotations

GOOGLE_DISTANCE_MATRIX_BEIRUT_BYBLOS = {
    "status": "OK",
    "origin_addresses": ["Beirut, Lebanon"],
    "destination_addresses": ["Byblos, Lebanon"],
    "rows": [
        {
            "elements": [
                {
                    "status": "OK",
                    "distance": {"text": "38 km", "value": 38421},
                    "duration": {"text": "52 mins", "value": 3120},
                }
            ]
        }
    ],
}

GOOGLE_DISTANCE_MATRIX_FAILED = {"status": "UNKNOWN_ERROR", "rows": []}

OPEN_METEO_BEIRUT = {
    "latitude": 33.89,
    "longitude": 35.50,
    "generationtime_ms": 0.4,
    "utc_offset_seconds": 10800,
    "timezone": "Asia/Beirut",
    "daily": {
        "time": ["2026-09-14"],
        "precipitation_sum": [12.4],
        "windspeed_10m_max": [28.0],
        "temperature_2m_max": [31.2],
        "temperature_2m_min": [22.1],
        "weathercode": [61],
    },
}

OPEN_METEO_CLEAR = {
    "latitude": 33.89,
    "longitude": 35.50,
    "daily": {
        "time": ["2026-09-20"],
        "precipitation_sum": [0.0],
        "windspeed_10m_max": [12.0],
        "temperature_2m_max": [28.0],
        "temperature_2m_min": [21.0],
        "weathercode": [1],
    },
}
