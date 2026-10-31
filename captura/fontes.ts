/*
 * Normas capturadas do normas.leg.br (design, seção "Fonte do texto"). Para incluir uma norma,
 * acrescente uma linha aqui: o nome vira o arquivo em dados/fonte/<nome>.json.
 */

export interface FonteNorma {
  nome: string;
  urn: string;
}

export const FONTES: FonteNorma[] = [
  { nome: "lc-214-2025", urn: "urn:lex:br:federal:lei.complementar:2025-01-16;214" },
  { nome: "constituicao-1988", urn: "urn:lex:br:federal:constituicao:1988-10-05;1988" },
  { nome: "ec-132-2023", urn: "urn:lex:br:federal:emenda.constitucional:2023-12-20;132" },
];

export function urlDaFonte(urn: string): string {
  return `https://normas.leg.br/api/public/normas?urn=${urn}&tipo_documento=maior-detalhe`;
}
