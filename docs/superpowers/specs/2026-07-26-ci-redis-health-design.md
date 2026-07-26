# Design - regressao de CI e confiabilidade Redis

## Objetivo

Restaurar o CI de smoke sem reduzir a cobertura de navegacao autenticada,
garantir que o limite de abuso seja consistente sob requisicoes simultaneas e
fazer o healthcheck diagnosticar conectividade real com Redis.

## Escopo

1. O smoke HTTP continuara validando protecao de rota, login, textos
   essenciais da pagina e ausencia de referencias proibidas. Ele nao inferira
   UI hidratada a partir do HTML inicial.
2. A navegacao autorizada continuara coberta pelo Playwright existente, que
   espera a hidratacao e confere links visiveis por permissao.
3. O rate limit usara uma operacao Redis atomica para incrementar a janela e
   aplicar bloqueio; nao havera leitura-modificacao-gravacao concorrente.
4. O healthcheck executara `PING` com timeout pequeno por uma dependencia
   injetada. Redis ausente sera degradado; Redis configurado mas indisponivel
   sera falha.

## Fora de escopo

- Arquivos de Google Agenda e commits locais da Fase 136.
- Alteracao de regras de negocio de login, recuperacao de senha ou convites.
- Deploy, secrets, Render, Upstash ou GitHub push.

## Validacao

- Smoke UI local com backend/web de demo passa sem exigir menu no HTML bruto.
- Playwright continua sendo a prova da navegacao depois da hidratacao.
- Teste de concorrencia demonstra que varias falhas paralelas respeitam o
  limite Redis.
- Healthcheck retorna `ok` somente quando `PING` responde `PONG` e retorna
  `falha` quando Redis configurado rejeita a conexao.
