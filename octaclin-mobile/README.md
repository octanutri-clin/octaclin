# OctaClin Mobile - Fase 243

App Expo 57/React Native para experiencia do paciente. O codigo esta
modernizado, mas o produto Mobile permanece desativado e nao pode ser
distribuido enquanto os gates de seguranca e produto estiverem abertos.

## Rodar localmente

```powershell
pnpm install --frozen-lockfile
pnpm start
```

## Validacao

```powershell
pnpm typecheck
pnpm doctor
pnpm test:security
pnpm audit:security
pnpm build:validate
```

Consulte `../fase-243-modernizacao-hardening-mobile.md` para os bloqueadores de
distribuicao e a excecao upstream rastreada.

## Entregue

- Navegacao por abas com Expo Router.
- Diario rapido offline-first com SQLite.
- Widgets para refeicao, humor e agua.
- Captura multimodal: foto, video curto e audio.
- Limites de contrato: audio ate 2 minutos e video ate 30 segundos.
- Modo acompanhante com PIN e fila offline de sincronizacao.
