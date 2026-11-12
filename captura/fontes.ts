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
   * A resposta da norma traz só metadados (leis antigas, sem estrutura por dispositivo; o endereço de texto
   * que a fonte informa responde 404; o Planalto derruba as conexões de nuvem): baixa também esta página do
   * Senado (texto atualizado da norma, no Sigen), sem alteração, para dados/fonte/<nome>.html.
   */
  textoHtml?: string;
}

export const FONTES: FonteNorma[] = [
  { nome: "lc-214-2025", urn: "urn:lex:br:federal:lei.complementar:2025-01-16;214" },
  { nome: "constituicao-1988", urn: "urn:lex:br:federal:constituicao:1988-10-05;1988" },
  { nome: "ec-132-2023", urn: "urn:lex:br:federal:emenda.constitucional:2023-12-20;132" },
  // Legislação anterior: base do lado "antes" dos temas; não vira ficha nem índice.
  { nome: "lc-87-1996", urn: "urn:lex:br:federal:lei.complementar:1996-09-13;87", opcional: true, publicar: false, textoHtml: "https://legis.senado.leg.br/norma/572842/publicacao/34621002" },
  { nome: "lc-116-2003", urn: "urn:lex:br:federal:lei.complementar:2003-07-31;116", opcional: true, publicar: false, textoHtml: "https://legis.senado.leg.br/norma/572871/publicacao/34621012" },
];

export function urlDaFonte(urn: string): string {
  return `https://normas.leg.br/api/public/normas?urn=${urn}&tipo_documento=maior-detalhe`;
}
