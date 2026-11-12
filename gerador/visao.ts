/*
 * Visão geral da lei (docs/design.md, "Páginas"): para cada bloco da estrutura (livro, título, capítulo,
 * seção) a pergunta que ele responde, uma frase em linguagem comum, a regra geral, as exceções e os
 * artigos-chave. É interpretação gerada por inteligência artificial, em conteudo/visao/<norma>.md,
 * separada do texto legal. A impressão digital de cada bloco cobre o texto legal dos seus artigos-chave:
 * se um deles mudar, o bloco volta a "desatualizado".
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { redacaoAtual, type Dispositivo } from "../captura/ler.ts";
import { impressaoDigital, situacao as situacaoFicha, type Explicacao, type Situacao } from "./explicacao.ts";
import { emBloco, TIPOS_ESTRUTURA, type Norma } from "./norma.ts";

export interface Bloco {
  /** id do nó da estrutura na base ("liv1_tit1_cap2"). */
  id: string;
  pergunta: string;
  resumo: string;
  regra: string | null;
  excecoes: string[];
  /** Endereços das fichas dos artigos-chave ("art-4"). */
  chaves: string[];
  conferida: boolean;
  conferidaEm: string | null;
  impressaoDigital: string;
}

export interface Visao {
  norma: string;
  geradaEm: string;
  blocos: Map<string, Bloco>;
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function lerVisao(markdown: string): Visao {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(markdown);
  if (!m) throw new Error("falta o cabeçalho entre ---");
  const cab = new Map<string, string>();
  for (const linha of m[1]!.split("\n")) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(linha);
    if (!kv) throw new Error(`linha do cabeçalho inválida: "${linha}"`);
    cab.set(kv[1]!, kv[2]!.trim());
  }
  if (!cab.get("norma")) throw new Error("falta o campo norma");
  if (!RE_DATA.test(cab.get("gerada_em") ?? "")) throw new Error("gerada_em deve ser AAAA-MM-DD");
  const blocos = new Map<string, Bloco>();
  for (const texto of m[2]!.split(/^## /m).slice(1)) {
    const [idLinha, ...linhas] = texto.split("\n");
    const id = idLinha!.trim();
    try {
      const campos = new Map<string, string>();
      for (const linha of linhas) {
        if (!linha.trim()) continue;
        const kv = /^([a-z_]+):\s*(.*)$/.exec(linha);
        if (!kv) throw new Error(`linha inválida: "${linha}"`);
        if (campos.has(kv[1]!)) throw new Error(`campo repetido: ${kv[1]}`);
        campos.set(kv[1]!, kv[2]!.trim());
      }
      const obter = (k: string): string => {
        const v = campos.get(k);
        if (!v) throw new Error(`falta o campo ${k}`);
        return v;
      };
      const conferida = obter("conferida");
      if (conferida !== "true" && conferida !== "false") throw new Error("conferida deve ser true ou false");
      const conferidaEm = campos.get("conferida_em") || null;
      if (conferida === "true" && (!conferidaEm || !RE_DATA.test(conferidaEm))) throw new Error("conferida: true exige conferida_em AAAA-MM-DD");
      const impressao = obter("impressao_digital");
      if (!/^[0-9a-f]{64}$/.test(impressao)) throw new Error("impressao_digital deve ter 64 dígitos hexadecimais");
      const chaves = obter("chaves").split(",").map((c) => c.trim()).filter(Boolean);
      if (chaves.length === 0) throw new Error("chaves vazias");
      if (blocos.has(id)) throw new Error("bloco repetido");
      blocos.set(id, {
        id,
        pergunta: obter("pergunta"),
        resumo: obter("resumo"),
        regra: campos.get("regra") || null,
        excecoes: (campos.get("excecoes") ?? "").split(" ; ").map((e) => e.trim()).filter(Boolean),
        chaves,
        conferida: conferida === "true",
        conferidaEm,
        impressaoDigital: impressao,
      });
    } catch (erro) {
      throw new Error(`bloco ${id}: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  }
  return { norma: cab.get("norma")!, geradaEm: cab.get("gerada_em")!, blocos };
}

/** Nó da estrutura (livro, título, capítulo, seção, subseção) que não está dentro de bloco de alteração. */
export function ehNoDaEstrutura(norma: Norma, d: Dispositivo): boolean {
  return TIPOS_ESTRUTURA.includes(d.tipo) && !emBloco(norma.porId, d);
}

function artigoDaFicha(norma: Norma, slug: string): Dispositivo | undefined {
  return norma.artigos.find((a) => norma.slugs.get(a.id) === slug);
}

export function impressaoDoBloco(norma: Norma, chaves: string[]): string {
  const linhas = chaves.map((slug) => {
    const a = artigoDaFicha(norma, slug);
    if (!a) throw new Error(`artigo-chave ${slug} não existe em ${norma.slug}`);
    return `${slug}\t${impressaoDigital(norma, a)}`;
  });
  return createHash("sha256").update(linhas.join("\n")).digest("hex");
}

export function situacaoDoBloco(norma: Norma, b: Bloco): Situacao {
  if (impressaoDoBloco(norma, b.chaves) !== b.impressaoDigital) return "desatualizada";
  return b.conferida ? "conferida" : "nao-conferida";
}

/** Lê conteudo/visao/<norma>.md e valida: nós existentes, artigos-chave existentes e já explicados. */
export function carregarVisao(raiz: URL, norma: Norma, explicacoes: Map<string, Explicacao>): Visao | null {
  let texto: string;
  try {
    texto = readFileSync(new URL(`conteudo/visao/${norma.slug}.md`, raiz), "utf8");
  } catch {
    return null;
  }
  const onde = `conteudo/visao/${norma.slug}.md`;
  try {
    const v = lerVisao(texto);
    if (v.norma !== norma.slug) throw new Error(`norma "${v.norma}" não é ${norma.slug}`);
    for (const b of v.blocos.values()) {
      const no = norma.porId.get(b.id);
      if (!no || !ehNoDaEstrutura(norma, no)) throw new Error(`bloco ${b.id}: não é um nó da estrutura de ${norma.slug}`);
      for (const slug of b.chaves) {
        const a = artigoDaFicha(norma, slug);
        if (!a) throw new Error(`bloco ${b.id}: artigo-chave ${slug} não existe`);
        if (!explicacoes.has(`${norma.slug}|${a.id}`)) throw new Error(`bloco ${b.id}: artigo-chave ${slug} sem "Para que serve"`);
      }
    }
    return v;
  } catch (erro) {
    throw new Error(`${onde}: ${erro instanceof Error ? erro.message : String(erro)}`);
  }
}

export function rotuloDoNo(d: Dispositivo): { rotulo: string; titulo: string } {
  const v = redacaoAtual(d);
  return { rotulo: v?.rotulo ?? d.id, titulo: v?.texto ?? "" };
}
