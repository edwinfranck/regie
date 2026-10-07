import 'dotenv/config';
import { config as load } from 'dotenv';
import path from 'node:path';

load({ path: path.resolve(import.meta.dirname, '../../../.env') });

// Le projet de démonstration : un court-métrage original, « Fréquence Hlènou »,
// écrit de bout en bout (concept, monde, structure, bible, scénario, scènes,
// découpage) pour découvrir régie sans rien saisir.
//
// Aucun asset : pas d'image ni de vidéo inventée. Les références restent vides
// et le contrôle de continuité le signale — c'est la prochaine étape, celle
// qui consomme des crédits chez un provider réellement configuré.
//
// Usage : pnpm db:seed:demo -- --email vous@exemple.com   (ou DEMO_EMAIL=…)
// Idempotent : un projet de démo du même titre pour ce compte est supprimé puis recréé.

const { prisma } = await import('./index');
const { createProject, renumberShots } = await import('@regie/studio');
type Json = import('./index').Prisma.InputJsonValue;

const TITLE = 'Fréquence Hlènou';

function emailArg() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const i = args.findIndex((a) => a === '--email' || a === '-e');
  if (i >= 0) return args[i + 1];
  const eq = args.find((a) => a.startsWith('--email='));
  if (eq) return eq.slice('--email='.length);
  return args.find((a) => a.includes('@')) ?? process.env.DEMO_EMAIL;
}

/** Paragraphes HTML pour les champs en éditeur riche. */
const p = (...paras: string[]) => paras.map((x) => `<p>${x}</p>`).join('');

// ───────────────────────────── Concept ─────────────────────────────

const CONCEPT = {
  idea: p('Une réparatrice de radios de Cotonou remet en marche un vieux poste à lampes. Sur une fréquence oubliée, il capte les voix d’un quartier de pêcheurs rasé vingt-deux ans plus tôt — le sien.'),
  genre: 'Fantastique',
  subgenre: 'Réalisme magique',
  durationMin: 5,
  country: 'Bénin',
  era: 'Contemporain',
  audience: 'Tout public',
  tone: 'Poétique, tendre, contemplatif',
  theme: 'La mémoire d’un lieu survit tant que quelqu’un prononce les noms de ceux qui l’habitaient.',
  message: p('Une ville peut effacer un quartier de ses cartes ; elle ne peut pas empêcher qu’on dise à voix haute les noms de ceux qui y vivaient.'),
  inspirations:
    'Le réalisme magique sobre, où le merveilleux ne se voit pas mais s’entend. La photographie de studio ouest-africaine des années 1970 pour les portraits. Les radios de quartier et les dédicaces au micro comme mémoire collective. Le documentaire sonore pour la place laissée au hors-champ.',
  logline: 'À Cotonou, une réparatrice de radios découvre qu’un vieux poste capte les voix du quartier de pêcheurs où elle a grandi, rasé pour une voie express ; quand les voix commencent à s’éteindre, elle a une nuit pour les rendre à la ville.',
  tagline: 'Certains quartiers ne disparaissent que si on cesse de les écouter.',
  synopsisShort: p(
    'Sènami répare des radios dans un conteneur du marché de Gbèto. Un vieux pêcheur, Dah Comlan, lui confie un poste à lampes « qui parle encore » : réparé, il capte sur 87.6 les voix de Hlènou, le quartier de pêcheurs rasé vingt-deux ans plus tôt pour une voie express — et parmi elles, celle de la mère de Sènami.',
    'Avec Rodrigue, son apprenti, elle découvre que les voix sont plus nettes sur le remblai où se dressait le quartier. Mais elles faiblissent chaque jour, et le marché lui-même doit être libéré sous trente jours. Firmin, l’agent municipal venu coller l’avis d’expulsion, reconnaît dans le poste sa propre voix d’enfant. Ensemble, une nuit, ils diffusent Hlènou sur les haut-parleurs du marché ; quand les voix se taisent, Sènami prend le micro et lit, un à un, les noms des familles.',
  ),
  synopsisLong: p(
    'Cotonou, aujourd’hui. Dans l’allée la plus étroite du marché de Gbèto, un conteneur maritime ouvert déborde de radios d’occasion. C’est l’atelier de Sènami, trente-quatre ans, réparatrice minutieuse et peu bavarde. Rodrigue, dix-sept ans, son apprenti, filme tout pour ses abonnés au lieu de souder.',
    'Un matin, Dah Comlan, ancien pêcheur de soixante-quatorze ans, dépose sur l’établi un poste à lampes en bois verni. « Il parle encore, dit-il. Mais moi, je ne l’entends plus. » Le poste a, selon lui, l’âge de Hlènou. Sènami se fige : Hlènou, le quartier de pêcheurs au bord de la lagune où elle a grandi, a été rasé vingt-deux ans plus tôt pour faire passer une voie express. Elle avait douze ans.',
    'La nuit, seule dans le marché endormi, elle remplace la lampe grillée. Le cadran s’allume d’un bleu pâle, l’aiguille s’arrête sur 87.6, et le poste se met à parler : des pagaies qui frappent l’eau, des pêcheurs qui s’appellent, des enfants qui comptent. Puis une voix de femme : « Sènami ! Viens manger, ça refroidit ! » C’est sa mère, morte trois ans après le déménagement.',
    'Sènami emmène le poste sur le remblai de la voie express, là où se trouvait l’embarcadère. Les voix y sont claires comme si quelqu’un avait ouvert une fenêtre. Rodrigue tente de les enregistrer : son téléphone n’entend rien. « Ton téléphone n’entend rien. Mais moi, j’entends. » Il est devenu son premier allié.',
    'Le lendemain, Firmin Tossou, agent de la mairie, colle sur le conteneur un avis : les emplacements doivent être libérés sous trente jours. Le marché deviendra un parking. Derrière lui, le poste grésille : « … neuf, dix ! Firmin, c’est toi qui cherches ! » Firmin reconnaît sa propre voix d’enfant. Lui aussi vient de Hlènou ; sa famille avait eu trois jours pour partir. Mais la voix se dissout dans le souffle : chaque jour, le poste capte un peu moins. Hlènou s’éteint une seconde fois.',
    'La nuit suivante, sur le toit du marché, Rodrigue branche un émetteur bricolé dans une boîte de biscuits sur les vieux haut-parleurs à pavillon. Firmin arrive avec le registre du recensement : quatre cent douze familles, tous les noms. Rodrigue bascule l’interrupteur et les voix de Hlènou se répandent sur la ville endormie. Une vendeuse de pain lève la tête, un taxi-moto coupe son moteur. Puis, une à une, les voix se taisent. Le cadran pâlit.',
    'Sènami prend le micro et lit les noms. Dah Comlan, qui n’entendait plus le poste, ferme les yeux et sourit : « Là. Je l’entends. »',
    'À l’aube, sur la voie express, un taxi-moto passe avec sa petite radio accrochée au guidon. Sur 87.6, la voix de Sènami continue la liste. Au bord de l’eau, Dah Comlan regarde partir les pirogues. Le poste, à côté de lui, est éteint. Il n’en a plus besoin.',
  ),
  pitch: p(
    'Un poste de radio qui capte un quartier rasé, une réparatrice qui y entend la voix de sa mère, et une nuit pour rendre ces voix à la ville avant qu’elles ne s’éteignent. Cinq minutes de réalisme magique à Cotonou, où le merveilleux ne se montre jamais : il s’entend. Un film sur ce que les villes effacent et sur ce que les gens refusent d’oublier.',
  ),
  themes: ['Mémoire', 'Transmission', 'Deuil', 'Identité', 'Tradition et modernité'],
  conflicts: p(
    '<strong>Central</strong> : Sènami contre l’effacement. Les voix de Hlènou s’éteignent jour après jour, comme le quartier a été effacé une première fois.',
    '<strong>Intérieur</strong> : Sènami a enfoui Hlènou pour ne plus souffrir ; l’écouter, c’est rouvrir le deuil de sa mère.',
    '<strong>Secondaire</strong> : Firmin applique une nouvelle expulsion, celle du marché, alors qu’il a lui-même subi la première.',
  ),
  stakes: p('Si Sènami échoue, Hlènou disparaît pour de bon : plus de voix, plus de noms, plus personne pour dire qu’on a vécu là. Et elle perd la dernière trace de la voix de sa mère.'),
  universe: p(
    'Le Cotonou d’aujourd’hui, dense, chaud, bruyant, filmé sans exotisme : marchés couverts de tôle, taxis-motos, voies express neuves posées sur la lagune. Une seule entorse au réel, jamais montrée à l’image : un poste à lampes qui capte, sur 87.6, les voix d’un quartier qui n’existe plus.',
  ),
};

// ───────────────────────────── Monde ─────────────────────────────

