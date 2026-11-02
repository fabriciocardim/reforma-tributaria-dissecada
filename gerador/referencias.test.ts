import { test } from "node:test";
import assert from "node:assert/strict";
import { carregarBaseSincrona, norma } from "./carregar.ts";
import { resolverLocais, type Casamento } from "./referencias.ts";

const base = carregarBaseSincrona();
const lc = norma(base, "lc-214-2025");
const cf = norma(base, "constituicao-1988");

function resolver(texto: string, idArtigo = "art4", propria = true): { casamentos: Casamento[]; trechos: string[]; hrefs: (string | null)[] } {
  const n = propria ? lc : cf;
  const casamentos = resolverLocais(texto, { catalogo: base.catalogo, norma: n, artigo: n.porId.get(idArtigo)!, marcarSemNorma: propria, leiComplementarPropria: propria });
  return { casamentos, trechos: casamentos.map((c) => texto.slice(c.inicio, c.fim)), hrefs: casamentos.map((c) => c.destino?.href ?? null) };
}

test("artigo com 'desta Lei Complementar' vira link para a ficha do artigo", () => {
  const r = resolver("nos termos do art. 44 desta Lei Complementar.");
  assert.deepEqual(r.trechos, ["art. 44 desta Lei Complementar"]);
  assert.deepEqual(r.hrefs, ["../../lc-214-2025/art-44/"]);
});

test("cadeia inversa e direta chegam ao mesmo dispositivo", () => {
  assert.deepEqual(resolver("o § 3º do art. 12 desta Lei Complementar").hrefs, ["../../lc-214-2025/art-12/#art12_par3"]);
  assert.deepEqual(resolver("o art. 12, § 3º desta Lei Complementar").hrefs, ["../../lc-214-2025/art-12/#art12_par3"]);
  assert.deepEqual(resolver("o inciso II do § 2º do art. 60 desta Lei Complementar").hrefs, ["../../lc-214-2025/art-60/#art60_par2_inc2"]);
});

test("inciso do artigo sem parágrafo é inciso do caput", () => {
  assert.deepEqual(resolver("o inciso III do caput do art. 5º desta Lei Complementar").hrefs, ["../../lc-214-2025/art-5/#art5_cpt_inc3"]);
});

test("'deste artigo' usa o artigo da página, na mesma página", () => {
  assert.deepEqual(resolver("conforme o § 4º deste artigo", "art10").hrefs, ["#art10_par4"]);
  assert.deepEqual(resolver("o caput deste artigo", "art4").hrefs, ["#art4_cpt"]);
  assert.deepEqual(resolver("nos incisos I e II do caput deste artigo", "art73").hrefs, ["#art73_cpt_inc1", "#art73_cpt_inc2"]);
});

test("lista e intervalo: cada número vira um link, o meio não", () => {
  const r = resolver("nos arts. 47 a 56 desta Lei Complementar");
  assert.deepEqual(r.trechos, ["47", "56"]);
  assert.deepEqual(r.hrefs, ["../../lc-214-2025/art-47/", "../../lc-214-2025/art-56/"]);
  assert.deepEqual(resolver("os §§ 2º a 4º do art. 29 desta Lei Complementar").trechos, ["2º", "4º"]);
});

test("a norma no fim da enumeração vale para todos os itens", () => {
  const r = resolver("no art. 21, no § 3º do art. 22 e no art. 23 desta Lei Complementar");
  assert.deepEqual(r.hrefs, ["../../lc-214-2025/art-21/", "../../lc-214-2025/art-22/#art22_par3", "../../lc-214-2025/art-23/"]);
});

test("artigo com letra: 7º-A vira art7-1", () => {
  assert.deepEqual(resolver("o art. 7º-A desta Lei Complementar").hrefs, ["../../lc-214-2025/art-7-a/"]);
});

test("norma indicada como outra: não toca", () => {
  assert.deepEqual(resolver("o art. 128 do ADCT e o art. 12 da Lei Complementar nº 123").casamentos, []);
});

test("art. sem norma indicada: não resolvida, sem chute", () => {
  const r = resolver("de que trata o art. 32, que");
  assert.deepEqual(r.trechos, ["art. 32"]);
  assert.deepEqual(r.hrefs, [null]);
  assert.match(r.casamentos[0]!.motivo!, /a que norma/);
});

test("alvo que a fonte não tem: não resolvido", () => {
  const r = resolver("o art. 9999 desta Lei Complementar e o § 99 do art. 12 desta Lei Complementar");
  assert.deepEqual(r.hrefs, [null, null]);
});

test("sem artigo e sem 'deste artigo', nada é resolvido", () => {
  assert.deepEqual(resolver("o § 3º e o inciso II").casamentos, []);
  assert.deepEqual(resolver("previstas nesta Lei Complementar").casamentos, []);
});

test("fora da Lei Complementar 214/2025, 'desta Lei Complementar' não aponta para a norma", () => {
  assert.deepEqual(resolver("o art. 44 desta Lei Complementar", "art150", false).casamentos, []);
  assert.deepEqual(resolver("o § 1º deste artigo", "art150", false).hrefs, ["#art150_par1"]);
});
