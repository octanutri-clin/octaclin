# Fase 228 - Onboarding e suporte assistido

Data: 2026-08-13

## Objetivo

Transformar a ativacao comercial definida na Fase 224 em um fluxo operacional
repetivel, seguro e auditavel, desde o provisionamento da clinica ate a
suspensao, reativacao e encerramento.

## Implementacao

- O console `/operacoes` ganhou a area `Onboarding`, exclusiva de SuperAdmin.
- O provisionamento usa uma referencia comercial idempotente. Repetir a mesma
  referencia e slug retorna o tenant existente sem duplicar clinica, plano,
  proprietario ou convite.
- O proprietario recebe papel `Client` e define a propria senha em convite de
  primeiro acesso com validade de sete dias. A senha inicial aleatoria nunca e
  entregue nem conhecida pelo operador.
- A configuracao inicial inclui plano, marca minima, idioma, timezone e canais
  padrao conservadores.
- O ciclo de vida registra ativacao assistida, primeiro uso, acompanhamento de
  48 horas, atividade, suspensao, reativacao, encerramento pendente e
  encerramento.
- A suspensao preserva acesso de leitura e exportacao, mas o status da
  assinatura bloqueia novas operacoes limitadas. A reativacao restaura o plano.
- O encerramento definitivo exige confirmacao e protocolo de exportacao, muda
  o tenant para `encerrado`, desativa usuarios e revoga refresh tokens e
  convites pendentes.
- Todas as mutacoes sao auditadas no tenant administrativo, com ID do tenant
  alvo, estado e protocolo operacional, sem senha, token ou email bruto.

## Banco de dados

A migration aditiva `1720000001027-AdicionarCicloVidaTenants` adiciona em
`tenants`:

- `provisionamento_referencia`, com indice unico parcial;
- `ciclo_vida_status`, com default `ativo` e constraint de estados;
- `encerrado_em`;
- indice operacional por estado e atualizacao.

Ela foi validada primeiro em branch Neon descartavel e depois aplicada ao banco
`Octaclin-db-producao` com `neondb_owner`. O `migration:show` terminou com
40 migrations aplicadas e nenhuma pendente. As tres colunas, a constraint e os
dois indices foram confirmados por leitura de schema.

## Suporte assistido

- `SLA_SUPORTE.md` define o canal temporario, horario, responsavel por funcao,
  primeira resposta e escalonamento P0-P3.
- `RUNBOOK_SUPORTE.md` inclui exercicio obrigatorio com tenant e incidente
  sinteticos, evidencias mascaradas e proibicao de secrets ou dados clinicos.
- `pnpm test:suporte` valida automaticamente a presenca dessas definicoes e
  procura padroes de credenciais nos dois documentos.

## Jornada sintetica

O workflow manual de staging agora tambem:

1. provisiona uma clinica sintetica duas vezes e comprova idempotencia;
2. ativa o proprietario com senha propria e valida o papel `Client`;
3. convida e ativa um profissional e valida seu escopo;
4. cadastra e ativa um paciente com aceites legais;
5. cria consulta, questionario e resposta publica;
6. comprova isolamento contra o tenant administrativo;
7. percorre ativacao, suspensao, bloqueio de nova operacao, reativacao,
   protocolo de exportacao e encerramento;
8. confirma que o tenant encerrado nao aceita novo login.

Nenhum email externo e enviado e a branch Neon e removida ao final.

## Validacao

- Backend: 125 suites e 849 testes aprovados.
- Backend: typecheck e build de producao aprovados.
- Web: typecheck, lint e build Next.js com 120 paginas aprovados.
- Seguranca: scanner local sem secrets e `git diff --check` aprovado.
- Suporte: `pnpm test:suporte` aprovado.
- E2E remoto: execucao `31735238058` aprovada, incluindo migration, runtime
  restrita, RLS, builds, jornadas da Fase 231, jornada da Fase 228 e limpeza da
  branch descartavel.
- Evidencia: https://github.com/octanutri-clin/octaclin/actions/runs/31735238058

## Estado de entrega

- [x] Implementacao e validacao local.
- [x] Migration em ambiente descartavel.
- [x] Jornada sintetica ponta a ponta.
- [x] Migration de producao aplicada e verificada.
- [ ] Merge, deploy e smoke de producao.

A fase somente deve ser marcada como concluida no checklist depois do ultimo
item.
