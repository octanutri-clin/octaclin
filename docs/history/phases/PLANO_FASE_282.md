# Fase 282 - PB-21: acoes em massa na lista de pacientes

## Escopo e risco

PB-21 segue PB-27 na Onda 5 aprovada. A lista permite selecionar ate 25
pacientes da pagina visivel e registrar, apos confirmacao, um material ou
formulario publicado para todos. Nao ha disparo de email/WhatsApp: o registro
fica disponivel no portal do paciente. Formulario manual continua com validade
de sete dias. Esta fase nao muda a politica de comunicacao.

R4 por receber IDs de pacientes e criar registros associados ao tenant.
O tenant vem do JWT. As rotas exigem as permissoes de gerenciamento do recurso
e de pacientes; a visibilidade do item e de cada paciente e revalidada no
servico, dentro de uma transacao com RLS. Um paciente ausente, arquivado, de
outro tenant ou fora da carteira do Professional cancela o lote inteiro.
Lista vazia, repeticoes, UUIDs invalidos e mais de 25 IDs sao rejeitados pelo
DTO. A auditoria registra item e quantidade, sem lista de pacientes ou conteudo
clinico em metadados. Nenhuma migration, provider externo ou alteracao de
retencao faz parte da entrega.

Skills previstas no audit: context-engineering, test-driven-development,
nestjs-best-practices, typeorm e playwright-best-practices. Revisao da fronteira
tenant em operacoes com IDs relacionados e obrigatoria antes do merge.

## Contrato e aceite

- `POST /materiais/lote`: `{ materialId, pacienteIds }` retorna `{ total }`.
- `POST /questionarios/:id/envios/lote`: `{ pacienteIds }` retorna `{ total }`.
- BFFs autenticados em `/api/materiais/lote` e
  `/api/questionarios/:id/envios/lote` exigem as mesmas permissoes.
- A interface mostra a selecao por paciente e por pagina, escolha de item,
  revisao da quantidade, confirmacao e retorno de sucesso/erro. Se a pagina ou
  filtros mudam, a selecao anterior nao acompanha a nova lista.
- Testes positivos e negativos de servico, typecheck, build, authz do BFF,
  Playwright desktop/mobile e gates do CI da PR. Fixtures apenas sinteticas.

Rollback: reverter a PR remove rotas e interface. Envios ja gravados sao dados
persistentes; nao apagar como rollback. Sem DDL e sem acao em staging/producao.
