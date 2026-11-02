import { test } from "node:test";
import assert from "node:assert/strict";
import { carregarBaseSincrona, mostrarEfeitos, norma } from "./carregar.ts";
import { carregarExplicacoes, impressaoDigital, lerExplicacao, renderizarExplicacao, situacao, type Explicacao } from "./explicacao.ts";
import { gerarFicha } from "./ficha.ts";

const base = carregarBaseSincrona();
const lc = norma(base, "lc-214-2025");
const art4 = lc.porId.get("art4")!;
const HASH = "a".repeat(64);

const arquivo = (cabecalho: string, corpo = "## O que é\nUm.\n\n## Para que serve\nDois.\n\n## Como funciona\nTrês.\n"): string => `---\n${cabecalho}\n---\n${corpo}`;
const CABECALHO = `norma: lc-214-2025\nartigo: art4\nconferida: false\ngerada_em: 2026-11-02\nimpressao_digital: ${HASH}`;

test("lerExplicacao: lê o cabeçalho e as três seções, juntando as linhas de cada parágrafo", () => {
  const e = lerExplicacao(arquivo(CABECALHO, "## O que é\nPrimeira linha\nsegunda linha.\n\nOutro parágrafo.\n\n## Para que serve\nDois.\n\n## Como funciona\nTrês.\n"));
  assert.equal(e.norma, "lc-214-2025");
  assert.equal(e.artigo, "art4");
  assert.equal(e.conferida, false);
  assert.equal(e.conferidaEm, null);
  assert.deepEqual(e.secoes[0], ["Primeira linha segunda linha.", "Outro parágrafo."]);
  assert.equal(e.secoes.length, 3);
});

test("lerExplicacao: recusa arquivo fora do formato, com o motivo", () => {
  assert.throws(() => lerExplicacao("sem cabeçalho"), /cabeçalho/);
  assert.throws(() => lerExplicacao(arquivo(CABECALHO.replace("conferida: false", "conferida: talvez"))), /true ou false/);
  assert.throws(() => lerExplicacao(arquivo(CABECALHO.replace("conferida: false", "conferida: true"))), /conferida_em/);
  assert.throws(() => lerExplicacao(arquivo(CABECALHO.replace(HASH, "carimbar"))), /64 dígitos/);
  assert.throws(() => lerExplicacao(arquivo(CABECALHO.replace("2026-11-02", "02/11/2026"))), /gerada_em/);
  assert.throws(() => lerExplicacao(arquivo(CABECALHO, "## O que é\nUm.\n")), /seções/);
  assert.throws(() => lerExplicacao(arquivo(CABECALHO, "## Para que serve\nUm.\n\n## O que é\nDois.\n\n## Como funciona\nTrês.\n")), /deve ser/);
  assert.throws(() => lerExplicacao(arquivo(CABECALHO, "## O que é\n\n## Para que serve\nDois.\n\n## Como funciona\nTrês.\n")), /vazia/);
});

test("impressão digital: estável, e muda quando o texto legal muda", () => {
  const a = impressaoDigital(lc, art4);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(impressaoDigital(lc, art4), a);
  assert.notEqual(impressaoDigital(lc, lc.porId.get("art5")!), a);
  const v = lc.porId.get("art4_cpt")!.versoes[0]!;
  const original = v.texto;
  v.texto = `${original} (alterado)`;
  try {
    assert.notEqual(impressaoDigital(lc, art4), a);
  } finally {
    v.texto = original;
  }
});

test("situação: conferida só com a impressão digital igual; mudou o texto, desatualizada", () => {
  const e = { conferida: true, impressaoDigital: HASH } as Explicacao;
  assert.equal(situacao(e, HASH), "conferida");
  assert.equal(situacao({ ...e, conferida: false }, HASH), "nao-conferida");
  assert.equal(situacao(e, "b".repeat(64)), "desatualizada");
  assert.equal(situacao({ ...e, conferida: false }, "b".repeat(64)), "desatualizada");
});

