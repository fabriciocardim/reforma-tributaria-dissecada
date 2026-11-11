/*
 * Ficha de artigo (docs/design.md, "Páginas"). Puro: recebe a norma e o catálogo e devolve o HTML.
 * Cobre "Onde estou" (trilha, artigo anterior e próximo), "Texto oficial" (etiquetas de redação,
 * remissões com um nível expandido, blocos de alteração de outras normas) e a linha do tempo.
 * "Para que serve", termos definidos e palavras-gatilho ainda não existem.
 */
import { ancestrais, redacaoAtual, type Dispositivo, type Versao } from "../captura/ler.ts";
import { emBloco, TIPOS_ESTRUTURA, type Catalogo, type Destino, type Norma } from "./norma.ts";
import { resolverLocais } from "./referencias.ts";
import { renderizarExplicacao, type Explicacao } from "./explicacao.ts";
import { escapar, renderizarTextoLegal, type Opcoes } from "./remissao.ts";
import { dataBr, subarvore } from "./util.ts";

export { dataBr, subarvore };

export interface ItemTrilha {
  id: string;
  rotulo: string;
  titulo: string;
}

export interface EntradaLinhaDoTempo {
  data: string;
  itens: string[];
}

export interface ConfiguracaoFicha {
  catalogo: Catalogo;
  capturadoEm: string;
  /** Mostra "Efeitos: não carregada" na versão (a tabela de efeitos do art. 544 ainda não existe). */
  mostrarEfeitos: (norma: Norma, versao: Versao) => boolean;
  /** Explicações "Para que serve", por "<norma>|<id do artigo>". */
  explicacoes: Map<string, Explicacao>;
  /** Temas que citam o artigo, por "<norma>|<id do artigo>". */
  temas?: Map<string, { slug: string; titulo: string }[]>;
}

const NIVEL: Record<string, number> = { caput: 0, paragrafo: 1, inciso: 2, alinea: 3, item: 4 };
const LIMITE_EXPANSAO = 30;

const ROTULOS_VERSAO: Record<string, string> = {
  Insertion_Version: "Incluído",
  Text_Change_Version: "Redação dada",
  Text_Indirect_Change_Version: "Texto alterado indiretamente",
  Repeal_Version: "Revogado",
  Suppression_Version: "Suprimido",
  Renumbering_Version: "Renumerado",
  Court_Decision_Version: "Decisão judicial",
  Rejected_Veto_Version: "Veto derrubado",
  Vetoed_Text_Change_Version: "Alteração vetada",
  Vetoed_Insertion_Version: "Inclusão vetada",
  Suppression_By_Moviment_Version: "Reposicionado",
  Insertion_By_Moviment_Version: "Inserido por reposicionamento",
  Applicability_Suppression_Version: "Aplicabilidade suprimida",
};

