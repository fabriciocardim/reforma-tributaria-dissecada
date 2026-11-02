/*
 * Copiado da extensão Mentor Web (src/normas/citacao.ts, versão 0.3.0, design de 2026-10-30), sem alteração.
 * Ponto de partida do reconhecedor de remissões (docs/design.md, Arquitetura). Ainda falta estender
 * para as remissões relativas ("deste artigo", "do caput", "desta Lei Complementar").
 */
/*
 * Citação de norma na base citada pela IA (design 2026-10-30). Puro. Reconhece normas federais com
 * número e ano ("Lei 8.112/1990", "LC 101/2000", "CF/88") e o dispositivo colado a elas, para montar o
 * link do normas.leg.br e a consulta ao Senado. Sem número e ano, ou norma estadual, não há citação.
 */

/** Dispositivo citado; números romanos e ordinais já convertidos. */
export interface Dispositivo {
  artigo: number;
  paragrafo: number | "unico" | null;
  inciso: number | null;
  alinea: string | null;
}

export type TipoNorma = "constituicao" | "emenda" | "lei_complementar" | "lei" | "decreto_lei" | "decreto" | "medida_provisoria";

export interface CitacaoNorma {
  tipo: TipoNorma;
  numero: number;
  ano: number;
  dispositivo: Dispositivo | null;
  /** "Lei 8.112/1990", "CF/1988"… */
  rotulo: string;
}

const URN_CF = "urn:lex:br:federal:constituicao:1988-10-05;1988";

const URN_TIPO: Record<Exclude<TipoNorma, "constituicao">, string> = {
  emenda: "emenda.constitucional",
  lei_complementar: "lei.complementar",
  lei: "lei",
  decreto_lei: "decreto.lei",
  decreto: "decreto",
  medida_provisoria: "medida.provisoria",
};

const SIGLA_SENADO: Record<Exclude<TipoNorma, "constituicao">, string> = {
  emenda: "EMC",
  lei_complementar: "LCP",
  lei: "LEI",
  decreto_lei: "DEL",
  decreto: "DEC",
  medida_provisoria: "MPV",
};

const PREFIXO_ROTULO: Record<Exclude<TipoNorma, "constituicao">, string> = {
  emenda: "EC",
  lei_complementar: "LC",
  lei: "Lei",
  decreto_lei: "Decreto-Lei",
  decreto: "Decreto",
  medida_provisoria: "MP",
};

/** Apelidos aceitos (lista curta do design); o número e o ano vêm daqui. */
const APELIDOS: [RegExp, TipoNorma, number, number][] = [
  [/C[óo]digo Tribut[áa]rio Nacional|\bCTN\b/y, "lei", 5172, 1966],
  [/C[óo]digo de Processo Civil|\bCPC\b/y, "lei", 13105, 2015],
  [/C[óo]digo de Processo Penal|\bCPP\b/y, "decreto_lei", 3689, 1941],
  [/C[óo]digo Civil|\bCC\b/y, "lei", 10406, 2002],
  [/C[óo]digo Penal|\bCP\b/y, "decreto_lei", 2848, 1940],
  [/\bCLT\b/y, "decreto_lei", 5452, 1943],
  [/\bLINDB\b/y, "decreto_lei", 4657, 1942],
  [/\bLRF\b/y, "lei_complementar", 101, 2000],
];

const TIPOS_ESCRITOS: [string, TipoNorma][] = [
  ["lei complementar", "lei_complementar"],
  ["lc", "lei_complementar"],
  ["decreto-lei", "decreto_lei"],
  ["decreto lei", "decreto_lei"],
  ["dl", "decreto_lei"],
  ["decreto", "decreto"],
  ["emenda constitucional", "emenda"],
  ["ec", "emenda"],
  ["medida provisória", "medida_provisoria"],
  ["medida provisoria", "medida_provisoria"],
  ["mp", "medida_provisoria"],
  ["lei", "lei"],
];

const RE_NORMA =
  /\b(lei complementar|decreto[- ]lei|emenda constitucional|medida provis[óo]ria|decreto|lei|lc|dl|ec|mp)\s*(?:n[º°o.]\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:-[A-Z0-9]+)?\s*(?:\/\s*(\d{4}|\d{2})\b|,?\s*de\s+(?:\d{1,2}º?\s+de\s+[a-zç]+\s+de\s+)?(\d{4})\b)/giy;
const RE_CF = /\b(?:CF|CRFB)(?:\s*\/\s*(?:19)?88)?\b|Constitui[çc][ãa]o(?:\s+Federal|\s+da\s+Rep[úu]blica(?:\s+Federativa\s+do\s+Brasil)?)?(?:\s+de\s+1988)?/y;
const RE_ARTIGO = /\bart(?:igo)?s?\.?\s*(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:º|°|o\b)?/giy;

