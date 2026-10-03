from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class TripOut(BaseModel):
    id: int
    external_id: int
    vin: str
    start_date: datetime
    end_date: Optional[datetime]
    start_city: Optional[str]
    start_street: Optional[str]
    start_postal_code: Optional[str]
    start_country: Optional[str]
    start_lat: Optional[float]
    start_lon: Optional[float]
    end_city: Optional[str]
    end_street: Optional[str]
    end_postal_code: Optional[str]
    end_country: Optional[str]
    end_lat: Optional[float]
    end_lon: Optional[float]
    distance_km: float
    travel_time_s: Optional[float]
    fuel_liters: Optional[float]
    consumption_l_100km: Optional[float]
    price_fuel: Optional[float]
    cost: Optional[float]
    cost_per_km: Optional[float]
    category_label: Optional[str]

    class Config:
        from_attributes = True


class StatBucket(BaseModel):
    period: str
    label: str
    trip_count: int
    distance_km: float
    duration_min: float
    cost: float
    avg_consumption_l_100km: Optional[float]
    avg_fuel_price: Optional[float]
    avg_cost_per_km: Optional[float]


class RecurringRoute(BaseModel):
    start_label: str
    end_label: str
    start_lat: Optional[float]
    start_lon: Optional[float]
    end_lat: Optional[float]
    end_lon: Optional[float]
    trip_count: int
    avg_distance_km: float
    avg_duration_min: Optional[float]
    avg_cost: Optional[float]
    total_cost: Optional[float]
    first_date: datetime
    last_date: datetime


class RecordsOut(BaseModel):
    longest_distance: Optional[TripOut] = None
    priciest: Optional[TripOut] = None
    highest_consumption: Optional[TripOut] = None
    lowest_consumption: Optional[TripOut] = None
    fastest_avg_speed: Optional[TripOut] = None
    fastest_avg_speed_kmh: Optional[float] = None


class HeatPoint(BaseModel):
    lat: float
    lon: float


class ImportJobStarted(BaseModel):
    job_id: str
    total: int


class ImportJobStatus(BaseModel):
    status: str  # "running" | "done" | "error"
    processed: int
    total: int
    vehicles_imported: int
    trips_imported: int
    trips_skipped: int
    trips_anomalous: int = 0
    error: Optional[str] = None


class VehicleOut(BaseModel):
    id: int
    vin: str
    label: Optional[str]

    class Config:
        from_attributes = True
