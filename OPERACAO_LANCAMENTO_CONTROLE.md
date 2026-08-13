# OctaClin - Controle da operacao de lancamento

Atualizado em 2026-08-13. Este arquivo nao deve conter credenciais, dados de
paciente, telefone, email pessoal ou payload clinico.

## Responsaveis

| Funcao | Responsavel | Estado |
| --- | --- | --- |
| Responsavel primario | Octavio, titular da operacao OctaClin | confirmado para preparacao |
| Executor tecnico | registrar nome antes da janela real | pendente da Fase 233 |
| Atendimento | registrar nome antes da janela real | pendente da Fase 233 |
| Observador do gate | registrar nome antes da janela real | pendente da Fase 233 |

## Janela do piloto

- Padrao aprovado: terca a quinta, 09:00-11:00, `America/Sao_Paulo`.
- Data concreta: definir ao selecionar o primeiro cliente na Fase 233.
- Acompanhamento: 48 horas apos a ativacao.
- Congelamento de mudancas: T-24h ate o encerramento da janela.

## Decisao atual

`NO-GO` para cliente real. A operacao tecnica esta preparada, mas a janela
continua bloqueada ate revisao juridica, identidade publica/dominio e selecao do
cliente piloto. WhatsApp, Mobile e IA nao fazem parte da oferta inicial.

## Checklist T-24h

- [ ] Cliente piloto e escopo confirmados.
- [ ] Contrato e consentimentos confirmados.
- [ ] Identidade publica e dominio liberados.
- [ ] Executor tecnico, atendimento e observador confirmados.
- [ ] Commit candidato e CI registrados.
- [ ] Backup/restore recente confirmado.
- [ ] Zero incidentes P0/P1.
- [ ] Congelamento de mudancas iniciado.

## Checklist T-30min

- [ ] Monitor externo executado e saudavel.
- [ ] Readiness, dependencias e web saudaveis.
- [ ] Nenhuma migration ou deploy em andamento.
- [ ] Filas/outbox dentro da janela operacional.
- [ ] Canal externo de contingencia confirmado.
- [ ] Decisao GO/NO-GO registrada pelo responsavel primario.

## Exercicio sintetico

| Campo | Resultado |
| --- | --- |
| ID | `EX-SINTETICO-F232-001` |
| Cenario | readiness 503 apos deploy backend |
| Dados reais | nao |
| Classificacao | P0 |
| Deteccao | 3 min, limite 10 min |
| Pausa e comunicacao inicial | 10 min, limite 15 min |
| Decisao | rollback de deploy em 14 min, limite 20 min |
| Recuperacao | deploy anterior e duas leituras saudaveis em 31 min |
| Encerramento | comunicacao em 34 min; post-mortem obrigatorio |
| Resultado | aprovado em 2026-08-13 |

O exercicio foi inteiramente deterministico e sintetico. Nao abriu incidente
real, nao alterou Render/Neon/Redis e nao enviou comunicacao externa.

## Registro da janela real

Preencher somente na Fase 233:

| Campo | Valor |
| --- | --- |
| Data e horario | pendente |
| Cliente/tenant | referencia interna pendente |
| Commit candidato | pendente |
| CI | pendente |
| Monitor | pendente |
| Backup | pendente |
| Decisao inicial | pendente |
| Resultado 2h | pendente |
| Resultado 48h | pendente |
| Incidentes | pendente |
| Decisao expandir/corrigir/pausar | pendente |
