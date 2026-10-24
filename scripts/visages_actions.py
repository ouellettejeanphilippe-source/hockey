"""
LA FACE DANS LE CADRE (oct. 2026). JP : *si t'es capable de faire que la face soit bien dans le cadrage, ça serait
encore mieux*. Le recadrage d'une photo d'action (js/recadrage-action.js) trouve le joueur par la netteté, et se trompe
parfois (un arbitre, un filet, un bâton). Ce script trouve son VISAGE, une fois, à la fabrication : YuNet, le détecteur
de visages d'OpenCV, sur chaque photo brute ; la face retenue est la plus grande, pondérée par sa confiance (le joueur
de la photo est celui qu'on a cadré). Il écrit, dans data/actions.json, `visages` : { id → le centre de la face, en
fraction de la largeur }. Le recadrage s'y centre (scripts/actions.mjs sur le Web, js/actions.js sur l'appareil) ;
une photo sans visage trouvé garde la netteté.

    pip install opencv-python-headless
    python3 scripts/visages_actions.py <dossier des bruts de scripts/actions.mjs> [modele.onnx]
    node scripts/actions.mjs --brut <le même dossier>

LE BON JOUEUR, À L'ŒIL. Le plus grand visage n'est pas toujours le sien : un gardien masqué échappe au détecteur, qui
prend alors un adversaire (Cam Ward, sa face cachée, et un Oiler à côté). Reconnaître le joueur par les couleurs de son
club a été essayé sur les 1 701 photos : les chandails blancs à l'étranger et les publicités aux couleurs du club
l'ont fait se tromper plus souvent qu'il ne corrigeait. Les cas vus restent donc à l'œil (`CENTRES_A_L_OEIL`).

LES PHOTOS DE COMMONS (oct. 2026, scripts/actions_commons.mjs). `--json <fichier>` : le même détecteur sur chaque
`{id}.jpg` du dossier, sans toucher à data/actions.json ; il écrit { id → [centre x, centre y, nombre de visages (au
moins moitié aussi larges que le sien), largeur du plus grand en fraction de l'image] } — le centre pour le recadrage, le compte pour la vérification à l'œil
(aucun visage : un logo, une carte, un dos ; trois et plus : un groupe). Le mode ordinaire garde le centre d'une
photo dont il n'a pas le brut (une photo de Commons, dont le brut est ailleurs).

    python3 scripts/visages_actions.py <dossier> --json <fichier>

LA FACE DANS LA FENÊTRE (oct. 2026). JP, devant Nabokov sous la rampe de Projecteur : *try fit according to the space
the picture will be in*. Chaque série rogne la photo 5:7 à la forme de sa fenêtre ; pour y poser la face, la carte doit
savoir où elle est dans la photo RECADRÉE. `--cadres` passe le même détecteur sur img/actions/*.webp, après
scripts/actions.mjs (qui réécrit data/actions.json), et écrit `cadres` : { id → [centre x, centre y] de la face, en
fractions }. Seule une face sûre compte (confiance 0,7 ou plus, moins de 60 % de la largeur) : sans elle, la série
cadre seule. js/cartes.js le pose sur l'image (`--fx`, `--fy`), style.css la place (`.photo-cadree`).

    python3 scripts/visages_actions.py --cadres [modele.onnx]

Le modèle (face_detection_yunet_2023mar.onnx, opencv_zoo, licence MIT) se télécharge une fois dans le dossier des
bruts. Aucune dépendance du jeu : OpenCV ne sert qu'ici, comme fontTools pour scripts/emojis.mjs.
"""
import json, os, sys, tempfile, urllib.request
import cv2

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARGS = sys.argv[1:]
SORTIE_JSON = ARGS[ARGS.index('--json') + 1] if '--json' in ARGS else None
if SORTIE_JSON:
    del ARGS[ARGS.index('--json'):ARGS.index('--json') + 2]
CADRES = ARGS[:1] == ['--cadres']
if CADRES:
    ARGS[0] = os.path.join(RACINE, 'img', 'actions')
