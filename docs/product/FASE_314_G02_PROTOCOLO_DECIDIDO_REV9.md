# OctaClin — Fase 314 — Protocolo G02 consolidado (REV9)

**Data:** 2026-10-11  
**Finalidade:** especificação única das decisões clínicas/de produto CL-01 a CL-10 para implementação da antropometria pediátrica.  
**Precedência:** substitui, apenas em caso de divergência, as *propostas* de `DECISOES_RATIFICACAO_FASE_314_REV5.md` e da ficha anterior. Consolida diretamente os desdobramentos REV6–REV8 **que ainda não foram enviados ao Codex**. Não pressupõe que esses arquivos estejam no repositório.  
**Estado do gate:** **G02 = PROTOCOLO DEFINIDO, ACEITE CLÍNICO FORMAL PENDENTE.** Este documento fornece decisões técnicas e clínicas propostas para a versão exata; NÃO é assinatura, parecer de especialista, garantia de eficácia clínica, G01 PASS ou licença de uso dos dados. Sua preparação não autoriza ativação assistencial, merge ou deploy.

## 0. Mandatos já expressos pelo proprietário

- Usar referências OMS 2006/2007 e classificações MS/SISVAN; oferecer IMC/idade, comprimento-estatura/idade, peso/idade e peso/comprimento-estatura, cada qual somente em sua população/faixa.
- Incluir prematuros e idade corrigida. Na fase INTERGROWTH, somente **peso e comprimento por idade pós-menstrual**, sem rótulos SISVAN.
- Preservar medidas originais, snapshots e histórico; não recalcular retrospectivamente nem inferir sexo/técnica/gestação/elegibilidade por peso/nome.
- **CL-08 expressamente decidida pelo proprietário:** fórmulas adultas Pollock 3, Pollock 7, Faulkner e Guedes, e interpretação adulta de cintura e RCQ **liberadas a partir de 18 anos completos**, respeitando dados requeridos e domínio específico de cada método. Revoga a proposta de suspensão universal dos 18–19 anos.
- Autorizar pesquisa, desenvolvimento, testes em ambiente local descartável, commits e PR Draft da Fase 314; **não** autorizar dados reais em calculadoras externas, ativação assistencial não ratificada, merge, migrations em staging/produção ou deploy.

## 1. CL-01 — Idade, transições e referência

**Decisão recomendada para o OctaClin**:
1. Preservar `dataNascimento`, `dataAvaliacao`, idade cronológica em dias civis (datas válidas, sem fuso horário/DST), idade corrigida quando aplicável, idade estatística e idade *efetivamente* utilizada por indicador. Não arredondar a idade antes dos cálculos.
2. **Roteamento local explícito:** OMS 2006 até **1.856 dias efetivos inclusive**; OMS 2007 a partir de **1.857 dias efetivos**, somente no domínio do indicador. É a solução documentada pelo RCPCH para a divergência das fontes na transição; **não é apresentada como determinação universal da OMS**, cujo pacote `anthro` usa corte de 60 meses estatísticos. Criar comparação com `anthro`/`anthroplus` no intervalo de transição e sinalizar a diferença de política.
3. OMS 2006: LMS diário de fonte/versionamento verificados, sem interpolar o eixo diário. OMS 2007: interpolar **L, M e S separadamente** entre âncoras autenticadas para idade estatística `dias_efetivos/30,4375`, sem extrapolar; não interpolar z nem percentil.
4. Domínios computacionais candidatos `anthroplus`: HFA e BFA em `[60,229)` meses estatísticos, WFA em `[60,121)` meses estatísticos; a cobertura efetiva começa apenas após a regra de roteamento. O limite de WFA não implica classificação em outras referências fora de sua população. WFL/WFH usam grades oficiais próprias, restritas à faixa <5 anos clinicamente definida e comprimentos/estaturas elegíveis.
5. **Idade civil e faixas SISVAN são independentes do roteamento matemático.** Aos cinco anos civis, usar a terminologia da faixa SISVAN ≥5, mesmo quando a fonte LMS ainda for OMS 2006 por alguns dias. Exibir ambas as bases sem falsa continuidade.
6. Aos **19 anos e 1 mês até antes do 20º aniversário**, aplicar a adaptação SISVAN já escolhida: IMC/idade usa os parâmetros de **19 anos completos**, identificando expressamente `referenciaEfetiva=228_meses`. Não estender automaticamente estatura/idade ou peso/idade; no 20º aniversário, encerrar a regra pediátrica e aplicar a elegibilidade adulta pertinente.
7. **29/02:** para *marcos civis* e anos não bissextos, adotar 01/03. Manter 29/02 como nascimento real e idade estatística em dias exatos. Para soma de meses civis, quando o dia de destino não existe usar o último dia daquele mês (com convenção explicitamente versionada). A regra de 29/02 é política de software, não conclusão jurídica universal.

