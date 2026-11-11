/*
 * Página de tema (docs/design.md, "Páginas"): reúne os artigos de um assunto. O texto é interpretação
 * gerada por inteligência artificial e fica em conteudo/temas/<tema>.md, separado do texto legal. Nasce
 * `conferida: false`; a impressão digital cobre o texto legal de TODOS os artigos que o tema cita, e
 * qualquer mudança em um deles faz o tema voltar a "desatualizado".
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { redacaoAtual, type Dispositivo } from "../captura/ler.ts";
import type { Base } from "./carregar.ts";
import { REPOSITORIO, SITE } from "./config.ts";
import { descreverDispositivo, CSS_BASE } from "./ficha.ts";
import { impressaoDigital, situacao as situacaoFicha, type Explicacao, type Situacao } from "./explicacao.ts";
import type { Norma } from "./norma.ts";
import { escapar } from "./remissao.ts";
import { dataBr } from "./util.ts";

export interface RefDispositivo {
  norma: string;
  /** Endereço da ficha ("art-4"). */
  ficha: string;
  /** id do dispositivo dentro do artigo, quando a referência é a um trecho. */
  ancora: string | null;
}

export interface CartaoMapa {
  ref: RefDispositivo;
  papel: string;
  frase: string;
}

export interface LinhaAntesDepois {
  aspecto: string;
  depois: string;
  refs: RefDispositivo[];
  /** Resumo do regime anterior; null enquanto o texto antigo não estiver carregado. */
  antes: string | null;
}

export interface Tema {
  tema: string;
  titulo: string;
  lote: number;
  profundidade: string;
  conferida: boolean;
  conferidaEm: string | null;
  geradaEm: string;
  impressaoDigital: string;
  artigos: RefDispositivo[];
  mapa: CartaoMapa[];
  secoes: { titulo: string; paragrafos: string[] }[];
  antesDepois: LinhaAntesDepois[];
  transicao: string[];
}

export const TITULOS_TEXTO = ["O que é", "Para que serve", "Como funciona"] as const;

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function lerRef(s: string): RefDispositivo {
  const m = /^([a-z0-9-]+)\/([a-z0-9-]+)(?:#(\S+))?$/.exec(s.trim());
  if (!m) throw new Error(`referência inválida: "${s}" (esperado norma/artigo ou norma/artigo#dispositivo)`);
  return { norma: m[1]!, ficha: m[2]!, ancora: m[3] ?? null };
}

const paragrafos = (texto: string): string[] => texto.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);

function itens(texto: string): string[][] {
  return texto
    .split("\n")
    .filter((l) => l.trim().startsWith("- "))
    .map((l) => l.trim().slice(2).split("|").map((c) => c.trim()));
}

export function lerTema(markdown: string): Tema {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(markdown);
  if (!m) throw new Error("falta o cabeçalho entre ---");
  const campos = new Map<string, string>();
  for (const linha of m[1]!.split("\n")) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(linha);
    if (!kv) throw new Error(`linha do cabeçalho inválida: "${linha}"`);
    campos.set(kv[1]!, kv[2]!.trim());
  }
  const obter = (k: string): string => {
    const v = campos.get(k);
    if (v === undefined || v === "") throw new Error(`falta o campo ${k}`);
    return v;
  };
  const conferida = obter("conferida");
  if (conferida !== "true" && conferida !== "false") throw new Error("conferida deve ser true ou false");
  const conferidaEm = campos.get("conferida_em") || null;
  if (conferida === "true" && !conferidaEm) throw new Error("conferida: true exige conferida_em");
  if (conferidaEm && !RE_DATA.test(conferidaEm)) throw new Error("conferida_em deve ser AAAA-MM-DD");
  if (!RE_DATA.test(obter("gerada_em"))) throw new Error("gerada_em deve ser AAAA-MM-DD");
  if (!/^[0-9a-f]{64}$/.test(obter("impressao_digital"))) throw new Error("impressao_digital deve ter 64 dígitos hexadecimais");
  const lote = Number(obter("lote"));
  if (!Number.isInteger(lote) || lote < 1 || lote > 4) throw new Error("lote deve ser de 1 a 4");

  const blocos = new Map<string, string>();
  for (const b of m[2]!.split(/^## /m).slice(1)) {
    const [titulo, ...resto] = b.split("\n");
    blocos.set(titulo!.trim(), resto.join("\n"));
  }
  const exigir = (t: string): string => {
    const b = blocos.get(t);
    if (b === undefined || !b.trim()) throw new Error(`falta a seção "${t}"`);
    return b;
  };
  const mapa = itens(exigir("Regra geral e exceções")).map((c) => {
    if (c.length !== 3 || !c[1] || !c[2]) throw new Error(`linha do mapa deve ser "- norma/artigo | PAPEL | frase": "${c.join(" | ")}"`);
    return { ref: lerRef(c[0]!), papel: c[1], frase: c[2] };
  });
  const antesDepois = itens(exigir("Antes e depois")).map((c) => {
    if (c.length < 3 || c.length > 4 || !c[0] || !c[1]) throw new Error(`linha de antes e depois deve ser "- aspecto | depois | refs [| antes]": "${c.join(" | ")}"`);
    return { aspecto: c[0], depois: c[1], refs: c[2]!.split(";").map((r) => lerRef(r)), antes: c[3] || null };
  });
  if (mapa.length === 0 || antesDepois.length === 0) throw new Error("mapa e antes e depois não podem ficar vazios");
  return {
    tema: obter("tema"),
    titulo: obter("titulo"),
    lote,
    profundidade: obter("profundidade"),
    conferida: conferida === "true",
    conferidaEm,
    geradaEm: obter("gerada_em"),
    impressaoDigital: obter("impressao_digital"),
    artigos: obter("artigos").split(",").map((a) => lerRef(a)),
    mapa,
    secoes: TITULOS_TEXTO.map((t) => ({ titulo: t, paragrafos: paragrafos(exigir(t)) })),
    antesDepois,
    transicao: paragrafos(exigir("Posição na transição")),
  };
}

