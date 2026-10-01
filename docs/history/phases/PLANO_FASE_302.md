# Fase 302 — autosserviço LGPD da clínica

Planejado em 2026-10-01 na branch `docs/roadmap-pos-301`, a partir de
`docs/product/ROADMAP_POS_AUDITORIA_FASES_302_320.md` e do PR #359 integrado.
Modelo sugerido: GPT-6 Sol, esforço alto. Skills: planejamento, segurança,
privacidade, NestJS/TypeORM, migration, Next.js e fechamento de fase.

## Decisão, fronteira e risco

O proprietário decidiu que o gestor `Client` com `cliente.acessar` consulta e
assume a tratativa dos pedidos do **próprio tenant**, e pode preparar uma
resposta para revisão humana. Conclusão, indeferimento, eliminação e programação
de retenção permanecem com `SuperAdmin`. Nenhuma resposta sai automaticamente.
O proprietário autorizou cifrar a descrição livre e mostrá-la ao gestor do
tenant; migration e backfill são procedimentos fora de banda, sem execução pelo
runtime. O tenant é sempre o da credencial verificada.

Risco **R4**: dados pessoais/possivelmente clínicos, authz, RLS e migration.
O menor escopo não muda a política de retenção, não cria novo poder de apagar
dados, não expõe a rota operacional e não replica entidade ORM para o cliente.

## Arquitetura e tarefas

1. **Proteger o texto livre.** Migration aditiva 1062 com coluna `bytea`
   opcional em `consentimentos_lgpd`. Novos pedidos e tratativas cifram com
   `CriptografiaDadosSensiveis` e removem `detalhes` do JSON. Leituras usam
   a coluna cifrada; leitura legada só enquanto o backfill não terminar.
   Backfill opt-in por tenant com identificação de banco/role, lotes pequenos,
   cifra e remoção do JSON na mesma transação, idempotência e contagem final.
  O deploy que lê a coluna exige migration antes do runtime novo. O backfill
  ocorre depois de todas as instâncias usarem o runtime novo.
2. **Leitura própria da clínica.** Novo serviço/controller `cliente/lgpd` com
   papel exato `Client`, permissão `cliente.acessar`, `ExecutorTenant`, filtro
   explícito por tenant, paginação/allowlist, `private, no-store`, DTO mínimo
   e auditoria sem conteúdo. Lista: protocolo, tipo, estado, datas e indicador
   de descrição; detalhe mostra descrição, histórico de estados e rascunho.
   IDs internos de paciente/usuário só quando necessários e autorizados.
3. **Triagem com máquina de estados.** `Client` só muda `recebida ->
   em_tratamento`, com operação idempotente sob lock transacional; protocolo
   de outro tenant retorna não encontrado. O rascunho usa texto factual
   relativo ao estado, referência neutra à clínica e aviso de revisão, sem envio
   nem status final. `SuperAdmin` mantém as rotas de decisão final existentes.
4. **Portal do cliente.** Nova aba LGPD com fila paginada, filtros fechados,
   detalhe, histórico, botão de assumir e preparação de resposta. Sem export
   de CSV, programação de retenção, botão concluir/indeferir ou eliminação
   nessa superfície. BFF valida query e revalida sessão/permissão.
5. **Documentação e handoff.** ADR para divisão de poderes, runbook de
   migration/backfill/checagem, reconciliação de status/checklist/auditoria e
   matriz de risco. Revisão de diff, secrets, e gates aplicáveis antes do PR.

## Gaps encontrados e resolução planejada

- **Descrição livre em `jsonb` sem cifra:** a nova leitura agravaria a
  exposição. Coluna cifrada e backfill fazem parte da mesma entrega; o
  cutover só é aceito quando não restar descrição legada no JSON.
- **Serviço operacional permite qualquer mudança de status:** a rota da
  clínica terá operação fechada e não chamará o endpoint geral. A revisão da
  semântica de decisões finais do SuperAdmin exige evidência de execução de
  retificação/eliminação e política jurídica própria; não afirmar que
  `concluida` prova eliminação. Mostrar essa distinção na interface.
- **Resposta atual se assina “Equipe OctaClin”:** rascunho da clínica terá
  identidade neutra da clínica e será rotulado como não enviado. A revisão e
  comunicação efetiva permanecem fora da automação.
- **Portal do paciente exibia nota interna e resposta só preparada:** o resumo
  do paciente deixa de projetar esses textos; permanece o estado do pedido e a
  descrição que ele próprio enviou. Resposta visível exige comunicação efetiva,
  que não faz parte desta fase.
- **Dados derivados de evento e concorrência:** leitura atual reconstrói a
  situação de eventos. Assumir a tratativa usa lock por tenant/protocolo e
  revalidação do estado, sem criar transições duplicadas ou sobrescrever
  decisão final de operador.
- **Rollout aditivo com coluna nova:** migration 1062 precede o deploy; o
  backfill é repetível e o JSON legado é apagado somente após cifra verificada.
  Depois do backfill, o runtime antigo não lê a descrição; rollback passa a
  ser um forward fix ou desativação da nova superfície, preservando a coluna.
  O `down` recusa a reversão. Sem acesso a banco externo neste PR.

## Aceite e rollback

- `Client` do tenant A vê apenas pedidos de A e pode iniciar tratativa uma
  vez; outros papéis, sessão sem permissão, filtro estranho e protocolo de B
  são negados. SuperAdmin conserva sua superfície própria.
- Texto livre novo é cifrado em repouso; legado é convertido e removido do
  JSON pelo procedimento fora de banda, sem imprimir dados. Nenhum texto
  livre entra em trilha de auditoria, log ou cache compartilhado.
- A clínica vê uma resposta apenas como rascunho; nem rota nem UI de cliente
  concluem, indeferem, apagam, exportam CSV ou programam retenção.
- Antes do backfill, é possível voltar ao runtime anterior com a coluna
  preservada, mas pedidos criados pelo runtime novo podem perder a descrição
  na leitura antiga. Após o backfill, **não há rollback compatível** para o
  runtime anterior: desativar a nova superfície ou corrigir para frente,
  preservando a coluna e o texto cifrado. Nunca reconstituir JSON em claro.
- Evidência de staging/produção e de execução da migration/backfill será
  registrada separadamente pelo operador após confirmar banco, branch e role.
