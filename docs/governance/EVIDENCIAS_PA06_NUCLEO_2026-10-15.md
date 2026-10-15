# PA06 — evidências do núcleo de autosave e edição parcial

Data:2026-10-15. Risco R4 (persistência clínica, migration, concorrência e authz).
Base `eae74b1e`; branch `feat/pos320-pa06-autosave`. Escopo: primeira entrega
aprovada em “Pode começar”. Interface ainda não implementada; não é aceite final
nem evidência de produção. Nenhum dado real, provider pago ou dependência nova.

## Contratos e correções

- Snapshot editorial inteiro versionado/cifrado na versão existente. Limites:
  documento96KiB,50 refeições,100 itens/refeição,20 alternativas/item; envelope
  HTTP conserva parser100KiB. A incompletude não afrouxa validação clínica.
- Revisão geral independente da revisão PA05 de apresentação. CAS confere geração
  e revisão sob locks antes de substituir filhos. Adesão protegida monotônica;
  clientes legados não podem sobrescrever rascunho já aderido sem CAS.
- Save/revisão/publicação avançam contador geral; clone tem geração própria.
- Pendências/ilegibilidade não exibem cálculo, refeições ou objetivos antigos como
  atuais; bloqueiam revisão, publicação e prévia paciente. Documento editorial não
  é incluído em projeção paciente/publicada. Publicada usa materialização imutável.
- Apagar observação grava NULL, pois TypeORM ignora undefined em UPDATE.
- Detalhe do plano, rascunho e versão seguram locks compartilhados de escopo ao
  montar o resultado; writers/transferências usam locks exclusivos correspondentes.
- Coordenador em memória, ciclo60s sem debounce, um voo e último pedido pendente.
  Não substitui campos do formulário por ACK. Erros pausam; sem retries incertos,
  persistência no navegador, flush de unmount, beacon ou publicação por timer.
- BFF conserva sessão/permissões atuais, precondições,409 e no-store; backend
  continua autorizando tenant/paciente/carteira e referências antes de gravar.

## TDD observado

Falhas de compilação/infraestrutura iniciais não foram contadas como RED.

| Caso | RED significativo | GREEN / controle |
| --- | --- | --- |
| Revisão geral e legado |3 falhas: contador não avançava, replay e writer legado aceitos | Suíte do serviço e migration |
| Migration1073 |2 falhas: migration ausente no registro | Registro/SQL aditivo e down recusado |
| Parcial sem avaliação/meta | Documento não era persistido | Roundtrip cifrado/estado pendente |
| Revisão/publicação com CAS |3 falhas: baseline obsoleta aceita e contador inalterado | Transições protegidas, publicação e clone |
| Rota de edição | Handler ausente no controlador | Permissão/no-store e encaminhamento |
| Observação removida | PostgreSQL retornou “Observação inicial sintética” após remoção | NULL real + revisão/publicação sem texto anterior |
| Prévia/cópia antiga |2 falhas: rascunho pendente/ilegível devolvia refeições antigas | Supressão da estrutura antiga e409 na prévia |
| Corrupção editorial após publicar | Totais/refeições publicados ficaram indisponíveis | Publicada independe da cópia editorial |
| Limite de transporte | Documento acima96KiB era aceito pelo domínio | Cap compatível com parser100KiB |
| BFF transições | Precondição enviada virou `{}` | Corpo preservado e409 sem retry |
| Coordenador |12 casos falharam contra esqueleto sem comportamento | Ciclo, ACK A/edição B, serialização, erros/cleanup |
| Reverter edição durante request | Manual não enviava último documento após ACK | Último pedido considera request em voo |
| Leitura durante save |3 casos PG não aguardaram lock | Locks compartilhados de escopo; conferir tabela de execução |

Logs brutos locais `/tmp/pa06-*.log` são transitórios. Testes e comandos abaixo são
as evidências reproduzíveis versionadas; não dependem de conteúdo real.

## Execução e limites

Node22.21.1/pnpm11.25.0, versões declaradas pelo projeto. Scripts executados pela
raiz da worktree; quando houver wrapper corepack, manter o Node22 no PATH.

