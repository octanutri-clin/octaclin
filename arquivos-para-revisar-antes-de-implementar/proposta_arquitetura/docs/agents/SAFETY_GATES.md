# OctaClin — Safety Gates

> Status: ativo  
> Fonte de verdade para: alterações críticas, PHI/PII, segurança e autorização

## 1. Objetivo

Definir situações em que um agente não deve agir apenas por inferência técnica.

## 2. Mudanças que exigem decisão explícita

Antes de executar mudança material nos itens abaixo, confirme que ela faz parte da tarefa/fase aprovada:

- autenticação;
- autorização;
- papéis/permissões;
- tenancy;
- RLS;
- criptografia ou rotação de estratégia criptográfica;
- armazenamento de PHI/PII;
- política de retenção/exclusão;
- operação destrutiva de banco;
- mudança de provedor crítico;
- produção;
- domínio/DNS;
- envio real de e-mail/WhatsApp/notificação para usuários;
- ativação de IA clínica;
- alteração de limites da IA clínica;
- ativação/distribuição do Mobile;
- desligamento de auditoria;
- bypass temporário de security gate;
- recuperação/restore de produção.

Se a fase já autoriza explicitamente a mudança e o runbook define o procedimento, não peça confirmação redundante para cada comando. Siga a autorização existente e mantenha evidência.

## 3. PHI/PII

### Nunca utilizar dados reais em

- prompts;
- fixtures;
- screenshots;
- issues;
- PRs;
- comentários;
- documentação;
- logs de debug;
- exemplos de API;
- snapshots de teste;
- dumps locais não controlados;
- ferramentas externas não aprovadas.

### Para reproduzir bug clínico

1. reduza o caso;
2. remova identificadores;
3. substitua conteúdo clínico;
4. mantenha apenas estrutura necessária;
5. utilize tenant/paciente sintético.

## 4. Secrets

Nunca:

- imprimir secret completo;
- colar connection string em chat;
- versionar `.env`;
- registrar token em screenshot;
- armazenar credencial em Markdown;
- “remover depois” como estratégia.

Uma credencial exposta deve ser tratada como comprometida e rotacionada quando aplicável.

Antes de push:

```sh
pnpm security:secrets
git diff --check
```

## 5. Multi-tenancy

Mudança em dados deve provar:

- tenant A não lê tenant B;
- tenant A não altera tenant B;
- bypass administrativo é explícito e auditável;
- API não confia em tenant informado livremente pelo cliente;
- jobs/worker preservam contexto de tenant;
- integrações não misturam tenant.

## 6. RLS

Mudanças RLS são R4.

Exigem, conforme aplicável:

- teste RED/GREEN;
- Postgres real;
- role correta;
- `FORCE ROW LEVEL SECURITY` quando previsto;
- tentativa positiva;
- tentativa negativa cross-tenant;
- verificação de policy/catalog;
- revisão independente.

## 7. Auth e autorização

Não basta esconder UI.

Provar a autorização no lado servidor/API.

Para alteração crítica, testar pelo menos:

- autorizado;
- não autenticado;
- autenticado sem permissão;
- tenant incorreto;
- papel limítrofe relevante.

## 8. Criptografia

Não criar criptografia própria.

Antes de alterar:

- algoritmo;
- formato;
- chave;
- derivação;
- blind index;
- envelope;
- rotação;

documente compatibilidade e migração dos dados existentes.

Nunca logar plaintext para “debug”.

## 9. Integrações externas

Antes de nova integração:

- quais dados saem?
- existe PHI/PII?
- qual tenant?
- qual base legal/consentimento quando aplicável?
- timeout?
- retry?
- idempotência?
- outbox?
- webhook assinado?
- observabilidade sem conteúdo sensível?
- fallback?
- feature flag?
- como desligar?

## 10. IA clínica

A IA não deve ganhar autonomia clínica por acidente.

Mudança deve definir:

- entrada permitida;
- saída permitida;
- revisão humana;
- feature flag;
- timeout;
- fallback;
- auditoria;
- dados enviados ao provedor;
- retenção;
- comportamento fail-closed.

## 11. Produção

Antes de mutação:

- ambiente confirmado;
- identidade confirmada;
- commit/ref confirmado;
- backup/rollback quando aplicável;
- runbook atual lido;
- impacto esperado documentado.

Nunca usar staging/integracao como prova de produção.

## 12. Migration com DDL

Aplicar o procedimento operacional vigente.

Princípios mínimos:

1. ponto de retorno adequado;
2. integração coerente com schema de produção;
3. prova da migration;
4. aplicação com role autorizada;
5. deploy;
6. monitoramento pós-deploy.

Se `migrationsRun`/variável equivalente divergir do runbook, pare o rollout e reconcilie primeiro.

## 13. Operações R5

Operações destrutivas ou de alto impacto exigem:

- autorização explícita;
- plano;
- backup quando aplicável;
- rollback;
- blast radius;
- verificação pós-ação;
- registro do resultado.

## 14. Fail-closed

Em segurança, quando o estado não puder ser determinado:

> negar/abortar é preferível a assumir sucesso.

Exceções precisam ser decisão arquitetural explícita.

## 15. Checklist R4/R5

- [ ] escopo aprovado;
- [ ] risco classificado;
- [ ] dados reais não usados;
- [ ] ameaça principal identificada;
- [ ] RED observado;
- [ ] teste positivo;
- [ ] teste negativo;
- [ ] tenancy/RLS avaliados;
- [ ] auditoria avaliada;
- [ ] rollback avaliado;
- [ ] gates de segurança executados;
- [ ] revisão independente feita quando viável;
- [ ] evidência final registrada.
