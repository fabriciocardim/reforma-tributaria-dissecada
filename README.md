# Reforma Tributária Dissecada

Site aberto e estático para estudar a reforma tributária do consumo dispositivo por dispositivo: texto oficial da Lei Complementar 214/2025 e da Emenda Constitucional 132/2023, com as remissões abertas, o que mudou em relação ao regime antigo e o que vale em cada ano da transição.

O design completo está em [`docs/design.md`](docs/design.md).

## Regras da casa

- O texto legal vem só da fonte oficial ([normas.leg.br](https://normas.leg.br)), sem nenhuma edição.
- Toda explicação gerada por inteligência artificial fica separada do texto de lei e aparece como "não conferida" até ser revisada.
- O que não se sabe aparece como lacuna, nunca como um valor plausível.

## Estrutura

```text
captura/   captura do normas.leg.br e leitura da base (TypeScript, com testes)
dados/     base capturada, sem alteração, e o manifesto com data e impressão digital
conteudo/  temas e fichas em Markdown (explicações; nunca o texto legal)
gerador/   montagem das páginas e do índice de busca
docs/      design e decisões
```

## Como usar

Requer Node.js 22.18 ou mais recente; não há dependências para instalar.

```sh
npm run captura   # baixa as normas de novo e grava em dados/fonte/
npm test          # confere a leitura da base contra a captura
```

A captura também roda nas automações do GitHub toda segunda-feira e sob demanda (aba Actions, "Captura das normas"), e só grava quando alguma norma mudou.

## Licenças

Texto legal: normas.leg.br, licença [Creative Commons Atribuição 4.0](https://creativecommons.org/licenses/by/4.0/). Conteúdo próprio do site: Creative Commons Atribuição. Não substitui o texto oficial.