BRUT = ARGS[0] if ARGS else sys.exit(__doc__)
MODELE = ARGS[1] if len(ARGS) > 1 else os.path.join(tempfile.gettempdir() if CADRES else BRUT, 'yunet.onnx')
URL = 'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx'
if not os.path.exists(MODELE):
    urllib.request.urlretrieve(URL, MODELE)

# Le centre du joueur, à l'œil, quand le plus grand visage est celui d'un autre (en fraction de la largeur).
CENTRES_A_L_OEIL = {
    8470320: 0.76,   # Cam Ward : masqué, à droite ; le détecteur prenait l'Oiler à gauche
    # Oct. 2026 : une grosse fausse face (une oreille, une pub, la foule floue) l'emportait sur la sienne, plus petite et sûre.
    8470621: 0.56, 8470794: 0.47, 8471766: 0.75, 8474660: 0.56, 8475958: 0.50, 8476457: 0.50, 8476468: 0.60,
    8477508: 0.50, 8478046: 0.47, 8479661: 0.52, 8480846: 0.54, 8482097: 0.48, 8482726: 0.51,
}

det = cv2.FaceDetectorYN.create(MODELE, '', (1296, 729), 0.6, 0.3, 5000)


def visage(chemin):
    """Le plus grand visage, pondéré par sa confiance : (centre x, centre y, nombre, largeur), ou None."""
    im = cv2.imread(chemin)
    if im is None:
        return None
    h, w = im.shape[:2]
    det.setInputSize((w, h))
    _, faces = det.detect(im)
    if faces is None or not len(faces):
        return (None, None, 0, 0)
    f = max(faces, key=lambda r: r[2] * r[3] * r[14])
    # Le nombre : les visages au moins moitié aussi larges que le sien (pas la foule floue derrière).
    n = sum(1 for r in faces if r[2] >= f[2] / 2)
    return (round(float(f[0] + f[2] / 2) / w, 3), round(float(f[1] + f[3] / 2) / h, 3), n, round(float(f[2]) / w, 3))


if SORTIE_JSON:
    lus = {}
    for nom in sorted(os.listdir(BRUT)):
        if nom.endswith('.jpg') and nom[:-4].isdigit():
            v = visage(os.path.join(BRUT, nom))
            if v is not None:
                lus[nom[:-4]] = list(v)
    json.dump(lus, open(SORTIE_JSON, 'w'), separators=(',', ':'))
    print(f"  {sum(1 for v in lus.values() if v[2])} visages trouvés sur {len(lus)} images")
    sys.exit(0)

LISTE = os.path.join(RACINE, 'data', 'actions.json')
liste = json.load(open(LISTE))
if CADRES:
    cadres = {}
    for i in liste['ids']:
        im = cv2.imread(os.path.join(BRUT, f'{i}.webp'))
        if im is None:
            continue
        h, w = im.shape[:2]
        det.setInputSize((w, h))
        _, faces = det.detect(im)
        if faces is None or not len(faces):
            continue
        f = max(faces, key=lambda r: r[2] * r[3] * r[14])
        if f[14] >= 0.7 and f[2] <= 0.6 * w:
            cadres[str(i)] = [round(float(f[0] + f[2] / 2) / w, 2), round(float(f[1] + f[3] / 2) / h, 2)]
    liste['cadres'] = cadres
    json.dump(liste, open(LISTE, 'w'), separators=(',', ':'))
    sys.exit(print(f"  {len(cadres)} faces cadrées sur {len(liste['ids'])} photos"))
visages = {}
for i in liste['ids']:
    v = visage(os.path.join(BRUT, f'{i}.jpg'))
    if v is None:
        # Pas de brut ici (une photo de Commons) : son centre d'avant reste.
        if str(i) in liste.get('visages', {}):
            visages[str(i)] = liste['visages'][str(i)]
        continue
    if v[0] is not None:
        visages[str(i)] = v[0]
visages.update({str(k): v for k, v in CENTRES_A_L_OEIL.items() if k in liste['ids']})
liste['visages'] = visages
json.dump(liste, open(LISTE, 'w'), separators=(',', ':'))
print(f"  {len(visages)} visages trouvés sur {len(liste['ids'])} photos")
