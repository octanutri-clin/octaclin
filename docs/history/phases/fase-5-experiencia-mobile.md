# OctaClin - Fase 5: Experiencia Mobile

## Escopo Entregue

- App Expo/React Native `octaclin-mobile`.
- Navegacao por abas com Expo Router.
- Diario rapido offline-first com SQLite.
- Widgets de refeicao, humor e agua.
- Captura multimodal para imagem, audio e video.
- Modo acompanhante com PIN.
- Backend NestJS `mobile` para diario rapido, upload de midia e acompanhantes.
- Validacao backend de limites: audio ate 2 minutos e video ate 30 segundos.

## Modulo Mobile Backend

### Justificativa Tecnica

O backend mobile foi separado para concentrar contratos especificos do app do paciente: quick log, midias e acompanhante. Os registros usam tabelas ja previstas na fundacao (`logs_diario_rapido`, `arquivos_midia`, `acompanhantes`), mantendo consistencia com LGPD, auditoria e multitenancy.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| Endpoint dedicado mobile | Baixo | Alto | Contrato claro para app |
| Fila local offline no app | Medio | Alto para UX | Exige sincronizador robusto |
| Upload URL configuravel | Baixo | Alto | Simula S3/MinIO; assinatura real vem no hardening |
| PIN hash para acompanhante | Baixo | Alto | Simples, mas requer politica de tentativa |

### Riscos

- **URL de upload ainda nao e assinatura S3 real**: mitigacao na Fase 6 com pre-signed URLs oficiais.
- **Fila offline ainda nao sincroniza automaticamente**: app enfileira; sincronizador com retry entra antes de producao.
- **PIN precisa rate limit**: backend deve aplicar protecao quando houver endpoint de login acompanhante.

## App Expo

### Justificativa Tecnica

Expo foi usado por acelerar camera, audio, SQLite e navegacao sem custo nativo inicial. Expo Router cria uma estrutura de telas previsivel e compatível com evolucao para deep links e notificacoes push.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| Expo Managed | Baixo | Alto para MVP | Menos codigo nativo |
| SQLite local | Baixo | Alto | Boa base offline-first |
| WatermelonDB adiado | Medio | Alto em escala | Evita complexidade antes do sync real |
| Expo AV/Camera | Baixo | Alto | APIs prontas, dependem de permissoes nativas |

### Riscos

- **Captura precisa teste em dispositivo real**: camera/audio nao sao totalmente verificaveis em build estatico.
- **Videos devem ser cortados no cliente e validados no backend**: backend ja valida duracao declarada.
- **SQLite schema deve evoluir por migrations locais**: MVP cria tabela simples; versoes futuras precisam migrador.

## Endpoints Adicionados

| Metodo | Rota | Descricao |
|---|---|---|
| POST | `/mobile/diario-rapido` | Registra quick log |
| POST | `/mobile/midias/uploads` | Cria registro de midia e URL de upload |
| POST | `/mobile/acompanhantes` | Cria acompanhante com PIN hash |

## Validacao

Validacao executada nesta entrega:

```bash
cd outputs/octaclin-backend
jest
tsc --noEmit
nest build

cd ../octaclin-mobile
npm install
npm run typecheck
```

Resultado:

- Backend: 9 suites Jest aprovadas, 21 testes aprovados.
- Backend: TypeScript sem erros e build NestJS concluido.
- Backend: imports relativos verificados em 103 arquivos.
- Mobile: dependencias instaladas e TypeScript sem erros.
- Mobile: imports verificados.
- Nenhuma referencia propria ao nome anterior encontrada nos artefatos.

## Proximo Gate Antes da Fase 6

- Sincronizador offline com retry e backoff.
- Upload pre-assinado real para S3/Spaces/MinIO.
- Push notification com Expo/FCM/APNs.
- Teste em dispositivo real para camera, microfone e permissoes.
