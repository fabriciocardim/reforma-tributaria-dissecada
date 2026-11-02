/*
 * Ficha de artigo (docs/design.md, "Páginas"). Puro: recebe os dispositivos já lidos e devolve o HTML.
 * Cobre "Onde estou" (trilha), "Texto oficial" (etiquetas de redação, remissões) e a linha do tempo;
 * "Para que serve", termos definidos e palavras-gatilho ainda não existem.
 */
import { ancestrais, redacaoAtual, type Dispositivo, type Versao } from "../captura/ler.ts";
import { escapar, hrefRemissao, renderizarTextoLegal } from "./remissao.ts";

export interface Lei {
  /** Nome em `captura/fontes.ts`; também o trecho do endereço: /lei/<slug>/art-<n>/. */
  slug: string;
  nome: string;
  urn: string;
}

export interface ItemTrilha {
  rotulo: string;
  titulo: string;
}

export interface EntradaLinhaDoTempo {
  data: string;
  itens: string[];
}

const NIVEL: Record<string, number> = { caput: 0, paragrafo: 1, inciso: 2, alinea: 3, item: 4 };

export function dataBr(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

export function montarTrilha(porId: Map<string, Dispositivo>, artigo: Dispositivo): ItemTrilha[] {
  return ancestrais(porId, artigo).flatMap((a) => {
    const v = redacaoAtual(a);
    return v && v.rotulo ? [{ rotulo: v.rotulo, titulo: v.texto ?? "" }] : [];
  });
}

/** Etiqueta "redação dada por…" da versão; null na redação original. */
export function etiquetaRedacao(v: Versao): string | null {
  if (v.tipos.length === 1 && v.tipos[0] === "Original_Version") return null;
  const quem = v.causa?.nome ?? "dispositivo não identificado na fonte";
  if (v.tipos.includes("Court_Decision_Version")) return `Decisão: ${quem}`;
  if (v.tipos.includes("Repeal_Version")) return `Revogado por ${quem}`;
  if (v.tipos.includes("Insertion_Version")) return `Incluído por ${quem}`;
  if (v.tipos.includes("Text_Change_Version")) return `Redação dada por ${quem}`;
  return `${v.tipos.join(", ")}: ${quem}`;
}

export function artigosDoDispositivo(porId: Map<string, Dispositivo>, artigo: Dispositivo): Dispositivo[] {
  const saida: Dispositivo[] = [];
  const visitar = (d: Dispositivo): void => {
    saida.push(d);
    for (const f of d.filhos) {
      const filho = porId.get(f);
      if (filho) visitar(filho);
    }
  };
  visitar(artigo);
  return saida;
}

export function montarLinhaDoTempo(dispositivos: Dispositivo[]): EntradaLinhaDoTempo[] {
  const porData = new Map<string, string[]>();
  for (const d of dispositivos) {
    for (const v of d.versoes) {
      const etiqueta = etiquetaRedacao(v);
      if (etiqueta === null && d.tipo !== "artigo") continue;
      const lista = porData.get(v.data) ?? [];
      lista.push(etiqueta === null ? "redação original" : `${rotuloCurto(d, v)}: ${etiqueta}`);
      porData.set(v.data, lista);
    }
  }
  return [...porData.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, itens]) => ({ data, itens: [...new Set(itens)] }));
}

function rotuloCurto(d: Dispositivo, v: Versao): string {
  return v.rotulo.replace(/\s*–$/, "") || (d.tipo === "caput" ? "caput" : d.id);
}

function rotuloDoDispositivo(d: Dispositivo, artigo: Dispositivo): string {
  const v = redacaoAtual(d);
  if (d.tipo === "caput") return redacaoAtual(artigo)?.rotulo ?? "";
  return v?.rotulo ?? "";
}

function renderizarDispositivo(d: Dispositivo, artigo: Dispositivo): string {
  const atual = redacaoAtual(d);
  if (!atual || atual.texto === null) return "";
  const etiqueta = etiquetaRedacao(atual);
  const selos =
    etiqueta === null
      ? ""
      : `<div class="selos"><span class="selo redacao">${escapar(etiqueta)}</span><span class="selo efeitos">Efeitos: não carregada</span></div>`;
  const anteriores = d.versoes
    .slice(0, -1)
    .filter((v) => v.texto !== null)
    .map((v) => {
      const periodo = v.vigencia ? ` (vigente de ${v.vigencia.split("/").map(dataBr).join(" a ")})` : ` (${dataBr(v.data)})`;
      return `<p class="anterior"><span class="periodo">Redação anterior${escapar(periodo)}</span> ${renderizarTextoLegal(v.texto!, hrefRemissao)}</p>`;
    })
    .join("");
  const historico = anteriores ? `<details><summary>ver redação anterior</summary>${anteriores}</details>` : "";
  const rotulo = rotuloDoDispositivo(d, artigo);
  const nivel = NIVEL[d.tipo] ?? 1;
  return `<div class="disp n${nivel}" id="${escapar(d.id)}">${selos}<p><strong>${escapar(rotulo)}</strong> ${renderizarTextoLegal(atual.texto, hrefRemissao)}</p>${historico}</div>`;
}

