#!/usr/bin/env python3
"""
Assemble les salaires reels publies en data/salaries/<saison>.json, le
format que lisent scripts/rate.mjs et scripts/rerate.mjs :

    { "season": "2016-17", "cap": 73000000,
      "sources": {...},                # provenance et nombre de joueurs par source
      "players": { "<playerId>": <salaire ou cap hit, en dollars de l'epoque> } }

    python3 scripts/build_salaries.py            # toutes les saisons couvertes
    python3 scripts/build_salaries.py 2016-17    # une seule

Sources, dans data/salaries/sources/ (voir data/salaries/README.md) :

  1. nhlnumbers_2016-2021.csv     cap hits 2016-17 et 2017-18, salaires
                                  contractuels 2016-17 a 2020-21
  2. 2016-17_kaggle_camnugent.csv salaires 2016-17, 874 joueurs
  3. capredictor_contracts_2007-2021.csv
                                  645 contrats (cap hit, duree, saison
                                  precedant la signature) -> applique a
                                  chaque saison couverte par le contrat
  4. markerzone_<saison>.csv      colonnes player,pos,team,salary,caphit,
                                  une saison par fichier de 1989-90 a
                                  2025-26, deposes par
                                  scripts/fetch_markerzone.py
                                  (MarkerZone.com). L'equipe (code du
                                  shard) n'est connue qu'avant 2005-06.
  5. manual_<saison>.csv          colonnes player,team,salary — pour coller
                                  a la main des chiffres pris ailleurs
                                  (USA Today, hockeyzoneplus, PuckPedia...)

Priorite quand plusieurs sources donnent un chiffre : manuel > cap hit
nhlnumbers > cap hit MarkerZone > salaire Kaggle > salaire contractuel
nhlnumbers > salaire MarkerZone (seule colonne avant 2005-06) > contrat
CaPredictor. Le cap hit est prefere au salaire de l'annee, c'est lui qui
compte sous le plafond.

Les joueurs sont retrouves dans data/seasons/<saison>.json par nom
normalise (accents et ponctuation retires), puis par nom de famille +
equipe quand le prenom differe (Alex / Alexander). Un nom ambigu est
ignore plutot que devine. Requiert les shards deja construits.
"""

import csv
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEASONS_DIR = os.path.join(ROOT, "data", "seasons")
SAL_DIR = os.path.join(ROOT, "data", "salaries")
SRC_DIR = os.path.join(SAL_DIR, "sources")

def load_era_cap():
    """SEASON_ERA_CAP de js/ratings.js (plafond officiel, ou plus gros budget
    d'equipe avant 2005-06) : une seule table, lue telle quelle."""
    with open(os.path.join(ROOT, "js", "ratings.js"), encoding="utf-8") as f:
        src = f.read()
    block = src[src.index("SEASON_ERA_CAP = {"):]
    block = block[:block.index("};")]
    return {m.group(1): int(m.group(2).replace("_", ""))
            for m in re.finditer(r"'(\d{4}-\d{2})':\s*([\d_]+)", block)}


ERA_CAP = load_era_cap()

TEAM_ALIAS = {"N.J": "NJD", "L.A": "LAK", "S.J": "SJS", "T.B": "TBL", "NJ": "NJD", "LA": "LAK",
              "SJ": "SJS", "TB": "TBL", "MON": "MTL", "WAS": "WSH", "CLB": "CBJ", "PHX": "ARI"}


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]", "", s.lower())


def teams_of(s):
    return {TEAM_ALIAS.get(t.strip(), t.strip()) for t in re.split(r"[/,]", s or "") if t.strip()}


def season_label(year):
    return f"{year}-{str(year + 1)[2:]}"


def next_season(label):
    return season_label(int(label[:4]) + 1)


class SeasonIndex:
    """Retrouve les playerId d'une saison par nom complet, ou nom de famille + equipe."""

    def __init__(self, label):
        with open(os.path.join(SEASONS_DIR, f"{label}.json"), encoding="utf-8") as f:
            shard = json.load(f)
        self.full = {}
        self.last = {}
        self.first_initial = {}
        for p in shard["players"]:
            if p.get("id") is None:
                continue
            self.full.setdefault(norm(p["n"]), set()).add(p["id"])
            parts = p["n"].split(" ")
            self.last.setdefault(norm(parts[-1]), {}).setdefault(p["id"], set()).add(p["t"])
            self.first_initial[p["id"]] = norm(parts[0])[:1]

    def find(self, name, teams=None, exact_only=False):
        """Nom complet exact d'abord ; sinon nom de famille + meme initiale de
        prenom (Alex / Alexander), et l'equipe doit concorder quand on la
        connait. Jamais de devinette entre deux candidats."""
        ids = self.full.get(norm(name))
        if ids and len(ids) == 1:
            return next(iter(ids))
        if ids:                              # homonymes exacts : seule l'equipe peut trancher
            if teams:
                last = norm(name.split(" ")[-1])
                hits = [pid for pid in ids if self.last.get(last, {}).get(pid, set()) & teams]
                if len(hits) == 1:
                    return hits[0]
            return None
        if exact_only:
            return None
        parts = name.split(" ")
        last = norm(parts[-1])
        initial = norm(parts[0])[:1]
        cands = {pid: ts for pid, ts in self.last.get(last, {}).items()
                 if self.first_initial.get(pid) == initial}
        if teams:
            cands = {pid: ts for pid, ts in cands.items() if ts & teams}
        if len(cands) == 1:
            return next(iter(cands))
        return None