**Provas obrigatórias:** 29/02, 730/731, 1.826/1.827, 1.856/1.857, 60/61, 120/121, 228/229 meses, aniversários civis de 2/5/10/19/20 anos e frações limítrofes; nenhum buraco, dupla classificação ou extrapolação silenciosa.

## 2. CL-02 — Técnica de aferição

1. Para referência OMS, usar comprimento **deitado se idade efetiva <731 dias** e estatura **em pé se >=731 dias**; registrar a técnica realmente usada, sem inferi-la da medida.
2. Se aferição em pé quando referência exige comprimento, normalizar com **+0,7 cm**; se deitado quando referência exige estatura, **−0,7 cm**. Exatamente uma conversão, preservando original, valor utilizado e direção do ajuste. IMC factual original e IMC utilizado para a curva devem ser distinguíveis.
3. Ex-prematuros em OMS corrigida: a **idade corrigida efetiva determina a referência e o ajuste**, enquanto idade cronológica e técnica real permanecem visíveis. É uma política local deliberada, sujeita à revisão neonatal antes da ativação.
4. Em pé **antes de nove meses de idade efetiva OMS**: solicitar reconferência e **não classificar automaticamente** os indicadores dependentes de medida linear (HFA, BFA, WFL/H); WFA pode continuar, se independente e elegível. Técnica desconhecida impede apenas índices que dependam dela.
5. INTERGROWTH pós-natal: exigir comprimento recumbente para o índice de comprimento; não aplicar ±0,7 cm OMS por analogia. Peso pode permanecer elegível se a técnica linear for insuficiente.
6. Captura sugerida: peso em kg com até 0,001 kg e comprimento/estatura em cm com até 0,1 cm, respeitando resolução real da aferição; não inventar dígitos. Tratar precisão maior somente com política de lookup demonstrada em G01.

## 3. CL-03 — Método estatístico e exibição

1. Z **bruto/não arredondado** é o valor de decisão clínica, caudas e flags; exibir Z com **2 casas decimais**, preservando precisão técnica em snapshot cifrado. Não arredondar IMC antes da classificação.
2. OMS: LMS e tratamento de cauda por família/edição, jamais regra de cauda global; altura/idade não herda automaticamente correções de indicadores de peso. `L=0` usa limite logarítmico. Aplicar correção de ±3 apenas onde a metodologia oficial mandar.
3. OMS: percentis numéricos somente no domínio documentado (candidato `|z|<=3`); fora, exibir **'abaixo/acima do limite de percentil da referência'**, com limite identificado, não falso 0%/100%.
4. INTERGROWTH: Z contínuo direto em log natural, nunca converter Z→percentil→Z; percentis extremos: exibir **`<P0,1` ou `>P99,9`** quando fora desse intervalo de apresentação, como convenção local de UI, não ponto de corte clínico. Percentil dentro do intervalo deve ser numérico e declarado como estatístico; se não confiável, exibir indisponível.
5. Resultados flagados preservam dado e **Z técnico visível somente ao profissional, com aviso**, mas **não** geram categoria SISVAN automática até reconferência. Definir em G01 tolerâncias *a priori* (z/percentil/medidas) por família de referência e comparar com oráculos; divergência de 55 semanas INTERGROWTH não pode ser absorvida ajustando tolerância depois do teste.

## 4. CL-04 — SISVAN e fronteiras, fonte principal MS 2011

Interpretar cortes abaixo pelo **Z bruto** e exibir rótulos completos:

