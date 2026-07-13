# OctaClin - Deploy Azure

## Topologia Recomendada

- **Azure Container Apps**: backend, web e microservico de IA.
- **Azure Database for PostgreSQL Flexible Server**: PostgreSQL 15+ com extensoes necessarias.
- **Azure Cache for Redis**: BullMQ.
- **Azure Blob Storage**: midias de pacientes.
- **Azure Key Vault**: segredos de JWT, AES, provedores e banco.
- **Application Gateway / Front Door**: TLS, WAF e roteamento.
- **Application Insights**: logs e metricas.

## Secrets GitHub Actions

Obrigatorios para `.github/workflows/deploy-azure.yml`:

```text
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
AZURE_RESOURCE_GROUP
AZURE_ACR_NAME
AZURE_ACR_LOGIN_SERVER
AZURE_CONTAINER_APP_BACKEND
AZURE_CONTAINER_APP_WEB
AZURE_CONTAINER_APP_AI
```

## Variaveis de Ambiente Backend

```text
NODE_ENV=production
PORTA_HTTP=3000
BANCO_HOST=<postgres-flexible-server>
BANCO_PORTA=5432
BANCO_USUARIO=<usuario>
BANCO_SENHA=<secret>
BANCO_NOME=octaclin
BANCO_SSL=true
REDIS_HOST=<azure-cache-redis>
REDIS_PORTA=6379
IA_SERVICE_URL=http://octaclin-ai-service:8001
JWT_SEGREDO=<key-vault-secret>
JWT_REFRESH_SEGREDO=<key-vault-secret>
CRIPTOGRAFIA_CHAVE_AES_256=<key-vault-secret>
META_WHATSAPP_TOKEN=<key-vault-secret>
SENDGRID_API_KEY=<key-vault-secret>
ARMAZENAMENTO_BUCKET_MIDIA=<blob-container>
```

## Quality Gates de Deploy

1. CI completo aprovado.
2. Imagens publicadas no ACR.
3. Migrations executadas por job controlado.
4. Healthcheck do backend respondendo.
5. Healthcheck do IA service respondendo.
6. Container Apps com revision rollout gradual.

## Riscos e Mitigacoes

| Risco | Impacto | Mitigacao |
|---|---:|---|
| Extensoes PostgreSQL nao habilitadas | Alto | Provisionar e validar extensoes antes das migrations |
| Redis com TLS obrigatorio | Medio | Ajustar `ioredis` para TLS quando ambiente exigir |
| Cold start do IA service | Medio | Min replicas > 0 para planos criticos |
| Upload sem assinatura real | Alto | Implementar SAS Blob ou pre-signed URL equivalente antes de producao |
