from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models

router = APIRouter(prefix="/api/geocode", tags=["geocode"])

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
# Nominatim's usage policy requires a way to identify the application/contact
# making requests; this app is self-hosted for personal use, so a generic
# identifying string is used rather than a specific contact address.
USER_AGENT = "peugeot-trips-app/1.0 (self-hosted personal trip viewer)"


def _cache_key(street: str, city: str, postal_code: str, country: str) -> str:
    return "|".join(
        part.strip().lower()
        for part in (street or "", city or "", postal_code or "", country or "")
    )


@router.get("")
async def geocode(
    db: Session = Depends(get_db),
    street: str = "",
    city: str = "",
    postal_code: str = "",
    country: str = "",
):
    if not street and not city:
        raise HTTPException(status_code=400, detail="Adresse insuffisante pour géocoder.")

    key = _cache_key(street, city, postal_code, country)
    cached = (
        db.query(models.GeocodeCache)
        .filter(models.GeocodeCache.query_key == key)
        .first()
    )
    if cached:
        if cached.lat is None or cached.lon is None:
            raise HTTPException(
                status_code=404, detail="Adresse introuvable (résultat déjà en cache)."
            )
        return {"lat": cached.lat, "lon": cached.lon, "cached": True}

    params = {
        k: v
        for k, v in {
            "format": "json",
            "limit": "1",
            "street": street,
            "city": city,
            "postalcode": postal_code,
            "country": country,
        }.items()
        if v
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                NOMINATIM_URL, params=params, headers={"User-Agent": USER_AGENT}
            )
            resp.raise_for_status()
            results = resp.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail=f"Erreur du service de géocodage : {exc}"
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if not results:
        db.add(models.GeocodeCache(query_key=key, lat=None, lon=None, resolved_at=now))
        db.commit()
        raise HTTPException(status_code=404, detail="Adresse introuvable.")

    lat = float(results[0]["lat"])
    lon = float(results[0]["lon"])
    db.add(models.GeocodeCache(query_key=key, lat=lat, lon=lon, resolved_at=now))
    db.commit()
    return {"lat": lat, "lon": lon, "cached": False}
