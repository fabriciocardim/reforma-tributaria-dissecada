/*
 * Carimba a impressão digital nos arquivos de explicação recém-escritos: só troca o valor
 * `carimbar` de `impressao_digital`, nunca uma impressão que já existe (ela é o que prova qual texto
 * legal foi explicado). Escreva o arquivo contra o texto capturado e carimbe logo em seguida.
 * Uso: node gerador/carimbar.ts [norma] [posição inicial] [posição final]   (sem argumentos, carimba todos)
 *      node gerador/carimbar.ts visao <norma>                                   (carimba conteudo/visao/<norma>.md)
 *      node gerador/carimbar.ts temas                                           (carimba conteudo/temas)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { carregarBaseSincrona } from "./carregar.ts";
import { impressaoDigital } from "./explicacao.ts";
import { impressaoDoTema, lerRef } from "./tema.ts";
import { impressaoDoBloco } from "./visao.ts";

const RAIZ = new URL("../", import.meta.url);

function carimbarTemas(): void {
  const base = carregarBaseSincrona();
  let feitos = 0;
  for (const arq of readdirSync(new URL("conteudo/temas/", RAIZ)).filter((a) => a.endsWith(".md"))) {
    const caminho = new URL(`conteudo/temas/${arq}`, RAIZ);
    const texto = readFileSync(caminho, "utf8");
    if (!/^impressao_digital:\s*carimbar\s*$/m.test(texto)) continue;
    const artigos = /^artigos:\s*(.+)$/m.exec(texto)?.[1];
    if (!artigos) throw new Error(`${arq}: falta o campo artigos`);
    const impressao = impressaoDoTema(base, artigos.split(",").map((a) => lerRef(a)));
    writeFileSync(caminho, texto.replace(/^impressao_digital:\s*carimbar\s*$/m, `impressao_digital: ${impressao}`));
    feitos++;
  }
  console.log(`${feitos} tema(s) carimbado(s)`);
}

function carimbarVisao(slug: string | undefined): void {
  const { normas } = carregarBaseSincrona();
  const n = normas.find((x) => x.slug === slug);
  if (!n) throw new Error(`uso: carimbar visao <norma>`);
  const caminho = new URL(`conteudo/visao/${n.slug}.md`, RAIZ);
  const partes = readFileSync(caminho, "utf8").split(/^(?=## )/m);
  let feitos = 0;
  const saida = partes.map((p) => {
    if (!/^impressao_digital:[ \t]*carimbar[ \t]*$/m.test(p)) return p;
    const chaves = /^chaves:\s*(.+)$/m.exec(p)?.[1];
    if (!chaves) throw new Error(`bloco sem chaves: ${p.split("\n")[0]}`);
    feitos++;
    return p.replace(/^impressao_digital:[ \t]*carimbar[ \t]*$/m, `impressao_digital: ${impressaoDoBloco(n, chaves.split(",").map((c) => c.trim()).filter(Boolean))}`);
  });
  writeFileSync(caminho, saida.join(""));
  console.log(`${feitos} bloco(s) carimbado(s)`);
}

function carimbar(): void {
  const [so, de, ate] = process.argv.slice(2);
  if (so === "temas") return carimbarTemas();
  if (so === "visao") return carimbarVisao(de);
  const { normas } = carregarBaseSincrona();
  let feitos = 0;
  for (const n of normas.filter((x) => !so || x.slug === so)) {
    let arquivos: string[];
    try {
      arquivos = readdirSync(new URL(`conteudo/fichas/${n.slug}/`, RAIZ)).filter((a) => a.endsWith(".md"));
    } catch {
      continue;
    }
    for (const arq of arquivos) {
      const posicao = n.artigos.findIndex((a) => n.slugs.get(a.id) === arq.replace(/\.md$/, "")) + 1;
      if (de && (posicao === 0 || posicao < Number(de))) continue;
      if (ate && posicao > Number(ate)) continue;
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
