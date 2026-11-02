import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarInicial } from "./inicial.ts";

const html = gerarInicial([{ href: "lei/lc-214-2025/", nome: "Lei Complementar 214/2025", artigos: 580 }], "2026-10-31T13:36:00.000Z", "2026-08-27");

test("lista os treze temas em quatro lotes, todos em preparação", () => {
  assert.equal((html.match(/class="tema"/g) ?? []).length, 13);
  assert.equal((html.match(/<h3 class="rotulo">Lote \d<\/h3>/g) ?? []).length, 4);
  assert.equal((html.match(/Em preparação/g) ?? []).length, 13);
  assert.match(html, /Regimes específicos<\/span><span class="nota">Em preparação · panorama/);
});

test("link relativo para o índice de cada lei, com a contagem de artigos; datas da captura e da fonte", () => {
  assert.match(html, /<a href="lei\/lc-214-2025\/">Lei Complementar 214\/2025<\/a> <span class="nota">580 artigos<\/span>/);
  assert.match(html, /capturado do normas\.leg\.br em 31\/10\/2026/i);
  assert.match(html, /até 27\/08\/2026/);
});

test("rodapé com a atribuição e o aviso de que não substitui o texto oficial", () => {
  assert.match(html, /Não substitui o texto oficial/);
  assert.match(html, /Creative Commons Atribuição 4\.0/);
});

test("sem data de modificação na fonte, a linha some em vez de inventar", () => {
  assert.ok(!gerarInicial([], "2026-10-31", null).includes("Base atualizada"));
});