interface Mencao {
  inicio: number;
  fim: number;
  tipo: TipoNorma;
  numero: number;
  ano: number;
}

function numero(s: string): number {
  return Number(s.replace(/\./g, ""));
}

function anoCompleto(s: string, anoAtual: number): number {
  if (s.length === 4) return Number(s);
  const n = Number(s);
  return n <= anoAtual % 100 ? 2000 + n : 1900 + n;
}

function romano(s: string): number | null {
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const a = v[s[i]!];
    const b = v[s[i + 1] ?? ""] ?? 0;
    if (a === undefined) return null;
    total += a < b ? -a : a;
  }
  return total > 0 ? total : null;
}

/** "estadual", "municipal", "da Bahia", "do Estado…": a norma não é federal. */
function naoFederal(texto: string, inicio: number, fim: number): boolean {
  const antes = texto.slice(Math.max(0, inicio - 20), inicio);
  const depois = texto.slice(fim, fim + 30);
  return (
    /(estadual|municipal|distrital)\s*$/i.test(antes) ||
    /^\s*(estadual|municipal|distrital|d[oa]\s+(estado|munic[íi]pio|distrito))/i.test(depois) ||
    /^\s*d[aeo]\s+[A-ZÁÉÍÓÚ][a-zà-ú]+/.test(depois)
  );
}

function mencoes(texto: string, anoAtual: number): Mencao[] {
  const achadas: Mencao[] = [];
  for (let i = 0; i < texto.length; i++) {
    if (i > 0 && /[\p{L}\p{N}]/u.test(texto[i - 1]!)) continue;
    RE_NORMA.lastIndex = i;
    const m = RE_NORMA.exec(texto);
    if (m) {
      const tipo = TIPOS_ESCRITOS.find(([k]) => k === m[1]!.toLowerCase().replace(/\s+/g, " "))?.[1];
      const fim = i + m[0].length;
      if (tipo && !naoFederal(texto, i, fim)) {
        achadas.push({ inicio: i, fim, tipo, numero: numero(m[2]!), ano: anoCompleto(m[3] ?? m[4]!, anoAtual) });
      }
      i = fim - 1;
      continue;
    }
    RE_CF.lastIndex = i;
    const cf = RE_CF.exec(texto);
    if (cf) {
      // "Constituição Estadual", "Constituição do Estado de…": não é a CF.
      if (!naoFederal(texto, i, i + cf[0].length)) achadas.push({ inicio: i, fim: i + cf[0].length, tipo: "constituicao", numero: 1988, ano: 1988 });
      i += cf[0].length - 1;
      continue;
    }
    for (const [re, tipo, n, ano] of APELIDOS) {
      re.lastIndex = i;
      const a = re.exec(texto);
      if (a) {
        achadas.push({ inicio: i, fim: i + a[0].length, tipo, numero: n, ano });
        i += a[0].length - 1;
        break;
      }
    }
  }
  return achadas;
}

/** Lê o que vem depois do número do artigo: "§ 3º", "parágrafo único", "IV", "inciso IV", "a". */
function cadeia(texto: string, desde: number, artigo: number): { d: Dispositivo; fim: number } {
  const d: Dispositivo = { artigo, paragrafo: null, inciso: null, alinea: null };
  let pos = desde;
  for (;;) {
    const resto = texto.slice(pos);
    let m: RegExpExecArray | null;
    if ((m = /^\s*,?\s*caput\b/i.exec(resto))) {
      pos += m[0].length;
    } else if (d.paragrafo === null && d.inciso === null && (m = /^\s*,?\s*§\s*(\d+)\s*(?:º|°)?/.exec(resto))) {
      d.paragrafo = Number(m[1]);
      pos += m[0].length;
    } else if (d.paragrafo === null && d.inciso === null && (m = /^\s*,?\s*par[áa]grafo\s+[úu]nico\b/i.exec(resto))) {
      d.paragrafo = "unico";
      pos += m[0].length;
    } else if (d.inciso === null && (m = /^\s*,?\s*(?:inciso\s+)?([IVXLC]+)\b(?!\s*\/)/.exec(resto)) && romano(m[1]!) !== null) {
      d.inciso = romano(m[1]!);
      pos += m[0].length;
    } else if (
      d.inciso !== null &&
      d.alinea === null &&
      // Só com vírgula ou "alínea" antes, e terminando a citação: "LV e o contraditório" não tem alínea.
      (m = /^\s*(?:,\s*(?:al[íi]nea\s+)?|\s+al[íi]nea\s+)["“]?([a-z])["”]?(?=$|[,;.)]|\s+d[aoe]s?\b)/.exec(resto))
    ) {
      d.alinea = m[1]!;
      pos += m[0].length;
    } else {
      return { d, fim: pos };
    }
  }
}

