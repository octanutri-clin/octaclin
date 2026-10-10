# Fase 311 — checklist de implementação

Plano autoritativo: `docs/history/phases/PLANO_FASE_311.md`.
Handoff corrente: `tasks/plan.md`. Branch `feature/fase-311-ativacao-conteudo`.

## Estado atual da execução (2026-10-10)

- Implementação dos passos 1–5 concluída; sem migration nova.
- PASS: backend Jest integral, PostgreSQL/Testcontainers/RLS 25/25, BFF novo
  5/5, Playwright da Fase 311 em Client/Operações desktop/mobile 4/4, scanner
  de secrets e governança descritos em `tasks/plan.md`.
- PASS: CI principal pós-merge da Fase 310 `38016413569`.
- PASS: backend build/typecheck, Web typecheck/build e demo local smoke
  (`smoke-e2e-bff-ok`, API demo sintética).
- PASS: suíte ampla Web `test:authz`, harness BFF dedicado da Fase 311 5/5 e
  validação final dos documentos/diff.
- PASS: branch publicada e PR #389 aberta; CI começou a executar.
- Ainda abertos: CI da PR e revisão independente R4 quando viável. Nenhuma
  ação de produção executada.

As seções abaixo preservam os critérios detalhados de aceite da implementação;
o estado corrente acima e em `tasks/plan.md` prevalece sobre os checkboxes do
plano inicial.

## 0. Assumir a tarefa

- [x] Confirmar merges 309/310 e base `eb7f2aad`; criar worktree isolada.
- [x] Ler regras, contratos, código do kit/catálogos e mapear gaps.
- [x] Fechar cinco decisões do proprietário, incluídas no plano.
- [ ] Reconfirmar branch/status/diff/log, GitHub e ausência de outro escritor.
- [ ] Ler AGENTS raiz/pacotes e plano completo; usar Node 22 e pnpm do
  `packageManager` com install congelado se necessário. Não criar arquivos
  `.env` reais nem executar seed/migration fora de banco descartável.
- [ ] Declarar R4; manter implementação nesta branch/PR, sem refactor paralelo.

## 1. Conteúdo, parser e instalador compartilhados

Dependência: decisões fechadas. Resultado: seleção incremental e legado seguro.

- [ ] Introduzir cinco chaves estáveis e versão 2 em `tenancy/kit-inicial-clinica.ts`;
  manter conteúdo factual da 297. Mover helper de Operações para
  `tenancy/aplicacao/kit-inicial-clinica.ts`, sem duplicar lógica.
- [ ] Parser puro para marcador ausente, legado 1 completo, versão 2 parcial/
  completa, desconhecido e inconsistente. Não converter legado via backfill.
- [ ] DTO compartilhado: confirmação literal, versão 2, array único de 1–5
  chaves conhecidas; recusar campo extra, vazio, duplicata, chave inválida,
  versão incorreta e confirmação falsa/ausente. Validar também no serviço.
- [ ] Sob lock advisory por tenant: ler marcador, calcular diferença/união,
  criar só materiais novos, habilitar só estruturas escolhidas, gravar marcador
  preservando id/data inicial. Se nada novo: nenhuma escrita/auditoria.
- [ ] Atualizar provisionamento: criação instala as cinco chaves/versão 2;
  reuso não instala/complementa. Falha do kit aborta provisionamento inteiro.
- [ ] Atualizar `ServicoModelosPlanoAlimentar.listar`: versão 1 ambas estruturas,
  versão 2 só selecionadas, inválido/desconhecido nenhuma; preservar total de
  modelos, filtros de carteira/tenant e alimento obrigatório ao salvar.
- [ ] Jest novo do helper/parser; regressão nos specs existentes de
  `servico-ciclo-vida-tenant` e `servico-modelos-plano-alimentar`.

Aceite: instalação só de estrutura não grava material/modelo; complemento não
duplica; título manual igual é preservado; desativado/editado não é recriado;
marcador legado não muda e não reinserta nada. Testar falha em cada escrita.

## 2. Serviço de aplicação e APIs dos dois papéis

Dependência: passo 1. Resultado: mesmos contratos nas duas entradas autorizadas.

- [ ] Implementar `tenancy/aplicacao/servico-kit-inicial-clinica.ts`, provider/
  export de ModuloTenancy; clientes e operações injetam o mesmo serviço.
- [ ] Revalidar papel/permissão/autor ativo no tenant da identidade. Client só
  próprio tenant; SuperAdmin escolhe alvo existente sob permissão de operações.
  Aplicar contexto RLS alvo na mesma transação somente após autorizar.
