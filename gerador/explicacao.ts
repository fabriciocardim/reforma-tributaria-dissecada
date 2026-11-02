/*
 * Explicação "Para que serve" de um artigo (docs/design.md, "Fluxo de conteúdo"). Puro, exceto
 * `carregarExplicacoes`. Fica em conteudo/fichas/<norma>/<artigo>.md, separada do texto legal: o
 * gerador junta as duas entradas sem misturá-las. Nasce `conferida: false`, com a impressão digital
 * do texto legal que explicou; se a redação mudar, volta a não conferida.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { redacaoAtual, type Dispositivo } from "../captura/ler.ts";
import { dataBr, subarvore } from "./ficha.ts";
import type { Norma } from "./norma.ts";
import { escapar } from "./remissao.ts";
import { REPOSITORIO, SITE } from "./config.ts";

export const SECOES = ["O que é", "Para que serve", "Como funciona"] as const;

export interface Explicacao {
  norma: string;
  /** id do artigo na base ("art4"). */
  artigo: string;
  conferida: boolean;
  /** AAAA-MM-DD; só quando conferida. */
  conferidaEm: string | null;
  geradaEm: string;
  impressaoDigital: string;
  /** Uma entrada por seção de SECOES, na mesma ordem; cada uma com seus parágrafos. */
  secoes: string[][];
}

export type Situacao = "conferida" | "nao-conferida" | "desatualizada";

/** Impressão digital do texto legal do artigo: id, tipo, data e texto da redação atual de cada dispositivo. */
export function impressaoDigital(norma: Norma, artigo: Dispositivo): string {
  const linhas = subarvore(norma.porId, artigo).flatMap((d) => {
    const v = redacaoAtual(d);
    return v ? [`${d.id}\t${v.tipos.join(",")}\t${v.data}\t${v.texto ?? ""}`] : [];
  });
  return createHash("sha256").update(linhas.join("\n")).digest("hex");
}