const WORLD = {
  rules: p(
    'La magie est uniquement sonore. On ne voit jamais de fantôme, de silhouette translucide, de lumière surnaturelle : seul le cadran du poste s’allume d’un bleu pâle quand les voix passent.',
    'Seul le poste de Dah Comlan capte Hlènou, et seulement sur 87.6. Aucun autre appareil ne peut enregistrer les voix : un téléphone affiche une forme d’onde plate.',
    'Les voix sont plus nettes sur le lieu même de l’ancien quartier. Elles faiblissent chaque jour depuis que le poste est réparé.',
  ),
  geography: p(
    'Cotonou, capitale économique du Bénin, coincée entre l’océan et la lagune. Le marché de Gbèto (fictif) occupe un ancien entrepôt dans un quartier populaire. À vingt minutes en taxi-moto, la voie express de la lagune longe l’eau sur un remblai de terre et de béton, à l’emplacement exact de Hlènou.',
  ),
  history: p(
    'Hlènou (fictif) était un quartier de pêcheurs de quatre cent douze familles, construit sur pilotis et en terre battue au bord de la lagune. Il y a vingt-deux ans, il a été rasé en trois jours pour faire passer la voie express. Les familles ont été dispersées dans toute la ville ; le quartier n’apparaît plus sur aucune carte.',
    'Aujourd’hui, la mairie modernise les marchés : celui de Gbèto doit devenir un parking. L’histoire se répète, à plus petite échelle.',
  ),
  culture: p(
    'On parle français, fon et mina, souvent dans la même phrase. On s’appelle par des titres affectueux : « Dah » pour un aîné respecté, « patronne » pour une cheffe d’atelier. La radio reste le média du quotidien : dédicaces, avis de décès, annonces de quartier.',
  ),
  technology: p(
    'Smartphones fendus et réparés dix fois, postes à lampes des années 1960 côtoyant des enceintes Bluetooth. La réparation est une culture : rien ne se jette, tout se ressoude. Les haut-parleurs à pavillon des marchés servent encore aux annonces.',
  ),
  economy: p(
    'Économie informelle et débrouille : emplacements de marché loués au mois, petits métiers, taxis-motos. Une expulsion signifie perdre sa clientèle autant que son toit.',
  ),
  architecture: p(
    'Conteneurs maritimes transformés en boutiques, toits de tôle ondulée, bâches plastiques, béton brut des infrastructures neuves. Peintures passées : rouille, turquoise, ocre.',
  ),
  objects: p(
    'Le poste à lampes de Dah Comlan, son cadran et son aiguille rouge. La boîte de biscuits en fer devenue émetteur. Le registre cartonné du recensement de Hlènou. Les haut-parleurs à pavillon rouillés du toit du marché.',
  ),
};

// ───────────────────────────── Bible ─────────────────────────────

const STYLE = {
  code: 'S1',
  name: 'Réalisme chaud',
  short: 'grounded contemporary realism, 35mm film look, warm natural skin tones, gentle grain',
  block:
    'LOOK: grounded contemporary realism shot on 35mm film. Warm, natural rendering of dark skin with visible texture and detail, gentle film grain, soft halation around practical lights, humid tropical air. Saturated but never garish colours: rust, indigo, ochre, faded turquoise. Naturalistic framing, no glamour retouching. The magic is never visual: people never glow; only the radio dial shines.',
  never: ['cartoon', 'anime', 'plastic skin', 'oversaturated HDR', 'ghosts', 'glowing auras', 'text overlays', 'watermark', 'lightened skin tones'],
};

const LIGHTS = {
  DAY: {
    name: 'Jour',
    short: 'hard tropical daylight filtered through corrugated roofs',
    block: 'LIGHT: hard tropical midday sun outside, bouncing off corrugated iron and dust; inside the container, soft dirty bounce light, warm highlights, deep but readable shadows on dark skin.',
    never: ['blue night tint', 'moonlight'],
  },
  NIGHT: {
    name: 'Nuit',
    short: 'deep night, one bare warm bulb and the pale cyan glow of the radio dial',
    block: 'LIGHT: deep night. One bare tungsten bulb as the key, warm and hard; the radio dial adds a small pale cyan fill on faces; distant sodium street lights in the background; true blacks, no blue day-for-night.',
    never: ['daylight', 'sun', 'bright sky'],
  },
  GOLDEN: {
    name: 'Heure dorée',
    short: 'low golden sun over the lagoon, humid haze, long shadows',
    block: 'LIGHT: sun a few degrees above the lagoon horizon, warm orange backlight, humid haze softening the distance, long shadows across the asphalt, warm rim light on faces, cool blue shadows.',
    never: ['harsh noon light', 'night sky'],
  },
} as const;