function artigoDe(base: Base, ref: RefDispositivo): { norma: Norma; artigo: Dispositivo } {
  const norma = base.normas.find((n) => n.slug === ref.norma);
  const artigo = norma?.artigos.find((a) => norma.slugs.get(a.id) === ref.ficha);
  if (!norma || !artigo) throw new Error(`artigo ${ref.norma}/${ref.ficha} não existe`);
  if (ref.ancora && !norma.porId.has(ref.ancora)) throw new Error(`dispositivo ${ref.ancora} não existe em ${ref.norma}/${ref.ficha}`);
  return { norma, artigo };
}

/** Impressão digital do tema: a de cada artigo que ele cita, na ordem do cabeçalho. */
export function impressaoDoTema(base: Base, artigos: RefDispositivo[]): string {
  const linhas = artigos.map((r) => {
    const { norma, artigo } = artigoDe(base, r);
    return `${r.norma}\t${artigo.id}\t${impressaoDigital(norma, artigo)}`;
  });
  return createHash("sha256").update(linhas.join("\n")).digest("hex");
}

export function situacaoTema(t: Tema, impressaoAtual: string): Situacao {
  if (t.impressaoDigital !== impressaoAtual) return "desatualizada";
  return t.conferida ? "conferida" : "nao-conferida";
}