export function situacao(e: Explicacao, impressaoAtual: string): Situacao {
  if (e.impressaoDigital !== impressaoAtual) return "desatualizada";
  return e.conferida ? "conferida" : "nao-conferida";
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Lê o arquivo; lança erro com o motivo quando o formato não é o esperado. */
export function lerExplicacao(markdown: string): Explicacao {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(markdown);
  if (!m) throw new Error("falta o cabeçalho entre ---");
  const campos = new Map<string, string>();
  for (const linha of m[1]!.split("\n")) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(linha);
    if (!kv) throw new Error(`linha do cabeçalho inválida: "${linha}"`);
    campos.set(kv[1]!, kv[2]!.trim());
  }
  const obter = (k: string): string => {
    const v = campos.get(k);
    if (v === undefined) throw new Error(`falta o campo ${k}`);
    return v;
  };
  const conferida = obter("conferida");
  if (conferida !== "true" && conferida !== "false") throw new Error("conferida deve ser true ou false");
  const conferidaEm = campos.get("conferida_em") || null;
  if (conferida === "true" && !conferidaEm) throw new Error("conferida: true exige conferida_em");
  if (conferidaEm && !RE_DATA.test(conferidaEm)) throw new Error("conferida_em deve ser AAAA-MM-DD");
  const geradaEm = obter("gerada_em");
  if (!RE_DATA.test(geradaEm)) throw new Error("gerada_em deve ser AAAA-MM-DD");
  const impressao = obter("impressao_digital");
  if (!/^[0-9a-f]{64}$/.test(impressao)) throw new Error("impressao_digital deve ter 64 dígitos hexadecimais");

  const blocos = m[2]!.split(/^## /m).slice(1);
  if (blocos.length !== SECOES.length) throw new Error(`esperadas as seções ${SECOES.join(", ")}`);
  const secoes = blocos.map((b, i) => {
    const [titulo, ...resto] = b.split("\n");
    if (titulo!.trim() !== SECOES[i]) throw new Error(`seção ${i + 1} deve ser "${SECOES[i]}", veio "${titulo!.trim()}"`);
    const paragrafos = resto.join("\n").split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
    if (paragrafos.length === 0) throw new Error(`seção "${SECOES[i]}" vazia`);
    return paragrafos;
  });
  return { norma: obter("norma"), artigo: obter("artigo"), conferida: conferida === "true", conferidaEm, geradaEm, impressaoDigital: impressao, secoes };
}

/** Lê conteudo/fichas/<norma>/<artigo>.md; chave "<norma>|<id do artigo>". O nome do arquivo é o endereço da ficha. */
export function carregarExplicacoes(raiz: URL, normas: Norma[]): Map<string, Explicacao> {
  const saida = new Map<string, Explicacao>();
  for (const n of normas) {
    let arquivos: string[];
    try {
      arquivos = readdirSync(new URL(`conteudo/fichas/${n.slug}/`, raiz)).filter((a) => a.endsWith(".md"));
    } catch {
      continue;
    }
    for (const arq of arquivos) {
      const onde = `conteudo/fichas/${n.slug}/${arq}`;
      let e: Explicacao;
      try {
        e = lerExplicacao(readFileSync(new URL(onde, raiz), "utf8"));
      } catch (erro) {
        throw new Error(`${onde}: ${erro instanceof Error ? erro.message : String(erro)}`);
      }
      const artigo = n.artigos.find((a) => a.id === e.artigo);
      if (e.norma !== n.slug || !artigo) throw new Error(`${onde}: norma/artigo "${e.norma}/${e.artigo}" não existe`);
      if (n.slugs.get(artigo.id) !== arq.replace(/\.md$/, "")) throw new Error(`${onde}: o nome do arquivo deve ser ${n.slugs.get(artigo.id)}.md`);
      saida.set(`${n.slug}|${artigo.id}`, e);
    }
  }
  return saida;
}

const AVISO: Record<Situacao, (e: Explicacao) => string> = {
  "nao-conferida": () => `<div role="note" class="aviso nao-conferida"><strong>Não conferido.</strong> Confira contra o texto oficial acima antes de confiar.</div>`,
  conferida: (e) => `<div role="note" class="aviso conferida"><strong>Conferido em ${dataBr(e.conferidaEm!)}.</strong></div>`,
  desatualizada: () =>
    `<div role="note" class="aviso desatualizada"><strong>Texto legal mudou desde que esta explicação foi gerada.</strong> Ela volta a não conferida e pode estar desatualizada: leia o texto oficial acima.</div>`,
};

function linkProblema(norma: Norma, slug: string, artigo: Dispositivo, e: Explicacao, impressaoAtual: string): string {
  const url = `${SITE}lei/${norma.slug}/${slug}/`;
  const corpo = [
    "Tipo do problema (erro de conteúdo, explicação confusa, remissão errada, texto desatualizado):",
    "",
    "Descreva o problema:",
    "",
    "---",
    `Ficha: ${url}`,
    `Dispositivo: ${artigo.id}`,
    `Impressão digital da explicação: ${e.impressaoDigital}`,
    `Impressão digital do texto legal atual: ${impressaoAtual}`,
  ].join("\n");
  const titulo = `Problema na explicação: ${norma.nome}, ${slug}`;
  return `https://github.com/${REPOSITORIO}/issues/new?title=${encodeURIComponent(titulo)}&body=${encodeURIComponent(corpo)}`;
}

/** Bloco "Para que serve" da ficha; sem explicação, o bloco diz que ela ainda não existe. */
export function renderizarExplicacao(norma: Norma, slug: string, artigo: Dispositivo, e: Explicacao | undefined): string {
  if (!e) {
    return `<section aria-labelledby="t3" class="ia vazio"><h2 id="t3" class="rotulo rotulo-ia">Para que serve</h2><p class="nota">Ainda não gerado para este artigo.</p></section>`;
  }
  const atual = impressaoDigital(norma, artigo);
  const s = situacao(e, atual);
  const redacao = subarvore(norma.porId, artigo).reduce((max, d) => {
    const v = redacaoAtual(d);
    return v && v.data > max ? v.data : max;
  }, "");
  const paragrafos = SECOES.map((titulo, i) => e.secoes[i]!.map((p, j) => `<p>${j === 0 ? `<strong>${titulo}.</strong> ` : ""}${escapar(p)}</p>`).join("")).join("\n");
  return `<section aria-labelledby="t3" class="ia">
<div class="cabeca"><h2 id="t3" class="rotulo rotulo-ia">Para que serve</h2><span class="origem-ia">Gerado por inteligência artificial — não é texto de lei</span></div>
${AVISO[s](e)}
<div class="explicacao">
${paragrafos}
</div>
<div class="rodape-ia"><span>Gerado em ${dataBr(e.geradaEm)} para a redação de ${dataBr(redacao)}</span><a class="botao" href="${escapar(linkProblema(norma, slug, artigo, e, atual))}">Reportar problema</a></div>
</section>`;
}
