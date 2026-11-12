/*
 * Páginas de visão geral: o mapa da lei e uma página para cada bloco da estrutura (livro, título, capítulo,
 * seção, subseção). Puro. O bloco sem conteúdo gerado continua navegável, com a estrutura e os artigos.
 */
import type { Dispositivo } from "../captura/ler.ts";
import type { Base } from "./carregar.ts";
import { REPOSITORIO, SITE } from "./config.ts";
import { situacao as situacaoFicha, impressaoDigital, type Explicacao, type Situacao } from "./explicacao.ts";
import { CSS_BASE } from "./ficha.ts";
import type { Norma } from "./norma.ts";
import { escapar } from "./remissao.ts";
import { dataBr, idUrl, subarvore } from "./util.ts";
import { ehNoDaEstrutura, impressaoDoBloco, rotuloDoNo, situacaoDoBloco, type Bloco, type Visao } from "./visao.ts";
import { impressaoDoTema, situacaoTema, type Tema } from "./tema.ts";

export interface ContextoBloco {
  base: Base;
  visoes: Map<string, Visao>;
  explicacoes: Map<string, Explicacao>;
  temas: Tema[];
}

export { idUrl };

export function filhosDaEstrutura(norma: Norma, d: Dispositivo): Dispositivo[] {
  return d.filhos.map((f) => norma.porId.get(f)).filter((x): x is Dispositivo => x !== undefined && ehNoDaEstrutura(norma, x));
}

export function artigosDiretos(norma: Norma, d: Dispositivo): Dispositivo[] {
  return d.filhos.map((f) => norma.porId.get(f)).filter((x): x is Dispositivo => x !== undefined && x.tipo === "artigo" && norma.slugs.has(x.id));
}

export function artigosDoNo(norma: Norma, d: Dispositivo): Dispositivo[] {
  return subarvore(norma.porId, d).filter((x) => x.tipo === "artigo" && norma.slugs.has(x.id));
}

/** Do mais externo para o próprio nó, só com nós da estrutura. */
export function cadeiaDoNo(norma: Norma, d: Dispositivo): Dispositivo[] {
  const cadeia: Dispositivo[] = [];
  for (let x: Dispositivo | undefined = d; x; x = x.pai === null ? undefined : norma.porId.get(x.pai)) if (ehNoDaEstrutura(norma, x)) cadeia.unshift(x);
  return cadeia;
}

const BADGE: Record<Situacao, { texto: string; classe: string }> = {
  "nao-conferida": { texto: "Não conferido", classe: "nao-conferida" },
  conferida: { texto: "Conferido", classe: "conferida" },
  desatualizada: { texto: "Texto legal mudou", classe: "desatualizada" },
};

const primeiraFrase = (s: string): string => {
  const m = /^(.+?[.!?])(\s|$)/.exec(s);
  return m ? m[1]! : s;
};

function linkProblema(norma: Norma, b: Bloco): string {
  const corpo = ["Tipo do problema (erro de conteúdo, explicação confusa, remissão errada, texto desatualizado):", "", "Descreva o problema:", "", "---", `Bloco: ${SITE}lei/${norma.slug}/bloco/${idUrl(b.id)}/`, `Nó da estrutura: ${b.id}`, `Impressão digital do bloco: ${b.impressaoDigital}`].join("\n");
  return `https://github.com/${REPOSITORIO}/issues/new?title=${encodeURIComponent(`Problema na visão geral: ${norma.nome}, ${b.id}`)}&body=${encodeURIComponent(corpo)}`;
}

const AVISO: Record<Situacao, string> = {
  "nao-conferida": `<div role="note" class="aviso nao-conferida"><strong>Não conferido.</strong> Esta visão geral foi gerada por inteligência artificial a partir dos artigos-chave. Confira contra o texto oficial.</div>`,
  conferida: `<div role="note" class="aviso conferida"><strong>Conferido.</strong></div>`,
  desatualizada: `<div role="note" class="aviso desatualizada"><strong>O texto legal de um artigo-chave mudou desde que esta visão foi gerada.</strong> Ela volta a não conferida e pode estar desatualizada.</div>`,
};

/** Frase de uma linha para listas: o resumo do bloco, quando existe. */
export function resumoCurto(visao: Visao | undefined, id: string): string | null {
  return visao?.blocos.get(id)?.resumo ?? null;
}

