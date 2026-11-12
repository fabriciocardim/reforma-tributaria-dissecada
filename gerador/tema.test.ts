import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carregarBaseSincrona, norma, mostrarEfeitos } from "./carregar.ts";
import { carregarExplicacoes } from "./explicacao.ts";
import { gerarFicha } from "./ficha.ts";
import { gerarInicial } from "./inicial.ts";
import { carregarTemas, gerarTema, impressaoDoTema, lerRef, lerTema, situacaoTema } from "./tema.ts";
import { problemas, textoLegalDoArtigo } from "./verificar.ts";
import { subarvore } from "./util.ts";
import { LEIS_ANTERIORES, citacoes, problemasDoAntes, textoAnterior } from "./anterior.ts";

const RAIZ = new URL("../", import.meta.url);
const base = carregarBaseSincrona();
const temas = carregarTemas(RAIZ, base);
const fato = temas.find((t) => t.tema === "fato-gerador")!;
const explicacoes = carregarExplicacoes(RAIZ, base.normas);
const html = gerarTema(fato, { base, explicacoes, capturadoEm: base.manifesto.capturadoEm });
const HASH = "a".repeat(64);

const arquivo = (cab: string, corpo: string): string => `---\n${cab}\n---\n${corpo}`;
const CAB = `tema: x\ntitulo: X\nlote: 1\nprofundidade: completa\nconferida: false\ngerada_em: 2026-11-11\nimpressao_digital: ${HASH}\nartigos: lc-214-2025/art-4`;
const CORPO = `## Regra geral e exceções\n- lc-214-2025/art-4 | REGRA GERAL | Frase.\n\n## O que é\nUm.\n\n## Para que serve\nDois.\n\n## Como funciona\nTrês.\n\n## Antes e depois\n- Aspecto | Depois | lc-214-2025/art-4#art4_cpt\n\n## Posição na transição\nQuatro.\n`;

test("lerRef: norma/artigo, com dispositivo opcional", () => {
  assert.deepEqual(lerRef("lc-214-2025/art-4"), { norma: "lc-214-2025", ficha: "art-4", ancora: null });
  assert.deepEqual(lerRef("constituicao-1988/art-156-a#art156-1_par1_inc1"), { norma: "constituicao-1988", ficha: "art-156-a", ancora: "art156-1_par1_inc1" });
  assert.throws(() => lerRef("art-4"), /referência inválida/);
});

test("lerTema: lê o formato e recusa o que está fora dele, com o motivo", () => {
  const t = lerTema(arquivo(CAB, CORPO));
  assert.equal(t.mapa[0]!.papel, "REGRA GERAL");
  assert.equal(t.antesDepois[0]!.antes, null);
  assert.equal(t.secoes.length, 3);
  assert.throws(() => lerTema("sem cabeçalho"), /cabeçalho/);
  assert.throws(() => lerTema(arquivo(CAB.replace("lote: 1", "lote: 9"), CORPO)), /lote/);
  assert.throws(() => lerTema(arquivo(CAB.replace(HASH, "carimbar"), CORPO)), /64 dígitos/);
  assert.throws(() => lerTema(arquivo(CAB, CORPO.replace("## Posição na transição\nQuatro.\n", ""))), /Posição na transição/);
  assert.throws(() => lerTema(arquivo(CAB, CORPO.replace("- lc-214-2025/art-4 | REGRA GERAL | Frase.", "- lc-214-2025/art-4 | só dois campos"))), /linha do mapa/);
});

test("o tema do repositório é válido e cita artigos e dispositivos que existem", () => {
  assert.equal(temas.length >= 1, true);
  assert.equal(fato.conferida, false);
  assert.equal(fato.artigos.length, 8);
});

test("impressão digital do tema: muda quando o texto legal de um artigo muda", () => {
  const a = impressaoDoTema(base, fato.artigos);
  assert.equal(a, fato.impressaoDigital, "o tema foi escrito contra o texto legal atual");
  const lc = norma(base, "lc-214-2025");
  const v = lc.porId.get("art6_cpt")!.versoes[0]!;
  const original = v.texto;
  v.texto = `${original} (alterado)`;
  try {
    assert.notEqual(impressaoDoTema(base, fato.artigos), a);
    assert.equal(situacaoTema(fato, impressaoDoTema(base, fato.artigos)), "desatualizada");
  } finally {
    v.texto = original;
  }
  assert.equal(situacaoTema(fato, a), "nao-conferida");
  assert.equal(situacaoTema({ ...fato, conferida: true }, a), "conferida");
});

test("números e siglas do tema existem no texto legal dos artigos que ele cita", () => {
  const corpo = [...fato.mapa.map((c) => c.frase), ...fato.secoes.flatMap((s) => s.paragrafos), ...fato.antesDepois.map((l) => l.depois), ...fato.transicao].join("\n");
  const legal = fato.artigos
    .map((r) => {
      const n = norma(base, r.norma);
      return textoLegalDoArtigo(n.porId, n.artigos.find((a) => n.slugs.get(a.id) === r.ficha)!);
    })
    .join("\n");
  assert.deepEqual(problemas(corpo, legal, ""), []);
});