/** Lê conteudo/temas/*.md e valida contra a base: artigos citados, dispositivos e o nome do arquivo. */
export function carregarTemas(raiz: URL, base: Base): Tema[] {
  let arquivos: string[];
  try {
    arquivos = readdirSync(new URL("conteudo/temas/", raiz)).filter((a) => a.endsWith(".md")).sort();
  } catch {
    return [];
  }
  return arquivos.map((arq) => {
    const onde = `conteudo/temas/${arq}`;
    try {
      const t = lerTema(readFileSync(new URL(onde, raiz), "utf8"));
      if (arq !== `${t.tema}.md`) throw new Error(`o nome do arquivo deve ser ${t.tema}.md`);
      for (const r of [...t.artigos, ...t.mapa.map((c) => c.ref), ...t.antesDepois.flatMap((l) => l.refs)]) artigoDe(base, r);
      const citados = new Set(t.artigos.map((a) => `${a.norma}/${a.ficha}`));
      for (const c of t.mapa) if (!citados.has(`${c.ref.norma}/${c.ref.ficha}`)) throw new Error(`${c.ref.norma}/${c.ref.ficha} está no mapa mas não em "artigos"`);
      return t;
    } catch (erro) {
      throw new Error(`${onde}: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  });
}

const BADGE: Record<Situacao, { texto: string; classe: string }> = {
  "nao-conferida": { texto: "Não conferido", classe: "nao-conferida" },
  conferida: { texto: "Conferido", classe: "conferida" },
  desatualizada: { texto: "Texto legal mudou", classe: "desatualizada" },
};

export function rotuloDoRef(base: Base, ref: RefDispositivo): string {
  const { norma, artigo } = artigoDe(base, ref);
  const trecho = descreverDispositivo(norma, ref.ancora ? norma.porId.get(ref.ancora)! : artigo);
  return `${norma.slug === "lc-214-2025" ? "LC 214/2025" : norma.nome}, ${trecho}`;
}

const hrefDoRef = (ref: RefDispositivo): string => `../../lei/${ref.norma}/${ref.ficha}/${ref.ancora ? `#${ref.ancora}` : ""}`;

/** "Art. 4º" na Lei Complementar 214/2025; nas outras normas, com o nome da norma antes. */
function rotuloDoArtigo(base: Base, ref: RefDispositivo): string {
  const { norma, artigo } = artigoDe(base, ref);
  const rot = (redacaoAtual(artigo)?.rotulo ?? "").replace(/\.$/, "");
  return norma.slug === "lc-214-2025" ? rot : `${norma.nome}, ${rot}`;
}

function linkProblema(t: Tema, impressaoAtual: string): string {
  const corpo = ["Tipo do problema (erro de conteúdo, explicação confusa, remissão errada, texto desatualizado):", "", "Descreva o problema:", "", "---", `Tema: ${SITE}tema/${t.tema}/`, `Impressão digital do tema: ${t.impressaoDigital}`, `Impressão digital dos artigos hoje: ${impressaoAtual}`].join("\n");
  return `https://github.com/${REPOSITORIO}/issues/new?title=${encodeURIComponent(`Problema no tema: ${t.titulo}`)}&body=${encodeURIComponent(corpo)}`;
}

export interface Disponibilidade {
  base: Base;
  explicacoes: Map<string, Explicacao>;
  capturadoEm: string;
}

export function gerarTema(t: Tema, d: Disponibilidade): string {
  const { base } = d;
  const atual = impressaoDoTema(base, t.artigos);
  const s = situacaoTema(t, atual);
  const aviso = {
    "nao-conferida": `<strong>Ainda não conferido.</strong> As explicações deste tema foram geradas por inteligência artificial e ainda não passaram pela revisão. O texto legal das fichas vem da fonte oficial e não muda com isso.`,
    conferida: `<strong>Conferido em ${dataBr(t.conferidaEm ?? "")}.</strong>`,
    desatualizada: `<strong>O texto legal de algum artigo deste tema mudou desde que a explicação foi gerada.</strong> Ela volta a não conferida e pode estar desatualizada: leia os artigos.`,
  }[s];
  const ia = `<span class="origem-ia">Gerado por inteligência artificial — não é texto de lei</span>`;

  const cartoes = t.mapa
    .map((c, i) => {
      const rotulo = c.ref.ancora ? rotuloDoRef(base, c.ref) : rotuloDoArtigo(base, c.ref);
      return `<a class="cartao${i === 0 ? " destaque" : ""}" href="${escapar(hrefDoRef(c.ref))}"><span class="papel">${escapar(c.papel)}</span><span class="art">${escapar(rotulo)}</span><span class="frase">${escapar(c.frase)}</span></a>`;
    })
    .join("\n");

  const texto = t.secoes.map((sec) => sec.paragrafos.map((p, j) => `<p>${j === 0 ? `<strong>${escapar(sec.titulo)}.</strong> ` : ""}${escapar(p)}</p>`).join("")).join("\n");

  const linhas = t.antesDepois
    .map((l) => {
      const refs = l.refs.map((r) => `<a href="${escapar(hrefDoRef(r))}">${escapar(rotuloDoRef(base, r))}</a>`).join(" · ");
      const antes = l.antes ? escapar(l.antes) : `<span class="lacuna">Regime anterior ainda não carregado.</span>`;
      return `<tr><th scope="row">${escapar(l.aspecto)}</th><td>${antes}</td><td>${escapar(l.depois)}<div class="refs">${refs}</div></td></tr>`;
    })
    .join("\n");

  const lista = t.artigos
    .map((r) => {
      const { norma, artigo } = artigoDe(base, r);
      const e = d.explicacoes.get(`${norma.slug}|${artigo.id}`);
      const b = e ? BADGE[situacaoFicha(e, impressaoDigital(norma, artigo))] : null;
      return `<li><a href="${escapar(hrefDoRef({ ...r, ancora: null }))}"><span><strong>${escapar(rotuloDoArtigo(base, r))}</strong></span>${b ? `<span class="selo ${b.classe}">${b.texto}</span>` : `<span class="selo efeitos">Sem explicação</span>`}</a></li>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(t.titulo)} — tema</title>
<style>${CSS_BASE}${CSS_TEMA}</style>
</head>
<body>
<header class="topo"><div class="miolo"><a class="marca" href="../../">Reforma Tributária Dissecada</a></div></header>
<main class="miolo tema-pagina">
<div>
<nav aria-label="Trilha" class="trilha"><a href="../../#temas">Temas</a><span aria-hidden="true">›</span><span>Lote ${t.lote}</span></nav>
<h1>${escapar(t.titulo)}</h1>
<div class="pilulas"><span class="pilula">Profundidade ${escapar(t.profundidade)}</span><span class="selo ${BADGE[s].classe}">${s === "conferida" ? "Explicações conferidas" : s === "desatualizada" ? "Texto legal mudou" : "Explicações não conferidas"}</span></div>
</div>
<div role="note" class="aviso ${BADGE[s].classe}">${aviso}</div>

<section aria-labelledby="mapa" class="ia">
<div class="cabeca"><h2 id="mapa" class="rotulo rotulo-ia">Regra geral e exceções</h2>${ia}</div>
<p class="nota">Cada caixa abre a ficha do artigo. As frases resumem o que o texto do artigo diz.</p>
<div class="mapa">
${cartoes}
</div>
</section>

<section aria-labelledby="oque" class="ia">
<div class="cabeca"><h2 id="oque" class="rotulo rotulo-ia">O que é, para que serve, como funciona</h2>${ia}</div>
<div class="explicacao">
${texto}
</div>
</section>

<section aria-labelledby="antes" class="ia">
<div class="cabeca"><h2 id="antes" class="rotulo rotulo-ia">Antes e depois</h2>${ia}</div>
<div class="tabela"><table>
<thead><tr><th scope="col">Aspecto</th><th scope="col">Antes</th><th scope="col">Depois</th></tr></thead>
<tbody>
${linhas}
</tbody>
</table></div>
<p class="nota">O lado "antes" fica como lacuna enquanto o texto da legislação anterior (Lei Complementar 87/1996 e Lei Complementar 116/2003, entre outras) não estiver carregado: <a href="https://normas.leg.br/?urn=urn:lex:br:federal:lei.complementar:1996;87">Lei Complementar 87/1996 ↗</a> · <a href="https://normas.leg.br/?urn=urn:lex:br:federal:lei.complementar:2003;116">Lei Complementar 116/2003 ↗</a>.</p>
</section>

<section aria-labelledby="transicao" class="ia">
<div class="cabeca"><h2 id="transicao" class="rotulo rotulo-ia">Posição na transição</h2>${ia}</div>
<div class="explicacao">
${t.transicao.map((p) => `<p>${escapar(p)}</p>`).join("")}
</div>
<div class="rodape-ia"><span>Gerado em ${dataBr(t.geradaEm)}</span><a class="botao" href="${escapar(linkProblema(t, atual))}">Reportar problema</a></div>
</section>

<section aria-labelledby="artigos">
<h2 id="artigos" class="rotulo">Artigos deste tema</h2>
<ul class="lista-artigos">
${lista}
</ul>
</section>
</main>
<footer><div class="miolo">
<p><strong>Não substitui o texto oficial.</strong> Texto legal do <a href="https://normas.leg.br">normas.leg.br</a>, licença <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Atribuição 4.0</a>.</p>
<p>Explicações geradas por inteligência artificial; cada uma mostra se foi conferida e quando. Conteúdo próprio sob licença Creative Commons Atribuição.</p>
</div></footer>
</body>
</html>
`;
}

const CSS_TEMA = `
.tema-pagina{padding-top:24px;padding-bottom:40px;display:flex;flex-direction:column;gap:20px}
.pilulas{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;font-size:12px;font-weight:500}
.pilula{padding:3px 8px;border-radius:999px;background:#E6EEF8;color:#163A69}
.aviso{margin-top:0}
.mapa{margin-top:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.cartao{display:flex;flex-direction:column;gap:6px;padding:14px;border:1px solid #D5D1C6;background:var(--cartao);border-radius:10px;text-decoration:none;color:var(--tinta)}
.cartao.destaque{border:2px solid #1F4E8C;background:#F3F6FB}
.cartao .papel{font-size:12px;font-weight:600;letter-spacing:.04em;color:var(--suave)}
.cartao.destaque .papel{color:#163A69}
.cartao .art{font-size:16px;font-weight:600}
.cartao .frase{font-size:14px;line-height:1.45;color:#3D3A34}
.tabela{margin-top:14px;overflow-x:auto}
.tabela table{width:100%;min-width:640px;border-collapse:collapse;font-size:15px;line-height:1.5}
.tabela th,.tabela td{padding:12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--borda)}
.tabela thead th{border-bottom:2px solid var(--tinta)}
.tabela tbody th{width:20%;font-weight:600;padding-left:0}
.lacuna{color:var(--suave);font-style:italic}
.refs{margin-top:6px;font-size:13px}
.lista-artigos{margin:12px 0 0;padding:0;list-style:none;display:flex;flex-direction:column}
.lista-artigos li{border-bottom:1px solid #EEECE6}
.lista-artigos a{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center;min-height:52px;text-decoration:none;color:var(--tinta)}
`;
