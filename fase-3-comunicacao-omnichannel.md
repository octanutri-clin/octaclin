# OctaClin - Fase 3: Camada de Comunicacao

## Escopo Entregue

- Modulo NestJS `comunicacoes`.
- Filas BullMQ com Redis para envio assincrono.
- Entidades TypeORM para `canais_notificacao`, `templates_mensagem` e `mensagens_notificacao`.
- Adaptador WhatsApp para Meta Cloud API com templates aprovados.
- Adaptador e-mail para SendGrid.
- Placeholder push para manter contrato omnichannel ate a fase mobile.
- Endpoints para canais, templates e disparo de mensagens.
- Retry exponencial e `jobId` idempotente por mensagem.
- Testes unitarios das regras de disparo.

## Modulo Comunicacoes

### Justificativa Tecnica

BullMQ foi escolhido porque ja estava previsto na arquitetura e oferece retries, backoff, idempotencia por `jobId` e isolamento entre API sincrona e provedores externos. WhatsApp e SendGrid foram integrados por HTTP direto para manter baixo acoplamento com SDKs, facilitar testes e reduzir peso operacional.

### Trade-offs

| Decisao | Custo | Performance | Manutenibilidade |
|---|---:|---:|---:|
| BullMQ + Redis | Medio | Alto | Alta, padrao robusto para jobs |
| HTTP direto para Meta/SendGrid | Baixo | Alto | Menos dependencia, exige manter payloads oficiais |
| Mensagem persistida antes da fila | Baixo | Alto | Auditoria forte e reprocessamento simples |
| Push placeholder | Baixo | Alto | Mantem contrato; implementacao real vem na Fase 5 |

### Riscos

- **Duplicidade em falha entre banco e fila**: mitigado por `jobId` idempotente; proximo passo e outbox transacional.
- **Template WhatsApp nao aprovado**: regra bloqueia disparo quando `aprovado=false`.
- **Limites dos provedores**: BullMQ permite backoff e controle futuro por rate limiter.
- **Credenciais por tenant**: suportado via `canal.configuracao`; `.env` serve como fallback local.

## Endpoints Adicionados

| Metodo | Rota | Papel | Descricao |
|---|---|---|---|
| POST | `/comunicacoes/canais` | SuperAdmin, Professional, Collaborator | Cria canal WhatsApp/e-mail/push |
| GET | `/comunicacoes/canais` | SuperAdmin, Professional, Collaborator | Lista canais |
| POST | `/comunicacoes/templates` | SuperAdmin, Professional, Collaborator | Cria template |
| GET | `/comunicacoes/templates` | SuperAdmin, Professional, Collaborator | Lista templates |
| POST | `/comunicacoes/mensagens` | SuperAdmin, Professional, Collaborator | Persiste mensagem e enfileira envio |

## Exemplos de Payload

Canal WhatsApp:

```json
{
  "tipo": "whatsapp",
  "nome": "Meta Principal",
  "configuracao": {
    "phoneNumberId": "123456789",
    "apiVersion": "v21.0"
  }
}
```

Template WhatsApp:

```json
{
  "canal": "whatsapp",
  "codigoExterno": "renovacao_tratamento",
  "nome": "Renovacao de tratamento",
  "aprovado": true,
  "conteudo": {
    "idioma": "pt_BR",
    "components": []
  }
}
```

Disparo:

```json
{
  "pacienteId": "uuid-paciente",
  "canalId": "uuid-canal",
  "templateId": "uuid-template",
  "payload": {
    "destino": "5511999999999",
    "components": []
  }
}
```

## Quality Gate da Fase 3

- API nao bloqueia no envio externo.
- Mensagens sao auditaveis por status.
- WhatsApp exige template aprovado.
- E-mail tem fallback por canal separado.
- Jobs possuem retry exponencial.
- Testes unitarios cobrem regras de disparo.

## Proximo Gate Antes da Fase 4

Validacao executada nesta entrega:

```bash
cd outputs/octaclin-backend
jest
tsc --noEmit
nest build

cd ../octaclin-web
tsc --noEmit
next build
```

Resultado:

- Backend: 6 suites Jest aprovadas, 13 testes aprovados.
- Backend: TypeScript sem erros e build NestJS concluido.
- Web: TypeScript sem erros e build Next.js concluido.
- Imports relativos do backend: 65 arquivos verificados.
- Imports do web: 10 arquivos verificados.
- Referencias proprias ao nome anterior removidas dos artefatos.

Observacao operacional: `pnpm install` concluiu a instalacao, mas retorna `ERR_PNPM_IGNORED_BUILDS` por politica de build scripts ignorados (`@nestjs/core`, `msgpackr-extract` e `unrs-resolver`). A validacao foi feita chamando os binarios locais diretamente com Node no PATH.

- Implementar outbox transacional para garantir consistencia banco/fila.
- Adicionar rate limit por canal/tenant.
- Conectar envios de `envios_questionario` da Fase 2 ao modulo de comunicacoes.
- Validar com credenciais reais Meta Cloud API e SendGrid em ambiente sandbox.
