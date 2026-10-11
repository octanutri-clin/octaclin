# Sequência futura — Fase 314

Estado: **execução técnica controlada autorizada**, sem ativação assistencial.
G01/G02 continuam bloqueantes para uso clínico. Critérios clínicos originais
abaixo são preservados; notas anteriores de T03–T18 bloqueadas são históricas.
[Entrega técnica](../docs/history/phases/ENTREGA_TECNICA_FASE_314.md) e
[dossiê](../docs/product/DOSSIE_RATIFICACAO_FASE_314.md) registram evidências e pendências.
R4; um escritor ativo, uma PR de entrega. Nenhuma troca de modelo automática.

## T01 — Fechar referência computacional (G01)

Subfatias documentais T01-A fontes/termos, T01-B OMS/âncoras/exemplos,
T01-C neonatal diário. Até três documentos por fatia; não implementar runtime.
Parte da pesquisa concluída nesta revisão não encerra T01/G01.

- [ ] Fonte/versionamento/lookup/caudas/flags/precisão definidos; coeficientes
  neonatais oficiais suficientes e condições de uso/atribuição conferidos.
- [ ] Resolver corte de 60 meses versus grade até 1856, meses fracionários
  60–61/120–121/228–229, adaptação aos 19 e 64s0d/64s6d.
- [ ] Interpolar L/M/S conforme fonte oficial, com âncoras verificadas;
  registrar edição/commit, condições de uso e tolerância por família.
- [ ] Obter modelo diário neonatal e oráculo independente; PDFs semanais
  arredondados não o substituem. Termos OMS/GPL/MS/INTERGROWTH resolvidos.
- [ ] Quantidade real de arquivos/hashes/abas/linhas comprovada. A revisão
  confirmou 16 XLSX/14.338 linhas locais; falta incorporar âncoras com direitos.
- Verificação futura: manifesto, tabela completa/intervalos e exemplos
  publicados independentes; não executar calculadora externa com PHI.
- Dependência: respostas clínicas. Arquivos: ficha, manifesto, plano (3).

## T02 — Ratificação da ficha (G02)

- [ ] Equipe ratifica população neonatal, correção/transição, quatro indicadores,
  técnica/ajuste, estatística/flags e fórmulas adultas 18–19; versão registrada.
- [ ] Registrar respostas/evidências CL-01–CL-10, versão/hash e referência ao
  aceite interno sem PII; separar decisão de produto, clínica e autorização.
- [ ] Confirmar autorização expressa G03 e escopo de testes futuros; nenhum
  parecer anexado concede essa autorização.
- Verificação: confirmação humana específica e pendências explicitadas.
- Depende: T01. Arquivos: ficha, plano/handoff, checklist (até 4).

## Checkpoint A — Antes do classificador

- [ ] G01/G02 PASS e G03 autorizado; T03–T18 bloqueadas até esse checkpoint.
- [ ] Base Git/PR/1068 reconfirmada; registro de limites operacionais.

## T03 — Idade civil e roteamento de referência

- [ ] Idade civil/estatística/efetiva ratificadas, bissexto/29-02/730-731,
  1826-1827/1856-1857/60-61/120-121/228-229/20 anos cobertos.
- [ ] Técnica/normalização compartilhada definida antes do IMC T05, com
  original preservado, ajuste único, <9 meses e gestação conforme CL.
- [ ] Estados/motivos por indicador, edema e elegibilidade com dados mínimos
  cifrados, sem inferir sexo/técnica/termo pelo cadastro/peso.
- [ ] Aplicabilidade por indicador, gestação/prematuridade/bases, sem fallback
  adulto; dados ausentes produzem motivos definidos.
- Verificação futura: Jest datas/bissexto/DST/bordas; nenhum relógio implícito.
- Depende: T02. Arquivos novos: `dominio/idade-pediatrica.ts/.spec.ts`,
  `dominio/contexto-pediatrico.ts`, `dominio/aplicabilidade-pediatrica.ts/.spec.ts`.
  T03-A idade (2), T03-B contexto/aplicabilidade (3), T03-C normalização/spec
  (2, se módulo separado for necessário); commits sequenciais, até 5 por fatia.