| Indicador | Intervalo de Z | Rótulo |
| --- | --- | --- |
| Peso/idade | `z < -3` | Muito baixo peso para a idade |
| Peso/idade | `-3 <= z < -2` | Baixo peso para a idade |
| Peso/idade | `-2 <= z <= +2` | Peso adequado para a idade |
| Peso/idade | `z > +2` | Peso elevado para a idade |
| Comprimento/estatura por idade | `z < -3` | Muito baixa estatura para a idade |
| Comprimento/estatura por idade | `-3 <= z < -2` | Baixa estatura para a idade |
| Comprimento/estatura por idade | `z >= -2` | Estatura adequada para a idade |
| IMC/idade <5 anos; peso/comprimento-estatura aplicável | `z < -3` | Magreza acentuada |
| Idem | `-3 <= z < -2` | Magreza |
| Idem | `-2 <= z <= +1` | Eutrofia |
| Idem | `+1 < z <= +2` | Risco de sobrepeso |
| Idem | `+2 < z <= +3` | Sobrepeso |
| Idem | `z > +3` | Obesidade |
| IMC/idade >=5 anos/adolescentes | `z < -3` | Magreza acentuada |
| Idem | `-3 <= z < -2` | Magreza |
| Idem | `-2 <= z <= +1` | Eutrofia |
| Idem | `+1 < z <= +2` | Sobrepeso |
| Idem | `+2 < z <= +3` | Obesidade |
| Idem | `z > +3` | Obesidade grave |

**Condições:** aplicar faixas por idade civil clínica e elegibilidade de cada indicador; peso elevado para idade NÃO equivale a obesidade; INTERGROWTH NÃO recebe rótulos SISVAN. A tabela é o contrato proposto; a ficha de origem registra divergências de desigualdades/editoriais MS 2008/2011 — **não marcar ratificação numérica sem conferência humana da edição escolhida**. Testar exatamente `-3/-2/+1/+2/+3` e vizinhanças.

## 5. CL-05 — Elegibilidade e primeiras medições de prematuros

1. INTERGROWTH pós-natal automático somente com: **gestação única**; idade gestacional ao nascer confirmada entre **26s0d e 36s6d**; sem malformação congênita importante, restrição de crescimento fetal ou morbidade pós-natal grave documentadas que retirem comparabilidade com a população do estudo de Villar 2015. Campos da elegibilidade `sim/não/desconhecido` com fonte da informação, sem presunção automática de `não`.
2. O limiar de **33 semanas não é exclusão automática**. Falta de contexto, gestação múltipla ou condições fora da população de derivação => conservar medidas e história, estado `referencia_nao_validada_para_contexto` e explicação; profissional segue apto a prestar atendimento sem classificação automática específica desse modelo.
3. Distinguir por campo explícito `medida_ao_nascer | acompanhamento_posnatal | contexto_desconhecido`. **Não** inferir por ser a primeira avaliação lançada no OctaClin.
4. **Dias cronológicos 0, 1 e 2 completos** ou medida declarada de nascimento: não usar classificador pós-natal nesta fase, mesmo se a PMA estiver no domínio. Salvar medidas/motivo; não incorporar Newborn Size nesta fase. A janela 0–2 dias é **política conservadora local**, não corte universal do INTERGROWTH.
5. Guardar IG semanas + dias, fonte, contexto de nascimento/medida e critérios de elegibilidade somente no contexto clínico cifrado. Sexo de curva selecionado explicitamente.

## 6. CL-06 — Método neonatal escolhido como alvo de validação

1. Modelo contínuo INTERGROWTH candidato, **peso/idade pós-menstrual e comprimento/idade pós-menstrual**, domínio **27s0d (189 dias) a 64s0d (448 dias) inclusive**. Sem classificação pelo modelo quando PMA <189 ou >448 dias, sem extrapolação.
2. Peso em kg, comprimento recumbente em cm, sexo da curva explícito; Z por `z=(ln(y)-mu(PMA,sexo))/sigma(PMA)`, conforme coeficientes atribuídos a Villar et al. e descritos no relatório técnico REV3 do projeto. Não reaproveitar LMS da OMS, interpolar quantis semanais arredondados ou adotar domínios 24–64s6d de bibliotecas por conveniência.
3. Não adicionar perímetro cefálico, peso/comprimento neonatal, curva de tamanho ao nascer ou rótulos SISVAN neste escopo.
4. **Aceite de CL-06 é condicionado ao G01** quanto a origem/precisão dos coeficientes, exemplos/oráculo, caudas e direitos de incorporação. O método é política-alvo de implementação isolada, NÃO resultado clínico autorizado.

## 7. CL-07 — Transição e idade corrigida

