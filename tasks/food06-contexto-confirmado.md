# FOOD06 — captura de contexto confirmado

## Estado vigente — integração backend 2026-11-06

Base39ffdaddfcfc8cc691db695ed17ba280ec9842eb com CI42216708582 success (não valida o delta seguinte). Campo opcional confirmacoes integrado à captura HTTP existente. Referências DRI continuam indisponíveis; projeções públicas/relatório ainda não apresentam o novo contexto. Sem UI nova ou encerramento da melhoria. PR455 Draft;45,8% administrativos.

- DTO/controlador/serviço aceitam somente confirmações estritas; null, data/nascimento/elegibilidade extras e tipos inválidos falham fechados. Ausência conserva comandos e registros legados.
- Na transação existente: papel/permissões -> carteira/profissional/paciente -> chave idempotente -> fonte/revisão/ativação/seleção -> contexto server-side. Nenhuma transação aninhada, retry cego ou contexto do navegador.
- Confirmações canônicas entram na confirmação operacional cifrada v2, vinculadas à origem e seleção exatas. Conteúdo construído congela contexto resolvido/data/idade/motivos, sem persistir nascimento bruto. Auditoria permanece vazia de conteúdo clínico.
- Mesma chave com confirmação, seleção, idade efetiva ou dia clínico diferentes retorna409. Exigir nova conferência/chave para operação nova; não reaproveitar confirmação de mesmo dia após mudar seleção. Não regravar registro para acomodar retry após meia-noite.
- Leitores/envelopes/snapshots existentes preservados. Não houve migration runtime, schema externo ou permissões novas. A fixture PG foi ampliada só no teste (nascimento/configuração do tenant com FORCE RLS); não é alteração de migration nem prova da cadeia completa.

### TDD e regressão específica

RED HTTP funcional1FAIL/19PASS: confirmações válidas retornavam400. RED PostgreSQL1FAIL/42PASS: serviço rejeitava campo novo; tentativa prévia de compilar teste com literal inline incompatível foi erro de setup, não RED. Após integração, GREEN inicial92/92 foco e43/43PG.

A ampliação de concorrência encontrou RED real (1FAIL/43PASS): com nascimento nulo, findOne selecionando somente essa coluna pode hidratar null apesar da linha existir. Corrigido select interno para id+nascimento e expectativa unitária atualizada. O ID não entra na resposta de contexto. Isso demonstra a limitação do mock inicial e da revisão estática, sem ocultar a regressão descoberta.

GREEN final:92/92 em3suítes (HTTP20, fundamento22, leitor50) e PostgreSQL15 Testcontainers44/44,0SKIPPED. PG usa role runtime não owner/nobypass e FORCE RLS; inclui rota HTTP real com confirmações desconhecidas, transferência negando cada leitura, registro cifrado, replay, mudanças de confirmação/seleção/cadastro/dia, ciphertext imutável, quatro reenvios concorrentes com e sem contexto e rollback de auditoria. Nascimento ausente produz motivo próprio e mantém registro factual. Teste de dia distinto espiona exclusivamente a data civil do helper; fronteiras reais de timezone são provas unitárias anteriores, não relógio independente no PG.

Typecheck backend e buildNest finais PASS Node22.21.1; verificador dist/main.js PASS. Diff-check e scanner local executados antes do envio. Backend completo/CI do novo delta e matriz BFF/UI/PA07 contextual: ainda NOT RUN localmente; não herdar o verde da base. Backend sem script/config ESLint neste checkout, como registrado no fundamento.

### Revisão e limites

Revisão independente /root/food06_contexto_fundamento_r4 reavaliou estaticamente integração e correção de hidratação: favorável, sem novo achado concreto. Somente leitura, sem testes/SQL próprios; reconheceu que não antecipou comportamento de hidratação demonstrado no PG. Não é R4 integral FOOD06, revisão clínica ou prova de produção. UX A anterior preservada; B/C da interface contextual NOT RUN porque ainda não existe tela.

### Próxima ação exata

Após enviar este checkpoint e acompanhar seu CI: preparar projeção mínima versionada do contexto e integrar confirmações à captura no console/BFF, com limpeza por paciente/seleção, revisão UX B, cancelamento/PA07 e provas próprias. Não ativar números DRI. Resolver direitos/fontes continua gate separado. Rollback técnico deste incremento: leitores anteriores já leem o contexto resolvido v1; remover aceitação do campo opcional pode fazer clientes novos receberem400, mas não requer apagar registros ou desfazer schema. Não há UI nova neste checkpoint. Sem merge/deploy/migrations externas.

