# FOOD06 — acompanhamento das 12 melhorias

## Método fixo de comunicação

As12 melhorias obrigatórias têm o mesmo peso neste indicador: PENDENTE=0,
PARCIAL=0,5, CONCLUÍDA E VALIDADA=1. Percentual=100×soma/12.
É uma estimativa administrativa por macroentregas, **não** percentual de linhas,
esforço, prazo, prontidão assistencial ou critérios integralmente aceitos.
Não alterar os pesos para aparentar avanço. Evidências e exceções continuam na
[matriz de aceite](aceite-pos-320-food06.md). Nenhuma melhoria pode ser retirada.

## Checkpoint vigente — 2026-11-12 (referências DRI, cenários e restrições)

Atualização de documentação; **nenhuma suíte foi reexecutada para produzi-la**: cada linha cita PRs já mergeadas na `main`, com a CI da época. B01, B05 e G06 encerrados por **declaração do
proprietário** em 2026-11-12, sem artefato anexado; isso **não** muda o estado de nenhuma melhoria por si só.

| Melhoria | Estado | O que mudou desde 2026-11-08 / o que falta |
| --- | --- | --- |
| M01 cobertura | PARCIAL | Sem mudança. Falta provar zero ≠ ausência ponta a ponta e a origem por nutriente nas saídas. |
| M02 contribuições | PARCIAL | T7: matriz da soma e da cobertura contra oráculo independente. Faltam provas integradas e a matriz de operações efetivas. |
| M03 explicações | PARCIAL | T6: tabela ao vivo e relatório coincidem; canários. Faltam todas as causas integradas, renderização e logs de infraestrutura. |
| M04 prévias | PARCIAL | Referências DRI entraram na análise, no registro e no relatório, **não na prévia**. Faltam elegibilidade científica na prévia e a matriz de concorrência do aplicar. |
| M05 rastreabilidade | PARCIAL (avançada) | T1 a T3b: referência versionada; o registro v2 nunca recalcula com a versão atual. Falta prova integrada de reprodução sob RLS e B07. |
| M06 tabela | PARCIAL | T4a: coluna de referência. Faltam filtros por situação da referência, ordenação e jornada final com tecnologia assistiva. |
| M07 versões | PARCIAL | Sem mudança. Faltam referência comum entre versões e isolamento das dimensões. |
| M08 PDF | PARCIAL | T4b: seção DRI opcional com PDF real. Faltam acessibilidade do PDF e fontes por nutriente completas. |
| M09 explicações curtas | CONCLUÍDA E VALIDADA | Ressalva: textos novos de RDA/AI/UL (T4) aguardam validação de conteúdo pelo responsável. |
| M10 longitudinal | PARCIAL | NUX-15: indicador por registro. Faltam referências nos pontos históricos e gráfico e tabela equivalentes. |
| M11 sugestões | PARCIAL | **C2 bloqueada (B04).** Contrato v2 (#524) e motor (#526) propostos, não mergeados. Faltam P1b a P4, decisões Q1 a Q11, validação clínica, jurídica e de privacidade. |
| M12 cenários | **PARCIAL (proposta) só no domínio** | T5: núcleo em memória, sem gravar. Faltam API/BFF, interface com aviso de descarte e o aplicar pelo fluxo M04 (CAS, fingerprint, PA07). |

**Indicador:** com M12 em PARCIAL, **54,2%** administrativos (100×(1+11×0,5)/12), 1/12 encerrada (M09), onze parciais. **A mudança de M12 de PENDENTE para PARCIAL é proposta e aguarda a confirmação do proprietário;
até lá o indicador oficial permanece 50,0%.** É estimativa administrativa por macroentregas, não prontidão assistencial nem critérios integralmente aceitos. Os pesos não foram alterados.

Para registrar como PASS o que o proprietário testou (B05), falta o artefato: commit testado, cenários, dispositivos e tecnologia assistiva.

## Checkpoint anterior — 2026-11-08 (seleção M11 e prévia M04)

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
| M11 sugestões | PARCIAL | Consulta API/BFF/UI e seleção explícita para prévia/confirmação M04;46browser/180serviço/150BFF PASS. Individualização com restrições confiáveis e critérios globais ainda pendentes; [evidências](food06-m11-previa-editor.md) |
| M12 cenários | PENDENTE | Implementação ainda necessária |

**50,0% administrativos;1/12 melhoria integralmente encerrada (M09).** Dez parciais e uma pendente (100×(1+10×0,5)/12). A passagem M11 de PENDENTE para PARCIAL registra a consulta factual utilizável e testada, não conclusão das sugestões ou habilitação clínica. Prévia/confirmação individual integrada; individualização, M12, direitos/DRI/G06 e critérios globais continuam pendentes. Não é percentual de esforço ou prazo. Checkpoints abaixo são históricos dos respectivos commits.

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

### Continuidade — interface M11
Consulta profissional explícita com busca/nutriente/porção/fonte e paginação; sem recomendação individual ou escrita no plano. Browser74PASS/6PDFSKIPPED (20novosPASS), BFF150PASS, lint integral0erros/71avisos e revisão R4 estática delimitada favorável. UX A/B/C do incremento textual mediada pelo coordenador, pacienteN/A. Build/typecheck isolados Node22 PASS; authz em execução, novoCIpendente. M11 PARCIAL,50%administrativos; [handoff](food06-m11-interface-catalogo.md).

### Continuidade — seleção M11→M04
Seleção preenche proposta emg; sem cálculo/gravação automática, confirmação pelo writer existente.46browser/180serviço/150BFF PASS, build/typecheckNode22 PASS; R4 estática e UX delimitadas favoráveis.50%mantidos, M11 PARCIAL. CI basef9c35427 aprovado, novoHEADpendente. [Handoff](food06-m11-previa-editor.md).