## T04 — Referências OMS offline

- [ ] Artefatos normalizados determinísticos, grades/unidades/âncoras e hashes,
  sem transcrição manual e sem dependência de rede em runtime.
- [ ] Conferência de planilha interna WFA mesmo quando nome externo é HFA;
  âncoras OMS2007 60/229 e 60/121 com fonte/termos verificáveis.
- [ ] Não adicionar dependência GPL ou copiar código sem avaliação de
  compatibilidade; algoritmos/referências não são obtidos pela rede em runtime.
- Verificação futura: integridade/grade/transcrição e fixtures independentes.
- Depende: T01/T02. Arquivos: dados por família, loader/manifesto, spec (até 5
  por subtarefa: separar OMS2006 e OMS2007 em commits sequenciais).

## T05 — IMC/idade OMS completo

- [ ] LMS/caudas por família, interpolação de parâmetros, percentil ±3 e
  rótulos ratificados; contra exemplos oficiais sintéticos por sexo/indicador.
- [ ] IMC já usa normalização de T03; flag/edema/política de precisão de
  CL-03/CL-09 antes da primeira persistência, sem esperar T07/T08.
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
- [ ] Entrada e domínio admitem faixa pediátrica ratificada, inclusive <1 kg
  e <30 cm; legado adulto/gestacional preservado, sem bypass por DTO ausente.
- [ ] Allowlist explícita de resposta evita projetar fingerprint/contexto
  interno aos consumidores existentes; replay precedido de autorização atual.
- Depende: T05/T11. Arquivos: `dtos-pediatricos.ts`, `dtos.ts`,
  `servico-pacientes.ts`, `servico-pacientes.spec.ts`, `prontuario-api.ts` (5).

## Checkpoint B — Vertical IMC persistida

- [ ] T16-A PASS antes de continuar: PostgreSQL real, não owner, RLS,
  chave/imutabilidade, replay sob concorrência e transferência/cadastro.

- [ ] Cálculo/persistência/contrato e regressões adulto/idoso/313 passam.
- [ ] Sem campos sensíveis novos em auditoria/portal/metadata.

## T07 — Comprimento/estatura por idade

- [ ] Técnica original e normalizada, ajuste 0,7 cm explícito; borda 730/731
  e salto da referência tratados sem dupla correção.
- [ ] Sem sexo/técnica/base aplicável: ausência apenas nos indicadores afetados;
  reutilizar normalização T03/T05, sem segundo ajuste ou cópia da lógica.
- [ ] Em pé <9 meses: política CL-02 ratificada e motivos seletivos;
  não apresentar supressão completa como equivalência literal ao pacote OMS.
- Verificação futura: medianas/bordas/técnicas/ajuste reversível no snapshot.
- Depende: T06/T16-A. Arquivos: contexto, classificador/spec, DTO/spec (até 5).

## T08 — Peso por idade e peso por comprimento/estatura

- [ ] WFA até limite ratificado; WFL 45–110 cm/WFH 65–120 cm e população
  ratificadas; lookup/interpolação definidos em G01, sem clamp silencioso.
- [ ] Flags HFA <−6/>+6, WFA <−6/>+5, WFL/H e BFA <−5/>+5,
  precisão/igualdades/edema ratificados; preservar medida e motivos individuais.
- [ ] Ausência de altura não suprime WFA; ausência de DOB não autoriza uma
  população desconhecida; indicadores possuem motivos próprios.
- Verificação futura: grade, caudas, limites e ausência parcial por indicador.
- Depende: T07. Arquivos: classificador/spec, loader/spec, contexto (até 5).

## T09 — Núcleo neonatal INTERGROWTH

- [ ] População elegível, PMA em dias, origem da IG e referência/versionamento
  ratificados; extremos/fora de faixa não viram percentil inventado.
- [ ] Peso/comprimento por PMA sem rótulo SISVAN indevido; original preservado.
- [ ] Dias intermediários, caudas e exemplos independentes com método neonatal
  comprovado; não aplicar LMS OMS por analogia ou interpolar tabelas semanais.
