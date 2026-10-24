/**
 * LES PHOTOS LIBRES, POUR LES JOUEURS QUE LA LNH NE MONTRE PAS (oct. 2026).
 *
 *   node scripts/actions_commons.mjs                      # tout : Commons, puis Openverse ; écrit img/actions et data/actions.json
 *   node scripts/actions_commons.mjs --garder             # garde le brut (une deuxième passe ne retélécharge rien)
 *   node scripts/actions_commons.mjs --garder --planche <dossier>   # les planches de la vérification à l'œil
 *   node scripts/actions_commons.mjs --sec                # mesure seulement : rien n'est écrit au dépôt
 *   node scripts/actions_commons.mjs --sans-openverse     # Commons seulement
 *
 * JP : *plus de cartes avec une photo de joueur en action ou de son époque*,
 * surtout pour les vieilles saisons — la LNH n'en publie presque pas avant 2005
 * (scripts/actions.mjs : 9 % des joueurs des années 70, 13 % des années 90).
 * JP accepte *un mini lien qui crédite l'auteur dans l'app* (`creditPhoto`,
 * js/actions.js). Deux sources, sous licence libre explicite SEULEMENT —
 * domaine public, CC0, CC BY, CC BY-SA et, le jeu n'étant pas commercial (JP :
 * *il le sera jamais*), CC BY-NC et CC BY-NC-SA, toutes versions. Jamais ND (on
 * recadre : c'est une adaptation), jamais « fair use », jamais une autre source
 * (ni hockey-reference ni hockeydb : leurs conditions l'interdisent). La licence
 * exacte de chaque image est gardée : le crédit l'affiche.
 *
 * 1. WIKIMEDIA COMMONS, PAR WIKIDATA. Wikidata relie un joueur à la LNH par son
 *    numéro (P3522, « NHL.com player ID » : le même `id` que nos saisons) et à
 *    son image (P18). Une requête SPARQL rend tous les couples ; on garde nos
 *    joueurs SANS photo de la LNH. L'API de Commons rend, par lots de 50, la
 *    licence, l'auteur, la date de la prise et la taille.
 *
 *    LE TRI PAR DATE. P18 montre souvent le joueur des décennies plus tard (en
 *    smoking, en entraîneur, en ancien). Sa carrière va de sa première à sa
 *    dernière saison dans data/seasons (avant 1970-71, notre première saison,
 *    elle remonte à ses 17 ans). Une image datée dans la carrière (± 1 an)
 *    passe ; datée hors carrière, elle est écartée ; sans date lisible, ou
 *    datée par l'horodatage d'un numériseur (une heure précise, des années après
 *    une carrière finie avant 2000 : une vieille photo numérisée), elle va à
 *    l'œil. Une image trop petite pour une carte (moins de 300 px utiles en
 *    5:7) est écartée.
 *
 * 2. OPENVERSE (JP : *ça peut aussi être ailleurs sur le web*), pour ceux qui
 *    n'ont toujours rien : il regroupe les images libres de Flickr, de musées et
 *    d'archives. Aucun identifiant n'y relie une photo au joueur, d'où des
 *    règles strictes : licence by, by-sa, by-nc, by-nc-sa, cc0 ou pdm ; le NOM COMPLET dans le
 *    titre ou les étiquettes ; pas un monument, un aréna, un casier, une plaque,
 *    une cérémonie, un « looks like » ; une année de sa carrière quand l'image
 *    en dit une, et aucune année hors carrière ; un homonyme possible (deux de
 *    nos joueurs du même nom) écarte. Une image venue de Wikimedia est laissée à
 *    la première passe. TOUTES passent ensuite à l'œil : c'est la seule
 *    garantie que c'est lui, en joueur, de son époque. Le rendement est faible ;
 *    c'est voulu. La recherche est le nom entre guillemets, seul (« hockey » de
 *    plus fait perdre les photos étiquetées du club seulement). Openverse limite
 *    les anonymes à 200 requêtes par jour (20 à la minute) : la passe commence
 *    par les joueurs qui ont le plus joué, et reprend le lendemain où elle s'est
 *    arrêtée (--garder : le brut garde les réponses).
 *
 * 3. LA VÉRIFICATION À L'ŒIL (`A_L_OEIL`, plus bas). Les planches (--planche)
 *    montrent, 16 par feuille, le nom, les saisons et la date sous chaque image :
 *    toutes celles qui attendent l'œil, et un échantillon des datées. Une image
 *    qui attend l'œil n'entre qu'une fois gardée à l'œil ; une datée entre sauf
 *    si l'œil l'écarte. Le doute écarte.
 *
 * 4. LE CADRAGE, comme scripts/actions.mjs : le centre du visage (YuNet,
 *    scripts/visages_actions.py --json), la fenêtre 5:7 de js/recadrage-action.js
 *    (le même code que l'appareil), un WebP 400 × 560 dans img/actions/{id}.webp.
 *    Un portrait posé (le visage à plus de 40 % de la largeur de la carte, 28 % en
 *    noir et blanc ou avant 1990) n'est pas une photo d'action : il est écarté.
 *    Le décodage et le WebP se font dans Chromium (Playwright), sans dépendance.
 *
 * 5. data/actions.json : `ids` gagne ces joueurs, `visages` leurs centres ;
 *    `commons` : { id → { f : le fichier, a : l'auteur, l : la licence, s : la
 *    vignette que l'appareil télécharge } } et `libres` : { id → { a, l, s,
 *    p : la page de l'œuvre, o : la source (flickr…) } }. Une passe de
 *    scripts/actions.mjs les garde. Le brut vit hors du dépôt et s'efface à la
 *    fin (sauf --garder).
 *
 * Wikimedia et Openverse EXIGENT un User-Agent qui se nomme ; les requêtes vont
 * une à la fois, avec des pauses, et suivent leur `retry-after`. La vignette se
 * demande à 1280 px (une largeur standard de Commons, qui arrondit 1296 à 1920).
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { recadrerAction } from '../js/recadrage-action.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (nom, def) => { const i = process.argv.indexOf(`--${nom}`); return i < 0 ? def : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const UA = 'Cap82-0/1.0 (https://github.com/ouellettejeanphilippe-source/hockey)';
const LARGEUR = 400, HAUTEUR = 560, QUALITE = 0.8, VIGNETTE = 1280, UTILE_MIN = 300;
const BRUT = arg('brut', path.join(os.tmpdir(), 'cap82-commons'));
const GARDER = !!arg('garder', false), SEC = !!arg('sec', false), PLANCHE = arg('planche', null);
const SORTIE = path.join(ROOT, 'img', 'actions');
const LISTE = path.join(ROOT, 'data', 'actions.json');
const pause = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
fs.mkdirSync(BRUT, { recursive: true });
fs.mkdirSync(path.join(BRUT, 'ov'), { recursive: true });

/*
 * LA VÉRIFICATION À L'ŒIL (oct. 2026, planches relues une à une : les 358 qui
 * attendaient l'œil, toutes les datées d'avant 2000 et un échantillon des
 * autres). Par fichier (Commons : son titre ; Openverse : `ov:` et l'id de
 * l'œuvre). `gardees` : vues, c'est lui, joueur, à son époque. Les autres
 * listes écartent, par motif ; « après sa carrière dans la LNH » : en Europe ou
 * dans la Ligue américaine, des années après ses saisons chez nous.
 */