const explicacao = (extra: Partial<Explicacao> = {}): Explicacao => ({
  norma: "lc-214-2025",
  artigo: "art4",
  conferida: false,
  conferidaEm: null,
  geradaEm: "2026-11-02",
  impressaoDigital: impressaoDigital(lc, art4),
  secoes: [["Um & dois."], ["Dois."], ["Três.", "Quatro."]],
  ...extra,
});

test("bloco: rótulo 'não é texto de lei', aviso de não conferido, seções e rodapé com as datas", () => {
  const h = renderizarExplicacao(lc, "art-4", art4, explicacao());
  assert.match(h, /Gerado por inteligência artificial — não é texto de lei/);
  assert.match(h, /class="aviso nao-conferida"><strong>Não conferido\.<\/strong>/);
  assert.match(h, /<strong>O que é\.<\/strong> Um &amp; dois\./);
  assert.match(h, /<p><strong>Como funciona\.<\/strong> Três\.<\/p><p>Quatro\.<\/p>/);
  assert.match(h, /Gerado em 02\/11\/2026 para a redação de 13\/01\/2026/);
});

test("bloco: conferida mostra a data; texto legal diferente mostra o alerta de desatualizada", () => {
  assert.match(renderizarExplicacao(lc, "art-4", art4, explicacao({ conferida: true, conferidaEm: "2026-11-05" })), /Conferido em 05\/11\/2026/);
  const h = renderizarExplicacao(lc, "art-4", art4, explicacao({ conferida: true, conferidaEm: "2026-11-05", impressaoDigital: HASH }));
  assert.match(h, /class="aviso desatualizada"><strong>Texto legal mudou/);
  assert.ok(!h.includes("Conferido em"));
});

test("bloco: 'Reportar problema' abre um chamado já preenchido com a ficha, o dispositivo e as impressões digitais", () => {
  const h = renderizarExplicacao(lc, "art-4", art4, explicacao());
  const href = /class="botao" href="([^"]+)"/.exec(h)![1]!.replace(/&amp;/g, "&");
  const url = new URL(href);
  assert.equal(url.origin + url.pathname, "https://github.com/fabriciocardim/reforma-tributaria-dissecada/issues/new");
  const corpo = url.searchParams.get("body")!;
  assert.match(corpo, /Ficha: https:\/\/fabriciocardim\.github\.io\/reforma-tributaria-dissecada\/lei\/lc-214-2025\/art-4\//);
  assert.match(corpo, /Dispositivo: art4/);
  assert.match(corpo, new RegExp(`Impressão digital da explicação: ${impressaoDigital(lc, art4)}`));
});

test("bloco: sem explicação, diz que ainda não foi gerado, sem inventar texto", () => {
  const h = renderizarExplicacao(lc, "art-4", art4, undefined);
  assert.match(h, /Ainda não gerado para este artigo/);
  assert.ok(!h.includes("Gerado por inteligência artificial"));
});

test("ficha: o bloco 'Para que serve' vem depois do texto oficial e separado dele", () => {
  const cfg = { catalogo: base.catalogo, capturadoEm: "2026-10-31T00:00:00Z", mostrarEfeitos, explicacoes: new Map([["lc-214-2025|art4", explicacao()]]) };
  const h = gerarFicha(cfg, lc, "art4");
  assert.ok(h.indexOf('aria-labelledby="t2"') < h.indexOf('aria-labelledby="t3"'));
  assert.match(h, /<section aria-labelledby="t3" class="ia">/);
  assert.ok(!h.slice(h.indexOf('aria-labelledby="t2"'), h.indexOf('aria-labelledby="t3"')).includes("Um &amp; dois"));
});

test("conteúdo do repositório: todo arquivo lê, aponta para um artigo que existe e tem o nome do endereço da ficha", () => {
  const explicacoes = carregarExplicacoes(new URL("../", import.meta.url), base.normas);
  assert.ok(explicacoes.size >= 27, `só ${explicacoes.size} explicações`);
  for (const [chave, e] of explicacoes) {
    assert.match(e.impressaoDigital, /^[0-9a-f]{64}$/, chave);
    assert.ok(!e.conferida || e.conferidaEm, chave);
  }
});
