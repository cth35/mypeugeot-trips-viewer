from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from .database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    vin = Column(String, unique=True, index=True, nullable=False)
    label = Column(String, nullable=True)

    trips = relationship("Trip", back_populates="vehicle", cascade="all, delete-orphan")


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (UniqueConstraint("vehicle_id", "external_id", name="uq_vehicle_trip"),)

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    external_id = Column(Integer, nullable=False)

    start_date = Column(DateTime, index=True, nullable=False)
    end_date = Column(DateTime, nullable=True)

    start_city = Column(String, nullable=True)
    start_street = Column(String, nullable=True)
    start_postal_code = Column(String, nullable=True)
    start_country = Column(String, nullable=True)
    start_lat = Column(Float, nullable=True)
    start_lon = Column(Float, nullable=True)
    start_mileage = Column(Float, nullable=True)

    end_city = Column(String, nullable=True)
    end_street = Column(String, nullable=True)
    end_postal_code = Column(String, nullable=True)
    end_country = Column(String, nullable=True)
    end_lat = Column(Float, nullable=True)
    end_lon = Column(Float, nullable=True)
    end_mileage = Column(Float, nullable=True)

    distance_km = Column(Float, nullable=False, default=0)
    travel_time_s = Column(Float, nullable=True)
    fuel_consumption_raw = Column(Float, nullable=True)
    fuel_liters = Column(Float, nullable=True)
    consumption_l_100km = Column(Float, nullable=True)
    price_fuel = Column(Float, nullable=True)
    cost = Column(Float, nullable=True)
    category_label = Column(String, nullable=True)

    vehicle = relationship("Vehicle", back_populates="trips")


class GeocodeCache(Base):
    """Caches address -> (lat, lon) lookups so the same street/city is never
    sent to the Nominatim geocoding service twice. A row with lat/lon = NULL
    means "looked up, no result" (also cached, to avoid repeatedly querying
    for an address that doesn't resolve)."""

    __tablename__ = "geocode_cache"

    id = Column(Integer, primary_key=True, index=True)
    query_key = Column(String, unique=True, index=True, nullable=False)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    resolved_at = Column(DateTime, nullable=False)
