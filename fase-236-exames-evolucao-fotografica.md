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
