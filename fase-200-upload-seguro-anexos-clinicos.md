# Fase 200 - Upload seguro e anexos clinicos

Status: implementacao local validada e migration `1014` aplicada em producao;
bucket R2, rollout e smoke real pendentes.

## Entregue no codigo

- Upload direto para bucket privado S3-compativel por URL pre-assinada de 5
  minutos, sem expor credenciais ao navegador.
- A escrita exige `If-None-Match: *`; o objeto validado e promovido de
  `pendentes/` para `confirmados/`, e a URL publica nunca escreve na chave
  clinica definitiva.
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

- Provedor escolhido: Cloudflare R2, bucket privado
  `octaclin-midias-producao`.
- Credencial S3 deve ter apenas leitura e escrita de objetos nesse bucket.
- CORS permite a origem `https://octaclin-web-producao.onrender.com`, metodos
  `PUT`, `GET` e `HEAD`, e headers `content-type`, `if-none-match` e
  `x-amz-meta-*`.
- Regra de lifecycle remove objetos do prefixo `pendentes/` apos 1 dia; o
  backend tambem libera reservas vencidas antes de novos uploads.
- Variaveis: `ARMAZENAMENTO_S3_ENDPOINT`, `ARMAZENAMENTO_S3_REGION`,
  `ARMAZENAMENTO_S3_ACCESS_KEY_ID`, `ARMAZENAMENTO_S3_SECRET_ACCESS_KEY` e
  `ARMAZENAMENTO_BUCKET_MIDIA`.

## Validacoes locais

- Backend: 74 suites, 417 testes, typecheck e build.
- Fluxos focados apos revisao de seguranca: 23 testes.
- Web: typecheck, build, 58 rotas Next 15 e 23 testes de autorizacao/BFF.
- Playwright de anexos no prontuario: desktop e mobile.
- Playwright de upload em formulario publico: desktop e mobile.
- Revisao adversarial fechou sobrescrita pos-confirmacao, exclusao por paciente,
  reserva de cota, expiracao de pendentes e limites de abuso.

## Gates pendentes

1. Repetir a migration `1014` no banco de integracao explicitamente
   identificado; producao ja foi aplicada e confirmada.
2. Criar o bucket privado, lifecycle de `pendentes/` e token restrito no
   Cloudflare R2.
3. Configurar as cinco variaveis no backend Render e fazer deploy.
4. Validar upload, abertura e exclusao reais com arquivo sintetico no
   prontuario e em formulario publico.
5. Reexecutar health, login, scanner de secrets e smoke de producao.
