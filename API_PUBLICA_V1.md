# OctaClin - API publica v1

## Objetivo e estabilidade

A API `/v1` permite integrar cadastro de pacientes e agenda sem compartilhar
credenciais humanas. O contrato e versionado na URL. Alteracoes incompativeis
exigem uma nova versao; campos novos podem ser adicionados de forma compativel.

Use somente o backend oficial da clinica. A interface web nao responde como API.

## Chaves e escopos

O gestor `Client` cria, rotaciona e revoga chaves em **Conta > Integracoes**.
A chave completa aparece uma unica vez. O OctaClin persiste somente o hash do
segredo e nao consegue recuperar a credencial depois que o modal e fechado.

Envie a chave em todas as requisicoes:

```http
Authorization: Bearer octa_live.<tenant-id>.<key-id>.<segredo>
```

Nunca coloque a chave em frontend, aplicativo distribuido, URL, log ou Git. Use
um cofre de secrets no servidor consumidor.

| Escopo | Operacoes |
| --- | --- |
| `pacientes:ler` | Listar e consultar pacientes |
| `pacientes:escrever` | Criar pacientes |
| `agenda:ler` | Listar consultas |
| `agenda:escrever` | Criar e cancelar consultas |

A autenticacao e limitada a 300 tentativas por IP/minuto antes da validacao. Uma
chave valida e limitada a 120 requisicoes/minuto. Se o controle Redis estiver
indisponivel, a API falha fechada com HTTP 503.

## Respostas e paginacao

Colecoes usam o envelope:

```json
{
  "data": [],
  "meta": { "pagina": 1, "limite": 25, "total": 0 },
  "links": { "proxima": null }
}
```

`pagina` comeca em 1 e `limite` aceita de 1 a 100. Recursos individuais usam
`{ "data": { ... } }`. Erros seguem o formato HTTP/NestJS e nao devem ser
interpretados por texto; use o status HTTP.

## Pacientes

### `GET /v1/pacientes`

Requer `pacientes:ler`. Aceita `pagina` e `limite`.

### `GET /v1/pacientes/:id`

Requer `pacientes:ler`. O UUID precisa pertencer ao mesmo tenant da chave.

### `POST /v1/pacientes`

Requer `pacientes:escrever`.

```json
{
  "referenciaExterna": "crm-paciente-1042",
  "profissionalResponsavelId": "00000000-0000-4000-8000-000000000001",
  "nome": "Paciente Sintetico",
  "contato": "paciente@example.test",
  "dataNascimento": "1990-01-20"
}
```

`referenciaExterna` e obrigatoria, tem ate 180 caracteres e e unica dentro do
tenant. Repetir a criacao, inclusive em concorrencia, devolve o recurso ja criado
sem duplicar paciente nem evento de webhook.

A resposta de paciente nao expoe `tenantId`, score de risco, hashes de busca nem
campos criptografados internos.

## Consultas

### `GET /v1/consultas`

Requer `agenda:ler`. Aceita `pagina`, `limite`, `inicioEm` e `fimEm` em ISO 8601.
Sem periodo, consulta de 30 dias antes ate 90 dias depois do momento atual. A
janela maxima e de 366 dias.

### `POST /v1/consultas`

Requer `agenda:escrever`.

```json
{
  "referenciaExterna": "erp-consulta-7788",
  "pacienteId": "00000000-0000-4000-8000-000000000002",
  "profissionalId": "00000000-0000-4000-8000-000000000001",
  "inicioEm": "2026-08-20T13:00:00.000Z",
  "duracaoMinutos": 50,
  "local": "Consultorio 2",
  "enviarNotificacoes": true
}
```

O fluxo preserva validacao de conflito, Google Agenda quando conectado e
notificacoes configuradas. `referenciaExterna` tem a mesma garantia idempotente
da criacao de paciente.

### `DELETE /v1/consultas/:id`

Requer `agenda:escrever`. Cancela a consulta pelo fluxo de dominio; nao remove o
historico. Sincronizacao Google e comunicacoes seguem a configuracao existente.

A projecao publica da consulta omite IDs do Google, detalhes de notificacao,
payload interno, dados financeiros e link privado de teleconsulta.

## Webhooks

O gestor cadastra um endpoint HTTPS publico na porta 443 e escolhe os eventos:

- `paciente.criado`
- `consulta.criada`
- `consulta.cancelada`
- `formulario.respondido`

O segredo `whsec_...` aparece uma unica vez e fica cifrado em repouso. O OctaClin
recusa credenciais na URL, redirecionamentos e hosts que resolvam para enderecos
privados, loopback, link-local ou reservados. A resolucao validada e fixada na
conexao para reduzir risco de DNS rebinding.

Cada POST inclui:

```http
X-OctaClin-Event: consulta.criada
X-OctaClin-Delivery: <uuid da entrega>
X-OctaClin-Timestamp: <Unix timestamp em segundos>
X-OctaClin-Signature: v1=<HMAC SHA-256 hexadecimal>
```

O corpo e JSON bruto no formato:

```json
{
  "id": "00000000-0000-4000-8000-000000000003",
  "versao": "2026-08-01",
  "evento": "consulta.criada",
  "ocorridoEm": "2026-08-08T15:00:00.000Z",
  "dados": {
    "consultaId": "00000000-0000-4000-8000-000000000004",
    "pacienteId": "00000000-0000-4000-8000-000000000002",
    "status": "agendada"
  }
}
```

Valide a assinatura **antes** de interpretar o JSON. Calcule HMAC SHA-256 com o
segredo sobre `<timestamp>.<corpo bruto>` e compare em tempo constante. Recuse
timestamps antigos conforme a tolerancia do consumidor e deduplique pelo header
`X-OctaClin-Delivery`.

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

function assinaturaValida(corpoBruto: Buffer, timestamp: string, recebida: string, segredo: string) {
  const esperada = createHmac('sha256', segredo)
    .update(`${timestamp}.${corpoBruto.toString('utf8')}`)
    .digest('hex');
  const valor = recebida.startsWith('v1=') ? recebida.slice(3) : '';
  const a = Buffer.from(esperada, 'hex');
  const b = Buffer.from(valor, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
```

HTTP 2xx confirma a entrega. Outros status, timeout ou falha de rede geram ate
seis tentativas: aproximadamente 1 min, 5 min, 30 min, 2 h, 8 h e 24 h. O gestor
pode consultar o historico e solicitar novo processamento de uma falha. Uma
entrega interrompida por queda do worker volta automaticamente para a fila apos
10 minutos; entregas ja confirmadas nao aceitam reprocessamento manual.

## Privacidade e operacao

- Solicite apenas os escopos necessarios e use uma chave por sistema consumidor.
- Rotacione imediatamente uma chave ou segredo suspeito e revogue o anterior.
- Os eventos carregam identificadores e metadados operacionais minimos; consulte
  detalhes pela API apenas quando houver finalidade e autorizacao.
- O cliente e responsavel por avaliar o fornecedor receptor, base legal,
  contrato, retencao e eventual transferencia internacional.
- Operacoes de escrita, gestao de credenciais e reprocessamento sao auditadas
  sem registrar segredo, chave completa ou dado clinico no metadado de auditoria.
