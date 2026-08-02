# Fase 200 - Upload seguro e anexos clinicos

## Objetivo

Substituir registros de midia sem objeto verificavel por upload privado,
confirmado no backend e acessivel apenas por URL curta e autorizada.

## Decisoes

- Backblaze B2 via protocolo S3; bucket privado e credencial por ambiente.
- Escrita condicional permanece ativa por padrao e pode ser desativada no B2,
  que responde `501 NotImplemented` para `If-None-Match` em `PutObject`.
- Upload direto do navegador por URL assinada de 5 minutos.
- Backend baixa no maximo 25 MB na confirmacao para validar assinatura e hash.
- Metadados, tamanho e MIME enviados pelo cliente sao apenas declaracoes; o
  objeto real decide confirmacao e consumo.
- A API nunca retorna bucket, chave do objeto ou credencial.
- O fluxo publico usa contexto derivado do token do formulario, sem usuario ou
  papel administrativo artificial.
- Registros pendentes ou excluidos nao aparecem no prontuario nem contam para
  a cota.

## Etapas

1. Criar adaptador S3/R2 e validacao de assinatura de arquivo.
2. Migrar o estado de `arquivos_midia` e registrar a migration `1014`.
3. Implementar solicitar, confirmar, acessar, listar e excluir com escopo.
4. Integrar prontuario, mobile e formulario publico.
5. Cobrir fronteiras de autorizacao e jornadas desktop/mobile.
6. Provisionar bucket/CORS/token e configurar Render.
7. Aplicar migration apenas com banco e role confirmados.
8. Fazer smoke real, atualizar documentos, commit e PR.

## Aceite

- Metadado forjado nao altera MIME, tamanho, hash ou consumo.
- Arquivo de outro tenant, profissional, paciente, envio ou pergunta nao pode
  ser confirmado, lido ou excluido.
- URLs expiram em 5 minutos e o bucket nao possui acesso publico.
- Exclusao e leituras sensiveis ficam auditadas.
- Prontuario e formulario publico funcionam em desktop e mobile.
