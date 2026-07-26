# Pacote juridico e comercial inicial do OctaClin

## Status

Este pacote organiza minutas e controles para a relacao com clientes de
consultoria. **Revisao juridica obrigatoria**: ele nao substitui advogado, nao
deve ser apresentado como contrato final e **Nao autoriza o go-live** sem
aprovacao formal, dados empresariais completos e versoes finais publicadas.

## Objetivo

Preparar uma base coerente para a contratacao do OctaClin, que trata dados
pessoais e pode tratar dados pessoais sensiveis relacionados a saude. A Lei Geral de Protecao de Dados orienta este pacote, junto da analise contratual e
regulatoria aplicavel a cada cliente.

## Artefatos da fase

- `MODELO_CONTRATO_CLIENTE.md`: minuta comercial e operacional.
- `POLITICA_PRIVACIDADE_RASCUNHO.md`: estrutura de politica para publicacao
  somente apos revisao juridica e definicao de dominio/canais oficiais.
- `MAPA_DADOS_E_RESPONSABILIDADES.md`: papeis, dados e responsabilidades.
- `SLA_SUPORTE.md`: compromisso operacional proposto.
- `CHECKLIST_ONBOARDING_COMERCIAL.md`: controles antes de ativar cada tenant.

## Gates obrigatorios antes do primeiro cliente real

1. Preencher razao social, CNPJ, endereco, representante e canais oficiais.
2. Aprovar contrato, politica, anexos de privacidade e SLA com profissional
   juridico habilitado.
3. Definir por operacao quem e controlador, operador, suboperador e
   encarregado/canal de privacidade.
4. Publicar versoes finais em URL oficial e configurar as versoes legais do
   produto antes de coletar novos aceites.
5. Registrar aceite contratual e concluir o checklist de onboarding.
6. Fechar a Fase 131, o callback OAuth de producao e os itens criticos de
   `CHECKLIST_GO_LIVE.md`.

## Referencias oficiais consultadas

- [Lei no 13.709/2018 - LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)
- [Guia da ANPD sobre agentes de tratamento e encarregado](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-para-definicoes-dos-agentes-de-tratamento-de-dados-pessoais-e-do-encarregado)
- [Guia da ANPD sobre atuacao do encarregado](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-lanca-guia-sobre-atuacao-do-encarregado)

As referencias orientam a preparacao documental; a interpretacao juridica e a
adequacao ao modelo comercial real devem ser validadas externamente.
