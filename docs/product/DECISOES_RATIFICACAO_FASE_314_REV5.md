# Decisões propostas e ratificação necessária — OctaClin Fase 314 (REV5)

**Data:** 10/10/2026 · **Base:** `FICHA_VALIDACAO_CLINICA_FASE_314 4.md` (REV4), `PLANO_FASE_314 2.md`, `todo-fase-314 3.md`, `INVESTIGACAO_INTERGROWTH_FASE_314_REV3.md`, fontes clínicas verificadas no dia.

**Status:** especificação preferencial para decisão do proprietário/equipe; **não é ratificação clínica assinada, parecer jurídico ou autorização automática para implementação total/deploy**. Nenhuma checkbox de aceite deve ser marcada pelo Codex por inferência. Diferenciar: **D** decisão arquitetural/produto recomendada; **C** decisão clínica a ser ratificada; **E** comprovação técnica/direitos ainda exigida.

## Conclusão executiva

**Aprovar o desenho funcional e autorizar SOMENTE sob comando explícito do proprietário a preparação técnica isolada (marco P0), sem classificadores ativos.** Manter algoritmos que produzam z, percentil e rótulos clínicos bloqueados até G01 computacional/direitos + G02 ratificação da versão final; manter deploy/merge/migrations fora da autorização. A estrutura T01–T18 permanece, mas T03/T04 poderão ser **subdivididas** em partes independentes de regras não ratificadas e código não acionável, em branch/worktree isolada, com testes sintéticos e feature flag OFF; **essa é uma proposta de mudança de gate**, dependente de autorização expressa do proprietário. Se ele preferir o gate anterior estrito, nenhuma T03–T18 começa.

## Decisões preferenciais CL-01–CL-10

### CL-01 — Idade e cobertura OMS (D + C)
**Decisão proposta:** idade cronológica por diferença de datas civis; idade de referência estatística `dias / 30,4375` quando aplicável à implementação OMS selecionada; interpolação dos **parâmetros L/M/S**, e não de z/percentis; roteamento OMS 2006 se <60 meses estatísticos e OMS 2007 se ≥60, limitado por indicador e edição congelada; manter cálculo de aniversários civis e idade efetiva SISVAN separadamente. Nunca usar último dia da planilha para inferir transição, nem inventar âncoras 60, 121, 229. Para IMC de 19a1m a 19a11m, preservar a adaptação SISVAN já decidida, explicitando a linha efetivamente utilizada e cessando no 20º aniversário; não estender HFA/WFA por analogia.
**Ratificar:** política única para transição 60 meses (estatística versus civil), bordas e igualdade de cada indicador, uso da adaptação SISVAN aos 19, método de 29/02, versão da referência e tabela de verdade 60/61, 120/121, 228/229, 19→20. Comportamento diferente do software de referência deve ser explícito e testado.

### CL-02 — Técnica e normalização (D + C)
**Decisão proposta:** registrar técnica original (`deitado`, `em_pé`, `não_informada`); OMS <24 meses exige comprimento; OMS ≥24 meses exige estatura, com conversão única ±0,7 cm quando inversa e aplicável; preservar valor bruto, valor usado, direção do ajuste e versão. Se medida em pé abaixo de 9 meses, sinalizar necessidade de reconferência e **não classificar os indicadores dependentes de comprimento/estatura enquanto houver inconsistência**, preservando WFA quando elegível. Em INTERGROWTH pós-natal, usar comprimento deitado e **não herdar automaticamente** a conversão OMS.
**Ratificar:** idade que governa técnica em prematuros (cronológica/corrigida), a supressão conservadora <9m e o que fazer com técnica neonatal inversa; entrada de peso a 0,001 kg e comprimento a 0,1 cm como precisão de referência (sem arredondar silenciosamente valores armazenados).

### CL-03 — Cálculo e apresentação (D + C + E)
**Decisão proposta:** guardar z bruto e versão do algoritmo; SISVAN pelo z bruto com cortes documentados, exibição a 2 casas; caudas OMS específicas por indicador conforme edição. Percentis apresentados numericamente apenas em domínio de precisão validado; quando fora ou saturado, usar **limite textual**, jamais 0%/100% fictícios. INTERGROWTH usa modelo lognormal contínuo candidato, **sem LMS OMS nem ida-e-volta percentil→z**.
**Ratificar/comprovar:** método/caudas, limites exatos inclusive ±3, política de flags bruto versus arredondado, tolerâncias prospectivas por família, percentis neonatais e prova de casos de cada sexo/indicador, inclusive extremos; não calibrar tolerância retroativamente para acomodar divergência de 55s.

