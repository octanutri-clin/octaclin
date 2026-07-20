# Fase 68 - Configuracao por tipo e opcoes de pergunta

## Entregue

- Adicionada normalizacao backend de `configuracao` por tipo de pergunta.
- Perguntas de multipla escolha podem ter opcoes substituidas na edicao.
- `GET /questionarios/:id/perguntas` e respostas de criacao/edicao passam a retornar `opcoes`.
- Editor web carrega e salva `configuracao` por pergunta.
- Editor web permite configurar:
  - Likert: escala minima/maxima e rotulos.
  - Multipla escolha: resposta unica/multipla e lista de opcoes.
  - Slider linear: minimo, maximo, passo e rotulos.
  - Metrica: unidade, minimo, maximo e passo.
  - Upload de midia: tipos aceitos e limite de arquivos.
  - Texto longo: limite de caracteres e placeholder.
  - Sim/Nao: rotulos customizados.

## Decisoes

- A configuracao continua em `jsonb`, mas agora passa por normalizacao por tipo no backend.
- Opcoes de multipla escolha sao substituidas em lote ao salvar a pergunta, preservando ordem simples.
- A UI inicializa opcoes padrao ao trocar uma pergunta para multipla escolha, evitando contrato invalido.

## Validacao

- `pnpm --dir octaclin-backend test -- configuracao-pergunta.spec.ts servico-questionarios.spec.ts --runInBand`
- `pnpm --dir octaclin-backend test --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-backend build`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web build`

## Proxima fase

Fase 69: preview do formulario como paciente, consumindo os mesmos contratos de `configuracao` e `opcoes`.
