import { test } from "node:test";
import assert from "node:assert/strict";
import { carregarBaseSincrona, norma } from "./carregar.ts";
import { gerarIndice } from "./indice.ts";

const base = carregarBaseSincrona();
const lc = norma(base, "lc-214-2025");
const html = gerarIndice(lc, "2026-10-31T13:36:00.000Z");

test("índice: estrutura em ordem, com link para cada ficha", () => {
  assert.match(html, /<h2 id="liv1" class="est">LIVRO I DO IMPOSTO SOBRE BENS E SERVIÇOS/);
  assert.match(html, /<h3 id="liv1_tit1" class="est">TÍTULO I DAS NORMAS GERAIS/);
  assert.equal((html.match(/<li><a href="art-[^"]+\/">Art\./g) ?? []).length, 580);
  assert.match(html, /<a href="art-4\/">Art\. 4º<\/a>/);
  assert.match(html, /<a href="art-7-a\/">Art\. 7º-A<\/a>/);
});

test("índice: os ids da trilha da ficha existem no índice", () => {
  for (const id of ["liv1", "liv1_tit1", "liv1_tit1_cap2", "liv1_tit1_cap2_sec1"]) assert.match(html, new RegExp(`id="${id}"`));
});

test("índice: anexos aparecem como lacuna, não como lista inventada", () => {
  assert.match(html, /Anexos: ainda não carregados/);
});

test("artigos que só existem citados em blocos de alteração não entram no índice", () => {
  assert.ok(!html.includes("art-9/\">Art. 9º</a></li><li><a href=\"art-496"));
  assert.equal((html.match(/id="/g) ?? []).length, lc.dispositivos.filter((d) => ["livro", "titulo", "capitulo", "secao", "subsecao"].includes(d.tipo) && !html.includes("__")).length - countEmBloco(lc));
});

function countEmBloco(n: typeof lc): number {
  let c = 0;
  for (const d of n.dispositivos) {
    if (!["livro", "titulo", "capitulo", "secao", "subsecao"].includes(d.tipo)) continue;
    for (let p = d.pai === null ? undefined : n.porId.get(d.pai); p; p = p.pai === null ? undefined : n.porId.get(p.pai)) if (p.tipo === "bloco.de.alteracao") { c++; break; }
  }
  return c;
}
