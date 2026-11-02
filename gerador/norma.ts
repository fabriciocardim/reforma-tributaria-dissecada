/*
 * Norma carregada: dispositivos lidos, artigos que ganham página e o endereço de cada um
 * (/lei/<norma>/art-<n>/), mais o catálogo que resolve a URN de um dispositivo para o endereço
 * da ficha. Puro.
 */
import { redacaoAtual, type Dispositivo } from "../captura/ler.ts";

export interface DefNorma {
  /** Nome em `captura/fontes.ts`; também o trecho do endereço: /lei/<slug>/. */
  slug: string;
  nome: string;
  urn: string;
}

export interface Norma extends DefNorma {
  dispositivos: Dispositivo[];
  porId: Map<string, Dispositivo>;
  /** Artigos com página, na ordem da norma (sem os que só existem citados dentro de blocos de alteração). */
  artigos: Dispositivo[];
  /** id do artigo → trecho do endereço ("art-156-a"). */
  slugs: Map<string, string>;
}

export const TIPOS_ESTRUTURA = ["livro", "titulo", "capitulo", "secao", "subsecao"];

/** "Art. 156-A." → "art-156-a"; "Art. 4º" → "art-4". */
export function slugDoArtigo(rotulo: string): string | null {
  const m = /^Art\.\s*(\d+)\s*[º°]?(?:\s*-\s*([A-Z]+))?\.?$/.exec(rotulo.trim());
  return m ? `art-${m[1]}${m[2] ? `-${m[2].toLowerCase()}` : ""}` : null;
}

export function emBloco(porId: Map<string, Dispositivo>, d: Dispositivo): boolean {
  for (let p = d.pai === null ? undefined : porId.get(d.pai); p; p = p.pai === null ? undefined : porId.get(p.pai)) {
    if (p.tipo === "bloco.de.alteracao") return true;
  }
  return false;
}

const reposicionado = (d: Dispositivo): boolean => redacaoAtual(d)?.tipos.includes("Suppression_By_Moviment_Version") ?? false;

export function montarNorma(def: DefNorma, dispositivos: Dispositivo[]): Norma {
  const porId = new Map(dispositivos.map((d) => [d.id, d]));
  const porSlug = new Map<string, Dispositivo>();
  for (const d of dispositivos) {
    if (d.tipo !== "artigo" || emBloco(porId, d)) continue;
    const rotulo = redacaoAtual(d)?.rotulo ?? "";
    const slug = slugDoArtigo(rotulo);
    if (!slug) throw new Error(`${def.slug}: rótulo de artigo não reconhecido em ${d.id}: "${rotulo}"`);
    const outro = porSlug.get(slug);
    if (!outro) porSlug.set(slug, d);
    else if (reposicionado(outro) && !reposicionado(d)) porSlug.set(slug, d);
    else if (!reposicionado(outro) === !reposicionado(d)) throw new Error(`${def.slug}: dois artigos com o endereço ${slug} (${outro.id}, ${d.id})`);
  }
  const escolhidos = new Set(porSlug.values());
  const artigos = dispositivos.filter((d) => escolhidos.has(d));
  const slugs = new Map<string, string>();
  for (const [slug, d] of porSlug) slugs.set(d.id, slug);
  return { ...def, dispositivos, porId, artigos, slugs };
}

export interface Destino {
  href: string;
  /** Dispositivo citado, quando a norma está carregada e o dispositivo existe nela. */
  alvo?: { norma: Norma; dispositivo: Dispositivo };
}

const RE_ARTIGO_NO_ID = /^(art\d+(?:-\d+)?)(?:_|$)/;

export class Catalogo {
  porUrn = new Map<string, Norma>();
  porSlug = new Map<string, Norma>();
  /** "norma slug|artigo id curto" → artigo com página. */
  private paginas = new Map<string, Dispositivo>();

  constructor(normas: Norma[]) {
    for (const n of normas) {
      this.porUrn.set(n.urn, n);
      this.porSlug.set(n.slug, n);
      for (const a of n.artigos) this.paginas.set(`${n.slug}|${a.id.split(",")[0]}`, a);
    }
  }

  /** URN de dispositivo ("urn:…;1988!art155_cpt_inc1") → endereço relativo à ficha de `deNorma`/`deArtigo`. */
  resolverUrn(urn: string, deNorma: Norma, deArtigo: Dispositivo): Destino {
    const [normaBruta, resto = ""] = urn.split("!");
    const norma = this.porUrn.get(normaBruta!.replace(/@.*$/, ""));
    const idDispositivo = resto.split(",")[0]!;
    const idArtigo = RE_ARTIGO_NO_ID.exec(idDispositivo)?.[1];
    const pagina = norma && idArtigo ? this.paginas.get(`${norma.slug}|${idArtigo}`) : undefined;
    if (!norma || !pagina) return { href: `https://normas.leg.br/?urn=${urn}` };
    return this.destino(norma, pagina, idDispositivo, deNorma, deArtigo);
  }

  /** Destino de um dispositivo já localizado. */
  destino(norma: Norma, pagina: Dispositivo, idDispositivo: string, deNorma: Norma, deArtigo: Dispositivo): Destino {
    const ehArtigo = idDispositivo === pagina.id.split(",")[0];
    const fragmento = ehArtigo ? "" : `#${idDispositivo}`;
    const mesmaPagina = norma === deNorma && pagina === deArtigo;
    const href = mesmaPagina ? fragmento || "#" : `../../${norma.slug}/${norma.slugs.get(pagina.id)}/${fragmento}`;
    const dispositivo = ehArtigo ? pagina : norma.porId.get(idDispositivo);
    return dispositivo ? { href, alvo: { norma, dispositivo } } : { href };
  }
}