- [ ] Revalidar tenant/ciclo de vida/assinatura antes de POST. Falta de
  permissão: 403; alvo autorizado inexistente: 404; DTO: 400; marcador ou
  bloqueio operacional: 409; sucesso/reutilizado: 200. Não vazar existência
  de outro tenant a Client nem stack/erro de banco.
- [ ] Auditabilidade atômica via `registrarAuditoriaNaTransacao` se houve adição:
  alvo correto, ator real, versão/contagens/origem/chaves públicas; sem títulos,
  conteúdo ou detalhes de conta. Falha de auditoria aborta a instalação.
- [ ] GET/POST `/cliente/kit-inicial` em ControladorPortalCliente, papel Client,
  `cliente.configuracoes.gerenciar`; resolver alvo a partir do usuário.
- [ ] GET/POST `/operacoes/tenants/:id/kit-inicial` em ControladorOperacoes,
  SuperAdmin, `operacoes.tenants.gerenciar`, UUID. Sem instalação em lote.
- [ ] DTO mínimo/no-store; sem entidade ORM, autoria cruzada exposta na prévia
  ou leitura da biblioteca personalizada pelo Client.
- [ ] Specs positivos/negativos de serviço/controladores: Client A próprio alvo;
  Client A alvo B mesmo que obtenha UUID; Patient/Professional/Collaborator;
  SuperAdmin sem permissão; actor desativado/papel alterado; SuperAdmin A alvo B
  permitido com autoria real; alvo bloqueado/desconhecido; marcador corrompido.

Aceite: Client não controla autor/tenant; SuperAdmin não se faz passar pelo
Client. Mesmos itens/resultados pelas duas entradas. Sem outbox/envio paciente.

## 3. Disponibilidade dos catálogos globais

Dependência: contratos de dados existentes, independente das escritas do kit.

- [ ] Criar `operacoes/aplicacao/servico-disponibilidade-catalogos.ts` e spec;
  registrar em ModuloOperacoes. GET `/operacoes/catalogos-alimentares/disponibilidade`
  com papel/permissão e no-store conforme plano.
- [ ] Consultar as quatro identidades exatas (TACO, Foundation, SR Legacy, IBGE),
  incluindo ausentes; agregados por fonte/importação sem multiplicação por joins.
- [ ] Validar estado ativo/direito/importação concluída/identidade e total
  consistentes/alimento utilizável. Base > 0 e campos essenciais finitos >= 0;
  SQL deve excluir NaN/Infinity, não só `>= 0`. Fibra/sódio são opcionais.
- [ ] Resumo considera todas as versões; máximo dez edições por base na
  projeção, com total/truncamento visível. Não comparar versão como número.
- [ ] Tentativa recente falha/em execução vira aviso separado; edição ativa
  anterior permanece disponível. Não expor erro_sanitizado/executor/manifesto/
  URLs/hashes/referência privada. Falha da consulta é erro, nunca sucesso vazio.
- [ ] Testes: quatro ausentes; uma USDA só; ativa sem alimento; direitos
  inválidos; suspensa/revogada/em validação; importação incompleta/divergente;
  nutrientes incompletos/zero/NaN; contagens com múltiplas tentativas;
  histórico ativo + atualização falhou; edição utilizável fora das dez visíveis;
  identidade/base inesperada não preenche cartão esperado; erro SQL sanitizado.

Aceite: pendência visível por fonte, sem bloquear kit/provisionamento, sem
escrever catálogo ou afirmar validação clínica/integridade criptográfica nova.

## 4. BFFs e clientes de API

Dependência: passos 2/3. Resultado: acesso pelos wrappers atuais de sessão.

- [ ] BFFs `/api/cliente/kit-inicial`, `/api/operacoes/tenants/[id]/kit-inicial`,
  `/api/operacoes/catalogos-alimentares/disponibilidade` com permissões, UUID,
  no-store, erros sanitizados e contratos GET/POST. Consultar guias da versão
  instalada do Next antes de alterar APIs dinâmicas do framework.
- [ ] API do kit em lib/cliente-api.ts ou lib/kit-inicial-clinica-api.ts;
  operações aproveitam lib/onboarding-operacoes-api.ts. Tipos iguais ao backend.
- [ ] Harness BFF novo seguindo os scripts existentes, incluído em
  `test:authz`: sem sessão, sessão sem permissão, UUID/body inválidos, 409,
  sessão expirada/renovação e falha de transporte. Testar origem de POST pelo
  controle do middleware/seguranca-bff existente.
- [ ] Confirmar rotas novas cobertas pelos gates de guardas e redação de
  auditoria; não enfraquecer catalogo de autorização ou scanner para passar CI.