1. `PMA_dias=IG_nascimento_dias+idade_cronologica_dias`; `DPP=dataNascimento+(280-IG_nascimento_dias) dias`; `idadeCorrigida_dias=dataAvaliacao-DPP`. Não zerar idade corrigida negativa.
2. INTERGROWTH até **64s0d** inclusive; a partir de **64s1d** (449 dias PMA) passar à OMS com idade corrigida, se sua população, idade e indicadores forem aplicáveis. Preservar as duas idades e não conectar séries heterogêneas sem sinalização.
3. **IG <32s0d:** correção até **36 meses civis completos de idade corrigida**, incluindo a data-limite. Apoio específico: Elmrayed et al. (2025) para <32 semanas, não ensaio universal.
4. **IG 32s0d a 36s6d:** correção até **24 meses civis completos de idade corrigida**, incluindo a data-limite. **Escolha local deliberada** do OctaClin; não declarar validação específica por esse estudo, nem copiá-la como padrão universal.
5. No **dia posterior** ao limite corrigido, referenciar OMS com **idade cronológica** e armazenar a transição de política. Calcular limites pela **DPP + 24 ou 36 meses civis** com regra 29/02 e meses inexistentes da CL-01, sem usar aproximações fixas em dias. Não oferecer seletor livre de política ao operador.
6. Se gestação/IG ausente, a aplicação de correção é **indeterminada**; não inferir termo, prematuridade ou atribuir automaticamente idade corrigida. Em prematuros inelegíveis ao INTERGROWTH, a OMS **pode ser aplicável após a janela neonatal** se as condições OMS forem atendidas; inelegibilidade INTERGROWTH não prova inelegibilidade OMS. Registrar condições especiais, não extrapolar nem diagnosticar.
7. Usar idade corrigida também na técnica de referência OMS durante a janela de correção, conforme CL-02; a medida realmente aferida permanece original.

## 8. CL-08 — Fórmulas e índices adultos desde 18 anos (decisão expressa)

1. **Idade mínima = 18 anos civis completos, inclusiva** para interpretação adulta por Pollock 3, Pollock 7, Faulkner, Guedes, cintura e RCQ. O bloqueio de <18 permanece. Esta regra **substitui integralmente** a recomendação antiga de suspensão universal dos 18–19 anos.
2. Entre 18 e 19 anos completos, aplicar cada fórmula **quando os requisitos específicos de sexo, população, medidas, unidades, condições fisiológicas e domínio documentado estiverem satisfeitos**; não inventar dados, extrapolar o domínio da equação ou tornar a validação científica universal pelo simples fato de a pessoa ter 18 anos.
3. Preservar bloqueios gestacionais, medida factual da cintura e RCQ factual mesmo quando sua **interpretação** não se aplica. Manter comportamento legado para adultos elegíveis e não recalcular registros anteriores.
4. **Não substituir automaticamente IMC/idade SISVAN por IMC adulto aos 18–19 anos**: composição/cintura adultas e IMC/idade são indicadores distintos e podem coexistir de acordo com suas faixas de aplicação.
5. Status: **DECISÃO DE PRODUTO APROVADA PELO PROPRIETÁRIO**; evidência e testes por fórmula permanecem obrigação técnica/qualidade, sem retornar à suspensão 18–19 por default.

## 9. CL-09 — Plausibilidade, edema, flags e resultado parcial

1. Medidas tecnicamente inválidas (não finitas, não positivas ou formato impossível) rejeitadas; medidas fora de tabela mas passíveis de registro **preservadas** com motivo. Não impor mínimo adulto de 1 kg/30 cm ou IMC 8–100 como critério neonatal.
2. Edema `sim`: suprimir classificação dos indicadores dependentes de peso (WFA, BFA, WFL/H, peso/PMA); HFA e comprimento/PMA independentes podem seguir quando válidos. Edema `desconhecido`: **solicitar aferição/confirmação; não liberar classificação por peso até `não` ser confirmado**. Guardar estado original sem inferir `não`.
3. Flags por Z bruto: HFA `<−6` ou `>+6`, WFA `<−6` ou `>+5`, WFL/H e BFA `<−5` ou `>+5`. Nos pontos de corte exatos, não aplicar flag estrita; testar vizinhança. *São filtros de plausibilidade, não diagnóstico ou substitutos de validação clínica.*
4. Indice flagado: conservar a medida e o Z técnico **visível ao profissional autorizado com aviso explícito**, mas **sem classificação nutricional automática** até reconferência; outros índices continuam independentes e válidos. Estado/motivo separados por indicador.
5. Extremos INTERGROWTH exigem política de plausibilidade **específica validada**; não copiar limiares OMS automaticamente. Sem essa validação, valor extremo pode ser exibido como técnico/suspeito sem rótulo conclusivo.

## 10. CL-10 — Responsabilidade, autorização e segurança

