# FOOD06 — comparação factual com referências dietéticas

Estado: planejamento em execução; decisões e validações clínicas pendentes.
Base inspecionada em 2026-10-30: `68499c15`, após integração da #454.
Branch isolada: `docs/food06-contratos-fontes`.

## Autorização e fronteiras

O proprietário autorizou continuar planejamento e desenvolvimento enquanto integra
as PRs abertas. Isso não ratifica automaticamente protocolo, população ou direitos.
A implementação assistencial depende das decisões abaixo e dos gates da
[sequência aprovada](../docs/pos-320/05_Plano_Sequencia_FOOD06_FOOD08_2026-10-30.md).
Sem operações externas de banco, merge, deploy ou alteração de infraestrutura.
FOOD05-MDL/D18 não integra esta entrega. G06 é independente e continua operacional.

## Inventário conferido no código

| Componente existente | Reutilização e limite |
| --- | --- |
| `octaclin-backend/src/modulos/planos-alimentares/dominio/calculo-combinado.ts` | `calcularNutrientesCombinados` usa porções congeladas, exclui planos/refeições desligados, distingue completo/parcial/indisponível e limita 10.000 itens. Não é preciso somar novamente no frontend. |
| `dominio/micronutrientes.ts` no mesmo módulo | Whitelist de 22 códigos; identidade distinta para RE/RAE, niacina/NE e DFE. Aritmética decimal escala8/BigInt já disponível; não introduzir biblioteca decimal sem lacuna comprovada. |
| `aplicacao/servico-planos-alimentares.ts`, método `calcularCombinado` | Verifica papel, permissão, paciente/carteira, versões e revisão de ativação dentro de executor tenant; locks de leitura em ordem estável, autorização antes da decifragem. Preservar essas propriedades. |
| `aplicacao/dtos-calculo-combinado.ts` e controlador existente | Reutilizar validação da seleção e proteção de leitura/no-store; novo DTO apenas se necessário ao contexto aprovado. |
| `octaclin-web/lib/calculo-combinado-planos-api.ts` e `plano-alimentar-api.ts` | BFF existente, abort e contratos de total/cobertura. Não aceitar totais clínicos fornecidos pelo navegador como evidência. |
| `octaclin-web/components/pacientes/calculo-combinado-planos.tsx` | Apresentação de cobertura e seleção; ponto candidato de integração. |
| Testes `dominio/calculo-combinado.spec.ts`, `micronutrientes.spec.ts`, `aplicacao/dtos-calculo-combinado.spec.ts`, `servico-planos-alimentares.spec.ts` | Reutilizar provas precisas; acrescentar apenas lacunas da comparação. Nenhuma suíte executada nesta inspeção documental. |

Os caminhos curtos da tabela são relativos ao módulo backend de planos alimentares.
A PA06 não registra a separação de ingestão natural/suplementar necessária a alguns
ULs. A existência de um total numérico não comprova compatibilidade com a referência.

## Decisões enviadas ao proprietário

| ID | Proposta | Estado |
| --- | --- | --- |
| F06-D01 | Adultos 19+ sem gestação/lactação inicialmente; faixas exatas por tabela, sem tratar 18 anos como 19 | APROVADA pelo proprietário em 2026-10-30 |
| F06-D02 | Plano publicado individual e seleção combinada PA06, console profissional, alimentação planejada | APROVADA pelo proprietário em 2026-10-30 |
| F06-D03 | RDA/AI e UL oficiais DRI, sem diagnóstico nem meta individual automática | APROVADA pelo proprietário em 2026-10-30; licença e revisão clínica continuam gates separados |

Ainda exigem ficha detalhada: seleção explícita da referência por sexo/população,
idade na data civil clínica, elegibilidade fisiológica, condições clínicas fora da
população de referência, revisão humana do protocolo e permissão de uso dos dados.
Não deduzir sexo de nome/identidade, condição fisiológica ou exceções de texto livre.

## Contrato candidato de domínio

1. Resolver contexto e totais autorizados no backend. Um plano individual deve usar
   a mesma semântica factual da PA06; nenhuma soma alternativa no navegador.
2. Confirmar que a seleção representa um mesmo dia planejado antes de comparar
   com referência diária. Somar planos não comprova que sejam consumidos juntos.
