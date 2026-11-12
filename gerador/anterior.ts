/*
 * Texto da legislação anterior (Lei Complementar 87/1996 e Lei Complementar 116/2003), guardado em
 * dados/fonte/<nome>.html como veio do Senado (versão atualizada). Serve para conferir as citações do lado
 * "antes" dos temas: o texto antigo não vira página do site.
 */
import { readFileSync } from "node:fs";

export const LEIS_ANTERIORES = [
  { nome: "lc-87-1996", rotulo: "Lei Complementar 87/1996" },
  { nome: "lc-116-2003", rotulo: "Lei Complementar 116/2003" },
] as const;

const ENTIDADES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ndash: "–", mdash: "—", ordm: "º", ordf: "ª", laquo: "«", raquo: "»" };

function decodificar(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith("#")) return String.fromCodePoint(Number(e.slice(1)));
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

/** HTML → texto corrido, com espaços e quebras de linha normalizados. */
export function htmlParaTexto(html: string): string {
  const semCodigo = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "");
  const quebras = semCodigo.replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n");
  return normalizar(decodificar(quebras.replace(/<[^>]+>/g, "")));
}

/** Espaços (inclusive o não separável) viram um só; quebras de linha viram espaço. */
export function normalizar(s: string): string {
  return s.replace(/[\s ]+/g, " ").trim();
}

export function textoAnterior(raiz: URL, nome: string): string {
  return htmlParaTexto(readFileSync(new URL(`dados/fonte/${nome}.html`, raiz), "utf8"));
}

/** Todas as citações entre aspas curvas do trecho. */
export function citacoes(texto: string): string[] {
  return [...texto.matchAll(/“([^”]+)”/g)].map((m) => m[1]!);
}

/** Problemas de um trecho do lado "antes": citação que não está nos textos, ou número que não está neles. */
export function problemasDoAntes(trecho: string, textos: string[]): string[] {
  const problemas: string[] = [];
  const juntos = normalizar(textos.join(" "));
  for (const c of citacoes(trecho)) if (!juntos.includes(normalizar(c))) problemas.push(`citação não encontrada no texto: “${c}”`);
  const semRotulos = trecho.replace(/Lei Complementar \d+\/\d{4}/g, "");
  const numerosDoTexto = new Set(juntos.match(/\d+/g) ?? []);
  for (const n of new Set(semRotulos.match(/\d+/g) ?? [])) if (!numerosDoTexto.has(n)) problemas.push(`número ${n} não está no texto`);
  return problemas;
}
