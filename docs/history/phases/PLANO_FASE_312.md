# Fase 312 — encaminhamento no motor de documentos

Planejamento e decisões aprovados em 2026-10-10; implementação concluída na
branch `feature/fase-312-documentos-clinicos`, aguardando PR/CI. Risco da fase:
R4 (PHI, autorização, tenancy, criptografia e migration). Execução, limites e
testes registrados ao final. Handoff corrente: `tasks/plan.md`.

## Base e escopo aprovado

- Branch: `feature/fase-312-documentos-clinicos`.
- Worktree: `/workspace/octaclin/.worktrees/feature-fase-312-documentos-clinicos`.
- Base: `cd345a5e` (main, inclui merge 311 e atualização Handlebars PR #387).
- Fase 311 integrada pelo PR #389, merge `f5f9ba84`, confirmado no GitHub.
  CI da PR `38022212900` e CI pós-merge `38042089805`: SUCCESS.
  A PR não tem revisão formal independente registrada. Provenance do SBOM
  da PR ficou SKIPPED; não equivale a PASS. Produção não foi consultada.
- Decisões do proprietário: entregar encaminhamento; atestados aguardam
  validação específica; destino/serviço e motivo obrigatórios, destinatário,
  instituição e contexto clínico opcionais; impressão/PDF via navegador.
- Decisões finais: somente o próprio profissional responsável atual emite;
  sem consulta de origem obrigatória; prévia completa e confirmação explícita.
- Atestados não fazem parte desta implementação. Gate permanece PENDENTE:
  validar documentalmente tipo/finalidade, profissão/conselho, competência,
  jurisdição e assinatura antes de planejar esse recurso. Não inferir
  impedimento universal, aprovação jurídica ou competência pelo papel no SaaS.
- Entrega pelo fluxo de impressão existente, com assinatura manual pelo
  profissional. Não há assinatura digital/certificação/verificação pública,
  publicação no portal nem envio externo novo no escopo aprovado.

## Gaps observados e tratamento

| Evidência no código | Consequência | Tratamento mínimo |
| --- | --- | --- |
| `dominio/documentos-clinicos.ts` e CHECK atualizado pela migration 1019 admitem três tipos | Adicionar apenas enum quebra INSERT no banco | Quarto tipo `encaminhamento` e migration registrada |
| `garantirAutoriaLegitima` aplica-se apenas à alta | Novo texto autoral poderia sair sob registro de outro | Regra própria para autoria do encaminhamento e teste negativo |
| `garantirDocumentoIdentificavel` observa somente variáveis renderizadas | Override pode omitir identificação e evitar bloqueio | Validar dados do paciente/profissional diretamente e tokens essenciais do modelo novo |
| Título renderizado fica em claro e aparece na timeline | Variável clínica em título novo exporia PHI | Título do encaminhamento fixo `Encaminhamento`; conteúdo apenas no corpo cifrado |
| Emissão é direta; não há prévia | Não assegura conferência do texto final antes de persistir | Proposta: prévia autorizada sem persistência, confirmada pelo hash da mesma renderização |
| Encaminhamento não tem unicidade por consulta | Retry após timeout pode criar outro documento | Chave UUID por ação e deduplicação durável por tenant/autor |
| Serviço de modelos substitui todo `valor` usando apenas tipos enviados | PATCH de cliente antigo apagaria override do tipo novo | Preservar tipos omitidos e mesclar sob lock na transação |
| Append-only atual depende da aplicação | UPDATE SQL poderia mudar snapshot novo | Trigger de imutabilidade de conteúdo/identidade para encaminhamento |
| BFF de documentos só exige sessão e respostas não fixam no-store localmente | Rota nova não deve repetir lacuna de contrato | Permissão explícita e `private, no-store` nas rotas tocadas, inclusive erros |
| `AbaDocumentos` usa ramo genérico para qualquer tipo sem consulta | Novo tipo cairia no formulário da alta | Ramos explícitos e componente de prévia próprio |

Esses controles aplicam-se ao novo tipo e às rotas/configuração diretamente
tocadas. A revisão de títulos e identificação de documentos legados é risco
residual documentado; não converter dados antigos ou alterar seu texto emitido.

## Contrato fechado de domínio e API

### Entrada e validação

Manter `POST /pacientes/:pacienteId/documentos`; ampliar DTO existente com
`encaminhamento?: EncaminhamentoDocumentoDto`, `hashPrevia?: string`,
`chaveEmissao?: UUID` e `confirmacao?: boolean`. Os três tipos atuais mantêm
seu contrato. Novos campos de encaminhamento são recusados em tipos antigos.

Para `tipo: 'encaminhamento'`:

```json
{
  "tipo": "encaminhamento",
  "encaminhamento": {
    "destinoServico": "Serviço sintético",
    "destinatarioNome": "Profissional sintético",
    "instituicaoDestino": "Instituição sintética",
    "motivoEncaminhamento": "Motivo sintético informado pelo profissional.",
    "contextoClinico": "Contexto sintético opcional."
  },
  "cidadeEmissao": "Cidade sintética",
  "hashPrevia": "64 caracteres hexadecimais devolvidos na prévia",
  "chaveEmissao": "UUID gerado para esta ação",
  "confirmacao": true
}
```

- `destinoServico`: string trim, 1–180; `motivoEncaminhamento`: 1–2000.
- `destinatarioNome` e `instituicaoDestino`: opcionais, máximo 180 cada.
- `contextoClinico`: opcional, máximo 4000; `cidadeEmissao`: máximo 120 existente.
- Normalizar trim e CRLF→LF; vazio/whitespace não satisfaz obrigatório.
  Validar DTO aninhado com `ValidateNested`/`Type`; serviço reforça obrigatórios
  e condições por tipo, sem depender de execução manual do ValidationPipe.
- Rejeitar `conteudo` genérico e, no contrato sem consulta, `consultaId` para
  encaminhamento. Nenhum `tenantId`, paciente, emissor ou registro vem do body.
- Texto puro: sem inferência clínica, importação automática do prontuário,
  CID/diagnóstico preenchido pelo sistema, HTML interpretado ou reexpansão.
- Renderização nova: título fixo e corpo no máximo 16000 caracteres depois
  da expansão; recusar excesso antes de salvar (modelo ainda tem limite 8000).

### Autoria e leitura

- Emissão/prévia apenas `Professional` com `pacientes.gerenciar`, profissional
  ativo vinculado ao usuário, no mesmo tenant e responsável atual pelo paciente.
  Nome do paciente, nome do profissional e registro devem ser não vazios,
  independentemente das variáveis usadas. Registro cadastrado não é prova de
  credenciamento externo nem validação jurídica.
- Resolver paciente/carteira via `ExecutorTenant` e helpers existentes.
  Paciente de outro tenant/carteira: 404 sem conteúdo; papel não emissor: 403.
- Na confirmação, ler/bloquear paciente e profissional ativo para leitura
  (`pessimistic_read`, dentro da transação) até o INSERT, impedindo troca de
  responsável/arquivamento no intervalo de validação. Prévia não precisa
  segurar lock após resposta. Testar transferência concorrente em PostgreSQL.
- O profissional emissor vem da identidade verificada; nenhum envio em nome
  de outro. Sem consulta de origem; não exigir agenda concluída.
- Leituras/cancelamento continuam nas permissões atuais do motor. Transferir
  responsável não reescreve snapshot. Novo responsável autorizado pode ler o
  histórico; não pode reemitir sob registro do anterior.
- Encaminhamento nunca integra `TIPOS_ENVIAVEIS_POR_EMAIL`.

### Modelos da clínica

- Incluir quarto tipo no catálogo backend, DTO Client, tipos Web e tela.
  Título fixo; na tela do gestor informar esse limite e editar somente corpo.
- Variáveis comuns existentes, mais `destinoServico`, `destinatarioNome`,
  `instituicaoDestino`, `motivoEncaminhamento` e `contextoClinico`.
- Corpo efetivo do encaminhamento exige tokens `pacienteNome`,
  `profissionalNome`, `profissionalRegistro`, `dataEmissao` e os cinco novos
  campos, para preservar autoria e todos os dados fornecidos. Obrigação vale
  após resolver fallback: corpo vazio restaura padrão. Opcional sem valor
  renderiza `Não informado`; não bloqueia emissão. Cidade mantém regra atual.
- Modelo padrão identifica paciente, destino, motivo, contexto, data/cidade e
  profissional/registro, com espaço para assinatura manual. Nenhuma declaração
  automática sobre diagnóstico ou necessidade de afastamento.
- `atualizarModelosDocumento`: lock advisory por tenant/configuração antes da
  leitura e merge na mesma transação, incluindo inexistência inicial de linha.
  Tipo omitido permanece; campos de tipo presente seguem fallback atual.
  Testar PATCH parcial de cliente antigo, reset e concorrência de tipos distintos.
- Validar override novo também ao preparar emissão, inclusive configuração
  antiga/inválida inserida fora da API; falha não persiste documento.

### Prévia e confirmação

- Nova rota `POST /pacientes/:pacienteId/documentos/previa` aceita apenas
  `tipo: encaminhamento`, campos de conteúdo e cidade. Não aceita confirmação,
  chave nem hash da emissão. DTO próprio permite limite claro.
- Retornar `{tipo, titulo, corpo, paragrafos, cabecalho, variaveisVazias,
  hashPrevia}`; sem ID/instante de documento emitido. Não salvar draft, gerar
  arquivo ou disparar notificação. Auditoria de acesso registra somente tipo e
  recurso; nunca corpo, campos, token ou hash de prévia.
- Uma preparação compartilhada resolve paciente, autor, perfil/modelo,
  variáveis/renderização e limites; usada em prévia e confirmação.
- `hashPrevia` SHA-256 de serialização determinística com chaves explícitas:
  tenant/paciente/autor/tipo, entrada normalizada, título/corpo/cabeçalho
  efetivos e variáveis vazias. Data local renderizada entra; timestamp instantâneo
  de persistência não entra. Assim, mudança de dia/modelo/cadastro/conteúdo
  relevante pede nova conferência; mudança que não afeta conteúdo não invalida.
- Final requer hash hex64 + `confirmacao === true`, recomputa preparação e
  compara hash antes de persistir. Divergência: 409 com mensagem sanitizada;
  UI invalida prévia e pede nova conferência. Persistir exatamente a preparação
  cujo hash foi comparado; não renderizar novamente depois da comparação.
- Hash é dado derivado protegido: só memória do fluxo/HTTP autenticado e
  metadata cifrada de controle; não URL, logs, audit metadata, cache ou storage
  do navegador. Não o tratar como prova jurídica de assinatura ou leitura.

### Idempotência e persistência

- Migration proposta `1720000001067-AdicionarEncaminhamentoDocumento.ts`;
  reconfirmar número livre antes de escrever. Registrar em `opcoes-typeorm.ts`.
- Acrescentar `encaminhamento` ao CHECK de tipo sem modificar CHECK de consulta,
  índices de declaração/recibo ou políticas RLS/FORCE atuais.
- Adicionar coluna UUID nullable `chave_emissao`; CHECK exige valor para
  encaminhamento, e índice UNIQUE parcial `(tenant_id, autor_usuario_id,
  chave_emissao)` somente para o novo tipo. Nenhum dado de conteúdo novo em claro.
- UUID gerado uma vez pela UI na confirmação; preservar body/UUID enquanto
  resultado for incerto. Backend autoriza paciente/autor antes de acessar
  chave. Lock advisory transacional por tenant/autor/UUID para serializar retries.
- Antes de preparar novamente, procurar emissão já existente com essa chave.
  Verificar paciente e fingerprint da requisição normalizada (inclui hash de
  prévia, campos, cidade/tipo; exclui UUID) guardado no cabeçalho cifrado.
  Mesmo pedido: devolver snapshot original, inclusive cancelado; pedido diferente:
  409 sem reutilizar conteúdo de outro paciente. Sem linha: comparar prévia e salvar.
- Não capturar `23505` dentro de uma transação PostgreSQL abortada e continuar
  consultas. Lock e consulta antecedente evitam colisão normal; erro inesperado
  termina/rollback da transação. Índice continua defesa no banco.
- Corpo/cabeçalho usam criptografia existente; campos livres ficam apenas no
  texto renderizado cifrado. Metadata privada de idempotência no cabeçalho não
  aparece no DTO (projeção campo a campo existente).
- Trigger BEFORE UPDATE protege campos de snapshot/identidade quando OLD ou
  NEW é encaminhamento: id, tenant/paciente/profissional/autor, tipo/consulta,
  título, corpo/cabeçalho cifrados, emissão/criação e chave. Permitir somente
  mutações de cancelamento e demais estados já previstos. A troca de tipo não
  contorna trigger. Não criar novo bloqueio de DELETE que altere retenção/LGPD.
- Auditoria existente da emissão permanece com identificadores/tipo/contagens
  seguras; evento novo de prévia passa inventário/redação. Retry retorna mesmo
  documento; auditoria pode registrar tentativa repetida, nunca outra emissão.
- Validar `confirmacao === true` antes de replay. HTTP sucesso da emissão
  mantém DTO existente; a UI reutiliza o mesmo UUID/body apenas quando o
  resultado é incerto, e gera nova chave para uma ação nova após resposta final.

## Web, BFF e integração

- Acrescentar nova chamada/tipos em `lib/prontuario-api.ts`; emissão antiga
  permanece com contrato compatível. BFF de prévia usa sessão + permissão
  `pacientes.gerenciar`, parâmetros assincronos, UUID/rota backend codificados.
- Rotas tocadas de documentos e modelos devolvem `private, no-store` em sucesso
  e falhas. GET documentos exige `pacientes.ler`; POST exige gerenciar. Reusar
  wrappers de sessão/renovação/permissão e regra de origem existente; backend
  revalida papel/carteira. Não duplicar catálogo de autorização.
- `prontuario-paciente.tsx` já tem papel/permissões; passar
  `podeEmitirEncaminhamento={papel === 'Professional' && podeGerenciarPaciente}`.
  Esse sinal só governa UI; decisão final é backend. Alterar `AbaDocumentos`
  com ramo específico; conservar seleção/validações dos outros três tipos.
- Prévia completa em componente compartilhável da folha, modal/drawer acessível
  ou seção dedicada; rascunho/prévia marcados, sem botão imprimir antes de emitir.
  Botão `Confirmar emissão` visível após prévia, bloqueado durante request.
  Qualquer edição local invalida prévia. Mudança de paciente limpa campos,
  documento selecionado, hash/UUID e ignora respostas de requests antigos.
- Após sucesso mostrar snapshot retornado/listado e impressão existente;
  corrigir exige cancelar e emitir outro documento. Cancelado deve ficar
  marcado na folha. PDF é ação do navegador, não gerador/arquivo novo no servidor.
- Mock demo e fixtures de documentos/modelos recebem quarto tipo e prévia;
  mocks gerais usam formato correto. Evitar rota não mockada e locators
  ambíguos, regressões vistas na integração 311.

## Gates e rollback

Checklist executável: `tasks/todo-fase-312.md`. Escrever testes relevantes
antes do comportamento novo. Mocks não aprovam constraints, trigger ou RLS.
Adicionar prova PostgreSQL no harness existente com migration real e role sem
owner/BYPASSRLS; manter inventário automático de todas as tabelas.

Migration deve preceder habilitação do novo tipo no ambiente confirmado.
Este planejamento não aplica migration em banco externo. Operação futura exige
ambiente/banco/branch/role owner, procedimento fora de banda e verificação de
constraints/estado do schema. Runtime continua sem DDL, synchronize ou migration automática.

Rollback de aplicação preserva leitura/impressão do novo tipo, desabilitando
novas emissões/prévia por patch; preservar schema/cifra/histórico. Não retornar
cegamente a UI sem suporte ao tipo novo. `down()` recusa antes de qualquer DDL
se existirem encaminhamentos; somente banco descartável sem linhas permite
restringir CHECK/remover trigger/índice/coluna. Nenhum DELETE/backfill para reverter.
Revisão R4 cruzada quando viável; registrar se não independente. Merge/CI não
equivalem a assinatura legal, aplicação da migration ou aceite de produção.

## Evidência do planejamento

- PASS: branch/base e merge 311 conferidos; contratos/consumidores/migrations,
  testes existentes, autorização, criptografia, BFF e impressão inspecionados.
- PASS: seis decisões recebidas do proprietário; contrato fechado.
- PASS no planejamento: `git diff --check`, `node scripts/scan-secrets.mjs` e
  `node scripts/test-matriz-confiabilidade.mjs` (40 referências críticas).
- Na etapa de planejamento: testes de implementação, banco externo, provider e
  produção ficaram SKIPPED; veja a evidência de execução abaixo.
- Ambiente observado: Node 24.19.0/pnpm 11.19.0; manifests exigem Node 22/
  pnpm 11.25.0. Antes de implementação, usar versões declaradas; avisos de
  engine não comprovam compatibilidade. PowerShell indisponível neste shell.

## Handoff de modelo

Planejamento recomendado: GPT-6.1 Sol médio. Implementação, depois do contrato
fechado: GPT-6 Luna alto, uma tarefa/controle por vez no mesmo worktree/PR.
O proprietário autorizou a implementação após o handoff. A fase foi executada
com GPT-6 Luna alto no worktree indicado. Não houve troca automática de modelo.

## Evidência da implementação

- PASS: backend typecheck/build; Web typecheck/build; ESLint alterados sem erros
  (avisos `setState` preexistentes permanecem); domínio/serviço/migration/TypeORM/
  Client, 52 testes focados passaram. Suíte backend completa: 2474 PASS,
  45 SKIPPED; três suites de integração ficam fora dela e RLS foi rodado à parte.
- PASS: PostgreSQL real via Testcontainers, migrations aplicadas em banco
  descartável e role runtime sem owner/BYPASSRLS: 26/26; RLS por tenant,
  unicidade da chave, trigger UPDATE, cancelamento permitido e `down()` recusado
  quando há encaminhamento. A prova de rollback roda pela role RLS restrita tanto
  no Testcontainers como no CI. Concorrência de replay do serviço e `down()` sem
  linhas permanecem sem prova real neste ciclo.
- PASS: BFF dedicado 2/2, regressão Playwright da Fase 312 em desktop/mobile
  2/2 com axe na prévia, smoke local `smoke-e2e-bff-ok`, redaction audit,
  guardas, auditoria de migrations, matriz de acessibilidade/confiabilidade e
  scanner de secrets. A suíte ampla `test:authz` terminou com exit 0, incluindo
  todos os harnesses encadeados e o BFF da 312 (2/2).
- SKIPPED: deploy, aplicação operacional da migration 1067, assinatura/provider,
  validação jurídica de atestados, revisão R4 independente e Provenance do SBOM.
  Não inferir aceite jurídico ou de produção a partir de builds/testes.
- PASS: CI final da PR #390, run `38048342326`: Backend NestJS, Web Next.js,
  Mobile Expo, AI FastAPI, Demo local smoke, Governança, Operação, Rollout e PR
  Gate; CodeQL, Dependency Review, Semgrep e Trivy passaram. Provenance do SBOM
  ficou SKIPPED conforme configuração do workflow.
- Ambiente executou Node 24.19/pnpm 11.19 contra manifests Node 22/pnpm 11.25.
  Build/testes locais passaram, mas CI com as versões declaradas continua sendo
  gate. O `pnpm test:authz` tentou auto-instalar a versão declarada e abortou ao
  proteger `node_modules` sem TTY; o mesmo script terminou com exit 0 pelo Node
  diretamente, sem modificar dependências ou lockfiles.
- Migration 1067 está registrada no código, não aplicada fora do container
  descartável. PR única #390 foi aberta e os checks listados acima passaram;
  revisão humana/merge continuam pendentes. Não houve merge automático.
