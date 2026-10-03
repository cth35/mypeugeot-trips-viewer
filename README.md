# Trajets — Tableau de bord Peugeot

Application self-hosted pour visualiser l'historique de trajets exporté depuis MyPeugeot (ou toute app connectée PSA/Stellantis au même format JSON) : import de fichier, statistiques par jour/semaine/mois/année, carte avec tracé estimé, trajets récurrents, records, et carte de chaleur des zones parcourues.

![Stack](https://img.shields.io/badge/backend-FastAPI%20%2B%20SQLite-009688) ![Stack](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB) ![Docker](https://img.shields.io/badge/deploy-docker%20compose-2496ED)

## Fonctionnalités

- **Import de fichier JSON** avec barre de progression (import en tâche de fond, adapté à plusieurs années de données), déduplication automatique par identifiant de trajet.
- **Statistiques par période** : Jour / Semaine / Mois / Année, avec sélecteur de plage rapide façon Grafana (24h, 72h, 7j, 30j, 3 mois, tout).
- **KPI** : nombre de trajets, coût carburant, coût au km, consommation moyenne, distance, durée cumulée.
- **Graphiques** : distance & coût par période, évolution du prix moyen du carburant.
- **Trajets récurrents** : détection automatique des trajets répétés (même point de départ/arrivée), typiquement le trajet domicile-travail.
- **Records** : trajet le plus long, le plus cher, consommation la plus haute/basse, vitesse moyenne la plus élevée.
- **Liste de trajets filtrable** (par ville), avec tri et pagination.
- **Carte OpenStreetMap** : tracé routier estimé (OSRM) entre les points de départ/arrivée du trajet sélectionné, avec repli automatique sur un géocodage d'adresse (Nominatim) quand le GPS du trajet est manquant.
- **Carte de chaleur** de toutes les zones parcourues sur la période filtrée.
- Thème sombre, zoom carte au Ctrl+molette (pour ne pas interférer avec le défilement de la page).

## Démarrage

```bash
docker compose up --build
```

Puis ouvrez **http://localhost:8095**.

- Frontend (Nginx + React) sur le port `8095`, proxifie `/api` vers le backend.
- Backend (FastAPI) en interne sur `8000`, persiste les données dans un volume Docker nommé (SQLite).
- Un fichier `sample-export.json` est fourni pour tester l'import immédiatement.

## Utilisation

1. **Importer** un export JSON (glisser-déposer ou clic sur le bouton). Le fichier peut contenir plusieurs véhicules (VIN), chacun avec sa liste de trajets.
2. Choisir une **granularité** (Jour/Semaine/Mois/Année) ou une **plage rapide**, filtrer par véhicule et/ou dates.
3. Parcourir la **liste de trajets** (filtrable par ville) ou les panneaux **Trajets récurrents** / **Records** — cliquer sur un trajet l'affiche sur la carte.
4. Basculer entre **Trajet sélectionné** et **Carte de chaleur** au-dessus de la carte.
5. **Effacer les données** vide la base pour repartir d'un import propre.

## Architecture

```
.
├── docker-compose.yml
├── sample-export.json
├── backend/                FastAPI + SQLAlchemy (SQLite)
│   └── app/
│       ├── main.py          point d'entrée + migration légère au démarrage
│       ├── models.py        Vehicle, Trip, GeocodeCache
│       ├── schemas.py       schémas Pydantic (API)
│       ├── query_utils.py   filtres communs, validation de coordonnées
│       ├── serializers.py   Trip -> schéma de sortie
│       └── routers/
│           ├── import_data.py   import JSON en tâche de fond (progression)
│           ├── trips.py         liste/filtre/suppression des trajets
│           ├── stats.py         agrégats, trajets récurrents, records, heatmap
│           └── geocode.py       géocodage d'adresse (Nominatim) avec cache
└── frontend/                React + Vite + Tailwind + Recharts + Leaflet
    └── src/
        ├── App.jsx
        └── components/
            ├── ImportPanel.jsx        import + barre de progression
            ├── QuickRangeSelector.jsx plage rapide façon Grafana
            ├── PeriodSelector.jsx     granularité jour/semaine/mois/année
            ├── StatsDashboard.jsx     KPI + graphiques
            ├── RecurringRoutes.jsx    trajets récurrents
            ├── RecordsPanel.jsx       records
            ├── TripList.jsx           liste filtrable, alignée en colonnes
            ├── TripMap.jsx            carte d'un trajet (OSRM + géocodage)
            ├── HeatMap.jsx            carte de chaleur
            └── CtrlScrollZoom.jsx     zoom carte au Ctrl+molette
```

## Notes techniques

### Conversion carburant

Le champ `fuelConsumption` de l'export n'est pas documenté officiellement. Vérifié empiriquement contre l'app MyPeugeot (233840 → 6.2 L/100km et 0.278 € pour un trajet de 3.80 km à 1.19 €/L) :

```
carburant consommé (L) = fuelConsumption / 1 000 000
coût du trajet (€)     = carburant consommé (L) × priceFuel
consommation (L/100km) = carburant consommé (L) / distance (km) × 100
```

### Valeurs aberrantes

Certains trajets ont une distance ou une durée négative (dates corrompues côté source, resets d'odométrie…). Ces trajets sont conservés (date, ville, coût…) mais la valeur négative devient **inconnue** plutôt que d'être devinée — elle n'entre pas dans les totaux et s'affiche comme telle dans la liste.

### Coordonnées GPS manquantes

Certains trajets ont des coordonnées à `-1, -1` (pas de fix GPS au démarrage). Si l'adresse est renseignée, l'app géocode via **Nominatim** (OpenStreetMap) et affiche un marqueur en pointillés pour signaler une position approximative. Les résultats sont mis en cache en base (table `geocode_cache`).

### Fuseau horaire

Les dates de l'export sont en UTC. L'API les renvoie avec un suffixe `Z` explicite ; le navigateur les convertit automatiquement vers l'heure locale de l'utilisateur.

### Migration de schéma

Pas de système de migration formel (SQLite + volume Docker unique). Au démarrage, le backend détecte et corrige deux types de dérive par rapport au modèle courant :
- une **colonne manquante** (ajout récent) → ajoutée en place via `ALTER TABLE ... ADD COLUMN`, sans perte de données ;
- une **contrainte obsolète** (ex. colonne passée de `NOT NULL` à nullable) → la table concernée est recréée (il faut alors réimporter le fichier JSON d'origine).

## Limites connues

- Base SQLite mono-fichier : adapté à un usage personnel/single-user, pas à plusieurs utilisateurs concurrents en écriture.
- Liste de trajets limitée à 500 résultats par défaut (pagination simple, pas de virtualisation) ; un trajet sélectionné hors de cette page s'affiche épinglé en haut de la liste.
- Le géocodage et le tracé OSRM dépendent de services publics tiers (Nominatim, OSRM demo server) : limiter la fréquence d'usage et prévoir une dégradation possible si ces services sont indisponibles.

## Développement sans Docker

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# frontend (autre terminal)
cd frontend
npm install
npm run dev
```

En mode `npm run dev`, le frontend proxifie `/api` vers `http://backend:8000` (adapter `vite.config.js` en `http://localhost:8000` si le backend n'est pas lancé via Docker).

## License

Projet personnel, sans licence spécifique définie — à adapter selon vos besoins si vous le rendez public.
