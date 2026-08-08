# Fase 214 - Refatoracao dos monolitos

Status: concluida em 2026-08-08.

## Objetivo

Reduzir o custo de manutencao dos dois maiores componentes restantes do
frontend sem alterar comportamento, contrato de API, permissao, texto ou
fluxo de usuario. A fase ficou restrita ao portal do cliente e ao painel de
operacoes.

## Portal do cliente

`portal-cliente.tsx` passou de 1.797 para 111 linhas e ficou responsavel apenas
por compor a pagina. A implementacao foi separada em:

- `use-portal-cliente.ts`: estado, carregamentos, permissoes e handlers;
- `portal-cliente-dominio.ts`: tipos, formatacao e valores iniciais;
- `areas-visao-assinatura.tsx`: ativacao, visao geral, assinatura e consumo;
- `area-equipe-cliente.tsx`: usuarios, convites e historico;
- `areas-configuracao-cliente.tsx`: preferencias, marca, integracoes,
  documentos e financeiro;
- `area-perfil-cliente.tsx`: perfil empresarial e fiscal.

Os componentes existentes de modelos de documento e recebimentos foram
reutilizados sem alteracao.

## Painel de operacoes

`painel-operacoes.tsx` passou de 1.565 para 100 linhas e tambem ficou limitado
a composicao. A implementacao foi separada em:

- `use-painel-operacoes.ts`: estado, efeitos, requisicoes e mutacoes;
- `formatadores-operacoes.ts`: rotulos e formatacao visual;
- areas independentes para saude, incidentes, comunicacoes, LGPD, auditoria e
  filas.

As abas, identificadores usados pelos testes, APIs, regras de autorizacao e
mensagens visiveis foram preservados.

## Validacao

- baseline dos fluxos confiaveis de portal e operacoes: 14 de 14 cenarios
  Playwright aprovados em desktop e mobile;
- os mesmos 14 de 14 cenarios foram aprovados depois da extracao;
- `typecheck`, `lint`, `test:base-visual` e `test:authz` (35 testes) aprovados;
- `test:next15` aprovado em 69 arquivos;
- build de producao aprovado com 116 paginas;
- `git diff --check` aprovado.

O recorte LGPD/assinatura de `console-regression.spec.mjs` nao foi usado como
gate: ele ja falhava antes da refatoracao durante a descoberta de abas e depois
por indisponibilidade do servidor do harness. Nenhum sucesso foi atribuido a
esse teste instavel.

Nao houve alteracao de backend, banco, migration ou dependencia.

## Limites conhecidos

Os hooks resultantes continuam extensos porque concentram a orquestracao de
cada produto. Uma nova divisao so deve ocorrer quando houver uma fronteira de
comportamento comprovada; fragmentar chamadas e estado agora aumentaria o
acoplamento entre arquivos sem simplificar o fluxo.
