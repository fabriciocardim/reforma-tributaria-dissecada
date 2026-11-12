import { test } from "node:test";
import assert from "node:assert/strict";
import { carregarBaseSincrona, norma } from "./carregar.ts";
import { carregarExplicacoes } from "./explicacao.ts";
import { carregarTemas } from "./tema.ts";
import { carregarVisao, impressaoDoBloco, lerVisao, rotuloDoNo, situacaoDoBloco } from "./visao.ts";
import { cadeiaDoNo, gerarBloco, gerarMapa, idUrl } from "./bloco.ts";
import { gerarFicha } from "./ficha.ts";
import { gerarIndice } from "./indice.ts";
import { mostrarEfeitos } from "./carregar.ts";
import { problemas, textoLegalDoArtigo } from "./verificar.ts";

const RAIZ = new URL("../", import.meta.url);
const base = carregarBaseSincrona();
const n = norma(base, "lc-214-2025");
const explicacoes = carregarExplicacoes(RAIZ, base.normas);
const visao = carregarVisao(RAIZ, n, explicacoes)!;
const HASH = "a".repeat(64);
const ARQ = (corpo: string): string => `---\nnorma: x\ngerada_em: 2026-11-12\n---\n${corpo}`;
const BLOCO = `## liv1\npergunta: P?\nresumo: R.\nchaves: art-1\nconferida: false\nimpressao_digital: ${HASH}\n`;

test("lerVisao: lê campos, exceções e chaves", () => {
  const v = lerVisao(ARQ(BLOCO.replace("chaves: art-1", "regra: G.\nexcecoes: a ; b\nchaves: art-1, art-4")));
  const b = v.blocos.get("liv1")!;
  assert.equal(b.regra, "G.");
  assert.deepEqual(b.excecoes, ["a", "b"]);
  assert.deepEqual(b.chaves, ["art-1", "art-4"]);
});

test("lerVisao: rejeita campo faltando, repetido, conferida sem data e impressão inválida", () => {
  assert.throws(() => lerVisao(ARQ(BLOCO.replace("pergunta: P?\n", ""))), /falta o campo pergunta/);
  assert.throws(() => lerVisao(ARQ(BLOCO.replace("resumo: R.\n", "resumo: R.\nresumo: S.\n"))), /campo repetido/);
  assert.throws(() => lerVisao(ARQ(BLOCO.replace("conferida: false", "conferida: true"))), /conferida_em/);
  assert.throws(() => lerVisao(ARQ(BLOCO.replace(HASH, "carimbar"))), /64 dígitos/);
  assert.throws(() => lerVisao(ARQ(BLOCO + "\n" + BLOCO)), /repetido/);
});

test("carregarVisao valida nós e artigos-chave", () => {
  assert.ok(visao.blocos.size >= 37);
  for (const b of visao.blocos.values()) assert.ok(n.porId.has(b.id), b.id);
});

test("todos os blocos têm a impressão digital atual e nascem não conferidos", () => {
  for (const b of visao.blocos.values()) {
    assert.equal(b.impressaoDigital, impressaoDoBloco(n, b.chaves), `${b.id}: impressão digital desatualizada`);
    assert.equal(situacaoDoBloco(n, b), b.conferida ? "conferida" : "nao-conferida");
  }
});

test("a impressão do bloco muda quando a lista de artigos-chave muda", () => {
  assert.notEqual(impressaoDoBloco(n, ["art-1"]), impressaoDoBloco(n, ["art-1", "art-4"]));
});

const falhas: string[] = [];
test("todo número e toda sigla do bloco existem no texto legal dos artigos-chave ou nos títulos da estrutura", () => {
  for (const b of visao.blocos.values()) {
    const legal = [
      ...b.chaves.map((slug) => textoLegalDoArtigo(n.porId, n.artigos.find((a) => n.slugs.get(a.id) === slug)!)),
      ...cadeiaDoNo(n, n.porId.get(b.id)!).map((d) => { const r = rotuloDoNo(d); return `${r.rotulo} ${r.titulo}`; }),
    ].join(" \n ");
    const corpo = [b.pergunta, b.resumo, b.regra ?? "", ...b.excecoes].join(" \n ");
    const pr = problemas(corpo, legal, ""); if (pr.length) falhas.push(`${b.id}: ${pr.join("; ")}`);
  }
});

test("página do bloco: trilha, pergunta, rótulo de IA e filhos", () => {
  const html = gerarBloco(n, n.porId.get("liv1_tit1_cap2")!, { base, visoes: new Map([[n.slug, visao]]), explicacoes, temas: [] }, base.manifesto.capturadoEm);
  assert.match(html, /Gerado por inteligência artificial — não é texto de lei/);
  assert.match(html, /Pergunta que este bloco responde/);
  assert.match(html, /href="\.\.\/liv1_tit1_cap2_sec1\/"/);
  assert.match(html, /Não conferido/);
  assert.match(html, /href="\.\.\/\.\.\/art-4\/"/);
});

test("bloco sem conteúdo gerado continua navegável", () => {
  const html = gerarBloco(n, n.porId.get("liv1_tit4_cap3")!, { base, visoes: new Map([[n.slug, visao]]), explicacoes, temas: [] }, base.manifesto.capturadoEm);
  assert.match(html, /Ainda não gerada/);
  assert.match(html, /Dentro deste bloco/);
});

test("mapa lista os livros e os títulos com seus resumos", () => {
  const html = gerarMapa(n, { base, visoes: new Map([[n.slug, visao]]), explicacoes, temas: carregarTemas(RAIZ, base) }, base.manifesto.capturadoEm);
  assert.match(html, /Mapa da/);
  for (const id of ["liv1", "liv2", "liv3", "liv1_tit5"]) assert.ok(html.includes(`bloco/${idUrl(id)}/`), id);
  assert.match(html, /percurso/);
});

test("ficha: trilha aponta para as páginas dos blocos e mostra 'Neste bloco'", () => {
  const cfg = { catalogo: base.catalogo, capturadoEm: base.manifesto.capturadoEm, mostrarEfeitos, explicacoes, visoes: new Map([[n.slug, visao]]) };
  const html = gerarFicha(cfg, n, "art4");
  assert.match(html, /href="\.\.\/bloco\/liv1_tit1_cap2_sec1\/"/);
  assert.match(html, /Neste bloco/);
});

test("índice liga cada título à página do bloco", () => {
  assert.match(gerarIndice(n, base.manifesto.capturadoEm, visao), /href="bloco\/liv1_tit1_cap2\/"/);
});

test("toda página de bloco da estrutura é gerada sem erro nas três normas", () => {
  for (const nm of base.normas) for (const d of nm.dispositivos) {
    if (!["livro", "titulo", "capitulo", "secao", "subsecao"].includes(d.tipo)) continue;
    if (nm.porId.get(d.id) !== d) continue;
    try { gerarBloco(nm, d, { base, visoes: new Map(), explicacoes, temas: [] }, base.manifesto.capturadoEm); } catch (e) { assert.fail(`${nm.slug} ${d.id}: ${e}`); }
  }
});
