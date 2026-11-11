import { test } from "node:test";
import assert from "node:assert/strict";
import { FONTES, urlDaFonte } from "./fontes.ts";

test("nomes e URNs das fontes são únicos", () => {
  assert.equal(new Set(FONTES.map((f) => f.nome)).size, FONTES.length);
  assert.equal(new Set(FONTES.map((f) => f.urn)).size, FONTES.length);
});

test("a legislação anterior é opcional e não vira página; as normas do site são obrigatórias", () => {
  for (const nome of ["lc-87-1996", "lc-116-2003"]) {
    const f = FONTES.find((x) => x.nome === nome)!;
    assert.equal(f.opcional, true, nome);
    assert.equal(f.publicar, false, nome);
  }
  for (const nome of ["lc-214-2025", "constituicao-1988", "ec-132-2023"]) {
    const f = FONTES.find((x) => x.nome === nome)!;
    assert.ok(!f.opcional && f.publicar !== false, nome);
  }
});

test("URN da legislação anterior no padrão das demais", () => {
  assert.equal(urlDaFonte(FONTES.find((f) => f.nome === "lc-87-1996")!.urn), "https://normas.leg.br/api/public/normas?urn=urn:lex:br:federal:lei.complementar:1996-09-13;87&tipo_documento=maior-detalhe");
  assert.match(FONTES.find((f) => f.nome === "lc-116-2003")!.urn, /lei\.complementar:2003-07-31;116$/);
});