const CHARACTERS = [
  {
    code: 'CH1',
    name: 'Sènami Hounkpè',
    role: 'Protagoniste',
    age: '34 ans',
    gender: 'Femme',
    origin: 'Cotonou (Bénin), née à Hlènou',
    heightM: 1.68,
    short: 'CH1 Sènami, 34, Beninese woman, 1.68m, short natural afro, round brass-rimmed glasses, oil-stained brown leather apron over an indigo work shirt.',
    block:
      'West African woman, 34 years old, deep dark-brown skin, oval face with high cheekbones and a small pale scar across the left eyebrow, calm dark-brown eyes. Slim, strong forearms, long fingers with tiny burn marks from soldering. Short natural afro hair, about 4 cm, neatly shaped. Round brass-rimmed glasses; a head-mounted magnifier loupe usually pushed up on her forehead. No makeup, small silver stud earrings.',
    costume:
      'Faded indigo short-sleeved work shirt with rolled sleeves; heavy brown leather apron with oil stains and a chest pocket full of screwdrivers (P3); dark grey cotton trousers; black plastic sandals.',
    silhouette: 'brown leather apron and a magnifier loupe on her forehead',
    never: ['long hair', 'braids', 'headscarf', 'bright makeup', 'large jewellery', 'spotless clothes', 'lightened skin'],
    profile: {
      personality: p('Précise, patiente, économe de ses mots. Un humour sec qu’elle réserve à Rodrigue. Elle écoute plus qu’elle ne parle — c’est son métier.'),
      backstory: p('Née à Hlènou, fille d’une vendeuse de poisson frit. Elle avait douze ans quand le quartier a été rasé. Sa mère est morte trois ans plus tard, dans une chambre louée loin de l’eau. Sènami a appris l’électronique seule, sur les postes qu’on jetait.'),
      motivation: p('Garder ce qui fonctionne encore. Réparer plutôt que remplacer.'),
      fear: p('Rouvrir ce qu’elle a refermé : entendre Hlènou, c’est perdre sa mère une seconde fois.'),
      desire: p('Entendre encore une fois la voix de sa mère.'),
      goal: p('Empêcher que les voix de Hlènou s’éteignent sans que personne les ait entendues.'),
      conflict: p('Son réflexe de protection (« Nulle part. Plus maintenant. ») contre le besoin de transmettre.'),
      arc: p('De la réparatrice qui garde Hlènou enfermé en elle à la voix qui le rend à toute la ville. Elle commence en écoutant ; elle finit en parlant.'),
      relations: p('Maîtresse exigeante et grande sœur pour Rodrigue. Respect silencieux pour Dah Comlan, qui a connu sa mère. Méfiance, puis alliance, avec Firmin.'),
      speech: p('Phrases courtes, souvent sans sujet. Elle tutoie Rodrigue, vouvoie les aînés. Passe au fon quand l’émotion monte.'),
      behavior: p('Remonte sa loupe sur son front avant de parler à quelqu’un. Touche toujours un objet avant de répondre.'),
      accessories: p('Loupe frontale, fer à souder, tournevis dans la poche du tablier.'),
      evolution: p('Dans la dernière scène, on ne la voit plus : on l’entend. Elle est devenue la fréquence.'),
    },
  },
  {
    code: 'CH2',
    name: 'Rodrigue Agossou',
    role: 'Allié',
    age: '17 ans',
    gender: 'Homme',
    origin: 'Cotonou, quartier du marché de Gbèto',
    heightM: 1.8,
    short: 'CH2 Rodrigue, 17, lanky Beninese teenager, 1.80m, high-top fade, oversized faded yellow football jersey, cracked smartphone in hand.',
    block:
      'West African teenage boy, 17 years old, dark-brown skin, narrow face, wide quick smile with a small gap between the front teeth, lively eyes. Very tall and lanky, long arms. High-top fade haircut with a thin shaved line on the right side. Faint moustache shadow.',
    costume:
      'Oversized faded yellow football jersey with no logo and the number 10 on the back; black track pants with white side stripes; worn white sneakers; a cracked smartphone always in hand; a roll of black electrical tape worn on the wrist like a bracelet.',
    silhouette: 'tall and thin in an oversized yellow jersey, phone raised',
    never: ['brand logos', 'football club crest', 'glasses', 'beard', 'dreadlocks'],
    profile: {
      personality: p('Curieux, bavard, moqueur, plus tendre qu’il ne veut le montrer. Croit à ce qu’il peut filmer — jusqu’au jour où il ne peut pas.'),
      backstory: p('Né après la destruction de Hlènou, dans le quartier du marché. Apprenti chez Sènami depuis deux ans ; il rêve d’avoir dix mille abonnés.'),
      motivation: p('Être pris au sérieux. Trouver quelque chose qui mérite d’être filmé.'),
      fear: p('Rester celui qui regarde à travers un écran.'),
      goal: p('Prouver que les voix existent — puis les faire entendre à tous.'),
      arc: p('Du spectateur sceptique au technicien de la diffusion : c’est lui qui bascule l’interrupteur.'),
      relations: p('Admire Sènami sans jamais l’avouer. Intimidé par Dah Comlan.'),
      speech: p('Argot de Cotonou, anglicismes des réseaux, « patronne » pour Sènami.'),
      behavior: p('Lève son téléphone dès qu’il se passe quelque chose ; le baisse quand il comprend que ça ne sert à rien.'),
      accessories: p('Téléphone fendu, rouleau de chatterton au poignet, l’émetteur dans sa boîte de biscuits (P2).'),
    },
  },
  {
    code: 'CH3',
    name: 'Dah Comlan',
    role: 'Mentor',
    age: '74 ans',
    gender: 'Homme',
    origin: 'Ancien pêcheur de Hlènou',
    heightM: 1.7,
    short: 'CH3 Dah Comlan, 74, thin elderly Beninese fisherman, white stubble, faded red cloth cap, faded wax-print shirt, carved wooden cane.',
    block:
      'Elderly West African man, 74 years old, very dark weathered skin with deep wrinkles around the eyes, hollow cheeks, short white stubble beard and close-cropped white hair, slightly cloudy eyes, a gentle lopsided smile. Thin and slightly stooped, sinewy arms of a former fisherman, large knotted hands.',
    costume:
      'Loose short-sleeved shirt in faded blue and ochre wax-print fabric with matching wide trousers, worn leather sandals, a small faded red cloth cap, a carved dark wooden cane with a fish-shaped handle.',
    silhouette: 'stooped figure with a faded red cloth cap and a fish-handled cane',
    never: ['sunglasses', 'hearing aid', 'sportswear', 'full beard', 'bald head'],
    profile: {
      personality: p('Calme, malicieux, têtu. Parle peu et toujours au bon moment.'),
      backstory: p('A pêché toute sa vie sur la lagune depuis l’embarcadère de Hlènou. Le poste à lampes trônait dans sa case ; c’est la seule chose qu’il a emportée en partant. Il devient sourd et n’entend plus ce que le poste lui murmurait.'),
      motivation: p('Que quelqu’un entende enfin ce que le poste dit, avant qu’il ne soit trop tard pour lui.'),
      fear: p('Mourir dans le silence, sans que Hlènou soit nommé.'),
      goal: p('Confier le poste à la bonne personne.'),
      arc: p('Il n’entend plus le poste, mais il entend Sènami : la mémoire passe des machines aux vivants.'),
      relations: p('A connu la mère de Sènami ; il savait qui il venait voir.'),
      speech: p('Proverbes courts, phrases au présent. « Il parle encore. »'),
      behavior: p('Pose les objets comme des nouveau-nés. Penche la tête du côté de sa meilleure oreille.'),
      accessories: p('Canne au pommeau en forme de poisson, calot rouge.'),
    },
  },
  {
    code: 'CH4',
    name: 'Firmin Tossou',
    role: 'Gardien du seuil',
    age: '31 ans',
    gender: 'Homme',
    origin: 'Agent municipal, enfant de Hlènou',
    heightM: 1.75,
    short: 'CH4 Firmin, 31, Beninese civil servant, thin neat moustache, ironed white shirt, blue lanyard badge, brown clipboard.',
    block:
      'West African man, 31 years old who looks older, medium-dark brown skin, round face, thin neatly trimmed moustache, very short hair with a sharp hairline, tired but attentive eyes. Average build, slight belly, very upright posture.',
    costume:
      'Crisp ironed white short-sleeved shirt, navy trousers with a sharp crease, polished black shoes, a blue lanyard with a laminated municipal badge without readable text, a ballpoint pen in the shirt pocket, a brown cardboard clipboard.',
    silhouette: 'white shirt and blue lanyard, clipboard under the arm',
    never: ['tie', 'suit jacket', 'readable text on the badge', 'sunglasses', 'beard'],
    profile: {
      personality: p('Consciencieux, poli, raide. Se cache derrière le règlement pour ne pas avoir à ressentir.'),
      backstory: p('Enfant de Hlènou, il avait neuf ans quand sa famille a eu trois jours pour partir. Il est entré à la mairie pour « que ce soit fait proprement, cette fois ».'),
      motivation: p('Faire son travail sans faire de mal. Il sait que c’est impossible.'),
      fear: p('Être, pour d’autres, ce que les agents de l’époque ont été pour lui.'),
      goal: p('Appliquer la décision du marché dans les délais.'),
      conflict: p('Le fonctionnaire qui expulse contre l’enfant expulsé.'),
      arc: p('De l’exécutant au gardien de la mémoire : il ne peut pas annuler l’expulsion, mais il apporte les noms.'),
      relations: p('Croise Sènami en adversaire ; la quitte en complice. Ils jouaient peut-être dans les mêmes ruelles.'),
      speech: p('Vocabulaire administratif (« libération des emplacements », « je ne fais qu’appliquer »), qui se brise quand il parle de son enfance.'),
      behavior: p('Serre sa planchette contre sa poitrine comme un bouclier.'),
      accessories: p('Planchette, badge, stylo ; le registre du recensement dans la scène 5.'),
    },
  },
];

const LOCATIONS = [
  {
    code: 'L1',
    name: 'Atelier de Sènami',
    interior: true,
    short: 'L1 Sènami’s repair stall: an open shipping container in a dense market, stacked floor to ceiling with old radios.',
    block:
      'An old 20-foot shipping container converted into a radio repair stall, rust-red outside and faded turquoise inside, both doors wide open onto a narrow covered market alley. Floor-to-ceiling shelves of second-hand radios, cassette players and loudspeakers, tangled cables hanging from the ceiling like vines. A long wooden workbench across the back with a soldering station, a magnifying lamp, small drawers of components and a single bare light bulb. A hand-painted sign with a drawing of a radio and no readable text. Corrugated iron awnings and plastic sheeting over the alley outside.',
    architecture: p('Conteneur maritime de six mètres posé dans une allée couverte de tôle. Profondeur forte : l’établi au fond, la lumière de l’allée à l’entrée.'),
    era: 'Contemporain',
    palette: 'Ocres et terres, Turquoise passé, Rouille',
    lighting: 'Lumière de fenêtre, Tungstène, Mixte chaud-froid',
    weather: 'Sans objet (intérieur)',
    mood: 'Familier, Intime, Animé',
    textures: p('Tôle rouillée, bois patiné de l’établi, plastique jauni des vieux postes, poussière dans les rais de lumière.'),
    objects: p('Étagères de radios, fer à souder, lampe-loupe, tiroirs de composants, ampoule nue, ventilateur cassé, calendrier sans texte lisible.'),
    sound: 'market chatter, a vendor calling prices, distant generator hum, radio static, the hiss of a soldering iron',
    never: ['readable text', 'brand names', 'flat-screen TVs', 'empty shelves', 'air conditioning unit'],
  },
  {
    code: 'L2',
    name: 'Voie express de la lagune',
    interior: false,
    short: 'L2 a four-lane expressway on an embankment between the city and a wide brown lagoon, where a fishing quarter once stood.',
    block:
      'A four-lane concrete expressway on a raised embankment between the sprawling city and a wide brown lagoon. Grey asphalt, a low concrete median wall, sodium street lamps on tall poles. On the lagoon side, a dusty shoulder with a few broken concrete foundations and a lone half-buried tiled step, the only remains of a demolished fishing quarter. Water hyacinth along the shore, wooden pirogues pulled up on the mud, fishing nets drying on stakes. A low hazy city skyline in the distance.',
    architecture: p('Infrastructure neuve et brutale : remblai, glissières, lampadaires alignés. En contrebas, les fondations brisées de Hlènou, presque effacées par la végétation.'),
    era: 'Contemporain',
    palette: 'Ors et bruns, Ocres et terres, Bleus nuit',
    lighting: 'Heure dorée, Contre-jour, Lampadaires',
    weather: 'Humide et lourd',
    mood: 'Désolé, Mélancolique, Nostalgique',
    textures: p('Asphalte poussiéreux, béton fissuré, boue de la berge, jacinthes d’eau, bois des pirogues.'),
    objects: p('Muret de béton, marche carrelée à demi enterrée, pirogues, filets sur des piquets, lampadaires.'),
    sound: 'trucks passing on the expressway, wind, lagoon water lapping, distant fishermen calling, egrets',
    never: ['houses on stilts', 'intact village', 'readable road signs', 'tourists'],
  },
  {
    code: 'L3',
    name: 'Toit du marché de Gbèto',
    interior: false,
    short: 'L3 the flat concrete roof of a market at night, rusty horn loudspeakers on a pole facing the city.',
    block:
      'The flat concrete roof of a two-storey market building at night, edged by low parapets. Old rusty horn loudspeakers on a metal pole facing the city, a tangle of cables and a small TV antenna, plastic water tanks, two plastic chairs and an upturned bucket. Beyond the parapet, a sea of corrugated iron roofs, a low skyline of concrete buildings with scattered warm lights, sagging power lines.',
    architecture: p('Toit-terrasse de béton brut, parapets bas, poteau métallique des haut-parleurs. Au-delà, l’océan de tôle de la ville.'),
    era: 'Contemporain',
    palette: 'Bleus nuit, Accent rouge sur fond neutre',
    lighting: 'Lampadaires, Faible clé (low key), Mixte chaud-froid',
    weather: 'Ciel voilé',
    mood: 'Mystérieux, Solennel, Intime',
    textures: p('Béton taché, rouille des pavillons, plastique des cuves, câbles gainés de chatterton.'),
    objects: p('Haut-parleurs à pavillon, antenne, cuves d’eau, chaises en plastique, seau retourné, rallonge électrique.'),
    sound: 'night insects, distant moto-taxis, generator hum, loudspeaker hiss and feedback',
    never: ['readable text', 'skyscrapers', 'neon signs'],
  },
];

