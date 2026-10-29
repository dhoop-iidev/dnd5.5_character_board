# Generates src/data/custom/effects/magic-items.json (effects of every SRD 5.2.1 magic item, `item:<id>`) and
# src/data/custom/summaries-items.json (one-line summaries). Checks ids against the generated SRD data.
import json, sys, os

ROOT = sys.argv[1]
items = {m['id']: m for m in json.load(open(os.path.join(ROOT, 'src/data/srd/magic-items.json'), encoding='utf-8'))}
spells = {s['id'] for s in json.load(open(os.path.join(ROOT, 'src/data/srd/spells.json'), encoding='utf-8'))}
skills = {s['id'] for s in json.load(open(os.path.join(ROOT, 'src/data/srd/skills.json'), encoding='utf-8'))}

def T(en, fr, es):
    return {'en': en, 'fr': fr, 'es': es}

DMG = json.load(open(os.path.join(ROOT, 'src/data/custom/damage-types.json'), encoding='utf-8'))

E = {}
S = {}

def eff(id, summary_en, summary_fr, summary_es, **fields):
    assert id in items, id
    assert id not in E, id
    d = items[id]
    e = {'id': f'item:{id}'}
    e.update(fields)
    e['source'] = {'page': d['source']['page'], 'frPage': d['source']['frPage'], 'section': f"Magic Items > {d['name']['en']}"}
    E[id] = e
    S[f'item:{id}'] = T(summary_en, summary_fr, summary_es)

def mod(target, value=None, byVariant=None, when=None, condition=None, effectName=None):
    m = {'target': target}
    m['value'] = value if value is not None else 0
    if byVariant is not None:
        m['byVariant'] = byVariant
    if when:
        m['when'] = when
    if condition:
        m['condition'] = condition
    if effectName:
        m['effectName'] = effectName
    return m

def g(kind, on=None, value=None, condition=None, when=None):
    x = {'kind': kind}
    if on is not None:
        x['on'] = on
    if value is not None:
        x['value'] = value
    if condition:
        x['condition'] = condition
    if when:
        x['when'] = when
    return x

def adv(on, condition=None):
    return g('advantage', on, condition=condition)

def res(t, condition=None):
    return g('resistance', t, condition=condition)

def dice(d, condition=None, when=None):
    return mod('extraDamage.item', d, when=when, condition=condition)

def bonus(n=None, byVariant=None):
    return [mod('item.attack', n, byVariant), mod('item.damage', n, byVariant)]

def sp(id, cost=None, level=None, maxLevel=None, dc=None, attack=None, perDay=None, atWill=None, note=None):
    assert id in spells, id
    x = {'spellId': id}
    for k, v in [('cost', cost), ('level', level), ('maxLevel', maxLevel), ('dc', dc), ('attack', attack),
                 ('perDay', perDay), ('atWill', atWill), ('note', note)]:
        if v is not None:
            x[k] = v
    return x

def SI(spells_=(), charges=None, recharge=None, **kw):
    x = {'spells': list(spells_)}
    if charges is not None:
        x['charges'] = charges
    if recharge is not None:
        x['recharge'] = recharge
    x.update(kw)
    return x

def damage_choice(types, name=T('Damage type', 'Type de dégâts', 'Tipo de daño')):
    return [{'kind': 'option', 'name': name,
             'options': {t: {'name': T(DMG[t]['en'], DMG[t]['fr'], DMG[t]['es']), 'grants': [res(t)]} for t in types}}]

