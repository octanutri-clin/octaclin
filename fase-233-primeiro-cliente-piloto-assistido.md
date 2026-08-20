# Fase 233 - Primeiro cliente piloto assistido

## Objetivo

Executar uma unica ativacao real, controlada e reversivel, com acompanhamento
de 48 horas. Esta fase nao e uma autorizacao automatica de comercializacao: a
decisao `GO` so existe quando todos os gates externos e operacionais estiverem
registrados.

## Estado em 2026-08-20

`NO-GO`. A preparacao tecnica e o aceite visual da biblioteca de receitas da
Fase 234 estao concluidos, e backend/web responderam `200` apos o deploy manual
no Render. Permanecem pendentes, sem excecao:

- cliente piloto selecionado e escopo comercial definido;
- dominio, identidade publica e identidade de envio oficiais;
- revisao juridica das minutas, versoes finais publicadas e contrato/aceites;
- responsaveis da janela e canal externo de contingencia;
- decisao GO/NO-GO registrada no dia da ativacao.

Nenhum nome, email, telefone, identificador de tenant, dado clinico ou segredo
deve ser anotado neste arquivo. O controle real usa somente referencias internas
de acesso restrito.

## Preparacao antes de escolher a data

- [ ] Registrar referencia interna do cliente e escopo do piloto fora do Git.
- [ ] Confirmar contrato, termos, politica e consentimentos finais fora do Git.
- [ ] Confirmar dominio, SSL e remetente transacional oficiais.
- [ ] Nomear executor tecnico, atendimento e observador para a janela.
- [ ] Definir canal de contingencia independente do OctaClin.
- [ ] Escolher janela de terca a quinta, 09:00-11:00, `America/Sao_Paulo`.
- [ ] Congelar mudancas nao relacionadas a partir de T-24h.

## Gate de execucao

Usar `RUNBOOK_LANCAMENTO.md` e `OPERACAO_LANCAMENTO_CONTROLE.md` como fontes
operacionais. No T-24h e T-30min, todos os itens devem ser marcados e a decisao
precisa ser `GO` explicita do responsavel primario. Qualquer pendencia gera
`NO-GO`, sem atalho por necessidade comercial.

Durante a ativacao, limitar a janela a um tenant, um cliente e dados minimos.
WhatsApp, Mobile e IA permanecem fora da oferta inicial. Registrar somente
evidencias sanitizadas: commit, checks, horarios, referencias internas e
classificacao de incidente, quando houver.

## Aceite da fase

Somente concluir depois de 48 horas quando:

1. nao houver P0/P1 aberto;
2. onboarding, login por papel, agenda interna, formulario e email controlado
   tiverem evidencias de funcionamento;
3. backup, monitoramento e contingencia tiverem sido observados na janela;
4. o responsavel declarar uma unica decisao: expandir, corrigir ou pausar;
5. o resultado sanitizado estiver registrado nos documentos vivos, sem dados
   pessoais ou clinicos.

## Referencias

- `RUNBOOK_LANCAMENTO.md`
- `OPERACAO_LANCAMENTO_CONTROLE.md`
- `CHECKLIST_GO_LIVE.md`
- `fase-232-operacao-lancamento.md`
- `fase-133-checklist-juridico-comercial.md`
