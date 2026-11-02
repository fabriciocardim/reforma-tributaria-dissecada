import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerNorma, type Dispositivo } from "../captura/ler.ts";
import { FONTES } from "../captura/fontes.ts";
import { artigosDoDispositivo, dataBr, etiquetaRedacao, gerarFicha, montarLinhaDoTempo, montarTrilha, type Lei } from "./ficha.ts";

/* Contra a captura real de 31/10/2026. Se uma nova captura mudar estes dispositivos, o teste falha de propósito. */

const fonte = FONTES.find((f) => f.nome === "lc-214-2025")!;
const lei: Lei = { slug: fonte.nome, nome: "Lei Complementar 214/2025", urn: fonte.urn };
const lc214 = lerNorma(JSON.parse(readFileSync(new URL("../dados/fonte/lc-214-2025.json", import.meta.url), "utf8")));
const porId = new Map<string, Dispositivo>(lc214.map((d) => [d.id, d]));
const art4 = porId.get("art4")!;
const html = gerarFicha(lei, lc214, "art4", "2026-10-31T12:00:00.000Z");

test("dataBr", () => {
  assert.equal(dataBr("2026-01-13"), "13/01/2026");
  assert.equal(dataBr("2026-10-31T12:00:00.000Z"), "31/10/2026");
});

test("trilha do art. 4º vem dos ancestrais: Livro I › Título I › Capítulo II › Seção I", () => {
  assert.deepEqual(
    montarTrilha(porId, art4).map((t) => t.rotulo),
    ["LIVRO I", "TÍTULO I", "CAPÍTULO II", "Seção I"],
  );
  assert.match(html, /<nav aria-label="Posição na lei"[^>]*><span>Lei Complementar 214\/2025<\/span>.*LIVRO I.*TÍTULO I.*CAPÍTULO II.*Seção I/);
});

test("o artigo reúne caput, seis parágrafos e todos os incisos", () => {
  assert.equal(artigosDoDispositivo(porId, art4).length, 1 + 1 + 6 + 8 + 4 + 2);
});

test("etiquetas de redação: § 4º alterado e § 6º incluído pela Lei Complementar 227/2026", () => {
  const par4 = porId.get("art4_par4")!.versoes[1]!;
  assert.equal(etiquetaRedacao(par4), "Redação dada por Lei Complementar nº 227 de 13/01/2026");
  assert.equal(etiquetaRedacao(porId.get("art4_par6")!.versoes[0]!), "Incluído por Lei Complementar nº 227 de 13/01/2026");
  assert.equal(etiquetaRedacao(porId.get("art4_cpt")!.versoes[0]!), null);
  assert.equal((html.match(/class="selo redacao"/g) ?? []).length, 2);
  assert.equal((html.match(/Efeitos: não carregada/g) ?? []).length, 2);
});

test("§ 4º guarda a redação anterior, com o período de vigência", () => {
  assert.match(html, /<summary>ver redação anterior<\/summary>.*Redação anterior \(vigente de 16\/01\/2025 a 12\/01\/2026\)/s);
  assert.equal((html.match(/<details>/g) ?? []).length, 1);
});

test("linha do tempo: redação original e 13/01/2026 com § 4º e § 6º", () => {
  const tempo = montarLinhaDoTempo(artigosDoDispositivo(porId, art4));
  assert.deepEqual(tempo.map((e) => e.data), ["2025-01-16", "2026-01-13"]);
  assert.deepEqual(tempo[0]!.itens, ["redação original"]);
  assert.equal(tempo[1]!.itens.length, 2);
  assert.match(tempo[1]!.itens[0]!, /^§ 4º: Redação dada por/);
  assert.match(tempo[1]!.itens[1]!, /^§ 6º: Incluído por/);
});

test("remissões do § 5º viram links para a Constituição", () => {
  assert.match(html, /href="\.\.\/\.\.\/constituicao-1988\/art-155\/#art155_cpt_inc1"/);
  assert.match(html, /href="\.\.\/\.\.\/constituicao-1988\/art-156\/#art156_cpt_inc2"/);
});

test('"nesta Lei Complementar" do § 1º fica não resolvida, sem link', () => {
  assert.match(html, /<span class="nao-resolvida"[^>]*>nesta Lei Complementar<\/span>\./);
});

test("o texto legal sai intacto: cada texto da fonte, sem marcação, aparece na página", () => {
  const semMarcacao = (s: string): string => s.replace(/<[^>]+>/g, "");
  const pagina = semMarcacao(html.replace(/&amp;/g, "&"));
  for (const d of artigosDoDispositivo(porId, art4)) {
    const v = d.versoes[d.versoes.length - 1]!;
    if (v.texto) assert.ok(pagina.includes(semMarcacao(v.texto)), `texto de ${d.id} alterado`);
  }
});

test("cabeçalho do texto oficial: data da captura e link para a fonte; rodapé com licença", () => {
  assert.match(html, /Capturado do normas\.leg\.br em 31\/10\/2026/);
  assert.match(html, /href="https:\/\/normas\.leg\.br\/\?urn=urn:lex:br:federal:lei\.complementar:2025-01-16;214!art4"/);
  assert.match(html, /Não substitui o texto oficial/);
  assert.match(html, /Creative Commons Atribuição 4\.0/);
});

test("id de cada dispositivo vira âncora da página", () => {
  for (const id of ["art4_cpt", "art4_par1", "art4_par2_inc8", "art4_par6"]) assert.match(html, new RegExp(`id="${id}"`));
});

test("gerarFicha recusa o que não é artigo", () => {
  assert.throws(() => gerarFicha(lei, lc214, "art4_par1", "2026-10-31"), /não é um artigo/);
});