## 5. Interfaces, demo e regressão visual

Dependência: passo 4. Resultado: gestor/SuperAdmin selecionam sem efeito implícito.

- [ ] Componente de seleção reutilizável com estado de código autorizado,
  preview dos cinco itens, instalados separados, seleção dos pendentes,
  seleção total pendente, confirmação, parcial/completo/bloqueado e retry.
- [ ] Client: card na aba Ativação de `/cliente`, com permissão de configuração;
  não inserir guia clínico para Client nem conceder leitura de planos/materiais.
- [ ] SuperAdmin: ação por clínica no onboarding de Operações, confirmação do
  alvo e itens; trocar alvo limpa seleção e protege contra respostas atrasadas.
- [ ] Catálogos: seção global do ambiente em onboarding, quatro bases,
  data da verificação, pendências/tentativa e “Não foi possível verificar”;
  retry explícito. Sem botão de carga ou segredo de configuração.
- [ ] Atualizar `octaclin-backend/scripts/api-demo-local.mjs` para novas rotas
  Client/Operações, estado por tenant, seleção incremental e marcador legado.
  Cobrir as duas identidades nos mocks sintéticos da UI. Não importar cenário
  de clínica real nem fazer fallback silencioso para endpoint inexistente.
- [ ] Playwright novo `tests/visual/fase-311-ativacao-conteudo.spec.mjs`:
  selecionar/cancelar/confirmar; apenas estrutura; parcial/complemento/retry;
  completo legado; Client sem permissão; SuperAdmin escolhe clínica/troca alvo;
  catálogo ausente e erro; nenhum bloqueia kit. Desktop/mobile, axe/reflow/foco.
- [ ] Regressão `portal-cliente.spec.mjs`, kit/editor/prontuário da 297 e
  smoke BFF/demo. Mocks distinguem bibliotecas/tenants; não mascarar autorização.

## 6. Prova PostgreSQL e gates de implementação

Dependência: implementação/testes dos passos anteriores.

- [ ] Estender `rls-isolamento-tenant.integracao.spec.ts` no banco descartável
  do harness atual: duas primeiras instalações iguais; subconjuntos
  sobrepostos simultâneos Client/SuperAdmin; complemento sem perda da união;
  tenants concorrentes independentes; Client cruzado negado; SuperAdmin cruzado
  autorizado/ator real; marcador1 legado; rollback de materiais/marcador/auditoria;
  pool sem contexto tenant residual após commit/erro.
- [ ] Provar consulta de catálogos em PostgreSQL com fixtures owner e role de
  leitura sem ownership/BYPASSRLS. Criar/restringir role sintética SELECT-only
  para catálogos; o harness tenant concede DML geral para outra finalidade e
  isso sozinho não prova runtime de catálogo somente leitura. Não alterar
  grants de produção nem simular composição contra bancos operacionais.
- [ ] Backend: Jest focado dos serviços/helper/parser/controladores e specs
  297; integral, typecheck/build, Testcontainers/RLS real. Sem Docker/banco
  descartável: SKIPPED com motivo e gate continua pendente.
- [ ] Web: harness novo e test:authz, lint/typecheck/build, Playwright
  desktop/mobile/acessibilidade e smoke demo. Node 22, pnpm do manifest.
- [ ] Governance: confiabilidade, guardas, redação da auditoria, documentação,
  scanner de secrets e git diff --check. Sem número de migration reservado.
- [ ] Rever diff, obter revisão R4 independente quando viável e registrar
  quando ausente/não independente. Abrir a PR da implementação nesta branch.
- [ ] CI completo, especialmente Backend, Governança, Web, Demo local smoke,
  PR Gate e scanners; SKIPPED explícito. Corrigir causa antes de repetir CI.

## 7. Documentação e fechamento

- [ ] Atualizar evidências/plano/handoff/status/roadmap/checklist/resumo e
  matriz no mesmo PR da implementação, distinguindo código, merge e operação.
- [ ] Atualizar runbook: conferência por fonte no ambiente identificado,
  limites do diagnóstico, cargas separadas, checagem de role owner antes de
  execução deliberada e limite de validação de role do carregador TACO atual.
- [ ] Rollback: preservar materiais/marcadores; código anterior oculta estruturas
  de marcador2, sem convertê-lo em marcador1. Não remover itens/auditoria.
- [ ] Não executar envio externo, carga de catálogo, migration operacional ou
  deploy como consequência desta tarefa. Gate de produção requer evidência
  própria. Próxima fase de produto após integração: 312, documentos clínicos.