function cartaoDoFilho(norma: Norma, visao: Visao | undefined, f: Dispositivo): string {
  const { rotulo, titulo } = rotuloDoNo(f);
  const b = visao?.blocos.get(f.id);
  const n = artigosDoNo(norma, f).length;
  return `<a class="cartao-bloco" href="../${idUrl(f.id)}/"><span class="rot">${escapar(rotulo)}</span><span class="tit">${escapar(titulo)}</span>${b ? `<span class="perg">${escapar(b.pergunta)}</span><span class="frase">${escapar(b.resumo)}</span>` : ""}<span class="qtd">${n} ${n === 1 ? "artigo" : "artigos"}</span></a>`;
}

export function gerarBloco(norma: Norma, no: Dispositivo, ctx: ContextoBloco, capturadoEm: string): string {
  const visao = ctx.visoes.get(norma.slug);
  const b = visao?.blocos.get(no.id);
  const { rotulo, titulo } = rotuloDoNo(no);
  const cadeia = cadeiaDoNo(norma, no);
  const trilha = [`<a href="../../">${escapar(norma.nome)}</a>`, ...cadeia.slice(0, -1).map((c) => `<a href="../${idUrl(c.id)}/">${escapar(rotuloDoNo(c).rotulo)}</a>`), `<span>${escapar(rotulo)}</span>`].join('<span aria-hidden="true">›</span>');

  const filhos = filhosDaEstrutura(norma, no);
  const diretos = artigosDiretos(norma, no);
  const total = artigosDoNo(norma, no).length;

  let bloco = "";
  if (b) {
    const s = situacaoDoBloco(norma, b);
    const chaves = b.chaves
      .map((slug) => {
        const a = norma.artigos.find((x) => norma.slugs.get(x.id) === slug)!;
        const e = ctx.explicacoes.get(`${norma.slug}|${a.id}`);
        const rot = (rotuloDoNo(a).rotulo ?? "").replace(/\.$/, "");
        const sel = e ? BADGE[situacaoFicha(e, impressaoDigital(norma, a))] : null;
        return `<li><a href="../../${escapar(slug)}/"><span class="art"><strong>${escapar(rot)}</strong>${e ? ` · ${escapar(primeiraFrase(e.secoes[0]![0]!))}` : ""}</span>${sel ? `<span class="selo ${sel.classe}">${sel.texto}</span>` : ""}</a></li>`;
      })
      .join("\n");
    bloco = `<section aria-labelledby="visao" class="ia">
<div class="cabeca"><h2 id="visao" class="rotulo rotulo-ia">Visão geral</h2><span class="origem-ia">Gerado por inteligência artificial — não é texto de lei</span></div>
${AVISO[s]}
<div class="explicacao">
<p class="pergunta"><strong>Pergunta que este bloco responde.</strong> ${escapar(b.pergunta)}</p>
<p><strong>Em uma frase.</strong> ${escapar(b.resumo)}</p>
${b.regra ? `<p><strong>Regra geral.</strong> ${escapar(b.regra)}</p>` : ""}
${b.excecoes.length ? `<div><strong>Exceções.</strong><ul class="excecoes">${b.excecoes.map((e) => `<li>${escapar(e)}</li>`).join("")}</ul></div>` : ""}
</div>
<h3 class="sub">Artigos-chave</h3>
<ul class="lista-artigos chaves">
${chaves}
</ul>
<div class="rodape-ia"><span>Gerado em ${dataBr(visao!.geradaEm)} a partir dos artigos-chave</span><a class="botao" href="${escapar(linkProblema(norma, b))}">Reportar problema</a></div>
</section>`;
  } else {
    bloco = `<section aria-labelledby="visao" class="ia vazio"><h2 id="visao" class="rotulo rotulo-ia">Visão geral</h2><p class="nota">Ainda não gerada para este bloco. Abaixo estão a estrutura e os artigos.</p></section>`;
  }

  const dentro = filhos.length
    ? `<section aria-labelledby="dentro"><h2 id="dentro" class="rotulo">Dentro deste bloco</h2><div class="grade-blocos">${filhos.map((f) => cartaoDoFilho(norma, visao, f)).join("\n")}</div></section>`
    : "";
  const lista = diretos.length
    ? `<section aria-labelledby="arts"><h2 id="arts" class="rotulo">${filhos.length ? "Artigos soltos neste bloco" : `Artigos (${diretos.length})`}</h2><ul class="arts">${diretos.map((a) => `<li><a href="../../${norma.slugs.get(a.id)}/">${escapar(rotuloDoNo(a).rotulo.replace(/\.$/, ""))}</a></li>`).join("")}</ul></section>`
    : "";

  const pai = cadeia.length > 1 ? cadeia[cadeia.length - 2]! : null;
  const irmaos = pai ? filhosDaEstrutura(norma, pai) : norma.dispositivos.filter((d) => d.pai !== null && norma.porId.get(d.pai)?.tipo === "articulacao" && ehNoDaEstrutura(norma, d));
  const i = irmaos.findIndex((x) => x.id === no.id);
  const viz = (x: Dispositivo | undefined, ant: boolean): string => (x ? `<a href="../${idUrl(x.id)}/">${ant ? "‹ " : ""}${escapar(rotuloDoNo(x).rotulo)}${ant ? "" : " ›"}</a>` : "<span></span>");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(rotulo)} — ${escapar(norma.nome)}</title>
