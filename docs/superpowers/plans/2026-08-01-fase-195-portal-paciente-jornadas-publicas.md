# Fase 195 - Portal do paciente e jornadas publicas

Status: executado em 2026-08-01 em tres partes independentes, com um commit
validado por parte e fechamento documental unico da Fase 195.

## Objetivo

Transformar o portal do paciente e as jornadas publicas em fluxos simples,
responsivos e seguros, sem expor indicadores clinicos internos. Preservar os
contratos existentes e adicionar persistencia de rascunho somente no backend.

## Decisoes obrigatorias

- Rotas autenticadas do portal continuam usando o BFF e cookies HttpOnly.
- Rotas publicas nunca encaminham cookies nem `Authorization` ao backend.
- Dados do tenant sao derivados do token assinado; nenhum `tenantId` livre e
  aceito do navegador.
- `scoreFinal`, `scorePonderado` e risco clinico nao aparecem no portal do
  paciente.
- Servico, especialidade e local nao serao inventados nesta fase. Eles so
  entram quando o backend possuir contratos reais para esses conceitos.
- O fuso da configuracao do tenant deve ser um identificador IANA valido; valor
  invalido usa `America/Sao_Paulo` como fallback.
- A cor primaria aceita somente hexadecimal seguro; nome e cor possuem
  fallback para o tenant/OctaClin.
- Rascunho publico usa o token assinado ja existente, limite de abuso, limites
  de payload e a mesma validacao estrutural das respostas finais, permitindo
  apenas que perguntas obrigatorias ainda estejam vazias.
- A assinatura usa `FORMULARIO_PUBLICO_SEGREDO` dedicado, obrigatorio e com
  pelo menos 32 bytes em producao, sem fallback para JWT.
- O frontend serializa salvamentos para impedir que uma resposta antiga
  sobrescreva uma edicao nova no mesmo dispositivo. O backend usa versao
  otimista e retorna conflito quando outro dispositivo salvou antes.
- O rascunho e apagado na finalizacao para minimizar duplicacao de dado
  clinico e tambem quando o envio expira.
- A migration sera validada apenas em banco local ou no banco de integracao
  explicitamente confirmado. Nunca executar contra URL ambigua.

## 195A - Portal do paciente por jornadas

### Entrega

1. Criar um provider persistente em `app/portal/layout.tsx` para carregar uma
   unica vez `GET /api/portal/paciente` e compartilhar estado e mutacoes.
2. Criar rotas reais:
   - `/portal`: proxima acao, proxima consulta e progresso do plano;
   - `/portal/agenda`;
   - `/portal/checkins`;
   - `/portal/plano`;
   - `/portal/formularios`;
   - `/portal/mensagens`;
   - `/portal/perfil`;
   - `/portal/privacidade`;
   - `/portal/mais`: acesso mobile aos itens fora da barra inferior.
3. Manter cinco destinos na navegacao mobile: Inicio, Agenda, Plano,
   Check-ins e Mais.
4. Preservar desmarcacao, check-in, perfil, detalhes de formulario, exportacao,
   consentimentos e solicitacoes LGPD.
5. Remover indicadores clinicos numericos de toda a interface do paciente.

### TDD e aceite

- Testar primeiro navegacao entre rotas, persistencia de um unico bootstrap,
  homepage reduzida e ausencia de texto de score.
- Validar desktop e mobile com dados sinteticos.
- Rodar `typecheck`, `lint` e Playwright do portal.

## 195B - Agendamento publico com identidade e confirmacao

### Entrega

1. Reusar `TenantConfiguracaoOrm`, chave `conta_cliente`, no servico de agenda
   publica para retornar `clinica.nome`, `clinica.corPrimaria` e `timezone`.
2. Normalizar configuracao no backend e aplicar fallbacks seguros.
3. Repassar somente os campos permitidos pelo BFF publico, sem cookies ou
   cabecalho de autorizacao.
4. Exibir identidade da clinica e fuso de forma legivel.
5. Inserir etapa de resumo antes do POST final, deixando claro que se trata de
   uma solicitacao sujeita a confirmacao.

### TDD e aceite

- Backend: configuracao valida, configuracao ausente e fuso/cor invalidos.
- BFF: contrato permitido e ausencia de encaminhamento de credenciais.
- Playwright: horario -> dados -> resumo -> confirmacao, desktop e mobile.

## 195C - Rascunho publico seguro

### Modelo

Adicionar em `envios_questionario`:

- `respostas_rascunho jsonb null`;
- `rascunho_atualizado_em timestamptz null`;
- `rascunho_versao integer not null default 0`.

A migration deve possuir `up` e `down`, ser registrada em
`opcoes-typeorm.ts` e coberta pelo teste de sequencia de migrations.

### Contrato

- `GET /formularios/:token` retorna `respostasRascunho` quando existente.
- `PATCH /formularios/:token/rascunho` aceita `versaoBase` e no maximo 100
  respostas; versao obsoleta retorna conflito sem sobrescrever dados.
- Cada resposta aceita `perguntaId` UUID e `valor` JSON limitado a 16 KiB;
  perguntas duplicadas ou fora do snapshot/questionario sao rejeitadas.
- O endpoint consome limite de abuso atomico por envio/token antes da escrita.
- `POST /formularios/:token/respostas` reutiliza a validacao estrutural,
  valida obrigatorias e limpa o rascunho na mesma transacao logica.
- O processamento recorrente marca envios vencidos como expirados e elimina
  qualquer rascunho remanescente.

### Frontend

- Hidratar respostas a partir do rascunho retornado.
- Salvar apos aproximadamente 800 ms de inatividade.
- Serializar PATCHes: uma requisicao em voo, mantendo somente o estado mais
  recente pendente.
- Exibir `Salvando rascunho`, `Rascunho salvo` e falha recuperavel sem bloquear
  a resposta final.
- Nao usar `localStorage` ou `sessionStorage`.

### TDD e aceite

- Backend: token invalido, envio expirado/respondido, abuso, pergunta alheia,
  duplicata, payload excessivo, persistencia, retomada e limpeza ao finalizar.
- BFF: PATCH publico nao encaminha cookies nem `Authorization`.
- Playwright: autosave, reload/retomada e envio final, desktop e mobile.
- Validar migration somente em banco explicitamente confirmado.

## Fechamento

1. Rodar validacoes proporcionais dos dois pacotes, `git diff --check` e
   `pnpm security:secrets`.
2. Criar `fase-195-portal-paciente-jornadas-publicas.md`.
3. Atualizar `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`,
   `STATUS_ATUAL_PROJETO.md`, `RESUMO_FASES_CONCLUIDAS.md`,
   `TESTES_E_VALIDACOES.md` e matriz de confiabilidade quando aplicavel.
4. Revisar o diff de seguranca antes de integrar.
5. Integrar a branch somente com todos os gates verdes; publicar `main` apos
   a integracao, conforme `AGENTS.md`.
