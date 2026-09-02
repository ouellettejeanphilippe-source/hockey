#!/usr/bin/env python3
"""
Telecharge, a la main et une fois, les salaires publies par MarkerZone.com
(www.markerzone.com/hockey/stats/nhl/salaries.php) et les depose dans
data/salaries/sources/markerzone_<saison>.csv, colonnes :

    player,pos,team,salary,caphit   # dollars de la saison ; caphit vide avant 2005-06

    python3 scripts/fetch_markerzone.py            # 1989-90 a 2025-26
    python3 scripts/fetch_markerzone.py 2018-19    # une seule saison

Ce script ne tourne jamais dans l'Action GitHub (decision dans PLAN.md :
les salaires reels arrivent par des fichiers deposes). Une requete par
saison, avec une pause entre chaque. La colonne equipe de la liste
generale du site est l'equipe actuelle du joueur, pas celle de la saison :
elle n'est pas conservee. Avant 2005-06, le script passe plutot par la
page de chaque equipe (une requete par equipe), ce qui donne l'equipe de
l'epoque (code du shard) et la masse salariale de chaque equipe ; le
maximum de la saison est affiche pour valider SEASON_ERA_CAP dans
js/ratings.js. Ensuite : build_salaries.py puis build_shards.py --rerate.
"""

import csv
import html
import json
import os
import re
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "salaries", "sources")
URL = "https://www.markerzone.com/hockey/stats/nhl/salaries.php?a={code}&e={team}&p=0&o=0"
PAUSE = 1.5

# Code interne du site pour chaque saison (menu deroulant de la page).
SEASON_CODE = {
    "1989-90": 15, "1990-91": 14, "1991-92": 13, "1992-93": 12, "1993-94": 11, "1994-95": 10,
    "1995-96": 9, "1996-97": 8, "1997-98": 7, "1998-99": 6, "1999-00": 5, "2000-01": 4,
    "2001-02": 3, "2002-03": 1, "2003-04": 2, "2005-06": 107, "2006-07": 108, "2007-08": 109,
    "2008-09": 110, "2009-10": 111, "2010-11": 152, "2011-12": 153, "2012-13": 154,
    "2013-14": 155, "2014-15": 156, "2015-16": 157, "2016-17": 158, "2017-18": 159,
    "2018-19": 160, "2019-20": 161, "2020-21": 162, "2021-22": 163, "2022-23": 164,
    "2023-24": 165, "2024-25": 166, "2025-26": 167,
}

# Code de franchise du site -> code d'equipe du shard selon la saison.
# La franchise garde son code quand elle demenage (Hartford -> Caroline...).
FRANCHISE = {
    1: "MTL", 2: "BOS", 3: "OTT", 4: "TOR", 5: "BUF", 6: "NJD", 7: "NYI", 8: "NYR", 9: "PHI",
    10: "PIT", 13: "FLA", 14: "TBL", 15: "WSH", 16: "CHI", 17: "CBJ", 18: "DET", 19: "NSH",
    20: "STL", 21: "CGY", 23: "EDM", 24: "MIN", 25: "VAN", 26: "ANA", 28: "LAK", 30: "SJS",
    11: "ATL", 12: "HFD", 22: "QUE", 27: "MNS", 29: "WIN",
}
MOVES = {11: [(2011, "WPG")], 12: [(1997, "CAR")], 22: [(1995, "COL")], 27: [(1993, "DAL")],
         29: [(1996, "PHX"), (2014, "ARI"), (2024, "UTA")]}


def team_code(fr, year):
    code = FRANCHISE[fr]
    for since, c in MOVES.get(fr, []):
        if year >= since:
            code = c
    return code


ROW = re.compile(
    r"<tr class='tr'>.*?class='tt12b_n'>(?P<name>[^<]+)</a>&nbsp;&nbsp;\((?P<pos>[A-Z]+)\)</td>"
    r".*?<td class='tdr bl8[^']*'>(?P<c1>[^<]*)</td><td class='tdr bl8[^']*'>(?P<c2>[^<]*)</td>",
    re.S)


def amount(s):
    s = re.sub(r"[^\d]", "", html.unescape(s))
    return int(s) if s else ""


def fetch(label, team=0):
    req = urllib.request.Request(URL.format(code=SEASON_CODE[label], team=team),
                                 headers={"User-Agent": "Mozilla/5.0 (cap82 salaires; usage manuel)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        page = r.read().decode("utf-8", "replace")
    shown = re.search(r"<div class='ee'>(\d{4}-\d{4})<", page)
    if not shown or shown.group(1)[:4] != label[:4]:
        raise RuntimeError(f"{label}: la page affiche {shown and shown.group(1)}")
    rows = []
    for m in ROW.finditer(page):
        rows.append({"player": html.unescape(m["name"]).strip(), "pos": m["pos"], "team": "",
                     "salary": amount(m["c1"]), "caphit": amount(m["c2"])})
    time.sleep(PAUSE)
    return rows


def fetch_by_team(label):
    """Avant 2005-06 : une page par equipe, pour l'equipe de l'epoque et sa masse salariale."""
    year = int(label[:4])
    with open(os.path.join(ROOT, "data", "seasons", f"{label}.json"), encoding="utf-8") as f:
        present = {p["t"] for p in json.load(f)["players"]}
    rows, seen, payroll = [], set(), {}
    for fr in sorted(FRANCHISE):
        code = team_code(fr, year)
        if code not in present:
            continue
        for r in fetch(label, fr):
            r["team"] = code
            rows.append(r)
            seen.add(r["player"])
            payroll[code] = payroll.get(code, 0) + (r["salary"] or 0)
    for r in fetch(label):                       # joueurs sans equipe sur le site
        if r["player"] not in seen:
            rows.append(r)
    top = max(payroll, key=payroll.get)
    print(f"{label}: masse salariale max {top} {payroll[top]:,} $ "
          f"(mediane {sorted(payroll.values())[len(payroll) // 2]:,} $)")
    return rows


def main():
    only = set(sys.argv[1:])
    os.makedirs(OUT, exist_ok=True)
    for label in SEASON_CODE:
        if only and label not in only:
            continue
        rows = fetch_by_team(label) if int(label[:4]) < 2005 else fetch(label)
        path = os.path.join(OUT, f"markerzone_{label}.csv")
        with open(path, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["player", "pos", "team", "salary", "caphit"])
            w.writeheader()
            w.writerows(rows)
        withcap = sum(1 for r in rows if r["caphit"])
        print(f"{label}: {len(rows)} joueurs, {withcap} avec cap hit")


if __name__ == "__main__":
    main()