def money(s):
    s = (s or "").strip().replace("$", "").replace(",", "")
    try:
        v = float(s)
    except ValueError:            # vide, UFA, RFA, ...
        return None
    if v < 1000:          # exprime en millions
        v *= 1_000_000
    return int(round(v))


def read_csv(name, **kw):
    path = os.path.join(SRC_DIR, name)
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, **kw))


def collect():
    """{ saison: [ (priorite, source, nom, equipes, montant) ] }"""
    per = {}

    def add(season, prio, src, name, teams, amount):
        if amount and amount > 0:
            per.setdefault(season, []).append((prio, src, name, teams, amount))

    for r in read_csv("nhlnumbers_2016-2021.csv"):
        ts = teams_of(r["team"])
        add("2016-17", 1, "nhlnumbers cap hit", r["player"], ts, money(r["caphit_2016-17"]))
        add("2017-18", 1, "nhlnumbers cap hit", r["player"], ts, money(r["caphit_2017-18"]))
        for s in ("2016-17", "2017-18", "2018-19", "2019-20", "2020-21"):
            add(s, 3, "nhlnumbers salaire contractuel", r["player"], ts, money(r[f"salary_{s}"]))

    for r in read_csv("2016-17_kaggle_camnugent.csv"):
        add(r["season"], 2, "kaggle camnugent salaire", r["player"], teams_of(r["team"]), money(r["salary"]))

    for r in read_csv("capredictor_contracts_2007-2021.csv"):
        prev = r["signed_after_season"]              # "2011-2012"
        try:
            start = int(prev[:4]) + 1
            length = int(r["length_years"])
        except ValueError:
            continue
        for y in range(start, start + length):
            add(season_label(y), 5, "capredictor contrat", r["player"], None, money(r["cap_hit"]))

    for fn in sorted(os.listdir(SRC_DIR)) if os.path.isdir(SRC_DIR) else []:
        m = re.match(r"markerzone_(\d{4}-\d{2})\.csv$", fn)
        if not m:
            continue
        for r in read_csv(fn):
            ts = teams_of(r.get("team", "")) or None
            add(m.group(1), 1, "markerzone cap hit", r["player"], ts, money(r["caphit"]))
            add(m.group(1), 4, "markerzone salaire", r["player"], ts, money(r["salary"]))

    for fn in sorted(os.listdir(SRC_DIR)) if os.path.isdir(SRC_DIR) else []:
        m = re.match(r"manual_(\d{4}-\d{2})\.csv$", fn)
        if not m:
            continue
        for r in read_csv(fn):
            add(m.group(1), 0, f"manuel ({fn})", r["player"], teams_of(r.get("team", "")), money(r["salary"]))

    return per


def main():
    only = set(sys.argv[1:])
    per = collect()
    written = 0
    for season in sorted(per):
        if only and season not in only:
            continue
        if not os.path.exists(os.path.join(SEASONS_DIR, f"{season}.json")):
            continue
        idx = SeasonIndex(season)
        players, chosen_src, counts = {}, {}, {}
        unmatched = 0
        rows = sorted(per[season], key=lambda x: x[0])
        # Deux passes : les noms exacts d'abord, pour qu'un repli par nom de
        # famille (Jody Hull absent du shard) ne vole pas l'identifiant d'un
        # joueur present (Brett Hull) avant sa propre ligne.
        for exact_only in (True, False):
            for prio, src, name, teams, amount in rows:
                pid = idx.find(name, teams, exact_only)
                if pid is None:
                    if not exact_only:
                        unmatched += 1
                    continue
                if str(pid) in players:
                    continue
                players[str(pid)] = amount
                chosen_src[str(pid)] = src
                counts[src] = counts.get(src, 0) + 1
        if not players:
            continue
        out = {
            "season": season,
            "cap": ERA_CAP.get(season),
            "note": "Salaires ou cap hits publies, en dollars de la saison. Voir data/salaries/README.md.",
            "sources": counts,
            "players": dict(sorted(players.items(), key=lambda kv: -kv[1])),
        }
        with open(os.path.join(SAL_DIR, f"{season}.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
        written += 1
        print(f"{season}: {len(players)} joueurs ({', '.join(f'{k} {v}' for k, v in counts.items())}), "
              f"{unmatched} lignes non appariees")
    print(f"{written} fichier(s) ecrit(s) dans data/salaries/")


if __name__ == "__main__":
    main()