function rotuloDe(tipo: TipoNorma, n: number, ano: number): string {
  if (tipo === "constituicao") return "CF/1988";
  return `${PREFIXO_ROTULO[tipo]} ${n.toLocaleString("pt-BR")}/${ano}`;
}

export function chaveNorma(c: Pick<CitacaoNorma, "tipo" | "numero" | "ano">): string {
  return `${c.tipo}:${c.numero}:${c.ano}`;
}

export function reconhecerCitacoes(texto: string, anoAtual: number): CitacaoNorma[] {
  const normas = mencoes(texto, anoAtual);
  const dispositivos = new Map<Mencao, Dispositivo>();
  for (let i = 0; i < texto.length; i++) {
    if (i > 0 && /[\p{L}]/u.test(texto[i - 1]!)) continue;
    RE_ARTIGO.lastIndex = i;
    const a = RE_ARTIGO.exec(texto);
    if (!a) continue;
    const { d, fim } = cadeia(texto, i + a[0].length, numero(a[1]!));
    // "art. 3º do CTN" (depois, com do/da) > "CF/1988, art. 170" (colada antes) > "art. 170, IV, CF/88"
    // (depois, só vírgula): em "CF/1988, art. 37, Lei 8.112/1990, art. 5º" o art. 37 fica com a CF.
    const depois = normas.find((n) => n.inicio >= fim && /^[\s,]*(?:d[aoe]s?\s+)?$/i.test(texto.slice(fim, n.inicio)));
    const depoisComDe = depois && /d[aoe]s?\s+$/i.test(texto.slice(fim, depois.inicio)) ? depois : undefined;
    const antes = [...normas].reverse().find((n) => n.fim <= i && /^[\s),]*$/.test(texto.slice(n.fim, i)));
    const alvo = depoisComDe ?? antes ?? depois;
    if (alvo && !dispositivos.has(alvo)) dispositivos.set(alvo, d);
    i = Math.max(i, fim - 1);
  }
  const porChave = new Map<string, CitacaoNorma>();
  for (const n of normas) {
    const c: CitacaoNorma = { tipo: n.tipo, numero: n.numero, ano: n.ano, dispositivo: dispositivos.get(n) ?? null, rotulo: rotuloDe(n.tipo, n.numero, n.ano) };
    const ja = porChave.get(chaveNorma(c));
    if (!ja) porChave.set(chaveNorma(c), c);
    else if (!ja.dispositivo && c.dispositivo) ja.dispositivo = c.dispositivo;
  }
  return [...porChave.values()];
}

/** Sem `dataCompleta` (AAAA-MM-DD), a URN usa só o ano, que o normas.leg.br e o LexML aceitam. */
export function urnNorma(c: CitacaoNorma, dataCompleta?: string): string {
  if (c.tipo === "constituicao") return URN_CF;
  return `urn:lex:br:federal:${URN_TIPO[c.tipo]}:${dataCompleta || c.ano};${c.numero}`;
}

/** Formato aceito pelo normas.leg.br (testado em 2026-10-30): inciso do caput com `_cpt`, alínea por número. */
function sufixoDispositivo(d: Dispositivo | null): string {
  if (!d) return "";
  const par = d.paragrafo === null ? (d.inciso === null ? "" : "_cpt") : d.paragrafo === "unico" ? "_parunico" : `_par${d.paragrafo}`;
  const inc = d.inciso === null ? "" : `_inc${d.inciso}`;
  const ali = d.alinea === null ? "" : `_ali${d.alinea.charCodeAt(0) - 96}`;
  return `!art${d.artigo}${par}${inc}${ali}`;
}

export function urlNormasLeg(c: CitacaoNorma, dataCompleta?: string): string {
  return `https://normas.leg.br/?urn=${urnNorma(c, dataCompleta)}${sufixoDispositivo(c.dispositivo)}`;
}

export function rotuloLink(c: CitacaoNorma): "Ver o artigo ↗" | "Ver a norma ↗" {
  return c.dispositivo ? "Ver o artigo ↗" : "Ver a norma ↗";
}

/** Caminho depois de `/dadosabertos/legislacao/`: a Constituição só pela URN. */
export function pathSenado(c: CitacaoNorma): string {
  if (c.tipo === "constituicao") return `urn?urn=${URN_CF}`;
  return `${SIGLA_SENADO[c.tipo]}/${c.numero}/${c.ano}`;
}