export function gerarFicha(lei: Lei, dispositivos: Dispositivo[], idArtigo: string, capturadoEm: string): string {
  const porId = new Map(dispositivos.map((d) => [d.id, d]));
  const artigo = porId.get(idArtigo);
  if (!artigo || artigo.tipo !== "artigo") throw new Error(`${idArtigo} não é um artigo de ${lei.slug}`);
  const rotuloArtigo = redacaoAtual(artigo)?.rotulo ?? idArtigo;
  const partes = artigosDoDispositivo(porId, artigo);

  const trilhaHtml = [
    `<span>${escapar(lei.nome)}</span>`,
    ...montarTrilha(porId, artigo).map((t) => `<span title="${escapar(t.titulo)}">${escapar(t.rotulo)}</span>`),
  ].join('<span aria-hidden="true">›</span>');

  const corpo = partes
    .filter((d) => d !== artigo)
    .map((d) => renderizarDispositivo(d, artigo))
    .join("\n");

  const tempo = montarLinhaDoTempo(partes)
    .map((e) => `<li><strong>${dataBr(e.data)}</strong> · ${e.itens.map(escapar).join("; ")}</li>`)
    .join("\n");

  const fonte = `https://normas.leg.br/?urn=${lei.urn}!${artigo.id}`;
  const titulo = `${rotuloArtigo} — ${lei.nome}`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo)}</title>
<style>${CSS}</style>
</head>
<body>
<header class="topo"><div class="miolo"><span class="marca">Reforma Tributária Dissecada</span></div></header>
<div class="miolo pagina">
<main>
<section aria-labelledby="t1">
<h2 id="t1" class="rotulo">Onde estou</h2>
<nav aria-label="Posição na lei" class="trilha">${trilhaHtml}</nav>
<h1>${escapar(rotuloArtigo)}</h1>
</section>
<section aria-labelledby="t2">
<div class="cabeca"><h2 id="t2" class="rotulo">Texto oficial</h2><span class="origem">Capturado do normas.leg.br em ${dataBr(capturadoEm)} · <a href="${escapar(fonte)}">ver na fonte ↗</a></span></div>
<div class="lei">
${corpo}
</div>
</section>
</main>
<aside>
<section aria-labelledby="t5">
<h2 id="t5" class="rotulo">Linha do tempo</h2>
<ol class="tempo">
${tempo}
</ol>
<p class="nota">Montada a partir das versões registradas na fonte.</p>
</section>
</aside>
</div>
<footer><div class="miolo">
<p><strong>Não substitui o texto oficial.</strong> Texto legal do <a href="https://normas.leg.br">normas.leg.br</a>, licença <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Atribuição 4.0</a>.</p>
<p>Explicações geradas por inteligência artificial ainda não existem nesta ficha. Conteúdo próprio sob licença Creative Commons Atribuição.</p>
</div></footer>
</body>
</html>
`;
}

const CSS = `
:root{--fundo:#F6F5F1;--cartao:#fff;--borda:#E2DFD6;--tinta:#1C1B19;--suave:#55524B;--link:#1F4E8C;--serifa:Georgia,"Times New Roman",serif;--sans:system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--sans)}
a{color:var(--link)}a:hover{color:#163A69}
.miolo{max-width:1180px;margin:0 auto;padding:0 24px}
.topo{background:var(--cartao);border-bottom:1px solid var(--borda)}
.marca{display:inline-block;padding:12px 0;font-family:var(--serifa);font-size:20px;font-weight:600}
.pagina{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;padding-top:24px;padding-bottom:48px}
main{flex:999 1 620px;min-width:0;display:flex;flex-direction:column;gap:20px}
aside{flex:1 1 280px;min-width:0}
section{background:var(--cartao);border:1px solid var(--borda);border-radius:12px;padding:20px 24px}
.rotulo{margin:0;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#6B675E}
.trilha{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:14px;color:var(--suave)}
h1{margin:12px 0 0;font-family:var(--serifa);font-size:34px;font-weight:600;line-height:1.15}
.cabeca{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline}
.origem{font-size:12px;color:#6B675E}
.lei{margin-top:14px;font-family:var(--serifa);font-size:19px;line-height:1.65;display:flex;flex-direction:column;gap:12px}
.lei p{margin:0}
.n1{margin-left:24px}.n2{margin-left:48px}.n3{margin-left:72px}.n4{margin-left:96px}
.disp:target{background:#FFF8E1;outline:2px solid #F0D58A;border-radius:4px}
.selos{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;font-family:var(--sans);font-size:12px}
.selo{padding:3px 8px;border-radius:999px;font-weight:500}
.redacao{background:#EDE7F8;color:#4A2F86}
.efeitos{background:#F1EFEA;color:var(--suave);border:1px dashed #A8A396}
a.remissao{font-family:var(--sans);font-size:15px;font-weight:500;background:#E6EEF8;color:#163A69;padding:2px 8px;border-radius:999px;text-decoration:none}
.nao-resolvida{background:#F1EFEA;border:1px dashed #A8A396;padding:0 4px;border-radius:3px}
details{margin-top:6px;font-family:var(--sans);font-size:14px}
summary{cursor:pointer;color:var(--link);font-weight:500;min-height:44px;display:flex;align-items:center}
.anterior{font-family:var(--serifa);font-size:16px;color:var(--suave)}
.periodo{font-family:var(--sans);font-size:12px;font-weight:600}
.tempo{margin:12px 0 0;padding:0 0 0 18px;display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.45}
.nota{margin:10px 0 0;font-size:12px;color:var(--suave)}
footer{border-top:1px solid var(--borda);background:var(--cartao);font-size:13px;line-height:1.5;color:var(--suave)}
footer p{margin:6px 0}footer .miolo{padding-top:14px;padding-bottom:20px}
@media (max-width:600px){.miolo{padding:0 16px}section{padding:16px}h1{font-size:28px}.lei{font-size:17px}.n2{margin-left:32px}}
`;
