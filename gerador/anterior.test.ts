import { test } from "node:test";
import assert from "node:assert/strict";
import { citacoes, htmlParaTexto, LEIS_ANTERIORES, normalizar, problemasDoAntes, textoAnterior } from "./anterior.ts";

const RAIZ = new URL("../", import.meta.url);
const textos = LEIS_ANTERIORES.map((l) => textoAnterior(RAIZ, l.nome));
const [lc87, lc116] = textos as [string, string];

test("htmlParaTexto: tira marcação, decodifica entidades e normaliza espaços", () => {
  assert.equal(htmlParaTexto("<p>Art.&nbsp;2&ordm; O  imposto<br>incide &amp; mais</p><script>x</script>"), "Art. 2º O imposto incide & mais");
});

test("textos guardados: a LC 87/1996 e a LC 116/2003 vêm completas, sem marcação sobrando", () => {
  assert.match(lc87, /Art\. 2º O imposto incide sobre: I - operações relativas à circulação de mercadorias/);
  assert.match(lc87, /Art\. 12\. Considera-se ocorrido o fato gerador do imposto no momento: I - da saída de mercadoria de estabelecimento de contribuinte/);
  assert.match(lc116, /Art\. 1º O Imposto Sobre Serviços de Qualquer Natureza, de competência dos Municípios e do Distrito Federal, tem como fato gerador a prestação de serviços constantes da lista anexa/);
  for (const t of textos) assert.ok(!/<[a-z]|&[a-z]+;/i.test(t), "sobrou marcação ou entidade");
});

test("citacoes e problemasDoAntes: acha citação que não existe e número que não existe", () => {
  assert.deepEqual(citacoes("a “um” e “dois três”"), ["um", "dois três"]);
  assert.deepEqual(problemasDoAntes("Lei Complementar 87/1996, art. 2º: “operações relativas à circulação de mercadorias”.", textos), []);
  assert.match(problemasDoAntes("“texto que a lei não tem”", textos)[0]!, /citação não encontrada/);
  assert.match(problemasDoAntes("art. 99999", textos)[0]!, /número 99999/);
  assert.equal(normalizar("a \n  b"), "a b");
});
