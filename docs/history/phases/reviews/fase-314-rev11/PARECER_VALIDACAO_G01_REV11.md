# OctaClin — Fase 314 | Parecer G01 REV11

**Data:** 11/10/2026. **Natureza:** pesquisa computacional independente do runtime OctaClin. **Resultado global:** `G01 = PARTIAL / BLOCKED`, não `PASS`. **G02:** protocolo REV9 expressamente ratificado pelo proprietário em conversa; formalização institucional e eventual revisão especializada seguem conforme governança.

## 1. O que foi executado aqui

Foi criado um motor matemático de pesquisa em Python stdlib, **NÃO autorizado para produção**. Criou-se primeiro a bateria de testes, cuja execução inicial falhou porque o motor ainda não existia (ciclo RED); em seguida o motor foi implementado e os testes foram executados com sucesso (GREEN). Não houve dados de pacientes nem acesso a ambientes do OctaClin. Rodou-se `python -m unittest -v test_g01_rev11.py`: **13 testes de suíte PASS**, log `execucao_unittest.txt`.

| Frente | Prova executada | Resultado | Limitação |
| --- | --- | --- | --- |
| **OMS 2006 — 0 a 731 dias** | 144 valores de referência externos: ambos sexos × IMC/idade, comprimento/estatura/idade e peso/idade × 8 idades × z nominal -2/0/+2. Gold publicado pelo RCPCH, atribuído ao pacote oficial WHO `anthro_measurements`; LMS conferido com dados oficiais da OMS. | **PASS amostral**: máximo erro absoluto Z `1,0980290419e-6`, limiar pré-definido no teste `5e-5`. | Não prova integralidade de 1.857 idades/todas as medidas; amostra de 0 a 731 dias. |
| **OMS — origem dos coeficientes** | 48 triplas (L,M,S) WHO `WorldHealthOrganization/anthro` confrontadas com os coeficientes da amostra RCPCH. | **48/48 exatas**. | Não são todas as 16 planilhas, nem licença confirmada. |
| **OMS 2006 — exemplos da própria OMS** | 4 perfis sintéticos do README WHO `anthro`, com Z publicados para IMC/idade, estatura/idade e peso/idade. | **12/12 PASS**, erro máximo `0,004691861`, tolerância `0,005` porque o oráculo publica 2 decimais. | Não abrange todas as idades/caudas. |
| **OMS 2006 — peso/estatura** | 4 Z de peso/estatura (WFH) publicados pelo WHO `anthro`, dados LMS oficiais para aferições 80, 100, 120 cm. | **4/4 PASS**, erro máximo `0,003913583`, tolerância `0,005`. | Peso/comprimento WFL passou apenas em invariantes matemáticos, sem oráculo externo de Z. |
| **OMS — WFL/WFH** | 20 triplas de coeficientes oficiais, ambos sexos, medidas nos limites e intermediárias; mediana resulta Z≈0 e inversão z=2 preservada. | **PASS de consistência local**. | Não substitui validação de grade integral, interpolação arbitrária e todas as fronteiras. |
| **OMS 2007 — caso de 11 anos** | Menino, IMC 30, L=-1,7862, M=16,9392, S=0,1107. | LMS direto `3,2353902101`; cauda corrigida `3,3539025561`, conforme exemplo transcrito na ficha REV4. | Verificação aritmética do exemplo do documento recebido; não confronto integral com o software AnthroPlus. |
| **OMS — idade 1856/1857** | Roteamento previsto pela REV9, interpolação 2007 apenas com âncoras adjacentes, sem clamp silencioso. | **PASS de política de roteamento e cálculo sintético**. | Decisão local; RCPCH adota esta transição, WHO Anthro estatístico pode usar outro corte. |
| **INTERGROWTH — 7 fixtures anteriores** | 7 cenários pré-existentes × peso/comprimento: 14 Z + 14 percentis. | **28/28 verificações de consistência** com os resultados anteriores. | Oráculo não independente: as fixtures anteriores derivaram das mesmas equações. |
| **INTERGROWTH — grade diária completa** | Todos os 260 dias PMA 189–448 × 2 sexos × 2 indicadores × 7 Z-alvo (-4,-3,-2,0,+1,+2,+4). | **7.280 roundtrips sem falhas.** | Teste de inversão algébrica, não compara com Oxford nem certifica as equações científicas. |
| **INTERGROWTH — 55 semanas** | Peso masculino para z=-3 com as equações candidatas. | Equação `4,4050264780 kg`; quantil PDF transcrito `4,40 kg`; diferença **0,0050264780 kg**. Para 4,40 kg, z=`-3,0088689219`. | **Discrepância mantida aberta**, não ajustar tolerância retrospectivamente. |

