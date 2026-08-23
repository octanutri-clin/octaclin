# Fase 249 - Densidade e responsividade do console clinico

## Objetivo

Transformar agenda, lista de pacientes e prontuario em uma bancada clinica
mais organizada: maior densidade util no desktop, acoes previsiveis no celular
e componentes compartilhados sem criar uma segunda linguagem visual.

## Direcao de design

**Bancada clinica organizada**: interface calma, operacional e acolhedora, com
hierarquia curta, superficies contidas, controles de 44 px e informacao
clinica priorizada antes de decoracao.

| Superficie | Antes | Depois |
| --- | --- | --- |
| Shell | Sidebar de 248 px e espacamento amplo em todas as larguras | Sidebar de 232 px, conteudo mais util e espacamento responsivo |
| Cartoes | 20 px de padding tambem no celular | 16 px no celular e 20 px a partir de `sm` |
| Acoes rapidas | Quebra livre e, no prontuario mobile, comandos empilhados | `FaixaAcoes` unica, 44 px, rolagem lateral e quebra controlada |
| Abas | Podiam quebrar em mais de uma linha | Faixa horizontal com teclado e rolagem no celular |
| Agenda | Semana era a referencia inicial em qualquer largura | Semana no desktop e dia no celular, sem perder os demais modos |
| Pacientes | Metadados mais altos e controles locais | Tabela compacta, metadados em uma linha e controles compartilhados |
| Prontuario | Acoes ocupavam varias linhas no celular | Cabecalho, acoes e abas mantidos em faixas previsiveis |

## Escopo concluido

1. Criado `FaixaAcoes`, primitivo compartilhado com rotulo acessivel,
   rolagem horizontal no celular e quebra opcional em telas maiores.
2. Abas compartilhadas ganharam orientacao ARIA explicita, dimensao estavel e
   navegacao horizontal sem quebra no celular.
3. Shell e cartoes passaram a usar densidade responsiva, preservando foco,
   hierarquia e o sistema visual atual.
4. Agenda semanal seleciona dia em viewport estreito e semana no desktop;
   controles de modo comunicam o estado com `aria-pressed`.
   A referencia inicial preserva a data exata da consulta mais proxima, evitando
   que a visao diaria abra incorretamente na segunda-feira da mesma semana.
5. Lista de pacientes reutiliza campos, selecoes, rotulos, botoes e faixa de
   acoes; a tabela desktop ficou compacta sem reduzir os atalhos criticos.
6. Prontuario mantem as acoes rapidas e as abas em uma unica faixa rolavel no
   celular, evitando uma pilha de comandos antes do conteudo clinico.
7. O novo gate Playwright mede overflow, altura, densidade, alvos de toque e
   teclado em agenda, pacientes e prontuario com dados sinteticos.

## Penpot

- Arquivo conectado: `Novo Ficheiro 1`.
- Pagina: `09 — Fase 249: Densidade e responsividade`.
- Quadros: decisoes e criterios, agenda desktop, pacientes desktop e
  prontuario mobile.
- Validacao interna do arquivo: zero erros.
- Nenhum dado real de paciente, profissional ou clinica foi utilizado.

## Validacao

- `pnpm --dir octaclin-web lint`: aprovado, zero erros e 53 avisos
  pre-existentes;
- `pnpm --dir octaclin-web typecheck`: aprovado;
- `pnpm --dir octaclin-web test:fase249`: 3/3 cenarios desktop aprovados;
- Playwright mobile da Fase 249: 3/3 cenarios aprovados;
- regressao direcionada de agenda, pacientes e prontuario: 10/10 cenarios
  aprovados em desktop/mobile; o caso de agenda foi atualizado para validar
  dia no celular e semana no desktop;
- Chrome DevTools: sem overflow do documento, faixas de acao de 48/58 px,
  abas de 44 px e controles criticos de 44 px;
- Lighthouse desktop e mobile: 100 em acessibilidade, boas praticas, SEO e
  agentic browsing, com 32 auditorias aprovadas e nenhuma falha;
- screenshots comparaveis gerados para agenda, pacientes e prontuario em
  1440 px e 390 px.

## Gate de regressao

O job `Demo local smoke` do `OctaClin CI` executa `pnpm test:fase249` depois
de disponibilizar Chromium e os servicos de demonstracao.

## Fora de escopo

- mudanca de regras clinicas, permissoes, tenancy, banco ou contratos backend;
- retomada ou distribuicao do app Expo;
- alteracao ampla dos avisos React pre-existentes;
- redesign dos demais modulos, que seguem nas Fases 251 a 259.

## Proxima fase

- **Fase 250 - Encerramento da divida Mobile e higiene de PRs.**
- Modelo: **GPT-5.6 Sol, raciocinio `medium`**.
- Skills: `ecc:github-ops`, `ecc:living-docs-governance`,
  `codex-security:track-findings`, `codex-security:validation` e
  `codex-engineering-guardrails:code-verification`.
- Ferramentas: GitHub via `gh`; Context7 somente se surgir incompatibilidade
  de dependencia que exija documentacao atual.
