# Execução do piloto sintético318 após409

## Escopo e estado

Base main `b9535170`, merge409 confirmado pelo GitHub e fetch em2026-10-13.
Branch `feature/fase-318-revisao-sintetica`. EscopoR4: piloto exclusivo de fontes
sintéticas do servidor, cadastro individual reutilizado, autorização/SID/grant,
prova, quota, BFF e UI. Não altera prontuário, portal,316stand-by ou314.
Titular forneceu IDs por canal da sessão; nenhum ID real ou chave versionado.
Isso identifica o alvo proposto, não prova os vínculos no banco ou ativa o piloto.

Worktree original preservada em `/workspace/octaclin/.worktrees/fase-318-piloto-sintetico`.
ENOSPC durante criação de container PostgreSQL e build do backend impediu provas
locais padrão. Checkout isolado `/tmp/octaclin-f318-entrega` copia somente mudanças
próprias; caches/dependências originais não excluídos. Nenhum writer na original
após essa transferência. Git principal e sua alteração preexistente next-env
permanecem preservados. Não foram alterados configuração, dados ou schema externos.

## Implementação

-30IDs de corpus,19casos comparáveis e11de contrato/segurança, com critérios.
  Composição local mantém textos e refs; não calcula diagnósticos/indicadores.
- Toda ação passa pelo contexto318 existente:tenant verificado, papel/permissões,
  profissional ativo, usuário/tenant ativos e SID vigente. Grant interno específico
  para usuário/profissional e versão positiva; flag própria desativada por padrão.
- Prévia selada15min vincula tenant/ator/SID, epochs do perfil/usuário/tenant,
  grant, credencial e corpus. Nenhum pacienteId ou fonte/texto livre é aceito.
- Geração somente com direitos sintéticos próprios, credencial cifrada, modelo
  permitido e ciência de cobrança. Nenhuma reutilização de gate clínico.
- Quota operacional em tenant_configuracoes, sob o lock transacional do contexto
  compartilhado. Nonce/instante/cooldown apenas, sem conteúdo/chave/paciente.
  Cinco chamadas/15min, cooldown120s e reserva24h, sem replay/retry automático.
  Prova vence15min, portanto a expiração da reserva não autoriza replay tardio.
  Limpeza das entradas no próximo uso; último ledger permanece até limpeza
  administrativa. Sem promessa de TTL físico nem alteração de schema.
- Chamada fora da transação; retorno exige vínculo/grant/versões atuais. Não
  promete cancelar cobrança após envio; timeout/reserva permanecem conservadores.
- Auditoria mínima na mesma transação, antes do provider, com helper existente;
  erro de auditoria impede chamada. Sem saída/prova/nota/custo na trilha.
- BFF fechado, mesmoOrigin/permissões e projeção explícita/no-store. A UI não
  salva nem confirma em prontuário; limpar/desmontar em saída/página oculta,
  sessão divergente no foco ou antes de exibir retorno. Chave do filho desmontada.

## Catálogo e direitos

Fontes públicas/modelos e SHA256: `docs/product/FONTES_PILOTO_SINTETICO318.json`.
GPT-5mini/nano e5.4nano foram excluídos do novo catálogo por indicação de depreciação
nas páginas consultadas. Candidatos5.4mini e5.4 com snapshots fixos, Responses e
structured outputs documentados; preços datados, saída<=2048tokens. Mini é o padrão
mais econômico entre esses candidatos. Não prova disponibilidade na conta,
qualidade de geração, licença comercial ou aprovação clínica. Sem chamada real.

Consulta atual do acordo de serviços e guia de chaves falhou comHTTPError; status
não capturado. Os registros anteriores deHTTP200 permanecem históricos. Nenhum
novo direito presumido. Direitos clínicos e sintéticos false; catálogo clínico
vazio, catálogo sintético não exposto enquanto direitos não ratificados.
Termo de custódia proposto em `docs/product/TERMO_PILOTO_SINTETICO_BYOK_FASE_318.md`.

## TDD e evidências do checkpoint local

| Verificação | Resultado observado |
| --- | --- |
| Corpus | RED3FAIL/1PASS (stubs tipados), GREEN4PASS |
| Isolamento/serviço | RED7FAIL, GREEN7PASS; casos adicionais de credencial |
| Auditoria | RED2FAIL/11PASS, GREEN13PASS |
| Catálogo candidato | RED1FAIL/1PASS, GREEN2PASS |
| BFF | RED1FAIL/6PASS, GREEN7PASS, payload/projeção fechados |
| UI foco/retorno tardio | RED2FAIL/2PASS após corrigir fixture de sessão; GREEN no navegador final |
| Playwright318 anterior+piloto, desktop/mobile | PASS22, inclui axe/foco/limpeza/chave |
| Backend completo final | PASS2815/SKIPPED101,323suítesPASS/6SKIPPED |
| Backend build/artefato no checkout/tmp | PASS; tentativa anterior na worktree FAIL por ENOSPC |
| Web build/typecheck | PASS com webpack; Turbopack local FAIL por symlink externo de node_modules |
| Lint superfícies alteradas | PASS0errors/0warnings após callbacks estáveis |
| BFF e matriz confiabilidade | PASS |
| Secrets/guardas/auditoria/migrations/actions | PASS nos comandos registrados abaixo |
| PostgreSQL local | BLOCKED: docker run retornou no space left on device; nenhum banco iniciou |
| PostgreSQL/CI novo | PENDING no checkpoint; suíte existente CI inclui os novos casos |
| Chamada OpenAI/produção/ativação | SKIPPED: não autorizadas ao agente; gates próprios pendentes |

