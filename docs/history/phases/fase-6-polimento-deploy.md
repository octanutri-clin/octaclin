# OctaClin - Fase 6: Polimento e Deploy

## Escopo Entregue

- Healthcheck backend em `/health`.
- Dockerfile para backend NestJS.
- Dockerfile para web Next.js.
- Dockerfile para microservico FastAPI.
- `docker-compose.prod.yml` para composicao local de producao.
- GitHub Actions CI para backend, web, mobile e IA.
- GitHub Actions deploy AWS via ECR/ECS.
- GitHub Actions deploy Azure via ACR/Container Apps.
- Documentacao de deploy AWS e Azure.

## Justificativa Tecnica

GitHub Actions foi usado por ser o caminho mais direto para CI/CD em repositorios GitHub e por suportar OIDC com AWS/Azure sem gravar credenciais long-lived. Docker foi usado como contrato de runtime comum entre local, AWS ECS e Azure Container Apps.

## Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| Docker por servico | Medio | Alto | Padrao portavel |
| ECS/Container Apps | Medio | Alto | Menos operacao que Kubernetes |
| GitHub OIDC | Baixo | Alto | Reduz risco de secrets permanentes |
| Mobile apenas typecheck no CI | Baixo | Alto | Builds nativos entram com EAS ou pipelines dedicados |

## Riscos

- **Migrations junto ao boot da API**: aceitavel localmente; em producao deve virar job isolado.
- **Dockerfiles usam `--frozen-lockfile=false`**: pragmatico para artefatos gerados; em repo final, lockfile deve ser imutavel.
- **Mobile sem build nativo no CI**: proximo passo e EAS Build ou runners macOS/Android.
- **Lighthouse nao automatizado**: web build passa; teste Lighthouse deve rodar contra ambiente preview.

## Arquivos Entregues

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-aws.yml`
- `.github/workflows/deploy-azure.yml`
- `octaclin-backend/Dockerfile`
- `octaclin-web/Dockerfile`
- `octaclin-ai-service/Dockerfile`
- `docker-compose.prod.yml`
- `deploy-aws.md`
- `deploy-azure.md`

## Validacao

Validacao executada nesta entrega:

```bash
cd outputs/octaclin-backend
pnpm test
pnpm typecheck
pnpm build

cd ../octaclin-web
pnpm typecheck
pnpm build

cd ../octaclin-mobile
pnpm typecheck

cd ../octaclin-ai-service
python -m py_compile app/main.py
```

Resultado:

- Backend: 9 suites Jest aprovadas, 21 testes aprovados.
- Backend: TypeScript sem erros e build NestJS concluido.
- Web: TypeScript sem erros e build Next.js concluido.
- Mobile: TypeScript sem erros.
- IA FastAPI: `py_compile` concluido.
- Imports: backend 105 arquivos, web 10 arquivos, mobile 11 arquivos.
- Nenhuma referencia propria ao nome anterior encontrada.
