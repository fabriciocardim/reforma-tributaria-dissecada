/*
 * Gera o site completo em site/: a página inicial e, para cada norma de captura/fontes.ts, o índice
 * (site/lei/<norma>/index.html) e a ficha de cada artigo (site/lei/<norma>/art-<n>/index.html).
 * Uso: node gerador/gerar-site.ts
 */
import { writeFile, mkdir, rm } from "node:fs/promises";
import { gerarFicha, type ConfiguracaoFicha } from "./ficha.ts";
import { gerarIndice } from "./indice.ts";
import { gerarInicial } from "./inicial.ts";
import { carregarBase, mostrarEfeitos } from "./carregar.ts";
import { carregarExplicacoes } from "./explicacao.ts";

const RAIZ = new URL("../", import.meta.url);

async function gravar(caminho: string, html: string): Promise<void> {
  const arquivo = new URL(`site/${caminho}`, RAIZ);
  await mkdir(new URL(".", arquivo), { recursive: true });
  await writeFile(arquivo, html);
}

async function gerar(): Promise<void> {
  const { normas, catalogo, manifesto } = await carregarBase();
  const cfg: ConfiguracaoFicha = {
    catalogo,
    capturadoEm: manifesto.capturadoEm,
    mostrarEfeitos,
    explicacoes: carregarExplicacoes(RAIZ, normas),
  };
  await rm(new URL("site/", RAIZ), { recursive: true, force: true });
  for (const norma of normas) {
    await gravar(`lei/${norma.slug}/index.html`, gerarIndice(norma, manifesto.capturadoEm));
    for (const artigo of norma.artigos) await gravar(`lei/${norma.slug}/${norma.slugs.get(artigo.id)}/index.html`, gerarFicha(cfg, norma, artigo.id));
    console.log(`${norma.slug}: ${norma.artigos.length} fichas`);
  }
  const modificada = manifesto.normas.find((n) => n.nome === "lc-214-2025")?.modificadaNaFonte ?? null;
  await gravar(
    "index.html",
    gerarInicial(
      normas.map((n) => ({
        href: `lei/${n.slug}/`,
        nome: n.nome,
        artigos: n.artigos.length,
        explicacoes: n.artigos.filter((a) => cfg.explicacoes.has(`${n.slug}|${a.id}`)).length,
      })),
      manifesto.capturadoEm,
      modificada,
    ),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  gerar().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.stack : erro);
    process.exit(1);
  });
}
