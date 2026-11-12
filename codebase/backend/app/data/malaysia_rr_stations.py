"""Malaysia Expressway Rest & Service Areas (R&R) and Fuel Station Nodes.

Positions real PLUS Expressway (E1/AH2, E2) service stations with verified
GPS coordinates along major freight transport corridors.
"""

from typing import TypedDict


class RRStation(TypedDict):
    station_id: str
    name: str
    highway: str
    latitude: float
    longitude: float
    brand: str
    diesel_available: bool


PLUS_RR_STATIONS: list[RRStation] = [
    {
        "station_id": "RR-TAPAH",
        "name": "Tapah R&R (Northbound & Southbound)",
        "highway": "PLUS E1 / AH2 (KM 332)",
        "latitude": 4.1863,
        "longitude": 101.2721,
        "brand": "Petronas / Shell",
        "diesel_available": True,
    },
    {
        "station_id": "RR-RAWANG",
        "name": "Rawang R&R",
        "highway": "PLUS E1 / AH2 (KM 440)",
        "latitude": 3.3080,
        "longitude": 101.5658,
        "brand": "Petron",
        "diesel_available": True,
    },
    {
        "station_id": "RR-ULU-BERNAM",
        "name": "Ulu Bernam R&R",
        "highway": "PLUS E1 / AH2 (KM 388)",
        "latitude": 3.7389,
        "longitude": 101.4428,
        "brand": "Petronas",
        "diesel_available": True,
    },
    {
        "station_id": "RR-SIMPANG-PULAI",
        "name": "Simpang Pulai Service Station",
        "highway": "PLUS E1 (KM 290)",
        "latitude": 4.5300,
        "longitude": 101.1200,
        "brand": "Shell",
        "diesel_available": True,
    },
    {
        "station_id": "RR-AYER-KEROH",
        "name": "Ayer Keroh R&R",
        "highway": "PLUS E2 (KM 210)",
        "latitude": 2.3667,
        "longitude": 102.2667,
        "brand": "Petronas",
        "diesel_available": True,
    },
    {
        "station_id": "RR-NILAI",
        "name": "Nilai R&R",
        "highway": "PLUS E2 (KM 287)",
        "latitude": 2.8250,
        "longitude": 101.8100,
        "brand": "Caltex",
        "diesel_available": True,
    },
]


def find_nearest_rr_station(lat: float, lon: float) -> RRStation:
    """Find the closest highway R&R station using Euclidean distance."""

    def dist_sq(st: RRStation) -> float:
        return (st["latitude"] - lat) ** 2 + (st["longitude"] - lon) ** 2

    return min(PLUS_RR_STATIONS, key=dist_sq)