- Verificação futura: dados/coeficientes oficiais, exemplos e bordas neonatal.
- Depende: T02/T03/T08. Arquivos: `referencia-intergrowth-posnatal.ts`,
  `antropometria-prematuro.ts/.spec.ts`, artefato/manifesto (até 5).

## T10 — Idade corrigida e transição

- [ ] Correção calculada de IG ao nascer, sem clamp de idade negativa para
  zero; janela/base/transição conforme ficha; snapshots e séries separadas.
- [ ] IG ausente/divergente, não elegível e mudança de base dão motivo claro;
  64s0d/64s1d/64s6d e fim da correção ratificados, sem clamp negativo.
- [ ] Explicar base de idade da técnica/flags e transição dos não elegíveis,
  sem adotar prazo 24/36 meses pelo implementador.
- Verificação futura: PMA, transição, fim da correção, gestante e legado.
- Depende: T09. Arquivos: idade/contexto/classificador/spec/serviço (até 5).

## T11 — Política das interpretações adultas

- [ ] Backend bloqueia cintura/RCQ/composição abaixo de 18 em novos registros,
  inclusive sem contexto novo; 18–19 conforme decisão por fórmula ratificada.
- [ ] Medidas/RCQ factual/histórico e bloqueios gestacionais preservados.
- Verificação futura: quatro fórmulas/sexo/idade ausente/17–20/gestante.
- Depende: T02/T03; executar **antes de T06**. Arquivos: domínio/spec (2);
  integração/serviço/spec em T06, sem dupla alteração concorrente do serviço.

## Checkpoint C — Indicadores e neonatal completos

- [ ] Escopo clínico ratificado implementado; nenhuma regra criada pela UI.
- [ ] Prova de snapshots/isolamento/replay em PostgreSQL real executada.

## T12 — Projeção paginada profissional

- [ ] Novo GET autorizado, allowlist e cobertura, cursor total sem perda de
  microssegundos; revalida carteira/tenant e campos a cada página.
- [ ] Curvas visuais/bases/motivos permitidos; sem notas/fingerprint clínico.
- [ ] Paginar registros examinados, não tentar filtrar blob cifrado em SQL;
  lotes mistos/vazios/ilegíveis têm cobertura e cursor do último examinado.
- [ ] T16-B PASS antes de BFF/UI; âncora soft-deleted só posiciona, filtros
  reiniciam leitura, sem perda por Date JS/microssegundos.
- Verificação futura: >100 itens/mesma data/soft delete/cursor alheio/transferência.
- Depende: T10/T11. Arquivos: serviço/controlador de acompanhamento, DTO/spec,
  registro em módulo (até 5).

## T13 — BFF e cliente tipado

- [ ] Sessão/permissão/origem/whitelist/limites/cache privado em sucesso/erro;
  não aceitar resultado calculado ou tenant do navegador.
- [ ] Tipos opcionais preservam adultos/313/legado e registram harness no authz.
- Verificação futura: harness BFF negativo/positivo e test:authz.
- Depende: T12/T16-B. Arquivos: rota específica, API client, spec/runner, package (5).

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

Preservar ID, com provas **antecipadas**: T16-A após T06 antes do checkpoint B;
T16-B após T12 antes de T13; T16-C após T15 consolida consumidores/segurança.
Cada fatia toca até 5 arquivos; reutilizar harness RLS/serviços real existente.

- [ ] Runtime não owner/FORCE RLS, replay/corridas/imutabilidade/carteira e
  ausência de PHI na projeção/auditoria comprovados em banco descartável.
- [ ] Testar UPDATE protegido, soft delete/compartilhamento permitidos e
  DELETE físico conforme grants/controle real; não inferir proteção pela 1068.
- [ ] Corrigir contexto por novo snapshot, sem supersessor/evento de
  retificação novo não autorizado; ciphertext ilegível não vira dado normal.
- [ ] Erros/logs/analytics/Cache Storage/URL/exportações sem conteúdo clínico;
  sem download de dados reais por calculators/providers.
- [ ] Adulto/idoso/313/comparações/portal/documentos preservados; regressão
  testa também registros legados que não têm contexto pediátrico.