1. **Política de produto proposta:** **Professional** com carteira válida e permissão apropriada pode **criar/retificar por novo snapshot** avaliação pediátrica. **Collaborator** com permissão `pacientes.ler` e escopo de tenant pode **consultar** resultados, sem emitir nova classificação pediátrica nesta fase. **SuperAdmin** somente leitura autorizada/auditada para necessidade administrativa excepcional, sem ato de lançamento clínico pediátrico. Essa é uma **mudança de permissão pediátrica em relação a fluxos legados**; implementar guards reais, com testes e aceite explícito do proprietário para a restrição de papéis.
2. Sem novo portal pediátrico, consentimento ou representação legal presumida a partir de cadastro de responsável. Respeitar finalidade, política de retenção/retificação/exclusão lógica vigente; não inventar prazos legais novos. Mudança de contexto registrada como **novo snapshot**, sem editar resultados anteriores.
3. Dados clínicos pediátricos permanecem cifrados; isolamento tenant/carteira/RLS, authorization antes de replay, fingerprint oculto, allowlists por endpoint, cache privado/no-store, nenhum PHI em logs/URLs/auditoria/analytics. Testar com role não-owner em PostgreSQL descartável.
4. Migration 1068 integrada ao repositório **não é evidência de aplicação em staging/produção**. Esse controle pertence a G00-operacional/G05, não substitui G02 e não impede testes locais.

## 11. Casos de aceite obrigatórios (identificados, não executados)

| ID | Caso sintético | Resultado obrigatório |
| --- | --- | --- |
| A01 | Nascimento 29/02; aniversário em ano comum | marco civil 01/03; DOB preservado; idade WHO em dias exatos |
| A02 | Idade efetiva 1856 / 1857 dias | OMS 2006 / OMS 2007, fonte e método explícitos |
| A03 | Quinto aniversário civil antes de completar 1857 dias | categoria etária SISVAN ≥5; curva OMS2006 se idade efetiva <=1856; avisar bases diferentes |
| A04 | WFA 120/121 meses; HFA/BFA 228/229 meses | bordas sem extrapolação, estado individual de indisponibilidade |
| A05 | 19a1m e véspera/aniversário de 20 anos | BFA aos 228 meses efetivos até antes 20; aos 20 interromper adaptação |
| A06 | Medida em pé em idade efetiva OMS <9 meses | sem HFA/BFA/WFL-H; WFA independente permitido |
| A07 | Idade OMS 730/731 com técnica inversa | +0,7/−0,7 UMA vez, original intacto |
| A08 | Sem técnica ou sem sexo da curva | índices afetados não classificados; medidas salvas |
| A09 | Z exatamente −3/−2/+1/+2/+3 e valores adjacentes | um único rótulo por indicador/grupo; aplicar regra exata |
| A10 | Nascimento IG32s0d, avaliação após28 dias | PMA36s0d, corrigida−28 dias, sem clamp; não aplicar OMS inadequadamente |
| A11 | PMA 27s0d/64s0d/64s1d | IG elegível no primeiro/segundo; OMS corrigida após borda se aplicável |
| A12 | IG31s6d versus 32s0d, nas datas-limite de 36/24 meses corrigidos | janela versionada correta; cronológica somente no dia seguinte |
| A13 | Dia0, dia1 e dia2 após nascimento prematuro | conservar medidas, sem z automático IG pós-natal |
| A14 | Gestação múltipla/RCIU/morbidade grave ou desconhecida | conservar medidas, sem classificação IG automática; razão explícita |
| A15 | IG fora da população neonatal que depois alcance faixa OMS | avaliar aplicabilidade OMS separadamente, sem herdar exclusão IG |
| A16 | Idades 17a364d/18a0d/19a/20a, seis interpretações adultas | <18 bloqueadas; >=18 permitidas se método específico aplicável; gestação prevalece |
| A17 | Edema sim/não/desconhecido | apenas `não` libera índices dependentes de peso; os outros preservados |
| A18 | Z suspeito por flag estrita e vizinhanças | exibir Z com alerta, sem classe; estado independente dos demais |
| A19 | Escrita por Professional, Collaborator, SuperAdmin e tentativa cross-tenant | somente Professional autorizado escreve pediátrico; leitura e isolamento conforme CL10 |
| A20 | Revisão de contexto, alteração DOB, replay concorrente, exclusão lógica | snapshot anterior preservado, autorização revalidada, idempotência e RLS comprovados |