**Comparações com Z publicados por fontes externas realizadas nesta sessão:** **160** (144 + 12 + 4), todas dentro da tolerância declarada para a respectiva fonte. Isso não significa 160 populações, dias ou curvas integralmente verificados.

## 2. Descobertas metodológicas relevantes

1. **WHO Anthro oficial:** `anthro_zscores` exige idade exata em dias, aplica +0,7 cm a aferição em pé antes de 731 dias e -0,7 cm a aferição deitada a partir de 731 dias; o software estatístico `anthro` especifica idade `<60 meses` para calcular escores. A REV9 do OctaClin ratificou **política local distinta: OMS 2006 até 1856 dias inclusive; OMS 2007 desde 1857**, inspirada no RCPCH. O Codex deve preservar essa diferença e testar possíveis descontinuidades/efeitos clínicos.
2. **OMS 2007:** os arquivos e pacotes diferem na existência da âncora mês 60. A amostra RCPCH contém mês 60; as planilhas expandidas do manifesto original começam no mês 61. Não inventar extrapolação. Fixar fonte completa/versão/âncoras e provar lookup em 1857, 120/121 meses, 228/229 meses e 19–20 anos.
3. **Duas referências não formam curva única:** uma criança com mesmo IMC em 1856/1857 dias pode mudar de Z apenas pela troca de fonte. Exemplo sintético masculino IMC 15,2: `z1856≈0,012046` contra `z1857≈−0,050214` na implementação local da pesquisa. A diferença não é falha aritmética automaticamente: deve ser mostrada como troca de base e testada no OctaClin.
4. **ISO/Técnica:** aos 730/731 dias a mediana de comprimento/estatura masculina na amostra WHO varia `87,8018 cm` → `87,1303 cm` por troca de referencial deitado/em pé; registrar medida, posição e ajuste, evitar dupla correção.
5. **INTERGROWTH:** z é `(ln(medida)−μ)/σ` com μ/σ definidos no log natural da medida. A inversão evita saturação por ida e volta através do percentil, mas não resolve por si só procedência científica nem licença. Não ampliar 27–64 semanas por uma biblioteca aceitar intervalo maior.

## 3. Fontes e reprodutibilidade

### Fontes primárias/fornecedores

- **WHO anthro (OMS):** https://github.com/WorldHealthOrganization/anthro/tree/b776d8a12b1c97369c748b561159fd2ec4f4db58/data-raw/growthstandards — fonte dos coeficientes pesquisados (bmianthro, lenanthro, weianthro, wflanthro, wfhanthro). Fonte da demonstração clínica: https://worldhealthorganization.github.io/anthro/ . Commit observado: `b776d8a12b1c97369c748b561159fd2ec4f4db58`.
- **RCPCH WHO 2006/2007:** https://growth.rcpch.ac.uk/developer/who-reference-implementation/ . Amostra Gold WHO `anthro_measurements` 192 casos (144 para indicadores no escopo do OctaClin) + dados LMS: https://github.com/rcpch/rcpchgrowth-python/tree/d70093121c073997e352976398264bc3301f0c8d/rcpchgrowth/ . Commit observado: `d70093121c073997e352976398264bc3301f0c8d`.
- **OMS 2007:** https://www.who.int/tools/growth-reference-data-for-5to19-years/ .
- **INTERGROWTH:** Villar et al., 2015, https://pubmed.ncbi.nlm.nih.gov/26475015/ . Fórmulas candidatas transcritas da investigação REV3, anteriormente confrontadas por Codex com serviço de Oxford. Os JSON oficiais originais das respostas de Oxford **não vieram neste pacote** e não foram reexecutados nesta sessão.

### Arquivos relevantes do pacote

