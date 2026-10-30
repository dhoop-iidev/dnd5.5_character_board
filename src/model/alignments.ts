// The nine alignments (SRD 5.2.1 p. 21 "Step 4: Alignment", FR p. 23, ES p. 24; CC-BY-4.0 text): names, abbreviations
// and descriptions in the three languages, laid out as the 3 x 3 grid of the Builder (ui/AlignmentGrid.svelte): rows
// good, neutral, evil; columns lawful, neutral, chaotic. `identity.alignment` stores the id, or free text from an older
// save, matched to the table in any of the three languages.
import type { I18n, Source } from '../data/types'

export interface AlignmentDef {
  id: string
  name: I18n
  abbr: I18n
  text: I18n
}

export const SRC_ALIGNMENT: Source = {
  page: 21,
  frPage: 23,
  esPage: 24,
  section: 'Character Creation > Step 4: Alignment',
}

export const ALIGNMENTS: AlignmentDef[] = [
  {
    id: 'lawful-good',
    name: { en: 'Lawful Good', fr: 'Loyal Bon', es: 'Legal bueno' },
    abbr: { en: 'LG', fr: 'LB', es: 'LB' },
    text: {
      en: 'Lawful Good creatures endeavor to do the right thing as expected by society. Someone who fights injustice and protects the innocent without hesitation is probably Lawful Good.',
      fr: 'Les créatures Loyales Bonnes s’efforcent de faire le bien selon les attentes de la société. Une personne qui combat l’injustice et protège les innocents sans hésiter sera probablement Loyale Bonne.',
      es: 'Las criaturas legales buenas se esfuerzan por hacer lo correcto según lo que espera la sociedad. Alguien que luche contra la injusticia y proteja a los inocentes sin vacilar probablemente sea legal bueno.',
    },
  },
  {
    id: 'neutral-good',
    name: { en: 'Neutral Good', fr: 'Neutre Bon', es: 'Neutral bueno' },
    abbr: { en: 'NG', fr: 'NB', es: 'NB' },
    text: {
      en: 'Neutral Good creatures do the best they can, working within rules but not feeling bound by them. A kindly person who helps others according to their needs is probably Neutral Good.',
      fr: 'Les créatures Neutres Bonnes font de leur mieux en s’adaptant aux règles, sans pour autant s’y contraindre strictement. Une personne bienveillante qui aide les autres selon leurs besoins sera probablement Neutre Bonne.',
      es: 'Los personajes neutrales buenos hacen lo que pueden respetando las reglas, pero sin sentirse sometidos a ellas. Una persona amable que ayuda a los demás conforme a sus necesidades probablemente sea neutral buena.',
    },
  },
  {
    id: 'chaotic-good',
    name: { en: 'Chaotic Good', fr: 'Chaotique Bon', es: 'Caótico bueno' },
    abbr: { en: 'CG', fr: 'CB', es: 'CB' },
    text: {
      en: 'Chaotic Good creatures act as their conscience directs with little regard for what others expect. A rebel who waylays a cruel baron’s tax collectors and uses the stolen money to help the poor is probably Chaotic Good.',
      fr: 'Les créatures Chaotiques Bonnes agissent selon ce que leur conscience leur dicte, sans se soucier des attentes de la société. Un rebelle qui intercepte les collecteurs d’impôts d’un baron cruel pour reverser l’or saisi aux indigents sera probablement Chaotique Bon.',
      es: 'Los seres caóticos buenos actúan siguiendo los dictados de sus conciencias, sin preocuparles lo que otros esperan de ellos. Une rebelde que ataca a los recaudadores de impuestos de un barón malvado y utiliza el dinero robado para ayudar a los pobres probablemente sea caótique buene.',
    },
  },
  {
    id: 'lawful-neutral',
    name: { en: 'Lawful Neutral', fr: 'Loyal Neutre', es: 'Legal neutral' },
    abbr: { en: 'LN', fr: 'LN', es: 'LN' },
    text: {
      en: 'Lawful Neutral individuals act in accordance with law, tradition, or personal codes. Someone who follows a disciplined rule of life—and isn’t swayed either by the demands of those in need or by the temptations of evil—is probably Lawful Neutral.',
      fr: 'Les individus Loyaux Neutres se conduisent en accord avec la loi, les traditions ou leur code personnel. Une personne qui adhère à une discipline de vie sans se laisser influencer par les affres des nécessiteux ni les tentations du mal sera probablement Loyale Neutre.',
      es: 'Los individuos legales neutrales se comportan de acuerdo con la ley, la tradición o sus códigos de conducta personales. Alguien que vive una vida disciplinada y que no se deja influir por las exigencias de los necesitados ni por las tentaciones del mal probablemente sea legal neutral.',
    },
  },
  {
    id: 'neutral',
    name: { en: 'Neutral', fr: 'Neutre', es: 'Neutral' },
    abbr: { en: 'N', fr: 'N', es: 'N' },
    text: {
      en: 'Neutral is the alignment of those who prefer to avoid moral questions and don’t take sides,',
      fr: 'L’alignement Neutre est celui des gens qui préfèrent éviter les questions morales et ne pas prendre parti, pour simplement agir au cas par cas, du mieux possible. Une personne que les débats moraux ennuient sera probablement Neutre.',
      es: 'Neutral es el alineamiento de quienes prefieren evitar las cuestiones éticas, no toman partido y, por tanto, hacen lo que les parece mejor en cada momento. Una persona a la que le aburren los dilemas morales probablemente sea neutral.',
    },
  },
  {
    id: 'chaotic-neutral',
    name: { en: 'Chaotic Neutral', fr: 'Chaotique Neutre', es: 'Caótico neutral' },
    abbr: { en: 'CN', fr: 'CN', es: 'CN' },
    text: {
      en: 'Chaotic Neutral creatures follow their whims, valuing their personal freedom above all else. A scoundrel who wanders the land living by their wits is probably Chaotic Neutral.',
      fr: 'Les créatures Chaotiques Neutres agissent comme bon leur semble, leur propre liberté important plus que tout le reste. Une canaille qui erre dans la nature en vivant d’expédients sera probablement Chaotique Neutre.',
      es: 'Las criaturas caóticas neutrales persiguen sus caprichos y valoran su libertad personal por encima de todo. Un sinvergüenza que deambule de un lado a otro viviendo de su ingenio probablemente sea caótico neutral.',
    },
  },
  {
    id: 'lawful-evil',
    name: { en: 'Lawful Evil', fr: 'Loyal Mauvais', es: 'Legal malvado' },
    abbr: { en: 'LE', fr: 'LM', es: 'LM' },
    text: {
      en: 'Lawful Evil creatures methodically take what they want within the limits of a code of tradition, loyalty, or order. An aristocrat exploiting citizens while scheming for power is probably Lawful Evil.',
      fr: 'Les créatures Loyales Mauvaises s’approprient méthodiquement ce qu’elles désirent tout en restant dans le cadre de la loyauté, de la tradition ou de l’ordre. Un aristocrate qui exploite la population en intrigant pour le pouvoir sera probablement Loyal Mauvais.',
      es: 'Los seres legales malvados toman lo que les viene en gana, pero siempre de forma metódica y dentro de los límites que marcan la tradición, el orden o la lealtad. Una aristócrata que explote a los ciudadanos mientras conspire para hacerse con el poder probablemente sea legal malvada.',
    },
  },
  {
    id: 'neutral-evil',
    name: { en: 'Neutral Evil', fr: 'Neutre Mauvais', es: 'Neutral malvado' },
    abbr: { en: 'NE', fr: 'NM', es: 'NM' },
    text: {
      en: 'Neutral Evil is the alignment of those who are untroubled by the harm they cause as they pursue their desires. A criminal who robs and murders as they please is probably Neutral Evil.',
      fr: 'Neutre Mauvais est l’alignement des personnes qui n’ont cure du mal qu’elles peuvent causer pour assouvir leurs désirs. Un criminel qui vole et tue comme bon lui semble sera probablement Neutre Mauvais.',
      es: 'Neutral malvado es el alineamiento de las personas a las que les resulta indiferente causar daño mientras persiguen sus deseos. Une criminal que robe y asesine según le convenga probablemente sea neutral malvade.',
    },
  },
  {
    id: 'chaotic-evil',
    name: { en: 'Chaotic Evil', fr: 'Chaotique Mauvais', es: 'Caótico malvado' },
    abbr: { en: 'CE', fr: 'CM', es: 'CM' },
    text: {
      en: 'Chaotic Evil creatures act with arbitrary violence, spurred by their hatred or bloodlust. A villain pursuing schemes of vengeance and havoc is probably Chaotic Evil.',
      fr: 'La violence gratuite des créatures Chaotiques Mauvaises est motivée par la haine ou la soif de sang. Un scélérat dont les desseins sont animés par la vengeance et les ravages sera probablement Chaotique Mauvais.',
      es: 'Las criaturas caóticas malvadas recurren a la violencia arbitrariamente, movidas por el odio o el ansia de sangre. Un villano que maquina venganzas y siembra el caos probablemente sea caótico malvado.',
    },
  },
]

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** The alignment a stored value stands for (its id, name or abbreviation in English, French or Spanish). */
export function alignmentOf(value: string | undefined): AlignmentDef | undefined {
  if (!value) return undefined
  const v = norm(value)
  return ALIGNMENTS.find(
    (a) => a.id === v || [a.name.en, a.name.fr, a.name.es ?? ''].some((n) => norm(n) === v) || norm(a.abbr.en) === v,
  )
}

/** A stored alignment as shown: the table name in the reader's language, else the text as entered. */
export const alignmentName = (value: string | undefined): I18n =>
  alignmentOf(value)?.name ?? { en: value ?? '', fr: value ?? '', es: value ?? '' }