| Comando | Estado observado |
| --- | --- |
| `pnpm --dir octaclin-backend test --runInBand src/modulos/planos-alimentares src/infraestrutura/banco-dados/edicao-planos.migracao.spec.ts` | PASS238 testes/17 suítes no núcleo final |
| `node octaclin-backend/scripts/test-pa05-postgres-local.cjs` | PASS12 casos PA04–PA06 no núcleo final;31 fora do filtro SKIPPED |
| `node octaclin-web/scripts/test-planos-alimentares-bff.mjs` | PASS29/29 |
| `node octaclin-web/scripts/test-nutricao-plano.mjs` | PASS33/33, incluindo14 casos do coordenador e19 de nutrição |
| `pnpm --dir octaclin-backend typecheck` | PASS |
| `pnpm --dir octaclin-backend build` | PASS, artefato dist/main.js validado após o ajuste final de leitura |
| `pnpm --dir octaclin-web typecheck` | PASS |
| ESLint nos arquivos Web de runtime alterados | PASS |
| `pnpm --dir octaclin-web test:authz` | Em andamento; não convertido em PASS |
| `node scripts/validar-migracoes-fora-de-banda.mjs` | PASS |
| `node --test scripts/validar-guardas-controladores.spec.mjs` | PASS11/11 |
| `node scripts/scan-secrets.mjs` | PASS nos padrões locais; não é prova de ausência absoluta de segredo |
| PostgreSQL integral Timescale/pgvector | SKIPPED local: espaço Docker insuficiente; gate integral obrigatório no CI |
| UI/Playwright/a11y e build Web completo | SKIPPED nesta etapa: T07/T08 ainda não implementados; gates da entrega final |
| Suite backend integral, revisão final integrada e CI do HEAD | PENDENTES para T09/T10 após UI |
| Migrations/deploy/ativação externos | SKIPPED: não autorizados nesta execução |

PostgreSQL15 descartável, imagem fixada no harness, dados sintéticos e role runtime
não owner, sem superuser/BYPASSRLS. A fixture aplica migrations reais com owner,
usa FORCE RLS real nas tabelas de planos e remove o container ao terminar. Omite
somente Timescale/pgvector/hypertable/coluna vetorial alheios ao domínio;31 testes
fora do filtro PA04–PA06 foram SKIPPED, não aprovados implicitamente. Conflitos
save/save, save/revisão, save/publicação e leitura/save usam barreiras com evidência
de espera de lock em pg_stat_activity. Inclui cifra/NULL, tenant, carteira, paciente,
transferência, permissão revogada, corrupção, arquivamento e constraints.

## Revisão cruzada

Agente revisor `/root/pa05_r4_review`, leitura apenas, sem autoria das mudanças
PA06 e sem execução de testes. Primeira rodada encontrou prévia antiga e NULL;
ambos reproduzidos e corrigidos. Segunda rodada confirmou essas correções e
identificou a dependência editorial indevida da publicada, também reproduzida e
corrigida. Reinspeção final do núcleo concluída sem novo achado concreto nos deltas;
conferidos locks de leitura, independência da publicada e limite HTTP. Isso não substitui a revisão
integrada depois da UI nem representa revisão externa humana/validação clínica.

## Implantação futura1073 e rollback

Não executar estes passos sem autorização operacional e identificação inequívoca
de projeto/branch/banco/role. Conferir1072 existente e1073 pendente no alvo real;
CI/merge não demonstram aplicação. Ensaiar backup eDDL conforme RUNBOOK_PRODUCAO.
Aplicar1073 fora de banda com owner autorizado antes do runtime que a exige;
conferir registro da migration, quatro colunas/constraints, FORCE RLS e grants
mínimos da role runtime. Validar staging antes de produção e registrar evidência
por ambiente. Não promover runtime a owner ou liberar DDL no boot.

Rollback conserva colunas/cifra e proteção CAS. `down` recusa apagar histórico.
Depois da primeira adesão não voltar ao backend que ignore edicao_protegida/CAS;
reverter UI desabilitando novos envios, manter backend compatível ou usar correção
aditiva. Abort de request não garante rollback no servidor: cliente deve tratar
resultado incerto e recarregar sob autorização antes de nova tentativa.
