# OctaClin - Decisoes de arquitetura

Este arquivo registra decisoes ja tomadas para evitar que outro agente reprojete o produto sem necessidade.

## ADR-001 - Nome e referencia

- Decisao: o produto se chama OctaClin.
- Contexto: LiveClin foi usado apenas como sistema de referencia/modelagem.
- Consequencia: textos, docs, commits e UI devem usar OctaClin.

## ADR-002 - Multi-tenancy

- Decisao: tenant e derivado do JWT autenticado e aplicado no backend.
- Nao usar: tenant livre em header ou body como fonte de verdade.
- Consequencia: todo servico sensivel deve receber `tenantId` do usuario autenticado e usar `ExecutorTenant`.

## ADR-003 - Backend

- Decisao: backend principal em NestJS com TypeORM e PostgreSQL.
- Consequencia: novos dominios devem seguir modulo NestJS, service, controller, DTOs e specs focadas.

## ADR-004 - Frontend e BFF

- Decisao: frontend em Next.js App Router com BFF em `app/api`.
- Consequencia: chamadas autenticadas do browser devem passar pelo BFF para usar cookies HttpOnly e renovar sessao.

## ADR-005 - Sessao

- Decisao: access token e refresh token ficam em cookies HttpOnly no BFF.
- Consequencia: evitar expor tokens ao JavaScript do browser.

## ADR-006 - Criptografia e PII

- Decisao: dados sensiveis devem ser criptografados no backend ou retornados apenas por DTO autorizado.
- Consequencia: nao retornar entidades ORM cruas quando elas contem hash, token, senha, PII criptografada ou payload sensivel.

## ADR-007 - Auditoria

- Decisao: leituras sensiveis e mutacoes administrativas devem gerar trilha.
- Consequencia: novas funcoes de suporte, LGPD, usuario, paciente, agenda e comunicacao precisam considerar auditoria.

## ADR-008 - Arquivamento

- Decisao: preferir arquivamento logico a delete fisico em dados clinicos e operacionais.
- Consequencia: deletes de pacientes/profissionais/usuarios devem ser avaliados como `ativo=false`, `arquivadoEm` ou status equivalente.

## ADR-009 - Email

- Decisao: suportar SMTP Gmail e Gmail API.
- Consequencia: novas mensagens transacionais devem usar adaptador existente, outbox quando aplicavel e nao implementar provedor isolado sem necessidade.

## ADR-010 - WhatsApp

- Decisao: usar Meta WhatsApp Cloud API.
- Consequencia: templates precisam ser aprovados na Meta e mapeados no OctaClin antes de automacoes reais.

## ADR-011 - Agenda

- Decisao: agenda interna deve sincronizar com Google Calendar.
- Consequencia: OctaClin deve manter estado proprio da consulta e tratar Google Calendar como integracao externa, nao unica fonte de verdade.

## ADR-012 - Convites administrativos

- Decisao: convites administrativos reutilizam `tokens_redefinicao_senha`.
- Contexto: isso evita criar tabela nova antes de amadurecer o fluxo.
- Consequencia: token recebe `payload.origem = convite_usuario_cliente`, expiracao, criador, reenviador/revogador e link para `/recuperar-senha`.

## ADR-013 - Portal do cliente

- Decisao: `Client` gerencia a conta SaaS, nao rotinas clinicas.
- Consequencia: portal do cliente deve mostrar conta, assinatura, usuarios, convites, configuracoes e billing; nao deve virar console clinico.

## ADR-014 - Portal do paciente

- Decisao: `Patient` usa portal isolado.
- Consequencia: paciente nao acessa console operacional nem portal do cliente.

## ADR-015 - Deploy

- Decisao atual: GitHub privado, Render, Neon e Upstash.
- Consequencia: documentacao de producao deve considerar esses provedores ate decisao explicita de troca.

## ADR-016 - Desenvolvimento por fases

- Decisao: continuar por fases numeradas.
- Consequencia: cada fase deve ter commit, validacao e documentacao propria. O checklist vivo deve ser atualizado.

## ADR-017 - Busca sobre PII cifrada

- Decisao: a busca server-side de pacientes usa indice cego de tokens e
  prefixos normalizados, nunca uma coluna derivada em texto claro.
- Protecao: cada entrada usa HMAC-SHA256 com chave derivada da chave AES,
  separacao de dominio e `tenantId`; SHA-256 sem chave nao e aceito para nome
  ou contato.
- Limite: somente prefixos com 3 a 32 caracteres sao indexados. Busca por trecho
  arbitrario no meio de um token nao faz parte do contrato.
- Operacao: migration cria a coluna e o indice; backfill descriptografa e
  reindexa pela aplicacao somente contra banco explicitamente confirmado.
- Consequencia: rotacao da chave AES exige reindexacao coordenada dos hashes de
  busca junto da recriptografia dos dados.

## ADR-018 - Armazenamento de anexos clinicos

- Decisao: usar bucket privado Cloudflare R2 pela API S3, com credencial e
  bucket separados por ambiente.
