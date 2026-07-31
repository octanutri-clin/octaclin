# Fase 175 - Separacao UX do modulo de formularios

Status: concluida localmente em 2026-07-30. Publicacao de producao pendente.

## Entregue

- A tela de questionarios foi organizada em quatro areas de trabalho: Montagem,
  Biblioteca, Distribuicao e Respostas.
- Montagem preserva a criacao, configuracao, ordenacao e preview do formulario.
- Biblioteca oferece busca por enunciado ou chave clinica, filtro por categoria
  e inclusao da pergunta selecionada como copia independente.
- Distribuicao separa o check-in recorrente por paciente do envio individual de
  link publico, reutilizando os mesmos contratos existentes.
- Respostas concentra a leitura clinica e a matriz longitudinal em um contexto
  exclusivo de acompanhamento.
- A navegacao foi implementada como tabs acessiveis, sem alterar endpoints,
  modelo de dados ou fluxos de permissao.

## Validacoes

```powershell
pnpm --dir octaclin-web run test:questionarios-revisao:bff
pnpm --dir octaclin-web run test:questionarios-preview
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
```

## Proxima fase

Reavaliar o backlog funcional antes de iniciar a proxima fase de produto.
