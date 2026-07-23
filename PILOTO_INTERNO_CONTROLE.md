# OctaClin - Controle do piloto interno controlado

Este arquivo acompanha a execucao do piloto interno descrito em `RUNBOOK_PILOTO_INTERNO.md`. Atualize-o a cada rodada real do piloto. Nao registre dados reais de clientes/pacientes nem secrets aqui.

## Status atual

- Status: em andamento (massa de staging aplicada; jornadas manuais pendentes de execucao humana).
- Rodada: 1.
- Data de inicio: 2026-07-23.
- Data de encerramento: pendente.
- Ambiente: staging (banco unico atual, usado como staging de fato ate a Fase 131 separar producao), tenant `octaclin-staging`.

## Participantes

| Perfil | Responsavel | Contato interno |
| --- | --- | --- |
| Responsavel tecnico | pendente | pendente |
| Cliente | pendente | pendente |
| Profissional | pendente | pendente |
| Paciente | pendente | pendente |
| Suporte/operador | pendente | pendente |

## Checklist de jornadas executadas

- [ ] Cliente convida usuario administrativo e usuario ativa convite.
- [ ] Cliente revisa configuracoes, perfil fiscal e assinatura/uso.
- [ ] Profissional cadastra paciente e registra evolucao clinica.
- [ ] Profissional prescreve plano de acompanhamento e envia material.
- [ ] Profissional agenda consulta com email/WhatsApp/Google Calendar.
- [ ] Profissional remarca e cancela consulta sincronizada.
- [ ] Paciente acessa portal, responde formulario e registra check-in.
- [ ] Paciente consulta notificacoes/tarefas e exporta dados LGPD.
- [ ] Suporte/operador revisa console operacional e central de falhas.
- [ ] Suporte/operador simula atendimento de login/convite.
- [x] `pnpm test:e2e:criticas` executado nesta rodada (2026-07-23, 6/6 testes passaram em desktop e mobile).
- [x] `pnpm seed:staging` aplicado com sucesso em 2026-07-23 (tenant `octaclin-staging`, 5 usuarios, 3 pacientes e demais dados ficticios).

## Registro de bugs

| ID | Data | Perfil/jornada | Severidade | Descricao | Status |
| --- | --- | --- | --- | --- | --- |
| BUG-001 | 2026-07-23 | Aplicacao de `pnpm seed:staging` | P1 | Constraint `usuarios_role_check` (migration `1720000000000-CriarFundacaoOctaClin`) nunca incluia o papel `Client`, impedindo criar qualquer usuario Client em um banco novo criado do zero pelas migrations. | Corrigido (migration `1720000000700-CorrigeConstraintRoleUsuarios`). |
| BUG-002 | 2026-07-23 | Aplicacao de `pnpm seed:staging` | P2 | Fixture `staging-fixtures.json` usava o `profissionais.id` no campo `tarefas[].profissionalId`, mas a coluna real referencia `usuarios.id` (quem criou a tarefa), causando violacao de FK ao aplicar o seed. | Corrigido (fixture ajustado para usar o `usuarioId` do profissional responsavel). |
| BUG-003 | 2026-07-23 | Acesso inicial nao autenticado (`/` -> `/dashboard`) | P1 | `/dashboard` nao estava na lista `ROTAS_PROTEGIDAS` nem no `matcher` do `middleware.ts`, entao qualquer visitante nao autenticado que abrisse a raiz do site (`app/page.tsx` redireciona sempre para `/dashboard`) caia numa tela quebrada com o erro cru `{"mensagem":"Sessao ausente ou expirada."}` em vez de ser levado ao `/login`. A logica de autorizacao (`decidirAcessoRota`) ja tratava `/dashboard` corretamente; faltava so registrar a rota no middleware. | Corrigido (`/dashboard` adicionado a `ROTAS_PROTEGIDAS` e ao `matcher` de `octaclin-web/middleware.ts`). |

## Decisao de aceite

- Status: pendente.
- Criterios de sucesso atendidos: pendente de avaliacao.
- Criterios de bloqueio observados: nenhum ate o momento.
- Decisao: pendente (aprovado / aprovado com ressalvas / reprovado).
- Aprovado por: pendente.
- Data da decisao: pendente.

## Proximo passo

Ambiente local (backend `http://localhost:3001` + web `http://localhost:3000`) no ar apontando para o banco de staging. Testes manuais em andamento: BUG-003 (acesso nao autenticado a `/dashboard`) foi encontrado e corrigido nesta mesma sessao. Falta continuar as jornadas manuais listadas acima, definir participantes internos por perfil, e preencher a tabela de participantes e a decisao de aceite.
