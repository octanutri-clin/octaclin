# FOOD06 — acompanhamento das 12 melhorias

## Método fixo de comunicação

As12 melhorias obrigatórias têm o mesmo peso neste indicador: PENDENTE=0,
PARCIAL=0,5, CONCLUÍDA E VALIDADA=1. Percentual=100×soma/12.
É uma estimativa administrativa por macroentregas, **não** percentual de linhas,
esforço, prazo, prontidão assistencial ou critérios integralmente aceitos.
Não alterar os pesos para aparentar avanço. Evidências e exceções continuam na
[matriz de aceite](aceite-pos-320-food06.md). Nenhuma melhoria pode ser retirada.

## Checkpoint vigente — BFF factual M11

| Melhoria | Estado | Entregue / falta |
| --- | --- | --- |
| M01 cobertura | PARCIAL | Domínio/API/tabela factual; fontes completas e saídas futuras pendentes |
| M02 contribuições | PARCIAL | Domínio/API/UI, fonte/preparo/ordem/origem com PG PASS no CIa35a22dd; receitas com PG PASS no Backend53835d72; troca explícita/receitas exercitadas na API/UI M04; matriz global de contribuições ainda pendente |
| M03 explicações | PARCIAL | Motivos de cobertura e catálogo; integração clínica/relatórios pendentes |
| M04 prévias | PARCIAL | Núcleo e API inicial porção/troca catálogo, fontes/revisões/fingerprint/CAS; 5PG e CI da API aprovados; UI inicial com50browser e62PA07 PASS, CI c8389ebc aprovado; API receitas com PG/RLS141PASS/0skip; UI integrada48unitários/150browser+2retestes PASS, CI c949821b PASS; comparação clínica/matriz global pendentes |
| M05 rastreabilidade | PARCIAL | Construtor, armazenamento/leitor cifrados, fonte DB autorizada e API/BFF de registros implementados; captura factual e comparação na UI. Captura opcional, projeção e contexto histórico/relatório2 testados por negociação; referências científicas, direitos e gates globais permanecem pendentes |
| M06 tabela | PARCIAL | Tabela/filtros factuais; referências/percentuais pendentes |
| M07 versões | PARCIAL | Núcleo e API/BFF de comparação de registros factuais autorizados implementados; leitura cifrada, identidade/revisão e isolamento testados em PostgreSQL/RLS. Interface inicial permite selecionar e comparar registros já salvos; captura explícita de publicação integrada à interface com repetição idempotente e 6 testes browser. Captura de rascunho materializado com revisão exata integrada; referência comum e validação integral da jornada pendentes. Revisão UX e correção de rótulos com 8 testes browser; ver [handoff](food06-handoff-registro-factual.md). Evidência: [API factual](food06-api-registros-factuais.md) |
| M08 PDF | PARCIAL | Relatório factual1 preservado, formato2 contextual negociado e reautorizado;28browserconjuntos com8PDFsreais locais,44PG/92Web/115BFF PASS. Não é PDF plenamente acessível nem relatório científico com DRI habilitada; fontes/referências completas, UX C/R4 globais e aceite integral pendentes. Novo CI próprio deve ser conferido. [Evidências](food06-contexto-historico-relatorio.md) |
| M09 explicações curtas | CONCLUÍDA E VALIDADA | Guia próprio versionado, fonte/revisão técnica/UX delimitadas, teclado/axe/fonte200% e CIb9ed65bc aprovado; sem habilitar referências numéricas ou afirmar AT humana |
| M10 longitudinal | PARCIAL | Endpoint histórico keyset e UI factual; extensão M10-C2 compara estados dos marcadores de planejamento, composição/fonte, referência, contexto e cobertura por nutriente, sem projetar hashes nem atribuir causa. Unitário 4/4, PostgreSQL descartável/RLS 41/41, Web69/69, Playwright desktop/mobile2/2, typechecks, lint, builds e scanner local de segredos PASS em Node22.21.1. CI/scanners do novo delta, UX B/C, R4 independente e direitos/DRI continuam pendentes |
| M11 sugestões | PENDENTE | API factual com100testesfoco/7PG,233regressões sobrepostas e build/typecheck PASS; BFF150PASS/30autorização central; sem UI/aplicação. Gate authz agregadoBLOCKED por harness. Individualização bloqueada; [evidências e próximo passo](food06-m11-bff-catalogo.md) |
| M12 cenários | PENDENTE | Implementação ainda necessária |

**45,8% estimados;1/12 melhoria integralmente encerrada (M09).** Nove parciais,
duas pendentes (100×(1+9×0,5)/12). Inclui M08 parcial enviada, ainda sem aprovação global. Não é percentual de esforço, prazo ou prontidão
assistencial. M10 continua parcial e M07 não se encerra por um comparador interno testado.

