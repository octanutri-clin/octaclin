# Questionários — sugestões de evolução profissional

Pesquisa pública de 21/11/2026, contrastada com a base `60bbe01f` e a QST01 da
PR #566. **Propostas, sem autorização implícita de implementação.** Não houve
instalação, clone, execução ou cópia de código externo; nenhum dado clínico foi
enviado a sistemas de formulários ou ferramentas da pesquisa.

## Referências utilizadas

| Referência primária | O que foi consultado e aproveitado como ideia |
| --- | --- |
| [Typeform: respostas](https://help.typeform.com/hc/en-us/articles/360029253732-Working-with-your-responses) | Tabela configurável, leitura individual com próximo/anterior, filtros e pesquisa combinados |
| [SurveyJS Creator: interface](https://surveyjs.io/survey-creator/documentation/end-user-guide/user-interface) | Ações próximas à pergunta, duplicação, troca de tipo com recuperação e prévia por dispositivo |
| [surveyjs/survey-library](https://github.com/surveyjs/survey-library) | Separação entre definição e renderização; biblioteca de runtime MIT. Creator/Dashboard/PDF têm contratos/licenças próprios: não presumir que sejam MIT |
| [formbricks/formbricks](https://github.com/formbricks/formbricks) | Organização de uma plataforma de pesquisas e editor. Core AGPLv3 e módulos Enterprise: referência de fluxo, não código para incorporar |
| [W3C/WAI: feedback](https://www.w3.org/WAI/tutorials/forms/notifications/) | Erros próximos ao campo e resumo navegável, sem depender só de cor |
| [W3C/WAI: formulários longos](https://www.w3.org/WAI/tutorials/forms/multi-page/) | Divisão por etapas lógicas e indicação acessível de progresso, quando aplicável |

Não adotar uma nova plataforma de formulários. O OctaClin já possui editor,
biblioteca, modelos, seções, prévia, histórico e contratos de envio próprios.
Licenças foram identificadas nas páginas oficiais para delimitar a pesquisa,
não como parecer jurídico ou aprovação de dependência.

## O que já existe e deve ser reaproveitado

- `components/questionarios/area-respostas.tsx`: agregados por pergunta, lista de
  envios, busca, filtro de paciente, matriz longitudinal, CSV e agora recolhimento.
- `usar-workspace-questionarios.ts`: busca considera enunciado/valor/nome;
  duplicação do questionário inteiro e proteção contra alterações não salvas.
- `area-editor.tsx` e `pergunta-ordenavel.tsx`: propriedades por pergunta, seção,
  obrigatoriedade, ordenação por drag-and-drop e sensor de teclado no workspace.
- `preview-questionario-paciente.tsx`: prévia já agrupa por seção e ordena campos.
- Backend `servico-questionarios.ts`: leitura autorizada, snapshots dos envios e
  matriz existente. A leitura clínica aceita filtro de paciente; a proposta de
  período/paginação requer conferir DTOs e consultas, não só filtrar o navegador.

Essas são evidências localizadas no código, não auditoria integral de todos os
fluxos. Não propor como novos recursos o que já existe; completar lacunas de UX.
Os caminhos Web acima são relativos a `octaclin-web/`.

## Sugestões priorizadas

| ID | Proposta concreta | Exemplo prático e critério de aceite | Porte estimado / dependências |
| --- | --- | --- | --- |
| QST-P01 | Realçar o termo encontrado e indicar quantos envios estão exibidos; ação clara para limpar a busca | Procurar “sono” e localizar visualmente a pergunta/resposta correspondente. Contagem se refere ao conjunto realmente exibido, não a todo histórico. Realce literal com React, sem HTML livre e sem alterar o texto armazenado | Pequeno; componente local, sem novo backend se restrito ao conjunto já recebido |
| QST-P02 | Modo de leitura individual, com anterior/próximo dentro do resultado filtrado | Rever um envio longo com cabeçalho paciente/data fixo no contexto, sem voltar ao topo entre envios. Mobile sem painel lateral apertado; foco volta ao item original ao sair | Pequeno/moderado; estado local e UX acessível, nenhuma autorização nova |
| QST-P03 | Separar visualmente “Por envio” de “Resumo por pergunta” | Hoje agregados e envios compartilham a mesma tela. Permitir escolher o foco sem remover busca/filtros; manter resumos como agregados factuais, sem diagnóstico e sem confundir dados de vários pacientes | Pequeno/moderado; reutilizar os dois conjuntos já disponíveis, validar foco e anúncio das áreas |
| QST-P04 | Prévia com largura celular/desktop no editor existente | Conferir uma pergunta longa antes de enviar, sem redimensionar manualmente a janela. Alternar largura não altera o formulário nem grava resposta fictícia | Pequeno; extensão da prévia, não outro renderizador. Reprodução deve continuar fiel ao fluxo real |
| QST-P05 | Duplicar uma pergunta no mesmo rascunho, próxima à original | Criar outra pergunta com as mesmas opções/configurações, editar o enunciado e salvar. Identidade nova, original independente, validação atual preservada e sem reescrever envios históricos | Moderado; reusar criação/ordenação/biblioteca e conferir versionamento, idempotência e configurações compatíveis |
| QST-P06 | Checklist de pendências antes de salvar/publicar, com acesso ao campo | Mostrar qual pergunta está sem enunciado/opção válida e levar o foco até ela, preservando as demais edições. Reutilizar validações existentes; não criar nova regra clínica nem confiar só no frontend | Moderado; depende de verificar os erros estruturados retornados pelo contrato atual |
| QST-P07 | Filtros de período e paginação no servidor, com alcance explícito | Localizar os envios do último mês sem carregar todo o histórico. Informar total e página somente com contagem autorizada; exportação precisa declarar se respeita o filtro | Moderado/maior; API/BFF/backend, autorização e provas de isolamento. Separar do pacote visual |
| QST-P08 | Comparação textual lado a lado para o mesmo paciente e versões compatíveis | Conferir duas respostas abertas sem alternar telas. A matriz numérica já existe: ampliar a apresentação, sem inventar comparação entre perguntas com identidades/semânticas incompatíveis e sem inferir melhora clínica | Moderado/maior; auditoria dos snapshots/identidades, acesso aos dois registros e incertezas explícitas |
| QST-P09 | Agrupamento e progresso em formulários longos, quando faltar no fluxo real | Dividir por blocos lógicos e indicar a etapa; permitir rever o preenchido sem perda. Auditar primeiro o preenchimento público/portal: se já atendido, não duplicar | Futuro; afeta paciente, requer persona paciente e desenho de preservação dos dados. Fora das pequenas melhorias imediatas |

P01–P06: oportunidades de eficiência/acessibilidade P2, não defeitos comprovados.
P07–P09: planejamento futuro condicionado aos contratos; prioridade final depende
do problema demonstrado. Não classificar preferência estética como vulnerabilidade.

## Pacote recomendado primeiro

**Leitura profissional 2:** P01 + P02, em incrementos separados na mesma área,
depois da QST01 e da exclusividade dos arquivos. Prova sintética: três envios,
dois do mesmo paciente, termo em texto recolhido, filtro vazio, navegação anterior/
próximo, teclado, texto ampliado e nenhuma nova chamada/gravação.

**Editor 2:** P04 e, após mapear o contrato, P05/P06. Não misturar backend de busca,
comparação histórica ou alterações no portal com o pacote visual inicial.

Sugestão que não recomendo nesta rodada: copiar a arquitetura externa inteira,
adotar biblioteca de formulários só pela aparência, adicionar IA interpretativa,
transcrever respostas clínicas para fornecedores ou criar relatórios públicos.
Os padrões de navegação podem inspirar uma implementação própria preservando
os contratos e a privacidade do OctaClin.

## Próxima decisão de produto

O proprietário pode aprovar o pacote P01/P02 ou priorizar P04. Depois disso,
executar UX A com os papéis persistentes, TDD e PR própria. Paciente N/A somente
nos incrementos exclusivamente profissionais; P09 exige sua avaliação.
Nenhuma dessas propostas foi implementada na PR #566.