### CL-04 — SISVAN (D + C)
**Decisão proposta:** adotar **MS/SISVAN 2011 como edição-base**, nomenclatura completa e a tabela de intervalos proposta na seção 4 da ficha REV4, com igualdade de cortes exatamente documentada; peso elevado para idade **não** é diagnóstico automático de obesidade; deixar sem rótulo SISVAN a etapa INTERGROWTH.
**Ratificar:** cópia validada de uma tabela de verdade para cada faixa/indicador (z = −3, −2, +1, +2, +3, valores imediatamente próximos), resolução explícita das inconsistências MS 2008/2011 e grupos etários. Sem misturar pontualmente edições.

### CL-05 — Elegibilidade neonatal/nascimento (D + C)
**Decisão proposta conservadora:** INTERGROWTH pós-natal somente após confirmação de contexto compatível com a população de derivação (gestação única; IG ao nascer de 26s0d a 36s6d; sem malformação relevante, RCIU/restrição fetal ou morbidade pós-natal grave informados, considerando a definição clínica); **não** criar proibição automática apenas por IG <33 semanas. Contexto desconhecido ou claramente fora da população: guardar medida e motivo de não classificação automática; não confundir isso com falta de atendimento. Excluir **registro explicitamente ao nascer** e, provisoriamente, idade cronológica civil 0–2 dias do classificador **pós-natal** (regra conservadora local, não padrão universal); não acrescentar Newborn Size nem hora de nascimento.
**Ratificar:** critérios e campos clínicos mínimos, quais exclusões da pesquisa realmente se tornam exclusões de produto, tratamento dos 0–2 dias, e possibilidade de revisão/manualidade. *A equipe de neonatologia/pediatria deve avaliar esta decisão antes de ativar a classificação neonatal.*

### CL-06 — INTERGROWTH contínuo (D + C + E)
**Decisão proposta:** candidato de equações contínuas μ/σ em log natural para **peso por PMA e comprimento por PMA**, com domínio conservador 27s0d–64s0d inclusive; validar contra fonte primária e oráculo Oxford usando dados sintéticos e publicação/edição pinada. Percentil obtido de z direto, evitando saturação/falso 0/100. Não interpolar PDF semanal, importar LMS OMS, adicionar PC/WFL neonatal ou incluir faixas 24–26s sem nova autorização. A concordância documentada de 14 casos/28 resultados sintéticos é **evidência amostral**; registro de 55 semanas, z −3, permanece aberto.
**Para liberar G01:** (1) origem/precisão dos coeficientes comprovada (publicação/suplemento/confirmação do detentor), (2) matriz sintética previamente fixada com tolerâncias e casos diários/limiares/extrêmes, (3) licença/forma comercial de uso de dados, equações e software avaliadas formalmente. O GitHub GPL/MIT NÃO licencia automaticamente os datasets INTERGROWTH.

### CL-07 — Idade corrigida e transição (D + C)
**Decisão clínica candidata recomendada:** PMA=`IG_nascimento_dias + idade_cronológica_dias`; idade corrigida=`idade_cronológica_dias − (280 − IG_nascimento_dias)` sem forçar valores negativos a zero. Manter INTERGROWTH até 64s0d inclusive; a partir de 64s1d passar à OMS **com idade corrigida**, desde que população/método aplicáveis e sob ratificação; guardar PMA, idade corrigida e cronológica; séries separadas.
**Duração proposta a ratificar, não universal:** nascidos <32s0d, corrigir até **36 meses de idade corrigida** com base no estudo de Elmrayed et al. (2025); 32s0d–36s6d, oferecer **24 meses corrigidos** como política conservadora do OctaClin, *sem afirmar comprovação direta desse estrato*. Há referências alternativas (orientações RCPCH antigas 1 ano para 32–36 e 2 anos para <32; serviço digital RCPCH prolonga correção; SBP maio/2023 fala em dois anos para desenvolvimento, não valida sozinha o ponto de corte antropométrico). Isso deve ser ratificado por pediatria/neonatologia.
**Regra de fronteira proposta:** data civil corrigida=`data_avaliação − (280−IGdias)`; comparar com `data_nascimento + prazo de 24/36 meses civis`; incluir o dia-limite e usar idade cronológica no dia seguinte, com regra explícita para 29/02. Nunca alternar por escolha ad hoc do profissional; versão de política no snapshot. Resolver também gestação não informada e ex-prematuros inelegíveis ao IG.