const A_L_OEIL = {
  gardees: [
    "2012-01-22 Knuble 1 vs Pens.JPG", "Aaron Palushaj - Hamilton Bulldogs - 2012-11-09.jpg", "AaronBroten.png",
    "Akira Schmid 2023 12 07.jpg", "Al Secord 1980.JPG", "Alain Daigle 1978.JPG", "Alain Lemieux 1982.JPG",
    "Alexandre R. Picard 2011-11-11 front.JPG", "Alexei Semenov 2010-12-12.jpg", "Andrei Kostitsyn.png",
    "AndrewBrunette.jpg", "André St. Laurent 1974.JPG", "Andy Sutton.jpg", "Antti Pihlstrom.jpg", "Aris Brimanis.jpg",
    "Behn Wilson 1984.JPG", "Ben Eager.JPG", "Ben Hanowski.jpg", "Ben Simon.jpg", "Bill Goldsworthy 1976.JPG",
    "Bill Mikkelson 1972.JPG", "Billy Carroll 81-82.JPG", "Billy Harris 1973.JPG",
    "Blair Chapman 1978.jpg", "Blake Dunlop 1981.JPG", "Bob Bourne 81-82.JPG", "Bob Dailey 80-81.JPG",
    "BobHoffmeyer.png", "Bobby Holik.jpg", "BobbyBaun 05.jpg",
    "Bowen Byram - Brian Murphy - All-Pro Reels-19 (51636762780) (cropped).jpg", "Brandon Smith.jpg",
    "Brenden Morrow 2013-05-09.JPG", "Brett Festerling.png", "Brian Marchinko 1973.JPG", "BruceDriver.png",
    "Bryan Maxwell 80-81.JPG", "Bryan Muir Toronto.jpg", "Bryan Rodney.jpg", "Cal Petersen (39248752844).jpg",
    "Carol Vadnais 1978.JPG", "Cholowski 425 02-2.jpg", "Chris Campoli Bridgeport.jpg", "Chris Gratton 2007.jpg",
    "Chris Taylor.jpg", "ChrisSimon.jpg", "Chuck Lefley 1980.JPG", "Corey Potter January 2012.jpg",
    "Corey Sarich.PNG", "Craig Cameron 1973.JPG", "Dale Rolfe 1971.JPG", "Danny O'Shea 1973.JPG",
    "Dave Hutchison 1979.JPG", "Dave Schultz hockey.JPG", "David Dziurzynski (cropped).jpg",
    "David Hale B-Senators.jpg", "David Vyborny.jpg", "Dean Talafous 80-81.JPG", "Dennis Hull 1977.JPG",
    "Derek Armstrong.JPG", "Derian Hatcher.jpg", "Don Edwards 1977.JPG", "Donald MacLean (39832069304).jpg",
    "Douglas Murray.jpg", "Drake Caggiula (30228545585).jpg",
    "Duane Rupp 1974.JPG", "Dylan Olsen Hawks.JPG", "EricBrewerCanada.jpg", "Everett Sanipass 1988.JPG",
    "Evgeny Artyukhin.jpg", "Frank St.Marseille action shot.jpg", "Frederik Andersen (51916832126) (cropped).jpg",
    "Garnet Hathaway (49479882817).jpg", "Garrett Burnett.jpg", "George Parros.jpg", "Germain Gagnon 1973.JPG",
    "Gilles Villemure 1976.JPG", "Glenn Chico Resch 1978.JPG", "GlennHealy.png", "GregAdamsWAS.png",
    "HannuKamppuri.png", "Huetblackhawks09.jpg", "Ian White.png", "Jack Lynch 1973.JPG", "Jacques Richard 1977.jpg",
    "JamieLangenbrunner2010WinterOlympics.jpg", "JanHejda.jpg", "JanLudvig.png", "Jansen Harkins.jpg",
    "Jason Arnott Capitals.jpg", "Jason Ward.jpg", "Jasper Weatherby (cropped).jpg", "Jassencullimore.jpg",
    "Jay Wells 1980.JPG", "Jean Hamel 79-80.JPG", "Jean-Guy Lagace 1973.JPG",
    "Jean-Guy Talbot 1970.jpg", "Jeff Larmer 1984.JPG", "Jeff Odgers.jpg", "Jerome Dupont 1981.JPG",
    "Jim Roberts 69-70.JPG", "JimNeilson 04.jpg", "JoeCirella.png", "Johan Hedberg 2010-04-03.JPG", "John Druce.JPG",
    "John Tonelli 80-81.JPG", "JohnOgrodnickDET.png", "Jonathan Quick Rangers 10 21-2.jpg",
    "Jordan Greenway.jpg", "Jordan Leopold Sabres 2012-02-19.JPG", "Jordan Oesterle 2014.jpg",
    "Julien Brouillette (cropped).jpg", "Justin Papineau 1.jpg", "Karsums.jpg", "Keith Aulie Lightning.jpg",
    "Ken Yaremchuk 1984.JPG", "Kent Huskins.jpg", "Kevin Colley.jpg", "Kevin Poulin NYI.jpg", "KirkMuller.png",
    "Leevi Merilainen.jpg", "Linden3cropped1.JPG", "Lowell MacDonald.jpg",
    "Manny Legace St. Louis.jpg", "Mario Ferraro (cropped).jpg", "Markpopovic.jpg",
    "Masked up Flyers fans on the glass and Zack MacEwen (51639982971) (cropped).jpg", "Mason McTavish crop.jpg",
    "Matt Fraser TXStars.jpg", "Maxim Kondratyev.jpg", "Michael Garnett.jpg", "Michael Kostka 1 2014-03-22.JPG",
    "Michael Latta 2016-03-01.JPG", "Mikael Samuelsson 2012-03-09.JPG",
    "Mikael Tellqvist St. John's.jpg", "Mike Corrigan 67-68.JPG", "Mike Craig (25671817617).jpg",
    "Mike Grier Sharks.jpg", "Mike Murphy action shot.jpg", "Mike Weaver 1 2012-03-09.JPG",
    "Mike Zuke 80-81.JPG", "MikeSillinger.jpg", "Milos Kelemen (cropped).jpg", "Murray Bannerman 1985.JPG",
    "Nathan Bastian 2025-01-06 (cropped).jpg", "NathanDempsey.jpg", "Nick Harbaruk 73-74.JPG",
    "Nick Palmeri 2012.png", "Nicklas Jensen Wolves.jpg", "Nico Daws 2022.jpg", "Niko Kapanen.jpg",
    "Olivier Magnan.jpg",
    "Ottawa Senators at Seattle Kraken - 2024-01-04 - Angus Crookshank (53450732437) (cropped).jpg",
    "Ouellet Xavier (39326413075).jpg", "PJ Axelsson.jpg", "PaulMara.JPG", "Pavel Vorobyev.jpg",
    "PeterReginTimrå.jpg", "Petr Čajánek.jpg", "Phil Myre 80-81.JPG", "Raitis Ivanans.JPG",
    "René Robert 1980.JPG", "RichPrestonNJ.png", "Rick Lapointe 1977.JPG", "Rick MacLeish 1973.JPG",
    "Rick Vaive 1988.JPG", "Riley Tufte.jpg", "Roland Melanson 84-85.JPG", "Ron Jones 1973.JPG",
    "Ron Schock 1973.JPG", "Scott Clemmensen.jpg", "Scott Ferguson.jpg", "Shawn Burr 84-85.JPG",
    "Stephané Veilleux of the Espoo Blues - 20101026.jpg", "Stephen Weiss.jpg", "Stu Bickel - Connecticut Whale.jpg",
    "Ted Snell 1973.JPG", "Terry O'Reilly 78-79.JPG", "Tim Kennedy.jpg", "Toby Petersen - Texas Stars.jpg",
    "Tom Webster 1969.JPG", "Troy Bodie.jpg", "Tyler Sloan.jpg", "Tyson Strachan 2012-03-09.JPG", "UliHiemer.png",
    "Vesa Toskala 2006 2.jpg", "Victor Olofsson - October 2024.jpg", "Ville Leino 2015-09-12.jpg",
    "Vitali Yachmenev - Los Angeles Kings.jpg", "Wayne Dillon New York Rangers.jpg", "Wayne Presley 1987.JPG",
    "Yvon Labre 1973.JPG", "Zach Aston-Reese 2018-02-06 1.jpg",
    "ov:f6623597-7014-43f3-921f-00196ec09b25", "ov:ef7d132d-6bd5-478e-a040-fab1a41fcb66", "ov:c192476b-2a3a-4f82-9e74-7eadfb561bc6", "ov:cccd33fa-9569-434c-b00c-71a4c1f376b6", "ov:d1a05ff1-e068-4050-a50e-093d3cef7f3d", "ov:fc8a1a3f-e551-4fe2-a078-afddbba60113", "ov:cedd9a8d-a763-4461-869b-7a656beebf6e",
  ],
  "un homme âgé": [
    "20250203 AHLAllStarClassic Lorne Henning.jpg", "Al Iafrate (cropped).jpg", "Anders Hedberg.jpg",
    "Balderis Helmuts 2014.jpg", "Bob Miller (4515548).jpg", "BobPlager2014.jpg", "Dennis Polonich.jpg",
    "Derek Sanderson.jpg", "Ed Westfall 1970s alumni bruins.jpg", "Eddie Johnston 1970s alumni bruins.jpg",
    "Fred Stanfield 1970s alumni bruins.jpg", "Jim Rutherford crop.jpg", "Jiří Bubla 2015.JPG",
    "Kent Åke \"Kenta\" Nilsson på Hockeygalan 2022.jpg", "Mats Thelin 2014 01.JPG", "Noel Picard 2005.jpg",
    "Paul Henderson - 2019 (32680141527) (cropped).jpg", "Pelle Eklund, 2013a.JPG", "Rick Smith of 1970 Bruins.jpg",
    "StanWeir.jpg", "Tord Lundström in 2022.jpg", "Wayne Carleton 1970 Bruins Alumni.jpg",
    "Yuri Khmylev (110410-F-DS336-076) (cropped).jpg",
    "ov:51c7930d-94e1-42d1-87e4-a7717254e4c6", "ov:6636b67b-8ac7-4673-960c-b0a7aa81dcff", "ov:52f688c9-7387-4292-a612-35c91eb2d11e",
  ],
  "en civil (complet, smoking…)": [
    "Andy Brickley.jpg", "Arto Blomsten 2013-02-01 001.jpg", "Bill Garnder (50472512621).jpg", "Bob Froese 1986.JPG",
    "Brian Mullen 1988.JPG", "CManiago.png", "Claude-Lemieux-circa-1999-2000.jpg", "Craig Patrick 1983.JPG",
    "Daryl Evans.jpg", "Dick Matiussi.png", "Donald Dufresne.JPG", "Doug Wickenheiser 1988.JPG",
    "Esa Tikkanen 2013-04-19 001.jpg", "Griffin Reinhart.jpg",
    "Hockey Operations George McPhee at an event celebrating the 2023 Stanley Cup victory of the Vegas Golden Knights on November 13, 2023 in the White House with President Joe Biden (cropped).jpg",
    "Jeffgiuliano.JPG", "Jim Fox Fans.jpg", "Jim Peplinski 2014.jpg", "Jody Gage in 2006.jpg",
    "Joe Paterson (50545929872).jpg", "Jonas Bergqvist.jpg", "Kelly Hrudey 2006.jpg", "Kevin Lowe 2006.png",
    "Kirk Maltby March 2007.jpg", "Kris Draper March 2007.jpg", "LAM 1136.jpg", "Lou Angotti.png",
    "Martin Procházka, Studio S2 ČRo 2025 (6) (cropped).jpg", "Martin Skoula, HC Avangard, 2011.jpg",
    "Mattias Norstrom 2009.jpg", "Mike-gillis.jpg", "Nick Kypreos.jpg", "Noel Price.png", "Paul Reinhart.jpg",
    "Richard Zednik.jpg", "Rick Green (ice hockey).JPG", "Robert Lang 2007.jpg", "Scott Thornton portrait.jpg",
    "Steve Jensen 1976.jpg", "Steve Tambellini cropped.jpg", "Stéphan Lebeau.JPG", "Tom Gilbert in 2009.jpg",
    "Viktors Ignatjevs.jpg", "백지선 ショルダーショット cropped from 202310221612 DSCN7123 (cropped).jpg",
    "ov:5ec79931-485f-454e-bae1-5f04553d5152", "ov:c3ab004a-1029-46c9-b084-dd970e4ac4c2", "ov:d782de19-2b37-4c70-8d84-c7fe2d9be967", "ov:d2d43854-adfb-478c-893c-3b6b50332b0b", "ov:0e43ff0e-7d98-49fa-a562-085e3fd86d1a", "ov:837fbabd-b840-4bbc-a80c-99725e826c49", "ov:892b9872-b9c9-4265-b7dc-6d0bd3d6b2b6", "ov:97e297bb-df6b-423d-bc08-a4670c5712fb", "ov:b8a7df4f-3007-49c0-a03d-01e8d1f9da0d", "ov:b2be0274-4a70-4f01-9f24-72907a401e05",
  ],
  "derrière le banc": [
    "20160416 AUTHUN 2770.jpg", "AUT, EBEL,EC KAC vs. EC VSV (11581264676).jpg", "AlainVigneault2009a.jpg",
    "Anders Eldebrink.jpg", "Brad Berry.jpg", "Brent Sutter - Switzerland vs. Canada, 29th April 2012-3.jpg",
    "Brent Thompson 2013-05-09.JPG", "Bruce Boudreau Capitals Coach (cropped).jpg", "Bruce Crowder.jpg",
    "Bruins Dev Camp-6952 (5920261176).jpg", "CHL, HC Davos vs. IFK Helsinki, 6th October 2015 39.JPG",
    "Claude Julien.jpg", "Craig Hartsburg 2013-11-01.JPG", "Darryl Sutter - June 2014.jpg",
    "Dave Lewis coach Ukraine ice hockey 2010.jpg", "Davis Payne HC St Louis Blues.jpg", "Dean Evason.jpg",
    "Doug Houda.jpg", "EHCO-Cup, Grizzlys Wolfsburg vs. Genève-Servette HC, 23rd August 2016 07.JPG",
    "Gerard Gallant 2018-02-04 2.jpg", "Hannu Järvenpää 2013-11-22.jpg", "Head Coach Paul MacLean.jpg",
    "Hunter Ontario Hockey League IMG 1004 (4470529339) (cropped).jpg", "Jim Bedard.jpg", "Joel Otto 2014.jpg",
    "Joel Quenneville.jpg", "John Anderson AHL All-Star Classic 2015.jpg", "Kjell Samuelsson.jpg",
    "Mark Hunter - Cgy.jpg", "Mike Donnelly (9272513462).jpg", "Mike O'Connell (9269704181).jpg",
    "Mike Stothers AHL All-Star Classic 2015.jpg", "NLA, HC Lugano vs. Genève-Servette HC, 18th October 2014 20.JPG",
    "Nikolai Borschevsky.JPG", "Peter Laviolette by 2eight-1015.jpg", "Randy Cunneyworth.jpg",
    "Rick Bowness 2018-05-21 2.jpg", "Ryan McGill 2018-02-04.jpg", "Scott Arniel.jpg", "Tim Hunter.jpg",
    "Trent Yawney.jpg", "Vincent Riendeau.jpg",
    "ov:45ca8303-a1c5-4fcd-90a7-0a03ed4f3fbc",
  ],
  "une cérémonie ou des autographes": [
    "AHL HOF 2010 John Paddock (25551649927).jpg", "AHL Hall of Fame Ceremony - 2019 - Tyler Eaves (39943747603).jpg",
    "Dennis-o-brien.jpg", "Fedorov Kozlov Larionov.jpg",
    "Ftorek-2020 AHL Hall of Fame Induction IMG 0451 (49452283641) (cropped).jpg",
    "Jonathan Girard (38732380130).jpg", "Karlis Skrastins.jpg",
    "Nancy Reagan Slapping a Hockey Puck While Attending \"Just Say No\" Night for The National Hockey League (NHL) at The Capital Centre in Landover, MD. - DPLA - 24dd09bedd409d179e51e715daba9757.jpg",
    "Petr Sýkora 2009.jpg", "Ray Whitney.jpg", "Sammy Blais.jpg", "Scott Howson.jpg",
    "TheAHL Gernander3 (8447140302).jpg", "Tom McCarthy 1982-83.png", "Tyler Motte.jpg",
    "ov:b55d5cce-e47d-455e-bd25-8f647dab751d",
  ],
  "un groupe": [
   
    "2019 Calder Cup Finals - Game 1 - Chicago Wolves at Charlotte Checkers - June 1, 2019 - Steven Lorentz and Jake Bischoff (48038928278).jpg",
    "20240205 AHL AllStar Challenge (53511893728).jpg", "Antti Aalto & Jani Hurme 2002.jpg",
    "Atlantaflamesgoalhug.jpg", "Bobby Lalonde.jpg", "Brad Lukowich 2007.jpg", "Chi-phi04 rd (40466896731).jpg",
    "Christian Fischer - Windsor Spitfires.JPG", "DanHinote AndrewMurray AaronRome.jpg",
    "Doug-favell colorado-rockies-v-calgary 1978.jpg", "Fata Corbet.jpg", "John McCarthy.jpg",
    "Jordan Kyrou - Sarnia Sting.jpg", "MelBridgeman.png", "PeteStemkowski 06.jpg", "Peter Bondra scoring.jpg",
    "Sharks player 2006.jpg",
    "Toronto Maple Leafs at Seattle Kraken - 2024-01-21 - Oliver Bjorkstrand and Matthew Knies (53480826540).jpg",
  ],
  "une carte de hockey": [
    "JimKornTOR.png",
  ],
  "après sa carrière dans la LNH": [
    "Alex Hicks (cropped).JPG", "American Hockey League ERI 5703 (5528011873).jpg", "Brad Schlegel.JPG",
    "Brent Gilchrist.png", "Brian MacLellan.png", "Christian Dubé - Fribourg-Gotteron vs. HC Bienne, 25.11.2011.jpg",
    "Dave McLlwain.jpg", "David Nemirovsky.jpg", "Derek Smith (110410-F-DS336-092) (cropped).jpg", "Gr picard.jpg",
    "Hhof0377 (30835766803).jpg", "Ivan Ciernik.jpg", "Jani Hakanpää of the Espoo Blues - 20100812.jpg",
    "Jean-François Jomphe.jpg", "Jere Karalahti.jpg", "John Blum (3072536) (cropped).jpg", "Karl Stewart.jpg",
    "Kimbi Daniels (2339547616).jpg", "Langkow kev 08.JPG", "Lonny Bohonos.jpg", "Mike McBain (432567682).jpg",
    "Pavel Rosa - Fribourg-Gotteron vs. HC Bienne, 25.11.2011.jpg", "Peter Ferraro (31274072950) (cropped).jpg",
    "Peter Ratchuk.jpg", "Ralph Intranuovo.jpg", "Rich Brennan (31274102990) (cropped).jpg", "Vasiljevs kev 08.JPG",
  ],
  "pas lui, ou pas un joueur": [
    "Andrew Raycroft's New Sparkle Mask.jpg", "Defenseman Ray Bourque 1979.jpg", "Jocelyn Thibault.jpg",
    "Schwartz during 1st period of Nov. 20, 2024 Nashville Predators at Seattle Kraken game (54153605382) (cropped).jpg",
    "ov:cdceba89-54a1-4aec-bb68-1bd1e1b753a7", "ov:8525cea3-0916-4a88-a5e2-9525e67d0a0f", "ov:845aac42-39b8-4372-8574-a75dbd91fcf7", "ov:01ec706e-8992-461c-8239-761c58b3e4b7", "ov:7be7c069-0130-4363-a8e7-1894d60731fc", "ov:16aefc96-3aba-410d-b5bb-00e3b202a492", "ov:4fe63a09-acff-4840-bb69-f991f3d266ee", "ov:ac614e40-18c5-49c1-9d18-14bafbc4fa86", "ov:1060b8b6-1f55-4f4d-a9ee-898786ab0903", "ov:2b4a8aa1-ddd6-4280-94e7-f895e8fd50ed", "ov:52d0cdf8-b4f2-4ac6-8990-8f61afc6af26", "ov:6214c8c9-aa27-49c3-9344-8881cdbe4a07", "ov:bfde8123-db2f-4416-a011-67c0ce6e6765", "ov:d4a08ac6-0b9f-4023-8be9-dd55830e9acf", "ov:f6e88d22-41ab-4be9-8f6b-6dd60edddf25", "ov:d871c407-280d-428e-a943-218ac7b14494", "ov:df74dd1b-1596-4881-b581-afcfe071d750", "ov:a74609e9-ecfa-41e7-bb72-d42fd0f1b8dd", "ov:a76fbedb-5903-4e75-8f02-9f353fa3e2f2", "ov:d561144a-7340-4c2d-83de-33ffd8103144", "ov:a31bb81c-4dfa-41c8-8146-edc559f7565d",
  ],
  // Les photos d'équipe en buste (la série « Chicago Blackhawks / NHL », un gardien posé) : un portrait, pas un match.
  "un buste posé, pas en action": [
    "Ivan Boldirev 1974.JPG", "Doug Jarrett 1973.JPG", "Doug Hicks 1977.JPG", "Randy Holt 1977.JPG", "Lynn Powis 1973.JPG", "John Marks 1973.JPG", "Bill White 1973.JPG", "Rick Paterson 1978.JPG", "Darcy Rota 1978.JPG", "Jean Savard 1977.JPG", "Mike Veisor 1973.JPG", "Michel Plasse 75-76.JPG",
  ],
  "trop floue ou trop petite": [
    "Aaronvolpatti.jpg", "BryanSmolinski.jpg", "Jeff Halpern NYR.jpg", "Joshua Roy 2024-09-28.jpg",
    "Reinhard Divis2.jpg", "Rico Fata.jpg", "Ryan O'Byrne.jpg", "Tucker Poolman 3.jpg",
  ],
};
const VU = new Map();
for (const [motif, liste] of Object.entries(A_L_OEIL)) for (const f of liste) VU.set(f, motif);

