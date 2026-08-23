# Fase 213 - Paleta de comandos e atalhos de teclado

Status: concluida em 2026-08-08.

## Problema

O console ganhou modulos e profundidade, mas a navegacao ainda dependia do menu
lateral e de percorrer telas para iniciar tarefas frequentes. O usuario que
trabalha o dia inteiro no produto nao tinha busca global nem um caminho rapido
e consistente pelo teclado.

## Entregue

### Paleta global

O `ConsoleShell` agora oferece uma busca global em todas as telas operacionais.
Ela abre pelo botao de busca ou por `Ctrl+K` no Windows/Linux e `Cmd+K` no macOS.

O catalogo inclui os modulos principais e as acoes de novo agendamento e novo
paciente. A lista e calculada a partir do papel e das permissoes da sessao antes
de renderizar: possuir acesso ao modulo nao implica receber a acao de escrita.
Dashboard permanece exclusivo de SuperAdmin e Professional; Operacoes, de
SuperAdmin. A mesma correcao foi aplicada ao menu lateral.

### Busca server-side de pacientes

Com pelo menos tres caracteres, sessoes com `pacientes.listar` e
`pacientes.ler` consultam a busca paginada da Fase 199 e mostram ate oito
pacientes da carteira autorizada. A paleta nao cria um endpoint paralelo nem
descriptografa uma lista completa no navegador.

A pesquisa textual ignora caixa e acentos, mas compara inicio de palavras para
evitar falsos positivos como buscar "Ana" e selecionar "canais". Erro e
carregamento de pacientes possuem estados visiveis e anuncio por `aria-live`.

### Teclado e acessibilidade

- Setas percorrem os resultados e `Enter` executa a opcao ativa.
- `Escape` fecha o dialogo e o modal devolve foco ao gatilho quando aberto por
  clique.
- Sequencias globais `G` + tecla navegam (`D`, `A`, `P`, `F`, `C`, `U`, `E`,
  `O`) e `N A`/`N P` iniciam agendamento ou cadastro.
- Sequencias sao ignoradas em input, select, textarea e conteudo editavel; so
  comandos autorizados podem ser resolvidos.
- A paleta usa dialogo modal, combobox/listbox, opcao ativa anunciada, foco
  visivel e alvos de toque compativeis com desktop e celular.

Os hashes `#novo-agendamento` e `#novo-paciente` passaram a reagir a
`hashchange`, entao a acao funciona mesmo quando o usuario ja esta na tela de
destino. O cadastro de paciente ainda confere `pacientes.gerenciar` antes de
abrir.

## Testes e validacoes

- `paleta-comandos.spec.ts`: cinco contratos para papel, permissao, pesquisa,
  atalhos completos e unicidade das sequencias.
- `test:authz`: 35 testes aprovados, incluindo os novos contratos.
- `paleta-comandos.spec.mjs`: 6 cenarios Playwright aprovados em desktop e
  mobile, cobrindo teclado, busca server-side, foco, `Escape`, autorizacao e
  overflow.
- `test:base-visual`, `test:next15` (69 arquivos), `typecheck`, `lint` e build
  (116 paginas) aprovados.

Nao houve alteracao de backend nem migration nesta fase.

## Limites conhecidos

- A busca de entidades cobre pacientes, que e a jornada frequente com suporte
  server-side e escopo clinico consolidado. Profissionais e formularios podem
  ser adicionados depois se houver evidencia de uso, sem mudar o contrato da
  paleta.
- Os atalhos de sequencia nao sao capturados enquanto o usuario digita e
  expiram em 900 ms. Isso prioriza nao interferir com formularios.
- A paleta navega e abre fluxos existentes; nao executa mutacoes silenciosas.