const PROPS = [
  {
    code: 'P1',
    kind: 'PROP' as const,
    name: 'Le poste de Dah Comlan',
    short: 'P1 a 1960s varnished wooden tube radio, size of a small suitcase, with a wide glass tuning dial.',
    block:
      'P1 a vintage tabletop tube radio in varnished dark wood, about 55 cm wide, rounded top corners, a woven beige fabric speaker grille on the left, a wide glass tuning dial on the right with a thin red needle and frequency numbers from 87 to 108, two large brown bakelite knobs. When voices come through, the dial glows pale cyan. Small scratches, one cracked corner patched with copper wire.',
    never: ['brand name', 'logo', 'digital display', 'plastic body'],
  },
  {
    code: 'P2',
    kind: 'PROP' as const,
    name: 'L’émetteur bricolé',
    short: 'P2 a homemade FM transmitter inside a dented round biscuit tin, telescopic antenna and old handheld microphone.',
    block:
      'P2 a homemade FM transmitter built inside a dented round metal biscuit tin with faded green and gold paint, lid open on a small hand-soldered circuit board, a red toggle switch, a 9-volt battery taped with black electrical tape, a long telescopic antenna and a coiled cable to an old handheld microphone.',
    never: ['brand name', 'readable text', 'professional broadcast equipment'],
  },
  {
    code: 'P3',
    kind: 'COSTUME' as const,
    name: 'Le tablier de Sènami',
    short: 'P3 a heavy brown leather work apron, oil-stained, screwdrivers in the chest pocket.',
    block:
      'P3 a heavy knee-length brown leather work apron, darkened by oil and small solder burns, a wide chest pocket holding three screwdrivers and a small flashlight, an adjustable neck strap with a brass buckle.',
    never: ['clean new leather', 'logo'],
  },
];

// ───────────────────────────── Scénario ─────────────────────────────

const FOUNTAIN = `INT. ATELIER DE SÈNAMI - JOUR

Un conteneur maritime ouvert sur une allée de marché. Des radios empilées jusqu’au plafond, des fils qui pendent comme des lianes. Odeur de soudure et de poisson fumé.

SÈNAMI (34 ans), tablier de cuir taché, loupe relevée sur le front, souffle sur une carte électronique. À côté d’elle, RODRIGUE (17 ans) la filme avec un téléphone fendu.

RODRIGUE
Dis bonjour à mes abonnés, patronne.

SÈNAMI
Dis-leur que tu es payé pour souder, pas pour filmer.

Une ombre couvre l’établi. DAH COMLAN (74 ans), chemise de pagne délavée, calot rouge, canne sculptée, porte dans ses bras un poste à lampes en bois verni, gros comme une valise.

Il le pose devant elle avec la précaution qu’on réserve à un nouveau-né.

DAH COMLAN
Il parle encore. Mais moi, je ne l’entends plus.

SÈNAMI
(examinant le poste)
Il a quel âge, celui-là ?

DAH COMLAN
L’âge de Hlènou.

Sènami se fige. Rodrigue lève les yeux de son téléphone.

RODRIGUE
C’est où, Hlènou ?

SÈNAMI
(sans le regarder)
Nulle part. Plus maintenant.

INT. ATELIER DE SÈNAMI - NUIT

Le marché dort. Une seule ampoule nue au-dessus de l’établi. Sènami remplace une lampe grillée, referme le capot, tourne le bouton.

Grésillement. Le cadran s’allume d’un bleu pâle. L’aiguille glisse, hésite, et s’arrête sur 87.6.

Des voix. Des pagaies qui frappent l’eau. Un homme qui appelle les pêcheurs. Des enfants qui comptent. Puis, toute proche, une voix de femme.

VOIX DE FEMME (RADIO)
Sènami ! Viens manger, ça refroidit !

Sènami recule d’un pas. Sa main tremble au-dessus du bouton. Elle ne l’éteint pas.

SÈNAMI
(dans un souffle)
Maman ?

Le grésillement avale la voix. Sènami reste seule face au cadran bleu, longtemps.

EXT. VOIE EXPRESS DE LA LAGUNE - CRÉPUSCULE

Une route à quatre voies posée sur un remblai, entre la ville et la lagune. Les camions passent sans ralentir. Sur le bas-côté, Sènami et Rodrigue. Le poste est posé sur un muret de béton, branché à une batterie de moto.

RODRIGUE
Tu m’as fait traverser la ville pour écouter la radio au bord d’une autoroute.

SÈNAMI
C’était ici. L’embarcadère. La maison de ma tante. L’école. Tout.

Elle tourne le bouton. Sur 87.6, les voix arrivent claires, comme si quelqu’un avait ouvert une fenêtre.

VOIX D’HOMME (RADIO)
Les pirogues rentrent ! Venez aider, les enfants !

Rodrigue lève lentement son téléphone. À l’écran, la forme d’onde reste plate. Rien ne s’enregistre.

RODRIGUE
Ton téléphone n’entend rien.
(un temps)
Mais moi, j’entends.

Sènami regarde la lagune. Pour la première fois, elle sourit.

INT. ATELIER DE SÈNAMI - JOUR

FIRMIN TOSSOU (31 ans), chemise blanche repassée, badge de la mairie, colle une affiche sur la porte du conteneur : « LIBÉRATION DES EMPLACEMENTS SOUS 30 JOURS ».

SÈNAMI
Encore un marché moderne ?

FIRMIN
Un parking. Avec des toilettes propres. Je ne fais qu’appliquer.

Derrière lui, le poste grésille. Une voix d’enfant.

VOIX D’ENFANT (RADIO)
… huit, neuf, dix ! Firmin, c’est toi qui cherches !

Firmin se retourne d’un coup. Il fixe le poste comme on fixe un revenant.

FIRMIN
Qui a enregistré ça ?

SÈNAMI
Personne. Ça vient de Hlènou.

FIRMIN
(à voix basse)
J’avais neuf ans. Ils nous ont donné trois jours.

La voix d’enfant se dissout dans le souffle. Sènami monte le volume : plus rien qu’un grésillement, de plus en plus faible.

SÈNAMI
Elles s’en vont. Chaque jour un peu plus.

EXT. TOIT DU MARCHÉ DE GBÈTO - NUIT

Les haut-parleurs à pavillon du marché, rouillés, tournés vers la ville. Rodrigue soude le dernier fil d’un émetteur bricolé dans une boîte de biscuits en fer. Dah Comlan, assis sur un seau retourné, tient le poste sur ses genoux.

Firmin arrive essoufflé, un registre cartonné sous le bras.

FIRMIN
Les archives du recensement. Quatre cent douze familles. Tous les noms.

SÈNAMI
Rodrigue. On y va.

Rodrigue bascule l’interrupteur. Les haut-parleurs toussent. Puis, au-dessus des toits de tôle, les voix de Hlènou se répandent sur la ville endormie.

En bas, une vendeuse de pain lève la tête. Un conducteur de taxi-moto coupe son moteur.

Les voix faiblissent, une à une. Le cadran pâlit. Silence.

Sènami prend le micro. Firmin ouvre le registre et le lui tend.

SÈNAMI
(au micro)
Famille Akplogan. Famille Dègbo. Famille Houéto…

Dah Comlan ferme les yeux. Il sourit.

DAH COMLAN
Là. Je l’entends.

EXT. VOIE EXPRESS DE LA LAGUNE - AUBE

Le soleil se lève sur la lagune. Un taxi-moto passe sur le remblai, une petite radio accrochée au guidon.

SÈNAMI (RADIO)
… Famille Avocè. Famille Ahouansou. Vous habitiez ici.

Au bord de l’eau, Dah Comlan regarde partir les pirogues. Le poste, posé à côté de lui, est éteint. Il n’en a plus besoin.

FONDU AU NOIR.
`;

// ───────────────────────────── Scènes et découpage ─────────────────────────────

type Stage = 'IDEA' | 'DEVELOPMENT' | 'PRE_PRODUCTION' | 'PRODUCTION' | 'POST_PRODUCTION' | 'COMPLETED';

interface ShotDef {
  size: string;
  angle: string;
  lens: string;
  move: string;
  durationSec: number;
  action: string;
  description: string;
  dialogue?: string;
  audio?: string;
  composition?: string;
  transition?: string;
  characters?: string[];
  props?: string[];
  isGroup?: boolean;
  note?: string;
  status: Stage;
}

interface SceneDef {
  title: string;
  setting: 'INT' | 'EXT';
  timeOfDay: string;
  location: string;
  light: keyof typeof LIGHTS;
  act: number;
  status: Stage;
  importance: number;
  cast: string[];
  description: string;
  objective: string;
  conflict: string;
  emotion: string;
  outcome: string;
  breakdown: Record<string, unknown>;
  direction: Record<string, string>;
  shots: ShotDef[];
}

