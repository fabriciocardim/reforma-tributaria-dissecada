/*
 * Remissões do texto que a fonte não marca (docs/design.md, princípio 3). Puro e determinístico:
 * só resolve quando o próprio texto diz a que norma ou artigo a remissão se refere, com
 * "desta Lei Complementar" ("art. 44 desta Lei Complementar") ou "deste artigo" ("§ 3º deste artigo",
 * "o caput deste artigo"). Sem essa âncora o alvo não é adivinhado: a menção a "art. N" sem norma
 * fica marcada como não resolvida, e a que a frase atribui a outra norma ("do ADCT") fica como está.
 * Alvo que a gramática entende mas que não existe na norma também fica marcado como não resolvido.
 */
import type { Dispositivo } from "../captura/ler.ts";
import type { Catalogo, Destino, Norma } from "./norma.ts";

export interface Casamento {
  inicio: number;
  fim: number;
  /** null: remissão não resolvida. */
  destino: Destino | null;
  motivo?: string;
}

export interface ContextoLocal {
  catalogo: Catalogo;
  norma: Norma;
  /** Artigo da página. */
  artigo: Dispositivo;
  /** Marca "art. N" sem norma indicada como não resolvida. */
  marcarSemNorma: boolean;
  /** "desta Lei Complementar" aponta para esta norma (só vale na própria Lei Complementar 214/2025). */
  leiComplementarPropria: boolean;
}

type Tipo = "art" | "caput" | "par" | "inc" | "ali";
const NIVEL: Record<Tipo, number> = { art: 0, caput: 1, par: 1, inc: 2, ali: 3 };

interface Valor {
  inicio: number;
  fim: number;
  /** Número do dispositivo (romano e letra já convertidos); "unico" para parágrafo único. */
  n: number | "unico";
  /** Sufixo -A, -B…: 1, 2… */
  sufixo: number | null;
}

interface Componente {
  tipo: Tipo;
  valores: Valor[];
}

interface Cadeia {
  inicio: number;
  fim: number;
  componentes: Componente[];
}

const RE_NUMERO = /(\d+)(?:\s*[º°])?(?:\s*-\s*([A-Z])(?![\p{L}]))?/uy;
const RE_ROMANO = /([IVXLC]+)(?:\s*-\s*([A-Z])(?![\p{L}]))?(?![\p{L}\p{N}])/uy;
const RE_LETRA = /["“(]?([a-z])["”)]?(?![\p{L}\p{N}])/uy;
const RE_LIGACAO_LISTA = /\s*,\s*|\s+e\s+|\s+ou\s+|\s+a\s+/y;
const RE_QUALIFICADOR = /\s+(desta Lei Complementar|deste artigo)(?![\p{L}])/iuy;
const RE_EXTERNO =
  /\s*,?\s*(?:d[aoe]s?|n[oa]s?)\s+(?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ]|regulamento|código|decreto|lei\b|convênio|ato\b|portaria|resolução|instrução|regimento|estatuto|tratado|acordo|protocolo|norma\b)/uy;
const RE_LIGACAO_ENTRE_CADEIAS = /^\s*(?:[,;]\s*)?(?:(?:e|ou)\s+)?(?:(?:no|na|nos|nas|do|da|dos|das|o|a|os|as)\s+)?$/;

