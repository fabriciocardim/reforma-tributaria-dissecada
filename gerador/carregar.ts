/*
 * Carrega a base capturada (dados/fonte) como normas prontas para gerar páginas.
 */
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { lerNorma } from "../captura/ler.ts";
import type { Manifesto } from "../captura/capturar.ts";
import { FONTES } from "../captura/fontes.ts";
import type { Versao } from "../captura/ler.ts";
import { Catalogo, montarNorma, type Norma } from "./norma.ts";

const RAIZ = new URL("../", import.meta.url);

export const NOMES: Record<string, string> = {
  "lc-214-2025": "Lei Complementar 214/2025",
  "constituicao-1988": "Constituição Federal de 1988",
  "ec-132-2023": "Emenda Constitucional 132/2023",
};

export interface Base {
  normas: Norma[];
  catalogo: Catalogo;
  manifesto: Manifesto;
}

function montar(jsons: unknown[], manifesto: Manifesto): Base {
  const normas = FONTES.map((f, i) => montarNorma({ slug: f.nome, nome: NOMES[f.nome] ?? f.nome, urn: f.urn }, lerNorma(jsons[i])));
  return { normas, catalogo: new Catalogo(normas), manifesto };
}

export async function carregarBase(): Promise<Base> {
  const manifesto = JSON.parse(await readFile(new URL("dados/fonte/manifesto.json", RAIZ), "utf8")) as Manifesto;
  const jsons = await Promise.all(FONTES.map(async (f) => JSON.parse(await readFile(new URL(`dados/fonte/${f.nome}.json`, RAIZ), "utf8")) as unknown));
  return montar(jsons, manifesto);
}

export function carregarBaseSincrona(): Base {
  const manifesto = JSON.parse(readFileSync(new URL("dados/fonte/manifesto.json", RAIZ), "utf8")) as Manifesto;
  const jsons = FONTES.map((f) => JSON.parse(readFileSync(new URL(`dados/fonte/${f.nome}.json`, RAIZ), "utf8")) as unknown);
  return montar(jsons, manifesto);
}

export const norma = (base: Base, slug: string): Norma => {
  const n = base.normas.find((x) => x.slug === slug);
  if (!n) throw new Error(`norma ${slug} não carregada`);
  return n;
};

/** "Efeitos: não carregada" onde a data de efeitos viria do art. 544 da Lei Complementar 214/2025 ou da Emenda Constitucional 132/2023. */
export function mostrarEfeitos(norma: Norma, versao: Versao): boolean {
  if (norma.slug === "lc-214-2025") return true;
  return norma.slug === "constituicao-1988" && (versao.causa?.urn ?? "").includes("emenda.constitucional:2023-12-20;132");
}