Histórico anterior M08 (substituído pelo checkpoint contextual): verificar CI manual42131762437 do incremento agrupado d04551e0 e a sincronização do HEAD da #455, que ainda informa159ced04. Evitar pushes por pequenas etapas: CI leva cerca de40min, conforme proprietário. R4 estática delimitada de impressão favorável após correções; R4 integral FOOD06 e UX B/C aplicáveis seguem pendentes. CI do remoto159ced04 concluído com sucesso; não valida M08. O CI manual falhou em linguagem do canário de teste; correção RED/GREEN local concluída e novo CI pendente.
Direitos/DRI e G06 BLOCKED; sem operações externas ou mudança de escopo.

## Retomada — contexto confirmado, fundamento2026-11-06

CI42137723558 do HEAD7abb1c99 PASS (Demo/Backend/Web/PR Gate incluídos); SBOM provenance SKIPPED. PR sincronizada e Draft. Próximo incremento documentado em [contexto confirmado](food06-contexto-confirmado.md): validador/carregador interno com75testes e typecheckPASS; sem integração API/UI ou referência DRI habilitada. Não acrescenta melhoria concluída nem altera45,8%. Nova orientação: checkpoints remotos menores para preservar trabalho, sem esperar toda a matriz global; cada envio declara gates pendentes.

### Contexto — integração backend posterior ao fundamento
Campo opcional integrado em DTO/HTTP/serviço, com contexto server-side na transação autorizada e identidade idempotente cifrada.92/92foco,44/44PostgreSQLRLS/HTTP real, typecheck/buildNode22 e revisão estática delimitada favorável. Corrigida hidratação TypeORM com nascimento nulo após RED real. UI/projeção contextual e CI próprio pendentes. [Contrato e provas](food06-contexto-confirmado.md). Percentual mantido45,8%, sem encerrar M05/M08 nem gates globais.

### Contexto — console e projeção mínima
Captura compartilhada com resumo explícito, desconhecidos preservados e reset por contexto/plano/paciente; projeção aditiva versionada sem nascimento.44PG/87domínioWeb/113BFF,14browsercaptura+6rascunho+6PA07subset PASS. Corrigido ACKtardio após seleção nova com RED/GREEN. BuildWebNode22/webpack PASS; CI próprio ainda pendente neste checkpoint local; demais limites no [contrato](food06-contexto-confirmado.md). Mantido45,8% administrativos.

Histórico do incremento anterior: enviar checkpoint contextual à mesmaPR455 Draft e conferir o CI exato. Próximo então previsto: contexto histórico/relatório. Não há autorização de merge/deploy/migration externa.

## Checkpoint — histórico contextual e relatório2
Implementados opt-in do histórico e negociação explícita de relatório2, resumo de época sem cadastro atual e defaultsv1 preservados.33backend/44PG/92Web/115BFF,28browserconjuntos, builds/typechecksNode22 PASS. Corrigidos allowlist do resumo e401que mantinha página anterior, ambos com RED/GREEN. [Contrato e handoff](food06-contexto-historico-relatorio.md).
Agora: conferir CI do checkpoint e avançar auditoria de catálogo/restrições para M11; M12 continua pendente.45,8% administrativos mantidos, sem melhoria integral adicional fechada; direitos/DRI/G06 bloqueados.

## Continuidade — fundamento interno M11
CI da base6c0ca464/run42236610758 SUCCESS. Consulta genérica interna reutiliza adaptadores e motor;63testes PASS, typecheck/build Node22 PASS; revisão estática independente favorável delimitada. Sem API/UI nem individualização habilitada. M11 segue PENDENTE,45,8% mantidos; [handoff](food06-m11-consulta-catalogo.md). Novo CI ainda pendente.

### Continuidade M11 — API factual
Contrato autenticado/paginado, revisão estática independente e7PG/HTTP PASS; falha de paginação TypeORM reproduzida e corrigida.100foco/233regressões sobrepostas PASS. Sem BFF/UI, M11 continua PENDENTE;45,8% administrativos mantidos. [Handoff](food06-m11-api-catalogo.md). Novo CI pendente.

### Continuidade M11 — BFF
BFF autenticado, limitado, allowlist aninhada/validação de contexto da consulta e erros seguros, sem individualização.150BFF/30autorização central/typecheck/lint PASS; agregado authzBLOCKED no harness. R4 estática delimitada favorável. Build final Node22 PASS/CI a conferir; [evidências](food06-m11-bff-catalogo.md). UI e jornadas continuam pendentes;45,8% mantidos.
