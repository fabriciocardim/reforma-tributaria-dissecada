# Reforma Tributária Dissecada

Site estático para estudar a reforma tributária do consumo dispositivo por dispositivo (Lei Complementar 214/2025 e Emenda Constitucional 132/2023), para o estudo de Auditor Fiscal (Sefaz-BA). Design completo e decisões: `docs/design.md` — leia antes de qualquer mudança de arquitetura, escopo ou fluxo de conteúdo; este arquivo só traz o que vale em toda tarefa.

## Princípios invioláveis

Errar a letra da lei custa a questão da prova. Por isso:

1. **Texto oficial intacto.** O texto legal vem só de `dados/fonte/` (captura do normas.leg.br), sem nenhuma edição, nunca reescrito ou resumido no lugar do original.
2. **Interpretação separada e marcada.** Qualquer explicação gerada por IA fica visualmente distinta do texto de lei, nasce `conferida: false` e carrega a impressão digital do texto que explicou. Nunca mude o texto legal para "encaixar" numa explicação.
3. **Lacuna é lacuna.** Dado que falta aparece como "não carregada" ou "não resolvida" — nunca um valor plausível no lugar.
4. **Remissões não são chute.** O gerador resolve remissões absolutas e relativas e expande um nível; o resto é link. Nunca a IA adivinha o alvo de uma remissão vaga.

## Estrutura

```text
captura/   captura do normas.leg.br e leitura da base (TypeScript, com testes)
dados/     base capturada, sem alteração, e o manifesto com data e impressão digital
conteudo/  temas e fichas em Markdown — explicações; nunca o texto legal
gerador/   montagem das páginas e do índice de busca
docs/      design e decisões (docs/design.md é a referência)
```

`conteudo/`, `gerador/` e `site/` ainda não existem neste repositório — fazem parte do plano, não do estado atual.

## Comandos

```sh
npm run captura   # baixa as normas de novo e grava em dados/fonte/
npm test          # confere a leitura da base contra a captura
```

Node.js >= 22.18, sem dependências externas. `npm run captura` não funciona neste ambiente (o sandbox do Claude não alcança normas.leg.br); roda no computador do autor ou na automação do GitHub Actions.

## Convenções

- TypeScript sem framework; reaproveita o reconhecedor de citações da extensão Mentor Web (`normas/citacao.ts`), copiado para `gerador/`.
- Testes com `node --test`, nunca outro runner.
- Identificador de dispositivo segue o padrão LexML (`...;214!art4_par2_inc1`) — é também o endereço da ficha.
