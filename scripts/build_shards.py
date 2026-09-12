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

    # Unites speciales par equipe : occasions et buts en avantage numerique.
    # La ligue les compte depuis 1977-78 ; avant, le moteur garde ses reperes
    # d'epoque. Le point team/powerplay ne donne pas le code d'equipe, on le
    # retrouve par l'identifiant (voir team_codes). Tolerant : un champ
    # absent ou renomme laisse le bloc vide plutot que de casser le build.
    avantages = fetch_powerplay(year) if year >= 1977 else {}

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

    return skaters, goalies, realtime, avantages


_TEAM_CODES = None


def team_codes():
    """identifiant d'equipe -> code a trois lettres, une requete pour toutes."""
    global _TEAM_CODES
    if _TEAM_CODES is None:
        rows = api("team", {})
        _TEAM_CODES = {}
        for r in rows:
            code = r.get("triCode") or r.get("rawTricode")
            if r.get("id") is not None and code:
                _TEAM_CODES[r["id"]] = code
    return _TEAM_CODES


def _champ(row, *cles):
    for k in cles:
        if k in row and row[k] is not None:
            return row[k]
    return None


def fetch_powerplay(year):
    sid = f"{year}{year + 1}"
    rows = api("team/powerplay", {"limit": -1, "cayenneExp": f"seasonId={sid} and gameTypeId=2"})
    if not rows:
        return {}
    codes = team_codes()
    out = {}
    for r in rows:
        code = codes.get(r.get("teamId")) or r.get("teamAbbrev") or r.get("triCode")
        gp = _champ(r, "gamesPlayed")
        occ = _champ(r, "ppOpportunities", "powerPlayOpportunities", "ppOpp")
        buts = _champ(r, "ppGoalsFor", "powerPlayGoalsFor", "ppGoals")
        if not code or not gp or occ is None:
            continue
        out[code] = {"gp": gp, "occ": occ, "but": buts if buts is not None else 0}
    if not out:
        print(f"    team/powerplay {sid} : champs inattendus {sorted(rows[0].keys())[:12]}...", file=sys.stderr)
    return out


def fetch_bios(year):
    """{ playerId: {bd, hgt, wgt} } pour les patineurs et gardiens de la saison.

    Le meme point de terminaison donne la date de naissance, la TAILLE (en
    pouces) et le POIDS (en livres). Le gabarit du mode bonus << Sur table >>
    (js/table.js) s'en sert : petit et rapide, moyen, matador. C'est une
    donnee mesuree de la ligue, pas un substitut tire des colonnes.
    """
    exp = f"seasonId={year}{year + 1} and gameTypeId=2"
    bios = {}
    for path in ("skater/bios", "goalie/bios"):
        for r in api(path, {"limit": -1, "sort": "playerId", "cayenneExp": exp}):
            pid = r.get("playerId")
            if not pid:
                continue
            bio = bios.setdefault(pid, {})
            bd = r.get("birthDate")
            if bd and str(bd)[:4].isdigit():
                bio["bd"] = str(bd)[:10]
            hgt, wgt = r.get("height"), r.get("weight")
            # Bornes de plausibilite : la LNH va de 5 pi 3 po a 6 pi 9 po et
            # de 150 a 265 livres. Une valeur hors de la se lit comme absente.
            if isinstance(hgt, (int, float)) and 60 <= hgt <= 84:
                bio["hgt"] = int(hgt)
            if isinstance(wgt, (int, float)) and 130 <= wgt <= 300:
                bio["wgt"] = int(wgt)
    return bios