---

## Checkpoint histórico — fundamento 2026-11-06

Base remota7abb1c99405fdd625d67d33e8caa766148d11d34 confirmada com CI42137723558 concluído success. Backend, Web, Demo smoke e PR Gate PASS; Provenance do SBOM SKIPPED. PR455 Draft e HEAD sincronizado. A cópia antiga em /tmp desapareceu no reinício; nenhum trabalho enviado foi perdido. Checkout recuperado do remoto sem modificar main ou o next-env.d.ts preexistente.

## Menor escopo R4

Novo fundamento interno contexto-confirmado-registro.ts: valida sete confirmações explícitas por allowlist, sem inferir valores. Rejeita nascimento/data/idade/elegibilidade/tenant enviados junto às confirmações, extras/símbolos/accessors/protótipos não permitidos. O carregador seleciona somente nascimento do paciente por id+tenant+não arquivado, com lock, e obtém data civil pela configuração efetiva do tenant usando helpers canônicos. Não grava, não retorna HTTP e não registra dados em logs.

**Ainda não integrado a serviço, DTO, BFF ou UI.** O helper não autoriza paciente nem substitui carteira. O futuro chamador deve autorizar e bloquear a carteira na mesma transação antes de utilizá-lo. Nascimento só compõe entrada interna do domínio; nunca deverá ir à projeção pública. Sem schema/dependências novos, sem mudanças nos envelopes ou registros antigos. Rollback do fundamento: retirar os módulos ainda sem chamadores, sem migração ou reescrita de dados.

## Evidências

- RED funcional com stub compilável:22testes,18PASS/4FAIL por falta do comportamento válido. Não se contou falha de setup como RED.
- GREEN:75/75 em3suítes (22novos + regressões do contexto e timezone), Node22.21.1. Fronteira sintética em2026-11-06T01:00Z: São Paulo data05/11,18anos; Tóquio data06/11,19anos. Cobertura de enumerações, desconhecidos, nascimento ausente, paciente indisponível, propriedades especiais/accessors e escopo da consulta.
- Typecheck backend PASS Node22.21.1; sintaxe/compilação dos módulos coberta pelo Jest/tsc. Backend não possui script/configuração ESLint neste checkout: tentativa inicial de invocar eslint local retornou MODULE_NOT_FOUND, não é falha funcional nem lint PASS. Não instaladas dependências para isso.
- Revisão independente estática /root/food06_contexto_fundamento_r4 favorável, sem achado concreto bloqueador. Não executou testes/SQL/browser; não comprova locks reais/RLS/HTTP.
- UX A textual por subagente com papel fornecido /root/food06_contexto_ux_a; sem ferramentas/teste visual. PacienteN/A: sem portal, prescrição ou documento entregue alterado. Ver relatório próprio.
- PostgreSQL/RLS, integração HTTP de confirmações, builds e CI deste novo delta: NOT RUN antes do envio. Resultados do CI da base não validam o novo código.

## Próxima etapa obrigatória

1. Integrar opcionalmente o contrato estrito à captura existente, mantendo leitores antigos e confirmações ausentes. Validar a carteira antes de selecionar nascimento.
2. Vincular confirmações à origem/revisão/seleção exatas e à identidade idempotente cifrada; proteger mudanças de confirmação, cadastro, fuso e seleção. Não reaproveitar confirmação de mesmo dia em seleção nova.
3. Definir retries entre dias clínicos: preservar contexto efetivo original ou rejeitar conflito explicitamente com nova conferência; nunca recalcular silenciosamente um registro já salvo. Adquirir locks na ordem já usada pelo serviço; provar com PostgreSQL descartável/runtimeRLS.
4. Confirmar projeção mínima versionada, limpar confirmações ao mudar paciente/seleção e testar BFF/UI/PA07. Referências DRI continuam bloqueadas, inclusive se contexto elegível.
5. Executar revisão R4 da integração, UX B/C quando houver interface e gates específicos. Não declarar fundamento como funcionalidade pronta.

Checkpoint enviado em incremento menor conforme nova orientação do proprietário para preservar trabalho remoto; manter PR455 Draft, sem merge, deploy, migrations externas ou infra. FOOD06 permanece45,8% administrativos, M01–M12 sem fechamento adicional.
