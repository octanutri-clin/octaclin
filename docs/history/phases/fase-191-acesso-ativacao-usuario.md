# Fase 191 - Acesso e ativacao do usuario

Status: concluida e validada localmente em 2026-07-31.

## Entregue

- `AuthShell` (`components/auth/auth-shell.tsx`) unifica `/login`,
  `/esqueci-senha`, `/recuperar-senha` e `/primeiro-acesso` num shell
  consistente (cabecalho com icone/marca, cartao central, layout centralizado),
  substituindo o `<main>`/header duplicado que cada rota mantinha de forma
  independente.
- `CampoSenha` (`components/auth/campo-senha.tsx`) adiciona botao de
  mostrar/ocultar senha (`aria-pressed`, `aria-label` dinamico) e aviso de
  Caps Lock via `getModifierState('CapsLock')`, usado nos 5 campos de senha do
  fluxo de acesso (login, nova senha + confirmar em `/recuperar-senha`, senha +
  confirmar em `/primeiro-acesso`).
- Tratamento de token expirado/invalido unificado: `classificarFalhaToken`
  (`lib/classificar-falha-token.ts`) extrai a logica que so existia em
  `primeiro-acesso-form.tsx` e passa a ser usada tambem por
  `recuperar-senha-form.tsx`, que antes so exibia uma mensagem generica sem
  distinguir link expirado de link invalido. `EstadoFalhaToken`
  (`components/auth/estado-falha-token.tsx`) generaliza a apresentacao
  (titulo/mensagem/detalhe/acoes) para os dois fluxos.
- `/primeiro-acesso` passou a ter ativacao por etapas: Etapa 1 (senha) e Etapa
  2 (aceites legais), com transicao 100% client-side (nenhuma chamada ao
  backend acontece so por definir a senha) e foco movido para o titulo da
  etapa a cada transicao, para leitor de tela.

## Limites deliberados

- A etapa de "dados" citada na Fase 190/191 do roadmap nao foi criada porque o
  contrato atual de `ativarConvitePaciente` nao expoe campos de perfil
  coletaveis nesse momento (nome/registro ja vem do convite criado na Fase
  143); adicionar campos novos exigiria contrato de backend ainda inexistente,
  entao a ativacao ficou em 2 etapas (senha, aceites), nao 3.
- O aviso de Caps Lock so pode ser testado via Playwright disparando um
  `KeyboardEvent` com `getModifierState` forcado (`tests/visual/acesso-ativacao.spec.mjs`)
  porque o Playwright nao emula a trava real de Caps Lock do sistema
  operacional; a logica testada e a mesma usada em producao.

## Revisao de seguranca

Revisao focada (agente `ecc:security-reviewer`, modelo `opus`) nos arquivos
novos/alterados: nenhum achado confirmado introduzido por esta fase. Duas
observacoes pre-existentes fora do escopo desta fase, nao agravadas aqui:

- `esqueci-senha-form.tsx` continua exibindo `linkRecuperacao` quando o backend
  envia (`EXPOR_LINK_RECUPERACAO_SENHA=true` ou fora de producao); se essa flag
  for ligada em producao por engano, vira oraculo de enumeracao de email. Nao
  alterado nesta fase; sugerido um check de deploy que garanta a flag ausente
  em producao.
- `recuperar-senha-form.tsx`/`primeiro-acesso-form.tsx` ainda podem exibir o
  corpo de resposta bruto (texto de erro HTML) quando o BFF falha antes de
  devolver JSON, via `lib/recuperacao-senha-api.ts`/`lib/convites-paciente-api.ts`.
  Sem risco de XSS (renderizado como texto JSX), so vazamento cosmetico de
  detalhe de infraestrutura; pre-existente, nao introduzido aqui.

## Validacoes

```powershell
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web exec playwright test tests/visual/acesso-ativacao.spec.mjs tests/visual/primeiro-acesso-paciente.spec.mjs tests/visual/acessibilidade.spec.mjs --reporter=list
pnpm --dir octaclin-web exec playwright test tests/visual/jornadas-criticas.spec.mjs --reporter=list
pnpm --dir octaclin-web run test:authz
pnpm --dir octaclin-web run build
npm run security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

Resultados: typecheck e lint limpos; 28 cenarios Playwright de acesso/a11y e 10
jornadas criticas aprovados; 22 verificacoes de autorizacao/BFF aprovadas;
build de producao aprovado; scanner de secrets sem achados; preflight
documental OK.

## Proxima fase

Fase 192 - Centro clinico diario e agenda profissional.
