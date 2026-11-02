# Reforma Tributária Dissecada

Site estático e aberto para estudar a reforma tributária do consumo (Lei Complementar 214/2025, Emenda Constitucional 132/2023, alterações da Lei Complementar 227/2026), dispositivo por dispositivo. O design acordado está em `docs/design.md`: leia antes de propor qualquer mudança de escopo.

## Regras que não se negociam

1. **Texto legal só da fonte, sem edição.** Nunca escreva, resuma dentro do bloco de texto oficial, corrija ou "complete" texto de lei. Ele vem de `dados/fonte/` e é exibido como veio. Num mockup feito de memória em 31/10/2026, o § 1º do art. 4º saiu com uma remissão ao art. 5º que não existe no texto real: é por isso que esta regra existe.
2. **Interpretação aparece como interpretação.** Todo texto gerado por inteligência artificial (para que serve, antes e depois, notas de gatilho, resumo de tema) fica em bloco separado, rotulado "não é texto de lei", e nasce com `conferida: false`. Só o Fabrício marca `conferida: true`.
3. **Remissões determinísticas.** Remissão vaga ("nos termos do regulamento", "nesta Lei Complementar" sem artigo) aparece como "não resolvida". Nunca adivinhe o alvo.
4. **Lacunas honestas.** O que não se sabe (data de efeitos ainda não montada, anexo não carregado) aparece como lacuna ou marcador entre colchetes, nunca como valor plausível.
5. **Impressão digital.** Cada explicação guarda o hash do texto legal que explicou; se a redação mudar, a ficha volta a não conferida.

## A fonte: normas.leg.br

- `GET https://normas.leg.br/api/public/normas?urn=<URN>&tipo_documento=maior-detalhe`, sem chave, licença Creative Commons Atribuição 4.0. A lista de normas fica em `captura/fontes.ts`.
- JSON-LD (schema.org `Legislation`). Cada nó de dispositivo tem `legislationIdentifier`, `legislationType` (tipo estrutural em `@id`, terminado em `tipo.dispositivo:<tipo>`), `hasPart` (filhos) e `workExample` (uma ou várias versões).
- Cada versão traz `legislationType` (`Original_Version`, `Text_Change_Version`, `Insertion_Version`, `Repeal_Version`, `Court_Decision_Version`, vetos, renumeração; às vezes dois separados por vírgula), `legislationDate` (data da ALTERAÇÃO, não de efeitos), `name` (rótulo), `text`, `legislationConsolidates` (dispositivo que causou a mudança), `legislationLegalForce`, `temporalCoverage` e `publisherNote`.
- Dispositivos inseridos têm sufixo no identificador (`art4_par6,lcp-227-2026-01-13`); `captura/ler.ts` normaliza para `art4_par6`.
- Hierarquia: `componente.autonomo.articulado` › `articulacao` › livro › título › capítulo › seção › artigo › caput/parágrafo › inciso › alínea › item. Alterações de outras leis vêm dentro de `bloco.de.alteracao`.
- As remissões para outras normas já vêm marcadas no texto: `<span xlink:href="urn:lex:...!art155_cpt_inc1">`. O texto também traz `<i>` (por exemplo, em "caput").
- Armadilhas da fonte: o texto também traz `<b>` e entidades (`&quot;`); versão `Vetoed_*` não é texto em vigor (a fonte ainda marca a anterior como fora de vigor, então a ficha mostra as duas e a nota); a Constituição repete identificadores (dispositivo reposicionado ou renumerado), e `ler.ts` deixa o sufixo nos repetidos; `art156-1` é o art. 156-A; artigos dentro de `bloco.de.alteracao` são texto de outra norma e não ganham página.
- Lacunas conhecidas: os anexos não vêm estruturados; a data de produção de efeitos não vem por dispositivo (sai do art. 544).
- O ambiente de nuvem do Claude não alcança o normas.leg.br. A captura roda no computador do Fabrício (`npm run captura`) ou nas automações do GitHub (`.github/workflows/captura.yml`, semanal e sob demanda).

## Código

- TypeScript sem framework e sem dependências, executado direto pelo Node.js 22.18 ou mais recente (remoção de tipos nativa): use imports com extensão `.ts` e evite `enum`, `namespace` e propriedades de parâmetro.
- Testes com `node --test` contra a captura real (`npm test`). Um teste que quebra depois de nova captura é aviso de que a lei mudou: investigue, não ajuste o teste às cegas.
- `gerador/citacao.ts` veio da extensão Mentor Web e ainda não é usado. As remissões sem marcação da fonte são resolvidas por `gerador/referencias.ts`, só quando o próprio texto ancora o alvo ("art. 44 desta Lei Complementar", "§ 3º deste artigo"); sem âncora, fica "não resolvida". Nunca amplie essa gramática sem teste contra a captura real.
- `npm run site` gera o site inteiro (as três normas, índices e a página inicial) em `site/`, que não vai para o git; a publicação roda na `main`. `gerador/ficha.test.ts` confere que o texto de todo dispositivo sai intacto em todas as fichas.

## Explicações ("Para que serve")

- Ficam em `conteudo/fichas/<norma>/<endereço da ficha>.md` (por exemplo `lc-214-2025/art-4.md`), com o cabeçalho `norma`, `artigo` (id na base), `conferida`, `conferida_em`, `gerada_em`, `impressao_digital` e as três seções `O que é`, `Para que serve` e `Como funciona`. `gerador/explicacao.ts` define e valida o formato.
- Para escrever uma: leia o texto da captura (cada afirmação precisa estar nele), escreva o arquivo com `impressao_digital: carimbar` e rode `npm run carimbar`, que grava a impressão digital do texto legal explicado. Nunca troque uma impressão que já existe.
- Nasce `conferida: false`. Só o Fabrício muda para `true` (com `conferida_em`). Se o texto legal mudar, a ficha mostra o alerta de desatualizada.
- Escreva sem sigla que o texto da lei não tenha explicado, cite dispositivos ("§ 2º", "inciso IV") e diga quando a fonte registra veto ou revogação. Não afirme o que o artigo não diz.
- Lotes feitos: LC 214/2025, arts. 1º a 26 (inclui o art. 7º-A).

## Referências fora do repositório

- Documento de design no Claude (origem do `docs/design.md`): https://claude.ai/artifact/488bo3YjWGb2LaqcUaKnxm
- Mockups do site (página inicial, tema "Fato gerador", ficha do art. 4º com o texto real): https://claude.ai/artifact/FmRcgqUg1yX288cj39DG6U

## Com o Fabrício

- Escreva em português do Brasil e não use siglas ou abreviações sem a descrição por extenso.
- Ele estuda 3 horas por dia, de segunda a sábado, para Auditor Fiscal da Secretaria da Fazenda da Bahia (Tecnologia da Informação, banca Cesgranrio). Construir o site não pode tirar tempo desse estudo; prefira entregas pequenas.
- Próximos passos em aberto: conferir 20 dispositivos à mão contra o Planalto; estrutura dos anexos; tabela de efeitos do art. 544; "Para que serve" do art. 27 em diante; páginas de tema; palavras-gatilho.
