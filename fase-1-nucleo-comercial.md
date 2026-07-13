# OctaClin - Fase 1: Nucleo Comercial

## Escopo Entregue

- Autenticacao com JWT access token e refresh token rotativo.
- Rate limiting basico no endpoint de login contra brute force.
- RBAC com roles `SuperAdmin`, `Professional`, `Collaborator` e `Patient`.
- Multitenancy aplicado por contexto autenticado (`tenantId` no token), nao mais por header livre.
- CRUD de pacientes com criacao, listagem paginada, detalhe, atualizacao e arquivamento logico.
- CRUD de profissionais com criacao de usuario vinculado, listagem paginada, detalhe, atualizacao e arquivamento logico.
- Testes unitarios Jest para hash de senha, regras de pacientes e criacao de profissionais.

## Modulo Auth

### Justificativa Tecnica

Foi usado `@nestjs/jwt` com guard proprio em vez de Passport para manter o fluxo explicito e pequeno nesta fase. O payload carrega `sub`, `tenantId`, `papel`, `emailHash` e `familiaToken`. O refresh token e armazenado apenas como SHA-256 no banco e revogado a cada renovacao.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| Guard JWT proprio | Baixo | Alto | Alta para MVP, menos indirecao |
| Passport JWT | Medio | Alto | Alta em times grandes, mas adiciona configuracao |
| Refresh token rotativo persistido | Medio | Alto | Alta seguranca, exige limpeza futura de tokens expirados |
| Hash PBKDF2 nativo | Baixo | Medio | Simples sem dependencia externa; Argon2 deve ser avaliado em producao |
| Rate limit in-memory | Baixo | Alto em instancia unica | Aceitavel no MVP local; trocar por Redis em producao |

### Riscos

- **Bootstrap do primeiro SuperAdmin**: ainda nao ha seed automatizado. Mitigacao: criar seed controlado na Fase 1.1 ou migration de ambiente.
- **Revogacao por familia em caso de reuse detectado**: hoje revoga token individual. Mitigacao: ao detectar refresh token ja revogado, revogar toda a `familia_token`.
- **Segredos fracos em ambiente local**: `.env.example` usa placeholders. Mitigacao: exigir secrets via CI/CD na Fase 6.
- **Rate limit nao distribuido**: em multiplas replicas, o contador in-memory perde eficacia. Mitigacao: mover contador para Redis/BullMQ antes do deploy.

## Modulo Multitenancy

### Justificativa Tecnica

O tenant passa a ser derivado do JWT validado. Cada servico de aplicacao executa operacoes via `ExecutorTenant`, que aplica `set_config('app.tenant_id', ...)` dentro da transacao para ativar RLS no PostgreSQL.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| `tenantId` no JWT | Baixo | Alto | Simples e auditavel |
| Resolver tenant por header | Baixo | Alto | Risco alto de spoofing |
| RLS + `ExecutorTenant` | Medio | Alto | Forte isolamento, exige disciplina transacional |

### Riscos

- **Servico esquecendo `ExecutorTenant`**: mitigado por padrao de modulo e testes unitarios; deve virar lint/regra arquitetural.
- **Login precisa consultar usuario com RLS**: resolvido buscando `tenant` por slug e depois consultando usuario dentro do contexto tenant.

## Modulo Pacientes

### Justificativa Tecnica

O CRUD de pacientes permanece no modulo de dominio `pacientes`, com DTOs na aplicacao, controller na apresentacao e entidade TypeORM na infraestrutura. Dados sensiveis continuam criptografados com AES-256-GCM.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| Arquivamento logico | Baixo | Alto | Preserva auditoria clinica |
| Delete fisico | Baixo | Alto | Risco legal e de perda de historico |
| Criptografia app-level | Medio | Medio | Melhor controle LGPD, reduz busca textual simples |

### Riscos

- **Busca por nome criptografado**: nao implementada diretamente. Mitigacao: manter hashes normalizados para campos buscaveis e avaliar blind indexes.
- **Performance < 200ms**: indices por `tenant_id` ja existem; validar com carga na Fase 6.

## Modulo Profissionais

### Justificativa Tecnica

A criacao de profissional cria um `usuarios` com role `Professional` e um perfil em `profissionais` na mesma transacao tenant. Isso garante consistencia entre autenticacao e perfil operacional.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| Usuario + perfil na mesma transacao | Baixo | Alto | Consistencia forte |
| Perfil sem usuario | Baixo | Alto | Inviabiliza login e auditoria |
| `SuperAdmin` cria profissionais | Baixo | Alto | Simples para MVP; precisa refinamento para admin de clinica |

### Riscos

- **Modelo de SuperAdmin por tenant ainda simplificado**: mitigacao: introduzir `TenantAdmin` ou permissoes granulares na Fase 1.1.
- **Senha inicial por API**: mitigacao: substituir por convite com token de ativacao antes de producao.

## Endpoints

| Metodo | Rota | Papel | Descricao |
|---|---|---|---|
| POST | `/auth/login` | Publico | Emite access e refresh token |
| POST | `/auth/renovar` | Publico | Rotaciona refresh token |
| POST | `/auth/sair` | Publico | Revoga refresh token |
| POST | `/profissionais` | SuperAdmin | Cria usuario profissional e perfil |
| GET | `/profissionais` | SuperAdmin, Professional | Lista profissionais |
| GET | `/profissionais/:id` | SuperAdmin, Professional | Detalha profissional |
| PATCH | `/profissionais/:id` | SuperAdmin, Professional | Atualiza profissional |
| DELETE | `/profissionais/:id` | SuperAdmin | Arquiva profissional |
| POST | `/pacientes` | SuperAdmin, Professional, Collaborator | Cria paciente |
| GET | `/pacientes` | SuperAdmin, Professional, Collaborator | Lista pacientes |
| GET | `/pacientes/:id` | SuperAdmin, Professional, Collaborator | Detalha paciente |
| PATCH | `/pacientes/:id` | SuperAdmin, Professional, Collaborator | Atualiza paciente |
| DELETE | `/pacientes/:id` | SuperAdmin, Professional, Collaborator | Arquiva paciente |

## Quality Gate da Fase 1

- Codigo organizado por modulos DDD.
- Autenticacao JWT implementada.
- Refresh token rotativo implementado.
- Rate limiting de login implementado.
- RBAC por decorator `@Papeis`.
- Multitenancy derivado do token e aplicado por `ExecutorTenant`.
- Testes unitarios adicionados para regras criticas.

## Proximo Gate Antes da Fase 2

Validar localmente com Node/Docker disponiveis:

```bash
cd outputs/octaclin-backend
npm install
npm test
npm run build
docker compose -f ../docker-compose.yml up -d
npm run migration:run
```
