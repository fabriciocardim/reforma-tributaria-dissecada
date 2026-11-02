/*
 * Texto legal → HTML seguro. Puro. O texto da fonte traz só <i> e <span xlink:href="urn:...">;
 * os spans viram links (spans vizinhos com o mesmo alvo viram um link só), "nesta Lei Complementar"
 * vira marca de remissão não resolvida (CLAUDE.md, regra 3), e todo o resto é escapado sem mudar uma letra.
 */
import { FONTES } from "../captura/fontes.ts";

type No = { t: "texto"; v: string } | { t: "i"; f: No[] } | { t: "span"; href: string | null; f: No[] };

interface Folha {
  href: string | null;
  html: string;
}

export type ResolvedorUrn = (urn: string) => string;

const RE_TAG = /<(\/?)(i|span)\b([^>]*)>/g;
const RE_NAO_RESOLVIDA = /nesta Lei Complementar/g;

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
    filhos().push(tag === "i" ? { t: "i", f } : { t: "span", href: /xlink:href="([^"]*)"/.exec(m[3]!)?.[1] ?? null, f });
    if (!m[3]!.endsWith("/")) pilha.push({ tag, f });
  }
  if (pos < texto.length) filhos().push({ t: "texto", v: texto.slice(pos) });
  return raiz;
}

function textoPuro(v: string, marcar: boolean): string {
  if (!marcar) return escapar(v);
  let saida = "";
  let ultimo = 0;
  for (const m of v.matchAll(RE_NAO_RESOLVIDA)) {
    saida += escapar(v.slice(ultimo, m.index));
    saida += `<span class="nao-resolvida" title="Remissão não resolvida: a lei inteira, sem artigo indicado">${escapar(m[0])}</span>`;
    ultimo = m.index + m[0].length;
  }
  return saida + escapar(v.slice(ultimo));
}

function achatar(nos: No[], href: string | null, italico: boolean, saida: Folha[]): void {
  for (const no of nos) {
    if (no.t === "texto") {
      const html = textoPuro(no.v, href === null);
      saida.push({ href, html: italico ? `<i>${html}</i>` : html });
    } else if (no.t === "i") {
      achatar(no.f, href, true, saida);
    } else {
      achatar(no.f, no.href ?? href, italico, saida);
    }
  }
}

export function renderizarTextoLegal(texto: string, resolver: ResolvedorUrn): string {
  const folhas: Folha[] = [];
  achatar(analisar(texto), null, false, folhas);
  let saida = "";
  for (let i = 0; i < folhas.length; i++) {
    const href = folhas[i]!.href;
    if (href === null) {
      saida += folhas[i]!.html;
      continue;
    }
    let html = "";
    for (; i < folhas.length && folhas[i]!.href === href; i++) html += folhas[i]!.html;
    i--;
    saida += `<a class="remissao" href="${escapar(resolver(href))}">${html}</a>`;
  }
  return saida;
}

/**
 * Endereço previsível da ficha (docs/design.md): `../../<norma>/art-<n>/#<dispositivo>`, relativo à
 * ficha em /lei/<norma>/art-<n>/. Norma fora de `captura/fontes.ts` ou alvo sem artigo vai para o normas.leg.br.
 */
export function hrefRemissao(urn: string): string {
  const [normaBruta, resto = ""] = urn.split("!");
  const norma = normaBruta!.replace(/@.*$/, "");
  const fonte = FONTES.find((f) => f.urn === norma);
  const dispositivo = resto.split(",")[0]!;
  const artigo = /^art(\d+)/.exec(dispositivo)?.[1];
  if (!fonte || !artigo) return `https://normas.leg.br/?urn=${urn}`;
  return `../../${fonte.nome}/art-${artigo}/#${dispositivo}`;
}