### CL-08 — Interpretação adulta 18–19 (D + C)
**Decisão de segurança:** bloquear a aplicação de equações adultas e interpretação adulta de cintura/RCQ nos <18 conforme produto. Para 18–19, decidir **separadamente seis itens** (Pollock 3, Pollock 7, Faulkner, Guedes, cintura e RCQ): *cada um permanece sem habilitação clínica até que haja publicação/amostra/sexo/idade especificamente verificados*. Não rotular isso como nova proibição generalizada dos <20; é elegibilidade individual pendente por método. Preservar medidas, razão RCQ factual, legados, adultos elegíveis, idosos e precedência de gestação.
**Ratificar:** seis autorizações/suspensões separadas e fontes originais; não inferir validade do `if (idade>=18)` existente no código.

### CL-09 — Plausibilidade, edema, flags (D + C)
**Decisão proposta:** validar medidas positivas/finitas com limites técnicos pediátricos específicos e rejeitar apenas entradas tecnicamente inválidas; medidas plausíveis mas fora da referência são preservadas sem extrapolação. Registrar edema `sim | não | desconhecido`; edema `sim` impede classificação dependente de peso, preservando HFA onde aplicável; `desconhecido` **não é convertido em não**, e a recomendação conservadora é classificar peso somente quando edema foi explicitamente avaliado como não. Flags por indicador como na ficha (HFA <−6/>+6, WFA <−6/>+5, BFA/WFL-WFH <−5/>+5), preferindo aplicação ao z bruto documentada; indicador flagado sem rótulo automático até reconferência, com motivo, peso/altura original e, se indicado, z técnico restrito ao profissional.
**Ratificar:** regra de edema desconhecido, diferença em relação ao software OMS que pode usar z arredondado antes da flag, visibilidade de z suspeito, precisão/corte, critérios de reconferência e campos obrigatórios.

### CL-10 — Acesso, LGPD, RLS e retenção (D + C/Governança + E)
**Decisão de continuidade:** manter acesso do console com papéis e permissões existentes (Professional com carteira ativa; Collaborator/SuperAdmin somente com permissão e tenant válidos), até revisão expressa da finalidade; nenhum portal de menor, consentimento digital de responsável nem novo papel presumido. Backend é autoridade da classificação; contexto pediátrico cifrado em snapshot por avaliação, sem PII/PHI na URL, logs, auditoria, analytics ou cache; retorno via allowlist real, idempotência/locks/409, legado imutável e curvas separadas. Respeitar retenção/retificação já documentadas; não confundir autorização de profissional com representação legal do responsável cadastral.
**Ratificar:** quem pode lançar e quem apenas consultar classificações pediátricas, responsabilidade assistencial, finalidade e retenção/retificação. Separadamente, operador autorizado deve provar migration 1068, role/grants/RLS/DELETE físico em cada ambiente antes de rollout (não inferir pelo CI).

## Quatro aprovações distintas (não confundir)

| Marco | O que exige | Estado inicial |
|---|---|---|
| **P0 — engenharia preparatória** | Autorização textual expressa do proprietário; branch isolada; apenas contratos genéricos/datas civis/DTO sem regras calculadoras, testes sintéticos, feature flag OFF; sem DDL/produção | **Aguardando autorização** |
| **G01 — método e direitos** | Artefatos OMS completos/edição/licença, fonte/coeficientes IG/55s/oráculo, tolerâncias antes de testes, direito concreto de uso em produto comercial | **BLOCKED** |
| **G02 — ratificação clínica** | Respostas individuais CL-01–10 (incl. seis itens CL-08), versões/hashes e referência privada a responsável clínico competente; neonatal com pediatria/neonatologia | **BLOCKED** |
| **G03 — implementação clínica** | Autorização expressa do proprietário, G01 e G02 PASS, critérios dos testes, limites do PR e rollback | **BLOCKED** |
| **G04/G05 — software e implantação** | Suites/PG/R4/CI no HEAD final; evidência externa 1068 + avaliação de produção e autorização de merge/deploy | **SKIPPED/BLOCKED** |

