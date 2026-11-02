import { test } from "node:test";
import assert from "node:assert/strict";
import { redacaoAtual } from "../captura/ler.ts";
import { carregarBaseSincrona, mostrarEfeitos, norma } from "./carregar.ts";
import { dataBr, descreverDispositivo, etiquetaRedacao, gerarFicha, montarLinhaDoTempo, montarTrilha, subarvore } from "./ficha.ts";

/* Contra a captura real de 31/10/2026. Se uma nova captura mudar estes dispositivos, o teste falha de propósito. */

const base = carregarBaseSincrona();
const cfg = { catalogo: base.catalogo, capturadoEm: "2026-10-31T12:00:00.000Z", mostrarEfeitos, explicacoes: new Map() };
const lc = norma(base, "lc-214-2025");
const cf = norma(base, "constituicao-1988");
const ficha = (n: typeof lc, id: string): string => gerarFicha(cfg, n, id);
const art4 = lc.porId.get("art4")!;
const html4 = ficha(lc, "art4");

test("dataBr", () => {
  assert.equal(dataBr("2026-01-13"), "13/01/2026");
  assert.equal(dataBr("2026-10-31T12:00:00.000Z"), "31/10/2026");
});

test("endereços: 580 artigos na Lei Complementar, 276 na Constituição, 23 na Emenda; nenhum repetido", () => {
  assert.equal(lc.artigos.length, 580);
  assert.equal(cf.artigos.length, 276);
  assert.equal(norma(base, "ec-132-2023").artigos.length, 23);
  for (const n of base.normas) assert.equal(new Set(n.slugs.values()).size, n.artigos.length);
  assert.equal(lc.slugs.get("art4"), "art-4");
  assert.equal(lc.slugs.get("art7-1"), "art-7-a");
  assert.equal(cf.slugs.get("art156-1"), "art-156-a");
});

test("Constituição: do art. 134 reposicionado, a página é a do artigo em vigor", () => {
  assert.equal(cf.slugs.get("art134,emc-80-2014-06-04"), "art-134");
  assert.ok(!cf.slugs.has("art134"));
});

test("trilha do art. 4º: Livro I › Título I › Capítulo II › Seção I, com link para o índice", () => {
  assert.deepEqual(montarTrilha(lc, art4).map((t) => t.rotulo), ["LIVRO I", "TÍTULO I", "CAPÍTULO II", "Seção I"]);
  assert.match(html4, /<nav aria-label="Posição na lei"[^>]*><a href="\.\.\/">Lei Complementar 214\/2025<\/a>.*href="\.\.\/#liv1".*LIVRO I.*TÍTULO I.*CAPÍTULO II.*Seção I/);
});

test("art. 1º não tem anterior; o art. 4º tem o 3º e o 5º", () => {
  assert.match(ficha(lc, "art1"), /<div class="vizinhos"><span><\/span><a href="\.\.\/art-2\/">Art\. 2º ›<\/a><\/div>/);
  assert.match(html4, /<a href="\.\.\/art-3\/">‹ Art\. 3º<\/a><a href="\.\.\/art-5\/">Art\. 5º ›<\/a>/);
});

test("o artigo reúne caput, seis parágrafos e todos os incisos", () => {
  assert.equal(subarvore(lc.porId, art4).length, 1 + 1 + 6 + 8 + 4 + 2);
});

test("etiquetas de redação: § 4º alterado e § 6º incluído pela Lei Complementar 227/2026", () => {
  assert.equal(etiquetaRedacao(lc.porId.get("art4_par4")!.versoes[1]!), "Redação dada por Lei Complementar nº 227 de 13/01/2026");
  assert.equal(etiquetaRedacao(lc.porId.get("art4_par6")!.versoes[0]!), "Incluído por Lei Complementar nº 227 de 13/01/2026");
  assert.equal(etiquetaRedacao(lc.porId.get("art4_cpt")!.versoes[0]!), null);
  assert.equal((html4.match(/class="selo redacao"/g) ?? []).length, 2);
  assert.equal((html4.match(/Efeitos: não carregada/g) ?? []).length, 2);
});

test("§ 4º guarda a redação anterior, com o período de vigência", () => {
  assert.match(html4, /<summary>ver redação anterior<\/summary>.*Redação original · vigente de 16\/01\/2025 a 12\/01\/2026/s);
});

test("linha do tempo: redação original e 13/01/2026 com § 4º e § 6º", () => {
  const tempo = montarLinhaDoTempo(subarvore(lc.porId, art4));
  assert.deepEqual(tempo.map((e) => e.data), ["2025-01-16", "2026-01-13"]);
  assert.deepEqual(tempo[0]!.itens, ["redação original"]);
  assert.match(tempo[1]!.itens[0]!, /^§ 4º: Redação dada por/);
  assert.match(tempo[1]!.itens[1]!, /^§ 6º: Incluído por/);
});

