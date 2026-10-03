import json
import threading
import uuid
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, HTTPException

from ..database import SessionLocal
from .. import models, schemas

router = APIRouter(prefix="/api/import", tags=["import"])

# In-memory job store. This app is meant to run as a single instance for
# personal use, so a process-local dict is enough to track import progress
# without adding a queue/broker dependency.
_jobs_lock = threading.Lock()
_jobs: dict[str, dict] = {}


def parse_date(value):
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def compute_fuel_liters(fuel_consumption_raw):
    """The Peugeot export encodes fuel used per trip as an integer in
    millionths of a litre (empirically verified against the official app:
    233840 -> 0.23384 L, which reproduces the app's 6.2 L/100km and 0.278 EUR
    for a 3.80 km trip at 1.19 EUR/L). Divide by 1,000,000 to obtain litres."""
    if fuel_consumption_raw is None or fuel_consumption_raw < 0:
        return None
    return fuel_consumption_raw / 1_000_000.0


def _update_job(job_id: str, **kwargs):
    with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id].update(kwargs)


def _run_import(job_id: str, data: list):
    db = SessionLocal()
    vehicles_imported = 0
    trips_imported = 0
    trips_skipped = 0
    trips_anomalous = 0
    processed = 0

    try:
        for vehicle_data in data:
            vin = vehicle_data.get("vin") if isinstance(vehicle_data, dict) else None
            raw_trips = vehicle_data.get("trips", []) if isinstance(vehicle_data, dict) else []

            if not vin:
                processed += len(raw_trips)
                trips_skipped += len(raw_trips)
                _update_job(job_id, processed=processed, trips_skipped=trips_skipped)
                continue

            vehicle = db.query(models.Vehicle).filter(models.Vehicle.vin == vin).first()
            if not vehicle:
                vehicle = models.Vehicle(vin=vin)
                db.add(vehicle)
                db.flush()
                vehicles_imported += 1

            seen_ids = {
                row[0]
                for row in db.query(models.Trip.external_id).filter(
                    models.Trip.vehicle_id == vehicle.id
                )
            }

            for i, trip in enumerate(raw_trips):
                processed += 1
                external_id = trip.get("id")

                if external_id is None or external_id in seen_ids:
                    trips_skipped += 1
                else:
                    start = trip.get("start") or {}
                    end = trip.get("end") or {}
                    start_date = parse_date(start.get("date"))

                    if not start_date:
                        trips_skipped += 1
                    else:
                        # Defensive handling: the export occasionally contains
                        # a negative distance or duration (odometer resets,
                        # source data bugs with swapped/corrupted
                        # timestamps...). Rather than trying to reconstruct a
                        # plausible value, a negative value is simply treated
                        # as unknown: the trip is kept (start date, city,
                        # cost, etc. are unaffected) but its distance/duration
                        # become null instead of a fabricated number.
                        raw_distance = trip.get("distance") or 0
                        raw_travel_time = trip.get("travelTime") or 0
                        end_date_val = parse_date(end.get("date"))

                        distance_km = raw_distance if raw_distance > 0 else 0
                        travel_time_s = raw_travel_time if raw_travel_time > 0 else None

                        anomalous = raw_distance < 0 or raw_travel_time < 0
                        if anomalous:
                            trips_anomalous += 1

                        fuel_raw = trip.get("fuelConsumption")
                        fuel_liters = compute_fuel_liters(fuel_raw)
                        price_fuel = trip.get("priceFuel")
                        cost = None
                        if fuel_liters is not None and price_fuel is not None:
                            cost = round(fuel_liters * price_fuel, 4)
                        consumption = None
                        if fuel_liters is not None and distance_km:
                            consumption = round(fuel_liters / distance_km * 100, 2)

                        db_trip = models.Trip(
                            vehicle_id=vehicle.id,
                            external_id=external_id,
                            start_date=start_date,
                            end_date=end_date_val,
                            start_city=start.get("city"),
                            start_street=start.get("street"),
                            start_postal_code=start.get("postalCode"),
                            start_country=start.get("country"),
                            start_lat=start.get("latitude"),
                            start_lon=start.get("longitude"),
                            start_mileage=start.get("mileage"),
                            end_city=end.get("city"),
                            end_street=end.get("street"),
                            end_postal_code=end.get("postalCode"),
                            end_country=end.get("country"),
                            end_lat=end.get("latitude"),
                            end_lon=end.get("longitude"),
                            end_mileage=end.get("mileage"),
                            distance_km=distance_km,
                            travel_time_s=travel_time_s,
                            fuel_consumption_raw=fuel_raw,
                            fuel_liters=fuel_liters,
                            consumption_l_100km=consumption,
                            price_fuel=price_fuel,
                            cost=cost,
                            category_label=trip.get("categoryLabel"),
                        )
                        db.add(db_trip)
                        seen_ids.add(external_id)
                        trips_imported += 1

                if i % 100 == 0 or i == len(raw_trips) - 1:
                    _update_job(
                        job_id,
                        processed=processed,
                        vehicles_imported=vehicles_imported,
                        trips_imported=trips_imported,
                        trips_skipped=trips_skipped,
                        trips_anomalous=trips_anomalous,
                    )

            db.commit()
            _update_job(
                job_id,
                processed=processed,
                vehicles_imported=vehicles_imported,
                trips_imported=trips_imported,
                trips_skipped=trips_skipped,
                trips_anomalous=trips_anomalous,
            )

        _update_job(job_id, status="done")
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        _update_job(job_id, status="error", error=str(exc))
    finally:
        db.close()


@router.post("", response_model=schemas.ImportJobStarted)
async def import_file(file: UploadFile = File(...)):
    raw = await file.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"JSON invalide : {exc}")

    if isinstance(data, dict):
        data = [data]
    if not isinstance(data, list):
        raise HTTPException(
            status_code=400,
            detail="Format JSON inattendu : une liste de véhicules est attendue.",
        )

    total_trips = sum(
        len(v.get("trips", [])) for v in data if isinstance(v, dict)
    )

    job_id = uuid.uuid4().hex
    with _jobs_lock:
        _jobs[job_id] = {
            "status": "running",
            "processed": 0,
            "total": total_trips,
            "vehicles_imported": 0,
            "trips_imported": 0,
            "trips_skipped": 0,
            "trips_anomalous": 0,
            "error": None,
        }

    thread = threading.Thread(target=_run_import, args=(job_id, data), daemon=True)
    thread.start()

    return schemas.ImportJobStarted(job_id=job_id, total=total_trips)


@router.get("/{job_id}", response_model=schemas.ImportJobStatus)
def import_status(job_id: str):
    with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import introuvable.")
    return schemas.ImportJobStatus(**job)
