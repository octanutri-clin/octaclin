# Fase 69 - Preview do formulario como paciente

## Entregue

- Adicionado preview do formulario dentro do editor de questionarios.
- O preview usa a mesma lista de perguntas, `configuracao` e `opcoes` do editor.
- Criado helper puro `criarCampoPreview` para traduzir perguntas em campos de resposta.
- O preview renderiza os tipos:
  - Likert
  - Multipla escolha unica ou multipla
  - Slider linear
  - Metrica
  - Upload de midia
  - Texto longo
  - Sim/Nao
- Adicionado botao `Preview paciente` no topo do editor.
- Adicionado teste automatizado `test:questionarios-preview`.

## Decisoes

- O preview e somente leitura nesta fase. Ele valida visualmente o formato de resposta sem gravar respostas.
- A renderizacao usa o contrato normalizado da Fase 68 para evitar duplicar regras de configuracao.
- A logica de transformacao fica em `lib/questionarios-preview.ts`, separada da UI, para facilitar reuso no portal do paciente.

## Validacao

- `pnpm --dir octaclin-web test:questionarios-preview`
- `pnpm --dir octaclin-web test:authz`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web build`

## Proxima fase

Fase 70: seções dentro do formulario e duplicacao de questionario.
