# Fase 242 - Observabilidade interna e rollout seguro

Status: concluida em 2026-08-13.

## Objetivo

Complementar o monitor externo da Fase 220 com sinais internos sanitizados,
controle progressivo de funcionalidades e um procedimento objetivo de
promocao, observacao ou rollback de releases.

## Entregas

- telemetria HTTP em memoria, limitada por instancia, com total, taxa de 5xx,
  p95, rotas agregadas e os 30 traces recentes;
- rotas normalizadas, referencias de requisicao derivadas por hash e ausencia
  de body, query string, email, token ou conteudo clinico nos snapshots;
- leitura de health, release e filas BullMQ de notificacoes, Google Calendar e
  automacoes no console SuperAdmin;
- aba `Rollout` em `/operacoes`, responsiva e com estados de carregamento,
  erro e atualizacao manual;
- feature flags `ia.clinica` e `mobile.sync`, desabilitadas por padrao, com
  precedencia `padrao -> ambiente -> tenant`;
- administracao por tenant restrita a `operacoes.tenants.gerenciar`, registrada
  em auditoria e persistida em `tenant_configuracoes`, sem migration nova;
- guard no backend para toda a IA clinica e para sincronizacao mobile em lote;
- avaliador offline de snapshot sanitizado e gate dedicado no CI;
- runbook com limites, limiares, rollback e procedimento de feature flags.

## Contratos operacionais

O painel sugere `rollback` quando health falha, uma fila fica indisponivel ou
pausada, ou a taxa de HTTP 5xx atinge 5%. Sugere `observar` quando health esta
degradado, a taxa de 5xx atinge 1%, p95 supera 1.500 ms, ha mais de 100 itens
esperando/atrasados, existem falhas historicas retidas ou a configuracao de
flags do ambiente e invalida. Nos demais casos sugere `promover`.

O avaliador de arquivo exige ao menos 50 requisicoes para recomendar promocao.
Falhas retidas pelo BullMQ sao sinal historico e exigem triagem; nao provam,
sozinhas, que o release atual causou a falha.

## Seguranca e privacidade

- somente `SuperAdmin` com as permissoes de operacoes acessa o painel;
- a leitura passa pelo BFF autenticado e a mutacao das flags exige permissao
  tanto no BFF quanto no backend;
- nenhuma flag aceita chave fora da allowlist conhecida;
- JSON de ambiente invalido falha fechado e aparece como atencao operacional;
- a telemetria nao persiste payload e e reiniciada junto com o processo;
- nenhuma credencial ou dado identificavel faz parte da UI, logs ou docs.

## Limites assumidos

A agregacao e local ao processo e usa buffers limitados: 100 rotas, 30 traces e
500 amostras de duracao. Isso e adequado ao piloto com uma instancia e reduz
custo e superficie de dados. Antes de multiplas instancias, os sinais devem ser
agregados em uma plataforma externa ou backend distribuido; somar paineis
locais manualmente nao e um contrato de observabilidade.

## Validacao

- backend: suite completa com 129 suites/862 testes, typecheck e build de
  producao;
- web: lint, typecheck, 35 testes de autorizacao, 8 testes de seguranca
  operacional e build das 122 rotas;
- Playwright: Rollout, LGPD e Assinatura em desktop e mobile, 6/6;
- avaliador: `pnpm test:rollout`;
- verificacao de artefato: `dist/main.js` aprovado;
- migration: nao aplicavel.

## Operacao

Usar `RUNBOOK_PRODUCAO.md` para rollout, feature flags e rollback. O painel e
apoio a decisao: ele nao executa rollback automaticamente e nao autoriza
`migration:revert`, `down`, restore sobre producao ou limpeza de Redis.

## Proxima fase

Fase 241, limitada ao hardening do servico de IA. O Mobile permanece fora da
oferta e desativado ate uma atualizacao suportada do Expo resolver seu grafo de
dependencias.
