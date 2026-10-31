# FOOD06 — comparação factual com referências dietéticas

Estado: CL01–CL08 e quadro DRI ratificados em 2026-10-31; núcleo técnico isolado
autorizado. Direitos de tabelas e integração assistencial permanecem gates.
Base inspecionada em 2026-10-30: `68499c15`, após integração da #454.
Branch isolada: `docs/food06-contratos-fontes`.

Incremento A1 separado: branch `feat/food06-onda-a1`, base #455/`0ec4cd31`.
Cobertura, explicações e fundamento de contexto aditivos no domínio.
Contexto: [execução A2-fundamento](execucao-pos-320-food06-contexto.md).
Evidências A1 e limites em
[execução A1](execucao-pos-320-food06-a1.md). Não habilita comparação clínica.

Integração factual R4 em PR #457 separada, dependente da #456: serviço/BFF
reutilizam PA06 sem habilitar referências. Backend/Web/PostgreSQL/RLS do código
80763589 aprovados no CI; Demo/CI final permanecem gates, Mobile FAIL.
[Execução factual](food06-integracao-factual.md). Isso não conclui Onda A/M01–M12.

## Escopo vigente ampliado — 2026-10-31

O proprietário aprovou integralmente F06-M01–M12 para planejamento e implementação
isolada. Todas são obrigatórias; o núcleo anterior não conclui FOOD06. Contrato
completo em [especificação](especificacao-pos-320-food06-melhorias.md), rastreabilidade
em [aceite](aceite-pos-320-food06.md), primeira onda em [Onda A](onda-a-pos-320-food06.md).
T01–T07 abaixo são a sequência-base preservada, ampliada pelos incrementos A–D;
nenhuma aprovação parcial vira aprovação irrestrita das melhorias.

Auditoria: PA06 cobre soma/cobertura básica, não causas/contribuições; análise
histórica com contexto/referências exige registro próprio sem mutar publicações;
FOOD05 não está nesta base e seus caminhos dependentes serão protegidos. A prévia
FOOD07 atual calcula quatro macros e deixa micros ao writer, exigindo integração
do resolver existente, não multiplicação/somador novos. M11 tem gap de restrições
estruturadas/compatibilidade a fechar antes do caminho individualizado.

UX A: duas instâncias separadas, papéis da #451 por referência explícita
`0d3382b6`, sem herdar conversa/ferramentas/dados reais; relatórios e manifesto em
`docs/agents/ux/reports/FOOD06-A-2026-10-31/`. Sugestões mapeiam escopo aprovado;
nenhum novo protocolo/portal foi autorizado pelas personas. B/C seguem pendentes.

CI de `eeb552fa`: Mobile Expo e PR Gate FAIL; demais20 success e SBOM provenance
SKIPPED. Auditoria Mobile terminou com exit1 e14 IDs GHSA no job124490037570;
não inferir pacote/gravidade de todos sem triagem. Não corrigir por supressão ou
misturar lockfile Mobile no incremento FOOD06. G06 operacional continua BLOCKED.

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

Ficha detalhada ratificada: seleção explícita da referência por sexo/população,
idade na data civil clínica, elegibilidade fisiológica, condições clínicas fora da
população de referência e revisão humana do protocolo. Direitos continuam separados.
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

### Execução controlada de T03

T03-A prepara o núcleo matemático puro, usando referências injetadas sintéticas
nos testes, sem tabela clínica, registro em módulo, rota ou interface. Independe
dos direitos de tabelas e não libera uso assistencial. Reutiliza PA06 e aritmética
decimal existente. Risco R2: sem auth, dados de pacientes, persistência ou banco.
T03-B integra o conjunto clínico versionado e continua dependente do gate de
direitos e oráculos específicos. Essa divisão isola o bloqueio no artefato
afetado sem eliminar requisitos da entrega final. T04–T07 preservam seus gates.

## Gates atuais e handoff

### Conferência numérica e checkpoint posterior

