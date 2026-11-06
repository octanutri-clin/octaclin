# FOOD06 — captura de contexto confirmado (fundamento)

## Estado vigente — 2026-11-06

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
