/*
 * Leitura da base capturada (formato JSON-LD do normas.leg.br, schema.org Legislation). Puro.
 * Transforma a árvore da norma numa lista plana de dispositivos, cada um com TODAS as suas
 * versões. O texto de cada versão é mantido exatamente como veio da fonte, inclusive as marcações
 * de remissão (<span xlink:href="urn:...">); quem exibe decide como apresentá-las.
 */

export type TipoVersao =
  | "Original_Version"
  | "Text_Change_Version"
  | "Insertion_Version"
  | "Repeal_Version"
  | "Suppression_Version"
  | "Renumbering_Version"
  | "Court_Decision_Version"
  | "Rejected_Veto_Version"
  | "Vetoed_Insertion_Version"
  | "Vetoed_Text_Change_Version"
  | "Text_Indirect_Change_Version"
  | (string & {});

export interface Versao {
  /** Tipo informado pela fonte; quando ela informa dois ("Renumbering_Version, Text_Change_Version"), vêm os dois. */
  tipos: TipoVersao[];
  /** Data da alteração (AAAA-MM-DD), não a data de produção de efeitos. */
  data: string;
  /** "§ 4º", "I –", "Art. 4º"; vazio quando a fonte não traz (caput). */
  rotulo: string;
  /** Texto exatamente como veio; null quando o dispositivo só agrupa (artigo, capítulo sem texto). */
  texto: string | null;
  /** Período de vigência informado ("2025-01-16/2026-01-12"); null se ausente. */
  vigencia: string | null;
  foraDeVigor: boolean;
  /** Norma e dispositivo que causaram esta versão; null na redação original. */
  causa: { nome: string | null; urn: string } | null;
  /** Nota editorial da fonte (decisões do Supremo Tribunal Federal, por exemplo). */
  nota: string | null;
}

export interface Dispositivo {
  /** Identificador sem a norma e sem o sufixo de inserção: "art4_par6". */
  id: string;
  /** Identificador completo como veio da fonte: "urn:...;214!art4_par6,lcp-227-2026-01-13". */
  idFonte: string;
  /** Tipo estrutural: artigo, caput, paragrafo, inciso, alinea, item, capitulo, livro… */
  tipo: string;
  pai: string | null;
  filhos: string[];
  /** Versões na ordem da fonte (cronológica); a última é a redação atual. */
  versoes: Versao[];
}

type Obj = Record<string, unknown>;

const lista = (x: unknown): Obj[] =>
  x === undefined || x === null ? [] : (Array.isArray(x) ? x : [x]).filter((i): i is Obj => typeof i === "object" && i !== null);

const texto = (x: unknown): string | null => (typeof x === "string" && x.length > 0 ? x : null);

function tipoEstrutural(no: Obj): string {
  const lt = no.legislationType as Obj | undefined;
  const id = typeof lt?.["@id"] === "string" ? (lt["@id"] as string) : "";
  return id.split(":").pop() ?? "";
}

/** "urn:…;214!art4_par6,lcp-227-2026-01-13" → "art4_par6"; o "!" vazio do componente raiz vira "". */
export function idCurto(idFonte: string): string {
  const depois = idFonte.includes("!") ? idFonte.slice(idFonte.indexOf("!") + 1) : "";
  return depois.split(",")[0]!;
}

function lerVersao(w: Obj): Versao {
  const tipoBruto = typeof w.legislationType === "string" ? w.legislationType : "";
  const causa = (w.legislationConsolidates ?? (w["@reverse"] as Obj | undefined)?.legislationRepeals) as Obj | undefined;
  const urnCausa = typeof causa?.["@id"] === "string" ? /[?&]urn=([^&]+)/.exec(causa["@id"] as string)?.[1] ?? null : null;
  return {
    tipos: tipoBruto.split(",").map((t) => t.trim()).filter(Boolean),
    data: typeof w.legislationDate === "string" ? w.legislationDate : "",
    rotulo: typeof w.name === "string" ? w.name : "",
    texto: texto(w.text),
    vigencia: texto(w.temporalCoverage),
    foraDeVigor: w.legislationLegalForce === "NotInForce",
    causa: urnCausa && tipoBruto !== "Original_Version" ? { nome: texto(causa?.name), urn: urnCausa } : null,
    nota: texto(w.publisherNote),
  };
}

export function lerNorma(json: unknown): Dispositivo[] {
  const raiz = json as Obj;
  const saida: Dispositivo[] = [];
  const visitar = (no: Obj, pai: string | null): void => {
    const idFonte = typeof no.legislationIdentifier === "string" ? no.legislationIdentifier : "";
    const id = idCurto(idFonte);
    const filhosNos = lista(no.hasPart);
    const d: Dispositivo = {
      id,
      idFonte,
      tipo: tipoEstrutural(no),
      pai,
      filhos: [],
      versoes: lista(no.workExample).map(lerVersao),
    };
    saida.push(d);
    for (const f of filhosNos) {
      const idFilho = idCurto(typeof f.legislationIdentifier === "string" ? f.legislationIdentifier : "");
      d.filhos.push(idFilho);
      visitar(f, id);
    }
  };
  for (const no of lista(raiz.hasPart)) visitar(no, null);
  return saida;
}

export function redacaoAtual(d: Dispositivo): Versao | undefined {
  return d.versoes[d.versoes.length - 1];
}

/** Cadeia do dispositivo até a raiz, do mais externo para o mais interno (sem o próprio). */
export function ancestrais(porId: Map<string, Dispositivo>, d: Dispositivo): Dispositivo[] {
  const cadeia: Dispositivo[] = [];
  let atual = d.pai === null ? undefined : porId.get(d.pai);
  while (atual) {
    cadeia.unshift(atual);
    atual = atual.pai === null ? undefined : porId.get(atual.pai);
  }
  return cadeia;
}
