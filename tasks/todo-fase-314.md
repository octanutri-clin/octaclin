# Sequência futura — Fase 314

Estado: planejamento. Tarefas de implementação **não iniciadas**. G01/G02 do
[plano](../docs/history/phases/PLANO_FASE_314.md) devem preceder algoritmos.
R4; um escritor ativo, uma PR de entrega. Nenhuma troca de modelo automática.

## T01 — Fechar referência computacional (G01)

- [ ] Fonte/versionamento/lookup/caudas/flags/precisão definidos; coeficientes
  neonatais oficiais suficientes e condições de uso/atribuição conferidos.
- [ ] Resolver 60/61 meses, 19 anos e 64s0d/64s6d; não extrapolar dados.
- Verificação futura: manifesto, tabela completa/intervalos e exemplos
  publicados independentes; não executar calculadora externa com PHI.
- Dependência: respostas clínicas. Arquivos: ficha, manifesto, plano (3).

## T02 — Ratificação da ficha (G02)

- [ ] Equipe ratifica população neonatal, correção/transição, quatro indicadores,
  técnica/ajuste, estatística/flags e fórmulas adultas 18–19; versão registrada.
- [ ] Confirmar autorização de implementação/testes e o handoff vigente.
- Verificação: confirmação humana específica e pendências explicitadas.
- Depende: T01. Arquivos: ficha, plano/handoff, checklist (até 4).

## Checkpoint A — Antes do classificador

- [ ] G01/G02 concluídos, decisões sem ambiguidades e tarefas autorizadas.
- [ ] Base Git/PR/1068 reconfirmada; registro de limites operacionais.

## T03 — Idade civil e roteamento de referência

- [ ] Idade em dias/método mensal ratificado; nunca idade em anos arredondada.
- [ ] Aplicabilidade por indicador, gestação/prematuridade/bases, sem fallback
  adulto; dados ausentes produzem motivos definidos.
- Verificação futura: Jest datas/bissexto/DST/bordas; nenhum relógio implícito.
- Depende: T02. Arquivos novos: `dominio/idade-pediatrica.ts/.spec.ts`,
  `dominio/contexto-pediatrico.ts`, `dominio/aplicabilidade-pediatrica.ts/.spec.ts` (5).

## T04 — Referências OMS offline

- [ ] Artefatos normalizados determinísticos, 16 fontes/hashes/grades/unidades,
  sem transcrição manual e sem dependência de rede em runtime.
- [ ] Conferência de planilha interna WFA mesmo quando nome externo é HFA.
- Verificação futura: integridade/grade/transcrição e fixtures independentes.
- Depende: T01/T02. Arquivos: dados por família, loader/manifesto, spec (até 5
  por subtarefa: separar OMS2006 e OMS2007 em commits sequenciais).

## T05 — IMC/idade OMS completo

- [ ] LMS, L=0, caudas válidas, percentil permitido e rótulos ratificados.
- [ ] IMC bruto/classificação/exibição distintos; adaptação SISVAN 19 anos
  preserva idade real e sinaliza referência efetiva.
- Verificação futura: Jest limites/escores/caudas e exemplos publicados.
- Depende: T03/T04. Arquivos: `dominio/lms-pediatrico.ts/.spec.ts`,
  `dominio/antropometria-pediatrica.ts/.spec.ts` (4).

## T06 — Gravar e ler snapshot de IMC/idade

- [ ] Contexto validado/confirmado e snapshot cifrado; DOB divergente pede
  conferência; replay durável/idêntico/divergente conserva contrato da 313.
- [ ] Resposta/histórico mostram classificação ou motivo; sem recálculo legado.
- Verificação futura: DTO/serviço positivos/negativos; PG real do snapshot.
- Depende: T05. Arquivos: `dtos-pediatricos.ts`, `dtos.ts`,
  `servico-pacientes.ts`, `servico-pacientes.spec.ts`, `prontuario-api.ts` (5).

## Checkpoint B — Vertical IMC persistida

- [ ] Cálculo/persistência/contrato e regressões adulto/idoso/313 passam.
- [ ] Sem campos sensíveis novos em auditoria/portal/metadata.

## T07 — Comprimento/estatura por idade

- [ ] Técnica original e normalizada, ajuste 0,7 cm explícito; borda 730/731
  e salto da referência tratados sem dupla correção.
- [ ] Sem sexo/técnica/base aplicável: ausência apenas nos indicadores afetados.
- Verificação futura: medianas/bordas/técnicas/ajuste reversível no snapshot.
- Depende: T06. Arquivos: contexto, classificador/spec, DTO/spec (até 5).

## T08 — Peso por idade e peso por comprimento/estatura

- [ ] WFA até limite ratificado; WFL 45–110 cm/WFH 65–120 cm e população
  ratificadas; lookup/interpolação definidos em G01, sem clamp silencioso.
- [ ] Ausência de altura não suprime WFA; ausência de DOB não autoriza uma
  população desconhecida; indicadores possuem motivos próprios.
- Verificação futura: grade, caudas, limites e ausência parcial por indicador.
- Depende: T07. Arquivos: classificador/spec, loader/spec, contexto (até 5).

## T09 — Núcleo neonatal INTERGROWTH

- [ ] População elegível, PMA em dias, origem da IG e referência/versionamento
  ratificados; extremos/fora de faixa não viram percentil inventado.
- [ ] Peso/comprimento por PMA sem rótulo SISVAN indevido; original preservado.
- Verificação futura: dados/coeficientes oficiais, exemplos e bordas neonatal.
- Depende: T02/T03/T08. Arquivos: `referencia-intergrowth-posnatal.ts`,
  `antropometria-prematuro.ts/.spec.ts`, artefato/manifesto (até 5).

