# Fase 255 - Prontuario clinico orientado a linha de cuidado

Concluida tecnicamente em 2026-08-22. Fase essencial e bloqueadora do
pre-piloto, sem migration.

## Entrega

- `estrutura-prontuario.ts` concentra areas, subareas, permissoes e destinos
  iniciais em contratos tipados.
- `linha-do-tempo-prontuario.tsx` concentra a apresentacao longitudinal sem
  introduzir HTML injetado ou persistencia local de PHI.
- Resumo deixa de aguardar Materiais e Anexos. Cada subarea possui carregamento,
  falha e nova tentativa independentes.
- O diretorio completo de profissionais e adiado ate uma area que necessita de
  autoria/filtro; o aviso SuperAdmin busca somente o responsavel do paciente.
- Area e subarea sobrevivem a recarga por identificadores canonicos na URL.
  IDs desconhecidos ou sem permissao sao removidos e caem no Resumo.
- Evolucao, tarefa, material, envio, anexo e plano alimentar protegem rascunhos
  antes de trocar area, voltar ou abrir a Agenda.
- Abas por teclado nao movem foco para um destino recusado; ao cancelar o modal,
  o foco retorna ao controle que iniciou a tentativa.
- Formularios e botoes mutaveis sao ocultados sem as permissoes correspondentes,
  mantendo o backend como barreira definitiva.

## Validacao

- `pnpm --dir octaclin-web test:prontuario:validacao`: 44/44.
- Jest focado em `servico-pacientes.spec.ts`: 36/36.
- `pnpm --dir octaclin-web test:authz`: 66/66.
- `pnpm --dir octaclin-web test:a11y`: 10/10.
- `pnpm --dir octaclin-web test:linguagem`: 8/8.
- `test:base-visual`, typechecks, builds backend/web e scanner de segredos:
  aprovados.
- ESLint dos arquivos alterados: zero erros; quatro avisos de effects ja
  existentes no componente principal.

## Revisao de seguranca

Nao foi sustentado bypass de tenant, carteira profissional, papel ou permissao.
RLS, BFF autenticado e autorizacao backend continuam sendo os controles reais.

Foram confirmadas dividas que nao cabem em uma fase sem migration:

- reduzir o payload inicial do prontuario a agregados e referencias, carregando
  detalhes clinicos descriptografados apenas sob demanda;
- garantir auditoria duravel para leituras e mutacoes clinicas, com outbox ou
  politica explicita de falha;
- cifrar JSON livre de check-ins, titulos clinicos livres e motivos de
  cancelamento que ainda podem conter PHI.

Esses itens foram adicionados, respectivamente, as Fases 260 e 261. Eles nao
foram declarados resolvidos nesta fase.

## Proxima fase

Fase 256 - Formularios e check-ins ponta a ponta. Modelo recomendado: GPT-5.6
Sol com raciocinio `high`; skills `ecc:contract-first`,
`ecc:frontend-patterns`, `ecc:frontend-a11y`, `ecc:e2e-testing` e
`codex-security:validation`; Playwright e Chrome DevTools, com Penpot somente
se a validacao exigir alteracao visual material.
