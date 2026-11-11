/*
 * Captura: baixa cada norma de FONTES do normas.leg.br e grava a resposta SEM ALTERAÇÃO em
 * dados/fonte/<nome>.json (princípio 1: texto oficial intacto). O manifesto registra data,
 * tamanho e impressão digital de cada arquivo, para a página "o que mudou".
 *
 * Uso: node captura/capturar.ts
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { FONTES, urlDaFonte } from "./fontes.ts";

const PASTA = new URL("../dados/fonte/", import.meta.url);

export interface ItemManifesto {
  nome: string;
  urn: string;
  bytes: number;
  sha256: string;
  /** dateModified informado pela fonte; null quando ela não informa. */
  modificadaNaFonte: string | null;
  /** Texto HTML da versão vigente, para normas que a fonte entrega só com metadados. */
  texto?: { url: string; bytes: number; sha256: string };
}

export interface Manifesto {
  capturadoEm: string;
  origem: string;
  normas: ItemManifesto[];
}

async function manifestoAnterior(): Promise<Manifesto | null> {
  try {
    return JSON.parse(await readFile(new URL("manifesto.json", PASTA), "utf8")) as Manifesto;
  } catch {
    return null;
  }
}

const CABECALHOS_DO_TEXTO: Record<string, string>[] = [{}, { Accept: "*/*" }, { Accept: "text/html" }, { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" }];

/** O endereço do texto das leis sem estrutura: tenta variações de Accept e devolve cada resultado. */
async function baixarTexto(url: string): Promise<{ html: Buffer | null; tentativas: string[] }> {
  const tentativas: string[] = [];
  for (const cabecalhos of CABECALHOS_DO_TEXTO) {
    const rotulo = Object.keys(cabecalhos).length ? `Accept ${cabecalhos.Accept}` : "sem Accept";
    try {
      const r = await fetch(url, { headers: cabecalhos });
      tentativas.push(`${rotulo}: HTTP ${r.status} ${r.headers.get("content-type") ?? ""}`.trim());
      if (r.status === 200) return { html: Buffer.from(await r.arrayBuffer()), tentativas };
    } catch (erro) {
      tentativas.push(`${rotulo}: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  }
  return { html: null, tentativas };
}

async function capturar(): Promise<void> {
  await mkdir(PASTA, { recursive: true });
  const anterior = await manifestoAnterior();
  const normas: ItemManifesto[] = [];
  for (const fonte of FONTES) {
    let resposta: Response;
    try {
      resposta = await fetch(urlDaFonte(fonte.urn), { headers: { Accept: "application/json" } });
    } catch (erro) {
      if (!fonte.opcional) throw erro;
      console.warn(`${fonte.nome}: sem resposta da fonte (${erro instanceof Error ? erro.message : String(erro)}); norma opcional, seguindo sem ela.`);
      continue;
    }
    if (resposta.status !== 200) {
      if (fonte.opcional) {
        console.warn(`${fonte.nome}: a fonte respondeu HTTP ${resposta.status}; norma opcional, seguindo sem ela.`);
        continue;
      }
      throw new Error(`${fonte.nome}: a fonte respondeu HTTP ${resposta.status}. Nada foi gravado.`);
    }
    const bytes = Buffer.from(await resposta.arrayBuffer());
    const json = JSON.parse(bytes.toString("utf8")) as { dateModified?: string; encoding?: { version?: string; contentUrl?: string | null }[] };
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const item: ItemManifesto = { nome: fonte.nome, urn: fonte.urn, bytes: bytes.length, sha256, modificadaNaFonte: json.dateModified ?? null };
    if (fonte.textoHtml) {
      const versoes = json.encoding ?? [];
      const url = versoes.find((e) => e.version === "Current")?.contentUrl;
      const baixado = url ? await baixarTexto(url) : null;
      if (baixado?.html) {
        await writeFile(new URL(`${fonte.nome}.html`, PASTA), baixado.html);
        item.texto = { url: url!, bytes: baixado.html.length, sha256: createHash("sha256").update(baixado.html).digest("hex") };
        console.log(`${fonte.nome}: texto vigente, ${baixado.html.length} bytes`);
      } else {
        const motivo = !url ? "a fonte não informa o endereço do texto vigente" : `o texto não veio (${baixado?.tentativas.join("; ")})`;
        if (!fonte.opcional) throw new Error(`${fonte.nome}: ${motivo}. Nada foi gravado.`);
        console.warn(`${fonte.nome}: ${motivo}; norma opcional, seguindo sem o texto.`);
        const linhas = [`Diagnóstico da captura do texto de ${fonte.nome}`, `Endereços informados pela fonte:`];
        for (const e of versoes) linhas.push(`  ${e.version}: ${e.contentUrl ?? "(sem endereço)"}`);
        linhas.push("Tentativas no texto vigente:", ...(baixado?.tentativas.map((t) => `  ${t}`) ?? ["  (nenhuma)"]));
        for (const e of versoes.filter((v) => v.version !== "Current" && v.contentUrl)) {
          const outro = await baixarTexto(e.contentUrl!);
          linhas.push(`Tentativas em ${e.version}:`, ...outro.tentativas.map((t) => `  ${t}`));
        }
        await writeFile(new URL(`${fonte.nome}.diagnostico.txt`, PASTA), linhas.join("\n") + "\n");
      }
    }
    normas.push(item);
    const antes = anterior?.normas.find((n) => n.nome === fonte.nome);
    console.log(`${fonte.nome}: ${bytes.length} bytes, ${antes?.sha256 === sha256 ? "sem mudança" : "MUDOU"}`);
    await writeFile(new URL(`${fonte.nome}.json`, PASTA), bytes);
  }
  for (const antes of anterior?.normas ?? []) {
    if (!normas.some((n) => n.nome === antes.nome) && FONTES.some((f) => f.nome === antes.nome)) normas.push(antes);
  }
  const manifesto: Manifesto = { capturadoEm: new Date().toISOString(), origem: "normas.leg.br, script de captura", normas };
  await writeFile(new URL("manifesto.json", PASTA), JSON.stringify(manifesto, null, 2) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  capturar().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
}