test("página: mapa, explicação, antes e depois com lacuna, transição, artigos e aviso de não conferido", () => {
  assert.match(html, /<h1>Fato gerador<\/h1>/);
  assert.match(html, /class="cartao destaque" href="\.\.\/\.\.\/lei\/constituicao-1988\/art-156-a\/"/);
  assert.equal((html.match(/class="cartao/g) ?? []).length, fato.mapa.length);
  assert.match(html, /class="aviso nao-conferida"><strong>Ainda não conferido/);
  assert.equal((html.match(/Gerado por inteligência artificial — não é texto de lei/g) ?? []).length, 4);
  assert.equal((html.match(/Regime anterior ainda não verificado para este aspecto/g) ?? []).length, fato.antesDepois.filter((l) => !l.antes).length);
  assert.match(html, /href="https:\/\/www\.planalto\.gov\.br\/ccivil_03\/leis\/lcp\/lcp87\.htm"/);
  assert.match(html, /href="https:\/\/www\.planalto\.gov\.br\/ccivil_03\/leis\/lcp\/lcp116\.htm"/);
  assert.match(html, /href="\.\.\/\.\.\/lei\/lc-214-2025\/art-4\/#art4_par2">LC 214\/2025, Art\. 4º, § 2º/);
  assert.match(html, /<strong>Constituição Federal de 1988, Art\. 156-A<\/strong>/);
  assert.match(html, /<span class="selo nao-conferida">Não conferido<\/span>/);
});

test("página: a situação dos artigos vem da conferência da ficha de cada um", () => {
  const e = explicacoes.get("lc-214-2025|art4")!;
  const mudada = new Map(explicacoes);
  mudada.set("lc-214-2025|art4", { ...e, conferida: true, conferidaEm: "2026-11-20" });
  const h = gerarTema(fato, { base, explicacoes: mudada, capturadoEm: base.manifesto.capturadoEm });
  assert.match(h, /<strong>Art\. 4º<\/strong><\/span><span class="selo conferida">Conferido<\/span>/);
});

test("página: o botão 'Reportar problema' leva as impressões digitais do tema", () => {
  const href = /class="botao" href="([^"]+)"/.exec(html)![1]!.replace(/&amp;/g, "&");
  const corpo = new URL(href).searchParams.get("body")!;
  assert.match(corpo, /Tema: https:\/\/fabriciocardim\.github\.io\/reforma-tributaria-dissecada\/tema\/fato-gerador\//);
  assert.match(corpo, new RegExp(`Impressão digital do tema: ${fato.impressaoDigital}`));
});

test("ficha cita o tema e a página inicial liga ao tema pronto", () => {
  const cfg = { catalogo: base.catalogo, capturadoEm: "2026-10-31T00:00:00Z", mostrarEfeitos, explicacoes, temas: new Map([["lc-214-2025|art4", [{ slug: "fato-gerador", titulo: "Fato gerador" }]]]) };
  assert.match(gerarFicha(cfg, norma(base, "lc-214-2025"), "art4"), /Tema: <a href="\.\.\/\.\.\/\.\.\/tema\/fato-gerador\/">Fato gerador<\/a>/);
  const inicial = gerarInicial([{ href: "lei/x/", nome: "X", artigos: 1, explicacoes: 1 }], "2026-10-31", null, [{ slug: "fato-gerador", situacao: "Não conferido", classe: "nao-conferida" }]);
  assert.match(inicial, /<a class="tema pronto" href="tema\/fato-gerador\/">/);
  assert.equal((inicial.match(/Em preparação/g) ?? []).length, 12);
});

test("o tema só cita artigos que já têm 'Para que serve'", () => {
  for (const r of fato.artigos) {
    const n = norma(base, r.norma);
    const a = n.artigos.find((x) => n.slugs.get(x.id) === r.ficha)!;
    assert.ok(explicacoes.has(`${n.slug}|${a.id}`), `${r.norma}/${r.ficha} sem explicação`);
    assert.ok(subarvore(n.porId, a).length > 0);
  }
});

test("conteudo/temas: leitura do arquivo bruto devolve o mesmo tema", () => {
  assert.equal(lerTema(readFileSync(new URL("conteudo/temas/fato-gerador.md", RAIZ), "utf8")).titulo, "Fato gerador");
});

test('o lado "antes": cada citação entre aspas e cada número existem no texto guardado da legislação anterior', () => {
  const textos = LEIS_ANTERIORES.map((l) => textoAnterior(RAIZ, l.nome));
  const comAntes = fato.antesDepois.filter((l) => l.antes);
  assert.ok(comAntes.length >= 5);
  for (const l of comAntes) {
    assert.ok(citacoes(l.antes!).length >= 1, `${l.aspecto}: o "antes" precisa de ao menos uma citação exata`);
    assert.deepEqual(problemasDoAntes(l.antes!, textos), [], l.aspecto);
  }
});
