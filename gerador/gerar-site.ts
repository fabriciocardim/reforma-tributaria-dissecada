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
import { carregarVisao, ehNoDaEstrutura, type Visao } from "./visao.ts";
import { gerarBloco, gerarMapa } from "./bloco.ts";
import { idUrl } from "./util.ts";
import { carregarTemas, gerarTema, impressaoDoTema, situacaoTema } from "./tema.ts";

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
  const base = { normas, catalogo, manifesto };
  const temas = carregarTemas(RAIZ, base);
  cfg.temas = new Map();
  for (const t of temas) for (const r of t.artigos) {
    const norma = normas.find((n) => n.slug === r.norma)!;
    const artigo = norma.artigos.find((a) => norma.slugs.get(a.id) === r.ficha)!;
    const chave = `${norma.slug}|${artigo.id}`;
    cfg.temas.set(chave, [...(cfg.temas.get(chave) ?? []), { slug: t.tema, titulo: t.titulo }]);
  }
  const visoes = new Map<string, Visao>();
  for (const n of normas) {
    const v = carregarVisao(RAIZ, n, cfg.explicacoes);
    if (v) visoes.set(n.slug, v);
  }
  cfg.visoes = visoes;
  const ctx = { base, visoes, explicacoes: cfg.explicacoes, temas };
  await rm(new URL("site/", RAIZ), { recursive: true, force: true });
  for (const norma of normas) {
    await gravar(`lei/${norma.slug}/index.html`, gerarIndice(norma, manifesto.capturadoEm, visoes.get(norma.slug)));
    for (const artigo of norma.artigos) await gravar(`lei/${norma.slug}/${norma.slugs.get(artigo.id)}/index.html`, gerarFicha(cfg, norma, artigo.id));
    for (const no of norma.dispositivos.filter((d) => ehNoDaEstrutura(norma, d))) await gravar(`lei/${norma.slug}/bloco/${idUrl(no.id)}/index.html`, gerarBloco(norma, no, ctx, manifesto.capturadoEm));
    if (visoes.has(norma.slug)) await gravar(`lei/${norma.slug}/mapa/index.html`, gerarMapa(norma, ctx, manifesto.capturadoEm));
    console.log(`${norma.slug}: ${norma.artigos.length} fichas`);
  }
  for (const t of temas) await gravar(`tema/${t.tema}/index.html`, gerarTema(t, { base, explicacoes: cfg.explicacoes, capturadoEm: manifesto.capturadoEm }));
  console.log(`${temas.length} tema(s)`);
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
      temas.map((t) => {
        const s = situacaoTema(t, impressaoDoTema(base, t.artigos));
        return { slug: t.tema, situacao: s === "conferida" ? "Conferido" : s === "desatualizada" ? "Texto legal mudou" : "Não conferido", classe: s === "conferida" ? "conferida" : s === "desatualizada" ? "desatualizada" : "nao-conferida" };
      }),
    ),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  gerar().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.stack : erro);
    process.exit(1);
  });
}
