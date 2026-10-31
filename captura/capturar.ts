/*
 * Captura: baixa cada norma de FONTES do normas.leg.br e grava a resposta SEM ALTERAÇÃO em
 * dados/fonte/<nome>.json (princípio 1: texto oficial intacto). O manifesto registra data,
 * tamanho e impressão digital de cada arquivo, para a página "o que mudou".
 *
 * Uso: node captura/capturar.ts
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { FONTES, urlDaFonte } from "./fontes.ts";

const PASTA = new URL("../dados/fonte/", import.meta.url);

export interface ItemManifesto {
  nome: string;
  urn: string;
  bytes: number;
  sha256: string;
  /** dateModified informado pela fonte; null quando ela não informa. */
  modificadaNaFonte: string | null;
}

export interface Manifesto {
  capturadoEm: string;
  origem: string;
  normas: ItemManifesto[];
}

async function manifestoAnterior(): Promise<Manifesto | null> {
  try {
    return JSON.parse(await readFile(new URL("manifesto.json", PASTA), "utf8")) as Manifesto;
  } catch {
    return null;
  }
}

async function capturar(): Promise<void> {
  await mkdir(PASTA, { recursive: true });
  const anterior = await manifestoAnterior();
  const normas: ItemManifesto[] = [];
  for (const fonte of FONTES) {
    const resposta = await fetch(urlDaFonte(fonte.urn), { headers: { Accept: "application/json" } });
    if (resposta.status !== 200) throw new Error(`${fonte.nome}: a fonte respondeu HTTP ${resposta.status}. Nada foi gravado.`);
    const bytes = Buffer.from(await resposta.arrayBuffer());
    const json = JSON.parse(bytes.toString("utf8")) as { dateModified?: string };
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    normas.push({ nome: fonte.nome, urn: fonte.urn, bytes: bytes.length, sha256, modificadaNaFonte: json.dateModified ?? null });
    const antes = anterior?.normas.find((n) => n.nome === fonte.nome);
    console.log(`${fonte.nome}: ${bytes.length} bytes, ${antes?.sha256 === sha256 ? "sem mudança" : "MUDOU"}`);
    await writeFile(new URL(`${fonte.nome}.json`, PASTA), bytes);
  }
  const manifesto: Manifesto = { capturadoEm: new Date().toISOString(), origem: "normas.leg.br, script de captura", normas };
  await writeFile(new URL("manifesto.json", PASTA), JSON.stringify(manifesto, null, 2) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  capturar().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
}