3. Referência imutável por ID/revisão, nutriente, unidade/qualificador, população,
   intervalo de idade, RDA ou AI, UL opcional, abrangência das fontes do UL,
   publicação original, data da revisão e manifesto de direitos/integridade.
4. Comparar somente identidade/unidade/período compatíveis. Percentual =
   total conhecido completo / referência positiva × 100; calcular com razão
   decimal, arredondando só a apresentação, sem usar valor exibido para decisões.
5. Total parcial pode ser mostrado como quantidade conhecida e cobertura; a
   comparação fica indisponível com motivo. Ausência não vira zero. Referência
   inexistente, zero inválido ou população não elegível não produzem percentual.
6. Cada referência tem aplicabilidade própria. UL ausente não significa ausência
   de risco. Não extrapolar limites, converter RE em RAE ou niacina em NE por nome.
7. Não classificar um plano abaixo de RDA/AI como deficiência, nem um valor acima
   de UL como diagnóstico de toxicidade. EAR/CDRR não são sinônimos de RDA ou UL.
8. Resultado deve identificar publicações/revisões, cobertura, data/contexto da
   comparação e versão do motor/referências. Prévia obsoleta exige nova leitura.
9. Preferência inicial: cálculo de leitura sem persistência adicional. Se houver
   requisito de comparação histórica persistida, definir envelope cifrado e
   leitores antes de implementação. Não presumir ausência ou necessidade de migration.

## Fontes candidatas e evidência desta rodada

Pesquisa documental por fontes oficiais; nenhum valor clínico foi incorporado.

