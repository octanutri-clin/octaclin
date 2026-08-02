# Fase 200 - Upload seguro e anexos clinicos

Status: codigo integrado e publicado em producao, migration `1014` aplicada em
producao, bucket B2 operacional e smoke autenticado aprovado; somente a
migration de integracao permanece pendente.

## Entregue no codigo

- Upload direto para bucket privado S3-compativel por URL pre-assinada de 5
  minutos, sem expor credenciais ao navegador.
- A escrita usa `If-None-Match: *` por padrao; no B2 essa protecao e desligada
  somente na chave aleatoria de `pendentes/`, que nunca e a chave clinica
  definitiva. O objeto validado e promovido para `confirmados/`.
- Confirmacao server-side por `HEAD` e leitura real do objeto; tamanho, MIME,
  metadados e SHA-256 nao confiam no cliente.
- Limite de 25 MB e allowlist por assinatura de arquivo para PDF, JPEG, PNG,
  WebP, MP3, M4A, OGG, WAV, MP4 e WebM.
- Estados `pendente`, `confirmado` e `excluido`; somente anexos confirmados
  aparecem ou contam para uso.
- Nome original criptografado e chave do objeto opaca fora da API publica.
- URLs de leitura curtas, exclusao no provedor antes da retirada logica e
  auditoria de solicitar, confirmar, visualizar e excluir.
- Aba `Anexos` no prontuario e upload real em formulario publico e operacoes
  mobile.
- Formulario publico preso ao tenant, paciente, envio e pergunta derivados do
  token; nenhum papel administrativo sintetico e usado.
- Cota reservada sob lock transacional antes da URL, rate limit nos fluxos
  autenticado e publico e exclusao clinica restrita a profissional ou
  SuperAdmin.

## Banco

- Migration `1720000001014-ProtegerArquivosMidia` adiciona estado, categoria,
  nome original criptografado, timestamps e unicidade de bucket/chave.
- Registros legados ficam `pendente`: eles nao provam que existe objeto no
  provedor e, por isso, nao sao exibidos automaticamente.
- Aplicar com role `neondb_owner`; manter `octaclin_app_producao` apenas no
  runtime.
- Producao validada em 2026-08-02: migration presente no historico, 5 colunas,
  2 constraints e o indice unico confirmados. A URL owner temporaria foi
  removida apos o uso.

## Provedor e ambiente

- Provedor escolhido: Backblaze B2, bucket privado e criptografado
  `octaclin-midias-clinicas-producao`, regiao `us-east-005`.
- Credencial S3 esta restrita ao bucket de producao e nao acessa outros
  buckets da conta.
- CORS permite a origem `https://octaclin-web-producao.onrender.com`, metodos
  `PUT`, `GET` e `HEAD`, e headers `content-type` e `x-amz-meta-*`.
- `ARMAZENAMENTO_S3_IF_NONE_MATCH=false` e obrigatorio no B2 porque o
  `PutObject` condicional responde `501 NotImplemented`; nos demais provedores
  o bloqueio continua ativo por padrao.
- Regra de lifecycle oculta objetos do prefixo `pendentes/` apos 1 dia e os
  exclui definitivamente apos mais 1 dia; o backend tambem libera reservas
  vencidas antes de novos uploads.
- Variaveis: `ARMAZENAMENTO_S3_ENDPOINT`, `ARMAZENAMENTO_S3_REGION`,
  `ARMAZENAMENTO_S3_ACCESS_KEY_ID`, `ARMAZENAMENTO_S3_SECRET_ACCESS_KEY`,
  `ARMAZENAMENTO_BUCKET_MIDIA` e `ARMAZENAMENTO_S3_IF_NONE_MATCH`.

## Validacoes locais

- Backend: 74 suites, 418 testes, typecheck e build.
- Fluxos focados apos revisao de seguranca: 23 testes.
- Web: typecheck, build, 58 rotas Next 15 e 23 testes de autorizacao/BFF.
- Playwright de anexos no prontuario: desktop e mobile.
- Playwright de upload em formulario publico: desktop e mobile.
- Revisao adversarial fechou sobrescrita pos-confirmacao, exclusao por paciente,
  reserva de cota, expiracao de pendentes e limites de abuso.

## Gates pendentes

1. Repetir a migration `1014` no banco de integracao explicitamente
   identificado; producao ja foi aplicada e confirmada.

## Rollout de producao

- PR `#13` integrada na `main` pelo merge `369fffc` em 2026-08-02.
- Backend Render publicado no merge `369fffc`, com as seis variaveis do B2 e
  `ARMAZENAMENTO_S3_IF_NONE_MATCH=false`; health respondeu `200`.
- Frontend Render publicado no mesmo merge `369fffc`.
- CI da `main` aprovado nos cinco jobs: backend, web, mobile, IA e demo local
  smoke. O demo foi alinhado para listar somente arquivos confirmados.
- Scanner local de secrets aprovado sem credenciais reais no repositorio.
- O primeiro smoke de interface revelou que o contrato ainda devolvia
  `If-None-Match` mesmo quando a assinatura o omitia. A fonte compartilhada foi
  corrigida no PR `#14`, merge `9e2478b`, com 22 testes focados, typecheck,
  build e os cinco jobs do CI aprovados; o backend ficou `Live` nesse merge.
- Smoke autenticado final aprovado no prontuario: solicitacao `201`, `PUT` B2
  `200`, confirmacao `201`, exibicao na aba Anexos, abertura assinada, download
  integro e exclusao pela confirmacao da interface.
- Smoke publico aprovado com formulario sintetico: abertura `200`, solicitacao
  `201`, contrato sem `If-None-Match`, `PUT` B2 `200` e confirmacao `201`. O
  anexo foi excluido e o formulario tecnico foi arquivado.

## Evidencia do provedor

- Bucket privado e criptografado criado em 2026-08-02.
- CORS S3 confirmado por preflight e upload `200`, limitado a origem web de
  producao.
- Lifecycle relido pela API com prefixo exclusivo `pendentes/` e prazos `1/1`.
- Smoke sintetico confirmou `PUT`, `HEAD`, copia com metadados, download
  assinado, integridade byte a byte e exclusao; objetos de teste removidos.
- Os smokes autenticado e publico de producao repetiram o ciclo completo pelo
  BFF e deixaram a lista final do paciente sem anexos sinteticos.
