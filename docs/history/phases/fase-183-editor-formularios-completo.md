# Fase 183 - Editor de formularios completo

Status: codigo concluido e enviado para deploy no commit `edb2391` em 2026-07-31.

## Entregue

- O editor passou a identificar separadamente alteracoes pendentes no formulario
  e na pergunta selecionada, indicando qual comando de salvamento deve ser
  usado antes de trocar o contexto.
- A cabecalho do formulario mostra versao e estado de rascunho, publicado ou
  arquivado. A versao continua sendo a fonte de verdade retornada pelo backend.
- Montagem, biblioteca, distribuicao, respostas e preview permanecem areas
  distintas; o preview pode continuar aberto durante a edicao.
- A reordenacao mantem suporte de teclado do `dnd-kit` e ganhou foco visivel no
  controle de arraste.

## Validacoes

- Tres testes do contrato de preview passaram.
- Typecheck e build de producao da web aprovados.

## Proxima fase

Fase 184 - Central de comunicacoes.