<style>${CSS_BASE}${CSS_BLOCO}</style>
</head>
<body>
<header class="topo"><div class="miolo"><a class="marca" href="../../../../">Reforma Tributária Dissecada</a></div></header>
<main class="miolo bloco-pagina">
<section aria-labelledby="t1">
<h2 id="t1" class="rotulo">Onde estou</h2>
<nav aria-label="Posição na lei" class="trilha">${trilha}</nav>
<h1>${escapar(rotulo)}</h1>
<p class="titulo-bloco">${escapar(titulo)}</p>
<p class="nota">${total} ${total === 1 ? "artigo" : "artigos"} neste bloco${norma.slug === "lc-214-2025" ? ` · <a href="../../mapa/">mapa da lei</a>` : ""}</p>
<div class="vizinhos">${viz(irmaos[i - 1], true)}${viz(irmaos[i + 1], false)}</div>
</section>
${bloco}
${dentro}
${lista}
</main>
<footer><div class="miolo">
<p><strong>Não substitui o texto oficial.</strong> Texto legal do <a href="https://normas.leg.br">normas.leg.br</a>, licença <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Atribuição 4.0</a>. Capturado em ${dataBr(capturadoEm)}.</p>
<p>Visões gerais geradas por inteligência artificial; cada uma mostra se foi conferida. Conteúdo próprio sob licença Creative Commons Atribuição.</p>
</div></footer>
</body>
</html>
`;
}

/** Mapa da lei em uma tela: livros e títulos com a pergunta de cada um, e o percurso de uma operação pelos temas. */
export function gerarMapa(norma: Norma, ctx: ContextoBloco, capturadoEm: string): string {
  const visao = ctx.visoes.get(norma.slug);
  const raizes = norma.dispositivos.filter((d) => d.pai !== null && norma.porId.get(d.pai)?.tipo === "articulacao" && ehNoDaEstrutura(norma, d));
  const livros = raizes.filter((d) => d.tipo === "livro");
  const nTitulos = norma.dispositivos.filter((d) => d.tipo === "titulo" && ehNoDaEstrutura(norma, d)).length;
  const nCapitulos = norma.dispositivos.filter((d) => d.tipo === "capitulo" && ehNoDaEstrutura(norma, d)).length;

  const secoesLivros = livros
    .map((l) => {
      const { rotulo, titulo } = rotuloDoNo(l);
      const b = visao?.blocos.get(l.id);
      const titulos = filhosDaEstrutura(norma, l);
      const cartoes = titulos
        .map((t) => {
          const r = rotuloDoNo(t);
          const bt = visao?.blocos.get(t.id);
          const n = artigosDoNo(norma, t).length;
          return `<a class="cartao-bloco" href="../bloco/${idUrl(t.id)}/"><span class="rot">${escapar(r.rotulo)}</span><span class="tit">${escapar(r.titulo)}</span>${bt ? `<span class="perg">${escapar(bt.pergunta)}</span><span class="frase">${escapar(bt.resumo)}</span>` : ""}<span class="qtd">${n} ${n === 1 ? "artigo" : "artigos"}</span></a>`;
        })
        .join("\n");
      return `<section aria-labelledby="${idUrl(l.id)}" class="ia">
