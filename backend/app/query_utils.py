from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session, Query

from . import models


def base_trip_query(
    db: Session,
    vin: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> Query:
    query = db.query(models.Trip).join(models.Vehicle)
    if vin:
        query = query.filter(models.Vehicle.vin == vin)
    if date_from:
        query = query.filter(models.Trip.start_date >= date_from)
    if date_to:
        query = query.filter(models.Trip.start_date <= date_to)
    return query


def valid_coord(lat, lon) -> bool:
    """True when (lat, lon) looks like a real GPS fix rather than one of the
    sentinel/placeholder values seen in the export (-1/-1 for "unknown",
    0/0 for an empty "destination" block)."""
    return (
        lat is not None
        and lon is not None
        and not (lat == -1 and lon == -1)
        and not (lat == 0 and lon == 0)
        and -90 <= lat <= 90
        and -180 <= lon <= 180
    )


def as_utc(dt):
    """Trip timestamps are stored as naive datetimes representing UTC (the
    export's dates all end in "Z"). SQLite drops timezone info on write, so
    without this the API would serialize e.g. "13:57:00" with no offset,
    which browsers parse as *local* time instead of UTC — showing the raw
    UTC hour instead of converting it to the viewer's real local time.
    Attaching tzinfo here makes the JSON output carry an explicit "+00:00"
    offset, which `new Date(...)` parses correctly."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
