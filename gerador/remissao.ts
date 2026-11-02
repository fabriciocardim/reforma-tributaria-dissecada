/*
 * Texto legal → HTML seguro. Puro. O texto da fonte traz só <i> e <span xlink:href="urn:...">;
 * os spans viram links (spans vizinhos com o mesmo alvo viram um link só) e todo o resto é escapado
 * sem mudar uma letra. Nos trechos sem marcação, `locais` aponta remissões que o texto ancora
 * ("art. 44 desta Lei Complementar") e `naoResolvidas` marca o que é vago ("nesta Lei Complementar")
 * (CLAUDE.md, regra 3).
 */
import type { Casamento } from "./referencias.ts";
import type { Destino } from "./norma.ts";

type No = { t: "texto"; v: string } | { t: "i" | "b"; f: No[] } | { t: "span"; href: string | null; f: No[] };

interface Folha {
  href: string | null;
  italico: boolean;
  negrito: boolean;
  texto: string;
}

export interface Opcoes {
  resolverUrn: (urn: string) => Destino;
  /** Remissões ancoradas pelo próprio texto, em trechos sem marcação da fonte. */
  locais?: (plano: string) => Casamento[];
  /** Frases vagas que ficam marcadas como não resolvidas (global). */
  naoResolvidas?: RegExp;
}

export interface Resultado {
  html: string;
  /** Destinos resolvidos citados no texto, sem repetição. */
  destinos: Destino[];
}

const RE_TAG = /<(\/?)(i|b|span)\b([^>]*)>/g;

export function escapar(s: string): string {
  return s.replace(/&(?!#?\w+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function analisar(texto: string): No[] {
  const raiz: No[] = [];
  const pilha: { tag: string; f: No[] }[] = [];
  const filhos = (): No[] => pilha[pilha.length - 1]?.f ?? raiz;
  let pos = 0;
  for (const m of texto.matchAll(RE_TAG)) {
    if (m.index > pos) filhos().push({ t: "texto", v: texto.slice(pos, m.index) });
    pos = m.index + m[0].length;
    const tag = m[2]!;
    if (m[1] === "/") {
      if (pilha[pilha.length - 1]?.tag === tag) pilha.pop();
      continue;
    }
    const f: No[] = [];
    filhos().push(tag === "i" || tag === "b" ? { t: tag, f } : { t: "span", href: /xlink:href="([^"]*)"/.exec(m[3]!)?.[1] ?? null, f });
    if (!m[3]!.endsWith("/")) pilha.push({ tag, f });
  }
  if (pos < texto.length) filhos().push({ t: "texto", v: texto.slice(pos) });
  return raiz;
}

function achatar(nos: No[], href: string | null, italico: boolean, negrito: boolean, saida: Folha[]): void {
  for (const no of nos) {
    if (no.t === "texto") saida.push({ href, italico, negrito, texto: no.v });
    else if (no.t === "i") achatar(no.f, href, true, negrito, saida);
    else if (no.t === "b") achatar(no.f, href, italico, true, saida);
    else achatar(no.f, no.href ?? href, italico, negrito, saida);
  }
}

function pedaco(texto: string, f: Folha): string {
  const t = escapar(texto);
  const i = f.italico ? `<i>${t}</i>` : t;
  return f.negrito ? `<b>${i}</b>` : i;
}

function renderizarTrecho(folhas: Folha[], op: Opcoes, destinos: Destino[]): string {
  const plano = folhas.map((f) => f.texto).join("");
  const casamentos = [...(op.locais?.(plano) ?? [])];
  if (op.naoResolvidas) {
    for (const m of plano.matchAll(op.naoResolvidas)) {
      const fim = m.index + m[0].length;
      if (!casamentos.some((c) => c.inicio < fim && m.index < c.fim)) {
        casamentos.push({ inicio: m.index, fim, destino: null, motivo: "Remissão não resolvida: a lei inteira, sem artigo indicado" });
      }
    }
  }
  casamentos.sort((a, b) => a.inicio - b.inicio);

  const limites = new Set<number>([0, plano.length]);
  let acumulado = 0;
  for (const f of folhas) limites.add((acumulado += f.texto.length));
  for (const c of casamentos) {
    limites.add(c.inicio);
    limites.add(c.fim);
  }
  const cortes = [...limites].sort((a, b) => a - b);

  const folhaEm = (pos: number): Folha => {
    let ate = 0;
    for (const f of folhas) {
      ate += f.texto.length;
      if (pos < ate) return f;
    }
    return folhas[folhas.length - 1]!;
  };

  let saida = "";
  let aberto: Casamento | null = null;
  const fechar = (): void => {
    if (aberto) saida += aberto.destino ? "</a>" : "</span>";
    aberto = null;
  };
  for (let k = 0; k < cortes.length - 1; k++) {
    const a = cortes[k]!;
    const b = cortes[k + 1]!;
    if (a === b) continue;
    const c = casamentos.find((x) => x.inicio <= a && b <= x.fim) ?? null;
    if (aberto !== c) {
      fechar();
      if (c) {
        if (c.destino) {
          saida += `<a class="remissao" href="${escapar(c.destino.href)}">`;
          if (c.destino.alvo && !destinos.some((d) => d.href === c.destino!.href)) destinos.push(c.destino);
        } else {
          saida += `<span class="nao-resolvida" title="${escapar(c.motivo ?? "Remissão não resolvida")}">`;
        }
        aberto = c;
      }
    }
    saida += pedaco(plano.slice(a, b), folhaEm(a));
  }
  fechar();
  return saida;
}

export function renderizarTextoLegal(texto: string, op: Opcoes): Resultado {
  const folhas: Folha[] = [];
  achatar(analisar(texto), null, false, false, folhas);
  const destinos: Destino[] = [];
  let html = "";
  for (let i = 0; i < folhas.length; i++) {
    const href = folhas[i]!.href;
    const grupo: Folha[] = [];
    for (; i < folhas.length && folhas[i]!.href === href; i++) grupo.push(folhas[i]!);
    i--;
    if (href === null) {
      html += renderizarTrecho(grupo, op, destinos);
      continue;
    }
    const destino = op.resolverUrn(href);
    if (destino.alvo && !destinos.some((d) => d.href === destino.href)) destinos.push(destino);
    html += `<a class="remissao" href="${escapar(destino.href)}">${grupo.map((f) => pedaco(f.texto, f)).join("")}</a>`;
  }
  return { html, destinos };
}
