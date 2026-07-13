# OctaClin - Deploy AWS

## Topologia Recomendada

- **ECS Fargate**: `octaclin-backend`, `octaclin-web`, `octaclin-ai-service`.
- **RDS PostgreSQL 15+**: habilitar TimescaleDB e pgvector conforme imagem/extensoes disponiveis.
- **ElastiCache Redis**: BullMQ, filas de comunicacao e automacoes.
- **S3**: midias de pacientes e uploads pre-assinados.
- **ALB**: roteamento `/api` para backend, `/` para web e rede privada para IA.
- **Secrets Manager**: JWT, chaves AES, Meta, SMTP, OpenAI/Gemini/Google Vision.
- **CloudWatch**: logs, metricas de fila e alarmes.

## Secrets GitHub Actions

Obrigatorios para `.github/workflows/deploy-aws.yml`:

```text
AWS_DEPLOY_ROLE_ARN
AWS_REGION
AWS_ECR_BACKEND_REPOSITORY
AWS_ECR_WEB_REPOSITORY
AWS_ECR_AI_REPOSITORY
AWS_ECS_CLUSTER
AWS_ECS_BACKEND_SERVICE
AWS_ECS_WEB_SERVICE
AWS_ECS_AI_SERVICE
```

## Variaveis de Ambiente Backend

```text
NODE_ENV=production
PORTA_HTTP=3000
BANCO_HOST=<rds-endpoint>
BANCO_PORTA=5432
BANCO_USUARIO=<usuario>
BANCO_SENHA=<secret>
BANCO_NOME=octaclin
BANCO_SSL=true
REDIS_HOST=<elasticache-endpoint>
REDIS_PORTA=6379
IA_SERVICE_URL=http://octaclin-ai-service:8001
JWT_SEGREDO=<secret>
JWT_REFRESH_SEGREDO=<secret>
CRIPTOGRAFIA_CHAVE_AES_256=<secret>
META_WHATSAPP_TOKEN=<secret>
META_WHATSAPP_PHONE_NUMBER_ID=<id>
EMAIL_REMETENTE=<email>
ARMAZENAMENTO_BUCKET_MIDIA=<bucket>
```

## Quality Gates de Deploy

1. Executar CI completo.
2. Rodar migrations em job isolado antes do rollout.
3. Validar `/health` do backend.
4. Validar `GET /health` do `octaclin-ai-service`.
5. Verificar workers BullMQ conectados ao Redis.
6. Liberar tráfego progressivamente via ECS deployment circuit breaker.

## Riscos e Mitigacoes

| Risco | Impacto | Mitigacao |
|---|---:|---|
| Extension pgvector/TimescaleDB indisponivel no RDS escolhido | Alto | Usar imagem compativel ou Aurora/RDS com extensoes confirmadas antes do cutover |
| Falha entre banco e fila | Alto | Evoluir para outbox transacional |
| Secrets expostos em task definition | Critico | Usar Secrets Manager e IAM task role |
| Custos de IA e WhatsApp | Alto | Rate limit por tenant, cache e quotas por plano |
