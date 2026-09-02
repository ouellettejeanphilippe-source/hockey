#!/usr/bin/env python3
"""
Bâtit les shards de saison a partir de l'API officielle de la LNH.

    python3 scripts/build_shards.py
    python3 scripts/build_shards.py --start 1970 --end 2026 --min-gp 10
    python3 scripts/build_shards.py --only 1981-82 1993-94   # refaire 2 saisons
    python3 scripts/build_shards.py --force                  # tout rebatir, meme a jour
    python3 scripts/build_shards.py --seed-only              # juste data/seed.json
    python3 scripts/build_shards.py --bios-only              # ~110 requetes : ajoute les
        # dates de naissance (bd) aux shards existants, puis --rerate
    python3 scripts/build_shards.py --rerate                 # sans API : refaire
        # cote globale, salaires, archetypes, zones et contrats d'entree
        # sur les shards existants (scripts/rerate.mjs), puis index et seed

Ecrit data/seasons/<saison>.json, data/index.json et data/seed.json.
Aucune dependance Python. Requiert Node pour le calcul des cotes
(scripts/rate.mjs appelle js/ratings.js, la meme implementation que le
navigateur -- une seule formule, un seul endroit a corriger).

Salaires reels : si data/salaries/<saison>.json existe
({"cap": <plafond ou plus gros budget d'equipe>, "players": {"<playerId>": <salaire>}}),
ces salaires remplacent le bareme, au prorata du plafond de l'annee.

Apres chaque build, scripts/rerate.mjs repasse sur tous les shards pour
poser les contrats d'entree (premiere saison de chaque joueur dans la
base), ce qui exige de connaitre toutes les saisons.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SEASONS_DIR = os.path.join(DATA, "seasons")
SALARIES_DIR = os.path.join(DATA, "salaries")
BASE = "https://api.nhle.com/stats/rest/en"
UA = {"User-Agent": "Mozilla/5.0 (cap82-build)"}

# Saisons du seed hors ligne : varier les epoques et inclure des franchises disparues
SEED_SEASONS = [
    "1970-71", "1976-77", "1981-82", "1985-86", "1992-93",
    "1995-96", "2001-02", "2007-08", "2015-16", "2022-23",
]


def api(path, params, tries=4):
    url = f"{BASE}/{path}?" + urllib.parse.urlencode(params)
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8")).get("data", [])
        except Exception as e:
            if attempt == tries - 1:
                print(f"    echec {path}: {e}", file=sys.stderr)
                return []
            time.sleep(2 * (attempt + 1))
    return []


def fetch_season(year, min_gp):
    sid = f"{year}{year + 1}"
    exp = f"seasonId={sid} and gameTypeId=2"
    fact = f"gamesPlayed>={min_gp}"

    skaters = api("skater/summary",
                  {"limit": -1, "sort": "points", "cayenneExp": exp, "factCayenneExp": fact})
    goalies = api("goalie/summary",
                  {"limit": -1, "sort": "wins", "cayenneExp": exp, "factCayenneExp": fact})

    realtime = None
    if year >= 2005:
        rows = api("skater/realtime", {"limit": -1, "sort": "hits", "cayenneExp": exp})
        if rows:
            realtime = {str(r["playerId"]): r for r in rows if r.get("playerId")}

    # Annee de naissance (contrats d'entree selon l'age). Facultatif : si le
    # point bios ne repond pas, js/ratings.js retombe sur la cohorte
    # d'identifiant (scripts/rerate.mjs).
    births = fetch_bios(year)
    for r in skaters + goalies:
        if r.get("playerId") in births:
            r["birthDate"] = births[r["playerId"]]

    return skaters, goalies, realtime


def fetch_bios(year):
    """{ playerId: 'AAAA-MM-JJ' } pour les patineurs et gardiens de la saison."""
    exp = f"seasonId={year}{year + 1} and gameTypeId=2"
    births = {}
    for path in ("skater/bios", "goalie/bios"):
        for r in api(path, {"limit": -1, "sort": "playerId", "cayenneExp": exp}):
            bd = r.get("birthDate")
            if r.get("playerId") and bd and str(bd)[:4].isdigit():
                births[r["playerId"]] = str(bd)[:10]
    return births


def patch_bios(labels):
    """Ajoute la date de naissance (bd) aux shards existants sans refaire les cotes."""
    for label in labels:
        path = os.path.join(SEASONS_DIR, f"{label}.json")
        if not os.path.exists(path):
            continue
        print(f"{label}  bios ...", end=" ", flush=True)
        births = fetch_bios(int(label[:4]))
        if not births:
            print("aucune donnee")
            continue
        with open(path, encoding="utf-8") as f:
            shard = json.load(f)
        n = 0
        for p in shard["players"]:
            if p.get("id") in births:
                p["bd"] = births[p["id"]]
                n += 1
        with open(path, "w", encoding="utf-8") as f:
            json.dump(shard, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{n} dates de naissance")
        time.sleep(0.35)


def ratings_version():
    """RATINGS_VERSION lu dans js/ratings.js, la source unique des cotes.

    Sert a decider si un shard deja sur le disque a ete bati avec la formule
    courante. On lit la valeur au lieu de la recopier ici : deux definitions
    divergeraient en silence, ce que tout le reste du projet evite deja.
    """
    out = subprocess.run(
        ["node", "-e",
         "import('./js/ratings.js').then(m => console.log(m.RATINGS_VERSION))"],
        cwd=ROOT, capture_output=True, text=True, check=True)
    return int(out.stdout.strip())


def load_salaries(label):
    """Salaires reels publies pour une saison, s'ils existent (voir docstring)."""
    path = os.path.join(SALARIES_DIR, f"{label}.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return {"cap": raw.get("cap"), "players": raw.get("players", {})}


def rerate_all():
    """Etage 2 des cotes sur tous les shards (contrats d'entree, salaires reels)."""
    try:
        subprocess.run(["node", os.path.join(ROOT, "scripts", "rerate.mjs")], check=True)
    except FileNotFoundError:
        sys.exit("Node est requis. Installe Node 18+ puis relance.")
    except subprocess.CalledProcessError as e:
        sys.exit(f"rerate.mjs a echoue : {e}")


def rate(label, min_gp, skaters, goalies, realtime):
    """Delegue le calcul a js/ratings.js via Node."""
    payload = json.dumps({
        "label": label, "minGP": min_gp,
        "skaters": skaters, "goalies": goalies, "realtime": realtime,
        "salaries": load_salaries(label),
    })
    try:
        out = subprocess.run(
            ["node", os.path.join(ROOT, "scripts", "rate.mjs")],
            input=payload, capture_output=True, text=True, check=True,
        )
    except FileNotFoundError:
        sys.exit("Node est requis. Installe Node 18+ puis relance.")
    except subprocess.CalledProcessError as e:
        sys.exit(f"rate.mjs a echoue pour {label}:\n{e.stderr}")
    return json.loads(out.stdout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=1970)
    ap.add_argument("--end", type=int, default=2026)
    ap.add_argument("--min-gp", type=int, default=10)
    ap.add_argument("--only", nargs="*", default=None,
                    help="refaire seulement ces saisons, format 1981-82")
    ap.add_argument("--seed-only", action="store_true")
    ap.add_argument("--force", action="store_true",
                    help="reecrire meme si le shard existe deja et est a jour")
    ap.add_argument("--refresh-current", action="store_true",
                    help="refaire la saison en cours seulement (rafraichissement hebdomadaire)")
    ap.add_argument("--rerate", action="store_true",
                    help="sans API : refaire l'etage 2 des cotes sur les shards existants")
    ap.add_argument("--bios-only", action="store_true",
                    help="ajouter les dates de naissance aux shards existants, puis --rerate")
    args = ap.parse_args()

    os.makedirs(SEASONS_DIR, exist_ok=True)

    if args.bios_only:
        labels = args.only or sorted(f[:-5] for f in os.listdir(SEASONS_DIR) if f.endswith(".json"))
        patch_bios(labels)
        args.rerate = True

    if args.rerate:
        years = []
    elif args.only:
        years = [int(s[:4]) for s in args.only]
    elif args.seed_only:
        years = [int(s[:4]) for s in SEED_SEASONS]
    else:
        years = list(range(args.start, args.end + 1))

    built, teams_seen = [], set()
    fetched = 0

    version = ratings_version()

    # Rafraichissement hebdomadaire : la saison en cours change tous les
    # jours pendant l'annee, il faut donc la refaire meme si son shard est
    # deja la et deja a la bonne version.
    if args.refresh_current:
        now = time.gmtime()
        # La saison de la LNH commence en octobre : avant ca, la saison
        # « en cours » est encore celle qui porte l'annee precedente.
        start = now.tm_year if now.tm_mon >= 10 else now.tm_year - 1
        years = [start]
        args.force = True
        print(f"rafraichissement de la saison en cours : {start}-{str(start + 1)[2:]}")

    for year in years:
        label = f"{year}-{str(year + 1)[2:]}"
        path = os.path.join(SEASONS_DIR, f"{label}.json")

        # On saute un shard deja sur le disque SEULEMENT s'il a ete bati avec
        # la formule courante. Sans ce test, un changement de formule a
        # l'etage 1 (les sous-cotes, qui exigent l'API) n'entrait jamais dans
        # les donnees : le build complet voyait les fichiers en place et
        # passait son tour, en 4 secondes et sans rien dire.
        if os.path.exists(path) and not args.force and not args.seed_only:
            with open(path, encoding="utf-8") as f:
                shard = json.load(f)
            if shard.get("v") == version:
                built.append(label)
                teams_seen.update(p["t"] for p in shard["players"])
                print(f"{label}  (deja la, v{version}, {len(shard['players'])} entrees)")
                continue
            print(f"{label}  (v{shard.get('v')} -> v{version}, on rebatit)")

        print(f"{label}  ...", end=" ", flush=True)
        skaters, goalies, realtime = fetch_season(year, args.min_gp)
        if not skaters and not goalies:
            print("aucune donnee (saison annulee ou a venir)")
            continue

        shard = rate(label, args.min_gp, skaters, goalies, realtime)

        if not args.seed_only:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(shard, f, ensure_ascii=False, separators=(",", ":"))

        built.append(label)
        fetched += 1
        teams_seen.update(p["t"] for p in shard["players"])
        size = os.path.getsize(path) // 1024 if os.path.exists(path) else 0
        print(f"{len(shard['players'])} entrees, {size} Ko")
        time.sleep(0.35)

    # ---- etage 2 : contrats d'entree et salaires reels, sur tous les shards ----
    if args.rerate or (fetched and not args.seed_only):
        print("\nrecalcul de l'etage 2 (cote globale, salaires, archetypes, zones)...")
        rerate_all()

    # ---- index ----
    if not args.seed_only:
        existing = sorted(
            f[:-5] for f in os.listdir(SEASONS_DIR) if f.endswith(".json")
        )
        if args.rerate:
            for label in existing:
                with open(os.path.join(SEASONS_DIR, f"{label}.json"), encoding="utf-8") as f:
                    teams_seen.update(p["t"] for p in json.load(f)["players"])
        index = {
            "generated": time.strftime("%Y-%m-%d"),
            "minGP": args.min_gp,
            "seasons": existing,
            "teams": sorted(teams_seen),
        }
        with open(os.path.join(DATA, "index.json"), "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=1)
        print(f"\nindex.json : {len(existing)} saisons, {len(teams_seen)} equipes")

    # ---- seed ----
    seed_players, seed_labels = [], []
    for label in SEED_SEASONS:
        path = os.path.join(SEASONS_DIR, f"{label}.json")
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            shard = json.load(f)
        seed_players.extend(shard["players"])
        seed_labels.append(label)

    if seed_players:
        seed = {"minGP": args.min_gp, "seasons": seed_labels, "players": seed_players}
        seed_path = os.path.join(DATA, "seed.json")
        with open(seed_path, "w", encoding="utf-8") as f:
            json.dump(seed, f, ensure_ascii=False, separators=(",", ":"))
        print(f"seed.json  : {len(seed_labels)} saisons, "
              f"{os.path.getsize(seed_path) // 1024} Ko")


if __name__ == "__main__":
    main()