- `g01_engine_rev11.py`: funções de pesquisa puras, **proibido incorporar ao runtime assistencial sem G01 e direitos**.
- `test_g01_rev11.py`: testes automatizados (13 testes).
- `WHO2006_48_COEFICIENTES_OFICIAIS_ANTHRO.csv`: 48 triplas de dados oficiais na amostra.
- `WHO2006_AMOSTRA_GOLD_RCPCH.csv`: 48 linhas contendo 144 valores independentes de referência.
- `WHO2006_EXEMPLOS_DOCUMENTADOS_ANTHRO.csv`: 12 oráculos Z publicados pela OMS.
- `WHO2006_WFH_WFL_AMOSTRA_OFICIAL.csv`: 20 triplas da OMS, incluindo WFL e WFH.
- `WHO2007_AMOSTRA_LMS_RCPCH.csv`: algumas âncoras ilustrativas, **não contém tabelas completas**.
- `FASE_314_FIXTURES_SINTETICAS_REV8.json`: fixtures anteriores **não independentes** de INTERGROWTH.
- `OMS2006_144_COMPARACOES.csv`, `OMS2006_12_COMPARACOES_DIRETAS_WHO.csv`, `OMS2006_4_WFH_COMPARACOES_OFICIAIS.csv`, `INTERGROWTH_14_COMPARACOES_INTERNAS.csv`: resultados individuais.
- `resultado_resumo_G01_REV11.json`: métricas, estados reais e hashes dos artefatos de prova.
- `execucao_unittest.txt`: saída efetiva dos testes.
- `gerar_evidencias_rev11.py`: reprodução em Python stdlib, sem acesso à rede ou PHI.

**Para reproduzir:** extrair a pasta REV11 e rodar, dentro dela, `python -m unittest -v test_g01_rev11.py` e `python gerar_evidencias_rev11.py`. Os scripts não exigem dependências de terceiros. Gerar novamente em ambiente controlado preserva resultados numéricos, mas o timestamp e hashes derivados de logs podem mudar.

## 4. Tarefas finais do G01 — fechadas e verificáveis

- [ ] **OMS 2006/2007, 16 planilhas:** baixar fonte oficial direta do manifesto, verificar SHA-256, edição, todas as abas/linhas, sexo/unidades, limites, 0–1856 dias e âncoras 60/61/120/121/228/229; adaptar fontes permitidas conforme condições legais. A rede deste ambiente não permitiu baixar os binários `cdn.who.int` nesta sessão. Os hashes anteriormente documentados no manifesto não são rechecagens desta sessão.
- [ ] **Todos os indicadores:** confrontar toda faixa de peso/idade, estatura/idade, IMC/idade e peso/comprimento-estatura, com amostras oficiais independentes por sexo, caudas, bordas e técnica (incluindo WFL/WFH com interpolação entre 0,1 cm). 160 comparações em amostra não provam o domínio completo.
- [ ] **INTERGROWTH:** obter/arquivar evidência primária da procedência e precisão dos coeficientes, fixar versão, ampliar comparações **realmente independentes** com o serviço oficial de Oxford (exclusivamente entradas sintéticas) cobrindo todos os dias necessários, caudas e limites; investigar a divergência quantil55s sem maquiagem de tolerância. As 7.280 verificações internas não fecham este item.
- [ ] **Licenciamento comercial (G00-fonte):** confirmar direitos por camada (fonte científica, coeficientes, coleções/dados, planilhas, gráficos, código de terceiros e atribuição), inclusive utilização por SaaS comercial. Não presumir liberação pela disponibilidade pública e não copiar código AGPL/GPL para o OctaClin sem avaliação de obrigações. A presente amostra é destinada a pesquisa/testes, não a publicação de tabelas no produto.
- [ ] **OctaClin em TS:** executar os mesmos oráculos contra **o código real no HEAD final**, com feature flag protetiva, Jest, testes reais PostgreSQL/RLS e regressões; conservar proveniência de cada resultado e revisar falso PASS, truncamentos e transição de fonte.

**Critério do gate:** somente marcar `G01=PASS` se todos os critérios computacionais, referências e permissões necessárias para a implementação efetiva estiverem comprovados, com evidência vinculada à versão e ao HEAD. Enquanto isso: `G01=PARTIAL/BLOCKED`, desenvolvimento isolado autorizado pelo proprietário, **ativação clínica vedada**.

## 5. Direitos e limite jurídico

Este parecer não constitui licença de redistribuição ou parecer jurídico. O fato de uma biblioteca ser gratuita ou disponibilizar código aberto não prova que as tabelas, materiais e coleções subjacentes possam ser incorporados comercialmente. O pacote entrega **amostras pequenas para validação** e não os 16 datasets completos.