<div class="cabeca"><h2 id="${idUrl(l.id)}" class="rotulo rotulo-ia"><a href="../bloco/${idUrl(l.id)}/">${escapar(rotulo)}</a></h2><span class="origem-ia">Gerado por inteligência artificial — não é texto de lei</span></div>
<p class="titulo-bloco">${escapar(titulo)}</p>
${b ? `<p class="explicacao-curta"><strong>${escapar(b.pergunta)}</strong> ${escapar(b.resumo)}</p>` : ""}
<div class="grade-blocos">
${cartoes}
</div>
</section>`;
    })
    .join("\n");

  const percurso = ctx.temas.length
    ? `<section aria-labelledby="percurso" class="ia">
<div class="cabeca"><h2 id="percurso" class="rotulo rotulo-ia">O percurso de uma operação pelos temas</h2><span class="origem-ia">Gerado por inteligência artificial — não é texto de lei</span></div>
<p class="nota">Cada tema responde a uma pergunta na ordem em que ela surge ao tributar uma operação.</p>
<ol class="percurso">
${ctx.temas
  .map((t) => {
    const s = situacaoTema(t, impressaoDoTema(ctx.base, t.artigos));
    const pq = t.secoes.find((x) => x.titulo === "Para que serve")?.paragrafos[0] ?? "";
    return `<li><a href="../../../tema/${escapar(t.tema)}/"><strong>${escapar(t.titulo)}</strong><span>${escapar(primeiraFrase(pq))}</span></a><span class="selo ${BADGE[s].classe}">${BADGE[s].texto}</span></li>`;
  })
  .join("\n")}
</ol>
</section>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mapa — ${escapar(norma.nome)}</title>
<style>${CSS_BASE}${CSS_BLOCO}</style>
</head>
<body>
<header class="topo"><div class="miolo"><a class="marca" href="../../../">Reforma Tributária Dissecada</a></div></header>
<main class="miolo bloco-pagina">
<section>
<h1>Mapa da ${escapar(norma.nome)}</h1>
<p class="nota">${livros.length} livros, ${nTitulos} títulos, ${nCapitulos} capítulos e ${norma.artigos.length} artigos. Comece pela pergunta de cada bloco; o texto dos artigos fica um nível abaixo. <a href="../">Índice completo</a>.</p>
</section>
${percurso}
${secoesLivros}
</main>
<footer><div class="miolo">
<p><strong>Não substitui o texto oficial.</strong> Texto legal do <a href="https://normas.leg.br">normas.leg.br</a>, licença <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Atribuição 4.0</a>. Capturado em ${dataBr(capturadoEm)}.</p>
<p>Visões gerais geradas por inteligência artificial; cada uma mostra se foi conferida. Conteúdo próprio sob licença Creative Commons Atribuição.</p>
</div></footer>
</body>
</html>
`;
}

export { impressaoDoBloco };

const CSS_BLOCO = `
.bloco-pagina{padding-top:24px;padding-bottom:40px;display:flex;flex-direction:column;gap:20px}
.titulo-bloco{margin:6px 0 0;font-family:var(--serifa);font-size:18px;color:var(--suave)}
.pergunta{font-size:18px!important}
.sub{margin:18px 0 0;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#4A2F86}
.excecoes{margin:6px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:4px}
.explicacao-curta{margin:10px 0 0;font-size:16px;line-height:1.6;max-width:820px}
.grade-blocos{margin-top:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.cartao-bloco{display:flex;flex-direction:column;gap:5px;padding:14px;border:1px solid #D5D1C6;background:var(--cartao);border-radius:10px;text-decoration:none;color:var(--tinta)}
.cartao-bloco .rot{font-size:12px;font-weight:600;letter-spacing:.04em;color:var(--suave)}
.cartao-bloco .tit{font-size:15px;font-weight:600;line-height:1.3}
.cartao-bloco .perg{font-size:14px;font-weight:600;color:#4A2F86;line-height:1.35}
.cartao-bloco .frase{font-size:14px;line-height:1.45;color:#3D3A34}
.cartao-bloco .qtd{margin-top:2px;font-size:12px;color:var(--suave)}
.chaves .art{font-size:14px}
.percurso{margin:12px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:10px}
.percurso li a{display:flex;flex-direction:column;gap:2px;text-decoration:none;color:var(--tinta)}
.percurso li span:not(.selo){font-size:14px;color:#3D3A34}
.percurso li .selo{display:inline-block;margin-top:4px;font-size:12px}
`;
