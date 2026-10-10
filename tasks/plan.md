# Handoff — Fase 312: planejamento → implementação

## Estado e próxima ação

Planejamento/decisões fechados; implementação não iniciada. O proprietário
solicitou planejamento após merge da 311. Próxima ação: trocar manualmente para
**GPT-6 Luna alto** e implementar a sequência em `tasks/todo-fase-312.md`, na
mesma branch/worktree abaixo. Pausar antes do código para essa troca.

- Branch: `feature/fase-312-documentos-clinicos`.
- Worktree: `/workspace/octaclin/.worktrees/feature-fase-312-documentos-clinicos`.
- Base: `cd345a5e`, main com 311 e Handlebars PR #387.
- PR da 312: ainda não aberta; uma única PR de implementação, sem PR documental.
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

## Validação e limites deste ciclo

- PASS: base/branch, merge 311 e CI da PR/pós-merge consultados no GitHub;
  código do motor/DTO/ORM/Client/BFF/impressão/timeline/migrations e testes lidos.
- PASS: seis decisões de produto recebidas; nenhum código de feature escrito.
- PASS: `git diff --check`, scanner local de secrets e verificador da matriz
  de confiabilidade (40 referências críticas); sem testes de feature neste ciclo.
- SKIPPED: testes de implementação, PostgreSQL externo, assinatura/provider,
  migração/deploy/produção; não executados neste planejamento.
- CI da base `cd345a5e`, run `38044362697`, ainda em andamento na consulta;
  reconfirmar antes de código/PR. CI do merge 311 foi SUCCESS, não inferir o atual.
- Ambiente local Node 24.19.0/pnpm 11.19.0; manifests exigem Node 22/pnpm
  11.25.0. Usar versões declaradas na implementação, sem reescrever lockfiles.
  PowerShell não disponível; preflight PowerShell completo não executado.
- PR 389 sem revisão formal registrada; Provenance do SBOM SKIPPED. Merge/CI
  não comprovam validação jurídica ou operação em produção.

## Ordem de execução e atualização do estado

Reconfirmar status/base/diff e ler AGENTS. Seguir as nove fatias/checkpoints do
checklist: domínio/DTO → migration → preparação/prévia → confirmação/replay →
modelos → BFF → UI → demo/Playwright → PostgreSQL/gates/documentação/PR.
Leia o guia Next instalado antes de alterar código Web. Começar pelos testes
significativos de contrato/autoria; executar gates proporcionais e completos
indicados no checklist. Se fato novo bloquear um item, registrar evidência e
continuar itens independentes; decisão de produto nova deve voltar ao usuário.

Atualizar evidências no mesmo PR da implementação; publicar e acompanhar CI,
sem merge automático. Não voltar a declarar planejadas fases já integradas.
Este handoff foi preparado para Luna alto implementar sozinho dentro do escopo
fechado; não trocar modelo automaticamente nem delegar sem autorização.