- Fluxo: o navegador envia por URL pre-assinada curta; o backend confirma o
  objeto real, MIME, tamanho, metadados e SHA-256 antes de exibir ou contabilizar.
- Protecao: bucket/chave e credenciais nao fazem parte dos DTOs publicos; acesso
  de leitura tambem usa URL curta depois de autorizacao por tenant e paciente.
- Imutabilidade: o PUT assinado exige criacao condicional; depois da inspecao o
  backend promove `pendentes/` para `confirmados/`, prefixo que nunca e exposto
  para escrita do navegador.
- Abuso: a reserva de cota e serializada por tenant, uploads sao limitados e o
  lifecycle do provedor remove temporarios abandonados.
- Consequencia: o backend le arquivos de ate 25 MB na confirmacao. Streaming e
  antivirus dedicado so entram quando volume ou risco medido exigirem.

## ADR-019 - Processadores distribuidos

- Decisao: separar HTTP e processamento assincrono pelo papel
  `OCTACLIN_PROCESSO`; `web` recebe requisicoes e `worker` consome filas e
  cron. `all` e apenas compatibilidade local/transitoria.
- Protecao: comunicacoes/outbox/automacoes usam reivindicacao persistente antes
  de processar; Google Calendar usa exclusao transacional por profissional.
- Consequencia: Redis e obrigatorio para worker em producao. Nao escalar o
  papel `web` enquanto o worker e a validacao de entrega unica nao estiverem
  configurados no ambiente.

## ADR-020 - Teleconsulta por link externo

- Decisao: nao construir plataforma de video propria. A consulta ganha
  `modalidade` (`presencial`/`online`) e `link_teleconsulta`, apontando para
  Meet, Zoom, Whereby ou qualquer sala externa que a clinica ja use.
- Motivo: a demanda comercial e ter o campo, nao ter o codec. Video proprio
  significa midia server, TURN, gravacao, banda e conformidade de midia clinica
  a custo desproporcional para o mesmo resultado na comparacao de venda.
- Protecao: apenas `https` e aceito (`linkTeleconsultaValido`); consulta
  presencial nunca guarda link, invariante travada tambem por CHECK no banco.
  O link nao aparece em log nem em auditoria — so em mensagem ao paciente,
  no evento do Google Agenda do proprio profissional e na resposta autenticada.
- Janela: o backend so devolve o link no campo estruturado
  `consultasProximas[].linkTeleconsulta` de 1h antes ate 30min depois do fim, e
  nunca para consulta cancelada ou encerrada. **A janela e reducao de superficie
  e clareza de interface, nao segredo:** o mesmo link foi entregue por email e
  WhatsApp no agendamento, e o texto dessa mensagem continua visivel no
  historico do portal. Quem trata o link como segredo esta enganado — sala
  externa e protegida pelo provedor (codigo de sala, sala de espera), nao pelo
  OctaClin.
- Consequencia: a clinica administra a propria sala. Sala persistente por
  profissional, gravacao e sala de espera ficam de fora ate haver demanda
  medida. **Esta decisao nao deve ser reaberta sem numero de venda perdida por
  falta de video proprio.**

## ADR-021 - PWA, cache clinico e aplicativo mobile

- Decisao: o portal do paciente e instalavel como PWA, mas seu service worker
  guarda somente assets publicos versionados e uma tela offline neutra.
- Privacidade: APIs, HTML autenticado e projecoes clinicas nao entram no Cache
  Storage. Operacoes offline ficam cifradas no IndexedDB com AES-GCM e chave
  nao exportavel apenas em memoria; logout ou HTTP 401 elimina a fila.
- Idempotencia: check-in usa `idLocal` persistido em
  `sincronizacoes_mobile`; formulario e idempotente pelo proprio envio e lock
  transacional.
- Mobile: `octaclin-mobile` existe e continua como cliente nativo separado. O
  PWA usa os endpoints do portal, nao `/mobile`, para preservar autorizacao,
  projecao segura e auditoria; apenas o padrao de idempotencia e compartilhado.
- Consequencia: fechar ou recarregar a pagina elimina uma fila cuja chave foi
  perdida. Persistencia clinica offline entre reinicios e push exigem fase
  propria e nao podem reutilizar Web Storage.

## ADR-022 - Telemetria interna e feature flags

- Decisao: iniciar o piloto com telemetria HTTP sanitizada, limitada e local ao
  processo, sem contratar provedor externo antes de haver escala medida.
- Privacidade: nao persistir payload, query string ou PII; normalizar rotas e
  expor somente referencia de requisicao derivada por hash.
- Limite: buffers locais reiniciam com o processo e nao representam varias
  instancias. Escala horizontal exige agregacao externa ou distribuida.
- Flags: usar allowlist conhecida, defaults desabilitados e precedencia
  `padrao -> ambiente -> tenant`, persistindo overrides no modelo existente de
  configuracao do tenant.
- Operacao: o painel sugere promover, observar ou rollback, mas a decisao e a
  execucao continuam humanas e seguem `RUNBOOK_PRODUCAO.md`.
