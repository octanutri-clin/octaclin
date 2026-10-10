# Handoff — Fase 312: revisão/merge

## Estado e próxima ação

Implementação concluída e PR única aberta; todos os checks obrigatórios da
rodada final passaram. Próximo passo: revisão humana e merge pelo proprietário.
Não houve merge automático. Se a revisão revelar uma decisão arquitetural ou
risco R4 novo, usar GPT-6.1 Sol médio para analisar e avisar o proprietário
antes de qualquer troca de modelo; correções localizadas continuam adequadas
para GPT-6 Luna alto.

- Branch: `feature/fase-312-documentos-clinicos`.
- Worktree: `/workspace/octaclin/.worktrees/feature-fase-312-documentos-clinicos`.
- Base: `cd345a5e`, main com 311 e Handlebars PR #387.
- PR da 312: [#390](https://github.com/octanutri-clin/octaclin/pull/390), uma
  PR de implementação, sem PR documental. CI final `38048342326`: Backend,
  Web, Mobile, AI FastAPI, Demo local smoke, Governança, Operação, Rollout e
  PR Gate PASS; CodeQL/Dependency Review/Semgrep/Trivy PASS. Provenance do
  SBOM SKIPPED. Execução local e limitações estão em `PLANO_FASE_312.md`.
- Contrato/gaps/rollback: [PLANO_FASE_312.md](../docs/history/phases/PLANO_FASE_312.md).
- Sequência com arquivos, testes e aceites: [todo-fase-312.md](todo-fase-312.md).
- Handoff anterior preservado em [plan-fase-311.md](plan-fase-311.md).

## Decisões confirmadas pelo proprietário

1. Entregar encaminhamento; atestados aguardam validação jurídica específica.
2. Destino/serviço e motivo obrigatórios; destinatário, instituição e contexto
   clínico opcionais, preenchidos pelo profissional.
3. Entrega nesta fase por impressão/PDF do navegador no motor atual.
4. Emissão apenas pelo próprio profissional responsável atual, com identidade
   autenticada e registro; sem delegação a colaboradores/SuperAdmin.
5. Não exigir consulta de origem/concluída para encaminhamento.
6. Prévia completa e confirmação; mudanças relevantes pedem nova conferência.

Nenhuma pergunta de produto permanece aberta. Atestado é gate futuro pendente,
não ausência de resposta para o encaminhamento. Assinatura manual no papel;
assinatura digital/portal/canais novos não integram a entrega aprovada.

## Contratos essenciais para o Luna

- Um quarto tipo `encaminhamento` no motor existente. Título fixo; texto puro
  cifrado em snapshot. Usar DTO aninhado com campos/limites definidos no plano;
  não reutilizar texto da alta nem carregar conteúdo do prontuário automaticamente.
- Validar diretamente paciente, nome/registro do emissor ativo e vínculo do
  próprio responsável em `ExecutorTenant`; regras do modelo não substituem
  validação. Bloquear papel, tenant/carteira, profissional ausente/arquivado.
- Rota de prévia só para novo tipo, autenticada/gerenciar, sem persistir
  documento/draft. Preparação compartilhada produz corpo/cabeçalho e SHA-256
  determinístico; emissão exige hash da prévia + confirmação e salva exatamente
  o snapshot comparado. Divergência →409/refazer prévia. Hash não é assinatura.
- Chave UUID por confirmação; replay durável sob lock/índice retorna mesmo
  ID, inclusive cancelado. Pedido diferente com mesma key →409. Fingerprint
  guardado no cabeçalho cifrado e omitido do DTO. Identidade verificada antes
  do replay; não fazer consulta depois de `23505` em transação abortada.
- Migration proposta 1067: CHECK novo tipo, chave nullable/obrigatória apenas
  no novo tipo, unique parcial e trigger de snapshot. Registrar TypeORM e
  confirmar número livre; nenhuma migration externa sem alvo/autorização.
- Modelos: quarto tipo/corpo personalizável/título fixo; tokens essenciais
  exigidos; PATCH preserva tipos omitidos sob lock/merge para clientes antigos.
- UI usa papel/permissão já carregados no prontuário. Ramo específico para
  encaminhamento, prévia antes de persistir; editar invalida; falha incerta
  preserva UUID/body. Limpar e ignorar requests antigos ao mudar paciente.
- BFF: wrappers existentes, permissões por método e `private, no-store`
  inclusive erros. Origem de mutação protegida. Backend revalida autoria.
- Emitido é imutável; corrigir cancela e emite outro. Novo tipo nunca enviado
  por e-mail. Três tipos existentes e documentos já emitidos continuam legíveis.
- PostgreSQL real deve provar índice/replay concorrente, trigger, RLS e
  transferência concorrente. Testes mockados não encerram essas propriedades.
- Rollback mantém leitura do novo tipo e schema; down recusa se há dados novos.
  Não apagar encaminhamentos para reverter. Revisão R4 independente quando viável.

## Validação local e limites

- PASS: backend/Web typecheck e build; backend Jest 2474 PASS/45 SKIPPED; RLS
  Testcontainers 26/26; teste visual da fase 2/2 em desktop/mobile com axe na
  prévia; smoke BFF `smoke-e2e-bff-ok`; scanner de secrets, redaction,
  migrations, guardas, matriz de confiabilidade/acessibilidade.
- PASS: suíte completa `test:authz` (todos os harnesses na cadeia terminaram
  com exit 0, incluindo a prova BFF da 312: 2/2); cadeia validada também no CI.
- PostgreSQL provou isolamento, índice, trigger, cancelamento e recusa de
  rollback com encaminhamentos. Replay concorrente do serviço e rollback sem
  linhas ainda não têm prova integrada específica.
- Ambiente local Node 24.19.0/pnpm 11.19.0; manifests pedem Node 22/pnpm
  11.25.0. O `pnpm` tentou substituir módulos e abortou com segurança sem TTY;
  o suite `test:authz` é executado por Node diretamente. CI com versões
  declaradas continua sendo gate. Nenhum lockfile foi alterado.
- Migration 1067 não aplicada fora do Postgres descartável. Deploy/produção,
  assinatura/provider e validação jurídica de atestados SKIPPED. Revisão R4
  independente e Provenance do SBOM também não estão comprovadas.

## Próxima execução

1. Revisão humana do PR #390; decidir merge após examinar os limites registrados.
2. Não aplicar migration nem inferir aceite jurídico/produção a partir do CI.

Não há perguntas de produto abertas. Não aplicar migration/deploy nem simular
revisão R4 independente. Não trocar o modelo automaticamente.
