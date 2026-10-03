from . import models, schemas
from .query_utils import as_utc


def trip_to_out(t: models.Trip) -> schemas.TripOut:
    cost_per_km = None
    if t.cost is not None and t.distance_km:
        cost_per_km = round(t.cost / t.distance_km, 3)

    return schemas.TripOut(
        id=t.id,
        external_id=t.external_id,
        vin=t.vehicle.vin,
        start_date=as_utc(t.start_date),
        end_date=as_utc(t.end_date),
        start_city=t.start_city,
        start_street=t.start_street,
        start_postal_code=t.start_postal_code,
        start_country=t.start_country,
        start_lat=t.start_lat,
        start_lon=t.start_lon,
        end_city=t.end_city,
        end_street=t.end_street,
        end_postal_code=t.end_postal_code,
        end_country=t.end_country,
        end_lat=t.end_lat,
        end_lon=t.end_lon,
        distance_km=t.distance_km,
        travel_time_s=t.travel_time_s,
        fuel_liters=t.fuel_liters,
        consumption_l_100km=t.consumption_l_100km,
        price_fuel=t.price_fuel,
        cost=t.cost,
        cost_per_km=cost_per_km,
        category_label=t.category_label,
    )