- Verificação futura: Jest focado, PG/Testcontainers e suites de consumidores.
- Depende: T16-A←T06; T16-B←T12; T16-C←T15. PG/specs consumidores, até 5 por fatia.

## T17 — Demo, linguagem e registro dos gates

- [ ] API demo usa fixtures sintéticas e contrato real; novos cenários estão
  nos runners default de Jest/authz/Playwright e matrizes de governança.
- [ ] Linguagem/cobertura/acessibilidade e build de produção local aprovados.
- Verificação futura: `test:linguagem`, `test:fase251`, smoke UI/BFF/visual,
  testes de registro dos gates. Não criar suite órfã.
- Depende: T16-C. Arquivos: demo, visual/fixtures, harness/scripts/matriz (até5
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
- [ ] CL → tarefa → prova → resultado/HEAD → responsável interno, gates
  G00–G05 individualmente, nenhuma promessa tratada como teste executado.
- [ ] Troca manual de modelo respeitada; nada pendente escondido no handoff.


## Ordem consolidada e checkpoints (rev2)

Somente T01/T02 **documentais** nesta autorização. Ordem futura, após G01/G02/G03:
T03 → T04 → T05 → T11 → T06 → T16-A → T07 → T08 → T09 → T10 →
T12 → T16-B → T13 → T14 → T15 → T16-C → T17 → T18.
Checkpoints técnicos a cada 2–3 fatias: T03/T04; T05/T11; T06/T16-A;
T07/T08; T09/T10; T12/T16-B; T13/T14; T15/T16-C; T17/T18.
Não renumerar IDs nem marcar implementação concluída por esta revisão.

| CL | Tarefas/provas futuras |
| --- | --- |
| CL-01 | T01/T03/T04/T05/T10: datas, âncoras, interpolação, transições |
| CL-02 | T03/T05/T06/T07/T14/T15: normalização/posição e original |
| CL-03 | T01/T04/T05/T07/T08/T09: fixtures externas, caudas/percentis |
| CL-04 | T05/T07/T08/T14: cortes brutos/nomes por faixa |
| CL-05 | T03/T06/T09/T10: elegibilidade/incompletos |
| CL-06 | T01/T04/T09: origem/termos/modelo diário/oráculo |
| CL-07 | T03/T09/T10/T15: PMA/correção e fim da janela |
| CL-08 | T11/T06/T16-C: fórmulas separadas, <18/18–19/gestantes |
| CL-09 | T03/T05/T06/T07/T08: flags, precisão, edema e reconferência |
| CL-10 | T06/T12/T13/T16-A/B/C: papéis/carteira/RLS/minimização |

### Comandos futuros, não executados nesta revisão

- Backend: `pnpm --dir octaclin-backend typecheck`, `build`,
  `test --runInBand` focado e completo; PG/Testcontainers conforme harness/CI
  atual em banco descartável autorizado (não staging/produção).
- Web: `pnpm --dir octaclin-web test:authz`, `lint`, `typecheck`, `build`,
  Playwright focado desktop/mobile/axe e gate Demo vigente.
- Governança: `pnpm test:linguagem`, scanners e gates aplicáveis no HEAD final;
  confirmar nomes reais de scripts antes de executar, sem suite órfã.
- Registro de software: resultado SKIPPED agora; autorizar escopo de testes
  junto da implementação, sem confundir conferência de arquivo com Jest.

## Refinamentos REV3 — critérios adicionais sem iniciar tarefas

[Pesquisa e provas](../docs/history/phases/INVESTIGACAO_INTERGROWTH_FASE_314_REV3.md)
complementam IDs existentes; não substituem aceites rev2. Ordem/checkpoints e
T03–T18 bloqueadas preservados. Biblioteca encontrada não autoriza entrega
parcialOMS nem remoção de prematuros; eventual decomposição exige decisão.

### T01-C — Fechamento do candidato contínuo

- [x] Identificar commits/hashes/licenças declaradas e equações dos dois projetos.
- [x] Distinguir μ/σ no log de peso/comprimento, domínio e políticas dos pacotes.
- [x] Consultar oráculo oficial apenas sintético em dias intermediários/bordas,
  14 casos únicos/28 resultados (lote12/24 + inicial1/2 +55semanas1/2); comparação amostral concordante.
- [x] Rebaixar quatro PDFs oficiais e documentar1.064comparações e ressalva55s.
- [ ] Obter publicação/suplemento ou confirmação primária verificável da origem,
  precisão dos coeficientes; resolver diferença do quantil semanal55s,z−3.
- [ ] Resolver direitos por camada: código, equação, dados/coleções/PDFs,
  atribuição/incorporação/redistribuição; não presumir MIT/GPL dos dados IG.
- [ ] Definir tolerâncias a priori e completar provas diárias/extremos/bordas;
  serviço sem edição do motor pública requer evidência/versionamento suficiente.
- [ ] Fechar OMS/âncoras/edição/precisão restantes deT01-B; G01 continua BLOCKED.

### T02 — Ratificação específica refinada

- [ ] Responder CL-01–CL-10 com fontes/alternativas da seção10 da ficha.
- [ ] CL-05: nascimento/day0/0–2 dias, população e critérios desconhecidos;
  não inferir nascimento da primeira avaliação cadastrada.
- [ ] CL-06: candidato contínuo, domínio27–64, percentis/caudas/direitos;
  sem Newborn Size/HC/WFLneonatal nem faixa24–64s6d transportada.
- [ ] CL-07: confirmar corrigida versus cronológica após 64, prazo/base/exceções
  com diretriz recuperada; não assumir24/36 meses ou copiar default gigs.
- [ ] Registro interno protegido de aceite com versão/hash, sem PII no Git;
  aprovação documental com ressalvas não ratifica clínica nem autorizaT03.

### T09/T10 — Futuras provas obrigatórias

- [ ] T09: núcleo direto(log−μ)/σ, não inversa depercentil saturado;
  indicadores neonatais elegíveis apenas, sem LMS/caudasOMS por analogia.
- [ ] T09: distinguir ao nascer/seguimento, day0/0–2 dias conformeCL ratificada;
  PMA27/27+1/64/64+1 e ambos os sexos, ausência de contexto/medidas, extremos.
- [ ] T10: comparar roteamento escolhido ao default gigs WHO cronológica;
  teste sintéticoIG32s0d/64s1d=225 dias cronológicos/169 corrigidos, série distinta.
- [ ] T10: fim da correção/política versionada, técnica e elegibilidadeOMS
  próprios; referência inaplicável preserva medidas, sem fallback adulto.

G00-fonte/direitosBLOCKED; G00-operação1068BLOCKED/consultaSKIPPED.
G01/G02/G03BLOCKED, G04SKIPPED, G05BLOCKED. Somente pesquisa documental avançou.

## Critérios finais REV4 — manter IDs e não iniciar execução

### T01-A/C — Direitos e provas independentes com término definido

- [x] ReconciliarJSONs anteriores:14 casos distintos/28 resultados (12/24+1/2+1/2),
  hashes originais intactos; nenhuma nova consultaOxford nestaREV4.
- [x] Obter texto integralElmrayed2025 e páginaRCPCH; registrar SBP 2023 403,
  SBP2017hash localPASS/re-download403, licençaVillarCCBY-NC-ND via Crossref.
- [ ] Fonte primária dos coeficientes/precisão ou confirmação técnica documentada,
  edição/limites eexplicação/decisão explícita sobre55semanas,z−3.
- [ ] Parecer concreto/permissões de incorporação por artefato, distinçãoR/obra/
  dados/equações, atribuição; mensagem a fornecedor somente com autorização.
- [ ] Aprovar protocolo e tolerâncias prospectivas da investigação seção8.2:
 14 casos congelados +até 8novos manuais sintéticos; saídas oficiais preservadas;
 nenhum site em CI/runtime. Provas locais189–448 dias,sem centenas de consultas.
- [ ] Concluir âncoras/ediçãoOMS restantes; não fecharG01 só pelo candidatoIG.

### T02/T10 — Respostas clínicas específicas, sem inventário repetido

- [ ] Equipe responde matriz finalCL-01–CL-10, aprovando ou alterando com fonte,
  versão/hash eexceções em registro interno protegido.
- [ ] CL-07: prazo/base para<28,28–<32,32–<37, IG desconhecida;36 corrigidos<32
  preferencial e24corrigidos>=32 opção provisória, sem extrapolação implícita;
  borda civil/inclusiva, técnica/indicadores,64s0d/64s1d efim da janela ratificados.
- [ ] CL-05: nascimento/0–2 dias é política local pendente, fonte/contexto por
  avaliação, nunca primeira no cadastro=ao nascer. Elegibilidade separada de CL-07.
- [ ] CL-08: seis decisões por fórmula/cintura/RCQ18–19 com fontes/população,
  bloqueio<18/precedênciagestacional e valoresfactuais preservados.
- [ ] G02ratificação eG03autorização expressa/testes antesT03–T18; nenhum novo
  gatePASS por aprovação documental. ProvasPG/RLS/ciphertext/cursor/DELETE
  mantidas nas tarefas originais, sem executar nesteplanejamento.

Ordem T03→T04→T05→T11→T06→T16-A→T07→T08→T09→T10→T12→T16-B→T13→T14→T15→T16-C→T17→T18
preservada; em T10 cobrir31s6d/32s0d,limites24/36 corrigidos edia seguinte,
base clínica versus estatística, motivo parcial e série/versionamento separados.

## Rastreamento da execução controlada (2026-10-11)

A autorização posterior permite subfatias técnicas independentes em T03–T18;
os critérios originais completos continuam abertos quando exigem ratificação/direitos.
Não há runtime habilitando protocolos provisórios, client flag ou variável de ambiente.

| Tarefa | Subfatia técnica executada / em curso | Critério completo ainda necessário |
| --- | --- | --- |
| T01 | Investigação matemática sintética arquivada reproduzida,26/28 reconciliado | Método/fonte/precisão/direitos/OMS completos; G01 BLOCKED |
| T02 | REV5 e dossiê individual CL01–10 integrados | Aceite humano específico; G02 BLOCKED |
| T03 | Datas/contexto/estado por indicador, medidas parciais e idade factual | Roteamento/idade efetiva/técnica clínicos ratificados |
| T04 | Matemática LMS genérica e interpolação de parâmetros, sem datasets | Direitos e tabelas/âncoras normalizadas oficiais |
| T05 | IMC candidato com LMS sintético, caudas/flags/edema | Tabelas/edição/SISVAN/validação clínica independentes |
| T06 | Snapshot cifrado v1 e replay no serviço existente; PostgreSQL 31 PASS | G01/G02 para resultados clínicos |
| T07 | Estatura candidata/normalização proposta com dados sintéticos | Referência completa e regra técnica ratificada |
| T08 | Peso e peso/estatura candidatos parciais com dados sintéticos | Referências/cobertura/SISVAN ratificados |
| T09 | Lognormal genérico; coeficientes somente no teste de investigação | Fonte primária/55s/direitos e população ratificados |
| T10 | Proposta CL07 versionada e testada, sem consumo assistencial | Neonatologia/pediatria ratifica estratos/transição/prazos |
| T11 | Proteções etárias e preservação de legados/fatos | Seis decisões18–19 individuais, evidências amostrais |
| T12 | Endpoint SQL paginado por tenant/paciente, cursor por último examinado | PostgreSQL 31 PASS incluindo duas páginas filtradas e cursor por microssegundo; ativação clínica depende de G01/G02 |
| T13 | BFF privado/tipado e testes negativos | Authz completo/HEAD final |
| T14 | Formulário confirmado, resultado de bloqueio e contexto | Playwright desktop/mobile/axe 6 PASS; habilitação clínica permanece bloqueada |
| T15 | Gráfico bruto por contexto separado e tabela equivalente | Desktop/mobile/axe 6 PASS; curvas clínicas dependem de direitos/ratificação |
| T16 | Jest 2614 PASS/50 SKIPPED; PG 31 PASS; transferência/replay/retencao | CI final e critérios científicos/clínicos pendentes |
| T17 | Documentação/linguagem/gates em atualização | Demo/gates finais verdadeiros |
| T18 | Dossiê/relatório; PR Draft única #392 aberta | RevisãoR4 independente/CI/PR; não implica merge/produção |