const SCENES: SceneDef[] = [
  {
    title: 'Le poste qui parle encore',
    setting: 'INT',
    timeOfDay: 'DAY',
    location: 'L1',
    light: 'DAY',
    act: 1,
    status: 'PRODUCTION',
    importance: 2,
    cast: ['CH1', 'CH2', 'CH3'],
    description: p(
      'L’atelier de Sènami, un conteneur bourré de radios au cœur du marché. Rodrigue filme au lieu de souder. Dah Comlan dépose sur l’établi un poste à lampes « qui parle encore » mais qu’il n’entend plus.',
      'Le poste a « l’âge de Hlènou ». Sènami se ferme : « Nulle part. Plus maintenant. »',
    ),
    objective: p('Sènami veut travailler en paix et renvoyer le vieux poste au rang de simple réparation.'),
    conflict: p('Dah Comlan prononce le nom de Hlènou, que Sènami a enfoui.'),
    emotion: 'Nostalgie',
    outcome: p('Sènami accepte le poste sans rien promettre. Rodrigue a entendu un nom qu’il ne connaissait pas.'),
    breakdown: {
      props: ['P1 Le poste de Dah Comlan', 'Téléphone fendu de Rodrigue', 'Fer à souder', 'Carte électronique', 'Canne de Dah Comlan'],
      costumes: ['P3 Le tablier de Sènami', 'Maillot jaune de Rodrigue', 'Chemise de pagne et calot rouge de Dah Comlan'],
      sfx: ['Grésillement de soudure', 'Brouhaha du marché', 'Vendeuse qui annonce ses prix'],
      music: [],
      ambience: 'Familier, Animé',
      lighting: 'Lumière de fenêtre, Douce, diffuse',
      weather: 'Sans objet (intérieur)',
      notes: p('Prévoir une dizaine de figurants dans l’allée, en arrière-plan flou.'),
    },
    direction: {
      intention: p('Installer un monde concret et chaleureux avant d’y glisser le seul mot qui le fissure : Hlènou.'),
      emotion: 'Nostalgie',
      rhythm: 'Posé',
      style: 'Naturaliste, Contemplatif',
      references: 'Réalisme magique, Photographie de studio ouest-africaine',
      camera: 'Caméra fixe, Travellings lents, Gros plans serrés',
      lighting: 'Lumière de fenêtre, Douce, diffuse, Chaude, dorée',
      acting: p('Sènami ne lève presque jamais les yeux de l’établi ; quand elle le fait, c’est un événement. Dah Comlan joue lentement, sans pathos. Rodrigue est le seul à bouger.'),
      sound: p('Le marché très présent au début, qui recule quand Dah Comlan dit « Hlènou » : le monde se tait autour d’un mot.'),
    },
    shots: [
      { size: 'ESTABLISHING', angle: 'EYE', lens: '24mm', move: 'DOLLY', durationSec: 10, action: 'Slow dolly along a crowded covered market alley toward an open shipping container packed floor to ceiling with old radios; CH1 Sènami works at the far workbench.', description: 'Le marché, puis l’atelier-conteneur au bout de l’allée. Sènami au fond, penchée sur l’établi.', audio: 'market chatter, a vendor calling prices, radios playing faintly', transition: 'FADE_IN', characters: ['CH1'], status: 'PRODUCTION' },
      { size: 'MS', angle: 'EYE', lens: '35mm', move: 'STATIC', durationSec: 14, action: 'CH1 Sènami blows on a circuit board at the workbench while CH2 Rodrigue, leaning on a shelf, films her with a cracked smartphone.', description: 'Sènami souffle sur une carte électronique ; Rodrigue la filme. Premier échange, sec et complice.', dialogue: 'RODRIGUE : Dis bonjour à mes abonnés, patronne.\nSÈNAMI : Dis-leur que tu es payé pour souder, pas pour filmer.', characters: ['CH1', 'CH2'], props: ['P3'], status: 'PRODUCTION' },
      { size: 'MLS', angle: 'LOW', lens: '35mm', move: 'STATIC', durationSec: 11, action: 'CH3 Dah Comlan steps into the container doorway, backlit by the alley, carrying a large wooden tube radio in both arms like a newborn.', description: 'Une ombre sur l’établi : Dah Comlan entre, le poste dans les bras comme un nouveau-né.', dialogue: 'DAH COMLAN : Il parle encore. Mais moi, je ne l’entends plus.', composition: 'figure framed by the container doorway, alley bright behind him', characters: ['CH3'], props: ['P1'], status: 'PRE_PRODUCTION' },
      { size: 'INSERT', angle: 'HIGH', lens: '50mm', move: 'STATIC', durationSec: 6, action: 'Old knotted hands gently set the varnished wooden tube radio down on the cluttered workbench.', description: 'Insert : les mains de Dah Comlan posent le poste sur l’établi.', audio: 'wood touching wood, a soft click', characters: ['CH3'], props: ['P1'], status: 'PRE_PRODUCTION' },
      { size: 'CU', angle: 'EYE', lens: '85mm', move: 'PUSH_IN', durationSec: 13, action: 'CH1 Sènami freezes, magnifier loupe on her forehead, eyes fixed on the radio; the market noise seems to fade around her.', description: 'Gros plan sur Sènami au mot « Hlènou ». Elle se ferme.', dialogue: 'DAH COMLAN : L’âge de Hlènou.\nRODRIGUE (hors champ) : C’est où, Hlènou ?\nSÈNAMI : Nulle part. Plus maintenant.', characters: ['CH1'], status: 'PRE_PRODUCTION' },
    ],
  },
  {
    title: 'Quatre-vingt-sept six',
    setting: 'INT',
    timeOfDay: 'NIGHT',
    location: 'L1',
    light: 'NIGHT',
    act: 1,
    status: 'PRE_PRODUCTION',
    importance: 3,
    cast: ['CH1'],
    description: p(
      'Nuit. Le marché dort. Sènami répare le poste seule sous une ampoule nue. Le cadran s’allume, l’aiguille s’arrête sur 87.6 : le poste capte Hlènou.',
      'Parmi les voix, celle de sa mère : « Sènami ! Viens manger, ça refroidit ! »',
    ),
    objective: p('Réparer le poste, rien de plus.'),
    conflict: p('Le poste lui rend ce qu’elle avait décidé de ne plus entendre.'),
    emotion: 'Stupeur',
    outcome: p('Sènami ne peut plus faire comme si Hlènou n’existait pas. Elle n’éteint pas le poste.'),
    breakdown: {
      props: ['P1 Le poste de Dah Comlan', 'Lampe radio de rechange', 'Fer à souder'],
      costumes: ['P3 Le tablier de Sènami'],
      vfx: ['Lueur cyan du cadran (pratique, en plateau de préférence)'],
      sfx: ['Grésillement', 'Pagaies dans l’eau', 'Appel des pêcheurs', 'Enfants qui comptent', 'Voix de femme'],
      music: [],
      ambience: 'Intime, Mystérieux',
      lighting: 'Tungstène, Faible clé (low key), Mixte chaud-froid',
      weather: 'Sans objet (intérieur)',
      notes: p('Les voix de Hlènou sont à enregistrer en extérieur, au bord de l’eau, avec une vraie distance de micro. Aucun effet de réverbération « fantôme ».'),
    },
    direction: {
      intention: p('Le merveilleux arrive par l’oreille. On reste sur Sènami : c’est son visage qui fait exister les voix.'),
      emotion: 'Stupeur',
      rhythm: 'Suspendu',
      style: 'Contemplatif, Minimaliste',
      references: 'Réalisme magique',
      camera: 'Caméra fixe, Gros plans serrés',
      lighting: 'Tungstène, Faible clé (low key), Mixte chaud-froid',
      acting: p('Aucune larme. La main qui tremble au-dessus du bouton suffit. « Maman ? » à peine audible.'),
      sound: p('Silence total du marché, puis le grésillement, puis les voix qui se superposent jusqu’à la voix de la mère, très proche, très nette.'),
    },
    shots: [
      { size: 'WS', angle: 'HIGH', lens: '24mm', move: 'STATIC', durationSec: 8, action: 'The dark empty market at night; a single bare bulb lights CH1 Sènami alone at the workbench inside the open container.', description: 'Le marché vide, une seule ampoule, Sènami au travail.', audio: 'night insects, a distant generator', transition: 'DISSOLVE', characters: ['CH1'], status: 'PRE_PRODUCTION' },
      { size: 'ECU', angle: 'EYE', lens: '100mm macro', move: 'PUSH_IN', durationSec: 7, action: 'The glass tuning dial of the wooden radio lights up pale cyan; the thin red needle slides, hesitates and stops on 87.6.', description: 'Le cadran s’allume en bleu pâle ; l’aiguille s’arrête sur 87.6.', audio: 'static rising, then oars hitting water and distant voices', props: ['P1'], status: 'PRE_PRODUCTION' },
      { size: 'MCU', angle: 'EYE', lens: '50mm', move: 'STATIC', durationSec: 14, action: 'CH1 Sènami listens, lit by the bulb and the cyan dial; her hand trembles above the radio knob but does not turn it off.', description: 'Sènami écoute. La voix de sa mère. Sa main tremble au-dessus du bouton.', dialogue: 'VOIX DE FEMME (RADIO) : Sènami ! Viens manger, ça refroidit !\nSÈNAMI (dans un souffle) : Maman ?', characters: ['CH1'], props: ['P1'], status: 'PRE_PRODUCTION' },
      { size: 'MS', angle: 'EYE', lens: '35mm', move: 'PULL_OUT', durationSec: 13, action: 'CH1 Sènami sits motionless facing the glowing radio dial as the camera slowly pulls back into the dark alley.', description: 'Elle reste seule face au cadran bleu, longtemps. La caméra la laisse.', audio: 'static swallowing the voice, then silence', transition: 'FADE_OUT', characters: ['CH1'], props: ['P1'], status: 'DEVELOPMENT' },
    ],
  },
  {
    title: 'L’embarcadère sous l’asphalte',
    setting: 'EXT',
    timeOfDay: 'DUSK',
    location: 'L2',
    light: 'GOLDEN',
    act: 2,
    status: 'PRE_PRODUCTION',
    importance: 3,
    cast: ['CH1', 'CH2'],
    description: p(
      'Sur le remblai de la voie express, là où se trouvait Hlènou, Sènami branche le poste sur une batterie de moto. Les voix y sont claires.',
      'Rodrigue tente de les enregistrer : la forme d’onde reste plate. Il entend pourtant. Il est de son côté.',
    ),
    objective: p('Vérifier qu’elle n’a pas rêvé, et trouver d’où viennent les voix.'),
    conflict: p('Le scepticisme de Rodrigue ; le vacarme des camions qui couvre tout.'),
    emotion: 'Émerveillement',
    outcome: p('Les voix sont réelles et liées au lieu. Rodrigue devient son allié.'),
    breakdown: {
      props: ['P1 Le poste de Dah Comlan', 'Batterie de moto et câbles', 'Téléphone fendu de Rodrigue'],
      costumes: ['P3 Le tablier de Sènami', 'Maillot jaune de Rodrigue'],
      vehicles: ['Camions de passage', 'Taxis-motos'],
      vfx: ['Écran de téléphone : forme d’onde plate (incrustation)'],
      sfx: ['Camions', 'Vent', 'Clapotis de la lagune', 'Voix d’homme qui appelle les pirogues'],
      ambience: 'Désolé, Nostalgique',
      lighting: 'Heure dorée, Contre-jour',
      weather: 'Humide et lourd',
      notes: p('Tourner sur vingt minutes de lumière utile. Sécuriser le bas-côté.'),
    },
    direction: {
      intention: p('Le point médian : une fausse victoire. Hlènou est là, sous l’asphalte, et quelqu’un d’autre l’entend.'),
      emotion: 'Émerveillement',
      rhythm: 'Contemplatif',
      style: 'Naturaliste, Contemplatif',
      references: 'Réalisme magique',
      camera: 'Plans larges, Caméra fixe',
      lighting: 'Heure dorée, Contre-jour',
      acting: p('Rodrigue passe de l’ironie au silence. Le sourire de Sènami arrive tard, il doit surprendre.'),
      sound: p('Les camions écrasent tout, puis la radio prend le dessus comme une fenêtre qui s’ouvre.'),
    },
    shots: [
      { size: 'EWS', angle: 'EYE', lens: '24mm', move: 'STATIC', durationSec: 10, action: 'A four-lane expressway on an embankment by a wide lagoon at sunset; trucks pass; two small figures, CH1 Sènami and CH2 Rodrigue, stand on the dusty shoulder next to a wooden radio set on a low concrete wall.', description: 'La voie express, la lagune, deux silhouettes minuscules et le poste sur un muret.', audio: 'trucks roaring past, wind', characters: ['CH1', 'CH2'], props: ['P1'], status: 'PRE_PRODUCTION' },
      { size: 'TWO', angle: 'EYE', lens: '35mm', move: 'STATIC', durationSec: 15, action: 'CH2 Rodrigue, arms crossed, watches CH1 Sènami turn the radio knob; behind them the lagoon glows gold.', description: 'Rodrigue ironise ; Sènami montre ce qu’il n’y a plus.', dialogue: 'RODRIGUE : Tu m’as fait traverser la ville pour écouter la radio au bord d’une autoroute.\nSÈNAMI : C’était ici. L’embarcadère. La maison de ma tante. L’école. Tout.', characters: ['CH1', 'CH2'], props: ['P1'], status: 'PRE_PRODUCTION' },
      { size: 'INSERT', angle: 'EYE', lens: '50mm', move: 'STATIC', durationSec: 6, action: 'Close on a cracked smartphone screen held up toward the radio: the audio recording waveform stays completely flat.', description: 'Insert : l’écran du téléphone, la forme d’onde reste plate.', audio: 'a man calling clearly from the radio: the pirogues are coming back', characters: ['CH2'], status: 'DEVELOPMENT' },
      { size: 'MCU', angle: 'EYE', lens: '85mm', move: 'PUSH_IN', durationSec: 13, action: 'CH1 Sènami looks out at the lagoon in warm backlight and slowly smiles for the first time.', description: 'Sènami regarde la lagune. Pour la première fois, elle sourit.', dialogue: 'RODRIGUE (hors champ) : Ton téléphone n’entend rien. Mais moi, j’entends.', characters: ['CH1'], status: 'DEVELOPMENT' },
    ],
  },
  {
    title: 'L’avis d’expulsion',
    setting: 'INT',
    timeOfDay: 'DAY',
    location: 'L1',
    light: 'DAY',
    act: 2,
    status: 'DEVELOPMENT',
    importance: 2,
    cast: ['CH1', 'CH4'],
    description: p(
      'Firmin, agent de la mairie, colle un avis : le marché doit être libéré sous trente jours. Le poste lui renvoie sa voix d’enfant de Hlènou.',
      'Puis la voix se dissout : chaque jour, le poste capte un peu moins.',
    ),
    objective: p('Firmin veut notifier l’expulsion et repartir. Sènami veut qu’il entende.'),
    conflict: p('L’administration contre la mémoire — et Firmin contre lui-même.'),
    emotion: 'Mélancolie',
    outcome: p('Firmin n’est plus un adversaire. Mais les voix s’éteignent : il faut agir vite.'),
    breakdown: {
      props: ['P1 Le poste de Dah Comlan', 'Avis d’expulsion', 'Pot de colle et pinceau', 'Planchette de Firmin'],
      costumes: ['P3 Le tablier de Sènami', 'Chemise blanche et badge de Firmin'],
      sfx: ['Brouhaha du marché', 'Voix d’enfant qui compte', 'Grésillement décroissant'],
      ambience: 'Familier, Oppressant',
      lighting: 'Lumière de fenêtre, Dure, contrastée',
      weather: 'Sans objet (intérieur)',
      notes: p('Texte de l’affiche visible à l’image : le garder court et lisible, en majuscules.'),
    },
    direction: {
      intention: p('Le point le plus bas : l’histoire se répète, et la mémoire fuit au moment même où elle trouve un nouvel allié.'),
      emotion: 'Mélancolie',
      rhythm: 'En rupture',
      style: 'Réaliste',
      references: 'Réalisme magique',
      camera: 'Champ-contrechamp, Gros plans serrés',
      lighting: 'Lumière de fenêtre, Dure, contrastée',
      acting: p('Firmin récite d’abord son texte administratif ; la voix d’enfant le casse net. « J’avais neuf ans » doit sonner comme un aveu.'),
      sound: p('La voix d’enfant très présente, puis un grésillement qui baisse alors que Sènami monte le volume.'),
    },
    shots: [
      { size: 'MS', angle: 'EYE', lens: '35mm', move: 'STATIC', durationSec: 13, action: 'CH4 Firmin brushes glue and presses a printed notice onto the open container door while CH1 Sènami watches from the workbench behind.', description: 'Firmin colle l’avis sur la porte du conteneur. Sènami le regarde faire.', dialogue: 'SÈNAMI : Encore un marché moderne ?\nFIRMIN : Un parking. Avec des toilettes propres. Je ne fais qu’appliquer.', characters: ['CH1', 'CH4'], props: ['P1'], status: 'DEVELOPMENT' },
      { size: 'CU', angle: 'EYE', lens: '85mm', move: 'PUSH_IN', durationSec: 11, action: 'CH4 Firmin turns sharply toward the radio, clipboard pressed to his chest, staring as if at a ghost.', description: 'La voix d’enfant appelle Firmin. Il se retourne d’un coup.', dialogue: 'VOIX D’ENFANT (RADIO) : … huit, neuf, dix ! Firmin, c’est toi qui cherches !\nFIRMIN : Qui a enregistré ça ?', characters: ['CH4'], status: 'DEVELOPMENT' },
      { size: 'OTS', angle: 'EYE', lens: '50mm', move: 'STATIC', durationSec: 14, action: 'Over CH1 Sènami’s shoulder onto CH4 Firmin, who lowers his clipboard and speaks quietly.', description: 'Contrechamp par-dessus l’épaule de Sènami : l’aveu de Firmin.', dialogue: 'SÈNAMI : Personne. Ça vient de Hlènou.\nFIRMIN (à voix basse) : J’avais neuf ans. Ils nous ont donné trois jours.', characters: ['CH1', 'CH4'], status: 'DEVELOPMENT' },
      { size: 'INSERT', angle: 'HIGH', lens: '100mm macro', move: 'STATIC', durationSec: 6, action: 'The pale cyan glow of the radio dial dims and flickers; the red needle trembles on 87.6.', description: 'Le cadran pâlit, l’aiguille tremble.', audio: 'static fading away', props: ['P1'], status: 'IDEA' },
      { size: 'MCU', angle: 'EYE', lens: '50mm', move: 'STATIC', durationSec: 8, action: 'CH1 Sènami turns the volume knob all the way up, listening to nothing but fading static.', description: 'Sènami monte le volume : plus rien.', dialogue: 'SÈNAMI : Elles s’en vont. Chaque jour un peu plus.', characters: ['CH1'], props: ['P1'], status: 'IDEA' },
    ],
  },
  {
    title: 'Hlènou sur les haut-parleurs',
    setting: 'EXT',
    timeOfDay: 'NIGHT',
    location: 'L3',
    light: 'NIGHT',
    act: 3,
    status: 'DEVELOPMENT',
    importance: 3,
    cast: ['CH1', 'CH2', 'CH3', 'CH4'],
    description: p(
      'Sur le toit du marché, Rodrigue branche son émetteur sur les haut-parleurs. Firmin apporte le registre : quatre cent douze familles. Les voix de Hlènou se répandent sur la ville.',
      'Quand elles se taisent, Sènami prend le micro et lit les noms. Dah Comlan, qui n’entendait plus le poste, l’entend, elle.',
    ),
    objective: p('Faire entendre Hlènou à la ville entière avant que les voix ne s’éteignent.'),
    conflict: p('Le temps : les voix meurent pendant la diffusion même.'),
    emotion: 'Espoir',
    outcome: p('Les voix du poste se taisent pour toujours, mais les noms ont été dits à voix haute. La mémoire a changé de support.'),
    breakdown: {
      props: ['P1 Le poste de Dah Comlan', 'P2 L’émetteur bricolé', 'Registre du recensement', 'Haut-parleurs à pavillon', 'Micro à main'],
      costumes: ['P3 Le tablier de Sènami', 'Maillot jaune de Rodrigue', 'Calot rouge de Dah Comlan', 'Chemise blanche de Firmin'],
      vfx: ['Ville de nuit en arrière-plan (extension de décor si besoin)'],
      sfx: ['Larsen des haut-parleurs', 'Voix de Hlènou diffusées sur la ville', 'Moteur de taxi-moto qui se coupe'],
      music: ['Aucune musique : les voix suffisent'],
      ambience: 'Solennel, Mystérieux',
      lighting: 'Lampadaires, Faible clé (low key)',
      weather: 'Ciel voilé',
      notes: p('Scène de quatre personnages : prévoir un plan de groupe, au-delà de la règle des trois personnages par plan.'),
    },
    direction: {
      intention: p('Le climax est une transmission, pas un combat. Chacun apporte une pièce : la technique (Rodrigue), les noms (Firmin), la voix (Sènami), l’écoute (Dah Comlan).'),
      emotion: 'Espoir',
      rhythm: 'En crescendo',
      style: 'Contemplatif, Naturaliste',
      references: 'Réalisme magique',
      camera: 'Plans larges, Gros plans serrés, Travellings lents',
      lighting: 'Lampadaires, Faible clé (low key), Mixte chaud-froid',
      acting: p('Personne ne pleure. Sènami lit les noms comme on fait l’appel, sans emphase. Le sourire de Dah Comlan est la seule résolution.'),
      sound: p('Les voix de Hlènou passent du poste aux haut-parleurs et emplissent la ville, puis s’éteignent une à une ; reste la voix nue de Sènami.'),
    },
    shots: [
      { size: 'WS', angle: 'LOW', lens: '24mm', move: 'TILT', durationSec: 11, action: 'Tilt down from rusty horn loudspeakers on a pole against the night sky to CH2 Rodrigue soldering the last wire of a homemade transmitter in a biscuit tin.', description: 'Des haut-parleurs rouillés jusqu’à Rodrigue qui soude l’émetteur.', audio: 'night insects, soldering hiss, distant moto-taxis', characters: ['CH2'], props: ['P2'], status: 'DEVELOPMENT' },
      { size: 'WS', angle: 'EYE', lens: '28mm', move: 'STATIC', durationSec: 14, action: 'On the market roof at night, CH4 Firmin arrives out of breath holding a cardboard register, joining CH1 Sènami, CH2 Rodrigue and CH3 Dah Comlan seated on an upturned bucket with the radio on his knees.', description: 'Firmin arrive avec le registre. Les quatre réunis sur le toit.', dialogue: 'FIRMIN : Les archives du recensement. Quatre cent douze familles. Tous les noms.\nSÈNAMI : Rodrigue. On y va.', characters: ['CH1', 'CH2', 'CH3', 'CH4'], props: ['P1', 'P2'], isGroup: true, note: 'Plan de groupe : quatre personnages, au-delà du maximum de trois. Repli : générer CH1 et CH4 au premier plan, puis CH2 et CH3 au second plan en silhouettes lisibles (maillot jaune, calot rouge), et composer.', status: 'DEVELOPMENT' },
      { size: 'EWS', angle: 'HIGH', lens: '24mm', move: 'CRANE', durationSec: 13, action: 'Crane rising above the market roof and its horn loudspeakers over a sea of corrugated iron roofs at night; far below, a bread seller looks up and a moto-taxi stops.', description: 'Les voix de Hlènou se répandent sur la ville. En bas, une vendeuse de pain lève la tête, un taxi-moto s’arrête.', audio: 'voices of fishermen, children and women broadcast over the sleeping city, then fading one by one', status: 'IDEA' },
      { size: 'TWO', angle: 'EYE', lens: '50mm', move: 'STATIC', durationSec: 14, action: 'CH4 Firmin opens the register and holds it out; CH1 Sènami takes the old handheld microphone and begins to read names.', description: 'Le cadran a pâli. Firmin tend le registre, Sènami prend le micro.', dialogue: 'SÈNAMI (au micro) : Famille Akplogan. Famille Dègbo. Famille Houéto…', characters: ['CH1', 'CH4'], props: ['P2'], status: 'IDEA' },
      { size: 'CU', angle: 'EYE', lens: '85mm', move: 'PUSH_IN', durationSec: 11, action: 'CH3 Dah Comlan closes his eyes and smiles, the silent radio on his knees.', description: 'Dah Comlan ferme les yeux et sourit : il entend Sènami.', dialogue: 'DAH COMLAN : Là. Je l’entends.', characters: ['CH3'], props: ['P1'], status: 'IDEA' },
    ],
  },
  {
    title: 'Vous habitiez ici',
    setting: 'EXT',
    timeOfDay: 'DAWN',
    location: 'L2',
    light: 'GOLDEN',
    act: 3,
    status: 'IDEA',
    importance: 2,
    cast: ['CH3'],
    description: p(
      'Aube sur la lagune. Un taxi-moto passe sur la voie express, sa radio réglée sur 87.6 : la voix de Sènami continue la liste des familles.',
      'Au bord de l’eau, Dah Comlan regarde partir les pirogues, le poste éteint à côté de lui.',
    ),
    objective: p('Montrer le nouveau monde ordinaire : Hlènou vit dans une voix, plus dans une machine.'),
    conflict: p('Aucun : c’est l’apaisement.'),
    emotion: 'Sérénité',
    outcome: p('Le poste est éteint. Dah Comlan n’en a plus besoin.'),
    breakdown: {
      props: ['P1 Le poste de Dah Comlan (éteint)', 'Petite radio de guidon'],
      costumes: ['Calot rouge et canne de Dah Comlan'],
      vehicles: ['Taxi-moto', 'Pirogues'],
      sfx: ['Moteur de taxi-moto', 'Clapotis', 'Voix de Sènami à la radio'],
      ambience: 'Paisible, Nostalgique',
      lighting: 'Heure dorée, Contre-jour',
      weather: 'Brume',
      notes: p('Un figurant conducteur de taxi-moto. Pirogues réelles au départ de la pêche.'),
    },
    direction: {
      intention: p('Image finale en miroir de l’ouverture : la ville de nouveau, mais Hlènou y circule désormais.'),
      emotion: 'Sérénité',
      rhythm: 'Lent',
      style: 'Contemplatif',
      references: 'Réalisme magique',
      camera: 'Plans larges, Travellings lents',
      lighting: 'Heure dorée, Contre-jour',
      acting: p('Dah Comlan ne joue rien : il regarde.'),
      sound: p('La voix de Sènami, petite, dans la radio du taxi-moto, qui s’éloigne avec lui ; restent l’eau et les pagaies.'),
    },
    shots: [
      { size: 'EWS', angle: 'EYE', lens: '24mm', move: 'STATIC', durationSec: 10, action: 'Sunrise over the lagoon and the expressway embankment; a lone moto-taxi crosses the frame on the empty road.', description: 'L’aube sur la lagune ; un taxi-moto traverse le cadre.', audio: 'moto-taxi engine approaching, water lapping', transition: 'DISSOLVE', status: 'IDEA' },
      { size: 'MS', angle: 'EYE', lens: '35mm', move: 'TRACKING', durationSec: 11, action: 'Camera tracks alongside a moto-taxi; a small radio hangs from the handlebar, its speaker crackling.', description: 'Travelling sur le taxi-moto et sa petite radio : la voix de Sènami lit les noms.', dialogue: 'SÈNAMI (RADIO) : … Famille Avocè. Famille Ahouansou. Vous habitiez ici.', audio: 'a woman’s calm voice reading names from a small radio speaker', status: 'IDEA' },
      { size: 'WS', angle: 'EYE', lens: '50mm', move: 'STATIC', durationSec: 14, action: 'CH3 Dah Comlan sits at the water’s edge watching wooden pirogues leave in the morning haze; beside him the wooden radio sits silent, its dial dark.', description: 'Dah Comlan regarde partir les pirogues. Le poste éteint à côté de lui.', audio: 'oars, egrets, distant fishermen', transition: 'FADE_OUT', characters: ['CH3'], props: ['P1'], status: 'IDEA' },
    ],
  },
];

