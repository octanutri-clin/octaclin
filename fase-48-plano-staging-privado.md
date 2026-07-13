# Fase 48 - Plano de staging privado

## Objetivo

Preparar o primeiro ambiente remoto privado do OctaClin sem expor dados reais nem misturar configuracoes de demo com producao.

## Decisao recomendada

Usar um ambiente `staging` antes de producao. O staging deve ficar privado, com banco separado, secrets proprios e acesso restrito aos responsaveis pelo projeto.

## Componentes

- Web Next.js: deploy privado com dominio temporario ou protegido por autenticacao.
- Backend NestJS: servico HTTP privado/publico controlado por CORS e rate limit.
- PostgreSQL: instancia gerenciada separada para staging.
- Redis: instancia gerenciada ou container para filas e automacoes.
- AI FastAPI: servico separado, preferencialmente containerizado.
- Storage de midias: bucket privado para uploads e evidencias futuras.
- Observabilidade: logs centralizados, healthchecks e alertas basicos.

## Secrets obrigatorios

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `CHAVE_CRIPTOGRAFIA_DADOS`
- `CORS_ORIGINS`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_SERVER_API_URL`
- `AI_SERVICE_URL`

## Secrets opcionais por integracao

- `SENDGRID_API_KEY`
- `EMAIL_REMETENTE`
- `META_WHATSAPP_TOKEN`
- `META_WHATSAPP_PHONE_ID`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

## Checklist antes do deploy

- Confirmar provedor de hospedagem.
- Criar banco PostgreSQL de staging.
- Criar Redis de staging.
- Gerar secrets fortes para JWT, refresh token e criptografia.
- Configurar dominio ou URL privada para web.
- Configurar URL publica/controlada para API.
- Configurar CORS para aceitar apenas a URL web de staging.
- Rodar migrations no banco de staging.
- Criar seed/admin inicial de staging.
- Executar smoke BFF contra staging.
- Executar smoke visual Playwright contra staging.
- Documentar credenciais operacionais de staging fora do repositorio.

## Sequencia de execucao sugerida

1. Escolher provedor para staging.
2. Provisionar PostgreSQL e Redis.
3. Configurar secrets no provedor.
4. Publicar backend e validar `/health`.
5. Publicar AI service e validar endpoint de saude.
6. Publicar web apontando para backend de staging.
7. Executar smoke de login e navegacao.
8. Executar smoke visual.
9. Revisar logs para dados sensiveis.
10. Congelar a configuracao como baseline de staging.

## Criterios de aceite

- A `main` do GitHub fica verde.
- O staging sobe sem depender da demo local.
- Login operacional funciona com usuario de staging.
- Rotas protegidas carregam sem erro bruto.
- Smokes automatizados passam contra staging.
- Nenhum segredo real fica versionado.
