# FOOD06 — parecer de fontes, direitos e concordância documental

Rodada de 2026-10-30, na branch `docs/food06-contratos-fontes` (#455).
O CI de `644397a3` concluiu 21 checks com sucesso e SBOM provenance SKIPPED.
Esses checks não validam o delta desta rodada nem as tabelas clínicas.

## Conclusão sobre licença

Foi conferida uma cadeia concreta de evidências oficiais:

1. [Registro/API oficial DRI](https://open.canada.ca/data/api/3/action/package_show?id=77fae12d-1ef0-431e-98df-451a4f7951c3)
   identifica o recurso Dietary Reference Intakes e licença `ca-ogl-lgo`.
2. Entre os recursos licenciados consta o [índice das tabelas](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables.html).
   GET nesta rodada confirmou links para as páginas atuais de vitaminas e elementos
   usadas na conferência, não apenas uma hipótese de endereço semelhante.
3. A [OGL-Canada](https://open.canada.ca/en/open-government-licence-canada) autoriza
   uso comercial, adaptação e distribuição sob condições de atribuição e ausência
   de endosso. A política exclui direitos de terceiros não licenciáveis pelo provedor.
4. As páginas selecionadas não apresentaram aviso específico de terceiros na
   área das tabelas examinada. Isso não prova inexistência de todos os direitos
   subjacentes. O registro é de 2020 e as páginas de 2025; o vínculo atual está
   comprovado, mas a ressalva de terceiros precisa constar do aceite de direitos.

Resultado: **licença e vínculo documental identificados**; ainda não há parecer
institucional definitivo sobre exceções de terceiros. Não declarar autorização
irrestrita de reproduzir livros National Academies ou materiais NIH citados.
A implementação pretendida deve usar somente fatos selecionados e estrutura
própria, sob atribuição de Health Canada e referência à licença; sem logotipos,
reprodução integral de livros, alegação de endosso ou republicação de textos clínicos.

Se a revisão responsável exigir confirmação do provedor, encaminhar uma pergunta
específica sobre esses dois URLs atuais, extração de valores/unidades/notas,
tradução de rótulos e uso comercial em SaaS brasileiro sob OGL. Não enviar dados de
pacientes. Nenhum contato externo foi realizado ou autorizado nesta rodada.

## Valores e outra publicação oficial

[Quadro adulto candidato](VALORES_CANDIDATOS_DRI_FOOD06.md): 19 referências
selecionadas, dois sexos de tabela e quatro faixas adultas, com RDA/AI e UL
publicados explicitamente separados da sua aplicabilidade. Três códigos PA06
(retinol, RE e niacina sem NE) não receberam referência por aproximação.

Confronto bibliográfico pelo mesmo agente, utilizando publicação oficial distinta
do parser Health Canada. Não representa revisão clínica humana, revisão R4 ou
execução independente de testes. As duas publicações derivam das mesmas DRI;
concordância não é demonstração independente da validade científica das DRI.

| Nutriente | Outra fonte consultada | Cobertura observada |
| --- | --- | --- |
| Cálcio | [NIH ODS](https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/) | RDA e UL adultos; transições de 51/71 e diferença por sexo conferem |
| Magnésio | [NIH ODS](https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/) | RDA 19–30/31+ por sexo e UL suplementar conferem |
| Manganês | [NIH ODS consumidor](https://ods.od.nih.gov/factsheets/Manganese-Consumer/) | Quantidades adultas e UL conferem; tipo AI identificado na tabela principal |
| Fósforo | [NIH ODS consumidor](https://ods.od.nih.gov/factsheets/Phosphorus-Consumer/) | Excertos oficiais indexados confirmam referência adulta e UL 19–70/71+; acesso direto retornou 403 |
| Ferro | [NIH ODS](https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/) | RDA por sexo/idade e UL conferem; biodisponibilidade permanece nota clínica |
| Potássio | [NIH ODS](https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/) | AI por sexo e ausência de UL conferem; elegibilidade exclui excreção prejudicada |
| Cobre | [NIH ODS](https://ods.od.nih.gov/factsheets/Copper-HealthProfessional/) | RDA e UL em mcg conferem; PA06 usa mg |
| Zinco | [Relatório original NCBI](https://www.ncbi.nlm.nih.gov/books/NBK222317/), [NIH consumidor](https://ods.od.nih.gov/factsheets/Zinc-Consumer/) | Concordância em excertos indexados para RDA e UL; conteúdo integral bloqueado por CAPTCHA/403, sem bypass |
| Selênio | [NIH ODS](https://ods.od.nih.gov/factsheets/Selenium-HealthProfessional/) | RDA e UL DRI conferem; fonte também informa UL EFSA distinto |
| Vitamina A | [NIH ODS](https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional/) | RDA RAE e UL pré-formado conferem; não usar RAE total no UL |
| Tiamina | [NIH ODS](https://ods.od.nih.gov/factsheets/Thiamin-HealthProfessional/) | RDA por sexo e ausência de UL conferem |
| Riboflavina | [NIH consumidor](https://ods.od.nih.gov/factsheets/Riboflavin-Consumer/), [NIH profissional](https://ods.od.nih.gov/factsheets/Riboflavin-HealthProfessional/) | Quantidades adultas conferem; ausência de UL conferida em excerto indexado profissional |
| Vitamina B6 | [NIH ODS](https://ods.od.nih.gov/factsheets/VitaminB6-HealthProfessional/) | RDA por sexo/idade e UL DRI conferem; fonte também informa UL EFSA distinto |
| Niacina | [NIH ODS](https://ods.od.nih.gov/factsheets/Niacin-HealthProfessional/) | RDA NE e número UL conferem; formas abrangidas não intercambiáveis |
| B12 | [NIH ODS](https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/) | RDA adulta e ausência de UL conferem |
| Folato | [NIH ODS](https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/) | RDA DFE e número UL conferem; UL não em DFE |
| Vitamina D | [NIH ODS](https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/) | RDA 19–70/71+ e UL em mcg conferem |
| Vitamina E | [NIH ODS](https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/) | Números RDA/UL conferem; diferença de redação da abrangência do UL exige delimitação |
| Vitamina C | [NIH ODS](https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/) | RDA basal por sexo, UL e acréscimo por tabagismo conferem |

Há conferência documental numérica com limitações de acesso expressas. Não foi
executado um oráculo automatizado NIH versus Health Canada célula a célula.
Transcrição candidata continua exigindo revisão clínica dos números e notas.
Nenhuma divergência numérica DRI foi demonstrada nas comparações acima.

## Ressalvas clínicas concretas para a ratificação

- **B6:** DRI adulta usa UL 100 mg/dia; NIH também informa EFSA 2023 de 12 mg/dia.
- **Selênio:** DRI adulta usa UL 400 mcg/dia; NIH também informa EFSA 2023 de 255 mcg/dia.
- Isso é diferença entre autoridades/protocolos, não erro de extração. D03 já
  escolheu DRI norte-americana. Ratificar os números específicos com ciência das
  diferenças; não substituir silenciosamente por EFSA ou tratar valor abaixo do
  UL como garantia de segurança. A comparação é do planejamento, não da ingestão
  total real, não inclui automaticamente suplementos e não prescreve doses.
- **Vitamina E:** Health Canada descreve formas sintéticas em suplemento/fortificação;
  NIH abrange todas as formas suplementares de alfa-tocoferol. A PA06 não separa
  essas origens/formas, logo o UL continua indisponível em ambas as leituras. Não
  resolver a diferença apenas para permitir um número na interface.
- **Tabagismo:** o acréscimo de 35 mg/dia na referência de vitamina C é uma regra
  clínica, não mera formatação. Exige confirmação da condição e ratificação da
  sub-regra; sem essa confirmação, referência afetada fica indisponível.

## Testes da extração e limites

- RED inicial: função de extração retornava lista vazia; oito casos falharam por
  comportamento ausente, sem erro de importação/setup.
- GREEN: extração de células por identidades `headers`, notas de sobrescrito
  separadas, decimal mantido e ND sem virar zero.
- RED adicional: três casos revelaram aceitação de cabeçalho de idade ausente,
  coluna vinculada ao nutriente errado e célula duplicada. Todos corrigidos.
- GREEN final: 19 testes Python (8 do coletor + 11 da extração), somente fixtures
  sintéticas; extração real dos HTMLs temporários executada. Reprodução do quadro
  Markdown por script comparada byte a byte, sem diferença.
- Segurança de workflows: 22 testes existentes de actions imutáveis/injeção
  passaram localmente; scanner de segredos e `git diff --check` passaram.
  Scripts Node executados no Node 24 local, não equivalem a validação das engines
  Node 22 do produto. Os testes do extrator usam Python, sem dependência Node.
- Esses resultados validam a ferramenta documental. Motor clínico, autorização,
  RLS, backend/BFF e interface FOOD06 ainda não foram implementados ou testados.
- Workflow específico da suíte Python adicionado nesta rodada; seu primeiro
  resultado ainda precisa ser conferido no novo HEAD. Checks genéricos ou CodeQL
  não substituem sua execução explícita. Sem dependências novas.
