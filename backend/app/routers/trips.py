from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..database import get_db
from .. import models, schemas
from ..query_utils import base_trip_query
from ..serializers import trip_to_out

router = APIRouter(prefix="/api", tags=["trips"])


@router.get("/vehicles", response_model=List[schemas.VehicleOut])
def list_vehicles(db: Session = Depends(get_db)):
    return db.query(models.Vehicle).all()


@router.get("/trips", response_model=List[schemas.TripOut])
def list_trips(
    db: Session = Depends(get_db),
    vin: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    q: Optional[str] = Query(None, description="Recherche libre sur les villes"),
    sort: str = "start_date",
    order: str = "desc",
    limit: int = 500,
    offset: int = 0,
):
    query = base_trip_query(db, vin, date_from, date_to)

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(models.Trip.start_city.ilike(like), models.Trip.end_city.ilike(like))
        )

    sort_col = getattr(models.Trip, sort, models.Trip.start_date)
    query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())

    trips = query.offset(offset).limit(limit).all()
    return [trip_to_out(t) for t in trips]


@router.delete("/trips")
def delete_all_trips(db: Session = Depends(get_db)):
    db.query(models.Trip).delete()
    db.query(models.Vehicle).delete()
    db.commit()
    return {"status": "ok"}