### Escopo concreto proposto para P0, se autorizado
- **Pode:** T03-A cálculo civil de datas/idades, contratos de estados/motivos genéricos e testes unitários determinísticos; inventário T04 de referências/manifesto/hashes sem incorporar artefatos não licenciados; desenho de DTO/serialização somente interno e inativo, fixtures sintéticas; testes de não regressão atuais em ambiente local autorizado.
- **Não pode:** publicar endpoint, alterar papel/permissões, adicionar ao runtime dados/equações de terceiros, calcular ou expor z/percentil/classificação, gravar PHI pediátrica nova, modificar schema/migration, feature ON, publicar PR clínica como concluída, merge/deploy ou acesso a staging/produção.
- **Ordem:** T01/T02 documentais continuam; P0 independe de G01/G02 somente para subfatias sem decisão clínica. Identifique os commits como preparatórios, NÃO como T03/T04 concluídos. Mantenha um escritor ativo e rollback por desativação da feature sem perda de dados.

## Registro de ratificação para equipe/proprietário (preencher fora do Git público)

- [ ] CL-01: edição/idade/routing/bordas ratificados; tabela de verdade anexada.
- [ ] CL-02: técnica neonatal/OMS, <9m, idade de técnica e precisão ratificados.
- [ ] CL-03: caudas/percentil/flags/tolerâncias prospectivas aprovados.
- [ ] CL-04: tabela SISVAN completa (edição, igualdade, rótulo) ratificada.
- [ ] CL-05: elegibilidade e janela 0–2 dias ratificadas por profissional competente.
- [ ] CL-06: método/domínio/precisão e evidências/direitos completos (também G01).
- [ ] CL-07: transição 64s, prazos <32/32–<37, base e datas inclusivas ratificados.
- [ ] CL-08: seis decisões por método, cada uma com evidência ou suspensão explícita.
- [ ] CL-09: edema/flags/medidas/plausibilidade/reconferência ratificados.
- [ ] CL-10: papéis/ato clínico, finalidade, sigilo e retenção ratificados.
- [ ] Responsável clínico competente, versão/hash da ficha, data e registro protegido conferidos.
- [ ] Responsável técnico fechou G01; responsável por direitos analisou uso comercial.
- [ ] Proprietário autorizou G03 e testes previstos (não inclui produção).

O Codex deve registrar status públicos sem dados identificadores; **a assinatura/aceite não pode ser inventada nem substituída pela aprovação técnica deste documento.**

## Fontes externas consultadas para sustentar/restringir estas propostas
- OMS, Child growth standards: https://www.who.int/news-room/questions-and-answers/item/child-growth-standards
- OMS AnthroPlus manual, inclusive **licença do software**, cálculo de idade e interpolação: https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/who-anthroplus-manual.pdf?sfvrsn=ddd24b2_1
- Ministério da Saúde, SISVAN 2011: https://bvsms.saude.gov.br/bvs/publicacoes/orientacoes_coleta_analise_dados_antropometricos.pdf
- Elmrayed et al. (2025), estudo <32 semanas até 36 meses corrigidos: https://doi.org/10.1038/s41372-024-02202-z
- SBP, maio/2023, dois anos para **desenvolvimento**: https://www.sbp.com.br/pediatria-para-familias/primeira-infancia/a-crianca-prematura-suas-peculiaridades-e-o-papel-da-familia/
- RCPCH Digital Growth, políticas antigas/atuais distintas: https://growth.rcpch.ac.uk/clinician/date-age-calculations/
- RCPCH UK-WHO manual de gráficos tradicional: https://www.rcpch.ac.uk/sites/default/files/Using_the_growth_charts.pdf
- INTERGROWTH ferramentas e dúvidas de direitos: https://intergrowth21.tghn.org/standards-tools/
- Villar et al. 2015: https://doi.org/10.1016/S2214-109X(15)00163-1
