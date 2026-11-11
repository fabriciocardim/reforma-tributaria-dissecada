/*
 * Normas capturadas do normas.leg.br (design, seção "Fonte do texto"). Para incluir uma norma,
 * acrescente uma linha aqui: o nome vira o arquivo em dados/fonte/<nome>.json.
 */

export interface FonteNorma {
  nome: string;
  urn: string;
  /** Se falhar, a captura avisa e segue com as demais em vez de abortar. */
  opcional?: boolean;
  /** false: o texto é só consulta (lado "antes" dos temas) e não vira páginas do site. */
  publicar?: boolean;
  /**
   * A resposta da norma traz só metadados (leis antigas, sem estrutura por dispositivo): baixa também o
   * HTML da versão vigente (`encoding` com version "Current") e grava em dados/fonte/<nome>.html.
   */
  textoHtml?: boolean;
}

export const FONTES: FonteNorma[] = [
  { nome: "lc-214-2025", urn: "urn:lex:br:federal:lei.complementar:2025-01-16;214" },
  { nome: "constituicao-1988", urn: "urn:lex:br:federal:constituicao:1988-10-05;1988" },
  { nome: "ec-132-2023", urn: "urn:lex:br:federal:emenda.constitucional:2023-12-20;132" },
  // Legislação anterior: base do lado "antes" dos temas; não vira ficha nem índice.
  { nome: "lc-87-1996", urn: "urn:lex:br:federal:lei.complementar:1996-09-13;87", opcional: true, publicar: false, textoHtml: true },
  { nome: "lc-116-2003", urn: "urn:lex:br:federal:lei.complementar:2003-07-31;116", opcional: true, publicar: false, textoHtml: true },
];

export function urlDaFonte(urn: string): string {
  return `https://normas.leg.br/api/public/normas?urn=${urn}&tipo_documento=maior-detalhe`;
}
