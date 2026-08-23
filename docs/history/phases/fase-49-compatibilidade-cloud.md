# Fase 49 - Compatibilidade cloud para staging

## Objetivo

Preparar a base do OctaClin para subir em provedores gratuitos ou de baixo custo sem depender de ajustes manuais no codigo no momento do deploy.

## Alteracoes aplicadas

- O backend aceita `PORT`, usado por provedores como Render, mantendo `PORTA_HTTP` como compatibilidade local.
- O CORS do backend usa `CORS_ORIGINS` quando informado e continua permissivo apenas quando a variavel nao esta configurada.
- A conexao Redis aceita `REDIS_URL`, usuario, senha e TLS, preservando `REDIS_HOST` e `REDIS_PORTA` para ambiente local.
- Os exemplos `octaclin-backend/.env.example` e `octaclin-web/.env.example` documentam as variaveis usadas pelo codigo atual.
- A lista de secrets da Fase 48 foi alinhada com os nomes reais de variaveis do projeto.

## Variaveis principais para staging

Backend:

- `PORT`
- `CORS_ORIGINS`
- `BANCO_HOST`
- `BANCO_PORTA`
- `BANCO_USUARIO`
- `BANCO_SENHA`
- `BANCO_NOME`
- `BANCO_SSL`
- `REDIS_URL`
- `REDIS_TLS`
- `JWT_SEGREDO`
- `JWT_REFRESH_SEGREDO`
- `CRIPTOGRAFIA_CHAVE_AES_256`
- `IA_SERVICE_URL`

Web:

- `NEXT_PUBLIC_API_URL`
- `OCTACLIN_API_ORIGENS_PERMITIDAS`
- `OCTACLIN_COOKIE_SECURE`

## Sequencia recomendada apos merge

1. Criar banco PostgreSQL gerenciado de staging.
2. Criar Redis gerenciado de staging.
3. Configurar secrets do backend.
4. Fazer deploy do backend e validar `/health`.
5. Configurar secrets da web apontando para o backend.
6. Fazer deploy da web e validar login.
7. Executar smokes contra staging.

## Validacao local

- Backend typecheck: aprovado.
- Backend build: aprovado.
- Backend testes unitarios: 15 suites e 42 testes aprovados.
- Web typecheck: aprovado.
- Web build: aprovado.
- Verificacao de referencias indevidas ao sistema usado como modelo: aprovada.
- Verificacao ASCII dos arquivos da fase: aprovada.
