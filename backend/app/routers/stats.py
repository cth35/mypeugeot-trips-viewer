from datetime import datetime
from typing import Optional, List
from collections import OrderedDict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..query_utils import base_trip_query, valid_coord, as_utc
from ..serializers import trip_to_out

router = APIRouter(prefix="/api/stats", tags=["stats"])


def bucket_key(dt: datetime, period: str):
    if period == "day":
        return dt.strftime("%Y-%m-%d"), dt.strftime("%d %b %Y")
    if period == "week":
        iso = dt.isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}", f"Semaine {iso[1]} - {iso[0]}"
    if period == "month":
        return dt.strftime("%Y-%m"), dt.strftime("%b %Y")
    if period == "year":
        return dt.strftime("%Y"), dt.strftime("%Y")
    raise ValueError("période invalide")


@router.get("", response_model=List[schemas.StatBucket])
def get_stats(
    db: Session = Depends(get_db),
    period: str = Query("month", pattern="^(day|week|month|year)$"),
    vin: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
):
    trips = base_trip_query(db, vin, date_from, date_to).order_by(
        models.Trip.start_date.asc()
    ).all()

    buckets: "OrderedDict[str, dict]" = OrderedDict()
    for t in trips:
        key, label = bucket_key(t.start_date, period)
        if key not in buckets:
            buckets[key] = {
                "period": key,
                "label": label,
                "trip_count": 0,
                "distance_km": 0.0,
                "duration_min": 0.0,
                "cost": 0.0,
                "fuel_liters": 0.0,
            }
        b = buckets[key]
        b["trip_count"] += 1
        b["distance_km"] += t.distance_km or 0
        b["duration_min"] += (t.travel_time_s or 0) / 60.0
        b["cost"] += t.cost or 0
        b["fuel_liters"] += t.fuel_liters or 0

    result = []
    for b in buckets.values():
        avg_consumption = None
        avg_fuel_price = None
        avg_cost_per_km = None
        if b["distance_km"]:
            avg_consumption = round(b["fuel_liters"] / b["distance_km"] * 100, 2)
            avg_cost_per_km = round(b["cost"] / b["distance_km"], 3)
        if b["fuel_liters"]:
            avg_fuel_price = round(b["cost"] / b["fuel_liters"], 3)
        result.append(
            schemas.StatBucket(
                period=b["period"],
                label=b["label"],
                trip_count=b["trip_count"],
                distance_km=round(b["distance_km"], 2),
                duration_min=round(b["duration_min"], 1),
                cost=round(b["cost"], 2),
                avg_consumption_l_100km=avg_consumption,
                avg_fuel_price=avg_fuel_price,
                avg_cost_per_km=avg_cost_per_km,
            )
        )
    return result


@router.get("/recurring", response_model=List[schemas.RecurringRoute])
def get_recurring_routes(
    db: Session = Depends(get_db),
    vin: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    min_occurrences: int = Query(2, ge=2),
    limit: int = Query(15, ge=1, le=100),
):
    trips = base_trip_query(db, vin, date_from, date_to).all()

    def route_key(t):
        if valid_coord(t.start_lat, t.start_lon) and valid_coord(t.end_lat, t.end_lon):
            return (
                round(t.start_lat, 3),
                round(t.start_lon, 3),
                round(t.end_lat, 3),
                round(t.end_lon, 3),
            )
        if t.start_city and t.end_city:
            return (t.start_city, t.start_street or "", t.end_city, t.end_street or "")
        return None

    groups: dict = {}
    for t in trips:
        key = route_key(t)
        if key is None:
            continue
        groups.setdefault(key, []).append(t)

    routes = []
    for ts in groups.values():
        if len(ts) < min_occurrences:
            continue
        ref = ts[0]
        distances = [t.distance_km for t in ts if t.distance_km]
        durations = [t.travel_time_s for t in ts if t.travel_time_s]
        costs = [t.cost for t in ts if t.cost is not None]
        routes.append(
            schemas.RecurringRoute(
                start_label=f"{ref.start_street or ''} {ref.start_city or '?'}".strip(),
                end_label=f"{ref.end_street or ''} {ref.end_city or '?'}".strip(),
                start_lat=ref.start_lat if valid_coord(ref.start_lat, ref.start_lon) else None,
                start_lon=ref.start_lon if valid_coord(ref.start_lat, ref.start_lon) else None,
                end_lat=ref.end_lat if valid_coord(ref.end_lat, ref.end_lon) else None,
                end_lon=ref.end_lon if valid_coord(ref.end_lat, ref.end_lon) else None,
                trip_count=len(ts),
                avg_distance_km=round(sum(distances) / len(distances), 2) if distances else 0.0,
                avg_duration_min=round(sum(durations) / len(durations) / 60, 1) if durations else None,
                avg_cost=round(sum(costs) / len(costs), 2) if costs else None,
                total_cost=round(sum(costs), 2) if costs else None,
                first_date=as_utc(min(t.start_date for t in ts)),
                last_date=as_utc(max(t.start_date for t in ts)),
            )
        )

    routes.sort(key=lambda r: r.trip_count, reverse=True)
    return routes[:limit]


@router.get("/records", response_model=schemas.RecordsOut)
def get_records(
    db: Session = Depends(get_db),
    vin: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
):
    trips = base_trip_query(db, vin, date_from, date_to).all()
    if not trips:
        return schemas.RecordsOut()

    longest = max(trips, key=lambda t: t.distance_km or 0, default=None)

    priced = [t for t in trips if t.cost is not None]
    priciest = max(priced, key=lambda t: t.cost, default=None) if priced else None

    with_consumption = [t for t in trips if t.consumption_l_100km is not None]
    highest_consumption = (
        max(with_consumption, key=lambda t: t.consumption_l_100km) if with_consumption else None
    )
    lowest_consumption = (
        min(with_consumption, key=lambda t: t.consumption_l_100km) if with_consumption else None
    )

    speed_candidates = [
        (t, t.distance_km / (t.travel_time_s / 3600))
        for t in trips
        if t.travel_time_s and t.travel_time_s > 0 and t.distance_km and t.distance_km > 0
    ]
    fastest_trip, fastest_kmh = max(speed_candidates, key=lambda pair: pair[1], default=(None, None))

    return schemas.RecordsOut(
        longest_distance=trip_to_out(longest) if longest else None,
        priciest=trip_to_out(priciest) if priciest else None,
        highest_consumption=trip_to_out(highest_consumption) if highest_consumption else None,
        lowest_consumption=trip_to_out(lowest_consumption) if lowest_consumption else None,
        fastest_avg_speed=trip_to_out(fastest_trip) if fastest_trip else None,
        fastest_avg_speed_kmh=round(fastest_kmh, 1) if fastest_kmh else None,
    )


@router.get("/heatmap", response_model=List[schemas.HeatPoint])
def get_heatmap(
    db: Session = Depends(get_db),
    vin: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
):
    trips = base_trip_query(db, vin, date_from, date_to).all()
    points = []
    for t in trips:
        if valid_coord(t.start_lat, t.start_lon):
            points.append(schemas.HeatPoint(lat=t.start_lat, lon=t.start_lon))
        if valid_coord(t.end_lat, t.end_lon):
            points.append(schemas.HeatPoint(lat=t.end_lat, lon=t.end_lon))
    return points
