import { Rand } from "./rng.js";

const PREFIXES = [
  "Zar", "Vel", "Thal", "Or", "Myr", "Xan", "Kael", "Iss", "Vor", "Nyx",
  "Ash", "Drel", "Sil", "Um", "Fen", "Wyr", "Cael", "Bran", "Sol", "Rin"
];
const SUFFIXES = [
  "ith", "or", "une", "ael", "yx", "um", "ara", "enn", "osk", "ivar",
  "eth", "ion", "ash", "wyn", "orak", "iel", "uth", "and", "esh", "orin"
];

const POWERS = [
  "proteção contra espíritos",
  "sorte em jogos e apostas",
  "cura de ferimentos leves",
  "invisibilidade breve",
  "clarividência à distância",
  "selamento de portas e baús",
  "silêncio ao redor de quem a carrega",
  "resistência ao fogo",
  "resistência ao veneno",
  "orientação em lugares desconhecidos",
  "comunicação com os mortos",
  "sono profundo e sonhos vívidos",
  "atração de riqueza",
  "repulsão de criaturas selvagens",
  "fortalecimento de laços e juramentos"
];

const ORIGINS = [
  "um culto esquecido nas montanhas",
  "monges errantes de um templo em ruínas",
  "um artesão anão de nome perdido",
  "uma bruxa que vivia no pântano",
  "um mago exilado da corte real",
  "marinheiros que buscavam favor dos mares",
  "uma ordem secreta de guardiões",
  "um alquimista obcecado por segredos antigos",
  "peregrinos que cruzaram o deserto",
  "uma linhagem de ferreiros rituais"
];

const TEMPLATES = [
  "Uma runa de {power}, gravada por {origin}.",
  "Diz-se que esta runa foi criada por {origin} e concede {power}.",
  "Símbolo associado a {power}. Sua origem remonta a {origin}.",
  "Gravada em metal frio, esta runa promete {power}. Acredita-se que veio de {origin}.",
  "Um sigilo ligado a {power}, atribuído a {origin}."
];

/**
 * Generates a name, a short "power" label and a flavor description for a rune,
 * deterministically from the given seed.
 */
export function generateLore(seed) {
  const rand = new Rand(seed ^ 0x9e3779b9);
  const name = rand.pick(PREFIXES) + rand.pick(SUFFIXES);
  const power = rand.pick(POWERS);
  const origin = rand.pick(ORIGINS);
  const template = rand.pick(TEMPLATES);
  const description = template.replace("{power}", power).replace("{origin}", origin);
  return { name, power, description };
}