const ACTS = [
  { number: 1, title: 'Le poste', summary: 'Dah Comlan confie le poste à Sènami ; réparé, il capte Hlènou et la voix de sa mère.' },
  { number: 2, title: 'La fréquence', summary: 'Sur le lieu du quartier rasé, les voix sont claires et Rodrigue les entend. Firmin apporte une nouvelle expulsion et reconnaît sa voix d’enfant ; les voix s’éteignent.' },
  { number: 3, title: 'Les noms', summary: 'Une nuit, ils diffusent Hlènou sur la ville. Quand les voix se taisent, Sènami lit les noms des familles.' },
];

// Temps forts de la structure en trois actes, reliés à leur scène (numéro).
const BEATS: Record<string, { description: string; scene: number }> = {
  setup: { scene: 1, description: p('Sènami répare des radios au marché de Gbèto. Elle a enfoui Hlènou : « Nulle part. Plus maintenant. »') },
  inciting: { scene: 2, description: p('Le poste réparé capte, sur 87.6, les voix de Hlènou — et celle de la mère de Sènami.') },
  turn1: { scene: 3, description: p('Sènami emmène le poste sur le remblai : elle choisit d’écouter au lieu d’oublier.') },
  midpoint: { scene: 3, description: p('Fausse victoire : les voix sont claires sur le lieu même, et Rodrigue les entend. Elle n’est plus seule.') },
  low: { scene: 4, description: p('Le marché sera rasé à son tour, et les voix s’éteignent. Firmin, l’agent qui expulse, est lui-même un enfant de Hlènou.') },
  climax: { scene: 5, description: p('La diffusion sur les haut-parleurs du marché. Les voix meurent ; Sènami prend le micro et lit les noms.') },
  resolution: { scene: 6, description: p('À l’aube, la voix de Sènami circule sur 87.6. Le poste est éteint ; Dah Comlan n’en a plus besoin.') },
};