test("remissões do § 5º viram links para a Constituição e abrem o texto citado", () => {
  assert.match(html4, /href="\.\.\/\.\.\/constituicao-1988\/art-155\/#art155_cpt_inc1"/);
  assert.match(html4, /Remissão expandida · Constituição Federal de 1988, Art\. 155, caput, I/);
  assert.match(html4, /Imposto sobre a Transmissão Causa Mortis e Doação/);
});

test("'o caput deste artigo' do § 5º vira link para o caput e abre o caput", () => {
  assert.match(html4, /<a class="remissao" href="#art4_cpt"><i>caput<\/i> deste artigo<\/a>/);
  assert.match(html4, /Remissão expandida · Art\. 4º, caput/);
});

test('"nesta Lei Complementar" do § 1º fica não resolvida, sem link', () => {
  assert.match(html4, /<span class="nao-resolvida"[^>]*>nesta Lei Complementar<\/span>\./);
});

test("bloco de alteração de outra norma: caput leva o rótulo do artigo citado, não o do artigo da página", () => {
  const h = ficha(lc, "art496");
  assert.match(h, /<blockquote class="alteracao">/);
  assert.match(h, /<strong>Art\. 9º<\/strong>/);
  assert.ok(!h.includes("<strong>Art. 496.</strong> .."));
  assert.match(h, /class="omissis"/);
});

test("veto: a fonte registra a alteração como vetada e a ficha não a apresenta como texto em vigor", () => {
  const h = ficha(lc, "art12");
  assert.match(h, /class="selo veto">Alteração vetada/);
  assert.match(h, /Nota da fonte: Alteração vetada pela Mensagem de Veto Parcial/);
  assert.match(h, /<div class="vetado">.*<details open><summary>ver redação anterior/s);
  assert.match(ficha(lc, "art116"), /class="selo veto">Inclusão vetada/);
});

test("decisão do Supremo Tribunal Federal: etiqueta e nota da fonte", () => {
  const h = ficha(lc, "art149");
  assert.match(h, /Decisão judicial/);
  assert.match(h, /Nota da fonte: Foi declarada a inconstitucionalidade/);
});

test("revogado: o texto da fonte, '(Revogado)', e a redação anterior à mão", () => {
  const h = ficha(lc, "art11");
  assert.match(h, /id="art11_par8".*Revogado por Lei Complementar nº 227.*\(Revogado\).*Na hipótese de que trata o inciso X/s);
});

test("descreverDispositivo", () => {
  assert.equal(descreverDispositivo(lc, lc.porId.get("art4_par2_inc3")!), "Art. 4º, § 2º, III");
  assert.equal(descreverDispositivo(cf, cf.porId.get("art155_cpt_inc1")!), "Art. 155, caput, I");
});

test("cabeçalho do texto oficial: data da captura e link para a fonte; rodapé com licença", () => {
  assert.match(html4, /Capturado do normas\.leg\.br em 31\/10\/2026/);
  assert.match(html4, /href="https:\/\/normas\.leg\.br\/\?urn=urn:lex:br:federal:lei\.complementar:2025-01-16;214!art4"/);
  assert.match(html4, /Não substitui o texto oficial/);
  assert.match(html4, /Creative Commons Atribuição 4\.0/);
});

test("id de cada dispositivo vira âncora da página", () => {
  for (const id of ["art4_cpt", "art4_par1", "art4_par2_inc8", "art4_par6"]) assert.match(html4, new RegExp(`id="${id}"`));
});

test("gerarFicha recusa o que não é artigo com página", () => {
  assert.throws(() => gerarFicha(cfg, lc, "art4_par1"), /não é um artigo/);
  assert.throws(() => gerarFicha(cfg, cf, "art134"), /não é um artigo/);
});

const semMarcacao = (s: string): string => s.replace(/<[^>]+>/g, "");
const decodificar = (s: string): string => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const texto = (html: string): string => decodificar(semMarcacao(html));

test("texto legal intacto: em todas as fichas das três normas, o texto de cada dispositivo aparece como veio da fonte", () => {
  let verificados = 0;
  for (const n of base.normas) {
    for (const artigo of n.artigos) {
      const pagina = texto(ficha(n, artigo.id));
      for (const d of subarvore(n.porId, artigo)) {
        const v = redacaoAtual(d);
        if (!v?.texto || d.tipo === "artigo") continue;
        assert.ok(pagina.includes(decodificar(semMarcacao(v.texto))), `${n.slug} ${d.id}: texto alterado ou ausente`);
        verificados++;
      }
    }
  }
  assert.ok(verificados > 8000, `só ${verificados} dispositivos verificados`);
});