| Fonte | Evidência e pendência |
| --- | --- |
| [NIH ODS: recomendações](https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx) | Acesso HTTP direto resultou em 403; download integral e hash NOT RUN. Não tratar URL bibliográfica como dataset aprovado. |
| [NIH ODS: magnésio](https://ods.od.nih.gov/factsheets/magnesium-HealthProfessional/) | Pesquisa web oficial confirma restrição do UL a fontes suplementares/medicamentos. O total alimentar PA06 não pode ser comparado indiscriminadamente a esse UL. |
| [Health Canada: vitaminas](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-vitamins.html) | HTML aberto via pesquisa web e baixado integralmente (HTTP 200). Notas distinguem UL de folato sintético/ácido fólico de DFE; valores não transcritos no runtime. |
| [Health Canada: elementos](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html) | HTML aberto e baixado integralmente (HTTP 200). Manifesto preliminar abaixo; conferência por nutriente e edição original pendentes. |
| [NIH: FAQ/direitos](https://www.nih.gov/about-nih/frequently-asked-questions) | Política geral indica domínio público salvo ressalvas. Não comprova automaticamente direitos sobre tabelas de terceiros/National Academies citadas. Verificar artefato específico, atribuição e reutilização comercial. |

Exigir manifesto por artefato: URL final, publicação/edição, data de obtenção,
SHA-256 dos bytes, extração reproduzível, permissões/ressalvas e dupla conferência
dos valores e notas de rodapé. Resultados de pesquisa web não substituem esse pacote.
Sem scraping alimentar, importação TBCA ou chamadas externas no runtime.

### Manifesto preliminar de obtenção (2026-10-30)

Hashes dos bytes HTML recebidos, não do texto extraído nem de um dataset clínico
normalizado. HTML pode conter conteúdo dinâmico; igualdade de hash não substitui
conferência científica, e mudança não comprova revisão dos valores.

| Artefato | Bytes | SHA-256 |
| --- | ---: | --- |
| Health Canada elementos, URL da tabela acima | 153543 | `e69593b8caf057a523a638e1c587460757fcdd5ecc73781b52e74e2c63983351` |
| Health Canada vitaminas, URL da tabela acima | 138380 | `3aa1dab08e0a009b98e38a3c24f1aa9b087ffceb37161b1d4d201ea45d05d15f` |
| [Índice oficial das tabelas](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables.html) | 34354 | `5058fb7e347783d15405e4ee52a8c75c50b4e2ef11fbbe54c6a6b99565f81546` |
| [OGL-Canada](https://open.canada.ca/en/open-government-licence-canada) | 23440 | `fecc66c9cd636200cd0ba8483c3f5bf9bbebe95d3542f5fc5257d454c12b7c3d` |

Reprodução: Python stdlib `urllib.request.urlopen(URL)` com timeout, `read()` e
`hashlib.sha256(bytes).hexdigest()`. Os documentos foram lidos em memória;
nenhum corpo de tabela foi incorporado à distribuição.

Consulta somente de leitura à [API de metadados oficial](https://open.canada.ca/data/api/3/action/package_show?id=77fae12d-1ef0-431e-98df-451a4f7951c3)
retornou ID `77fae12d-1ef0-431e-98df-451a4f7951c3`, título Dietary Reference
Intakes e `license_id=ca-ogl-lgo`, com o índice das tabelas entre os recursos.
O registro informa `metadata_modified=2020-09-24T13:50:55.677408`; essa data não
é versão científica das tabelas atuais. A licença permite uso comercial mediante
condições/atribuição, mas exclui direitos de terceiros que o provedor não possa
licenciar. Antes de PASS jurídico, reconciliar as páginas filhas atuais, suas
notas de copyright e eventual material de terceiros com o recurso licenciado.
Não concluir que toda publicação National Academies seja domínio público porque
também aparece num site governamental. [Formulário Health Canada](https://www.canada.ca/en/health-canada/corporate/contact-us/application-copyright-clearance.html)
é uma alternativa se o alcance comercial continuar ambíguo; nenhum contato enviado.

Repositórios candidatos já mapeados no catálogo: R015, R056, R057 e R076. O SDK
Open Food Facts não contém as referências clínicas; bibliotecas de teste/decimal
não as validam. Nenhum repositório novo foi clonado, código copiado ou dependência
instalada. Priorizar o domínio já existente; não repetir auditoria de repositórios
de outras fases.

## Sequência técnica e aceite

| Tarefa | Dependência | Aceite verificável |
| --- | --- | --- |
| T01 Inventário e decisões | Nenhuma | Contratos existentes mapeados; respostas F06-D01–03 registradas fielmente |
| T02 Manifesto e ficha clínica | T01 | Artefatos exatos, direitos, faixas/sexo/condição, unidades, UL por origem e oráculos conferidos; ratificação humana identificada |
| T03 Domínio puro com TDD | Gates de T02 | RED funcional e GREEN para cada nutriente elegível, referência ausente, zero, limites etários, precisão, dados parciais e formas incompatíveis |
| T04 Serviço e BFF | T03 | Contexto servidor, autorização antes de dados, revisões/CAS de leitura, no-store, projeção allowlist, limites e abort; testes negativos |
| T05 Interface e UX B | T04 | Tabela acessível: planejado diário, cobertura, RDA/AI/UL, fonte/população e motivos; sem diagnósticos; respostas tardias descartadas |
| T06 Integração e R4 | T05 | PostgreSQL descartável com RLS/role runtime, carteira/transferência/revogação, ON/OFF, versões stale, regressões PA06/FOOD07 e segurança |
| T07 UX C e PR Draft | T06 | Desktop/mobile/teclado, critérios UX resolvidos, Node22, CI/scanners, evidências e limites; nenhuma ativação externa inferida |

UX A: usar o relatório sintético existente na #454 (UX-FOOD06-01–03) como entrada;
nova avaliação de ambos os papéis após fechar a proposta detalhada. B/C exigem
interface real e registro explícito de leitura de código versus interação.

## Gates atuais e handoff

- Inventário: PASS documental na base indicada; não implica execução de testes.
- Fontes/direitos: BLOCKED; candidatos e ressalvas identificados, manifesto não concluído.
- Clínica/população: BLOCKED; respostas iniciais e ratificação detalhada pendentes.
- Contrato de produto: decisões iniciais D01/D02/D03 APROVADAS; relação seleção/dia e ficha detalhada ainda precisam de conferência clínica.
- Runtime/testes/CI da FOOD06: NOT RUN; nenhum código alterado.
- G06 externo: BLOCKED operacional, fora desta entrega.

Próxima ação: registrar respostas; conferir integralmente fontes/notas/direitos,
completar ficha de elegibilidade e só então iniciar T03 nos itens liberados.
Worktree original preservada, inclusive alteração preexistente em
`octaclin-web/next-env.d.ts`. Nenhuma alteração na PR #446.
