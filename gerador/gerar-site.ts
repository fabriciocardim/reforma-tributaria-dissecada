/*
 * Gera o site em site/: a página inicial e a ficha do art. 4º da Lei Complementar 214/2025
 * (site/lei/lc-214-2025/art-4/index.html).
 * Uso: node gerador/gerar-site.ts
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { lerNorma } from "../captura/ler.ts";
import type { Manifesto } from "../captura/capturar.ts";
import { FONTES } from "../captura/fontes.ts";
import { gerarFicha, type Lei } from "./ficha.ts";
import { gerarInicial } from "./inicial.ts";

const RAIZ = new URL("../", import.meta.url);

async function gravar(caminho: string, html: string): Promise<void> {
  const arquivo = new URL(`site/${caminho}`, RAIZ);
  await mkdir(new URL(".", arquivo), { recursive: true });
  await writeFile(arquivo, html);
  console.log(arquivo.pathname);
}

async function gerar(): Promise<void> {
  const fonte = FONTES.find((f) => f.nome === "lc-214-2025")!;
  const lei: Lei = { slug: fonte.nome, nome: "Lei Complementar 214/2025", urn: fonte.urn };
  const json: unknown = JSON.parse(await readFile(new URL(`dados/fonte/${fonte.nome}.json`, RAIZ), "utf8"));
  const manifesto = JSON.parse(await readFile(new URL("dados/fonte/manifesto.json", RAIZ), "utf8")) as Manifesto;
  const modificada = manifesto.normas.find((n) => n.nome === fonte.nome)?.modificadaNaFonte ?? null;

  await gravar(`lei/${lei.slug}/art-4/index.html`, gerarFicha(lei, lerNorma(json), "art4", manifesto.capturadoEm));
  await gravar(
    "index.html",
    gerarInicial([{ href: `lei/${lei.slug}/art-4/`, titulo: `${lei.nome}, art. 4º` }], manifesto.capturadoEm, modificada),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  gerar().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
}