## T10 — Idade corrigida e transição

- [ ] Correção calculada de IG ao nascer, sem clamp de idade negativa para
  zero; janela/base/transição conforme ficha; snapshots e séries separadas.
- [ ] IG ausente/divergente, não elegível e mudança de base dão motivo claro.
- Verificação futura: PMA, transição, fim da correção, gestante e legado.
- Depende: T09. Arquivos: idade/contexto/classificador/spec/serviço (até 5).

## T11 — Política das interpretações adultas

- [ ] Backend bloqueia cintura/RCQ/composição abaixo de 18 em novos registros,
  inclusive sem contexto novo; 18–19 conforme decisão por fórmula ratificada.
- [ ] Medidas/RCQ factual/histórico e bloqueios gestacionais preservados.
- Verificação futura: quatro fórmulas/sexo/idade ausente/17–20/gestante.
- Depende: T02/T06. Arquivos: `antropometria.ts/.spec.ts`, serviço/spec (4).

## Checkpoint C — Indicadores e neonatal completos

- [ ] Escopo clínico ratificado implementado; nenhuma regra criada pela UI.
- [ ] Prova de snapshots/isolamento/replay em PostgreSQL real executada.

## T12 — Projeção paginada profissional

- [ ] Novo GET autorizado, allowlist e cobertura, cursor total sem perda de
  microssegundos; revalida carteira/tenant e campos a cada página.
- [ ] Curvas visuais/bases/motivos permitidos; sem notas/fingerprint clínico.
- Verificação futura: >100 itens/mesma data/soft delete/cursor alheio/transferência.
- Depende: T10/T11. Arquivos: serviço/controlador de acompanhamento, DTO/spec,
  registro em módulo (até 5).

## T13 — BFF e cliente tipado

- [ ] Sessão/permissão/origem/whitelist/limites/cache privado em sucesso/erro;
  não aceitar resultado calculado ou tenant do navegador.
- [ ] Tipos opcionais preservam adultos/313/legado e registram harness no authz.
- Verificação futura: harness BFF negativo/positivo e test:authz.
- Depende: T12. Arquivos: rota específica, API client, spec/runner, package (5).

## T14 — Formulário e resultado pediátrico

- [ ] Contexto anterior sugerido só para o mesmo paciente, confirmação explícita,
  técnica/nascimento/sexo/data, reset de estado e UUID de retry correto.
- [ ] Resultado/histórico exibe indicadores parciais, origem/ajustes e motivos,
  sem diagnóstico/conduta automática; protocolos indisponíveis explicados.
- Verificação futura: desktop/mobile, alternância paciente/data e erros409.
- Depende: T13. Arquivos: formulário/contexto/resultado, aba atual, linguagem (5).
- Modelo: Luna alto possível após contratos fechados; avisar/pausar na troca.

## T15 — Gráfico e tabela

- [ ] Indicador/eixo/base/referência selecionáveis, limites e amostragem claros;
  preservar descontinuidades, duplicados e motivos, sem unir bases incompatíveis.
- [ ] Paginação visível e tabela equivalente, região rolável com foco/labels;
  não recalcular/classificar no navegador nem guardar em cache persistente.
- Verificação futura: axe/teclado/mobile/mais de100/histórico legado.
- Depende: T14. Arquivos: acompanhamento/gráfico, spec visual/fixtures (4).
- Modelo: Luna alto possível para UI; dados/regras permanecem no contrato Sol.

## Checkpoint D — Jornada no console

- [ ] Criar avaliação → resultado → histórico → gráfico → próxima página.
- [ ] Portal/documentos/resumo/timeline não recebem dados novos implicitamente.

## T16 — PostgreSQL real e regressões de consumidores

- [ ] Runtime não owner/FORCE RLS, replay/corridas/imutabilidade/carteira e
  ausência de PHI na projeção/auditoria comprovados em banco descartável.
- [ ] Adulto/idoso/313/comparações/portal/documentos preservados; regressão
  testa também registros legados que não têm contexto pediátrico.
- Verificação futura: Jest focado, PG/Testcontainers e suites de consumidores.
- Depende: T15. Arquivos: PG integração + specs consumidores (até 5 por fatia).

## T17 — Demo, linguagem e registro dos gates

- [ ] API demo usa fixtures sintéticas e contrato real; novos cenários estão
  nos runners default de Jest/authz/Playwright e matrizes de governança.
- [ ] Linguagem/cobertura/acessibilidade e build de produção local aprovados.
- Verificação futura: `test:linguagem`, `test:fase251`, smoke UI/BFF/visual,
  testes de registro dos gates. Não criar suite órfã.
- Depende: T16. Arquivos: demo, visual/fixtures, harness/scripts/matriz (até5
  por subtarefa; preservar os gates anteriores).

## T18 — Evidência, revisão e PR única

- [ ] R4, fontes/decisões/rollback e resultados PASS/FAIL/NA/SKIPPED registrados;
  revisão independente quando viável, sem afirmar independência deste autor.
- [ ] Uma PR de implementação; acompanhar/corrigir todos os gates no HEAD final;
  preservar pendências externas da 1068 e não realizar merge/deploy.
- Verificação futura: diff/secret scan, links do plano/ficha/rotas/checklists,
  CI/scanners e declaração explícita de limites externos.
- Depende: T17. Arquivos: execução/status/checklist/roadmap/handoff (por fatia).

## Checkpoint final

- [ ] Critérios clínicos/funcionais autorizados atendidos e evidências completas.
- [ ] Troca manual de modelo respeitada; nada pendente escondido no handoff.