function sticky(re: RegExp, texto: string, pos: number): RegExpExecArray | null {
  re.lastIndex = pos;
  return re.exec(texto);
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

const indiceLetra = (l: string): number => l.toUpperCase().charCodeAt(0) - 64;

function lerValor(texto: string, pos: number, tipo: Tipo): Valor | null {
  if (tipo === "ali") {
    const m = sticky(RE_LETRA, texto, pos);
    return m ? { inicio: pos, fim: pos + m[0].length, n: indiceLetra(m[1]!), sufixo: null } : null;
  }
  if (tipo === "inc") {
    const m = sticky(RE_ROMANO, texto, pos);
    const n = m ? romano(m[1]!) : null;
    return m && n !== null ? { inicio: pos, fim: pos + m[0].length, n, sufixo: m[2] ? indiceLetra(m[2]) : null } : null;
  }
  const m = sticky(RE_NUMERO, texto, pos);
  return m ? { inicio: pos, fim: pos + m[0].length, n: Number(m[1]), sufixo: m[2] ? indiceLetra(m[2]) : null } : null;
}

function lerLista(texto: string, pos: number, tipo: Tipo, plural: boolean): { valores: Valor[]; fim: number } | null {
  const primeiro = lerValor(texto, pos, tipo);
  if (!primeiro) return null;
  const valores = [primeiro];
  let fim = primeiro.fim;
  while (plural) {
    const lig = sticky(RE_LIGACAO_LISTA, texto, fim);
    if (!lig) break;
    const prox = lerValor(texto, fim + lig[0].length, tipo);
    if (!prox) break;
    valores.push(prox);
    fim = prox.fim;
  }
  return { valores, fim };
}

/** Lê um componente (art., caput, §, inciso, alínea) em `pos`. `nu`: aceita romano sem a palavra "inciso". */
function lerComponente(texto: string, pos: number, nu: boolean): (Componente & { fim: number }) | null {
  let m: RegExpExecArray | null;
  if ((m = sticky(/art(?:igo)?(s?)\.?\s*/iuy, texto, pos))) {
    const l = lerLista(texto, pos + m[0].length, "art", m[1] === "s");
    return l && { tipo: "art", valores: l.valores, fim: l.fim };
  }
  if ((m = sticky(/caput(?![\p{L}])/iuy, texto, pos))) return { tipo: "caput", valores: [], fim: pos + m[0].length };
  if ((m = sticky(/par[áa]grafo\s+[úu]nico(?![\p{L}])/iuy, texto, pos))) {
    return { tipo: "par", valores: [{ inicio: pos, fim: pos + m[0].length, n: "unico", sufixo: null }], fim: pos + m[0].length };
  }
  if ((m = sticky(/§(§?)\s*/uy, texto, pos))) {
    const l = lerLista(texto, pos + m[0].length, "par", m[1] === "§");
    return l && { tipo: "par", valores: l.valores, fim: l.fim };
  }
  if ((m = sticky(/inciso(s?)\s+/iuy, texto, pos))) {
    const l = lerLista(texto, pos + m[0].length, "inc", m[1] === "s");
    return l && { tipo: "inc", valores: l.valores, fim: l.fim };
  }
  if ((m = sticky(/al[íi]nea(s?)\s+/iuy, texto, pos))) {
    const l = lerLista(texto, pos + m[0].length, "ali", m[1] === "s");
    return l && { tipo: "ali", valores: l.valores, fim: l.fim };
  }
  if (nu) {
    const l = lerLista(texto, pos, "inc", false);
    return l && { tipo: "inc", valores: l.valores, fim: l.fim };
  }
  return null;
}

const semLetraAntes = (texto: string, i: number): boolean => i === 0 || !/[\p{L}\p{N}§]/u.test(texto[i - 1]!);

function lerCadeia(texto: string, inicio: number): Cadeia | null {
  const primeiro = lerComponente(texto, inicio, false);
  if (!primeiro) return null;
  const componentes: Componente[] = [primeiro];
  let fim = primeiro.fim;
  if (primeiro.tipo === "art") {
    // Direta: "art. 12, § 3º, II, a": do externo para o interno, separada por vírgula.
    for (;;) {
      const sep = sticky(/\s*,\s*/y, texto, fim);
      if (!sep) break;
      const ultimo = componentes[componentes.length - 1]!;
      const c = lerComponente(texto, fim + sep[0].length, ultimo.tipo === "par" || ultimo.tipo === "caput");
      if (!c || c.tipo === "art" || NIVEL[c.tipo] <= NIVEL[ultimo.tipo]) break;
      if (c.tipo === "ali" && ultimo.tipo !== "inc") break;
      if (ultimo.valores.length > 1) break;
      componentes.push({ tipo: c.tipo, valores: c.valores });
      fim = c.fim;
    }
  } else {
    // Inversa: "inciso II do § 3º do art. 12": do interno para o externo, ligada por "do/da/de".
    for (;;) {
      const sep = sticky(/\s+d[oae]s?\s+/iuy, texto, fim);
      if (!sep) break;
      const ultimo = componentes[componentes.length - 1]!;
      const c = lerComponente(texto, fim + sep[0].length, false);
      if (!c || NIVEL[c.tipo] >= NIVEL[ultimo.tipo]) break;
      if (ultimo.tipo === "ali" && c.tipo !== "inc") break;
      componentes.push({ tipo: c.tipo, valores: c.valores });
      fim = c.fim;
      if (c.tipo === "art") break;
    }
    componentes.reverse();
  }
  return { inicio, fim, componentes };
}

type Qualificador = "lc" | "artigo";

interface Achada {
  cadeia: Cadeia;
  proprio: { tipo: Qualificador; fim: number } | null;
  externo: boolean;
  efetivo: Qualificador | null;
}

function achar(texto: string): Achada[] {
  const achadas: Achada[] = [];
  for (let i = 0; i < texto.length; i++) {
    if (!semLetraAntes(texto, i)) continue;
    const cadeia = lerCadeia(texto, i);
    if (!cadeia) continue;
    const q = sticky(RE_QUALIFICADOR, texto, cadeia.fim);
    const proprio = q ? { tipo: (/lei/i.test(q[1]!) ? "lc" : "artigo") as Qualificador, fim: cadeia.fim + q[0].length } : null;
    achadas.push({ cadeia, proprio, externo: !proprio && sticky(RE_EXTERNO, texto, cadeia.fim) !== null, efetivo: proprio?.tipo ?? null });
    i = (proprio?.fim ?? cadeia.fim) - 1;
  }
  for (let k = achadas.length - 2; k >= 0; k--) {
    const a = achadas[k]!;
    const prox = achadas[k + 1]!;
    if (a.efetivo === null && !a.externo && RE_LIGACAO_ENTRE_CADEIAS.test(texto.slice(a.cadeia.fim, prox.cadeia.inicio))) a.efetivo = prox.efetivo;
  }
  return achadas;
}

function sufixo(v: Valor): string {
  return v.sufixo === null ? "" : `-${v.sufixo}`;
}

/** Ids dos dispositivos citados; null quando a cadeia não monta um id válido. */
function montarIds(c: Cadeia, qual: Qualificador, ctx: ContextoLocal): string[] | null {
  const por = (t: Tipo): Componente | undefined => c.componentes.find((x) => x.tipo === t);
  const art = por("art");
  if ((qual === "lc") !== (art !== undefined)) return null;
  const multiplos = c.componentes.filter((x) => x.valores.length > 1);
  const maisInterno = c.componentes[c.componentes.length - 1];
  if (multiplos.length > 1 || (multiplos[0] && multiplos[0] !== maisInterno)) return null;
  const construir = (escolha: (comp: Componente) => Valor | undefined): string | null => {
    let id: string;
    if (art) {
      const v = escolha(art);
      if (!v || typeof v.n !== "number") return null;
      id = `art${v.n}${sufixo(v)}`;
    } else {
      id = ctx.artigo.id;
    }
    const par = por("par");
    const inc = por("inc");
    const ali = por("ali");
    if (par) {
      const v = escolha(par);
      if (!v) return null;
      id += v.n === "unico" ? "_par1u" : `_par${v.n}${sufixo(v)}`;
    } else if (por("caput") || inc || ali) {
      id += "_cpt";
    }
    for (const [comp, prefixo] of [[inc, "inc"], [ali, "ali"]] as const) {
      if (!comp) continue;
      const v = escolha(comp);
      if (!v) return null;
      id += `_${prefixo}${v.n}${sufixo(v)}`;
    }
    return id;
  };
  const ids: string[] = [];
  const variavel = multiplos[0];
  for (const v of variavel ? variavel.valores : [undefined]) {
    const id = construir((comp) => (comp === variavel ? v : comp.valores[0]));
    if (id === null) return null;
    ids.push(id);
  }
  return ids;
}

function destinoDe(id: string, ctx: ContextoLocal): Destino | null {
  const idArtigo = /^(art\d+(?:-\d+)?)(?:_|$)/.exec(id)?.[1];
  if (!idArtigo) return null;
  const pagina = ctx.norma.porId.get(idArtigo);
  if (!pagina || !ctx.norma.slugs.has(pagina.id) || !ctx.norma.porId.has(id)) return null;
  return ctx.catalogo.destino(ctx.norma, pagina, id, ctx.norma, ctx.artigo);
}

export function resolverLocais(texto: string, ctx: ContextoLocal): Casamento[] {
  const saida: Casamento[] = [];
  for (const a of achar(texto)) {
    const { cadeia } = a;
    if (a.efetivo === "lc" && !ctx.leiComplementarPropria) continue;
    const temArtigo = cadeia.componentes.some((c) => c.tipo === "art");
    if (a.efetivo === null) {
      if (a.externo || !temArtigo || !ctx.marcarSemNorma) continue;
      saida.push({ inicio: cadeia.inicio, fim: cadeia.fim, destino: null, motivo: "Remissão não resolvida: o texto não diz a que norma o artigo pertence" });
      continue;
    }
    const ids = montarIds(cadeia, a.efetivo, ctx);
    const destinos = ids?.map((id) => destinoDe(id, ctx));
    const fim = a.proprio?.fim ?? cadeia.fim;
    if (!destinos || destinos.some((d) => d === null)) {
      saida.push({ inicio: cadeia.inicio, fim, destino: null, motivo: "Remissão não resolvida: a fonte não tem esse dispositivo" });
      continue;
    }
    const variavel = cadeia.componentes.find((c) => c.valores.length > 1);
    if (!variavel) {
      saida.push({ inicio: cadeia.inicio, fim, destino: destinos[0]! });
    } else {
      variavel.valores.forEach((v, i) => saida.push({ inicio: v.inicio, fim: v.fim, destino: destinos[i]! }));
    }
  }
  return saida;
}
