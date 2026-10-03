from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .database import Base, engine
from .routers import import_data, trips, stats, geocode


def _ensure_schema():
    """This app has no formal migration system (SQLite + a single Docker
    volume). `Base.metadata.create_all` only creates missing tables, it never
    alters an existing one. Two kinds of drift are handled here:
    - a stale column *constraint* (e.g. `travel_time_s` used to be NOT NULL):
      SQLite can't relax that in place, so the affected tables are dropped
      and recreated fresh (trip data can always be re-imported);
    - a *missing column* added in a later version (e.g. postal code/country):
      SQLite supports `ALTER TABLE ... ADD COLUMN` for a nullable column, so
      those are added in place without touching existing data."""
    inspector = inspect(engine)
    if "trips" not in inspector.get_table_names():
        return

    columns = {c["name"]: c for c in inspector.get_columns("trips")}

    travel_time_col = columns.get("travel_time_s")
    if travel_time_col is not None and travel_time_col["nullable"] is False:
        with engine.begin() as conn:
            conn.execute(text("DROP TABLE IF EXISTS trips"))
            conn.execute(text("DROP TABLE IF EXISTS vehicles"))
        return  # columns will be recreated from scratch below by create_all

    expected_new_columns = {
        "start_postal_code": "VARCHAR",
        "start_country": "VARCHAR",
        "end_postal_code": "VARCHAR",
        "end_country": "VARCHAR",
    }
    missing = [name for name in expected_new_columns if name not in columns]
    if missing:
        with engine.begin() as conn:
            for name in missing:
                conn.execute(
                    text(f"ALTER TABLE trips ADD COLUMN {name} {expected_new_columns[name]}")
                )


_ensure_schema()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Peugeot Trips API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(import_data.router)
app.include_router(trips.router)
app.include_router(stats.router)
app.include_router(geocode.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
