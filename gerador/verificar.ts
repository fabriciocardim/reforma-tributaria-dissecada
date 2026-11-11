/*
 * Confere as explicações contra o texto legal da captura: todo número citado (artigo, prazo, percentual,
 * ano) precisa existir no texto do artigo, e toda sigla precisa vir definida entre parênteses na própria
 * explicação. Aponta; quem escreveu decide. Sai com código 1 se achar algo.
 * Uso: node gerador/verificar.ts [norma] [posição inicial] [posição final]   (posições 1-based)
 *      node gerador/verificar.ts <norma> art-43,art-50,...                     (só estes endereços)
 * Aceita `impressao_digital: carimbar` (ainda sem carimbo): confere o conteúdo mesmo assim.
 */
import { readFileSync, readdirSync } from "node:fs";
import { redacaoAtual } from "../captura/ler.ts";
import { carregarBaseSincrona, norma as obterNorma } from "./carregar.ts";
import { lerExplicacao } from "./explicacao.ts";
import { subarvore } from "./util.ts";

const RAIZ = new URL("../", import.meta.url);
const SIGLAS_PERMITIDAS = new Set(["PIS", "ADCT"]);

export function textoLegalDoArtigo(porId: Parameters<typeof subarvore>[0], artigo: Parameters<typeof subarvore>[1]): string {
  const partes: string[] = [];
  for (const d of subarvore(porId, artigo)) {
    for (const v of d.versoes) {
      partes.push(v.rotulo, v.texto ?? "", v.causa?.nome ?? "", v.nota ?? "", v.data.split("-").join("/"), v.vigencia ?? "");
    }
  }
  return partes.join(" \n ").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"');
}

const RE_NUMERO = /\d+(?:[.,]\d+)*/g;
const RE_ROMANO = /^[IVXLCDM]+$/;

/** Contexto para aceitar citação de outro artigo que o texto do artigo não traz. */
export interface Vizinhanca {
  numero: number;
  /** O artigo `n` cita o artigo desta ficha? */
  citaEste: (n: number) => boolean;
}

export function problemas(corpo: string, textoLegal: string, rotuloArtigo: string, viz?: Vizinhanca): string[] {
  const achados: string[] = [];
  const legal = `${textoLegal} ${rotuloArtigo}`;
  const numerosLegais = new Set(legal.match(RE_NUMERO) ?? []);
  const citados = new Set([...corpo.matchAll(/\barts?\.?\s*(\d+)/gi)].map((m) => m[1]!));
  const aceitoOutroArtigo = (t: string): boolean => viz !== undefined && citados.has(t) && (Math.abs(Number(t) - viz.numero) === 1 || viz.citaEste(Number(t)));
  const dentroDeOutroArtigo = new Set<string>();
  for (const m of corpo.matchAll(/(?:§§?\s*|incisos?\s+\w+\s+do\s+§\s*)(\d+)\s*º?[^.;]{0,30}?\bdo\s+art\.?\s*(\d+)/gi)) if (aceitoOutroArtigo(m[2]!)) dentroDeOutroArtigo.add(m[1]!);
  for (const t of new Set(corpo.match(RE_NUMERO) ?? [])) {
    if (numerosLegais.has(t) || dentroDeOutroArtigo.has(t) || aceitoOutroArtigo(t)) continue;
    achados.push(`número "${t}" não está no texto legal do artigo`);
  }
  for (const s of new Set(corpo.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}\b/g) ?? [])) {
    if (RE_ROMANO.test(s)) continue;
    if (SIGLAS_PERMITIDAS.has(s) && legal.includes(s)) continue;
    if (!corpo.includes(`(${s})`)) achados.push(`sigla "${s}" sem definição entre parênteses`);
  }
  return achados;
}

function verificar(): number {
  const [slug = "lc-214-2025", de, ate] = process.argv.slice(2);
  const base = carregarBaseSincrona();
  const n = obterNorma(base, slug);
  const lista = de && !/^\d+$/.test(de) ? new Set(de.split(",")) : null;
  const inicio = lista ? 1 : de ? Number(de) : 1;
  const fim = lista ? n.artigos.length : ate ? Number(ate) : n.artigos.length;
  let total = 0;
  let comProblema = 0;
  const pasta = new URL(`conteudo/fichas/${slug}/`, RAIZ);
  for (const arq of readdirSync(pasta).filter((a) => a.endsWith(".md")).sort()) {
    const posicao = n.artigos.findIndex((a) => n.slugs.get(a.id) === arq.replace(/\.md$/, "")) + 1;
    if (posicao < inicio || posicao > fim) continue;
    if (lista && !lista.has(arq.replace(/\.md$/, ""))) continue;
    total++;
    const achados: string[] = [];
    try {
      const e = lerExplicacao(readFileSync(new URL(arq, pasta), "utf8").replace(/^impressao_digital:\s*carimbar\s*$/m, `impressao_digital: ${"0".repeat(64)}`));
      const artigo = n.artigos[posicao - 1]!;
      if (e.artigo !== artigo.id) achados.push(`artigo "${e.artigo}" não é o do arquivo (${artigo.id})`);
      const rotulo = redacaoAtual(artigo)?.rotulo ?? "";
      const numero = Number(/\d+/.exec(rotulo)?.[0] ?? 0);
      const viz: Vizinhanca = {
        numero,
        citaEste: (m) => {
          const outro = n.artigos.find((a) => Number(/\d+/.exec(redacaoAtual(a)?.rotulo ?? "")?.[0]) === m);
          return outro ? new RegExp(`art[^;]{0,40}\\b${numero}\\b`).test(textoLegalDoArtigo(n.porId, outro)) : false;
        },
      };
      achados.push(...problemas(e.secoes.flat().join("\n"), textoLegalDoArtigo(n.porId, artigo), rotulo, viz));
    } catch (erro) {
      achados.push(erro instanceof Error ? erro.message : String(erro));
    }
    if (achados.length) {
      comProblema++;
      console.log(`${arq}:\n  - ${achados.join("\n  - ")}`);
    }
  }
  console.log(`${total} arquivo(s) verificados, ${comProblema} com apontamentos`);
  return comProblema === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(verificar());