/** Etiqueta "redação dada por…" da versão; null na redação original. */
export function etiquetaRedacao(v: Versao): string | null {
  const tipos = [...new Set(v.tipos)].filter((t) => t !== "Original_Version");
  if (tipos.length === 0) return null;
  const partes = tipos.map((t) => ROTULOS_VERSAO[t] ?? `Versão ${t}`);
  const frase = partes.length === 1 ? partes[0]! : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]!.toLowerCase()}`;
  return v.causa?.nome ? `${frase} por ${v.causa.nome}` : frase;
}

const ehVeto = (v: Versao): boolean => v.tipos.some((t) => t.startsWith("Vetoed_"));

export function montarTrilha(norma: Norma, artigo: Dispositivo): ItemTrilha[] {
  return ancestrais(norma.porId, artigo).flatMap((a) => {
    const v = redacaoAtual(a);
    return v && v.rotulo && TIPOS_ESTRUTURA.includes(a.tipo) ? [{ id: a.id, rotulo: v.rotulo, titulo: v.texto ?? "" }] : [];
  });
}

const rotuloCurto = (r: string): string => r.replace(/[\s.–]+$/, "");

function descricao(d: Dispositivo, v: Versao): string {
  return rotuloCurto(v.rotulo) || (d.tipo === "caput" ? "caput" : d.id);
}

export function montarLinhaDoTempo(dispositivos: Dispositivo[]): EntradaLinhaDoTempo[] {
  const porData = new Map<string, string[]>();
  for (const d of dispositivos) {
    if (!["artigo", "caput", "paragrafo", "inciso", "alinea", "item"].includes(d.tipo)) continue;
    for (const v of d.versoes) {
      const etiqueta = etiquetaRedacao(v);
      if (etiqueta === null && d.tipo !== "artigo") continue;
      const lista = porData.get(v.data) ?? [];
      lista.push(etiqueta === null ? "redação original" : `${descricao(d, v)}: ${etiqueta}`);
      porData.set(v.data, lista);
    }
  }
  return [...porData.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, itens]) => ({ data, itens: [...new Set(itens)] }));
}

/** "Art. 155, caput, I": onde o dispositivo está dentro do artigo. */
export function descreverDispositivo(norma: Norma, d: Dispositivo): string {
  const partes: string[] = [];
  for (let x: Dispositivo | undefined = d; x; x = x.pai === null ? undefined : norma.porId.get(x.pai)) {
    const v = redacaoAtual(x);
    if (x.tipo === "artigo") {
      partes.unshift(rotuloCurto(v?.rotulo ?? x.id));
      break;
    }
    if (x.tipo === "caput") partes.unshift("caput");
    else if (x.tipo === "alinea") partes.unshift(`alínea ${rotuloCurto(v?.rotulo ?? x.id).replace(/\)$/, "")}`);
    else if (["paragrafo", "inciso", "item"].includes(x.tipo)) partes.unshift(rotuloCurto(v?.rotulo ?? x.id));
  }
  return partes.join(", ");
}

class Pagina {
  private cfg: ConfiguracaoFicha;
  readonly norma: Norma;
  readonly artigo: Dispositivo;

  constructor(cfg: ConfiguracaoFicha, norma: Norma, artigo: Dispositivo) {
    this.cfg = cfg;
    this.norma = norma;
    this.artigo = artigo;
  }

  private opcoes(d: Dispositivo, comLocais: boolean): Opcoes {
    const { catalogo } = this.cfg;
    const bloco = emBloco(this.norma.porId, d);
    const propria = this.norma.slug === "lc-214-2025";
    return {
      resolverUrn: (urn) => catalogo.resolverUrn(urn, this.norma, this.artigo),
      locais:
        comLocais && !bloco
          ? (plano) => resolverLocais(plano, { catalogo, norma: this.norma, artigo: this.artigo, marcarSemNorma: propria, leiComplementarPropria: propria })
          : undefined,
      naoResolvidas: comLocais && !bloco && propria ? /\b(?:nesta|desta) Lei Complementar\b/g : undefined,
    };
  }

  private texto(d: Dispositivo, texto: string, comLocais = true): { html: string; destinos: Destino[] } {
    return renderizarTextoLegal(texto, this.opcoes(d, comLocais));
  }

  private rotuloDe(d: Dispositivo, v: Versao): string {
    if (d.tipo !== "caput") return v.rotulo;
    const pai = d.pai === null ? undefined : this.norma.porId.get(d.pai);
    return pai?.tipo === "artigo" ? (redacaoAtual(pai)?.rotulo ?? "") : "";
  }

  private expansao(d: Dispositivo, destino: Destino): string {
    const alvo = destino.alvo!;
    let raiz = alvo.dispositivo;
    if (raiz.tipo === "artigo") {
      const caput = raiz.filhos.map((f) => alvo.norma.porId.get(f)).find((x) => x?.tipo === "caput");
      if (!caput) return "";
      raiz = caput;
    }
    const nos = subarvore(alvo.norma.porId, raiz);
    if (nos.length > LIMITE_EXPANSAO || nos.includes(d) || ancestrais(alvo.norma.porId, d).includes(raiz)) return "";
    const base = NIVEL[raiz.tipo] ?? 0;
    const linhas = nos.flatMap((n) => {
      const v = redacaoAtual(n);
      if (!v || v.texto === null) return [];
      const rotulo = n.tipo === "caput" ? "" : v.rotulo;
      const html = renderizarTextoLegal(v.texto, { resolverUrn: (u) => this.cfg.catalogo.resolverUrn(u, this.norma, this.artigo) }).html;
      const nivel = Math.max(0, (NIVEL[n.tipo] ?? 1) - base);
      return [`<p class="n${nivel}">${rotulo ? `<strong>${escapar(rotulo)}</strong> ` : ""}${html}</p>`];
    });
    if (linhas.length === 0) return "";
    const onde = alvo.norma === this.norma ? "" : `${escapar(alvo.norma.nome)}, `;
    const resumo = `Remissão expandida · ${onde}${escapar(descreverDispositivo(alvo.norma, alvo.dispositivo))}`;
    return `<details class="expansao"><summary>${resumo}</summary><div class="citado">${linhas.join("")}</div></details>`;
  }

  private selos(v: Versao): string {
    const etiqueta = etiquetaRedacao(v);
    if (etiqueta === null) return "";
    const classe = ehVeto(v) ? "veto" : "redacao";
    const efeitos = this.cfg.mostrarEfeitos(this.norma, v) ? `<span class="selo efeitos">Efeitos: não carregada</span>` : "";
    return `<div class="selos"><span class="selo ${classe}">${escapar(etiqueta)}</span>${efeitos}</div>`;
  }

  private anteriores(d: Dispositivo, aberto: boolean): string {
    const itens = d.versoes
      .slice(0, -1)
      .filter((v) => v.texto !== null)
      .map((v) => {
        const periodo = v.vigencia ? `vigente de ${v.vigencia.split("/").map(dataBr).join(" a ")}` : dataBr(v.data);
        const quem = etiquetaRedacao(v) ?? "Redação original";
        return `<p class="anterior"><span class="periodo">${escapar(quem)} · ${escapar(periodo)}</span> ${this.texto(d, v.texto!, false).html}</p>`;
      })
      .join("");
    return itens ? `<details${aberto ? " open" : ""}><summary>ver redação anterior</summary>${itens}</details>` : "";
  }

  private dispositivo(d: Dispositivo): string {
    const v = redacaoAtual(d);
    if (!v || v.texto === null) return "";
    const veto = ehVeto(v);
    const { html, destinos } = this.texto(d, v.texto);
    const nota = v.nota ? `<p class="nota-fonte">Nota da fonte: ${escapar(v.nota)}</p>` : "";
    const paragrafo = `<p><strong>${escapar(this.rotuloDe(d, v))}</strong> ${html}</p>`;
    const expansoes = destinos.map((x) => this.expansao(d, x)).join("");
    const nivel = NIVEL[d.tipo] ?? 1;
    return `<div class="disp n${nivel}" id="${escapar(d.id)}">${this.selos(v)}${nota}${veto ? `<div class="vetado">${paragrafo}</div>` : paragrafo}${expansoes}${this.anteriores(d, veto)}</div>`;
  }

  no(d: Dispositivo): string {
    const filhos = (): string =>
      d.filhos
        .map((f) => this.norma.porId.get(f))
        .filter((f): f is Dispositivo => f !== undefined)
        .map((f) => this.no(f))
        .join("\n");
    const v = redacaoAtual(d);
    switch (d.tipo) {
      case "bloco.de.alteracao":
        return `<blockquote class="alteracao"><p class="alt-rotulo">Texto de outra norma, citado por este dispositivo</p>${filhos()}</blockquote>`;
      case "omissis":
        return `<p class="omissis">${escapar(v?.texto ?? "")}</p>`;
      case "artigo":
        return filhos();
      default:
        if (TIPOS_ESTRUTURA.includes(d.tipo)) return `<p class="estrutura"><strong>${escapar(v?.rotulo ?? "")}</strong> ${escapar(v?.texto ?? "")}</p>\n${filhos()}`;
        return `${this.dispositivo(d)}\n${filhos()}`;
    }
  }
}

export function gerarFicha(cfg: ConfiguracaoFicha, norma: Norma, idArtigo: string): string {
  const artigo = norma.porId.get(idArtigo);
  const posicao = norma.artigos.findIndex((a) => a.id === idArtigo);
  if (!artigo || artigo.tipo !== "artigo" || posicao < 0) throw new Error(`${idArtigo} não é um artigo com página em ${norma.slug}`);
  const rotuloArtigo = redacaoAtual(artigo)?.rotulo.replace(/\.$/, "") ?? idArtigo;
  const pagina = new Pagina(cfg, norma, artigo);

  const trilha = [
    `<a href="../">${escapar(norma.nome)}</a>`,
    ...montarTrilha(norma, artigo).map((t) => `<a href="../#${escapar(t.id)}" title="${escapar(t.titulo)}">${escapar(t.rotulo)}</a>`),
  ].join('<span aria-hidden="true">›</span>');

  const vizinho = (a: Dispositivo | undefined, anterior: boolean): string => {
    if (!a) return "<span></span>";
    const r = (redacaoAtual(a)?.rotulo ?? a.id).replace(/\.$/, "");
    return `<a href="../${norma.slugs.get(a.id)}/">${anterior ? `‹ ${escapar(r)}` : `${escapar(r)} ›`}</a>`;
  };

  const doArtigo = cfg.temas?.get(`${norma.slug}|${artigo.id}`) ?? [];
  const temasHtml = doArtigo.length ? `<p class="temas-do-artigo">Tema: ${doArtigo.map((t) => `<a href="../../../tema/${escapar(t.slug)}/">${escapar(t.titulo)}</a>`).join(", ")}</p>` : "";
  const corpo = pagina.no(artigo);
  const tempo = montarLinhaDoTempo(subarvore(norma.porId, artigo))
    .map((e) => `<li><strong>${dataBr(e.data)}</strong><ul>${e.itens.map((i) => `<li>${escapar(i)}</li>`).join("")}</ul></li>`)
    .join("\n");
  const fonte = `https://normas.leg.br/?urn=${norma.urn}!${artigo.id.split(",")[0]}`;
  const titulo = `${rotuloArtigo} — ${norma.nome}`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo)}</title>