/* Nos joueurs : le nom, la carrière (la première et la dernière année), les matchs joués. */
const joueurs = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'seasons')).filter(f => f.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seasons', f), 'utf8'));
  const a = Number(String(s.season).slice(0, 4));
  for (const p of s.players) {
    if (!p.id) continue;
    const id = Number(p.id), j = joueurs.get(id) || { id, n: p.n, bd: p.bd, de: a, a: a + 1, gp: 0, clubs: new Set() };
    j.de = Math.min(j.de, a); j.a = Math.max(j.a, a + 1); j.gp += p.gp || 0; j.clubs.add(p.t);
    joueurs.set(id, j);
  }
}
const PREMIERE = Math.min(...[...joueurs.values()].map(j => j.de));
// La fenêtre de la carrière, ± 1 an ; avant notre première saison, elle remonte à ses 17 ans.
const carriere = j => [j.de === PREMIERE ? (j.bd ? Number(j.bd.slice(0, 4)) + 17 : 1950) : j.de - 1, j.a + 1];
const saisonsDe = j => `${j.de}–${j.a}`;
const homonymes = new Map();
for (const j of joueurs.values()) { const k = j.n.toLowerCase(); homonymes.set(k, (homonymes.get(k) || 0) + 1); }

const lu = JSON.parse(fs.readFileSync(LISTE, 'utf8'));
const libresAvant = lu.libres || {}, commonsAvant = lu.commons || {};
// Les joueurs qui ont une photo de la LNH : tout `ids`, moins ce que ce script y a mis.
const lnh = new Set(lu.ids.filter(id => !commonsAvant[id] && !libresAvant[id]));
console.log(`\n  ${joueurs.size} joueurs, ${lnh.size} avec une photo de la LNH · brut dans ${BRUT}\n`);

