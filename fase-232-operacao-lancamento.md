# Fase 232 - Operacao de lancamento

Data: 2026-08-13

## Objetivo

Preparar uma operacao repetivel e segura para o primeiro cliente piloto, com
janela controlada, papeis, gates GO/NO-GO, monitoramento, rollback,
comunicacao e exercicio de incidente sintetico.

## Entrega

- `RUNBOOK_LANCAMENTO.md` concentra o procedimento da janela e das 48 horas.
- `OPERACAO_LANCAMENTO_CONTROLE.md` registra responsaveis, gates e evidencias.
- `scripts/operacao-lancamento.mjs` torna deterministicas a decisao de gate, a
  classificacao P0-P3 e a simulacao de rollback.
- `scripts/test-operacao-lancamento.mjs` protege o contrato operacional.
- O CI executa o gate `Operacao de lancamento` sem secret ou acesso externo.

## Exercicio sintetico

O cenario `EX-SINTETICO-F232-001` simulou readiness 503 imediatamente apos um
deploy backend. A equipe pausou o onboarding, classificou P0, decidiu rollback
do deploy sem reverter migration, exigiu duas leituras saudaveis e encerrou a
comunicacao em 34 minutos. Nenhum dado ou ambiente real foi usado.

## Limites

- Esta fase prepara a operacao, mas nao libera cliente real.
- A decisao atual permanece NO-GO ate revisao juridica, identidade publica e
  dominio, selecao do cliente e preenchimento dos responsaveis da janela.
- WhatsApp permanece fora da oferta inicial; Mobile e IA dependem da Fase 241.
- O registro real da janela e das 48 horas pertence a Fase 233.

## Validacao

- [x] Contrato automatizado da operacao aprovado.
- [x] Exercicio sintetico aprovado.
- [x] Monitor de producao executado em modo somente leitura: readiness,
  dependencias e web saudaveis na primeira tentativa em 2026-08-13.
- [x] Preflight documental e scanner de secrets aprovados.
- [ ] CI remoto aprovado e documentacao viva atualizada.
