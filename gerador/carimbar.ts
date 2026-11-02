/*
 * Carimba a impressão digital nos arquivos de explicação recém-escritos: só troca o valor
 * `carimbar` de `impressao_digital`, nunca uma impressão que já existe (ela é o que prova qual texto
 * legal foi explicado). Escreva o arquivo contra o texto capturado e carimbe logo em seguida.
 * Uso: node gerador/carimbar.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { carregarBaseSincrona } from "./carregar.ts";
import { impressaoDigital } from "./explicacao.ts";

const RAIZ = new URL("../", import.meta.url);

function carimbar(): void {
  const { normas } = carregarBaseSincrona();
  let feitos = 0;
  for (const n of normas) {
    let arquivos: string[];
    try {
      arquivos = readdirSync(new URL(`conteudo/fichas/${n.slug}/`, RAIZ)).filter((a) => a.endsWith(".md"));
    } catch {
      continue;
    }
    for (const arq of arquivos) {
      const caminho = new URL(`conteudo/fichas/${n.slug}/${arq}`, RAIZ);
      const texto = readFileSync(caminho, "utf8");
      if (!/^impressao_digital:\s*carimbar\s*$/m.test(texto)) continue;
      const id = /^artigo:\s*(\S+)\s*$/m.exec(texto)?.[1];
      const artigo = n.artigos.find((a) => a.id === id);
      if (!artigo) throw new Error(`${arq}: artigo "${id}" não existe em ${n.slug}`);
      writeFileSync(caminho, texto.replace(/^impressao_digital:\s*carimbar\s*$/m, `impressao_digital: ${impressaoDigital(n, artigo)}`));
      feitos++;
    }
  }
  console.log(`${feitos} arquivo(s) carimbado(s)`);
}

carimbar();
