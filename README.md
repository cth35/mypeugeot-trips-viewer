# Trajets — Tableau de bord Peugeot

Application complète (FastAPI + SQLite + React/Vite) pour visualiser l'export JSON de trajets Peugeot (MyPeugeot / PSA connectée), avec import de fichier, statistiques par jour/semaine/mois/année, liste de trajets filtrable et carte OpenStreetMap avec tracé estimé départ → arrivée.

## Démarrage

```bash
docker compose up --build
```

Puis ouvrez **http://localhost:8080**.

- Le frontend (Nginx + React) écoute sur le port `8080` et proxifie `/api` vers le backend.
- Le backend (FastAPI) écoute en interne sur `8000` et persiste les données dans un volume Docker (`trips_data`, fichier SQLite).
- Aucune donnée n'est envoyée à l'extérieur, à l'exception de l'appel navigateur vers le service public OSRM (`router.project-osrm.org`) pour calculer un itinéraire routier estimé entre le point de départ et le point d'arrivée d'un trajet sélectionné (les coordonnées GPS précises du trajet ne sont pas enregistrées par l'export d'origine, seuls les points de départ/arrivée le sont — le tracé affiché est donc **hypothétique**, pas le trajet réellement suivi).

## Utilisation

1. Cliquez sur **Importer un export JSON** (ou glissez-déposez le fichier) en haut de la page. Le fichier peut contenir un ou plusieurs véhicules (VIN), chacun avec sa liste de `trips`. Les imports sont cumulatifs et dédupliqués par identifiant de trajet — vous pouvez réimporter un export plus récent sans créer de doublons.
2. Choisissez la granularité (**Jour / Semaine / Mois / Année**), un véhicule et/ou une plage de dates : les indicateurs (coût, consommation moyenne, distance, durée) et le graphique se recalculent automatiquement.
3. La liste de trajets à gauche peut être filtrée par ville (départ ou arrivée) ; cliquez sur un trajet pour afficher son tracé sur la carte à droite.
4. **Effacer les données** vide entièrement la base (utile pour repartir d'un import propre).

## Hypothèse de calcul importante

Le champ `fuelConsumption` de l'export n'est pas documenté publiquement. En comparant les valeurs de l'exemple fourni (`734080` pour un trajet de 14,6 km), l'application part de l'hypothèse suivante :

```
carburant consommé (L) = fuelConsumption / 100 000
coût du trajet (€)     = carburant consommé (L) × priceFuel
consommation (L/100km) = carburant consommé (L) / distance (km) × 100
```

Si vos données donnent des valeurs de coût/consommation qui semblent incorrectes une fois importées, ce facteur est le seul endroit à ajuster : `backend/app/routers/import_data.py`, fonction `compute_fuel_liters`. Après modification, relancez `docker compose up --build backend` puis réimportez le fichier (ou effacez les données existantes au préalable si le facteur change rétroactivement le sens des valeurs déjà stockées).

Le facteur de conversion a été corrigé (`÷ 1 000 000`, vérifié empiriquement contre les valeurs affichées par l'app officielle). Si vous avez importé des données avec une version antérieure de cette app, effacez les données et réimportez votre fichier.

## Import de gros volumes de données

L'import se fait en tâche de fond avec suivi de progression : au clic (ou dépôt du fichier), une barre de progression (`X / Y trajets`) se met à jour pendant le traitement — adapté à des exports de plusieurs années.

## Valeurs aberrantes

Certains exports contiennent des trajets avec une distance ou une durée négative (reset d'odométrie, dates corrompues côté source…). Ces trajets sont conservés (date, ville, coût… restent affichés) mais la valeur négative est traitée comme **inconnue** plutôt que d'être devinée :
- distance négative → distance à 0 ;
- durée négative → durée « inconnue » (n'entre pas dans les totaux, s'affiche comme telle dans la liste des trajets).

Le résumé de l'import indique combien de trajets étaient concernés (`trips_anomalous`).

⚠️ **Important** : l'import est dédupliqué par identifiant de trajet. Si vous avez déjà importé des données avec une version antérieure de cette app (contenant un bug de calcul), réimporter le même fichier ne corrigera pas les lignes déjà en base — il faut d'abord cliquer sur **Effacer les données**, puis réimporter.

## Migration automatique du schéma

Cette app n'a pas de système de migration formel (base SQLite unique dans un volume Docker). Si une future mise à jour change une contrainte de colonne (par ex. `travel_time_s` est passé de `NOT NULL` à nullable au fil des versions), le backend détecte ce cas précis au démarrage et recrée automatiquement les tables concernées — les données déjà importées sont alors perdues, il suffit de réimporter votre fichier JSON d'origine.

## Structure du projet

```
peugeot-app/
├── docker-compose.yml
├── backend/            FastAPI + SQLAlchemy (SQLite)
│   └── app/
│       ├── main.py
│       ├── models.py / schemas.py / database.py
│       └── routers/    import_data.py, trips.py, stats.py
└── frontend/            React + Vite + Tailwind + Recharts + Leaflet
    └── src/
        ├── App.jsx
        └── components/  ImportPanel, PeriodSelector, StatsDashboard, TripList, TripMap
```

## Développement sans Docker (optionnel)

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

Le frontend en mode `npm run dev` proxifie déjà `/api` vers `http://backend:8000` (adaptez `vite.config.js` en `http://localhost:8000` si vous ne lancez pas le backend via Docker).

## Nouvelles statistiques

- **Trajets récurrents** : détection automatique des trajets répétés (même point de départ/arrivée, regroupés par coordonnées GPS arrondies à ~100 m, ou par ville/rue si les coordonnées sont absentes/invalides), typiquement le trajet domicile-travail.
- **Coût au km** (€/km) : affiché par trajet dans la liste, en KPI global, et par période dans le graphique.
- **Records** : trajet le plus long, le plus cher, conso la plus haute/basse, vitesse moyenne la plus élevée (distance ÷ durée) — cliquer sur une carte affiche ce trajet sur la carte.
- **Carte de chaleur** : bouton « Carte de chaleur » au-dessus de la carte, affichant la densité de tous les points de départ/arrivée sur la période filtrée (au lieu d'un seul trajet à la fois).

Ces quatre fonctionnalités respectent les filtres actifs (véhicule, plage de dates).

## Plage rapide (style Grafana)

Au-dessus des filtres, des boutons **Dernières 24h / 72h / 7 derniers jours / 30 derniers jours / 3 derniers mois / Tout** permettent de basculer rapidement la fenêtre de temps (avec ajustement automatique de la granularité du graphique). Les champs de date manuels restent disponibles pour une plage personnalisée ; les modifier désactive la sélection rapide en cours.

## Fuseau horaire

Les dates de l'export sont en UTC. L'API les renvoie désormais avec un suffixe `Z` explicite, ce qui permet au navigateur de les convertir automatiquement vers l'heure locale du poste qui consulte l'app (ex. heure française, UTC+1/+2 selon la saison) — les heures affichées dans la liste des trajets, les records et les trajets récurrents correspondent donc à l'heure locale réelle du trajet, pas à l'heure UTC brute.

## Corrections d'interface

- KPI "Nombre de trajets" ajouté en haut du tableau de bord.
- Axes du graphique distance/coût élargis pour ne plus tronquer les valeurs à 4 chiffres.
- Liste des trajets : date avec année, colonnes (distance, durée, conso, coût, coût/km) alignées verticalement comme un tableau.
- Cliquer sur une carte "Records" affiche le trajet sur la carte **et** le surligne/scrolle jusqu'à lui dans la liste ; s'il est en dehors de la page actuellement chargée, il est épinglé en haut de la liste avec une étiquette dédiée.
- Sur les deux cartes (trajet et carte de chaleur), le zoom à la molette nécessite désormais **Ctrl (ou Cmd) + molette** — un indice s'affiche brièvement si vous scrollez sans Ctrl, pour éviter de zoomer accidentellement en faisant défiler la page.

## Géocodage d'adresse en secours (GPS manquant)

Certains trajets ont des coordonnées GPS à `-1, -1` (pas de fix GPS au démarrage — courant après une longue coupure moteur, ex. retour de vacances). Quand c'est le cas mais que l'adresse (rue, ville, code postal, pays) est renseignée, l'app interroge le service de géocodage **Nominatim** (OpenStreetMap) pour obtenir une position approximative :
- le marqueur correspondant est affiché avec un contour en pointillés (au lieu d'un point plein) pour signaler qu'il s'agit d'une position approximative, pas d'un relevé GPS exact ;
- le résultat est mis en cache côté backend (nouvelle table `geocode_cache`), donc une même adresse n'est interrogée qu'une seule fois ;
- si aucune adresse n'est disponible non plus, le message « Coordonnées indisponibles » reste affiché.

Cette fonctionnalité nécessite que le conteneur backend ait accès à Internet (`nominatim.openstreetmap.org`), comme c'est déjà le cas pour le calcul d'itinéraire OSRM. Deux nouvelles colonnes (code postal, pays) ont été ajoutées à la table des trajets ; la migration automatique au démarrage les ajoute sans perte de données existantes.

## Zoom Ctrl+molette plus fluide

Le zoom Ctrl+molette utilise maintenant le gestionnaire natif de Leaflet (activé/désactivé selon l'état réel de la touche Ctrl via `keydown`/`keyup`) au lieu d'un recalcul manuel du zoom à chaque tick de molette — fini les sauts brusques, le zoom est animé comme un zoom Leaflet classique.