/* Une requête polie : le User-Agent, une à la fois, et le `retry-after` suivi. */
let derniere = 0;
async function poli(url, { json = true, ecart = 1200, essais = 6 } = {}) {
  for (let essai = 0; essai < essais; essai++) {
    const attente = derniere + ecart - Date.now();
    if (attente > 0) await pause(attente);
    derniere = Date.now();
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, signal: AbortSignal.timeout(90000) });
      if (r.status >= 500 && essai === essais - 1) return null;
      if (r.status === 429 || r.status >= 500) {
        const ra = Number(r.headers.get('retry-after')) || 30 * (essai + 1);
        console.log(`   ${r.status}, pause de ${ra} s`);
        if (ra > 3600) throw new Error(`limite atteinte (${ra} s)`);
        await pause(ra * 1000 + 1000); continue;
      }
      if (!r.ok) return null;
      return json ? await r.json() : Buffer.from(await r.arrayBuffer());
    } catch (e) { if (/limite/.test(e.message)) throw e; if (essai === essais - 1) return null; await pause(3000 * (essai + 1)); }
  }
  return null;
}

/* Les années qu'un texte dit (« 1977 », « 1970s », « circa 1968–1972 ») : [min, max], ou null si rien ou trop vague. */
const nettoyer = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, '\'').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
function anneesDe(texte) {
  const ans = [];
  for (const m of nettoyer(texte).matchAll(/(?<![\d.])(19[2-9]\d|20[0-2]\d)(s|’s|'s)?(?![\d])/g)) { ans.push(Number(m[1])); if (m[2]) ans.push(Number(m[1]) + 9); }
  if (!ans.length) return null;
  const min = Math.min(...ans), max = Math.max(...ans);
  return max - min > 10 ? null : [min, max];
}
const dansCarriere = ([min, max], j) => { const [d, f] = carriere(j); return max >= d && min <= f; };

/* La licence courte, et si elle est permise (domaine public, CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA ; jamais ND). */
function licenceCommons(m) {
  const court = nettoyer(m.LicenseShortName?.value), code = String(m.License?.value || '').toLowerCase();
  if (m.NonFree?.value && String(m.NonFree.value) !== 'false') return { l: court, ok: false };
  if (/\bnd\b/i.test(court) || /-nd\b/.test(code)) return { l: court, ok: false };
  if (code === 'pd' || /^public domain$/i.test(court) || /^pd\b/i.test(court)) return { l: 'Domaine public', ok: true };
  if (code.startsWith('cc0') || /^cc0\b/i.test(court)) return { l: 'CC0', ok: true };
  const cc = court.match(/^CC BY(-NC)?(-SA)? (\d\.\d)(?: ([a-z]{2}(?:-[a-z]+)?))?$/i);
  if (cc) return { l: `CC BY${cc[1] ? '-NC' : ''}${cc[2] ? '-SA' : ''} ${cc[3]}`, ok: true };
  return { l: court, ok: false };
}
const auteurDe = (m, defaut) => {
  let a = nettoyer(m.Artist?.value) || nettoyer(m.Credit?.value);
  a = a.replace(/^(photo|photograph|photographer|author)\s*(by|:)\s*/i, '').replace(/\s*\(talk\)$/i, '');
  if (!a || /^(unknown|unknown author|anonymous|auteur inconnu)\b/i.test(a)) a = defaut;
  return a.length > 80 ? `${a.slice(0, 77).replace(/\s+\S*$/, '')}…` : a;
};

/* ---------- 1. Commons, par Wikidata ---------- */

const WD = path.join(BRUT, 'wd.json');
if (!fs.existsSync(WD)) {
  const q = 'SELECT ?nhl ?img WHERE { ?p wdt:P3522 ?nhl ; wdt:P18 ?img . }';
  const d = await poli(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`);
  fs.writeFileSync(WD, JSON.stringify(d.results.bindings.map(b => [Number(b.nhl.value), decodeURIComponent(b.img.value.split('/').pop())])));
}
const parJoueur = new Map();
for (const [id, f] of JSON.parse(fs.readFileSync(WD, 'utf8'))) {
  if (!joueurs.has(id) || lnh.has(id)) continue;
  parJoueur.set(id, [...new Set([...(parJoueur.get(id) || []), f])]);
}
// Un fichier chez deux joueurs : une photo de groupe, la photo d'aucun des deux.
const chez = new Map();
for (const fs_ of parJoueur.values()) for (const f of fs_) chez.set(f, (chez.get(f) || 0) + 1);
const titres = [...new Set([...parJoueur.values()].flat())];
console.log(`  Wikidata : ${parJoueur.size} de nos joueurs sans photo de la LNH ont une image (${titres.length} fichiers)`);

const META = path.join(BRUT, 'meta.json');
const meta = fs.existsSync(META) ? JSON.parse(fs.readFileSync(META, 'utf8')) : {};
const manquent = titres.filter(t => !(t in meta));
for (let i = 0; i < manquent.length; i += 50) {
  const lot = manquent.slice(i, i + 50);
  const d = await poli(`https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=${VIGNETTE}&titles=${encodeURIComponent(lot.map(t => `File:${t}`).join('|'))}`);
  const vers = new Map(lot.map(t => [`File:${t}`, t]));
  for (const n of [...(d.query.normalized || []), ...(d.query.redirects || [])]) if (vers.has(n.from)) vers.set(n.to, vers.get(n.from));
  for (const p of d.query.pages || []) {
    const t = vers.get(p.title); if (!t) continue;
    const ii = p.imageinfo?.[0];
    meta[t] = ii ? { titre: p.title.replace(/^File:/, ''), w: ii.width, h: ii.height, mime: ii.mime, s: String(ii.thumburl || ii.url).replace(/\?.*$/, ''), m: ii.extmetadata || {} } : null;
  }
  for (const t of lot) if (!(t in meta)) meta[t] = null;
  fs.writeFileSync(META, JSON.stringify(meta));
  process.stdout.write(`\r  Commons : ${Math.min(i + 50, manquent.length)} / ${manquent.length} fichiers lus`);
}
if (manquent.length) console.log('');

// Le statut de chaque fichier pour son joueur.
const CARTE = /\b(panini|topps|o-?pee-?chee|opc|parkhurst|upper deck|bowman|fleer|pro set|beehive|sticker|stickers|trading|card|cards|carte|cartes)\b/i;
const motifs = {};
const compter = m => { motifs[m] = (motifs[m] || 0) + 1; };
function statutCommons(j, t) {
  const x = meta[t];
  if (!x) return { st: 'absent' };
  const lic = licenceCommons(x.m);
  if (!lic.ok) return { st: 'licence', l: lic.l };
  if (!/^image\/(jpeg|png|webp|tiff)$/.test(x.mime)) return { st: 'format' };
  if (Math.min(x.w, x.h * LARGEUR / HAUTEUR) < UTILE_MIN) return { st: 'petite' };
  if (chez.get(t) > 1) return { st: 'groupe' };
  // Une carte de hockey photographiée (Panini, Topps…) : le droit d'auteur de la carte est douteux.
  if (CARTE.test(`${t} ${nettoyer(x.m.ObjectName?.value)} ${nettoyer(x.m.ImageDescription?.value)}`)) return { st: 'carte' };
  const brutDate = nettoyer(x.m.DateTimeOriginal?.value);
  let date = anneesDe(brutDate), source = 'date';
  if (!date) { date = anneesDe(t.replace(/\.[a-z]+$/i, '')); source = 'titre'; }
  const base = { titre: x.titre, a: auteurDe(x.m, 'Auteur inconnu'), l: lic.l, s: x.s, utile: Math.min(x.w, x.h * LARGEUR / HAUTEUR), date: date ? (date[0] === date[1] ? `${date[0]}` : `${date[0]}–${date[1]}`) : '', desc: nettoyer(x.m.ImageDescription?.value).slice(0, 140) };
  if (!date) return { ...base, st: 'oeil', pourquoi: 'sans date' };
  if (dansCarriere(date, j)) return { ...base, st: 'datee', source };
  // L'horodatage d'un numériseur : une heure précise, des années après une carrière finie avant 2000.
  if (source === 'date' && /\d{4}[-:]\d\d[-:]\d\d[ T]\d\d:\d\d/.test(brutDate) && j.a < 2000 && date[0] > j.a + 1) return { ...base, st: 'oeil', pourquoi: 'scan ?' };
  return { ...base, st: 'hors' };
}
const RANG = { datee: 3, oeil: 2 };
const retenus = new Map();   // id → { source: 'commons', … }
for (const [id, fichiers] of parJoueur) {
  const j = joueurs.get(id);
  const st = fichiers.map(t => statutCommons(j, t));
  const bon = st.filter(s => RANG[s.st]).sort((a, b) => RANG[b.st] - RANG[a.st] || b.utile - a.utile)[0];
  if (!bon) { compter(`Commons : ${{ licence: 'licence non permise', format: 'pas une photo (svg, gif…)', petite: 'trop petite', carte: 'une carte de hockey (Panini, Topps…)', groupe: 'le même fichier chez plusieurs joueurs', hors: 'datée hors de la carrière', absent: 'fichier introuvable' }[st[0].st]}`); continue; }
  retenus.set(id, { ...bon, source: 'commons', cle: bon.titre });
}
const parStatut = s => [...retenus.values()].filter(r => r.st === s).length;
console.log(`  Commons : ${retenus.size} joueurs retenus — ${parStatut('datee')} datés dans la carrière, ${parStatut('oeil')} à l'œil`);
for (const [m, n] of Object.entries(motifs)) console.log(`     écartés : ${m} ${n}`);

/* ---------- 2. Openverse, pour ceux qui n'ont toujours rien ---------- */

const MOTS_INTERDITS = /\b(statue|monument|sculpture|arena|aréna|centre|center|forum|stadium|locker|casier|plaque|banner|bannière|jersey retire|retirement|ceremony|cérémonie|hall of fame|temple de la renommée|autograph|signing|signature|card|carte|looks like|lookalike|wax|mural|grave|tombe|funeral|funérailles|coach|entraîneur|alumni|anciens|old.?timers?|legends|bobblehead|figurine|poster|street|rue|avenue|park|parc|school|école)\b/i;
const LICENCES_OV = { by: 'CC BY', 'by-sa': 'CC BY-SA', 'by-nc': 'CC BY-NC', 'by-nc-sa': 'CC BY-NC-SA', cc0: 'CC0', pdm: 'Domaine public' };
const sansAccent = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function statutOpenverse(j, r) {
  const lic = LICENCES_OV[r.license];
  if (!lic) return 'licence non permise';
  if (/wikimedia/i.test(r.source || '') || /wikimedia\.org/.test(r.url || '')) return 'déjà Wikimedia';
  const texte = sansAccent(`${r.title || ''} ${(r.tags || []).map(t => t.name).join(' ')}`);
  if (!texte.includes(sansAccent(j.n))) return 'sans son nom complet';
  if (MOTS_INTERDITS.test(sansAccent(`${r.title || ''} ${(r.tags || []).map(t => t.name).join(' ')} ${r.description || ''}`))) return 'un monument, un aréna, une cérémonie…';
  if ((r.width && r.height) && Math.min(r.width, r.height * LARGEUR / HAUTEUR) < UTILE_MIN) return 'trop petite';
  const date = anneesDe(`${r.title || ''} ${r.description || ''}`);
  if (date && !dansCarriere(date, j)) return 'datée hors de la carrière';
  return null;
}
const motifsOV = {}, sourcesOV = {};
if (!arg('sans-openverse', false)) {
  // Les joueurs encore sans photo, ceux qui ont le plus joué d'abord ; un homonyme possible (deux des nôtres du même nom) est laissé.
  const restent = [...joueurs.values()].filter(j => !lnh.has(j.id) && !retenus.has(j.id) && j.gp >= Number(arg('min-gp', 30)))
    .sort((a, b) => b.gp - a.gp);
  // Au plus --openverse requêtes neuves par passe (150 : le quota d'un jour, moins une marge) ; 0 relit seulement les réponses gardées.
  const PLAFOND_OV = Number(arg('openverse', 150));
  let demandes = 0, arret = '', ratees = 0;
  for (const j of restent) {
    if (homonymes.get(j.n.toLowerCase()) > 1) { motifsOV['homonyme parmi nos joueurs'] = (motifsOV['homonyme parmi nos joueurs'] || 0) + 1; continue; }
    const f = path.join(BRUT, 'ov', `${j.id}.json`);
    let d = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
    if (!d) {
      if (arret || demandes >= PLAFOND_OV) continue;
      demandes++;
      try {
        // Openverse est lent (15 à 35 s par requête) et répond parfois 500 : deux essais, puis le joueur suivant.
        d = await poli(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(`"${j.n}"`)}&license=by,by-sa,by-nc,by-nc-sa,cc0,pdm&page_size=20&mature=false`, { ecart: 3500, essais: 2 });
      } catch (e) { arret = e.message; continue; }
      if (!d) { ratees++; continue; }
      fs.writeFileSync(f, JSON.stringify({ results: (d.results || []).map(r => ({ id: r.id, title: r.title, url: r.url, foreign_landing_url: r.foreign_landing_url, creator: r.creator, license: r.license, license_version: r.license_version, source: r.source, provider: r.provider, width: r.width, height: r.height, tags: r.tags, description: r.description })) }));
      if (demandes % 25 === 0) console.log(`   Openverse : ${demandes} joueurs demandés`);
    }
    for (const r of d.results) {
      const motif = statutOpenverse(j, r);
      if (motif) { motifsOV[motif] = (motifsOV[motif] || 0) + 1; continue; }
      const cand = { source: 'libres', cle: `ov:${r.id}`, st: 'oeil', pourquoi: 'Openverse', a: (nettoyer(r.creator) || 'Auteur inconnu').slice(0, 80), l: `${LICENCES_OV[r.license]}${r.license_version && !/^(cc0|pdm)$/.test(r.license) ? ` ${r.license_version}` : ''}`, s: r.url, p: r.foreign_landing_url, o: r.source || r.provider, titre: nettoyer(r.title).slice(0, 80), date: (anneesDe(`${r.title || ''} ${r.description || ''}`) || []).join('–'), desc: nettoyer(r.description).slice(0, 140) };
      // Une seule par joueur : la première qui passe les règles (la plus pertinente pour Openverse). L'œil la
      // garde ou l'écarte ; écartée, le joueur reste sans photo — on ne fouille pas plus loin pour en trouver une.
      retenus.set(j.id, cand);
      break;
    }
  }
  const ov = [...retenus.values()].filter(r => r.source === 'libres');
  for (const r of ov) sourcesOV[r.o] = (sourcesOV[r.o] || 0) + 1;
  console.log(`  Openverse : ${ov.length} candidats (${Object.entries(sourcesOV).map(([k, n]) => `${k} ${n}`).join(' · ') || '—'})${arret ? ` — arrêté : ${arret}` : ''} ; ${fs.readdirSync(path.join(BRUT, 'ov')).length} joueurs lus, ${ratees} sans réponse, ${restent.length} à lire en tout`);
  for (const [m, n] of Object.entries(motifsOV)) console.log(`     écartés : ${m} ${n}`);
}

/* ---------- 3. Le téléchargement, les visages ---------- */

const aTelecharger = [...retenus.keys()];
let echecs = 0;
async function telecharger(id) {
  const f = path.join(BRUT, `${id}.jpg`), r = retenus.get(id), marque = path.join(BRUT, `${id}.src`);
  if (fs.existsSync(f) && fs.existsSync(marque) && fs.readFileSync(marque, 'utf8') === r.s) return true;
  const buf = await poli(r.s, { json: false, ecart: 400 }).catch(() => null);
  if (!buf || buf.length < 4096) { echecs++; retenus.delete(id); return false; }
  fs.writeFileSync(f, buf); fs.writeFileSync(marque, r.s);
  return true;
}
for (let i = 0; i < aTelecharger.length; i++) {
  await telecharger(aTelecharger[i]);
  if ((i + 1) % 100 === 0) console.log(`   ${i + 1} / ${aTelecharger.length} images`);
}
const VIS = path.join(BRUT, 'visages.json');
const py = spawnSync('python3', [path.join(ROOT, 'scripts', 'visages_actions.py'), BRUT, '--json', VIS], { stdio: 'inherit' });
if (py.status !== 0) throw new Error('scripts/visages_actions.py a échoué (pip install opencv-python-headless)');
const visages = JSON.parse(fs.readFileSync(VIS, 'utf8'));
// Aucun visage (un logo, une carte, un dos) ou trois et plus (un groupe) : à l'œil, même datée.
for (const [id, r] of retenus) {
  const v = visages[id];
  if (!v) { retenus.delete(id); echecs++; continue; }
  r.visage = v;
  if (r.st === 'datee' && (v[2] === 0 || v[2] >= 3)) { r.st = 'oeil'; r.pourquoi = v[2] ? `${v[2]} visages` : 'aucun visage'; }
}

/* ---------- 4. Le cadrage ---------- */

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.setContent('<body></body>');
await page.addScriptTag({ content: `window.recadrerActionBlob = ${recadrerAction.toString()};` });
await page.evaluate(({ LARGEUR, HAUTEUR, QUALITE }) => {
  window.recadrer = async (b64, centre) => {
    const blob = await (await fetch(`data:application/octet-stream;base64,${b64}`)).blob();
    const { webp, fenetre } = await window.recadrerActionBlob(blob, { largeur: LARGEUR, hauteur: HAUTEUR, qualite: QUALITE, centre });
    // Noir et blanc ? La couleur moyenne (le max moins le min de chaque point) d'une image réduite.
    const img = await createImageBitmap(blob), largeurImage = img.width;
    const c = new OffscreenCanvas(64, 64), x = c.getContext('2d');
    x.drawImage(img, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data;
    let couleur = 0;
    for (let k = 0; k < d.length; k += 4) couleur += Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]);
    img.close();
    const buf = new Uint8Array(await webp.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { webp: btoa(s), fenetre, largeurImage, couleur: couleur / 4096 };
  };
}, { LARGEUR, HAUTEUR, QUALITE });
/*
 * UN PORTRAIT POSÉ N'EST PAS UNE PHOTO D'ACTION (JP : *des photos EN ACTION*). La tête en gros plan : le
 * visage fait plus de 40 % de la largeur de la carte. La photo d'équipe des années 70-80 (la tête et les
 * épaules, de face) : plus de 28 %, en noir et blanc ou d'un joueur arrivé avant 1990. Elle est écartée. Mesuré
 * sur les planches : entre 28 et 40 %, les photos récentes en couleur sont presque toutes prises au match (le
 * casque, la bande), les autres presque toutes posées. Le noir et blanc : une couleur moyenne sous 10 (sur 255 ;
 * les vraies couleurs passent 12, les noir et blanc restent sous 9).
 */
const PORTRAIT = 0.40, PORTRAIT_ANCIEN = 0.28, NOIR_ET_BLANC = 10;
const recadres = new Map(), portraits = new Set();
for (const [id, r] of retenus) {
  try {
    const x = await page.evaluate(([b, c]) => window.recadrer(b, c), [fs.readFileSync(path.join(BRUT, `${id}.jpg`)).toString('base64'), r.visage[0]]);
    recadres.set(id, Buffer.from(x.webp, 'base64'));
    const visage = r.visage[3] * x.largeurImage / x.fenetre[2];
    if (visage > PORTRAIT || (visage > PORTRAIT_ANCIEN && (x.couleur < NOIR_ET_BLANC || joueurs.get(id).de < 1990))) portraits.add(id);
  } catch { retenus.delete(id); echecs++; }
}

// Ce qui entre : une datée que l'œil n'a pas écartée, une à l'œil qu'il a gardée.
const ecartees = {}, entrent = [];
for (const [id, r] of retenus) {
  const vu = VU.get(r.cle);
  if (vu && vu !== 'gardees') { ecartees[vu] = (ecartees[vu] || 0) + 1; continue; }
  if (portraits.has(id)) { ecartees['un portrait posé, pas en action'] = (ecartees['un portrait posé, pas en action'] || 0) + 1; continue; }
  if (r.st === 'oeil' && vu !== 'gardees') continue;
  entrent.push(id);
}
// Aucun WebP en double, ni entre elles ni avec une photo déjà là.
const md5 = b => createHash('md5').update(b).digest('hex');
const deja = new Map();
for (const id of lnh) { const f = path.join(SORTIE, `${id}.webp`); if (fs.existsSync(f)) deja.set(md5(fs.readFileSync(f)), id); }
const doubles = new Set();
for (const id of entrent) { const h = md5(recadres.get(id)); if (deja.has(h)) { doubles.add(id); doubles.add(deja.get(h)); } else deja.set(h, id); }
const finales = entrent.filter(id => !doubles.has(id)).sort((a, b) => a - b);
const attendent = [...retenus].filter(([id, r]) => r.st === 'oeil' && !VU.has(r.cle) && !portraits.has(id)).map(([id]) => id);

const n = (src, st) => finales.filter(id => retenus.get(id).source === src && (!st || retenus.get(id).st === st)).length;
console.log(`\n  ENTRENT : ${finales.length} — Commons ${n('commons')} (${n('commons', 'datee')} datées, ${n('commons', 'oeil')} gardées à l'œil), Openverse ${n('libres')}`);
console.log(`  écartées à l'œil : ${Object.entries(ecartees).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'} ; ${attendent.length} attendent encore l'œil ; ${doubles.size} en double ; ${echecs} illisibles`);
const licences = {};
for (const id of finales) { const l = retenus.get(id).l.replace(/ \d\.\d$/, ''); licences[l] = (licences[l] || 0) + 1; }
console.log(`  licences : ${Object.entries(licences).map(([k, v]) => `${k} ${v}`).join(' · ')}`);

/* ---------- 5. L'écriture ---------- */

if (!SEC) {
  const commons = {}, libres = {}, vis = { ...lu.visages };
  // Les photos d'avant de ce script s'en vont (leur WebP aussi) ; les retenues reviennent.
  for (const id of [...Object.keys(commonsAvant), ...Object.keys(libresAvant)]) {
    delete vis[id];
    if (!finales.includes(Number(id))) fs.rmSync(path.join(SORTIE, `${id}.webp`), { force: true });
  }
  let octets = 0;
  for (const id of finales) {
    const r = retenus.get(id);
    fs.writeFileSync(path.join(SORTIE, `${id}.webp`), recadres.get(id));
    octets += recadres.get(id).length;
    if (r.visage[0] != null) vis[id] = r.visage[0];
    if (r.source === 'commons') commons[id] = { f: r.titre, a: r.a, l: r.l, s: r.s };
    else libres[id] = { a: r.a, l: r.l, s: r.s, p: r.p, o: r.o };
  }
  const ids = [...new Set([...lnh, ...finales])].sort((a, b) => a - b);
  const sortie = { ...lu, ids, visages: Object.fromEntries(Object.entries(vis).sort((a, b) => a[0] - b[0])), commons };
  if (Object.keys(libres).length) sortie.libres = libres; else delete sortie.libres;
  fs.writeFileSync(LISTE, JSON.stringify(sortie));
  console.log(`  écrit : ${finales.length} WebP (${(octets / 1048576).toFixed(1)} Mo), data/actions.json (${ids.length} joueurs)`);
}

/* ---------- 6. Les planches de la vérification à l'œil ---------- */

if (PLANCHE) {
  fs.mkdirSync(PLANCHE, { recursive: true });
  // Toutes celles qui attendent l'œil ; puis un échantillon des datées, de chaque décennie.
  const datees = finales.filter(id => retenus.get(id).st === 'datee' && !VU.has(retenus.get(id).cle));
  const parDecennie = new Map();
  for (const id of datees) { const d = Math.floor(joueurs.get(id).de / 10) * 10; parDecennie.set(d, [...(parDecennie.get(d) || []), id]); }
  const parDec = Number(arg('echantillon', 12));
  const echantillon = [...parDecennie.values()].flatMap(l => l.filter((_, k) => k % Math.max(1, Math.floor(l.length / parDec)) === 0).slice(0, parDec));
  // Avant 2000, les datées se revoient toutes (cartes, complets d'avant-match) : --revoir-avant 2000.
  const avant = Number(arg('revoir-avant', 0));
  const anciennes = datees.filter(id => joueurs.get(id).de < avant);
  const lots = [['a-voir', attendent], ['datees', echantillon.filter(id => !anciennes.includes(id))], ['anciennes', anciennes]];
  await page.setViewportSize({ width: 1500, height: 900 });
  for (const [nom, liste] of lots) {
    for (let k = 0; k < liste.length; k += 16) {
      const cases = liste.slice(k, k + 16).map(id => {
        const r = retenus.get(id), j = joueurs.get(id), v = r.visage;
        return `<figure style="margin:4px 4px 10px;display:inline-block;width:360px;vertical-align:top;color:#ddd;font:11px/1.3 sans-serif">
          <div style="display:flex;gap:4px"><img src="data:image/jpeg;base64,${fs.readFileSync(path.join(BRUT, `${id}.jpg`)).toString('base64')}" style="width:240px;height:200px;object-fit:contain;background:#222">
          <img src="data:image/webp;base64,${recadres.get(id).toString('base64')}" style="width:114px;height:160px"></div>
          <figcaption><b style="color:#fc6">${k + liste.slice(k, k + 16).indexOf(id) + 1}. ${j.n}</b> · ${saisonsDe(j)} · ${[...j.clubs].join(' ')}<br>date : ${r.date || '—'} · ${r.pourquoi || 'datée'} · ${v[2]} vis.<br><span style="color:#999">${r.source === 'commons' ? r.titre : `${r.o} : ${r.titre}`}</span></figcaption></figure>`;
      }).join('');
      await page.setContent(`<body style="background:#111;margin:6px;width:1480px">${cases}</body>`);
      const f = path.join(PLANCHE, `${nom}-${String(k / 16 + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: f, fullPage: true });
    }
    console.log(`  planches « ${nom} » : ${Math.ceil(liste.length / 16)} (${liste.length} images) dans ${PLANCHE}`);
  }
  // La liste à recopier : l'ordre des planches, la clé de chaque image.
  fs.writeFileSync(path.join(PLANCHE, 'cles.json'), JSON.stringify(Object.fromEntries(lots.map(([nom, l]) => [nom, l.map(id => [id, joueurs.get(id).n, retenus.get(id).cle])])), null, 1));
}
await navigateur.close();
if (!GARDER) fs.rmSync(BRUT, { recursive: true, force: true });
console.log(`  ${Math.round((Date.now() - t0) / 1000)} s\n`);