TEN = ['acid', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder']

# ---- textOnly reasons
ACT = T('Activated property (Magic action, Bonus Action or Reaction): nothing on the sheet; applied at the table.',
        'Propriété activée (action Magie, action Bonus ou Réaction) : rien sur la feuille ; s’applique en jeu.', 'Propiedad activada (acción de magia, acción adicional o reacción): nada en la hoja; se aplica en la mesa.')
GM = T('Narrative or GM-adjudicated effect: nothing on the sheet.',
       'Effet narratif ou arbitré par le MJ : rien sur la feuille.', 'Efecto narrativo o arbitrado por el GM: nada en la hoja.')
ONE = T('Single-use item: its effect is resolved at the table when used.',
        'Objet à usage unique : son effet se résout en jeu à l’utilisation.', 'Objeto de un solo uso: su efecto se resuelve en la mesa al usarlo.')
SUMMON = T('Summons a creature (stat block in “Monsters”): nothing on the sheet.',
           'Convoque une créature (profil dans « Monstres ») : rien sur la feuille.', 'Invoca una criatura (perfil en «Monstruos»): nada en la hoja.')
VEHICLE = T('A vehicle or object with its own statistics: nothing on the sheet.',
            'Un véhicule ou objet doté de ses propres statistiques : rien sur la feuille.', 'Un vehículo u objeto con sus propias estadísticas: nada en la hoja.')
PERM = T('Permanent increase after 48 hours of study: raise the base score in the level editor; carrying the book does nothing.',
         'Augmentation permanente après 48 heures d’étude : relevez la valeur de base dans l’éditeur de niveaux ; porter le livre ne fait rien.', 'Aumento permanente tras 48 horas de estudio: sube la puntuación base en el editor de niveles; llevar el libro no hace nada.')
NAT20 = T('Applies on a roll of 20 or against a particular target: resolved at the table.',
          'S’applique sur un 20 ou contre une cible particulière : se résout en jeu.', 'Se aplica con un 20 o contra un objetivo concreto: se resuelve en la mesa.')
MOUNT = T('Works on a mount, not on you: nothing on your sheet.', 'Agit sur une monture, pas sur vous : rien sur votre feuille.', 'Actúa sobre una montura, no sobre ti: nada en tu hoja.')
DEF = T('Defensive property with no sheet number (a hit becomes normal, a reaction…): applied at the table.',
        'Propriété défensive sans nombre sur la feuille (coup devenu normal, réaction…) : s’applique en jeu.', 'Propiedad defensiva sin número en la hoja (un impacto pasa a ser normal, una reacción…): se aplica en la mesa.')

def textOnly(t):
    return t

POTION = dict(consumable=True)

# ======================================================================== A
eff('adamantine-armor', 'Critical Hits against you become normal hits.', 'Les coups critiques contre vous deviennent des coups normaux.', 'Los críticos contra ti pasan a ser impactos normales.', textOnly=DEF)
eff('ammunition-1-2-or-3', '+1/+2/+3 to attack and damage with this ammunition; nonmagical once it hits.', '+1/+2/+3 à l’attaque et aux dégâts avec ces munitions ; non magiques après avoir touché.', '+1/+2/+3 al ataque y al daño con esta munición; deja de ser mágica al impactar.',
    modifiers=[mod('attack.ranged', byVariant=[1, 2, 3], condition=T('firing this ammunition', 'avec ces munitions', 'con esta munición')),
               mod('damage.ranged', byVariant=[1, 2, 3], condition=T('firing this ammunition', 'avec ces munitions', 'con esta munición'))])
eff('ammunition-of-slaying', 'Vs its creature type: DC 17 Con save or extra 6d10 Force (half on success).', 'Contre son type de créature : JS de Con DD 17 ou 6d10 dégâts de force en plus (moitié si réussi).', 'Contra su tipo de criatura: salvación de Con CD 17 o 6d10 de fuerza adicional (la mitad si la supera).', textOnly=ONE)
eff('amulet-of-health', 'Your Constitution is 19 while you wear it.', 'Votre Constitution est de 19 tant que vous la portez.', 'Tu Constitución es 19 mientras lo llevas puesto.', modifiers=[mod('ability.con.set', 19)])
eff('amulet-of-proof-against-detection-and-location', 'Hidden from Divination spells and scrying sensors.', 'Vous échappez aux sorts de divination et aux capteurs de scrutation.', 'Oculto a los conjuros de adivinación y a los sensores de escudriñamiento.', textOnly=GM)
eff('amulet-of-the-planes', 'Magic action + DC 15 Arcana check: cast Plane Shift; a failure sends you somewhere random.', 'Action Magie + test d’Arcanes DD 15 : lancer Changement de plan ; un échec vous envoie au hasard.', 'Acción de magia + prueba de Conocimiento Arcano CD 15: lanzar Desplazamiento entre planos; si fallas, acabas en un lugar aleatorio.',
    spellItem=SI([sp('plane-shift', atWill=True, note=T('DC 15 Intelligence (Arcana) check first', 'test d’Intelligence (Arcanes) DD 15 d’abord', 'antes, prueba de Inteligencia (Conocimiento Arcano) CD 15'))]))
eff('animated-shield', 'Bonus Action: the Shield hovers and protects you for 1 minute, hands free.', 'Action Bonus : le bouclier flotte et vous protège 1 minute, mains libres.', 'Acción adicional: el escudo flota y te protege durante 1 minuto, con las manos libres.', textOnly=ACT)
eff('apparatus-of-the-crab', 'A Large lobster-shaped vehicle for two (AC 20, 200 HP, Swim 30 ft).', 'Un véhicule G en forme de homard pour deux (CA 20, 200 PV, nage 9 m).', 'Un vehículo Grande con forma de langosta para dos (CA 20, 200 PG, nadando 9 m).', textOnly=VEHICLE)
eff('armor-1-2-or-3', '+1/+2/+3 to Armor Class while worn.', '+1/+2/+3 à la CA tant que vous la portez.', '+1/+2/+3 a la clase de armadura mientras la llevas puesta.', modifiers=[mod('ac', byVariant=[1, 2, 3])])
eff('armor-of-invulnerability', 'Resistance to Bludgeoning, Piercing and Slashing; once a dawn, Immunity for 10 minutes.', 'Résistance aux dégâts contondants, perforants et tranchants ; une fois par aube, Immunité 10 minutes.', 'Resistencia a contundente, perforante y cortante; una vez por amanecer, inmunidad durante 10 minutos.',
    grants=[res('bludgeoning'), res('piercing'), res('slashing')])
eff('armor-of-resistance', 'Resistance to one damage type (chosen by the GM).', 'Résistance à un type de dégâts (choisi par le MJ).', 'Resistencia a un tipo de daño (elegido por el GM).', choices=damage_choice(TEN))
eff('armor-of-vulnerability', 'Resistance to one of Bludgeoning, Piercing, Slashing; cursed: Vulnerability to the other two.', 'Résistance aux dégâts contondants, perforants ou tranchants ; maudite : Vulnérabilité aux deux autres.', 'Resistencia a contundente, perforante o cortante; maldita: vulnerabilidad a los otros dos.',
    choices=damage_choice(['bludgeoning', 'piercing', 'slashing']))
eff('arrow-catching-shield', '+2 AC against ranged attacks; Reaction: become the target of a ranged attack instead.', '+2 à la CA contre les attaques à distance ; Réaction : devenir la cible d’une attaque à distance.', '+2 a la CA contra ataques a distancia; reacción: pasar a ser el objetivo de un ataque a distancia en lugar de otro.',
    modifiers=[mod('ac', 2, condition=T('against a ranged attack roll', 'contre un jet d’attaque à distance', 'contra una tirada de ataque a distancia'))])
# ======================================================================== B
eff('bag-of-beans', 'Dump beans to explode (5d4 Force) or plant one for a random effect.', 'Répandez des haricots pour une explosion (5d4 force) ou plantez-en un pour un effet aléatoire.', 'Vaciar las judías para que exploten (5d4 de fuerza) o plantar una para un efecto aleatorio.', textOnly=ONE)
eff('bag-of-devouring', 'A feeding orifice: devours creatures and organic matter placed inside.', 'Un orifice nourricier : dévore créatures et matières organiques placées dedans.', 'Un orificio que se alimenta: devora las criaturas y la materia orgánica que se meten dentro.', textOnly=GM)
eff('bag-of-holding', 'Holds 500 lb (64 cubic feet) and always weighs 5 lb.', 'Contient 250 kg (1,8 m³) et pèse toujours 2,5 kg.', 'Contiene 250 kg (1,8 m³) y siempre pesa 2,5 kg.', textOnly=GM)
eff('bag-of-tricks', 'Magic action: pull a fuzzy object that becomes a random beast; three per dawn.', 'Action Magie : sortir une boule de fourrure qui devient une bête aléatoire ; trois par aube.', 'Acción de magia: sacar un objeto peludo que se convierte en una bestia aleatoria; tres por amanecer.', textOnly=SUMMON)
eff('bead-of-force', 'Throw: 10-ft sphere, DC 15 Dex save or 5d4 Force and trapped in a force sphere for 1 minute.', 'Lancer : sphère de 3 m, JS de Dex DD 15 ou 5d4 force et prisonnier d’une sphère de force 1 minute.', 'Lanzar: esfera de 3 m, salvación de Des CD 15 o 5d4 de fuerza y atrapado en una esfera de fuerza durante 1 minuto.', textOnly=ONE)
eff('bead-of-nourishment', 'Dissolves on the tongue: a day of Rations.', 'Fond sur la langue : une journée de rations.', 'Se disuelve en la lengua: un día de raciones.', textOnly=ONE)
eff('belt-of-dwarvenkind', 'Con +2 (max 20), Dwarvish, Advantage on Persuasion with dwarves; non-dwarves: Darkvision 60 ft, Poison Resistance.', 'Con +2 (max 20), nain, Avantage en Persuasion avec les nains ; non-nains : vision dans le noir 18 m, Résistance au poison.', 'Con +2 (máx. 20), enano, ventaja en Persuasión con enanos; si no eres enano: visión en la oscuridad 18 m, resistencia al veneno.',
    modifiers=[mod('ability.con', 2)],
    grants=[g('language', value='Dwarvish'), adv('skill.persuasion', T('interacting with dwarves and duergar', 'avec des nains et des duergars', 'al tratar con enanos y duergars')),
            g('darkvision', value=60, condition=T('if you aren’t a dwarf or duergar', 'si vous n’êtes ni nain ni duergar', 'si no eres enano ni duergar')),
            res('poison', T('if you aren’t a dwarf or duergar', 'si vous n’êtes ni nain ni duergar', 'si no eres enano ni duergar')),
            adv('save.poisoned', T('if you aren’t a dwarf or duergar', 'si vous n’êtes ni nain ni duergar', 'si no eres enano ni duergar'))])
eff('belt-of-giant-strength', 'Your Strength becomes 21, 23, 25, 27 or 29 (by giant type) unless already higher.', 'Votre Force passe à 21, 23, 25, 27 ou 29 (selon le géant) si elle est inférieure.', 'Tu Fuerza pasa a ser 21, 23, 25, 27 o 29 (según el gigante), salvo que ya sea mayor.',
    modifiers=[mod('ability.str.set', byVariant=[21, 23, 25, 27, 29])])
eff('berserker-axe', '+1 attack and damage, +1 HP per level; cursed: berserk when damaged (DC 15 Wis).', '+1 à l’attaque et aux dégâts, +1 PV par niveau ; maudite : rage meurtrière si blessé (Sag DD 15).', '+1 al ataque y al daño, +1 PG por nivel; maldita: frenesí al recibir daño (Sab CD 15).',
    activeWhen='attuned', modifiers=bonus(1) + [mod('hp.max', 'level')])
eff('boots-of-elvenkind', 'Silent steps; Advantage on Dexterity (Stealth) checks.', 'Pas silencieux ; Avantage aux tests de Dextérité (Discrétion).', 'Pasos silenciosos; ventaja en las pruebas de Destreza (Sigilo).', grants=[adv('skill.stealth')])
eff('boots-of-levitation', 'Cast Levitate on yourself at will.', 'Lancer Lévitation sur vous-même à volonté.', 'Lanzar Levitar sobre ti a voluntad.', spellItem=SI([sp('levitate', atWill=True, note=T('yourself only', 'vous seul', 'solo sobre ti'))]))
eff('boots-of-speed', 'Bonus Action: double your Speed (10 minutes per Long Rest); Opportunity Attacks against you have Disadvantage.', 'Action Bonus : Vitesse doublée (10 minutes par repos long) ; les attaques d’opportunité contre vous ont le Désavantage.', 'Acción adicional: duplicar tu velocidad (10 minutos por descanso largo); los ataques de oportunidad contra ti tienen desventaja.',
    modifiers=[mod('speed.double', 1, when='toggle:boots-of-speed', condition=T('heels clicked (Speed doubled)', 'talons claqués (Vitesse doublée)', 'talones entrechocados (velocidad duplicada)'))])
eff('boots-of-striding-and-springing', 'Speed at least 30 ft, not reduced by load or Heavy Armor; jump 30 ft for 10 ft of movement.', 'Vitesse d’au moins 9 m, non réduite par la charge ou une armure lourde ; saut de 9 m pour 3 m de déplacement.', 'Velocidad mínima de 9 m, sin reducción por carga ni armadura pesada; saltar 9 m por cada 3 m de movimiento.',
    modifiers=[mod('speed.min', 30)], flags=['no-armor-speed-penalty'])
eff('boots-of-the-winterlands', 'Resistance to Cold; ignore ice and snow Difficult Terrain.', 'Résistance au froid ; ignore le terrain difficile de glace et de neige.', 'Resistencia al frío; ignoras el terreno difícil de hielo y nieve.', grants=[res('cold')])
eff('bowl-of-commanding-water-elementals', 'Magic action: summon a Water Elemental for 1 hour, once per dawn.', 'Action Magie : convoquer un élémentaire de l’eau 1 heure, une fois par aube.', 'Acción de magia: invocar un elemental de agua durante 1 hora, una vez por amanecer.', textOnly=SUMMON)
eff('bracers-of-archery', 'Proficiency with Longbow and Shortbow; +2 damage with them.', 'Maîtrise de l’arc long et de l’arc court ; +2 aux dégâts avec eux.', 'Competencia con arco largo y arco corto; +2 al daño con ellos.',
    modifiers=[mod('damage.weapon.longbow', 2), mod('damage.weapon.shortbow', 2)],
    grants=[g('proficiency', 'weapon.longbow'), g('proficiency', 'weapon.shortbow')])
eff('bracers-of-defense', '+2 AC while wearing no armor and using no Shield.', '+2 à la CA sans armure ni bouclier.', '+2 a la CA si no llevas armadura ni usas escudo.', modifiers=[mod('ac', 2, when='no-armor-no-shield')])
eff('brazier-of-commanding-fire-elementals', 'Magic action: summon a Fire Elemental for 1 hour, once per dawn.', 'Action Magie : convoquer un élémentaire du feu 1 heure, une fois par aube.', 'Acción de magia: invocar un elemental de fuego durante 1 hora, una vez por amanecer.', textOnly=SUMMON)
eff('brooch-of-shielding', 'Resistance to Force; immune to Magic Missile damage.', 'Résistance à la force ; immunisé contre les dégâts de Projectile magique.', 'Resistencia a fuerza; inmune al daño de Proyectil mágico.', grants=[res('force')])
eff('broom-of-flying', 'Ride it: Fly Speed 50 ft (30 ft over 200 lb); can fly alone to a known place.', 'Chevauchez-le : vol 15 m (9 m au-delà de 100 kg) ; peut voler seul vers un lieu connu.', 'Montarla: velocidad volando 15 m (9 m con más de 100 kg); puede volar sola a un lugar conocido.', textOnly=VEHICLE)
# ======================================================================== C
eff('candle-of-invocation', 'Lit: Advantage on D20 Tests in its light, free level 1 spells for Clerics and Druids; or cast Gate once.', 'Allumée : Avantage aux tests d20 dans sa lumière, sorts du niveau 1 gratuits pour clercs et druides ; ou lancer Portail une fois.', 'Encendida: ventaja en las pruebas con d20 bajo su luz, conjuros de nivel 1 gratis para clérigos y druidas; o lanzar Portal una vez.',
    spellItem=SI([sp('gate', perDay=1, note=T('destroys the candle', 'détruit la bougie', 'destruye la vela'))]))
eff('cape-of-the-mountebank', 'Cast Dimension Door once per dawn, leaving a cloud of smoke.', 'Lancer Porte dimensionnelle une fois par aube, en laissant un nuage de fumée.', 'Lanzar Puerta dimensional una vez por amanecer, dejando una nube de humo.', spellItem=SI([sp('dimension-door', perDay=1)]))
eff('carpet-of-flying', 'Command word: the carpet flies (30 to 80 ft by size) carrying its load.', 'Mot de commande : le tapis vole (9 à 24 m selon la taille) avec sa charge.', 'Palabra de mando: la alfombra vuela (de 9 a 24 m según su tamaño) con su carga.', textOnly=VEHICLE)
eff('censer-of-controlling-air-elementals', 'Magic action: summon an Air Elemental for 1 hour, once per dawn.', 'Action Magie : convoquer un élémentaire de l’air 1 heure, une fois par aube.', 'Acción de magia: invocar un elemental de aire durante 1 hora, una vez por amanecer.', textOnly=SUMMON)
eff('chime-of-opening', 'Cast Knock; 10 uses, then it cracks.', 'Lancer Déblocage ; 10 utilisations, puis il se fend.', 'Lanzar Abrir; 10 usos y después se agrieta.', spellItem=SI([sp('knock', cost=1)], charges=10))
eff('circlet-of-blasting', 'Cast Scorching Ray (+5 to hit) once per dawn.', 'Lancer Rayon ardent (+5 au toucher) une fois par aube.', 'Lanzar Rayo abrasador (+5 al ataque) una vez por amanecer.', spellItem=SI([sp('scorching-ray', perDay=1, attack=5)]))
eff('cloak-of-arachnida', 'Poison Resistance, Climb Speed equal to Speed, webs don’t hold you; Web (DC 13) once per dawn.', 'Résistance au poison, escalade égale à la Vitesse, insensible aux toiles ; Toile d’araignée (DD 13) une fois par aube.', 'Resistencia al veneno, velocidad trepando igual a tu velocidad, las telarañas no te retienen; Telaraña (CD 13) una vez por amanecer.',
    modifiers=[mod('speed.climb', 'speed')], grants=[res('poison')], spellItem=SI([sp('web', perDay=1, dc=13, note=T('twice the normal area', 'zone doublée', 'el doble del área normal'))]))
eff('cloak-of-displacement', 'Attack rolls against you have Disadvantage until you take damage (back at your next turn).', 'Les jets d’attaque contre vous ont le Désavantage jusqu’à ce que vous subissiez des dégâts (retour à votre tour).', 'Las tiradas de ataque contra ti tienen desventaja hasta que recibes daño (vuelve en tu siguiente turno).',
    grants=[g('disadvantage', 'attacks-against', condition=T('not after taking damage this round, nor at Speed 0', 'pas après avoir subi des dégâts ce round, ni à Vitesse 0', 'no tras recibir daño este asalto, ni con velocidad 0'))])
eff('cloak-of-elvenkind', 'Advantage on Stealth; Perception checks to perceive you have Disadvantage.', 'Avantage en Discrétion ; les tests de Perception pour vous percevoir ont le Désavantage.', 'Ventaja en Sigilo; las pruebas de Percepción para percibirte tienen desventaja.', grants=[adv('skill.stealth')])
eff('cloak-of-invisibility', '3 charges: Magic action, 1 charge, Invisible for 1 hour.', '3 charges : action Magie, 1 charge, Invisible pendant 1 heure.', '3 cargas: acción de magia, 1 carga, Invisible durante 1 hora.',
    spellItem=SI(charges=3, recharge='1d3', note=T('1 charge: the Invisible condition for 1 hour', '1 charge : état Invisible pendant 1 heure', '1 carga: estado Invisible durante 1 hora')))
eff('cloak-of-protection', '+1 to AC and saving throws.', '+1 à la CA et aux jets de sauvegarde.', '+1 a la CA y a las tiradas de salvación.', modifiers=[mod('ac', 1), mod('save.all', 1)])
eff('cloak-of-the-bat', 'Advantage on Stealth; Fly 40 ft in Dim Light or Darkness; Polymorph into a bat once per dawn.', 'Avantage en Discrétion ; vol 12 m en lumière faible ou dans les ténèbres ; Métamorphose en chauve-souris une fois par aube.', 'Ventaja en Sigilo; volando 12 m en luz tenue u oscuridad; Polimorfar en murciélago una vez por amanecer.',
    modifiers=[mod('speed.fly', 40, when='toggle:cloak-of-the-bat', condition=T('in Dim Light or Darkness, gripping the cloak', 'en lumière faible ou ténèbres, en tenant la cape', 'en luz tenue u oscuridad, sujetando la capa'))],
    grants=[adv('skill.stealth')], spellItem=SI([sp('polymorph', perDay=1, note=T('yourself, into a Bat', 'vous-même, en chauve-souris', 'tú mismo, en murciélago'))]))
eff('cloak-of-the-manta-ray', 'Breathe underwater; Swim Speed 60 ft.', 'Respirer sous l’eau ; Vitesse de nage de 18 m.', 'Respirar bajo el agua; velocidad nadando 18 m.', modifiers=[mod('speed.swim', 60)])
eff('crystal-ball', 'Cast Scrying (DC 17).', 'Lancer Scrutation (DD 17).', 'Lanzar Escudriñar (CD 17).', spellItem=SI([sp('scrying', atWill=True, dc=17)]))
eff('crystal-ball-of-mind-reading', 'Cast Scrying (DC 17) and Detect Thoughts (DC 17) through the sensor.', 'Lancer Scrutation (DD 17) et Détection des pensées (DD 17) par le capteur.', 'Lanzar Escudriñar (CD 17) y Detectar pensamientos (CD 17) a través del sensor.',
    spellItem=SI([sp('scrying', atWill=True, dc=17), sp('detect-thoughts', atWill=True, dc=17, note=T('through the sensor, no Concentration', 'par le capteur, sans Concentration', 'a través del sensor, sin Concentración'))]))
eff('crystal-ball-of-telepathy', 'Scrying (DC 17), telepathy through the sensor, Suggestion (DC 17) once per dawn.', 'Scrutation (DD 17), télépathie par le capteur, Suggestion (DD 17) une fois par aube.', 'Escudriñar (CD 17), telepatía a través del sensor, Sugestión (CD 17) una vez por amanecer.',
    spellItem=SI([sp('scrying', atWill=True, dc=17), sp('suggestion', perDay=1, dc=17)]))
eff('crystal-ball-of-true-seeing', 'Scrying (DC 17) with Truesight 120 ft around the sensor.', 'Scrutation (DD 17) avec vision véritable de 36 m autour du capteur.', 'Escudriñar (CD 17) con visión verdadera 36 m alrededor del sensor.', spellItem=SI([sp('scrying', atWill=True, dc=17)]))
eff('cube-of-force', '10 charges: Mage Armor, Shield, Tiny Hut, Private Sanctum, Resilient Sphere, Wall of Force (DC 17).', '10 charges : Armure du mage, Bouclier, Petite hutte, Sanctuaire privé, Sphère résiliente, Mur de force (DD 17).', '10 cargas: Armadura de mago, Escudo, Pequeña choza, Sanctasanctórum privado, Esfera elástica, Muro de fuerza (CD 17).',
    spellItem=SI([sp('mage-armor', 1, dc=17), sp('shield', 1, dc=17), sp('tiny-hut', 3, dc=17), sp('private-sanctum', 4, dc=17),
                  sp('resilient-sphere', 4, dc=17), sp('wall-of-force', 5, dc=17)], charges=10, recharge='1d6'))
eff('cubic-gate', '3 charges: cast Gate or Plane Shift to the plane keyed to a side.', '3 charges : lancer Portail ou Changement de plan vers le plan d’une face.', '3 cargas: lanzar Portal o Desplazamiento entre planos al plano asociado a una cara.',
    spellItem=SI([sp('gate', 1), sp('plane-shift', 1)], charges=3, recharge='1d3'))
# ======================================================================== D
eff('dagger-of-venom', '+1 attack and damage; once per dawn coat it: DC 15 Con or 2d10 Poison and Poisoned.', '+1 à l’attaque et aux dégâts ; une fois par aube, l’enduire : Con DD 15 ou 2d10 poison et Empoisonné.', '+1 al ataque y al daño; una vez por amanecer, untarla: Con CD 15 o 2d10 de veneno y Envenenado.', modifiers=bonus(1))
eff('dancing-sword', 'Bonus Action: it flies and attacks up to four times with your attack roll.', 'Action Bonus : elle vole et attaque jusqu’à quatre fois avec votre jet d’attaque.', 'Acción adicional: vuela y ataca hasta cuatro veces con tu tirada de ataque.', textOnly=ACT)
eff('decanter-of-endless-water', 'Magic action: 1, 5 or 30 gallons of water (geyser: DC 13 Str or Prone).', 'Action Magie : 4, 20 ou 120 litres d’eau (geyser : For DD 13 ou À terre).', 'Acción de magia: 4, 20 o 120 litros de agua (géiser: Fue CD 13 o Derribado).', textOnly=ACT)
eff('deck-of-illusions', 'Draw a card: an illusory creature appears until dispelled.', 'Tirer une carte : une créature illusoire apparaît jusqu’à dissipation.', 'Sacar una carta: aparece una criatura ilusoria hasta que se disipa.', textOnly=ACT)
eff('defender', '+3 attack and damage; move some of the bonus to your AC each turn.', '+3 à l’attaque et aux dégâts ; transférez une partie du bonus à votre CA à chaque tour.', '+3 al ataque y al daño; traslada parte del bonificador a tu CA cada turno.', modifiers=bonus(3))
eff('demon-armor', '+1 AC, Abyssal; Unarmed Strikes deal 1d8 Slashing at +1; cursed.', '+1 à la CA, abyssal ; attaques à mains nues 1d8 tranchants à +1 ; maudite.', '+1 a la CA, abisal; los ataques sin armas infligen 1d8 cortante con +1; maldita.',
    modifiers=[mod('ac', 1), mod('attack.unarmed', 1), mod('damage.unarmed', 1)], grants=[g('language', value='Abyssal')])
eff('dimensional-shackles', 'Bind an Incapacitated creature: no extradimensional travel (DC 30 Athletics every 30 days).', 'Entravez une créature Neutralisée : aucun voyage extradimensionnel (Athlétisme DD 30 tous les 30 jours).', 'Atar a una criatura Incapacitada: ningún viaje extradimensional (Atletismo CD 30 cada 30 días).', textOnly=ACT)
eff('dragon-orb', 'Artifact: DC 15 Cha to control; 7 charges for Cure Wounds, Daylight, Death Ward, Detect Magic, Scrying.', 'Artefact : Cha DD 15 pour la contrôler ; 7 charges pour Soins, Lumière du jour, Protection contre la mort, Détection de la magie, Scrutation.', 'Artefacto: Car CD 15 para controlarlo; 7 cargas para Curar heridas, Luz del día, Guarda contra la muerte, Detectar magia, Escudriñar.',
    spellItem=SI([sp('cure-wounds', 4, level=9), sp('daylight', 1), sp('death-ward', 2), sp('detect-magic', 0), sp('scrying', 3, dc=18)],
                 charges=7, recharge='1d4 + 3', note=T('only while you control the orb', 'seulement si vous contrôlez l’orbe', 'solo mientras controlas el orbe')))
DRAGONS = [('black', 'Black', 'Noir', 'Negro', 'acid'), ('blue', 'Blue', 'Bleu', 'Azul', 'lightning'),
           ('brass', 'Brass', 'Airain', 'Oropel', 'fire'), ('bronze', 'Bronze', 'Bronze', 'Bronce', 'lightning'),
           ('copper', 'Copper', 'Cuivre', 'Cobre', 'acid'), ('gold', 'Gold', 'Or', 'Oro', 'fire'),
           ('green', 'Green', 'Vert', 'Verde', 'poison'), ('red', 'Red', 'Rouge', 'Rojo', 'fire'),
           ('silver', 'Silver', 'Argent', 'Plata', 'cold'), ('white', 'White', 'Blanc', 'Blanco', 'cold')]
eff('dragon-scale-mail', '+1 AC, Advantage on saves against Dragon breath, Resistance by dragon kind.', '+1 à la CA, Avantage aux JS contre les souffles de dragon, Résistance selon le dragon.', '+1 a la CA, ventaja en las salvaciones contra el aliento de los dragones, resistencia según el dragón.',
    modifiers=[mod('ac', 1)], grants=[adv('save.all', T('against a Dragon’s breath weapon', 'contre le souffle d’un dragon', 'contra el arma de aliento de un dragón'))],
    choices=[{'kind': 'option', 'name': T('Dragon', 'Dragon', 'Dragón'),
              'options': {k: {'name': T(en, fr, es), 'grants': [res(t)]} for k, en, fr, es, t in DRAGONS}}])
eff('dragon-slayer', '+1 attack and damage; extra 3d6 against Dragons.', '+1 à l’attaque et aux dégâts ; 3d6 dégâts en plus contre les dragons.', '+1 al ataque y al daño; 3d6 adicionales contra dragones.',
    modifiers=bonus(1) + [dice('3d6', T('target is a Dragon (weapon’s type)', 'cible dragon (type de l’arme)', 'objetivo dragón (tipo del arma)'))])
eff('dust-of-disappearance', 'Throw: you and all within 10 ft are Invisible for 2d4 minutes.', 'Lancer : vous et tout ce qui est à 3 m êtes Invisibles pendant 2d4 minutes.', 'Lanzar: tú y todo lo que esté a 3 m o menos sois Invisibles durante 2d4 minutos.', textOnly=ONE)
eff('dust-of-dryness', 'A pinch turns a 15-ft cube of water into a pellet, or deals 10d6 Necrotic to a water elemental (DC 13).', 'Une pincée transforme un cube d’eau de 4,50 m en bille, ou 10d6 nécrotiques à un élémentaire d’eau (DD 13).', 'Una pizca convierte un cubo de agua de 4,5 m en una bolita, o inflige 10d6 necrótico a un elemental de agua (CD 13).', textOnly=ONE)
eff('dust-of-sneezing-and-choking', 'Throw: creatures within 30 ft, DC 15 Con or Incapacitated and suffocating.', 'Lancer : créatures à 9 m, Con DD 15 ou Neutralisées et suffocant.', 'Lanzar: criaturas a 9 m o menos, Con CD 15 o Incapacitadas y asfixiándose.', textOnly=ONE)
eff('dwarven-plate', '+2 AC; Reaction: reduce a forced move by 10 ft.', '+2 à la CA ; Réaction : réduire de 3 m un déplacement forcé.', '+2 a la CA; reacción: reducir en 3 m un desplazamiento forzado.', modifiers=[mod('ac', 2)])
eff('dwarven-thrower', '+3 attack and damage, Thrown 20/60; extra 1d8 Force when thrown (2d8 vs Giants), returns.', '+3 à l’attaque et aux dégâts, lancer 6/18 m ; 1d8 force en plus lancée (2d8 contre les géants), revient.', '+3 al ataque y al daño, arrojadiza 6/18 m; 1d8 de fuerza adicional al lanzarla (2d8 contra gigantes), vuelve.',
    modifiers=bonus(3) + [dice('1d8', T('ranged attack: Force (2d8 vs a Giant)', 'attaque à distance : force (2d8 contre un géant)', 'ataque a distancia: fuerza (2d8 contra un gigante)'))])
# ======================================================================== E
eff('efficient-quiver', 'Holds 60 arrows, 18 javelins and 6 long objects; weighs 2 lb.', 'Contient 60 flèches, 18 javelines et 6 objets longs ; pèse 1 kg.', 'Contiene 60 flechas, 18 jabalinas y 6 objetos largos; pesa 1 kg.', textOnly=GM)
eff('efreeti-bottle', 'Open: an efreeti appears; the GM rolls whether it serves, attacks or grants a wish.', 'Ouvrir : un éfrit apparaît ; le MJ détermine s’il sert, attaque ou exauce un souhait.', 'Abrirla: aparece un ifrit; el GM tira si te sirve, te ataca o te concede un deseo.', textOnly=SUMMON)
eff('elemental-gem', 'Break it: summon an elemental by gem type for 1 hour.', 'La briser : convoquer un élémentaire selon la gemme pour 1 heure.', 'Romperla: invocar un elemental según la gema durante 1 hora.', textOnly=SUMMON)
eff('elixir-of-health', 'Drink: cures magical contagions and ends Blinded, Deafened, Paralyzed, Poisoned.', 'Boire : guérit les contagions magiques et met fin à Aveuglé, Assourdi, Paralysé, Empoisonné.', 'Beberlo: cura los contagios mágicos y pone fin a Cegado, Ensordecido, Paralizado y Envenenado.',
    spellItem=SI(**POTION, note=T('ends Blinded, Deafened, Paralyzed and Poisoned', 'met fin à Aveuglé, Assourdi, Paralysé et Empoisonné', 'pone fin a Cegado, Ensordecido, Paralizado y Envenenado')))
eff('elven-chain', '+1 AC; trained with it even without Medium or Heavy armor training.', '+1 à la CA ; formé à son port même sans formation aux armures intermédiaires ou lourdes.', '+1 a la CA; entrenado con ella aunque no tengas entrenamiento con armaduras medias o pesadas.',
    modifiers=[mod('ac', 1)], grants=[g('proficiency', 'armor.medium'), g('proficiency', 'armor.heavy')])
eff('energy-bow', '+1 attack and damage, Force arrows; Arrow of Restraint, Transport, Energy Ladder.', '+1 à l’attaque et aux dégâts, flèches de force ; flèche d’entrave, de transport, échelle d’énergie.', '+1 al ataque y al daño, flechas de fuerza; Flecha apresadora, Flecha transportadora, Escalera de energía.', modifiers=bonus(1))
eff('eversmoking-bottle', 'Open: smoke fills a 60-ft Emanation (up to 120 ft), Heavily Obscured.', 'Ouverte : une fumée remplit une émanation de 18 m (jusqu’à 36 m), visibilité nulle.', 'Abrirla: el humo llena una emanación de 18 m (hasta 36 m), muy oscura.', textOnly=ACT)
eff('eyes-of-charming', '3 charges: Charm Person (DC 13), one level higher per extra charge.', '3 charges : Charme-personne (DD 13), un niveau de plus par charge supplémentaire.', '3 cargas: Hechizar persona (CD 13), un nivel más por carga adicional.',
    spellItem=SI([sp('charm-person', 1, level=1, maxLevel=3, dc=13)], charges=3, recharge='all'))
eff('eyes-of-minute-seeing', 'Darkvision within 1 ft; Advantage on Investigation within 1 ft.', 'Vision dans le noir à 30 cm ; Avantage en Investigation à 30 cm.', 'Visión en la oscuridad a 30 cm; ventaja en Investigación a 30 cm.',
    grants=[adv('skill.investigation', T('examining something within 1 foot', 'pour examiner quelque chose à 30 cm', 'al examinar algo a 30 cm o menos'))])
eff('eyes-of-the-eagle', 'Advantage on Perception checks that rely on sight; see far details.', 'Avantage aux tests de Perception basés sur la vue ; détails lointains.', 'Ventaja en las pruebas de Percepción que dependan de la vista; ves detalles lejanos.',
    grants=[adv('skill.perception', T('relying on sight', 'basés sur la vue', 'que dependan de la vista'))])
# ======================================================================== F
eff('feather-token', 'Single-use token: anchor, bird, fan, swan boat, tree or whip.', 'Plume à usage unique : ancre, oiseau, éventail, bateau-cygne, arbre ou fouet.', 'Ficha de un solo uso: ancla, pájaro, abanico, bote cisne, árbol o látigo.', textOnly=ONE)
eff('figurine-of-wondrous-power', 'Throw it: becomes a creature for a while, then needs days to recover.', 'La lancer : devient une créature un temps, puis doit se reposer des jours.', 'Lanzarla: se convierte en una criatura durante un tiempo y luego necesita días para recuperarse.', textOnly=SUMMON)
eff('flame-tongue', 'Bonus Action: the weapon ignites, extra 2d6 Fire on a hit.', 'Action Bonus : l’arme s’embrase, 2d6 dégâts de feu en plus.', 'Acción adicional: el arma se enciende, 2d6 de fuego adicional al impactar.',
    modifiers=[dice('2d6', T('ablaze: Fire', 'embrasée : feu', 'en llamas: fuego'), when='toggle:flame-tongue')])
eff('folding-boat', 'A box that unfolds into a Rowboat or a Keelboat.', 'Une boîte qui se déplie en barque ou en quillard.', 'Una caja que se despliega en un bote de remos o una barcaza.', textOnly=VEHICLE)
eff('frost-brand', 'Extra 1d6 Cold on a hit; Fire Resistance while held; puts out flames.', '1d6 dégâts de froid en plus ; Résistance au feu en main ; éteint les flammes.', '1d6 de frío adicional al impactar; resistencia al fuego mientras la empuñas; apaga las llamas.',
    modifiers=[dice('1d6', T('Cold', 'froid', 'frío'))], grants=[res('fire')])
# ======================================================================== G
eff('gauntlets-of-ogre-power', 'Your Strength is 19 while you wear them.', 'Votre Force est de 19 tant que vous les portez.', 'Tu Fuerza es 19 mientras los llevas puestos.', modifiers=[mod('ability.str.set', 19)])
eff('gem-of-brightness', '50 charges: light, a blinding beam (1) or a blinding cone (5), DC 15 Con.', '50 charges : lumière, rayon aveuglant (1) ou cône aveuglant (5), Con DD 15.', '50 cargas: luz, un rayo cegador (1) o un cono cegador (5), Con CD 15.',
    spellItem=SI(charges=50, note=T('beam 1 charge, cone 5 charges: DC 15 Con or Blinded 1 minute', 'rayon 1 charge, cône 5 charges : Con DD 15 ou Aveuglé 1 minute', 'rayo 1 carga, cono 5 cargas: Con CD 15 o Cegado 1 minuto')))
eff('gem-of-seeing', '3 charges: Truesight 120 ft through the gem for 10 minutes.', '3 charges : vision véritable 36 m à travers la gemme pendant 10 minutes.', '3 cargas: visión verdadera 36 m a través de la gema durante 10 minutos.',
    spellItem=SI(charges=3, recharge='1d3', note=T('1 charge: Truesight 120 ft for 10 minutes', '1 charge : vision véritable 36 m pendant 10 minutes', '1 carga: visión verdadera 36 m durante 10 minutos')))
eff('giant-slayer', '+1 attack and damage; vs Giants extra 2d6 and DC 15 Str or Prone.', '+1 à l’attaque et aux dégâts ; contre les géants 2d6 en plus et For DD 15 ou À terre.', '+1 al ataque y al daño; contra gigantes, 2d6 adicionales y Fue CD 15 o Derribado.',
    modifiers=bonus(1) + [dice('2d6', T('target is a Giant (weapon’s type)', 'cible géant (type de l’arme)', 'objetivo gigante (tipo del arma)'))])
eff('glamoured-studded-leather', '+1 AC; Bonus Action: looks like clothing or other armor.', '+1 à la CA ; action Bonus : ressemble à des vêtements ou à une autre armure.', '+1 a la CA; acción adicional: parece ropa u otra armadura.', modifiers=[mod('ac', 1)])
eff('gloves-of-missile-snaring', 'Reaction: reduce ranged weapon damage by 1d10 + Dex; catch it if reduced to 0.', 'Réaction : réduire les dégâts d’une arme à distance de 1d10 + Dex ; l’attraper si réduits à 0.', 'Reacción: reducir el daño de un arma a distancia en 1d10 + Des; atraparla si queda en 0.',
    computed=[{'id': 'snare', 'label': T('Damage reduced', 'Dégâts réduits', 'Daño reducido'), 'dice': '1d10', 'parts': ['dex']}])
eff('gloves-of-swimming-and-climbing', 'Climb and Swim Speeds equal to Speed; +5 Athletics to climb or swim.', 'Vitesses d’escalade et de nage égales à la Vitesse ; +5 en Athlétisme pour grimper ou nager.', 'Velocidades trepando y nadando iguales a tu velocidad; +5 a Atletismo para trepar o nadar.',
    modifiers=[mod('speed.climb', 'speed'), mod('speed.swim', 'speed'), mod('skill.athletics', 5, condition=T('to climb or swim', 'pour grimper ou nager', 'para trepar o nadar'))])
eff('gloves-of-thievery', 'Imperceptible; +5 to Dexterity (Sleight of Hand) checks.', 'Imperceptibles ; +5 aux tests de Dextérité (Escamotage).', 'Imperceptibles; +5 a las pruebas de Destreza (Juego de manos).', modifiers=[mod('skill.sleight-of-hand', 5)])
eff('goggles-of-night', 'Darkvision 60 ft (or +60 ft if you have it).', 'Vision dans le noir 18 m (ou +18 m si vous l’avez déjà).', 'Visión en la oscuridad 18 m (o +18 m si ya la tienes).', grants=[g('darkvision', value=60)])
# ======================================================================== H
eff('hammer-of-thunderbolts', '+1 attack and damage; 5 charges: hurl it, DC 17 Con or Stunned; Giant’s Bane with a strength item.', '+1 à l’attaque et aux dégâts ; 5 charges : le lancer, Con DD 17 ou Étourdi ; Fléau des géants avec un objet de force.', '+1 al ataque y al daño; 5 cargas: lanzarlo, Con CD 17 o Aturdido; Azote de gigantes con un objeto de fuerza.',
    modifiers=bonus(1), spellItem=SI(charges=5, recharge='1d4 + 1', note=T('1 charge: thrown 20/60 ft, DC 17 Con or Stunned', '1 charge : lancé 6/18 m, Con DD 17 ou Étourdi', '1 carga: arrojado 6/18 m, Con CD 17 o Aturdido')))
eff('handy-haversack', 'Two 200-lb side pouches and a 500-lb central pouch; always 5 lb.', 'Deux poches latérales de 100 kg et une centrale de 250 kg ; toujours 2,5 kg.', 'Dos bolsas laterales de 100 kg y una central de 250 kg; siempre 2,5 kg.', textOnly=GM)
eff('hat-of-disguise', 'Cast Disguise Self at will.', 'Lancer Déguisement à volonté.', 'Lanzar Disfrazarse a voluntad.', spellItem=SI([sp('disguise-self', atWill=True)]))
eff('hat-of-many-spells', 'Wizard focus; try to cast an unknown Wizard spell (Arcana DC 10 + level) or a random effect.', 'Focaliseur de magicien ; tenter un sort de magicien inconnu (Arcanes DD 10 + niveau) ou effet aléatoire.', 'Canalizador de mago; intentar lanzar un conjuro de mago desconocido (Conocimiento Arcano CD 10 + nivel) o un efecto aleatorio.', textOnly=ACT)
eff('headband-of-intellect', 'Your Intelligence is 19 while you wear it.', 'Votre Intelligence est de 19 tant que vous le portez.', 'Tu Inteligencia es 19 mientras la llevas puesta.', modifiers=[mod('ability.int.set', 19)])
eff('helm-of-brilliance', 'Gems: Fire Resistance (ruby), flaming weapon (+1d6 Fire), spells (DC 18) using up gems.', 'Gemmes : Résistance au feu (rubis), arme enflammée (+1d6 feu), sorts (DD 18) qui consomment des gemmes.', 'Gemas: resistencia al fuego (rubí), arma en llamas (+1d6 de fuego), conjuros (CD 18) que gastan gemas.',
    grants=[res('fire', T('while it has a ruby', 'tant qu’il a un rubis', 'mientras tenga un rubí'))],
    spellItem=SI([sp('daylight', dc=18, atWill=True, note=T('uses an opal', 'consomme une opale', 'gasta un ópalo')),
                  sp('fireball', dc=18, atWill=True, note=T('uses a fire opal', 'consomme une opale de feu', 'gasta un ópalo de fuego')),
                  sp('prismatic-spray', dc=18, atWill=True, note=T('uses a diamond', 'consomme un diamant', 'gasta un diamante')),
                  sp('wall-of-fire', dc=18, atWill=True, note=T('uses a ruby', 'consomme un rubis', 'gasta un rubí'))]))
eff('helm-of-comprehending-languages', 'Cast Comprehend Languages at will.', 'Lancer Compréhension des langues à volonté.', 'Lanzar Entender idiomas a voluntad.', spellItem=SI([sp('comprehend-languages', atWill=True)]))
eff('helm-of-telepathy', 'Telepathy 30 ft; Detect Thoughts and Suggestion (DC 13) once per dawn each.', 'Télépathie 9 m ; Détection des pensées et Suggestion (DD 13) une fois par aube chacun.', 'Telepatía 9 m; Detectar pensamientos y Sugestión (CD 13) una vez por amanecer cada uno.',
    spellItem=SI([sp('detect-thoughts', perDay=1, dc=13), sp('suggestion', perDay=1, dc=13)]))
eff('helm-of-teleportation', '3 charges: cast Teleport.', '3 charges : lancer Téléportation.', '3 cargas: lanzar Teletransporte.', spellItem=SI([sp('teleport', 1)], charges=3, recharge='1d3'))
eff('holy-avenger', '+3 attack and damage; extra 2d10 Radiant vs Fiends and Undead; aura of Advantage on saves against magic.', '+3 à l’attaque et aux dégâts ; 2d10 radiants en plus contre fiélons et morts-vivants ; aura d’Avantage aux JS contre la magie.', '+3 al ataque y al daño; 2d10 radiante adicional contra infernales y muertos vivientes; aura de ventaja en las salvaciones contra la magia.',
    modifiers=bonus(3) + [dice('2d10', T('target is a Fiend or an Undead: Radiant', 'cible fiélon ou mort-vivant : radiants', 'objetivo infernal o muerto viviente: radiante'))],
    grants=[adv('save.magic', T('against spells and magical effects (10-ft aura while drawn)', 'contre les sorts et effets magiques (aura de 3 m, dégainée)', 'contra conjuros y efectos mágicos (aura de 3 m, desenvainada)'))])
eff('horn-of-blasting', '30-ft Cone: DC 15 Con, 5d8 Thunder and Deafened; 20% chance to explode.', 'Cône de 9 m : Con DD 15, 5d8 tonnerre et Assourdi ; 20 % de risque d’exploser.', 'Cono de 9 m: Con CD 15, 5d8 de trueno y Ensordecido; 20 % de probabilidad de explotar.', textOnly=ACT)
eff('horn-of-valhalla', 'Blow it: 2 to 5 Berserker spirits for 1 hour; once per 7 days.', 'Le sonner : 2 à 5 esprits berserkers pour 1 heure ; une fois par 7 jours.', 'Soplarlo: de 2 a 5 espíritus berserker durante 1 hora; una vez cada 7 días.', textOnly=SUMMON)
eff('horseshoes-of-a-zephyr', 'A horse floats over any surface, ignores Difficult Terrain, travels 12 hours a day.', 'Un cheval flotte sur toute surface, ignore le terrain difficile, voyage 12 heures par jour.', 'Un caballo flota sobre cualquier superficie, ignora el terreno difícil y viaja 12 horas al día.', textOnly=MOUNT)
eff('horseshoes-of-speed', 'The shod creature’s Speed increases by 30 ft.', 'La Vitesse de la créature ferrée augmente de 9 m.', 'La velocidad de la criatura herrada aumenta en 9 m.', textOnly=MOUNT)
# ======================================================================== I
eff('immovable-rod', 'Press the button: fixed in place, holds 8,000 lb.', 'Appuyer sur le bouton : fixé sur place, supporte 4 tonnes.', 'Pulsar el botón: queda fijo en el sitio, aguanta 4 toneladas.', textOnly=ACT)
eff('instant-fortress', 'Command word: grows into a 20-ft adamantine tower.', 'Mot de commande : devient une tour d’adamantium de 6 m.', 'Palabra de mando: crece hasta ser una torre de adamantina de 6 m.', textOnly=VEHICLE)
IOUN = {
    'absorption': (T('Absorption', 'Absorption', 'Absorción'), {}),
    'agility': (T('Agility (Dex +2)', 'Agilité (Dex +2)', 'Agilidad (Des +2)'), {'modifiers': [mod('ability.dex', 2)]}),
    'awareness': (T('Awareness', 'Vigilance', 'Consciencia'), {'grants': [adv('initiative'), adv('skill.perception')]}),
    # SRD name of this type: see the item text (its English and French names are 3.5 save words the no-35 test bans).
    'constitution': (T('Constitution +2', 'Constitution +2', 'Constitución +2'), {'modifiers': [mod('ability.con', 2)]}),
    'greater-absorption': (T('Greater Absorption', 'Absorption suprême', 'Absorción mayor'), {}),
    'insight': (T('Insight (Wis +2)', 'Intuition (Sag +2)', 'Perspicacia (Sab +2)'), {'modifiers': [mod('ability.wis', 2)]}),
    'intellect': (T('Intellect (Int +2)', 'Intellect (Int +2)', 'Intelecto (Int +2)'), {'modifiers': [mod('ability.int', 2)]}),
    'leadership': (T('Leadership (Cha +2)', 'Commandement (Cha +2)', 'Liderazgo (Car +2)'), {'modifiers': [mod('ability.cha', 2)]}),
    'mastery': (T('Mastery (Proficiency Bonus +1, not computed)', 'Maîtrise (bonus de maîtrise +1, non calculé)', 'Maestría (bonificador por competencia +1, no calculado)'), {}),
    'protection': (T('Protection (+1 AC)', 'Protection (+1 CA)', 'Protección (+1 CA)'), {'modifiers': [mod('ac', 1)]}),
    'regeneration': (T('Regeneration', 'Régénération', 'Regeneración'), {}),
    'reserve': (T('Reserve', 'Réserve', 'Reserva'), {}),
    'strength': (T('Strength (Str +2)', 'Force (For +2)', 'Fuerza (Fue +2)'), {'modifiers': [mod('ability.str', 2)]}),
    'sustenance': (T('Sustenance', 'Subsistance', 'Sustento'), {}),
}
eff('ioun-stone', 'Orbits your head: a benefit by type (ability +2, +1 AC, Advantage, spell absorption…).', 'Gravite autour de votre tête : un bénéfice selon le type (caractéristique +2, +1 CA, Avantage, absorption…).', 'Orbita alrededor de tu cabeza: un beneficio según el tipo (característica +2, +1 a la CA, ventaja, absorción de conjuros…).',
    choices=[{'kind': 'option', 'name': T('Type', 'Type', 'Tipo'), 'options': {k: {'name': n, **x} for k, (n, x) in IOUN.items()}}],
    spellItem=SI(stores=True, note=T('Reserve: stores up to 4 levels of spells, cast with the original caster’s DC', 'Réserve : stocke jusqu’à 4 niveaux de sorts, lancés avec le DD du lanceur d’origine', 'Reserva: almacena hasta 4 niveles de conjuros, lanzados con la CD del lanzador original')))
eff('iron-bands', 'Throw (Dex + PB to hit): the target is Restrained until released; once per dawn.', 'Lancer (Dex + bonus de maîtrise) : la cible est Entravée jusqu’à libération ; une fois par aube.', 'Lanzar (Des + BC al ataque): el objetivo queda Apresado hasta que se libera; una vez por amanecer.', textOnly=ACT)
eff('iron-flask', 'Trap an extraplanar creature (DC 17 Wis); release it to command it for 1 hour.', 'Piéger une créature extraplanaire (Sag DD 17) ; la libérer pour la commander 1 heure.', 'Atrapar a una criatura extraplanar (Sab CD 17); liberarla para darle órdenes durante 1 hora.', textOnly=ACT)
# ======================================================================== J-L
eff('javelin-of-lightning', 'Lightning damage on a hit; once per dawn a 120-ft bolt, DC 13 Dex, 4d6 Lightning.', 'Dégâts de foudre au toucher ; une fois par aube un éclair de 36 m, Dex DD 13, 4d6 foudre.', 'Daño de relámpago al impactar; una vez por amanecer, un rayo de 36 m, Des CD 13, 4d6 de relámpago.', textOnly=ACT)
eff('lantern-of-revealing', 'Its Bright Light reveals Invisible creatures and objects.', 'Sa lumière vive révèle créatures et objets invisibles.', 'Su luz brillante revela criaturas y objetos invisibles.', textOnly=GM)
eff('luck-blade', '+1 attack and damage, +1 saves while on you; reroll a failed D20 Test per dawn; Wish charges.', '+1 à l’attaque et aux dégâts, +1 aux JS tant que vous l’avez ; relancer un test d20 raté par aube ; charges de Souhait.', '+1 al ataque y al daño, +1 a las salvaciones mientras la lleves; repetir una prueba con d20 fallida por amanecer; cargas de Deseo.',
    activeWhen='on-person', modifiers=bonus(1) + [mod('save.all', 1)],
    spellItem=SI([sp('wish', 1, note=T('once per dawn', 'une fois par aube', 'una vez por amanecer'))], charges='1d3'))
# ======================================================================== M
eff('mace-of-disruption', 'Extra 2d6 Radiant vs Fiends and Undead (destroyed at 25 HP or fewer, DC 15 Wis); sheds light.', '2d6 radiants en plus contre fiélons et morts-vivants (détruits à 25 PV ou moins, Sag DD 15) ; éclaire.', '2d6 radiante adicional contra infernales y muertos vivientes (destruidos con 25 PG o menos, Sab CD 15); emite luz.',
    modifiers=[dice('2d6', T('target is a Fiend or an Undead: Radiant', 'cible fiélon ou mort-vivant : radiants', 'objetivo infernal o muerto viviente: radiante'))])
eff('mace-of-smiting', '+1 attack and damage (+3 vs Constructs); a 20 deals 7 extra (14 vs Constructs).', '+1 à l’attaque et aux dégâts (+3 contre les créatures artificielles) ; un 20 inflige 7 en plus (14).', '+1 al ataque y al daño (+3 contra autómatas); un 20 inflige 7 adicionales (14 contra autómatas).',
    modifiers=bonus(1) + [mod('item.attack', 2, condition=T('against a Construct', 'contre une créature artificielle', 'contra un autómata')),
                          mod('item.damage', 2, condition=T('against a Construct', 'contre une créature artificielle', 'contra un autómata'))])
eff('mace-of-terror', '3 charges: creatures within 30 ft, DC 15 Wis or Frightened and fleeing.', '3 charges : créatures à 9 m, Sag DD 15 ou Effrayées et en fuite.', '3 cargas: criaturas a 9 m o menos, Sab CD 15 o Asustadas y huyendo.',
    spellItem=SI(charges=3, recharge='1d3', note=T('1 charge: DC 15 Wis or Frightened 1 minute', '1 charge : Sag DD 15 ou Effrayé 1 minute', '1 carga: Sab CD 15 o Asustado 1 minuto')))
eff('mantle-of-spell-resistance', 'Advantage on saving throws against spells.', 'Avantage aux jets de sauvegarde contre les sorts.', 'Ventaja en las tiradas de salvación contra conjuros.', grants=[adv('save.spells', T('against spells', 'contre les sorts', 'contra conjuros'))])
eff('manual-of-bodily-health', 'Study 48 hours: Constitution +2 (max 30).', 'Étude de 48 heures : Constitution +2 (max 30).', 'Estudio de 48 horas: Constitución +2 (máx. 30).', textOnly=PERM)
eff('manual-of-gainful-exercise', 'Study 48 hours: Strength +2 (max 30).', 'Étude de 48 heures : Force +2 (max 30).', 'Estudio de 48 horas: Fuerza +2 (máx. 30).', textOnly=PERM)
eff('manual-of-golems', 'Instructions and incantations to build a golem (time and cost by type).', 'Instructions et incantations pour fabriquer un golem (temps et coût selon le type).', 'Instrucciones y encantamientos para construir un gólem (tiempo y coste según el tipo).', textOnly=GM)
eff('manual-of-quickness-of-action', 'Study 48 hours: Dexterity +2 (max 30).', 'Étude de 48 heures : Dextérité +2 (max 30).', 'Estudio de 48 horas: Destreza +2 (máx. 30).', textOnly=PERM)
eff('marvelous-pigments', 'Paint objects in a 20-ft cube: they become real (up to 500 GP per pot).', 'Peindre des objets dans un cube de 6 m : ils deviennent réels (jusqu’à 500 po par pot).', 'Pintar objetos en un cubo de 6 m: se vuelven reales (hasta 500 po por bote).', textOnly=GM)
eff('medallion-of-thoughts', '5 charges: cast Detect Thoughts (DC 13).', '5 charges : lancer Détection des pensées (DD 13).', '5 cargas: lanzar Detectar pensamientos (CD 13).', spellItem=SI([sp('detect-thoughts', 1, dc=13)], charges=5, recharge='1d4'))
eff('mirror-of-life-trapping', 'Traps creatures that see their reflection (DC 15 Cha) in twelve cells.', 'Piège les créatures qui voient leur reflet (Cha DD 15) dans douze cellules.', 'Atrapa a las criaturas que ven su reflejo (Car CD 15) en doce celdas.', textOnly=GM)
eff('mithral-armor', 'No Stealth Disadvantage and no Strength requirement.', 'Ni Désavantage en Discrétion ni Force minimale.', 'Sin desventaja en Sigilo ni requisito de Fuerza.', flags=['no-armor-stealth-disadvantage', 'no-armor-speed-penalty'])
eff('mysterious-deck', 'Declare a number of cards and draw them: each has a powerful random effect.', 'Annoncez un nombre de cartes et tirez-les : chacune a un puissant effet aléatoire.', 'Declarar un número de cartas y sacarlas: cada una tiene un poderoso efecto aleatorio.', textOnly=GM)
# ======================================================================== N-O
eff('necklace-of-adaptation', 'Breathe in any environment; Advantage on saves against the Poisoned condition.', 'Respirer dans tout environnement ; Avantage aux JS contre l’état Empoisonné.', 'Respirar en cualquier entorno; ventaja en las salvaciones contra el estado Envenenado.', grants=[adv('save.poisoned')])
eff('necklace-of-fireballs', '1d6 + 3 beads: each a level 3 Fireball (DC 15), +1d6 per extra bead thrown together.', '1d6 + 3 perles : chacune une Boule de feu du niveau 3 (DD 15), +1d6 par perle lancée en plus.', '1d6 + 3 cuentas: cada una es una Bola de fuego de nivel 3 (CD 15), +1d6 por cuenta adicional lanzada a la vez.',
    spellItem=SI([sp('fireball', 1, level=3, dc=15, note=T('+1d6 per extra bead (max 12d6)', '+1d6 par perle supplémentaire (max 12d6)', '+1d6 por cuenta adicional (máx. 12d6)'))], charges='1d6 + 3'))
eff('necklace-of-prayer-beads', 'Magic beads cast Bless, Cure Wounds, Greater Restoration, Shining Smite, Guardian of Faith or Wind Walk.', 'Des perles lancent Bénédiction, Soins, Restauration suprême, Châtiment de révélation, Gardien de la foi ou Vent divin.', 'Las cuentas mágicas lanzan Bendición, Curar heridas, Restablecimiento mayor, Castigo brillante, Guardián de la fe o Viajar con el viento.',
    spellItem=SI([sp('bless', perDay=1), sp('cure-wounds', perDay=1, level=2), sp('greater-restoration', perDay=1), sp('shining-smite', perDay=1),
                  sp('guardian-of-faith', perDay=1), sp('wind-walk', perDay=1)], wielderDc=True,
                 note=T('Bonus Action; only the beads on your necklace (GM)', 'action Bonus ; seulement les perles de votre collier (MJ)', 'acción adicional; solo las cuentas de tu collar (GM)')))
eff('nine-lives-stealer', '+2 attack and damage; on a 20, a creature under 100 HP saves (DC 15 Con) or dies.', '+2 à l’attaque et aux dégâts ; sur un 20, une créature de moins de 100 PV réussit un JS (Con DD 15) ou meurt.', '+2 al ataque y al daño; con un 20, una criatura con menos de 100 PG hace una salvación (Con CD 15) o muere.',
    modifiers=bonus(2), spellItem=SI(charges='1d8 + 1', note=T('1 charge lost when a creature is slain', '1 charge perdue quand une créature est tuée', '1 carga perdida cuando muere una criatura')))
eff('oathbow', 'Sworn enemy: Advantage, ignores cover and long range, extra 3d6 Piercing.', 'Ennemi juré : Avantage, ignore l’abri et la longue portée, 3d6 perforants en plus.', 'Enemigo jurado: ventaja, ignora la cobertura y el alcance largo, 3d6 perforante adicional.',
    modifiers=[dice('3d6', T('against your sworn enemy: Piercing', 'contre votre ennemi juré : perforants', 'contra tu enemigo jurado: perforante'))])
eff('oil-of-etherealness', 'Applied in 10 minutes: the effect of Etherealness for 1 hour.', 'Appliquée en 10 minutes : l’effet de Forme éthérée pendant 1 heure.', 'Aplicado en 10 minutos: el efecto de Excursión etérea durante 1 hora.',
    spellItem=SI([sp('etherealness', note=T('1 hour', '1 heure', '1 hora'))], **POTION))
eff('oil-of-sharpness', 'Coats a Slashing or Piercing weapon (or 20 ammunition): it becomes +3.', 'Enduit une arme tranchante ou perforante (ou 20 munitions) : elle devient +3.', 'Unta un arma cortante o perforante (o 20 municiones): pasa a ser +3.',
    spellItem=SI(**POTION, note=T('the coated weapon becomes a +3 Weapon', 'l’arme enduite devient une arme +3', 'el arma untada pasa a ser un arma +3')))
eff('oil-of-slipperiness', 'Freedom of Movement for 8 hours, or Grease on a 10-ft square.', 'Liberté de mouvement pendant 8 heures, ou Graisse sur un carré de 3 m.', 'Libertad de movimiento durante 8 horas, o Grasa en un cuadrado de 3 m.',
    spellItem=SI([sp('freedom-of-movement', note=T('8 hours', '8 heures', '8 horas')), sp('grease', note=T('poured: 8 hours', 'versée : 8 heures', 'vertido: 8 horas'))], **POTION))
# ======================================================================== P
eff('pearl-of-power', 'Magic action: regain one expended spell slot of level 3 or lower, once per dawn.', 'Action Magie : récupérer un emplacement de sort du niveau 3 ou inférieur, une fois par aube.', 'Acción de magia: recuperar un espacio de conjuro gastado de nivel 3 o inferior, una vez por amanecer.',
    textOnly=T('Regains a spell slot: mark it back in the Spells pane.', 'Récupère un emplacement : rendez-le dans le volet Sorts.', 'Recupera un espacio de conjuro: márcalo de nuevo en el panel Conjuros.'))
eff('periapt-of-health', 'Regain 2d4 + 2 HP once per dawn; Advantage on saves against Poisoned.', 'Récupérer 2d4 + 2 PV une fois par aube ; Avantage aux JS contre Empoisonné.', 'Recuperar 2d4 + 2 PG una vez por amanecer; ventaja en las salvaciones contra Envenenado.',
    grants=[adv('save.poisoned')], computed=[{'id': 'heal', 'label': T('Hit Points regained', 'Points de vie récupérés', 'Puntos de golpe recuperados'), 'dice': '2d4', 'parts': [2]}])
eff('periapt-of-proof-against-poison', 'Immunity to the Poisoned condition and Poison damage.', 'Immunité contre l’état Empoisonné et les dégâts de poison.', 'Inmunidad al estado Envenenado y al daño de veneno.', grants=[g('immunity', 'poisoned'), g('immunity', 'poison')])
eff('periapt-of-wound-closure', 'Death Saving Throws of 9 or lower become 10; Hit Point Dice heal double.', 'Les jets de sauvegarde contre la mort de 9 ou moins deviennent 10 ; les dés de vie soignent le double.', 'Las tiradas de salvación contra muerte de 9 o menos pasan a ser 10; los dados de puntos de golpe curan el doble.',
    textOnly=T('Changes death saves and Hit Point Dice at the table: nothing on the sheet.', 'Modifie les JS contre la mort et les dés de vie en jeu : rien sur la feuille.', 'Modifica las tiradas de salvación contra muerte y los dados de puntos de golpe en la mesa: nada en la hoja.'))
eff('philter-of-love', 'Drink: Charmed by the next creature you see within 10 minutes, for 1 hour.', 'Boire : Charmé par la prochaine créature vue dans les 10 minutes, pendant 1 heure.', 'Beberlo: Hechizado por la próxima criatura que veas en 10 minutos, durante 1 hora.', spellItem=SI(**POTION))
eff('pipes-of-haunting', '3 charges: creatures within 30 ft, DC 15 Wis or Frightened 1 minute.', '3 charges : créatures à 9 m, Sag DD 15 ou Effrayées 1 minute.', '3 cargas: criaturas a 9 m o menos, Sab CD 15 o Asustadas 1 minuto.',
    spellItem=SI(charges=3, recharge='1d3', note=T('1 charge: DC 15 Wis or Frightened', '1 charge : Sag DD 15 ou Effrayé', '1 carga: Sab CD 15 o Asustado')))
eff('pipes-of-the-sewers', 'Rats are Indifferent; 3 charges: call Swarms of Rats and sway them (DC 15 Wis).', 'Les rats sont indifférents ; 3 charges : appeler des nuées de rats et les charmer (Sag DD 15).', 'Las ratas son indiferentes; 3 cargas: llamar enjambres de ratas e influirlos (Sab CD 15).',
    spellItem=SI(charges=3, recharge='1d3', note=T('1 charge per Swarm of Rats called', '1 charge par nuée de rats appelée', '1 carga por enjambre de ratas llamado')))
eff('plate-armor-of-etherealness', 'Command word: the effect of Etherealness, once per dawn.', 'Mot de commande : l’effet de Forme éthérée, une fois par aube.', 'Palabra de mando: el efecto de Excursión etérea, una vez por amanecer.', spellItem=SI([sp('etherealness', perDay=1)]))
eff('portable-hole', 'Unfolds into a 10-ft-deep extradimensional hole.', 'Se déplie en un trou extradimensionnel de 3 m de profondeur.', 'Se despliega en un agujero extradimensional de 3 m de profundidad.', textOnly=GM)
eff('potion-of-animal-friendship', 'Drink: cast the level 3 Animal Friendship (DC 13).', 'Boire : lancer Amitié avec les animaux du niveau 3 (DD 13).', 'Beberla: lanzar Encantar animal de nivel 3 (CD 13).', spellItem=SI([sp('animal-friendship', level=3, dc=13)], **POTION))
eff('potion-of-clairvoyance', 'Drink: the effect of Clairvoyance, no Concentration.', 'Boire : l’effet de Clairvoyance, sans Concentration.', 'Beberla: el efecto de Clarividencia, sin Concentración.', spellItem=SI([sp('clairvoyance', note=T('no Concentration', 'sans Concentration', 'sin Concentración'))], **POTION))
eff('potion-of-climbing', 'Drink: Climb Speed equal to Speed and Advantage to climb for 1 hour.', 'Boire : escalade égale à la Vitesse et Avantage pour grimper pendant 1 heure.', 'Beberla: velocidad trepando igual a tu velocidad y ventaja para trepar durante 1 hora.', spellItem=SI(**POTION))
eff('potion-of-diminution', 'Drink: the reduce effect of Enlarge/Reduce for 1d4 hours.', 'Boire : l’effet rapetisser d’Agrandissement/rapetissement pendant 1d4 heures.', 'Beberla: el efecto reducir de Agrandar/reducir durante 1d4 horas.',
    spellItem=SI([sp('enlarge-reduce', note=T('reduce, 1d4 hours, no Concentration', 'rapetisser, 1d4 heures, sans Concentration', 'reducir, 1d4 horas, sin Concentración'))], **POTION))
eff('potion-of-flying', 'Drink: Fly Speed equal to Speed (hover) for 1 hour.', 'Boire : vol égal à la Vitesse (stationnaire) pendant 1 heure.', 'Beberla: velocidad volando igual a tu velocidad (levitar) durante 1 hora.', spellItem=SI(**POTION))
eff('potion-of-gaseous-form', 'Drink: the effect of Gaseous Form for 1 hour.', 'Boire : l’effet de Forme gazeuse pendant 1 heure.', 'Beberla: el efecto de Forma gaseosa durante 1 hora.', spellItem=SI([sp('gaseous-form', note=T('1 hour, no Concentration', '1 heure, sans Concentration', '1 hora, sin Concentración'))], **POTION))
eff('potion-of-giant-strength', 'Drink: Strength 21 to 29 (by giant type) for 1 hour.', 'Boire : Force 21 à 29 (selon le géant) pendant 1 heure.', 'Beberla: Fuerza de 21 a 29 (según el gigante) durante 1 hora.',
    spellItem=SI(**POTION, variantNotes=[T(f'Strength {n} for 1 hour', f'Force {n} pendant 1 heure', f'Fuerza {n} durante 1 hora') for n in [21, 23, 25, 27, 29]]))
eff('potion-of-growth', 'Drink: the enlarge effect of Enlarge/Reduce for 10 minutes.', 'Boire : l’effet agrandir d’Agrandissement/rapetissement pendant 10 minutes.', 'Beberla: el efecto agrandar de Agrandar/reducir durante 10 minutos.',
    spellItem=SI([sp('enlarge-reduce', note=T('enlarge, 10 minutes, no Concentration', 'agrandir, 10 minutes, sans Concentration', 'agrandar, 10 minutos, sin Concentración'))], **POTION))
eff('potion-of-heroism', 'Drink: 10 Temporary Hit Points and Bless for 1 hour.', 'Boire : 10 points de vie temporaires et Bénédiction pendant 1 heure.', 'Beberla: 10 puntos de golpe temporales y Bendición durante 1 hora.',
    spellItem=SI([sp('bless', note=T('on you, 1 hour, no Concentration; and 10 Temporary HP', 'sur vous, 1 heure, sans Concentration ; et 10 PV temporaires', 'sobre ti, 1 hora, sin Concentración; y 10 PG temporales'))], **POTION))
eff('potion-of-invisibility', 'Drink: Invisible for 1 hour, until you attack, deal damage or cast.', 'Boire : Invisible pendant 1 heure, jusqu’à une attaque, des dégâts ou un sort.', 'Beberla: Invisible durante 1 hora, hasta que ataques, inflijas daño o lances un conjuro.', spellItem=SI(**POTION))
eff('potion-of-invulnerability', 'Drink: Resistance to all damage for 1 minute.', 'Boire : Résistance à tous les dégâts pendant 1 minute.', 'Beberla: resistencia a todo el daño durante 1 minuto.', spellItem=SI(**POTION))
eff('potion-of-longevity', 'Drink: 1d6 + 6 years younger (10% cumulative risk of aging instead).', 'Boire : 1d6 + 6 ans de moins (10 % de risque cumulatif de vieillir).', 'Beberla: 1d6 + 6 años más joven (10 % de riesgo acumulativo de envejecer en su lugar).', spellItem=SI(**POTION))
eff('potion-of-mind-reading', 'Drink: Detect Thoughts (DC 13) for 10 minutes.', 'Boire : Détection des pensées (DD 13) pendant 10 minutes.', 'Beberla: Detectar pensamientos (CD 13) durante 10 minutos.',
    spellItem=SI([sp('detect-thoughts', dc=13, note=T('10 minutes, no Concentration', '10 minutes, sans Concentration', '10 minutos, sin Concentración'))], **POTION))
eff('potion-of-poison', 'Looks beneficial; drinking deals 4d6 Poison, DC 13 Con or Poisoned 1 hour.', 'Semble bénéfique ; la boire inflige 4d6 poison, Con DD 13 ou Empoisonné 1 heure.', 'Parece beneficiosa; beberla inflige 4d6 de veneno, Con CD 13 o Envenenado 1 hora.', spellItem=SI(**POTION))
eff('potion-of-resistance', 'Drink: Resistance to one damage type for 1 hour.', 'Boire : Résistance à un type de dégâts pendant 1 heure.', 'Beberla: resistencia a un tipo de daño durante 1 hora.', spellItem=SI(**POTION))
eff('potion-of-speed', 'Drink: Haste for 1 minute, no lethargy afterwards.', 'Boire : Hâte pendant 1 minute, sans léthargie ensuite.', 'Beberla: Acelerar durante 1 minuto, sin letargo después.', spellItem=SI([sp('haste', note=T('1 minute, no Concentration, no lethargy', '1 minute, sans Concentration ni léthargie', '1 minuto, sin Concentración ni letargo'))], **POTION))
eff('potion-of-vitality', 'Drink: removes Exhaustion and Poisoned; Hit Point Dice heal the maximum for 24 hours.', 'Boire : retire l’Épuisement et Empoisonné ; les dés de vie soignent au maximum 24 heures.', 'Beberla: elimina Cansancio y Envenenado; los dados de puntos de golpe curan el máximo durante 24 horas.', spellItem=SI(**POTION))
eff('potion-of-water-breathing', 'Drink: breathe underwater for 24 hours.', 'Boire : respirer sous l’eau pendant 24 heures.', 'Beberla: respirar bajo el agua durante 24 horas.', spellItem=SI(**POTION))
eff('potions-of-healing', 'Drink: regain 2d4 + 2, 4d4 + 4, 8d4 + 8 or 10d4 + 20 HP by strength.', 'Boire : récupérer 2d4 + 2, 4d4 + 4, 8d4 + 8 ou 10d4 + 20 PV selon la puissance.', 'Beberla: recuperar 2d4 + 2, 4d4 + 4, 8d4 + 8 o 10d4 + 20 PG según su potencia.',
    spellItem=SI(**POTION, variantNotes=[T(f'Regain {d} Hit Points', f'Récupérer {d} points de vie', f'Recuperar {d} puntos de golpe') for d in ['2d4 + 2', '4d4 + 4', '8d4 + 8', '10d4 + 20']]))
# ======================================================================== Q-R
eff('quarterstaff-of-the-acrobat', '+2 attack and damage; Advantage on Acrobatics; +5 AC reaction; thrown 30/120.', '+2 à l’attaque et aux dégâts ; Avantage en Acrobaties ; réaction +5 CA ; lancer 9/36 m.', '+2 al ataque y al daño; ventaja en Acrobacias; reacción +5 a la CA; arrojadizo 9/36 m.',
    modifiers=bonus(2), grants=[adv('skill.acrobatics')])
eff('ring-of-animal-influence', '3 charges: Animal Friendship, Fear (Beasts) or Speak with Animals (DC 13).', '3 charges : Amitié avec les animaux, Terreur (bêtes) ou Communication avec les animaux (DD 13).', '3 cargas: Encantar animal, Terror (bestias) o Hablar con los animales (CD 13).',
    spellItem=SI([sp('animal-friendship', 1, dc=13), sp('fear', 1, dc=13, note=T('Beasts only', 'bêtes seulement', 'solo bestias')), sp('speak-with-animals', 1, dc=13)], charges=3, recharge='1d3'))
eff('ring-of-djinni-summoning', 'Summon a djinni for up to 1 hour (Concentration); once per 24 hours.', 'Convoquer un djinn jusqu’à 1 heure (Concentration) ; une fois par 24 heures.', 'Invocar un djinn hasta 1 hora (Concentración); una vez cada 24 horas.', textOnly=SUMMON)
AIR, EARTH, FIRE, WATER = T('Air', 'Air', 'Aire'), T('Earth', 'Terre', 'Tierra'), T('Fire', 'Feu', 'Fuego'), T('Water', 'Eau', 'Agua')
eff('ring-of-elemental-command', 'Elemental Bane and Compulsion (DC 18); plane benefits; 5 charges of plane spells (DC 18).', 'Fléau et coercition élémentaires (DD 18) ; bénéfices du plan ; 5 charges de sorts du plan (DD 18).', 'Perdición y Compulsión elementales (CD 18); beneficios del plano; 5 cargas de conjuros del plano (CD 18).',
    choices=[{'kind': 'option', 'name': T('Elemental Plane', 'Plan élémentaire', 'Plano elemental'), 'options': {
        'air': {'name': AIR, 'modifiers': [mod('speed.fly', 'speed')], 'grants': [g('language', value='Auran'), res('lightning')]},
        'earth': {'name': EARTH, 'grants': [g('language', value='Terran'), res('acid')]},
        'fire': {'name': FIRE, 'grants': [g('language', value='Ignan'), g('immunity', 'fire')]},
        'water': {'name': WATER, 'modifiers': [mod('speed.swim', 60)], 'grants': [g('language', value='Aquan')]}}}],
    spellItem=SI([sp('chain-lightning', 3, dc=18, note=AIR), sp('feather-fall', 0, dc=18, note=AIR), sp('gust-of-wind', 2, dc=18, note=AIR), sp('wind-wall', 1, dc=18, note=AIR),
                  sp('earthquake', 5, dc=18, note=EARTH), sp('stone-shape', 2, dc=18, note=EARTH), sp('stoneskin', 3, dc=18, note=EARTH), sp('wall-of-stone', 3, dc=18, note=EARTH),
                  sp('burning-hands', 1, dc=18, note=FIRE), sp('fireball', 2, dc=18, note=FIRE), sp('fire-storm', 4, dc=18, note=FIRE), sp('wall-of-fire', 3, dc=18, note=FIRE),
                  sp('create-or-destroy-water', 1, dc=18, note=WATER), sp('ice-storm', 2, dc=18, note=WATER), sp('tsunami', 5, dc=18, note=WATER), sp('wall-of-ice', 3, dc=18, note=WATER),
                  sp('water-walk', 2, dc=18, note=WATER)], charges=5, recharge='1d4 + 1', note=T('only the spells of the ring’s plane', 'seulement les sorts du plan de l’anneau', 'solo los conjuros del plano del anillo')))
eff('ring-of-evasion', '3 charges: Reaction, turn a failed Dexterity save into a success.', '3 charges : Réaction, transformer un JS de Dextérité raté en réussite.', '3 cargas: reacción, convertir una salvación de Destreza fallida en un éxito.',
    spellItem=SI(charges=3, recharge='1d3', note=T('1 charge: succeed on a failed Dex save', '1 charge : réussir un JS de Dex raté', '1 carga: superar una salvación de Des fallida')))
eff('ring-of-feather-falling', 'You fall 60 ft per round and take no falling damage.', 'Vous tombez de 18 m par round et ne subissez aucun dégât de chute.', 'Caes 18 m por asalto y no recibes daño por caída.', textOnly=GM)
eff('ring-of-free-action', 'Difficult Terrain costs no extra movement; magic can’t slow, paralyze or restrain you.', 'Le terrain difficile ne coûte rien de plus ; la magie ne peut vous ralentir, paralyser ni entraver.', 'El terreno difícil no cuesta movimiento adicional; la magia no puede ralentizarte, paralizarte ni apresarte.',
    grants=[g('immunity', 'paralyzed', condition=T('caused by magic', 'causé par la magie', 'causado por magia')), g('immunity', 'restrained', condition=T('caused by magic', 'causé par la magie', 'causado por magia'))])
eff('ring-of-invisibility', 'Magic action: Invisible until you remove the ring or end it.', 'Action Magie : Invisible jusqu’à ce que vous retiriez l’anneau ou y mettiez fin.', 'Acción de magia: Invisible hasta que te quitas el anillo o lo terminas.', textOnly=ACT)
eff('ring-of-jumping', 'Cast Jump on yourself at will.', 'Lancer Saut sur vous-même à volonté.', 'Lanzar Salto sobre ti a voluntad.', spellItem=SI([sp('jump', atWill=True, note=T('yourself only', 'vous seul', 'solo sobre ti'))]))
eff('ring-of-mind-shielding', 'Your thoughts, lies, alignment and type can’t be read by magic; can hold your soul.', 'Pensées, mensonges, alignement et type indétectables par la magie ; peut abriter votre âme.', 'La magia no puede leer tus pensamientos, mentiras, alineamiento ni tipo; puede albergar tu alma.', textOnly=GM)
eff('ring-of-protection', '+1 to AC and saving throws.', '+1 à la CA et aux jets de sauvegarde.', '+1 a la CA y a las tiradas de salvación.', modifiers=[mod('ac', 1), mod('save.all', 1)])
eff('ring-of-regeneration', 'Regain 1d6 HP every 10 minutes; regrow lost body parts.', 'Récupérer 1d6 PV toutes les 10 minutes ; repousse des membres perdus.', 'Recuperas 1d6 PG cada 10 minutos; regeneras las partes del cuerpo perdidas.',
    textOnly=T('Healing over time outside combat: apply it in the Hit Points block.', 'Soin dans la durée hors combat : appliquez-le dans le bloc Points de vie.', 'Curación con el tiempo fuera de combate: aplícala en el bloque Puntos de golpe.'))
eff('ring-of-resistance', 'Resistance to one damage type, shown by its gemstone.', 'Résistance à un type de dégâts, indiqué par sa gemme.', 'Resistencia a un tipo de daño, indicado por su gema.', choices=damage_choice(TEN))
eff('ring-of-shooting-stars', 'Dancing Lights, Light; 6 charges: Faerie Fire, lightning spheres, shooting stars.', 'Lumières dansantes, Lumière ; 6 charges : Lueurs féeriques, sphères de foudre, étoiles filantes.', 'Luces danzantes, Luz; 6 cargas: Fuego feérico, esferas de rayos, estrellas fugaces.',
    spellItem=SI([sp('dancing-lights', atWill=True), sp('light', atWill=True), sp('faerie-fire', 1)], charges=6, recharge='1d6',
                 note=T('lightning spheres 2 charges, shooting stars 1 to 3 charges (DC 15 Dex)', 'sphères de foudre 2 charges, étoiles filantes 1 à 3 charges (Dex DD 15)', 'esferas de rayos 2 cargas, estrellas fugaces 1 a 3 cargas (Des CD 15)')))
eff('ring-of-spell-storing', 'Stores up to 5 levels of spells cast into it, cast later with the original caster’s DC.', 'Stocke jusqu’à 5 niveaux de sorts, relancés avec le DD du lanceur d’origine.', 'Almacena hasta 5 niveles de conjuros lanzados en él, que se lanzan después con la CD del lanzador original.',
    spellItem=SI(stores=True, note=T('up to 5 levels of spells', 'jusqu’à 5 niveaux de sorts', 'hasta 5 niveles de conjuros')))
eff('ring-of-spell-turning', 'Advantage on saves against spells; level 7 or lower spells you save against have no effect.', 'Avantage aux JS contre les sorts ; les sorts du niveau 7 ou moins réussis n’ont aucun effet.', 'Ventaja en las salvaciones contra conjuros; los conjuros de nivel 7 o inferior contra los que haces una salvación no tienen efecto.',
    grants=[adv('save.spells', T('against spells', 'contre les sorts', 'contra conjuros'))])
eff('ring-of-swimming', 'Swim Speed of 40 ft.', 'Vitesse de nage de 12 m.', 'Velocidad nadando de 12 m.', modifiers=[mod('speed.swim', 40)])
eff('ring-of-telekinesis', 'Cast Telekinesis at will.', 'Lancer Télékinésie à volonté.', 'Lanzar Telequinesis a voluntad.', spellItem=SI([sp('telekinesis', atWill=True)]))
eff('ring-of-the-ram', '3 charges: ranged spell attack +7, 2d10 Force and push 5 ft per charge.', '3 charges : attaque de sort à distance +7, 2d10 force et repousse de 1,50 m par charge.', '3 cargas: ataque de conjuro a distancia +7, 2d10 de fuerza y empujón de 1,5 m por carga.',
    spellItem=SI(charges=3, recharge='1d3', note=T('+7 to hit, 2d10 Force per charge', '+7 au toucher, 2d10 force par charge', '+7 al ataque, 2d10 de fuerza por carga')))
eff('ring-of-three-wishes', '3 charges: cast Wish; nonmagical after the last.', '3 charges : lancer Souhait ; non magique après la dernière.', '3 cargas: lanzar Deseo; deja de ser mágico tras la última.', spellItem=SI([sp('wish', 1)], charges=3))
eff('ring-of-warmth', 'Cold damage reduced by 2d8; unharmed by extreme cold.', 'Dégâts de froid réduits de 2d8 ; insensible au grand froid.', 'Daño de frío reducido en 2d8; el frío extremo no te daña.',
    computed=[{'id': 'cold', 'label': T('Cold damage reduced', 'Dégâts de froid réduits', 'Daño de frío reducido'), 'dice': '2d8'}])
eff('ring-of-water-walking', 'Cast Water Walk on yourself at will.', 'Lancer Marche sur l’onde sur vous-même à volonté.', 'Lanzar Caminar sobre el agua sobre ti a voluntad.', spellItem=SI([sp('water-walk', atWill=True, note=T('yourself only', 'vous seul', 'solo sobre ti'))]))
eff('ring-of-x-ray-vision', 'Magic action: see through solid matter within 30 ft for 1 minute (Exhaustion risk).', 'Action Magie : voir à travers la matière à 9 m pendant 1 minute (risque d’Épuisement).', 'Acción de magia: ver a través de la materia sólida a 9 m durante 1 minuto (riesgo de Cansancio).', textOnly=ACT)
eff('robe-of-eyes', 'Advantage on sight-based Perception; Darkvision and Truesight 120 ft.', 'Avantage en Perception basée sur la vue ; vision dans le noir et vision véritable 36 m.', 'Ventaja en Percepción basada en la vista; visión en la oscuridad y visión verdadera 36 m.',
    grants=[adv('skill.perception', T('relying on sight', 'basés sur la vue', 'que dependan de la vista')), g('darkvision', value=120)])
eff('robe-of-scintillating-colors', '3 charges: dazzling colors, Disadvantage to attack you, DC 15 Wis or Stunned.', '3 charges : couleurs éblouissantes, Désavantage pour vous attaquer, Sag DD 15 ou Étourdi.', '3 cargas: colores deslumbrantes, desventaja para atacarte, Sab CD 15 o Aturdido.',
    spellItem=SI(charges=3, recharge='1d3', note=T('1 charge until the end of your next turn', '1 charge jusqu’à la fin de votre tour suivant', '1 carga hasta el final de tu siguiente turno')))
eff('robe-of-stars', '+1 to saving throws; six stars cast level 5 Magic Missile; step into the Astral Plane.', '+1 aux jets de sauvegarde ; six étoiles lancent Projectile magique du niveau 5 ; passer dans le plan Astral.', '+1 a las tiradas de salvación; seis estrellas lanzan Proyectil mágico de nivel 5; entrar en el plano Astral.',
    modifiers=[mod('save.all', 1)], spellItem=SI([sp('magic-missile', 1, level=5)], charges=6, recharge='1d6', rechargeAt='dusk'))
eff('robe-of-the-archmagi', 'Base AC 15 + Dex without armor, Advantage on saves against magic, +2 spell save DC and spell attacks.', 'CA de base 15 + Dex sans armure, Avantage aux JS contre la magie, +2 au DD et à l’attaque des sorts.', 'CA base 15 + Des sin armadura, ventaja en las salvaciones contra la magia, +2 a la CD de salvación de conjuros y a los ataques de conjuro.',
    acFormula={'base': 15, 'abilities': ['dex'], 'noArmor': True, 'noShield': False},
    modifiers=[mod('spell.dc', 2), mod('attack.spell', 2)], grants=[adv('save.magic', T('against spells and magical effects', 'contre les sorts et effets magiques', 'contra conjuros y efectos mágicos'))])
eff('robe-of-useful-items', 'Detach a patch: it becomes the object it shows.', 'Détacher une pièce : elle devient l’objet représenté.', 'Arrancar un parche: se convierte en el objeto que muestra.', textOnly=ONE)
eff('rod-of-absorption', 'Reaction: absorb a spell targeting only you; turn stored levels into spell slots.', 'Réaction : absorber un sort qui ne cible que vous ; convertir les niveaux en emplacements.', 'Reacción: absorber un conjuro que solo te tenga a ti como objetivo; convertir los niveles almacenados en espacios de conjuro.', textOnly=ACT)
eff('rod-of-alertness', 'Advantage on Perception and Initiative; detection spells; protective aura once per dawn.', 'Avantage en Perception et à l’Initiative ; sorts de détection ; aura protectrice une fois par aube.', 'Ventaja en Percepción e iniciativa; conjuros de detección; aura protectora una vez por amanecer.',
    grants=[adv('skill.perception'), adv('initiative')],
    spellItem=SI([sp('detect-evil-and-good', atWill=True), sp('detect-magic', atWill=True), sp('detect-poison-and-disease', atWill=True), sp('see-invisibility', atWill=True)]))
eff('rod-of-lordly-might', 'A +3 Mace; buttons turn it into other weapons, a ladder, a ram; drain, paralyze, terrify once per dawn.', 'Une masse d’armes +3 ; des boutons la changent en armes, échelle, bélier ; drain, paralysie, terreur une fois par aube.', 'Una maza +3; sus botones la convierten en otras armas, una escalera, un ariete; drenar, paralizar, aterrorizar una vez por amanecer.',
    modifiers=bonus(3))
eff('rod-of-resurrection', '5 charges: Heal (1) or Resurrection (5).', '5 charges : Guérison (1) ou Résurrection (5).', '5 cargas: Curar (1) o Resurrección (5).', spellItem=SI([sp('heal', 1), sp('resurrection', 5)], charges=5, recharge='1'))
eff('rod-of-rulership', 'Magic action: creatures within 120 ft, DC 15 Wis or Charmed 8 hours; once per dawn.', 'Action Magie : créatures à 36 m, Sag DD 15 ou Charmées 8 heures ; une fois par aube.', 'Acción de magia: criaturas a 36 m o menos, Sab CD 15 o Hechizadas 8 horas; una vez por amanecer.', textOnly=ACT)
eff('rod-of-security', 'Transport you and up to 199 creatures to a paradise demiplane; once per 10 days.', 'Transporte vous et jusqu’à 199 créatures dans un demi-plan paradisiaque ; une fois par 10 jours.', 'Transportarte a ti y hasta 199 criaturas a un semiplano paradisíaco; una vez cada 10 días.', textOnly=ACT)
eff('rope-of-climbing', '60-ft rope that moves, knots and fastens on command.', 'Corde de 18 m qui se déplace, se noue et s’attache sur ordre.', 'Cuerda de 18 m que se mueve, se anuda y se ata cuando se le ordena.', textOnly=ACT)
eff('rope-of-entanglement', 'Magic action: entangle a creature within 20 ft (DC 15 Dex or Restrained).', 'Action Magie : enchevêtrer une créature à 6 m (Dex DD 15 ou Entravée).', 'Acción de magia: enredar a una criatura a 6 m o menos (Des CD 15 o Apresado).', textOnly=ACT)
# ======================================================================== S
eff('scarab-of-protection', '+1 AC, Advantage on saves against spells; 12 charges to succeed against necromancy and Undead.', '+1 à la CA, Avantage aux JS contre les sorts ; 12 charges pour réussir contre la nécromancie et les morts-vivants.', '+1 a la CA, ventaja en las salvaciones contra conjuros; 12 cargas para superar las de nigromancia y muertos vivientes.',
    activeWhen='on-person', modifiers=[mod('ac', 1)], grants=[adv('save.spells', T('against spells', 'contre les sorts', 'contra conjuros'))],
    spellItem=SI(charges=12, note=T('Reaction, 1 charge: succeed on a failed save against a Necromancy spell or an Undead', 'Réaction, 1 charge : réussir un JS raté contre un sort de nécromancie ou un mort-vivant', 'reacción, 1 carga: superar una salvación fallida contra un conjuro de nigromancia o un muerto viviente')))
eff('scimitar-of-speed', '+2 attack and damage; one attack with it as a Bonus Action each turn.', '+2 à l’attaque et aux dégâts ; une attaque avec en action Bonus à chaque tour.', '+2 al ataque y al daño; un ataque con ella como acción adicional cada turno.', modifiers=bonus(2))
eff('sending-stones', 'Cast Sending to the bearer of the paired stone, once per dawn.', 'Lancer Communication à distance vers le porteur de la pierre jumelle, une fois par aube.', 'Lanzar Recado al portador de la piedra emparejada, una vez por amanecer.', spellItem=SI([sp('sending', perDay=1)]))
eff('sentinel-shield', 'Advantage on Initiative and Perception checks.', 'Avantage à l’Initiative et aux tests de Perception.', 'Ventaja en las pruebas de iniciativa y de Percepción.', grants=[adv('initiative'), adv('skill.perception')])
eff('shield-1-2-or-3', '+1/+2/+3 AC on top of the Shield’s normal bonus.', '+1/+2/+3 à la CA en plus du bonus normal du bouclier.', '+1/+2/+3 a la CA además del bonificador normal del escudo.', modifiers=[mod('ac', byVariant=[1, 2, 3])])
eff('shield-of-missile-attraction', 'Resistance to damage from Ranged weapons; cursed: ranged attacks nearby target you.', 'Résistance aux dégâts des armes à distance ; maudit : les attaques à distance proches vous ciblent.', 'Resistencia al daño de armas a distancia; maldito: los ataques a distancia cercanos te tienen como objetivo.',
    textOnly=T('Resistance to ranged weapon attacks (not a damage type) and a curse: applied at the table.', 'Résistance aux attaques d’armes à distance (pas un type de dégâts) et malédiction : en jeu.', 'Resistencia a los ataques con armas a distancia (no es un tipo de daño) y una maldición: se aplica en la mesa.'))
eff('shield-of-the-cavalier', '+2 AC on top of the Shield; Forceful Bash (2d6 + 2 + Str Force) and Protective Field.', '+2 à la CA en plus du bouclier ; coup de bouclier (2d6 + 2 + For force) et champ protecteur.', '+2 a la CA además del escudo; Golpe contundente (2d6 + 2 + Fue de fuerza) y Campo protector.',
    modifiers=[mod('ac', 2)], computed=[{'id': 'bash', 'label': T('Forceful Bash damage (Force)', 'Coup de bouclier (force)', 'Golpe contundente (fuerza)'), 'dice': '2d6', 'parts': [2, 'str']}])
eff('slippers-of-spider-climbing', 'Climb Speed equal to Speed, on walls and ceilings, hands free.', 'Escalade égale à la Vitesse, sur murs et plafonds, mains libres.', 'Velocidad trepando igual a tu velocidad, por paredes y techos, con las manos libres.', modifiers=[mod('speed.climb', 'speed')])
eff('sovereign-glue', 'Bonds any two objects permanently.', 'Colle définitivement deux objets.', 'Une dos objetos cualesquiera de forma permanente.', textOnly=ONE)
eff('spell-scroll', 'Cast its spell if it’s on your list; DC and attack set by the spell’s level.', 'Lancer son sort s’il est dans votre liste ; DD et attaque selon le niveau du sort.', 'Lanzar su conjuro si está en tu lista; la CD y el ataque dependen del nivel del conjuro.',
    spellItem=SI(scroll=True, **POTION, note=T('higher than you can cast: spellcasting check DC 10 + level', 'niveau trop élevé : test d’incantation DD 10 + niveau', 'de nivel superior al que puedes lanzar: prueba de aptitud mágica CD 10 + nivel')))
eff('spellguard-shield', 'Advantage on saves against magic; spell attacks against you have Disadvantage.', 'Avantage aux JS contre la magie ; les attaques de sort contre vous ont le Désavantage.', 'Ventaja en las salvaciones contra la magia; los ataques de conjuro contra ti tienen desventaja.',
    grants=[adv('save.magic', T('against spells and magical effects', 'contre les sorts et effets magiques', 'contra conjuros y efectos mágicos')),
            g('disadvantage', 'attacks-against', condition=T('spell attacks', 'attaques de sort', 'ataques de conjuro'))])
eff('sphere-of-annihilation', 'A hole in the multiverse: control it with DC 25 Arcana; 8d10 Force on contact.', 'Un trou dans le multivers : contrôle par Arcanes DD 25 ; 8d10 force au contact.', 'Un agujero en el multiverso: controlarla con Conocimiento Arcano CD 25; 8d10 de fuerza al contacto.', textOnly=GM)
eff('staff-of-charming', '10 charges: Charm Person, Command, Comprehend Languages; reflect and resist enchantments.', '10 charges : Charme-personne, Injonction, Compréhension des langues ; renvoie et résiste aux enchantements.', '10 cargas: Hechizar persona, Orden imperiosa, Entender idiomas; reflejar y resistir los encantamientos.',
    spellItem=SI([sp('charm-person', 1), sp('command', 1), sp('comprehend-languages', 1)], charges=10, recharge='1d8 + 2', wielderDc=True))
eff('staff-of-fire', 'Fire Resistance; 10 charges: Burning Hands, Fireball, Wall of Fire.', 'Résistance au feu ; 10 charges : Mains brûlantes, Boule de feu, Mur de feu.', 'Resistencia al fuego; 10 cargas: Manos ardientes, Bola de fuego, Muro de fuego.',
    grants=[res('fire')], spellItem=SI([sp('burning-hands', 1), sp('fireball', 3), sp('wall-of-fire', 4)], charges=10, recharge='1d6 + 4', wielderDc=True))
eff('staff-of-frost', 'Cold Resistance; 10 charges: Cone of Cold, Fog Cloud, Ice Storm, Wall of Ice.', 'Résistance au froid ; 10 charges : Cône de froid, Nappe de brouillard, Tempête de grêle, Mur de glace.', 'Resistencia al frío; 10 cargas: Cono de frío, Nube de oscurecimiento, Tormenta de hielo, Muro de hielo.',
    grants=[res('cold')], spellItem=SI([sp('cone-of-cold', 5), sp('fog-cloud', 1), sp('ice-storm', 4), sp('wall-of-ice', 4)], charges=10, recharge='1d6 + 4', wielderDc=True))
eff('staff-of-healing', '10 charges: Cure Wounds (1 per level), Lesser Restoration, Mass Cure Wounds.', '10 charges : Soins (1 par niveau), Restauration partielle, Soins de groupe.', '10 cargas: Curar heridas (1 por nivel), Restablecimiento menor, Curar heridas en masa.',
    spellItem=SI([sp('cure-wounds', 'level', level=1, maxLevel=4), sp('lesser-restoration', 2), sp('mass-cure-wounds', 5)], charges=10, recharge='1d6 + 4', wielderDc=True,
                 note=T('uses your spellcasting ability modifier', 'utilise votre modificateur de caractéristique d’incantation', 'usa tu modificador de aptitud mágica')))
eff('staff-of-power', 'A +2 Quarterstaff; +2 AC, saves and spell attacks; 20 charges of spells; Retributive Strike.', 'Un bâton +2 ; +2 à la CA, aux JS et aux attaques de sort ; 20 charges de sorts ; frappe vengeresse.', 'Un bastón +2; +2 a la CA, a las salvaciones y a los ataques de conjuro; 20 cargas de conjuros; Golpe vengador.',
    modifiers=bonus(2) + [mod('ac', 2), mod('save.all', 2), mod('attack.spell', 2)],
    spellItem=SI([sp('cone-of-cold', 5), sp('fireball', 5, level=5), sp('globe-of-invulnerability', 6), sp('hold-monster', 5), sp('levitate', 2),
                  sp('lightning-bolt', 5, level=5), sp('magic-missile', 1), sp('ray-of-enfeeblement', 1), sp('wall-of-force', 5)], charges=20, recharge='2d8 + 4', wielderDc=True))
eff('staff-of-striking', 'A +3 Quarterstaff; spend up to 3 charges on a hit for 1d6 Force each.', 'Un bâton +3 ; dépenser jusqu’à 3 charges au toucher pour 1d6 force chacune.', 'Un bastón +3; gasta hasta 3 cargas al impactar para 1d6 de fuerza cada una.',
    modifiers=bonus(3), spellItem=SI(charges=10, recharge='1d6 + 4', note=T('on a hit: up to 3 charges, +1d6 Force each', 'au toucher : jusqu’à 3 charges, +1d6 force chacune', 'al impactar: hasta 3 cargas, +1d6 de fuerza cada una')))
eff('staff-of-swarming-insects', '10 charges: insect cloud, Giant Insect, Insect Plague.', '10 charges : nuée d’insectes, Insecte géant, Fléau d’insectes.', '10 cargas: nube de insectos, Insecto gigante, Plaga de insectos.',
    spellItem=SI([sp('giant-insect', 4), sp('insect-plague', 5)], charges=10, recharge='1d6 + 4', wielderDc=True,
                 note=T('insect cloud: 1 charge, 30-ft Heavily Obscured for 10 minutes', 'nuée d’insectes : 1 charge, visibilité nulle sur 9 m pendant 10 minutes', 'nube de insectos: 1 carga, zona muy oscura de 9 m durante 10 minutos')))
eff('staff-of-the-magi', 'A +2 Quarterstaff; +2 spell attacks, Advantage on saves against spells; 50 charges of spells.', 'Un bâton +2 ; +2 aux attaques de sort, Avantage aux JS contre les sorts ; 50 charges de sorts.', 'Un bastón +2; +2 a los ataques de conjuro, ventaja en las salvaciones contra conjuros; 50 cargas de conjuros.',
    modifiers=bonus(2) + [mod('attack.spell', 2)], grants=[adv('save.spells', T('against spells', 'contre les sorts', 'contra conjuros'))],
    spellItem=SI([sp('arcane-lock', 0), sp('conjure-elemental', 7), sp('detect-magic', 0), sp('dispel-magic', 3), sp('enlarge-reduce', 0), sp('fireball', 7, level=7),
                  sp('flaming-sphere', 2), sp('ice-storm', 4), sp('invisibility', 2), sp('knock', 2), sp('light', 0), sp('lightning-bolt', 7, level=7), sp('mage-hand', 0),
                  sp('passwall', 5), sp('plane-shift', 7), sp('protection-from-evil-and-good', 0), sp('telekinesis', 5), sp('wall-of-fire', 4), sp('web', 2)],
                 charges=50, recharge='4d6 + 2', wielderDc=True))
eff('staff-of-the-python', 'Throw it: becomes a Giant Constrictor Snake under your control.', 'Le lancer : devient un serpent constricteur géant sous vos ordres.', 'Lanzarlo: se convierte en una serpiente constrictora gigante bajo tu control.', textOnly=SUMMON)
eff('staff-of-the-woodlands', 'A +2 Quarterstaff; +2 spell attacks; 6 charges of nature spells; Tree Form.', 'Un bâton +2 ; +2 aux attaques de sort ; 6 charges de sorts de la nature ; forme d’arbre.', 'Un bastón +2; +2 a los ataques de conjuro; 6 cargas de conjuros de la naturaleza; Forma de árbol.',
    modifiers=bonus(2) + [mod('attack.spell', 2)],
    spellItem=SI([sp('animal-friendship', 1), sp('awaken', 5), sp('barkskin', 2), sp('locate-animals-or-plants', 2), sp('pass-without-trace', 2),
                  sp('speak-with-animals', 1), sp('speak-with-plants', 3), sp('wall-of-thorns', 6)], charges=6, recharge='1d6', wielderDc=True))
eff('staff-of-thunder-and-lightning', 'A +2 Quarterstaff; Lightning, Thunder, Lightning Strike, Thunderclap once per dawn each (DC 17).', 'Un bâton +2 ; Foudre, Tonnerre, Éclair, Coup de tonnerre une fois par aube chacun (DD 17).', 'Un bastón +2; Relámpago, Trueno, Golpe relampagueante, Golpe atronador una vez por amanecer cada uno (CD 17).', modifiers=bonus(2))
eff('staff-of-withering', 'A magic Quarterstaff; 3 charges: extra 2d10 Necrotic and DC 15 Con or Disadvantage on Str and Con.', 'Un bâton magique ; 3 charges : 2d10 nécrotiques en plus et Con DD 15 ou Désavantage en For et Con.', 'Un bastón mágico; 3 cargas: 2d10 necrótico adicional y Con CD 15 o desventaja en Fue y Con.',
    spellItem=SI(charges=3, recharge='1d3', note=T('on a hit, 1 charge: +2d10 Necrotic, DC 15 Con', 'au toucher, 1 charge : +2d10 nécrotiques, Con DD 15', 'al impactar, 1 carga: +2d10 necrótico, Con CD 15')))
eff('stone-of-controlling-earth-elementals', 'Magic action: summon an Earth Elemental for 1 hour, once per dawn.', 'Action Magie : convoquer un élémentaire de la terre 1 heure, une fois par aube.', 'Acción de magia: invocar un elemental de tierra durante 1 hora, una vez por amanecer.', textOnly=SUMMON)
eff('stone-of-good-luck-luckstone', '+1 to ability checks and saving throws while on you.', '+1 aux tests de caractéristique et aux jets de sauvegarde tant que vous l’avez.', '+1 a las pruebas de característica y a las tiradas de salvación mientras la lleves.',
    activeWhen='on-person', modifiers=[mod('check.all', 1), mod('save.all', 1)])
eff('sun-blade', 'A Finesse Longsword of radiance: +2 attack and damage, Radiant, extra 1d8 vs Undead; sunlight.', 'Une épée longue de finesse radieuse : +2 à l’attaque et aux dégâts, radiants, 1d8 en plus contre les morts-vivants ; lumière du soleil.', 'Una espada larga sutil de resplandor: +2 al ataque y al daño, radiante, 1d8 adicional contra muertos vivientes; luz solar.',
    modifiers=bonus(2) + [dice('1d8', T('target is an Undead: Radiant', 'cible mort-vivant : radiants', 'objetivo muerto viviente: radiante'))])
eff('sword-of-life-stealing', 'On a 20: extra 15 Necrotic and as many Temporary Hit Points.', 'Sur un 20 : 15 nécrotiques en plus et autant de points de vie temporaires.', 'Con un 20: 15 necrótico adicional y otros tantos puntos de golpe temporales.', textOnly=NAT20)
eff('sword-of-sharpness', 'Maximum damage against objects; on a 20: extra 14 Slashing and 1 Exhaustion level.', 'Dégâts maximaux contre les objets ; sur un 20 : 14 tranchants en plus et 1 niveau d’Épuisement.', 'Daño máximo contra objetos; con un 20: 14 cortante adicional y 1 nivel de Cansancio.', textOnly=NAT20)
eff('sword-of-wounding', 'Extra 2d6 Necrotic on a hit; DC 15 Con or no healing for 1 hour.', '2d6 nécrotiques en plus au toucher ; Con DD 15 ou aucun soin pendant 1 heure.', '2d6 necrótico adicional al impactar; Con CD 15 o sin curación durante 1 hora.',
    modifiers=[dice('2d6', T('Necrotic', 'nécrotiques', 'necrótico'))])
# ======================================================================== T
eff('talisman-of-pure-good', 'Holy Symbol, +2 spell attacks; 7 charges of Pure Rebuke (DC 20 Dex or destroyed).', 'Symbole sacré, +2 aux attaques de sort ; 7 charges de châtiment pur (Dex DD 20 ou détruit).', 'Símbolo sagrado, +2 a los ataques de conjuro; 7 cargas de Represalia pura (Des CD 20 o destruido).',
    modifiers=[mod('attack.spell', 2)], spellItem=SI(charges=7, note=T('1 charge: DC 20 Dex or destroyed, else 4d6 Psychic', '1 charge : Dex DD 20 ou détruit, sinon 4d6 psychiques', '1 carga: Des CD 20 o destruido; si no, 4d6 psíquico')))
eff('talisman-of-the-sphere', 'Advantage on Arcana checks to control a Sphere of Annihilation; move it farther.', 'Avantage aux tests d’Arcanes pour contrôler une sphère d’annihilation ; la déplacer plus loin.', 'Ventaja en las pruebas de Conocimiento Arcano para controlar una esfera de aniquilación; moverla más lejos.',
    grants=[adv('skill.arcana', T('to control a Sphere of Annihilation', 'pour contrôler une sphère d’annihilation', 'para controlar una esfera de aniquilación'))])
eff('talisman-of-ultimate-evil', 'Holy Symbol, +2 spell attacks; 6 charges of Ultimate End (DC 20 Dex or destroyed).', 'Symbole sacré, +2 aux attaques de sort ; 6 charges de fin ultime (Dex DD 20 ou détruit).', 'Símbolo sagrado, +2 a los ataques de conjuro; 6 cargas de Final definitivo (Des CD 20 o destruido).',
    modifiers=[mod('attack.spell', 2)], spellItem=SI(charges=6, note=T('1 charge: DC 20 Dex or destroyed, else 4d6 Psychic', '1 charge : Dex DD 20 ou détruit, sinon 4d6 psychiques', '1 carga: Des CD 20 o destruido; si no, 4d6 psíquico')))
eff('thunderous-greatclub', 'Strength 20 while attuned; extra 1d8 Thunder; Clap of Thunder and Earthquake.', 'Force 20 tant qu’harmonisé ; 1d8 tonnerre en plus ; coup de tonnerre et séisme.', 'Fuerza 20 mientras estés sintonizado; 1d8 de trueno adicional; Estallido de trueno y Terremoto.',
    activeWhen='attuned', modifiers=[mod('ability.str.set', 20), dice('1d8', T('Thunder', 'tonnerre', 'trueno'))])
eff('tome-of-clear-thought', 'Study 48 hours: Intelligence +2 (max 30).', 'Étude de 48 heures : Intelligence +2 (max 30).', 'Estudio de 48 horas: Inteligencia +2 (máx. 30).', textOnly=PERM)
eff('tome-of-leadership-and-influence', 'Study 48 hours: Charisma +2 (max 30).', 'Étude de 48 heures : Charisme +2 (max 30).', 'Estudio de 48 horas: Carisma +2 (máx. 30).', textOnly=PERM)
eff('tome-of-understanding', 'Study 48 hours: Wisdom +2 (max 30).', 'Étude de 48 heures : Sagesse +2 (max 30).', 'Estudio de 48 horas: Sabiduría +2 (máx. 30).', textOnly=PERM)
eff('trident-of-fish-command', '3 charges: cast Dominate Beast (DC 15) on a Beast with a Swim Speed.', '3 charges : lancer Domination de bête (DD 15) sur une bête qui nage.', '3 cargas: lanzar Dominar bestia (CD 15) sobre una bestia con velocidad nadando.',
    spellItem=SI([sp('dominate-beast', 1, dc=15, note=T('a Beast with a Swim Speed', 'une bête dotée d’une Vitesse de nage', 'una bestia con velocidad nadando'))], charges=3, recharge='1d3'))
# ======================================================================== U-W
eff('universal-solvent', 'Dissolves any adhesive, Sovereign Glue included.', 'Dissout tout adhésif, colle universelle comprise.', 'Disuelve cualquier adhesivo, incluido el pegamento soberano.', textOnly=ONE)
eff('vicious-weapon', 'Extra 2d6 damage of the weapon’s type on a hit.', '2d6 dégâts du type de l’arme en plus au toucher.', '2d6 de daño adicional del tipo del arma al impactar.', modifiers=[dice('2d6', T('weapon’s type', 'type de l’arme', 'tipo del arma'))])
eff('vorpal-sword', '+3 attack and damage, ignores Slashing Resistance; on a 20 cuts off a head.', '+3 à l’attaque et aux dégâts, ignore la Résistance aux tranchants ; sur un 20 tranche une tête.', '+3 al ataque y al daño, ignora la resistencia a cortante; con un 20 corta una cabeza.', modifiers=bonus(3))
eff('wand-of-binding', '7 charges: Hold Monster (5) or Hold Person (2), DC 17.', '7 charges : Immobilisation de monstre (5) ou de personne (2), DD 17.', '7 cargas: Inmovilizar monstruo (5) o Inmovilizar persona (2), CD 17.',
    spellItem=SI([sp('hold-monster', 5, dc=17), sp('hold-person', 2, dc=17)], charges=7, recharge='1d6 + 1'))
eff('wand-of-enemy-detection', '7 charges: sense the direction of the nearest Hostile creature for 1 minute.', '7 charges : sentir la direction de la créature hostile la plus proche pendant 1 minute.', '7 cargas: percibir la dirección de la criatura hostil más cercana durante 1 minuto.',
    spellItem=SI(charges=7, recharge='1d6 + 1', note=T('1 charge: 1 minute, 60 ft', '1 charge : 1 minute, 18 m', '1 carga: 1 minuto, 18 m')))
eff('wand-of-fear', '7 charges: Command (flee or grovel, 1) or Fear (3), DC 15.', '7 charges : Injonction (fuir ou ramper, 1) ou Terreur (3), DD 15.', '7 cargas: Orden imperiosa (huir o arrastrarse, 1) o Terror (3), CD 15.',
    spellItem=SI([sp('command', 1, dc=15, note=T('“flee” or “grovel” only', '« fuis » ou « rampe » seulement', 'solo «huye» o «arrástrate»')), sp('fear', 3, dc=15, note=T('60-ft Cone', 'cône de 18 m', 'cono de 18 m'))], charges=7, recharge='1d6 + 1'))
eff('wand-of-fireballs', '7 charges: Fireball (DC 15), level 3 for 1 charge, +1 level per extra charge (max 3).', '7 charges : Boule de feu (DD 15), niveau 3 pour 1 charge, +1 niveau par charge (max 3).', '7 cargas: Bola de fuego (CD 15), nivel 3 por 1 carga, +1 nivel por carga adicional (máx. 3).',
    spellItem=SI([sp('fireball', 1, level=3, maxLevel=5, dc=15)], charges=7, recharge='1d6 + 1'))
eff('wand-of-lightning-bolts', '7 charges: Lightning Bolt (DC 15), level 3 for 1 charge, +1 level per extra charge (max 3).', '7 charges : Éclair (DD 15), niveau 3 pour 1 charge, +1 niveau par charge (max 3).', '7 cargas: Relámpago (CD 15), nivel 3 por 1 carga, +1 nivel por carga adicional (máx. 3).',
    spellItem=SI([sp('lightning-bolt', 1, level=3, maxLevel=5, dc=15)], charges=7, recharge='1d6 + 1'))
eff('wand-of-magic-detection', '3 charges: cast Detect Magic.', '3 charges : lancer Détection de la magie.', '3 cargas: lanzar Detectar magia.', spellItem=SI([sp('detect-magic', 1)], charges=3, recharge='1d3'))
eff('wand-of-magic-missiles', '7 charges: Magic Missile, level 1 for 1 charge, +1 level per extra charge (max 3).', '7 charges : Projectile magique, niveau 1 pour 1 charge, +1 niveau par charge (max 3).', '7 cargas: Proyectil mágico, nivel 1 por 1 carga, +1 nivel por carga adicional (máx. 3).',
    spellItem=SI([sp('magic-missile', 1, level=1, maxLevel=3)], charges=7, recharge='1d6 + 1'))
eff('wand-of-paralysis', '7 charges: a ray, DC 15 Con or Paralyzed for 1 minute.', '7 charges : un rayon, Con DD 15 ou Paralysé pendant 1 minute.', '7 cargas: un rayo, Con CD 15 o Paralizado durante 1 minuto.',
    spellItem=SI(charges=7, recharge='1d6 + 1', note=T('1 charge: 60 ft, DC 15 Con or Paralyzed', '1 charge : 18 m, Con DD 15 ou Paralysé', '1 carga: 18 m, Con CD 15 o Paralizado')))
eff('wand-of-polymorph', '7 charges: cast Polymorph (DC 15).', '7 charges : lancer Métamorphose (DD 15).', '7 cargas: lanzar Polimorfar (CD 15).', spellItem=SI([sp('polymorph', 1, dc=15)], charges=7, recharge='1d6 + 1'))
eff('wand-of-secrets', '3 charges: points to the nearest secret door or trap within 60 ft.', '3 charges : désigne la porte secrète ou le piège le plus proche à 18 m.', '3 cargas: señala la puerta secreta o la trampa más cercana a 18 m o menos.',
    spellItem=SI(charges=3, recharge='1d3', note=T('1 charge: 60 ft', '1 charge : 18 m', '1 carga: 18 m')))
eff('wand-of-the-war-mage-1-2-or-3', '+1/+2/+3 to spell attack rolls; ignore Half Cover with spell attacks.', '+1/+2/+3 aux jets d’attaque de sort ; ignore l’abri partiel.', '+1/+2/+3 a las tiradas de ataque de conjuro; ignora la cobertura media con los ataques de conjuro.', modifiers=[mod('attack.spell', byVariant=[1, 2, 3])])
eff('wand-of-web', '7 charges: cast Web (DC 13).', '7 charges : lancer Toile d’araignée (DD 13).', '7 cargas: lanzar Telaraña (CD 13).', spellItem=SI([sp('web', 1, dc=13)], charges=7, recharge='1d6 + 1'))
eff('wand-of-wonder', '7 charges: a random magical effect (spells DC 15).', '7 charges : un effet magique aléatoire (sorts DD 15).', '7 cargas: un efecto mágico aleatorio (conjuros CD 15).',
    spellItem=SI(charges=7, recharge='1d6 + 1', note=T('1 charge: roll on the Wand of Wonder Effects table', '1 charge : jet sur la table des effets de la baguette', '1 carga: tirada en la tabla de efectos de la varita de las maravillas')))
eff('weapon-1-2-or-3', '+1/+2/+3 to attack and damage rolls with this weapon.', '+1/+2/+3 aux jets d’attaque et de dégâts avec cette arme.', '+1/+2/+3 a las tiradas de ataque y de daño con esta arma.', modifiers=bonus(byVariant=[1, 2, 3]))
eff('weapon-of-warning', 'You and allies within 30 ft: Advantage on Initiative; woken when combat starts.', 'Vous et vos alliés à 9 m : Avantage à l’Initiative ; réveillés au début du combat.', 'Tú y tus aliados a 9 m o menos: ventaja en la iniciativa; os despierta al empezar el combate.',
    activeWhen='attuned', grants=[adv('initiative')])
eff('well-of-many-worlds', 'Unfolds into a two-way portal to another world.', 'Se déplie en un portail à double sens vers un autre monde.', 'Se despliega en un portal de doble sentido hacia otro mundo.', textOnly=GM)
eff('wind-fan', 'Cast Gust of Wind (DC 13); each extra use before dawn risks tearing it (20% cumulative).', 'Lancer Bourrasque (DD 13) ; chaque usage de plus avant l’aube risque de le déchirer (20 % cumulatif).', 'Lanzar Ráfaga de viento (CD 13); cada uso adicional antes del amanecer puede rasgarlo (20 % acumulativo).',
    spellItem=SI([sp('gust-of-wind', atWill=True, dc=13, note=T('20% cumulative failure after the first use per dawn', '20 % d’échec cumulatif après le premier usage par aube', '20 % de fallo acumulativo tras el primer uso por amanecer'))]))
eff('winged-boots', '4 charges: Fly Speed 30 ft for 1 hour per charge.', '4 charges : vol 9 m pendant 1 heure par charge.', '4 cargas: velocidad volando 9 m durante 1 hora por carga.',
    modifiers=[mod('speed.fly', 30, when='toggle:winged-boots', condition=T('a charge spent (1 hour)', 'une charge dépensée (1 heure)', 'una carga gastada (1 hora)'))],
    spellItem=SI(charges=4, recharge='1d4', note=T('1 charge: Fly Speed 30 ft for 1 hour', '1 charge : vol 9 m pendant 1 heure', '1 carga: velocidad volando 9 m durante 1 hora')))
eff('wings-of-flying', 'Magic action: wings for 1 hour, Fly Speed 60 ft; 1d12 hours to recover.', 'Action Magie : des ailes pendant 1 heure, vol 18 m ; 1d12 heures de repos.', 'Acción de magia: alas durante 1 hora, velocidad volando 18 m; 1d12 horas para recuperarse.',
    modifiers=[mod('speed.fly', 60, when='toggle:wings-of-flying', condition=T('wings spread (1 hour)', 'ailes déployées (1 heure)', 'alas desplegadas (1 hora)'))])

missing = [k for k in items if k not in E]
if missing:
    print('MISSING', missing)
    sys.exit(1)
for e in E.values():
    for m in e.get('modifiers', []):
        if m['target'].startswith('skill.'):
            assert m['target'][6:] in skills, m
    for x in e.get('grants', []):
        if (x.get('on') or '').startswith('skill.'):
            assert x['on'][6:] in skills, x

# How each item is used during a turn (Combat pane "Your turn", engine/turn.ts), read from its English text: "As a Magic
# action" / "take a Magic action", "As a Bonus Action", "take a Reaction" (SRD p. 206 "Activating a Magic Item": usually a
# Magic action). Potions are left out: drinking one is a Bonus Action for every potion (p. 204), handled by the box.
# Spells cast from an item take the spell's own casting time (p. 206) and stay in the spell-items block.
import re as _re
_KINDS = [
    ('action', _re.compile(r'\b(as|take|takes|taking|use|requires) (a|the) Magic action|\bMagic action to\b', _re.I)),
    ('bonus-action', _re.compile(r'\bBonus Action\b')),
    ('reaction', _re.compile(r'\b(take|use|as) a Reaction\b', _re.I)),
]
# Texts that name a part of the turn without giving anything to take (the Berserker Axe's curse makes you attack).
NO_ACTIVATION = {'berserker-axe'}
for k, e in E.items():
    if k in NO_ACTIVATION:
        e['activation'] = []
        continue
    if 'activation' in e or items[k]['kind'] == 'potion':
        continue
    text = _re.sub(r'<[^>]+>', ' ', items[k]['text']['en'])
    acts = []
    for kind, rx in _KINDS:
        if rx.search(text):
            acts.append({'kind': kind, 'action': 'magic'} if kind == 'action' else {'kind': kind})
    if acts:
        e['activation'] = acts

out = [E[k] for k in sorted(E)]
json.dump(out, open(os.path.join(ROOT, 'src/data/custom/effects/magic-items.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
summ = {k: S[k] for k in sorted(S)}
json.dump(summ, open(os.path.join(ROOT, 'src/data/custom/summaries-items.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
n_text = sum(1 for e in E.values() if 'textOnly' in e)
n_spell = sum(1 for e in E.values() if 'spellItem' in e)
n_act = sum(1 for e in E.values() if e.get('activation'))
print('items', len(E), 'textOnly', n_text, 'with effects', len(E) - n_text, 'spellItem', n_spell, 'activation', n_act)
