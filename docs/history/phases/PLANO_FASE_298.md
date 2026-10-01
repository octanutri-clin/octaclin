# Fase 298 — edição versionada de modelos de plano alimentar

## Objetivo e decisões

Permitir corrigir modelos pessoais e da clínica sem recriá-los, com histórico cifrado e imutável, consulta de versões e restauração que gera uma nova versão. Planos já publicados mantêm seus próprios snapshots. O proprietário escolheu deixar USDA, TACO, IBGE e TBCA para uma fase de catálogos separada; nenhuma chave de API ou carga de alimentos é necessária aqui.

Planejamento: Sol, esforço alto. Na implementação, usar GPT-6-Luna high se a transferência de modelo estiver disponível. Skills: `agent-skills:planning-and-task-breakdown`, `test-driven-development`, `nestjs-best-practices`, `typeorm`, `security-review` e `fechar-fase`. Risco R4 por conteúdo clínico cifrado, tenancy e migration.

## Contratos e implementação

1. **Persistência aditiva:** criar migration 1060 com `versao_atual integer not null default 1` no modelo e tabela de revisões. Cada revisão guarda número, nome e refeições cifrados, contagens, autor e data. Índice único `(tenant_id, modelo_id, numero)`; FKs compostas para impedir referência entre tenants; RLS `ENABLE` e `FORCE` na tabela nova, com política baseada em `app.tenant_id`. Proteger revisões contra `UPDATE` e `DELETE` com trigger, conforme padrão de snapshots imutáveis do projeto. Registrar entidade e migration no TypeORM. Não há DDL ou backfill executado em ambiente externo neste PR.
2. **Legado sem varredura multi-tenant:** modelos anteriores à migration começam em versão 1. A API apresenta a versão 1 a partir do modelo atual quando ainda não há linha de revisão. Na primeira edição ou restauração, persiste o snapshot cifrado de v1 e a nova v2 na mesma transação. Modelos criados após a migration gravam v1 desde a criação. Isso evita um backfill global que esbarraria em `FORCE RLS` e mantém o histórico desde a primeira edição.
3. **Concorrência e integridade:** editar exige `versaoEsperada`; bloquear a linha do modelo na transação tenant antes de comparar. Versão divergente retorna 409 e não grava nada. A alteração atualiza somente nome/refeições/contagens e acrescenta revisão N+1, sem alterar origem, proprietário ou criador. Restaurar exige versão de origem existente e `versaoEsperada`; copia o snapshot cifrado para uma nova N+1, nunca reescreve revisões. Auditoria registra ação, número e contagens, sem nome nem refeições.
4. **Autorização e leitura:** manter JWT, papel e permissões atuais. Leitura de histórico exige `planos_alimentares.ler`; mutações exigem `planos_alimentares.gerenciar`. Modelo pessoal continua visível só ao dono (ou SuperAdmin) e modelos de outro tenant retornam 404. Filtrar modelo e revisão por tenant no SQL. API: `PUT /planos-alimentares/modelos/:modeloId`; `GET /:modeloId/versoes` paginado; `GET /:modeloId/versoes/:numero`; `POST /:modeloId/versoes/:numero/restaurar`. Validar UUID, número positivo, nome e refeições com os limites do rascunho; origem não pode ser enviada em edição.
5. **Web:** estender BFF e cliente tipado. Na interface, manter edição em estado separado do plano do paciente; nunca atualizar modelo diretamente a partir das refeições atuais do paciente nem aplicar/restaurar silenciosamente. Abrir uma cópia de edição do modelo, mostrar origem, versão e itens indisponíveis, editar nome e estrutura, revisar antes de confirmar, e guardar somente após ação explícita. Histórico paginado com leitura de snapshot sob demanda, visualização das refeições e restauração confirmada. 409 preserva alterações locais. A listagem de modelos precisa permitir carregar além dos 100 iniciais. Nenhum conteúdo clínico deve entrar em armazenamento local, telemetria ou logs.
6. **Fechamento:** reconciliar Fase 297 já integrada e Fase 298 no checklist, status, resumo e auditoria no mesmo PR. Propor próxima fase de catálogos como planejamento, sem afirmar licença ou fonte validada antes de verificá-las. Abrir uma única PR após revisão de diff, testes e gates; aplicação da migration permanece fora de banda com banco, branch e role owner confirmados pelo operador.

## Gaps revisados e soluções

