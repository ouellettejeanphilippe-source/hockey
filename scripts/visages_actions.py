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

Le modèle (face_detection_yunet_2023mar.onnx, opencv_zoo, licence MIT) se télécharge une fois dans le dossier des
bruts. Aucune dépendance du jeu : OpenCV ne sert qu'ici, comme fontTools pour scripts/emojis.mjs.
"""
import json, os, sys, urllib.request
import cv2

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRUT = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
MODELE = sys.argv[2] if len(sys.argv) > 2 else os.path.join(BRUT, 'yunet.onnx')
URL = 'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx'
if not os.path.exists(MODELE):
    urllib.request.urlretrieve(URL, MODELE)

# Le centre du joueur, à l'œil, quand le plus grand visage est celui d'un autre (en fraction de la largeur).
CENTRES_A_L_OEIL = {
    8470320: 0.76,   # Cam Ward : masqué, à droite ; le détecteur prenait l'Oiler à gauche
}

LISTE = os.path.join(RACINE, 'data', 'actions.json')
liste = json.load(open(LISTE))
det = cv2.FaceDetectorYN.create(MODELE, '', (1296, 729), 0.6, 0.3, 5000)
visages = {}
for i in liste['ids']:
    im = cv2.imread(os.path.join(BRUT, f'{i}.jpg'))
    if im is None:
        continue
    h, w = im.shape[:2]
    det.setInputSize((w, h))
    _, faces = det.detect(im)
    if faces is None or not len(faces):
        continue
    f = max(faces, key=lambda r: r[2] * r[3] * r[14])
    visages[str(i)] = round(float(f[0] + f[2] / 2) / w, 3)
visages.update({str(k): v for k, v in CENTRES_A_L_OEIL.items() if k in liste['ids']})
liste['visages'] = visages
json.dump(liste, open(LISTE, 'w'), separators=(',', ':'))
print(f"  {len(visages)} visages trouvés sur {len(liste['ids'])} photos")
