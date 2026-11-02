import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerNorma, redacaoAtual } from "../captura/ler.ts";
import { renderizarTextoLegal, hrefRemissao, escapar } from "./remissao.ts";

const URN_CF = "urn:lex:br:federal:constituicao:1988-10-05;1988";
const eco = (urn: string): string => `#${urn}`;

test("texto sem marcação só é escapado", () => {
  assert.equal(renderizarTextoLegal("a < b & c > \"d\"", eco), "a &lt; b &amp; c &gt; &quot;d&quot;");
  assert.equal(escapar("R&amp;D"), "R&amp;D");
});

test("span com xlink:href vira link", () => {
  const html = renderizarTextoLegal(`ver o <span xlink:href="${URN_CF}!art5">art. 5º</span>.`, eco);
  assert.equal(html, `ver o <a class="remissao" href="#${URN_CF}!art5">art. 5º</a>.`);
});

test("spans vizinhos com o mesmo alvo, com <i> no meio, viram um link só", () => {
  const u = `${URN_CF}!art155_cpt_inc1`;
  const texto = `<span xlink:href="${u}">inciso I do </span><i><span xlink:href="${u}">caput</span></i><span xlink:href="${u}"> do art. 155</span>`;
  assert.equal(renderizarTextoLegal(texto, eco), `<a class="remissao" href="#${u}">inciso I do <i>caput</i> do art. 155</a>`);
});

test("alvos diferentes viram links separados", () => {
  const texto = `<span xlink:href="a">um</span><span xlink:href="b">dois</span>`;
  assert.equal(renderizarTextoLegal(texto, eco), `<a class="remissao" href="#a">um</a><a class="remissao" href="#b">dois</a>`);
});

test("<i> sem link é preservado", () => {
  assert.equal(renderizarTextoLegal("o <i>caput</i> deste artigo", eco), "o <i>caput</i> deste artigo");
});

test('"nesta Lei Complementar" fica marcada como não resolvida, sem link', () => {
  const html = renderizarTextoLegal("previstas nesta Lei Complementar.", eco);
  assert.match(html, /<span class="nao-resolvida" title="[^"]+">nesta Lei Complementar<\/span>\./);
  assert.ok(!html.includes("<a "));
});

test("hrefRemissao: Constituição usa o endereço previsível; alvo desconhecido vai para a fonte", () => {
  assert.equal(hrefRemissao(`${URN_CF}!art155_cpt_inc1`), "../../constituicao-1988/art-155/#art155_cpt_inc1");
  assert.equal(hrefRemissao("urn:lex:br:federal:lei.complementar:2025-01-16;214@2026-01-13!art12_par3"), "../../lc-214-2025/art-12/#art12_par3");
  assert.equal(hrefRemissao("urn:lex:br:federal:lei:1996-01-01;999!art1"), "https://normas.leg.br/?urn=urn:lex:br:federal:lei:1996-01-01;999!art1");
  assert.equal(hrefRemissao(`${URN_CF}!anexo1`), `https://normas.leg.br/?urn=${URN_CF}!anexo1`);
});

test("art. 4º, § 5º, incisos: um link para cada artigo da Constituição, texto intacto", () => {
  const lc = lerNorma(JSON.parse(readFileSync(new URL("../dados/fonte/lc-214-2025.json", import.meta.url), "utf8")));
  const texto = (id: string): string => redacaoAtual(lc.find((d) => d.id === id)!)!.texto!;
  const i1 = renderizarTextoLegal(texto("art4_par5_inc1"), hrefRemissao);
  assert.equal((i1.match(/<a /g) ?? []).length, 1);
  assert.match(i1, /<a class="remissao" href="\.\.\/\.\.\/constituicao-1988\/art-155\/#art155_cpt_inc1">inciso I do <i>caput<\/i> do art\. 155 da Constituição Federal<\/a>;$/);
  const i2 = renderizarTextoLegal(texto("art4_par5_inc2"), hrefRemissao);
  assert.match(i2, /href="\.\.\/\.\.\/constituicao-1988\/art-156\/#art156_cpt_inc2">inciso II do <i>caput<\/i> do art\. 156 da Constituição Federal<\/a>\.$/);
});