| Gap | Solução |
| --- | --- |
| Rascunho de paciente poderia sobrescrever modelo compartilhado | Edição carrega cópia do modelo selecionado em estado isolado; só criar modelo novo usa as refeições atuais, pelo comando explícito já existente. Alterar um modelo existente exige revisão e confirmação própria. |
| Edição concorrente perde alterações | Número esperado + bloqueio da linha + 409; conservar edição local para resolução humana. |
| Modelos antigos não possuem revisão | Linha v1 criada sob tenant na primeira mutação; leitura de v1 virtual até então. |
| Histórico cresce sem limite | Lista paginada; descriptografar conteúdo apenas ao abrir uma revisão. |
| Restauração sobrescreve prova histórica | Criar revisão N+1 com conteúdo copiado; revisões anteriores permanecem imutáveis. |
| Uma rota ou job futuro poderia reescrever o histórico | Bloqueio de `UPDATE` e `DELETE` no banco, além da API append-only. |
| Fonte alimentar torna-se inativa | Avisar no snapshot e revalidar no salvamento/aplicação, sem substituição silenciosa. |
| Nome, refeições ou conteúdo sensível em auditoria | Metadados mínimos, cifragem em repouso, sem PHI em logs. |
| Outro tenant com ID conhecido poderia ler ou alterar modelo | `obterNoEscopo` filtra tenant antes de abrir revisão; serviço responde 404. Testes negativos cobrem leitura, histórico, edição, restauração e arquivamento para modelo existente em outro tenant. A prova RLS real continua no CI PostgreSQL. |
| Arquivamento simultâneo | Bloquear modelo também em mutações e impedir edição/restauração de arquivado. |
| Mais de 100 modelos ocultos na interface | Paginação incremental de listagem. |
| Planos publicados mudariam retroativamente | Modelo é cópia de origem; nunca atualizar plano a partir da revisão. |
| Migration sobre tabelas com `FORCE RLS` | Migration somente de estrutura; sem varredura de dados. Rodar fora de banda com role owner confirmada. |
| Rollback de schema poderia apagar histórico já persistido | `down()` da migration 1060 falha fechado sem executar DDL. Reversão de aplicação desativa as rotas e mantém as revisões; qualquer migração corretiva exige procedimento explícito de preservação. |

## Validação e limites

TDD para criação, edição, conflito, leitura paginada, restauração, legado, autorização negativa, isolamento de tenant, arquivamento e validação. Validar BFF/cliente/UI, typecheck e build, gates de linguagem e authz, `git diff --check` e `pnpm security:secrets`. Prova PostgreSQL/RLS e concorrência real apenas em banco descartável confirmado; sem isso, marcar `SKIPPED` e exigir CI/revisão. O `down()` é intencionalmente não reversível automaticamente para impedir perda de histórico. Node 22 no CI é a evidência de compatibilidade autoritativa quando o local estiver em Node 24.

## Entrega e evidências locais — 2026-10-01

- Implementados controller/DTO, serviço transacional, migration/ORM, BFF e editor estruturado; edição cobre nome, refeições, alimentos, alternativas, porções e preferências. Busca usa o catálogo autenticado já existente, sem carga de novos datasets.
- PASS — backend focado: 3 suítes / 32 testes; typecheck e build de produção do backend.
- PASS — web: typecheck/build; `test:authz`; `test:linguagem` (8 testes do utilitário e gate de interface); BFF de planos/modelos (23 testes); Playwright do editor/histórico (1 cenário).
- PASS — redação de auditoria (24), política de migrations fora de banda (13), preflight documental, `git diff --check` e scanner local de secrets.
- Ambiente local usa Node 24.19.0, fora de `>=22 <23`; os comandos concluíram, mas compatibilidade autoritativa permanece nos gates Node 22 do CI.
- Teste visual comprova rascunho ativo, edição independente do paciente, atualização de alternativa e restauração como revisão nova.
- Revisão cruzada `tenant-security-reviewer`: sem falha concreta de cross-tenant; pontos identificados foram tratados com `down()` fail-closed e testes negativos de tenant para leitura, histórico, edição, restauração e arquivamento.
- Migration 1060 não aplicada em staging/produção. Sem Docker/PostgreSQL local, enforcement real de RLS e concorrência multi-sessão permanecem `SKIPPED` e dependem do CI PostgreSQL antes do merge.
