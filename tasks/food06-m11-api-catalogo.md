# FOOD06 M11 — API factual do catálogo

## Estado e fronteira

Incremento posterior ao fundamento ff805498, na mesma PR #455 Draft. M11 permanece PENDENTE como macroentrega: API pronta localmente nos critérios abaixo; BFF/interface/prévia/aplicação e jornada completa não entregues. Não altera45,8% administrativos. Individualização por restrições permanece explicitamente bloqueada; M12, direitos/DRI e G06 continuam pendentes/bloqueados.

`POST /planos-alimentares/catalogo/teor-micronutriente/consulta`, HTTP200, Cache-Control private/no-store. Corpo: codigo, porcaoGramas, busca, pagina, limite; filtros opcionais fonteCodigo/versao/baseCodigo. Porção0,001–10.000g até3decimais; termo2–120caracteres não vazio; página1–10.000; limite1–100. Números não aceitam string; nulos/extras/paciente/composição do cliente recusados. Validação DTO e defensiva no serviço. Campos especiais/símbolos/accessors/protótipos inesperados recusados antes da cópia do objeto.

## Arquitetura e autorização

Novo serviço/controlador pequeno para não ampliar o serviço monolítico existente. Reutiliza ExecutorTenant, identidadeBiblioteca e o fundamento/adaptadores/motor PA06. Registrado no ModuloPlanosAlimentares, sem migration/dependência nova. Somente Professional com planos_alimentares.ler e vínculo não arquivado no tenant autenticado. Guardas JWT/papel/permissão e revalidação no serviço; não admite tenant arbitrário, SuperAdmin ou acesso implícito a prontuário. Não consulta pacientes ou dados clínicos.

Alimentos e fonte são resolvidos por SELECT único com JOIN e filtros parametrizados de fonte ativa/direito aprovado. Sem lista de fontes previamente carregada que possa ficar obsoleta antes de consultar o alimento. LIKE escapa barra/%/_. Projeção raw explícita e reconstrução allowlist pelo helper; não retorna ORM, metadados livres, aprovador, referência jurídica ou credenciais. Preparo SQL NULL permanece ausente. Catálogo global existente não recebe nova RLS; vínculo profissional usa FORCE RLS e lock pessimistic_read na transação. Status aprovado é filtro operacional, não prova jurídica; não declara direitos de fontes não comprovados.

## Paginação e consistência

Seleção por nome/ID, OFFSET/LIMIT de limite+1, sem COUNT separado. Só os primeiros limite registros são normalizados; sentinela informa temProxima. Ordem por teor apenas na página, com porção comum e8decimais. Metadados explicitam ordemSelecao=nome_identificador, ordenacaoTeor=somente_pagina e visao=catalogo_atual_sem_snapshot. Não é ranking global. Catálogo pode mudar entre requisições: não há promessa de snapshot ou navegação imutável com OFFSET; duplicação/omissão decorrente de inserção concorrente deve ser explicada pela UI, não ocultada como resultado congelado.

A consulta não grava ou modifica plano, porções, histórico ou snapshots. Revogação/status/composição são resolvidos de novo a cada chamada; uma resposta descreve o snapshot do SELECT, não uma autorização reutilizável para aplicação posterior. Aplicação futura exigirá nova resolução/validação e confirmação.

## RED/GREEN e achado de revisão

- Serviço ainda não integrado:11falhas funcionais/18passes em29testes (RED), depois29PASS. Adicionado1teste de chaves especiais, total30.
- R4 identificou skip/take ignorados por getRawMany com JOIN no TypeORM instalado. PostgreSQL real reproduziu1FAIL/6PASS: segunda página repetia início e temProxima não terminava. Corrigido com offset/limit; join muitos-para-uma fonte não expande os alimentos.
- PostgreSQL/HTTP7/7PASS,0skip após correção; páginas distintas e fim correto, LIKE literal, fonte pendente/revogada/expirada, guardas e DTO, vínculo arquivado/tenant divergente, role sem super/bypass e FORCE RLS.
- Concorrência controlada: barreira depois do lock adquirido pelo serviço real, antes do SELECT; UPDATE de arquivamento em outra conexão falha com lock_timeout55P03; leitura prossegue após liberação. Não é ausência casual de conflito.
- Foco final:100/100 em5suítes (inclui30API/DTO+7PG/HTTP+31helper+32adaptadores/motor).
- Regressões serviço de planos/controlador com30testes API:233/233PASS. Contagens se sobrepõem; não somar como testes distintos.
- Typecheck e build/backend/artifact Node22.21.1 PASS. Tentativas iniciais com erro de caminho/compilação/fixture sem UPDATE para FOR SHARE foram setup, não RED funcional ou vulnerabilidade produtiva.

Comandos reproduzíveis: Jest --config octaclin-backend/package.json --runInBand --runTestsByPath com arquivos consulta-teor-catalogo.integracao.spec.ts, servico-consulta-teor-catalogo.spec.ts, consulta-teor-catalogo.spec.ts, micronutrientes-fonte.spec.ts e micronutrientes.spec.ts. Para PG, FOOD06_CATALOGO_TESTCONTAINERS=true e Docker local; runner usa env sem configurações de banco externo. No backend: tsc --noEmit, nest build e scripts/verificar-artefato-producao.mjs, todos em Node22.

## CI e revisão independente

A suíte nova foi incluída em scripts/test-rls-testcontainers.mjs com opt-in próprio, executado pelo gate Backend existente. Execução local direta acima comprovada; CI do novo HEAD ainda pendente. Não atribuir aprovação do fundamento ff805498 ao novo código.

R4 independente /root/food06_contexto_fundamento_r4: leitura estática de DTO/serviço/spec/controller/módulo, TypeORM instalado, suite PG e runner. Primeiro parecer bloqueou paginação; após correção, favorável ao escopo API genérica sem novo bloqueador. Não executou testes/banco. Revisor também confirmou as limitações abaixo.

## Limites e próximos passos

Schema PG representativo mínimo, não cadeia completa de migrations. JWT substituído por identidade sintética no teste HTTP; guardas papel/permissão, serviço, SQL e RLS reais. Role runtime só SELECT no catálogo; UPDATE em profissionais necessário para FOR SHARE no fixture, sem concessão em ambiente externo. Não comprova configuração de produção ou direitos comerciais. Teste de revogação cobre consultas sucessivas, não revogação após snapshot do SELECT.

UX A anterior preservada no relatório FOOD06-M11-A-2026-11-06: lote/porção/nutriente explícitos, desconhecido separado de zero e fonte/preparo preservados. B/C, browser, leitor de tela e revisão humana NOT RUN por ausência da interface. BFF não implementado; M11 não concluída.

Próximo: BFF autenticado com corpo limitado, projeção sanitizada, erros genéricos e testes de negação; depois UI genérica com estados, paginação/limites claros e resposta tardia protegida. A consulta não presume adequação ao paciente. Prévia/aplicação reutilizarão os contratos existentes, sujeitas a fontes e revisões atuais. Individualização continua bloqueada pelo contrato de restrições não validado.

Rollback: retirar registro do controller/provider e os arquivos novos; sem alteração persistida/migration. Sem merge/deploy/migrations externas ou mudança de Render/Neon.
