import { test } from "node:test";
import assert from "node:assert/strict";
import { renderizarTextoLegal, escapar, type Opcoes } from "./remissao.ts";
import { carregarBaseSincrona, norma } from "./carregar.ts";
import { redacaoAtual } from "../captura/ler.ts";

const URN_CF = "urn:lex:br:federal:constituicao:1988-10-05;1988";
const eco: Opcoes = { resolverUrn: (urn) => ({ href: `#${urn}` }) };
const html = (texto: string, op: Opcoes = eco): string => renderizarTextoLegal(texto, op).html;

test("texto sem marcação só é escapado", () => {
  assert.equal(html('a < b & c > "d"'), "a &lt; b &amp; c &gt; &quot;d&quot;");
  assert.equal(escapar("R&amp;D"), "R&amp;D");
});

test("span com xlink:href vira link", () => {
  assert.equal(html(`ver o <span xlink:href="${URN_CF}!art5">art. 5º</span>.`), `ver o <a class="remissao" href="#${URN_CF}!art5">art. 5º</a>.`);
});

test("spans vizinhos com o mesmo alvo, com <i> no meio, viram um link só", () => {
  const u = `${URN_CF}!art155_cpt_inc1`;
  const texto = `<span xlink:href="${u}">inciso I do </span><i><span xlink:href="${u}">caput</span></i><span xlink:href="${u}"> do art. 155</span>`;
  assert.equal(html(texto), `<a class="remissao" href="#${u}">inciso I do <i>caput</i> do art. 155</a>`);
});

test("alvos diferentes viram links separados", () => {
  assert.equal(html(`<span xlink:href="a">um</span><span xlink:href="b">dois</span>`), `<a class="remissao" href="#a">um</a><a class="remissao" href="#b">dois</a>`);
});

test("<i> sem link é preservado", () => {
  assert.equal(html("o <i>caput</i> deste artigo"), "o <i>caput</i> deste artigo");
});

test("frase vaga marcada como não resolvida, sem link", () => {
  const r = html("previstas nesta Lei Complementar.", { ...eco, naoResolvidas: /\b(?:nesta|desta) Lei Complementar\b/g });
  assert.match(r, /<span class="nao-resolvida" title="[^"]+">nesta Lei Complementar<\/span>\./);
  assert.ok(!r.includes("<a "));
});

test("remissões locais: um link atravessando o <i>, sem perder o itálico", () => {
  const locais: Opcoes["locais"] = (plano) => {
    const inicio = plano.indexOf("caput deste artigo");
    return [{ inicio, fim: inicio + "caput deste artigo".length, destino: { href: "#cpt" } }];
  };
  assert.equal(html("trata o <i>caput</i> deste artigo não", { ...eco, locais }), `trata o <a class="remissao" href="#cpt"><i>caput</i> deste artigo</a> não`);
});

test("destinos com alvo são devolvidos sem repetição", () => {
  const alvo = { norma: {} as never, dispositivo: {} as never };
  const r = renderizarTextoLegal(`<span xlink:href="x">a</span> e <span xlink:href="x">b</span>`, { resolverUrn: () => ({ href: "#x", alvo }) });
  assert.equal(r.destinos.length, 1);
});

test("art. 4º, § 5º, incisos: um link para cada artigo da Constituição, texto intacto", () => {
  const base = carregarBaseSincrona();
  const lc = norma(base, "lc-214-2025");
  const artigo = lc.porId.get("art4")!;
  const op: Opcoes = { resolverUrn: (u) => base.catalogo.resolverUrn(u, lc, artigo) };
  const texto = (id: string): string => redacaoAtual(lc.porId.get(id)!)!.texto!;
  const i1 = html(texto("art4_par5_inc1"), op);
  assert.equal((i1.match(/<a /g) ?? []).length, 1);
  assert.match(i1, /<a class="remissao" href="\.\.\/\.\.\/constituicao-1988\/art-155\/#art155_cpt_inc1">inciso I do <i>caput<\/i> do art\. 155 da Constituição Federal<\/a>;$/);
  assert.match(html(texto("art4_par5_inc2"), op), /href="\.\.\/\.\.\/constituicao-1988\/art-156\/#art156_cpt_inc2">inciso II do <i>caput<\/i> do art\. 156 da Constituição Federal<\/a>\.$/);
});

test("catálogo: norma que não carregamos, artigo 156-A e alvo sem artigo", () => {
  const base = carregarBaseSincrona();
  const lc = norma(base, "lc-214-2025");
  const a = lc.porId.get("art4")!;
  assert.equal(base.catalogo.resolverUrn("urn:lex:br:federal:lei.complementar:2006-12-14;123!art12", lc, a).href, "https://normas.leg.br/?urn=urn:lex:br:federal:lei.complementar:2006-12-14;123!art12");
  assert.equal(base.catalogo.resolverUrn(`${URN_CF}!art156-1_cpt`, lc, a).href, "../../constituicao-1988/art-156-a/#art156-1_cpt");
  assert.equal(base.catalogo.resolverUrn(`${URN_CF}!anexo1`, lc, a).href, `https://normas.leg.br/?urn=${URN_CF}!anexo1`);
  assert.equal(base.catalogo.resolverUrn("urn:lex:br:federal:lei.complementar:2025-01-16;214@2026-01-13!art12_par3", lc, a).href, "../../lc-214-2025/art-12/#art12_par3");
});

test("<b> da fonte vira negrito, sem aparecer como texto", () => {
  assert.equal(html('a <b xmlns="x"><i>caput</i></b> b'), "a <b><i>caput</i></b> b");
});
