import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerNorma, redacaoAtual, ancestrais, idCurto, type Dispositivo } from "./ler.ts";

/* Testes contra a captura real de 31/10/2026 (dados/fonte). Se uma nova captura mudar o texto
 * destes dispositivos, o teste falha de propósito: é o aviso de que a lei mudou. */

const lc214 = lerNorma(JSON.parse(readFileSync(new URL("../dados/fonte/lc-214-2025.json", import.meta.url), "utf8")));
const porId = new Map<string, Dispositivo>(lc214.map((d) => [d.id, d]));
const d = (id: string): Dispositivo => {
  const x = porId.get(id);
  assert.ok(x, `dispositivo ${id} não encontrado`);
  return x;
};

test("identificadores são únicos", () => {
  assert.equal(porId.size, lc214.length);
});

test("idCurto tira a norma e o sufixo de inserção", () => {
  assert.equal(idCurto("urn:lex:br:federal:lei.complementar:2025-01-16;214!art4_par6,lcp-227-2026-01-13"), "art4_par6");
  assert.equal(idCurto("urn:lex:br:federal:lei.complementar:2025-01-16;214!"), "");
});

test("art. 4º, caput: texto intacto da redação original", () => {
  const v = redacaoAtual(d("art4_cpt"))!;
  assert.equal(v.texto, "O IBS e a CBS incidem sobre operações onerosas com bens ou com serviços.");
  assert.deepEqual(v.tipos, ["Original_Version"]);
  assert.equal(v.causa, null);
});

test("art. 4º tem caput, seis parágrafos e o § 2º tem oito incisos", () => {
  assert.deepEqual(d("art4").filhos, ["art4_cpt", "art4_par1", "art4_par2", "art4_par3", "art4_par4", "art4_par5", "art4_par6"]);
  assert.equal(d("art4_par2").filhos.length, 8);
  assert.equal(d("art4_par2").tipo, "paragrafo");
  assert.equal(d("art4_par2_inc8").tipo, "inciso");
});

test("art. 4º, § 4º: duas versões, a atual dada pela Lei Complementar 227/2026", () => {
  const vs = d("art4_par4").versoes;
  assert.equal(vs.length, 2);
  assert.deepEqual(vs[1]!.tipos, ["Text_Change_Version"]);
  assert.equal(vs[1]!.data, "2026-01-13");
  assert.match(vs[1]!.causa!.nome ?? "", /227/);
  assert.match(vs[1]!.causa!.urn, /lei\.complementar:2026-01-13;227/);
});

test("art. 4º, § 6º: incluído pela Lei Complementar 227/2026", () => {
  const vs = d("art4_par6").versoes;
  assert.equal(vs.length, 1);
  assert.deepEqual(vs[0]!.tipos, ["Insertion_Version"]);
  assert.equal(vs[0]!.rotulo, "§ 6º");
});

test("art. 11, § 8º: revogado, com a redação anterior preservada", () => {
  const vs = d("art11_par8").versoes;
  assert.ok(vs[0]!.foraDeVigor);
  assert.ok(vs[0]!.texto!.startsWith("Na hipótese de que trata o inciso X"));
  assert.deepEqual(redacaoAtual(d("art11_par8"))!.tipos, ["Repeal_Version"]);
});

test("art. 4º, § 5º, I: a remissão à Constituição vem marcada no texto", () => {
  assert.match(redacaoAtual(d("art4_par5_inc1"))!.texto!, /xlink:href="urn:lex:br:federal:constituicao:1988-10-05;1988!art155_cpt_inc1"/);
});

test("art. 149: decisão do Supremo Tribunal Federal registrada com nota", () => {
  const v = redacaoAtual(d("art149_cpt_inc2_ali2"))!;
  assert.ok(v.tipos.includes("Court_Decision_Version"));
  assert.match(v.causa!.urn, /supremo\.tribunal\.federal/);
  assert.ok(v.nota);
});

test("o art. 4º fica no Livro I, Título I, Capítulo II, Seção I", () => {
  const cadeia = ancestrais(porId, d("art4")).map((x) => x.id);
  assert.deepEqual(cadeia, ["", "articulacao", "liv1", "liv1_tit1", "liv1_tit1_cap2", "liv1_tit1_cap2_sec1"]);
});

const cf = lerNorma(JSON.parse(readFileSync(new URL("../dados/fonte/constituicao-1988.json", import.meta.url), "utf8")));

test("Constituição: identificadores repetidos pela fonte ficam únicos, com o sufixo", () => {
  assert.equal(new Set(cf.map((x) => x.id)).size, cf.length);
  const arts134 = cf.filter((x) => x.id.startsWith("art134") && x.tipo === "artigo").map((x) => x.id).sort();
  assert.deepEqual(arts134, ["art134", "art134,emc-80-2014-06-04"]);
});

test("Constituição: pai e filhos usam os ids únicos", () => {
  const porIdCf = new Map(cf.map((x) => [x.id, x]));
  for (const x of cf) {
    if (x.pai !== null) assert.ok(porIdCf.has(x.pai), `pai de ${x.id}`);
    for (const f of x.filhos) assert.ok(porIdCf.has(f), `filho ${f} de ${x.id}`);
  }
});
