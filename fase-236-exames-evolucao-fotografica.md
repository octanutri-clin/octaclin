# Fase 236 - Exames laboratoriais e evolucao fotografica

Status: em execucao. Fase clinica posterior ao piloto assistido, orientada a
registro e acompanhamento. Ela nao interpreta resultados, nao gera diagnostico
e nao substitui a avaliacao profissional.

## Objetivo

Permitir que o profissional registre exames por coleta e marcador, e acompanhe
fotos de evolucao somente quando houver protocolo e consentimento documentado.
Os arquivos continuam privados no armazenamento existente e o prontuario mostra
metadados e acesso autorizado, nunca URL publica persistente.

## Decisoes de seguranca

- Exames, resultados, referencia e observacoes sao PHI: ficam cifrados em
  repouso; leitura, criacao e exclusao logica sao auditadas.
- O registro e append-only: correcao gera uma nova versao ou retificacao
  vinculada, sem reescrever a coleta original.
- Fotos exigem consentimento separado, versionado e revogavel antes de qualquer
  upload. A revogacao bloqueia novas capturas; a exclusao e retencao seguem o
  prazo registrado no consentimento e as politicas LGPD existentes.
- O arquivo usa `arquivos_midia` confirmado, categoria `exame` ou `foto`,
  bucket privado e URL assinada curta. O novo dominio guarda somente o vinculo
  clinico e nao duplica o objeto.
- Professional acessa apenas sua carteira; SuperAdmin conserva a leitura
  transversal explicitamente identificada; Patient recebe somente conteudo que
  for publicado em fase posterior. Nenhum dado de exame ou foto vai ao portal
  nesta fase.

## Incrementos

1. **Fundacao de dados**: migrations aditivas com RLS forcada para coletas,
   marcadores, protocolos fotograficos, consentimentos e series de fotos.
2. **Exames**: contratos, servico, auditoria e tela profissional para registrar
   coleta, marcadores, unidade, referencia, observacao e anexo privado.
3. **Fotos**: configuracao de protocolo, consentimento versionado, captura
   vinculada ao protocolo e comparacao autorizada sem URL publica.
4. **Leitura longitudinal**: serie por marcador e por protocolo, com dados
   ausentes explicitamente indicados e sem classificacao diagnostica.
5. **Aceite**: tenant/RLS, papeis, auditoria, retencao, desktop/mobile e jornada
   sintetica de consentir, anexar, visualizar, revogar e excluir logicamente.

## Incremento 1 - fundacao persistente

Entregue localmente em 2026-08-11. A migration aditiva `1024` cria quatro
tabelas novas: coletas laboratoriais, marcadores, consentimentos fotograficos e
series fotograficas. As estruturas usam colunas cifradas para resultado,
laboratorio, observacao, protocolo e evidencia; referencias entre colecao,
marcador e consentimento incluem `tenant_id` para impedir vinculo cruzado.

Todas as tabelas recebem RLS habilitada e forcada, policy por `app.tenant_id` e
indices para leitura longitudinal. Nenhum objeto de storage, valor clinico ou
foto foi migrado, preenchido ou publicado. A migration ainda nao foi aplicada
em staging ou producao.

Validacoes: teste unitario da migration, `pnpm --dir octaclin-backend typecheck`,
`pnpm --dir octaclin-backend build` e `git diff --check`.

## Incremento 2 - servico de exames e auditoria

Entregue localmente em 2026-08-11. O backend agora permite registrar uma coleta
com marcadores e listar a serie do paciente por rotas protegidas. Marcador,
resultado, unidade, referencia e metodo sao cifrados como um unico payload;
laboratorio e observacoes tambem sao cifrados. Nenhuma classificacao de normal,
alterado ou critico e calculada pelo sistema.

O servico executa dentro de `ExecutorTenant`, resolve a carteira do
Professional antes da leitura e rejeita paciente arquivado ou fora do escopo.
As rotas exigem `pacientes.ler` para leitura e `pacientes.gerenciar` para
criacao, e registram auditoria sem valores clinicos. A interface e os anexos
de laudo permanecem fora deste incremento.

Validacoes: teste unitario da criacao cifrada, typecheck e build do backend.

## Incremento 3 - BFF autenticado de exames

Entregue localmente em 2026-08-11. As rotas Next.js `GET` e `POST` de exames
laboratoriais usam a sessao HTTP do usuario para encaminhar a requisicao ao
backend, sem expor token no navegador ou incluir dado clinico na URL. O contrato
de frontend tipa coleta e marcador e preserva respostas de erro do backend.

Nenhuma tela importa esse contrato neste incremento. Assim, a entrega continua
compativel com producao enquanto a migration `1024` nao for aplicada primeiro
em staging e validada com uma conta sintetica autorizada.

Validacoes: typecheck, lint e build do frontend, alem de `git diff --check`.

## Pre-condicao de staging

O procedimento de aplicacao e verificacao da migration `1024` foi registrado
no `RUNBOOK_PRODUCAO.md`. A execucao exige URL owner de staging explicitamente
confirmada e deve parar caso `migration:show` apresente pendencia diferente da
`1024`. A tela profissional continua bloqueada ate esse aceite de schema.

Em 2026-08-12, a migration `1024` foi incluida na lista explicita do TypeORM.
Ela ja existia no repositorio, mas nao era carregada pelo `migration:show`; o
ajuste foi validado com typecheck e teste da propria migration antes da nova
tentativa em staging.

## Contrato inicial de exames

- Uma coleta tem paciente, autor, data de coleta, data de recebimento opcional,
  laboratorio e observacao, todos os campos identificaveis ou clinicos
  cifrados quando aplicavel.
- Um marcador pertence a uma coleta e carrega nome, resultado, unidade, faixa de
  referencia e metodo como payload cifrado. Valores nao sao normalizados nem
  comparados automaticamente enquanto nao houver protocolo clinico aprovado.
- O anexo de laudo e opcional e precisa pertencer ao mesmo tenant e paciente.

## Contrato inicial de fotos

- Protocolo: nome, vistas esperadas, finalidade e orientacoes; nunca inclui
  classificacao clinica automatica.
- Consentimento: paciente, versao do texto, data, autor que registrou,
  retencao ate e revogacao. Deve ser criado antes da foto e auditado.
- Serie: protocolo, data civil, autor, consentimento ativo e arquivos privados
  do mesmo paciente. Comparacao e uma escolha manual, nunca inferida.

## Fora do escopo

- Diagnostico, alerta de resultado critico, laudo por IA ou recomendacao
  terapeutica automatica.
- OCR de laudo, reconhecimento de imagem, armazenamento publico ou captura sem
  consentimento.
- Publicacao de exame ou foto no portal do paciente.

## Criterios de aceite

- Nenhum papel nao autorizado le exame, foto, consentimento ou URL assinada de
  outro paciente/tenant.
- Nova coleta e nova foto preservam o historico anterior; exclusao e logica e
  auditada.
- Uma foto nao pode ser enviada sem consentimento ativo e dentro do prazo de
  retencao documentado.
- A tela indica dado ausente e fonte do resultado, sem diagnostico por cor ou
  texto automatizado.
- Os testes validam RLS forcada, auditoria, carteiras de Professional, fluxo
  de arquivo privado e navegacao por teclado em desktop e celular.