Primeiras tentativas UI tinham mock de sessão sem tenantSlug/email/apiUrl e
falhavam no ConsoleShell. Não contam como provaRED de ausência da funcionalidade;
fixture corrigida antes dos RED válidos de foco e retorno tardio.
Os testes locais de PG permanecemSKIPPED pelos guards de ambiente; não declarar
RLS/concorrência reais aprovados até resultado da suíte no banco descartávelCI.

Comandos locais (Node22.23.3 em/tmp/f318-toolchain/node, sem instalar deps novas):
`jest --runInBand`, Jest específico modulos/ia e corpus/serviço/catálogo;
`tsc --noEmit`, `nest build`, `verificar-artefato-producao.mjs`;
`next build --webpack`, ESLint das superfícies; `test-fase-318-bff.mjs`;
Playwright `fase-318-piloto.spec.mjs` + `fase-318-ia.spec.mjs` desktop/mobile;
`scan-secrets.mjs`, `validar-redacao-auditoria.mjs --inventario`,
`validar-guardas-controladores.spec.mjs`, `test-matriz-confiabilidade.mjs`,
`validar-migracoes-fora-de-banda.spec.mjs`, `validar-actions-imutaveis.spec.mjs`.
Suite Webtest:authz: primeira tentativa FAIL/EACCES na escrita de tsbuildinfo
fora do checkout/tmp. Nova tentativa desativa somente incremental local durante
os scripts e restaura tsconfig original; estado final na PR. Nenhuma alteração
de compilador/configuração foi versionada como correção do produto.
Não há PowerShell neste ambiente: preflight completo será conferido noCI.

## Revisão R4 cruzada

Agente reviewer distinto, somente leitura, encontrou doisP2: descarte da UI entre
janelas/sessões visíveis e ausência de auditoria da solicitação. Ambos reproduzidos,
corrigidos e reexaminados. Revisor não encontrouP1/P2residual concreto nesses
caminhos; não executou testes/bancos e não ratificou clínica/jurídico.
Ampliada provaPG: serviço/contexto reais com grant/SID, escopo, prova anterior à
reativação e revogação; quota concorrente e cross-tenant sob roleNOBYPASSRLS.
Não declarar revisão humana independente ou passagemPG por inspeção do teste.

## Checklist operacional e rollback

- [ ] CI e provaPG/RLS/concorrência do HEAD aprovado.
- [ ] Revisar custódia/condições BYOK e registrar aceite institucional específico.
- [ ] Verificar runtime efetivo NOBYPASSRLS/grants/cifra/canalHTTPS.
- [ ] Validar vínculo dos três IDs recebidos sem publicar dados administrativos.
- [ ] Autorizar publicação/configuração do piloto sintético no ambiente identificado.
- [ ] Gravar grant específico `ia318_piloto_sintetico`, com habilitada, usuarioId,
      profissionalId, versao>=1; toda alteração aumenta versão sob lock tenant.
      Nunca enviar grant arbitrário pela UI ou deixar outros atores configurar.
- [ ] Habilitar somente flag `IA318_PILOTO_SINTETICO_ATIVO` no ambiente autorizado.
      Composição local não exige aprovação dos direitos de chamada externa.
- [ ] Somente após evidência de direitos/termo e revisão: alterar constante sintética
      por PR revisada. Não habilitar `DIREITOS_BYOK318_APROVADOS`, catálogo clínico
      ou `IA_RASCUNHOS_OPERACAO_APROVADA` para permitir este piloto.
- [ ] Titular cadastra chave de projeto própria, revogável, pela tela do piloto.
- [ ] Revisão humana30casos e decisão clínica documentada; uso real continua bloqueado.

Rollback: desligar flag sintética, desabilitar grant e incrementar versão na mesma
operação protegida pelo lock `gamificacao317:<tenant>`; isso invalida prévias e
retornos. Remover credencial cifrada pelo caminho existente, se necessário; revogar
no fornecedor depende do titular. Não apagar migrations1070/1071, configurações
clínicas, prontuários ou históricos. Reservas/auditoria não são cobrança reversível.
Nenhuma nova migration, merge, deploy, grant, flag ou chamada paga foi executada.