**Validação do G02:** a tabela acima estabelece *comportamentos esperados*, não afirma que testes foram executados nem que G01 está matematicamente validado. O Codex deverá elaborar oráculos/fixtures com resultados numéricos fechados mediante G01, executar e relatar PASS/FAIL/SKIPPED por teste.

## 12. Registro necessário e status honesto dos gates

- **G02-T (protocolo pronto para aceite): PREPARADO nesta REV9.** Recomendações e decisões de produto são explícitas. Não requer nova rodada de alternativas do Codex.
- **G02-C (ratificação por responsável competente): PENDENTE ATÉ ACEITE EXPLÍCITO desta versão e das exceções.** Registrar fora do Git público responsável e competência, data, texto/versão, hash SHA-256 da versão definitiva e referência protegida ao aceite. Recomendada revisão pediatria/neonatologia focada em CL-02, CL-05 e CL-07. Caso o proprietário nutricionista aprove dentro de seu âmbito, registrar suas aprovações e os pontos sujeitos a co-revisão, sem criar assinatura de especialista inexistente.
- **G01:** permanece BLOCKED para metodologia/artefatos, oráculos abrangentes, direitos e discrepância IG 55 semanas. Aprovação G02 **não** converte G01 em PASS.
- **G03-D:** desenvolvimento local/testes/PR Draft autorizados pelo proprietário em conversa anterior; conferir autorização vigente no ambiente de execução. **G03-A:** ativação clínica não autorizada sem G01 e G02-C.
- **G04/G05:** testes integrais do código e implantação ainda exigem evidência em HEAD final, revisão R4 e autorização separada. Não fazer merge/deploy.

### Formulário para aceite **humano** (NÃO preencher pelo Codex)

> Confirmo que revisei a REV9 do protocolo G02 da Fase 314. Decisões CL-01–CL-10 aprovadas dentro do meu âmbito profissional: [SIM/NÃO, exceções]. Questões reservadas a co-revisão especializada: [CL e observações]. Responsável e competência: [registro interno]. Data: [data]. Versão/hash SHA-256: [informar]. Registro de aprovação protegido: [identificador interno].

**O Codex pode preparar o registro e conferir o hash, mas não assinar, inventar ratificação ou ativar protocolo provisório em pacientes reais.**

## 13. Fontes fundamentais para o Codex verificar e fixar em manifesto

- OMS, child growth standards / 0–5: https://www.who.int/tools/child-growth-standards
- OMS, WHO 2007 / 5–19 e indicadores: https://www.who.int/tools/growth-reference-data-for-5to19-years
- OMS, guia Anthro / ajuste 0,7 cm: https://www.who.int/docs/default-source/child-growth/child-growth-standards/software/anthro-survey-analyser-quickguide.pdf
- RCPCH, transição/limites OMS: https://growth.rcpch.ac.uk/developer/who-reference-implementation/
- Ministério da Saúde, orientações 2011: https://bvsms.saude.gov.br/bvs/publicacoes/orientacoes_coleta_analise_dados_antropometricos.pdf
- Villar et al., 2015, INTERGROWTH pós-natal: https://pubmed.ncbi.nlm.nih.gov/26475015/
- Elmrayed et al., 2025, correção de idade <32 semanas: https://www.nature.com/articles/s41372-024-02202-z
- RCPCH, políticas tradicionais e digitais distintas: https://growth.rcpch.ac.uk/clinician/date-age-calculations/
- Fontes, hashes, INVESTIGACAO_INTERGROWTH_REV3 e manuscritos já presentes no repositório OctaClin; **não assumir que arquivos REV6–REV8 ou resultados de testes deste ChatGPT foram enviados ao Codex**.

## 14. Instrução de integração

1. Conferir o caminho físico deste arquivo no repositório. Não afirmar que ele existe se ainda não tiver sido copiado.
2. Integrar regras sem duplicar outras versões ou eliminar histórico: atualizar ficha clínica, plano, tarefas e manifesto, registrando *REV9 como protocolo preferencial*.
3. Atualizar CL-08 desde 18 anos e CL-10 como mudança pediátrica explícita; sempre gerar provas de regressão e segurança.
4. Implementar parte independente e, onde houver dependência clínica ou de direitos pendente, manter cálculo experimental isolado/feature flag OFF no backend. Nenhum uso assistencial automático antes de G01/G02-C.
5. Entregar diff, testes realmente executados, tabela de conflitos com versões anteriores e o **único** registro de aceite humano necessário, sem abrir nova rodada de planejamento.