// ───────────────────────────── Exécution ─────────────────────────────

const email = emailArg()?.trim().toLowerCase();
if (!email) {
  console.error('Indiquez le compte : pnpm db:seed:demo -- --email vous@exemple.com (ou DEMO_EMAIL=…).');
  process.exit(1);
}
const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.error(`Aucun compte pour ${email}. Créez-le d’abord depuis l’interface (/register), puis relancez.`);
  await prisma.$disconnect();
  process.exit(1);
}

const previous = await prisma.project.findMany({ where: { ownerId: user.id, title: TITLE }, select: { id: true } });
for (const old of previous) {
  await prisma.project.delete({ where: { id: old.id } });
  console.log(`- projet de démo précédent supprimé (${old.id})`);
}

const project = await createProject(user.id, { title: TITLE, kind: 'SHORT', aspectRatio: '16:9', language: 'fr', idea: CONCEPT.idea });
const pid = project.id;
console.log(`+ projet « ${TITLE} » (${pid})`);

await prisma.project.update({
  where: { id: pid },
  data: {
    stage: 'PRE_PRODUCTION',
    rules: {
      maxCharactersPerShot: 3,
      // Aucun duo à risque de confusion dans ce film : quatre silhouettes très distinctes.
      neverTogether: [],
      targetSeconds: 300,
      blocks: {
        'Magie sonore':
          'MAGIC RULE: the voices of the vanished quarter are sound only. Never show ghosts, translucent figures, light beams or particles. The only visible sign of magic is the radio dial (P1) glowing pale cyan.',
      },
    } satisfies Json,
    motion: {
      clipSeconds: [2, 15],
      allowedMoves: ['STATIC', 'PAN', 'TILT', 'PUSH_IN', 'PULL_OUT', 'DOLLY', 'TRACKING', 'CRANE'],
      short: 'Slow, deliberate camera; one action per shot.',
      block: 'MOTION: slow and deliberate. The camera never hurries; people move at a natural, unhurried pace. One clear action per shot, no sudden gestures.',
      never: ['fast whip pans', 'shaky footage', 'morphing faces', 'speed ramps'],
    } satisfies Json,
    concept: { update: CONCEPT },
    world: { update: { sections: WORLD } },
    script: { update: { fountain: FOUNTAIN } },
  },
});
console.log('+ concept, monde, scénario, règles');

