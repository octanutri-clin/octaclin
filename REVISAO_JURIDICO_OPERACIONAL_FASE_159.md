# Fase 159 - Revisao juridico-operacional preparatoria

## Limite desta revisao

Esta revisao compara as minutas e os controles do produto com requisitos
documentais evidentes da LGPD e orientacoes publicas da ANPD. Nao e parecer
juridico, nao aprova contrato e nao substitui advogado ou encarregado.

## Evidencias tecnicas encontradas

- O primeiro acesso coleta aceites separados e versionados de Termos, Politica
  de Privacidade e consentimento LGPD.
- O portal registra historico de consentimentos e possui exportacao LGPD por
  titular.
- O produto tem controles de retencao programada, auditoria, segregacao por
  tenant, controles de acesso e runbooks de suporte/incidente.
- A producao tem restore real em banco dedicado validado na Fase 158.

Essas evidencias apoiam responsabilizacao e prestacao de contas, mas nao
definem sozinhas a base legal nem substituem os documentos finais.

## Achados bloqueadores antes de venda

| Prioridade | Achado | Acao obrigatoria |
| --- | --- | --- |
| Bloqueador | Identidade legal e canal de privacidade ausentes | Preencher razao social, CNPJ, endereco, representante, encarregado/canal e URL oficial em todos os documentos. |
| Bloqueador | Termos de Uso e anexo de tratamento inexistentes | Revisar e aprovar `TERMO_DE_USO_RASCUNHO.md` e `ANEXO_TRATAMENTO_DADOS_RASCUNHO.md`. |
| Bloqueador | Bases legais nao mapeadas por fluxo | Advogado deve aprovar matriz por finalidade, inclusive dados de saude, sem tratar o aceite generico como base universal. |
| Bloqueador | Suboperadores e transferencia internacional sem anexo final | Inventariar fornecedor, regiao, dados, contrato e mecanismo aplicavel antes de habilitar cada integracao. |
| Bloqueador | Fluxo de menores sem decisao formal | Proibir o cadastro de menores ou implantar fluxo aprovado de responsavel legal e informacoes adequadas. |
| Bloqueador | Protocolo incidente contratual incompleto | Definir aviso operador-controlador, responsaveis, evidencias, decisao de comunicacao e exercicio de mesa. |

## Itens importantes

- Formalizar inventario de operacoes de tratamento e revisar a necessidade de
  RIPD para os fluxos de maior risco.
- Definir prazo e autenticacao para pedidos de titulares; testar exportacao,
  correcao, bloqueio e exclusao com evidencias.
- Revisar mensagens de marketing, WhatsApp e e-mail por finalidade,
  preferencia e base legal aplicavel.
- Anexar SLA final, politica de retencao e contato de suporte ao contrato.
- Criar versao publica somente depois do dominio oficial e aplicar nova versao
  de aceite no produto quando o texto final mudar.

## Referencias oficiais verificadas

- [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm): arts. 5, 6, 7, 8, 9, 11, 14, 18, 33 a 36 e 48.
- [ANPD, comunicacao de incidente](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis): Resolucao CD/ANPD no 15/2024.
- [ANPD, encarregado](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-lanca-guia-sobre-atuacao-do-encarregado): Resolucao CD/ANPD no 18/2024.
- [ANPD, transferencia internacional](https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados): Resolucao CD/ANPD no 19/2024.

## Aceite externo pendente

Nao marcar a revisao juridica final, politica final, termos finais, contrato
ou anexo de tratamento como aprovados sem responsavel juridico, data, versao e
registro de decisao. Este documento fecha somente a preparacao interna da Fase
159.