- O CI de `644397a3` concluiu 21 checks com sucesso e SBOM provenance SKIPPED.
  Evidência histórica: não valida commits posteriores. A PR foi marcada Ready for
  Review por `octanutri-clin` no GitHub em 2026-10-30T23:00:08Z; a mudança de estado
  não foi executada pelo agente e não equivale a conclusão funcional da FOOD06.
- [Valores candidatos](../docs/product/VALORES_CANDIDATOS_DRI_FOOD06.md) detalham
  19 referências adultas relacionadas aos 22 códigos. UL usa unidade própria
  quando diferente da RDA/AI; totais PA06 não ganham origem química por inferência.
- [Parecer de fontes](../docs/product/PARECER_FONTES_DRI_FOOD06.md) registra links
  atuais do recurso licenciado, outra publicação oficial para confronto, limites
  de 403/CAPTCHA e diferenças B6/selênio entre DRI e EFSA. Escopo de terceiros
  continua em revisão; nenhum livro citado foi distribuído.
- Extrator documental desenvolvido com RED/GREEN funcional; cabeçalhos e notas
  validados sem posição de coluna como identidade. Total: 19 testes sintéticos
  locais PASS. Quadro Markdown regenerado idêntico; não é um oráculo clínico.
- Workflow isolado `food06-research.yml` passa a executar exatamente essa suíte
  em PRs afetadas, sem downloads de tabelas ou serviços externos nos testes.
  Seu primeiro CI ainda precisa ser observado no novo HEAD.

### Histórico: primeiro checkpoint de fontes

- Ficha de regras e matriz semântica dos 22 códigos preparada em
  [FICHA_VALIDACAO_CLINICA_FOOD06.md](../docs/product/FICHA_VALIDACAO_CLINICA_FOOD06.md).
  É proposta de regras, ainda sem valores de referência incorporados e sem aceite
  humano. F06-CL01–08 concentram a ratificação; não são novas decisões já aprovadas.
- Utilitário de pesquisa reproduzível em
  [research/food06](../research/food06/README.md); manifesto de nova obtenção
  preserva hashes anteriores desta página como checkpoint histórico. HTML dinâmico
  mudou hashes brutos; o novo coletor registra também hash do texto principal,
  sem tratá-lo como validador clínico ou dataset normalizado.
- Oito testes sintéticos do coletor: PASS. Coleta GET pública de cinco fontes:
  PASS técnico. Não equivalem a teste de cálculo clínico, RLS ou validação científica.
- Timezone canônico localizado em `infraestrutura/tempo/timezone-clinico.ts`,
  incluindo `obterTimezoneClinicoDoTenant`; não criar fuso fixo novo.
- Ficha propõe confirmação do mesmo dia para seleção combinada; confirmação
  clínica desta regra e das restrições dos ULs ainda pendente.

### Gates vigentes após ratificação e núcleo isolado (2026-10-31)

- Inventário: PASS documental na base indicada; não implica conclusão funcional.
- Fontes/direitos: BLOCKED; candidatos e ressalvas identificados, manifesto não concluído.
- Clínica/população: PASS de ratificação humana da ficha/quadro `cb8a9c47`, CL01–CL08, em 2026-10-31. Não equivale a validação da implementação.
- Produto: D01–03, confirmação do mesmo dia e tabagismo confirmados; +35 mg apenas à RDA de vitamina C, nunca ao UL.
- T03-A: núcleo puro implementado e validado localmente com ferramentas em cache;
  suíte de domínio 109 testes PASS. Typecheck/build locais PASS com ressalva de
  instalação exata bloqueada; CI do novo delta pendente. Ver registro de execução.
- T03-B/T04–T07: pendentes; não há conjunto clínico registrado, rota ou interface.
- G06 externo: BLOCKED operacional, fora desta entrega.

Próxima ação: observar CI do núcleo T03-A e manter o gate de direitos
e oráculos específicos para T03-B. A coleta automatizada de
fontes é pesquisa de T02, sem nova rota ou tabela clínica no runtime.
Worktree original preservada, inclusive alteração preexistente em
`octaclin-web/next-env.d.ts`. Nenhuma alteração na PR #446.