await prisma.style.create({ data: { projectId: pid, ...STYLE, active: true } });
const lightIds: Record<string, string> = {};
for (const [code, l] of Object.entries(LIGHTS)) {
  const row = await prisma.lightState.upsert({
    where: { projectId_code: { projectId: pid, code } },
    create: { projectId: pid, code, ...l, never: [...l.never], isDefault: code === 'DAY' },
    update: { ...l, never: [...l.never] },
  });
  lightIds[code] = row.id;
}
console.log(`+ style ${STYLE.code}, lumières ${Object.keys(LIGHTS).join(', ')}`);

const charIds: Record<string, string> = {};
for (const [order, c] of CHARACTERS.entries()) {
  const row = await prisma.character.create({ data: { projectId: pid, ...c, order } });
  charIds[c.code] = row.id;
}
const locIds: Record<string, string> = {};
for (const [order, l] of LOCATIONS.entries()) {
  const row = await prisma.location.create({ data: { projectId: pid, ...l, order } });
  locIds[l.code] = row.id;
}
const propIds: Record<string, string> = {};
for (const [order, pr] of PROPS.entries()) {
  const row = await prisma.prop.create({ data: { projectId: pid, ...pr, order } });
  propIds[pr.code] = row.id;
}
console.log(`+ ${CHARACTERS.length} personnages, ${LOCATIONS.length} lieux, ${PROPS.length} objets et costumes`);

const actIds: Record<number, string> = {};
for (const a of ACTS) {
  const row = await prisma.act.create({ data: { projectId: pid, ...a, order: a.number - 1 } });
  actIds[a.number] = row.id;
}

const sceneIds: Record<number, string> = {};
let shotCount = 0;
for (const [i, s] of SCENES.entries()) {
  const number = i + 1;
  const scene = await prisma.scene.create({
    data: {
      projectId: pid,
      actId: actIds[s.act],
      number,
      order: i,
      title: s.title,
      setting: s.setting,
      timeOfDay: s.timeOfDay,
      description: s.description,
      locationId: locIds[s.location],
      lightId: lightIds[s.light],
      objective: s.objective,
      conflict: s.conflict,
      emotion: s.emotion,
      outcome: s.outcome,
      estSeconds: s.shots.reduce((t, sh) => t + sh.durationSec, 0),
      importance: s.importance,
      status: s.status,
      breakdown: s.breakdown as Json,
      direction: s.direction,
      characters: { create: s.cast.map((code) => ({ characterId: charIds[code] })) },
    },
  });
  sceneIds[number] = scene.id;
  for (const [order, sh] of s.shots.entries()) {
    const { characters = [], props = [], ...rest } = sh;
    await prisma.shot.create({
      data: {
        projectId: pid,
        sceneId: scene.id,
        // Code provisoire : renumberShots attribue ensuite 1A, 1B…
        code: `~${number}-${order}`,
        order,
        ...rest,
        locationId: locIds[s.location],
        lightId: lightIds[s.light],
        characters: { create: characters.map((code) => ({ characterId: charIds[code] })) },
        props: { create: props.map((code) => ({ propId: propIds[code] })) },
      },
    });
    shotCount++;
  }
  await renumberShots(scene.id);
}
console.log(`+ ${SCENES.length} scènes, ${shotCount} plans`);

const story = await prisma.story.findUniqueOrThrow({ where: { projectId: pid }, include: { beats: true } });
for (const beat of story.beats) {
  const def = BEATS[beat.key];
  if (def) await prisma.storyBeat.update({ where: { id: beat.id }, data: { description: def.description, sceneId: sceneIds[def.scene] } });
}
console.log('+ structure en trois actes reliée aux scènes');

console.log(`\nProjet de démo prêt : /projects/${pid}`);
console.log('Aucune image ni vidéo n’a été générée : branchez un provider puis générez les références depuis la bible.');
await prisma.$disconnect();
