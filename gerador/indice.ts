/*
 * Índice da lei (docs/design.md, "Páginas"): Livro › Título › Capítulo › Seção › artigo, com link
 * para cada ficha. Puro. Anexos entram quando houver estrutura carregada.
 */
import { redacaoAtual } from "../captura/ler.ts";
import { dataBr, CSS_BASE } from "./ficha.ts";
import { emBloco, TIPOS_ESTRUTURA, type Norma } from "./norma.ts";
import { escapar } from "./remissao.ts";
import { idUrl } from "./util.ts";
import type { Visao } from "./visao.ts";

const NIVEL_TITULO: Record<string, number> = { livro: 2, titulo: 3, capitulo: 4, secao: 5, subsecao: 6 };

export function gerarIndice(norma: Norma, capturadoEm: string, visao?: Visao): string {
  let corpo = "";
  let lista = false;
  const fechar = (): void => {
    if (lista) corpo += "</ul>\n";
    lista = false;
  };
  for (const d of norma.dispositivos) {
    if (emBloco(norma.porId, d)) continue;
    const v = redacaoAtual(d);
    if (TIPOS_ESTRUTURA.includes(d.tipo) && v) {
      fechar();
      const n = NIVEL_TITULO[d.tipo] ?? 6;
      const b = visao?.blocos.get(d.id);
      corpo += `<h${n} id="${escapar(d.id)}" class="est">${escapar(v.rotulo)} ${escapar(v.texto ?? "")}</h${n}>\n`;
      corpo += `<p class="resumo-bloco"><a href="bloco/${idUrl(d.id)}/">Visão geral deste bloco</a>${b ? ` — ${escapar(b.resumo)} <span class="origem-ia">gerado por inteligência artificial</span>` : ""}</p>\n`;
    } else if (d.tipo === "artigo" && norma.slugs.has(d.id)) {
      if (!lista) corpo += `<ul class="arts">`;
      lista = true;
      corpo += `<li><a href="${norma.slugs.get(d.id)}/">${escapar((v?.rotulo ?? d.id).replace(/\.$/, ""))}</a></li>`;
    }
  }
  fechar();
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Índice — ${escapar(norma.nome)}</title>
<style>${CSS_BASE}${CSS_INDICE}</style>
</head>
<body>
<header class="topo"><div class="miolo"><a class="marca" href="../../">Reforma Tributária Dissecada</a></div></header>
<main class="miolo miolo-indice">
<h1>${escapar(norma.nome)}</h1>
<p class="nota">${norma.artigos.length} artigos. Texto capturado do normas.leg.br em ${dataBr(capturadoEm)}. Anexos: ainda não carregados (a fonte não os traz estruturados).</p>
${corpo}
</main>
<footer><div class="miolo">
<p><strong>Não substitui o texto oficial.</strong> Texto legal do <a href="https://normas.leg.br">normas.leg.br</a>, licença <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Atribuição 4.0</a>.</p>
</div></footer>
</body>
</html>
`;
}

const CSS_INDICE = `
.miolo-indice{max-width:900px;padding-top:24px;padding-bottom:40px;display:block}
.miolo-indice h1{margin:0 0 8px}
.est{font-family:var(--serifa);font-weight:600;line-height:1.3;margin:22px 0 8px}
.resumo-bloco{margin:6px 0 10px;font-size:14px;color:#3D3A34;max-width:820px}
h2.est{font-size:22px;border-top:2px solid var(--borda);padding-top:16px}
h3.est{font-size:19px}h4.est{font-size:17px}h5.est,h6.est{font-size:15px;color:var(--suave)}
.arts{list-style:none;margin:0 0 8px;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.arts a{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;background:var(--cartao);border:1px solid var(--borda);border-radius:8px;text-decoration:none;font-size:14px}
`;