<style>${CSS_BASE}</style>
</head>
<body>
<header class="topo"><div class="miolo"><a class="marca" href="../../../">Reforma Tributária Dissecada</a></div></header>
<div class="miolo pagina">
<main>
<section aria-labelledby="t1">
<h2 id="t1" class="rotulo">Onde estou</h2>
<nav aria-label="Posição na lei" class="trilha">${trilha}</nav>
<h1>${escapar(rotuloArtigo)}</h1>
${temasHtml}
<div class="vizinhos">${vizinho(norma.artigos[posicao - 1], true)}${vizinho(norma.artigos[posicao + 1], false)}</div>
</section>
<section aria-labelledby="t2">
<div class="cabeca"><h2 id="t2" class="rotulo">Texto oficial</h2><span class="origem">Capturado do normas.leg.br em ${dataBr(cfg.capturadoEm)} · <a href="${escapar(fonte)}">ver na fonte ↗</a></span></div>
<div class="lei">
${corpo}
</div>
</section>
${renderizarExplicacao(norma, norma.slugs.get(artigo.id)!, artigo, cfg.explicacoes.get(`${norma.slug}|${artigo.id}`))}
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
<p>Explicações geradas por inteligência artificial; cada uma mostra se foi conferida e quando. Conteúdo próprio sob licença Creative Commons Atribuição.</p>
</div></footer>
</body>
</html>
`;
}

export const CSS_BASE = `
:root{--fundo:#F6F5F1;--cartao:#fff;--borda:#E2DFD6;--tinta:#1C1B19;--suave:#55524B;--link:#1F4E8C;--serifa:Georgia,"Times New Roman",serif;--sans:system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--fundo);color:var(--tinta);font-family:var(--sans)}
a{color:var(--link)}a:hover{color:#163A69}
.miolo{max-width:1180px;margin:0 auto;padding:0 24px}
.topo{background:var(--cartao);border-bottom:1px solid var(--borda)}
.marca{text-decoration:none;color:inherit;display:inline-block;padding:12px 0;font-family:var(--serifa);font-size:20px;font-weight:600}
.pagina{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;padding-top:24px;padding-bottom:48px}
main{flex:999 1 620px;min-width:0;display:flex;flex-direction:column;gap:20px}
aside{flex:1 1 280px;min-width:0}
section{background:var(--cartao);border:1px solid var(--borda);border-radius:12px;padding:20px 24px}
.rotulo{margin:0;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#6B675E}
.trilha{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:14px;color:var(--suave)}
.trilha a{text-decoration:none}
h1{margin:12px 0 0;font-family:var(--serifa);font-size:34px;font-weight:600;line-height:1.15}
.temas-do-artigo{margin:10px 0 0;font-size:14px;color:var(--suave)}
.vizinhos{margin-top:10px;display:flex;justify-content:space-between;font-size:14px}
.vizinhos a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none}
.cabeca{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline}
.origem{font-size:12px;color:#6B675E}
.lei{margin-top:14px;font-family:var(--serifa);font-size:19px;line-height:1.65;display:flex;flex-direction:column;gap:12px}
.lei p{margin:0}
.n1{margin-left:24px}.n2{margin-left:48px}.n3{margin-left:72px}.n4{margin-left:96px}
.disp:target{background:#FFF8E1;outline:2px solid #F0D58A;border-radius:4px}
.selos{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;font-family:var(--sans);font-size:12px}
.selo{padding:3px 8px;border-radius:999px;font-weight:500}
.redacao{background:#EDE7F8;color:#4A2F86}
.veto{background:#FDE8E4;color:#8A2A17}
.efeitos{background:#F1EFEA;color:var(--suave);border:1px dashed #A8A396}
.nota-fonte{font-family:var(--sans);font-size:13px!important;color:var(--suave);margin-bottom:4px!important}
.vetado{border:1px dashed #D9A79B;border-radius:6px;padding:8px 10px;background:#FFFAF8}
a.remissao{font-family:var(--sans);font-size:15px;font-weight:500;background:#E6EEF8;color:#163A69;padding:2px 8px;border-radius:999px;text-decoration:none}
.nao-resolvida{background:#F1EFEA;border:1px dashed #A8A396;padding:0 4px;border-radius:3px}
details{margin-top:6px;font-family:var(--sans);font-size:14px}
summary{cursor:pointer;color:var(--link);font-weight:500;min-height:44px;display:flex;align-items:center}
.expansao{border:1px solid #C9D7EA;background:#F5F8FC;border-radius:8px;padding:0 14px;margin-left:0}
.expansao summary{color:#163A69;font-size:13px}
.citado{font-family:var(--serifa);font-size:16px;line-height:1.6;padding-bottom:10px}
.citado p{margin:4px 0}
.anterior{font-family:var(--serifa);font-size:16px;color:var(--suave)}
.periodo{font-family:var(--sans);font-size:12px;font-weight:600}
.alteracao{margin:4px 0 4px 24px;padding:10px 14px;border-left:3px solid #CFCABD;background:#FBFAF7;display:flex;flex-direction:column;gap:8px;font-size:17px}
.alt-rotulo{font-family:var(--sans);font-size:12px!important;font-weight:600;color:var(--suave);letter-spacing:.04em;text-transform:uppercase}
.omissis{color:var(--suave);letter-spacing:.1em;overflow:hidden;white-space:nowrap}
.estrutura{font-family:var(--sans);font-size:14px!important;color:var(--suave)}
.ia{background:#FCFBFF;border:1.5px dashed #9C86CF}
.ia.vazio{background:var(--cartao);border:1.5px dashed #CFCABD}
.rotulo-ia,.origem-ia{color:#4A2F86}
.origem-ia{font-size:12px}
.aviso{margin-top:12px;border-radius:8px;padding:8px 12px;font-size:13px}
.nao-conferida{background:#FFF1D6;color:#5C4300}
.conferida{background:#E4F2EC;color:#1F5C43}
.desatualizada{background:#FDE8E4;color:#8A2A17}
.explicacao{margin-top:12px;font-size:16px;line-height:1.6;display:flex;flex-direction:column;gap:10px}
.explicacao p{margin:0}
.rodape-ia{margin-top:14px;padding-top:12px;border-top:1px solid #E6DFF5;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;font-size:13px;color:var(--suave)}
.botao{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border:1px solid #9C86CF;border-radius:8px;text-decoration:none;color:#4A2F86;font-weight:500}
.tempo{margin:12px 0 0;padding:0 0 0 18px;display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.45}
.tempo ul{margin:2px 0 0;padding-left:16px}
.nota{margin:10px 0 0;font-size:12px;color:var(--suave)}
footer{border-top:1px solid var(--borda);background:var(--cartao);font-size:13px;line-height:1.5;color:var(--suave)}
footer p{margin:6px 0}footer .miolo{padding-top:14px;padding-bottom:20px}
@media (max-width:600px){.miolo{padding:0 16px}section{padding:16px}h1{font-size:28px}.lei{font-size:17px}.n2{margin-left:32px}.n3{margin-left:48px}.n4{margin-left:64px}.alteracao{margin-left:8px}}
`;
