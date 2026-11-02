/*
 * Gera a ficha do art. 4º da Lei Complementar 214/2025 em site/lei/lc-214-2025/art-4/index.html.
 * Uso: node gerador/gerar-ficha.ts
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { lerNorma } from "../captura/ler.ts";
import type { Manifesto } from "../captura/capturar.ts";
import { FONTES } from "../captura/fontes.ts";
import { gerarFicha, type Lei } from "./ficha.ts";

const RAIZ = new URL("../", import.meta.url);

async function gerar(): Promise<void> {
  const fonte = FONTES.find((f) => f.nome === "lc-214-2025")!;
  const lei: Lei = { slug: fonte.nome, nome: "Lei Complementar 214/2025", urn: fonte.urn };
  const json: unknown = JSON.parse(await readFile(new URL(`dados/fonte/${fonte.nome}.json`, RAIZ), "utf8"));
  const manifesto = JSON.parse(await readFile(new URL("dados/fonte/manifesto.json", RAIZ), "utf8")) as Manifesto;
  const html = gerarFicha(lei, lerNorma(json), "art4", manifesto.capturadoEm);
  const pasta = new URL(`site/lei/${lei.slug}/art-4/`, RAIZ);
  await mkdir(pasta, { recursive: true });
  await writeFile(new URL("index.html", pasta), html);
  console.log(`${pasta.pathname}index.html`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  gerar().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
}