def patch_bios(labels):
    """Ajoute date de naissance (bd), taille (hgt) et poids (wgt) aux shards."""
    for label in labels:
        path = os.path.join(SEASONS_DIR, f"{label}.json")
        if not os.path.exists(path):
            continue
        print(f"{label}  bios ...", end=" ", flush=True)
        bios = fetch_bios(int(label[:4]))
        if not bios:
            print("aucune donnee")
            continue
        with open(path, encoding="utf-8") as f:
            shard = json.load(f)
        n = {"bd": 0, "hgt": 0, "wgt": 0}
        for p in shard["players"]:
            bio = bios.get(p.get("id"))
            if not bio:
                continue
            for k in ("bd", "hgt", "wgt"):
                if k in bio:
                    p[k] = bio[k]
                    n[k] += 1
        with open(path, "w", encoding="utf-8") as f:
            json.dump(shard, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{n['bd']} dates, {n['hgt']} tailles, {n['wgt']} poids")
        time.sleep(0.35)


# Les cinq types de tir que le plateau connait, et la lettre qu'il en garde.
# L'ordre compte : a egalite de tirs, le premier gagne, et c'est le plus
# caracteristique qui vient en premier (une deviation est une signature, un
# tir du poignet est le defaut de tout le monde).
TYPES_TIR = [
    ("D", "shotsOnNetTipIn", "shotsOnNetDeflected"),   # deviation / tir voile
    ("F", "shotsOnNetSlap"),                            # tir frappe
    ("R", "shotsOnNetBackhand"),                        # revers
    ("E", "shotsOnNetSnap"),                            # tir sur reception
    ("P", "shotsOnNetWrist"),                           # tir du poignet
]


def fetch_actions(year):
    """{ playerId: {bl, tk, ts} } : blocs, vols et type de tir signature.

    Deux points de terminaison, deux couvertures, et il faut les connaitre :

      skater/realtime   mises en echec, TIRS BLOQUES, VOLS, revirements
                        -> depuis 2005-06 seulement
      skater/shottype   tirs et buts par type (poignet, frappe, sur
                        reception, revers, deviation)
                        -> depuis 2009-10 seulement

    Les saisons d'avant n'ont rien, et c'est normal : la ligue ne comptait
    pas ces gestes-la. Le plateau (js/table.js) porte un repli d'epoque pour
    chacun, comme AVANTAGES_EPOQUE le fait deja pour l'avantage numerique --
    l'action existe pour les 55 saisons, c'est l'APTITUDE qui vient d'ici
    quand la colonne existe.
    """
    exp = f"seasonId={year}{year + 1} and gameTypeId=2"
    out = {}
    # ZERO N'EST PAS UNE DONNEE. L'API rend des lignes pour 1975-76 aussi, mais
    # avec blockedShots=0 et takeaways=0 partout : la ligue ne comptait pas ces
    # gestes-la. Ecrire ces zeros dans le shard revenait a affirmer que Larry
    # Robinson n'a jamais bloque un lancer, et ca TUAIT le repli d'epoque du
    # plateau -- `ecranVaut` voyait un nombre, donc il ne retombait plus sur la
    # mesure defensive `md`. On ne garde la colonne que si la SAISON en a.
    lignes = api("skater/realtime", {"limit": -1, "sort": "playerId", "cayenneExp": exp})
    total_bl = sum((r.get("blockedShots") or 0) for r in lignes)
    total_tk = sum((r.get("takeaways") or 0) for r in lignes)
    for r in lignes:
        pid, gp = r.get("playerId"), r.get("gamesPlayed") or 0
        if not pid or gp < 1:
            continue
        bl, tk = r.get("blockedShots"), r.get("takeaways")
        e = out.setdefault(pid, {})
        if total_bl > 0 and isinstance(bl, (int, float)) and bl >= 0:
            e["bl"] = round(bl / gp, 2)
        if total_tk > 0 and isinstance(tk, (int, float)) and tk >= 0:
            e["tk"] = round(tk / gp, 2)
    # UNE SIGNATURE, C'EST CE QUI DEPASSE LA LIGUE, pas ce qui domine son
    # propre total. Premier essai : le type le plus tire, seuil d'un quart.
    # Resultat mesure sur 2021-22 : 774 joueurs << poignet >> sur 797, 21
    # frappes, 2 sur reception, aucune deviation ni revers -- parce que TOUT
    # LE MONDE tire surtout du poignet dans la ligue moderne. On compare donc
    # la part de chaque type chez le joueur a la part du MEME type dans sa
    # saison, et on garde le plus grand ecart.
    lignes = api("skater/shottype", {"limit": -1, "sort": "playerId", "cayenneExp": exp})
    parts = {lettre: 0 for lettre, *_ in TYPES_TIR}
    total_ligue = 0
    brut = {}
    for r in lignes:
        pid = r.get("playerId")
        if not pid:
            continue
        compte = {}
        for lettre, *champs in TYPES_TIR:
            n = sum((r.get(c) or 0) for c in champs)
            compte[lettre] = n
            parts[lettre] += n
            total_ligue += n
        brut[pid] = compte
    if total_ligue < 1000:
        return out
    ligue = {k: v / total_ligue for k, v in parts.items()}
    for pid, compte in brut.items():
        total = sum(compte.values())
        if total < 20:          # moins de vingt tirs : aucune signature fiable
            continue
        meilleur, ecart_max = "P", 0
        for lettre, n in compte.items():
            part = n / total
            base = ligue.get(lettre) or 0
            if base <= 0 or part < 0.10:   # sous un dixieme de ses tirs, ce n'est pas sa signature
                continue
            ecart = part / base
            if ecart > ecart_max:
                meilleur, ecart_max = lettre, ecart
        # Sous 1,35 fois la ligue, il tire comme tout le monde : poignet.
        out.setdefault(pid, {})["ts"] = meilleur if ecart_max >= 1.35 else "P"
    return out


def patch_actions(labels):
    """Ajoute blocs (bl), vols (tk) et type de tir signature (ts) aux shards."""
    for label in labels:
        path = os.path.join(SEASONS_DIR, f"{label}.json")
        if not os.path.exists(path):
            continue
        print(f"{label}  gestes ...", end=" ", flush=True)
        gestes = fetch_actions(int(label[:4]))
        if not gestes:
            print("rien pour cette epoque")
            time.sleep(0.35)
            continue
        with open(path, encoding="utf-8") as f:
            shard = json.load(f)
        n = {"bl": 0, "tk": 0, "ts": 0}
        for p in shard["players"]:
            e = gestes.get(p.get("id")) or {}
            for k in ("bl", "tk", "ts"):
                if k in e:
                    p[k] = e[k]
                    n[k] += 1
                else:
                    # La saison n'a pas la colonne : on la RETIRE, sans quoi un
                    # zero ecrit par une passe precedente resterait a mentir.
                    p.pop(k, None)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(shard, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{n['bl']} blocs, {n['tk']} vols, {n['ts']} types de tir")
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


def rate(label, min_gp, skaters, goalies, realtime, avantages=None):
    """Delegue le calcul a js/ratings.js via Node."""
    payload = json.dumps({
        "label": label, "minGP": min_gp,
        "skaters": skaters, "goalies": goalies, "realtime": realtime,
        "salaries": load_salaries(label), "avantages": avantages or {},
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
                    help="ajouter dates de naissance, tailles et poids aux shards, puis --rerate")
    ap.add_argument("--gestes-only", action="store_true",
                    help="ajouter blocs, vols et type de tir aux shards (2005-06+), puis --rerate")
    args = ap.parse_args()

    os.makedirs(SEASONS_DIR, exist_ok=True)

    if args.bios_only:
        labels = args.only or sorted(f[:-5] for f in os.listdir(SEASONS_DIR) if f.endswith(".json"))
        patch_bios(labels)
        args.rerate = True

    if args.gestes_only:
        labels = args.only or sorted(f[:-5] for f in os.listdir(SEASONS_DIR) if f.endswith(".json"))
        patch_actions(labels)
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
        skaters, goalies, realtime, avantages = fetch_season(year, args.min_gp)
        if not skaters and not goalies:
            print("aucune donnee (saison annulee ou a venir)")
            continue

        shard = rate(label, args.min_gp, skaters, goalies, realtime, avantages)

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
        # L'index decrit TOUT le jeu de donnees, pas seulement ce qu'on vient
        # de rebatir : on rebalaye donc les 55 shards a chaque fois. Ce
        # rebalayage etait garde derriere `if args.rerate`, si bien qu'un
        # --only ou un --refresh-current tronquait la liste d'equipes aux
        # seules saisons traitees -- 18 equipes au lieu de 44 apres un
        # --only 1976-77 -- et retrecissait le bassin de la roulette en
        # silence.
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
