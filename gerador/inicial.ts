/*
 * Página inicial (docs/design.md, "Páginas"). Puro. Só mostra o que existe: os 13 temas do design,
 * todos "em preparação" até ganharem página, e as fichas já geradas. Busca, linha do tempo resumida e
 * "o que mudou" entram quando existirem.
 */
import { escapar } from "./remissao.ts";
import { CSS_BASE, dataBr } from "./ficha.ts";

export interface FichaPronta {
  href: string;
  titulo: string;
}

interface Tema {
  nome: string;
  nota?: string;
}

const LOTES: { lote: number; temas: Tema[] }[] = [
  {
    lote: 1,
    temas: [
      { nome: "Fato gerador" },
      { nome: "Não incidência e imunidades" },
      { nome: "Sujeito passivo e responsabilidade" },
      { nome: "Local da operação (destino)" },
      { nome: "Base de cálculo" },
    ],
  },
  {
    lote: 2,
    temas: [{ nome: "Alíquotas e alíquota de referência" }, { nome: "Não cumulatividade e créditos" }, { nome: "Recolhimento e divisão do pagamento" }],
  },
  {
    lote: 3,
    temas: [{ nome: "Regimes diferenciados" }, { nome: "Regimes específicos", nota: "panorama" }, { nome: "Imposto Seletivo" }],
  },
  { lote: 4, temas: [{ nome: "Transição de 2026 a 2033" }, { nome: "Comitê Gestor e fiscalização" }] },
];

export function gerarInicial(fichas: FichaPronta[], capturadoEm: string, baseAtualizadaEm: string | null): string {
  const lotes = LOTES.map(
    (l) => `<h3 class="rotulo">Lote ${l.lote}</h3>
<div class="grade">
${l.temas.map((t) => `<div class="tema"><span class="nome">${escapar(t.nome)}</span><span class="nota">Em preparação${t.nota ? ` · ${escapar(t.nota)}` : ""}</span></div>`).join("\n")}
</div>`,
  ).join("\n");
  const lista = fichas.map((f) => `<li><a href="${escapar(f.href)}">${escapar(f.titulo)}</a></li>`).join("\n");
  const base = baseAtualizadaEm ? `<span>Base atualizada na fonte até ${dataBr(baseAtualizadaEm)}</span>` : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reforma Tributária Dissecada</title>
<style>${CSS_BASE}${CSS_INICIAL}</style>
</head>
<body>
<header class="topo"><div class="miolo"><a class="marca" href="./">Reforma Tributária Dissecada</a></div></header>
<div class="heroi"><div class="miolo">
<h1>A reforma tributária do consumo, dispositivo por dispositivo.</h1>
<p>Texto oficial da Lei Complementar 214/2025 e da Emenda Constitucional 132/2023, com as remissões abertas, o que mudou em relação ao regime antigo e o que vale em cada ano da transição.</p>
<div class="meta"><span>Texto capturado do normas.leg.br em ${dataBr(capturadoEm)}</span>${base}</div>
</div></div>
<main class="miolo miolo-inicial">
<section aria-labelledby="fichas">
<h2 id="fichas">Fichas disponíveis</h2>
<p class="nota">Cada ficha traz o dispositivo com o texto oficial intacto, as remissões e a linha do tempo.</p>
<ul class="fichas">
${lista}
</ul>
</section>
<section aria-labelledby="temas">
<h2 id="temas">Temas</h2>
<p class="nota">Treze temas, em quatro lotes, da regra geral às exceções.</p>
${lotes}
</section>
</main>
<footer><div class="miolo">
<p><strong>Não substitui o texto oficial.</strong> Texto legal do <a href="https://normas.leg.br">normas.leg.br</a>, licença <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Atribuição 4.0</a>.</p>
<p>Conteúdo próprio sob licença Creative Commons Atribuição. O site não coleta dados pessoais nem usa ferramenta de análise de acesso.</p>
</div></footer>
</body>
</html>
`;
}

const CSS_INICIAL = `
.heroi{background:var(--cartao);border-bottom:1px solid var(--borda)}
.heroi .miolo{padding-top:44px;padding-bottom:36px;display:flex;flex-direction:column;gap:16px}
.heroi h1{margin:0;max-width:820px;font-size:42px}
.heroi p{margin:0;max-width:720px;font-size:18px;line-height:1.55;color:#3D3A34}
.meta{display:flex;flex-wrap:wrap;gap:8px 20px;font-size:13px;color:var(--suave)}
.miolo-inicial{padding-top:32px;padding-bottom:40px;display:flex;flex-direction:column;gap:20px}
.miolo-inicial h2{margin:0;font-family:var(--serifa);font-size:26px;font-weight:600}
.miolo-inicial .nota{margin:6px 0 0;font-size:14px}
.fichas{margin:12px 0 0;padding:0 0 0 20px;display:flex;flex-direction:column;gap:4px;font-size:17px}
.fichas a{display:inline-flex;align-items:center;min-height:44px}
h3.rotulo{margin:22px 0 10px}
.grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.tema{display:flex;flex-direction:column;gap:6px;padding:16px;background:#FBFAF7;border:1px dashed #CFCABD;border-radius:12px}
.tema .nome{font-size:16px;font-weight:600;color:#3D3A34}
.tema .nota{margin:0;font-size:13px;color:var(--suave)}
@media (max-width:600px){.heroi h1{font-size:30px}}
`;
