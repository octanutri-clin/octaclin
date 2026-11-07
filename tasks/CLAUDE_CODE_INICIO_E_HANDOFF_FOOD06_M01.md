# Claude Code — entrada no OctaClin e retomada da FOOD06 M01

Checkpoint de transferência de 07/11/2026. Este documento é um briefing de tarefa
e um índice de leitura, não uma substituição de `AGENTS.md`, das regras de segurança
do cliente ou das decisões do proprietário. Leia-o integralmente antes de agir.
Reconfirme os fatos operacionais: caminhos, branches, espaço e checks podem mudar.

## 1. Missão e resultado esperado

Você está assumindo o projeto sem contexto de conversa. Atue como engenheiro sênior
TypeScript/NestJS/Next.js/PostgreSQL, com atenção à qualidade de dados nutricionais,
autorização, LGPD e isolamento entre clínicas. A tarefa autorizada é reconstruir o
incremento **FOOD06 M01 — rastreabilidade factual de fontes por micronutriente**.

Complete a origem factual dos valores contabilizados na API, tabela, detalhes e
relatório profissional, reaproveitando snapshots congelados e projeções existentes.
Preserve resultados matemáticos e incertezas. Documente e teste; faça commits locais
pequenos e revisáveis. Encerre com handoff. Não avance automaticamente para outra
melhoria ou fase.

O proprietário autorizou a implementação deste incremento específico e seus testes
em ambiente isolado. Não exige nova pergunta para cada passo técnico já coberto.
Uma nova decisão clínica, exposição de dados, contrato incompatível ou expansão de
escopo exige aprovação própria. Identifique o impedimento e continue partes seguras
e independentes quando possível.

## 2. O que ocorreu e o que NÃO pode ser presumido

- O trabalho anterior estava em `/tmp/food06-review`. O proprietário decidiu tratar
  o acesso a esse TEMP como perdido. Código/diff, testes novos, relatórios e logs
  daquela execução não estão disponíveis neste checkout.
- O commit documental local `cfaa42f5508d3b9540000f6967e0eab41068720b` não foi
  localizado no banco de objetos do clone acessível. Não consta como recuperado.
- O incremento anterior não recebeu commit final nem push. Resumos de conversa
  relatam testes e pareceres, mas não reconstituem arquivos nem aprovam código novo.
- Não repita como evidência própria as contagens de testes ou conclusões dos
  revisores daquele TEMP. Produza evidência correspondente ao seu código.
- Os seis documentos da auditoria consolidada também não estão na base remota
  deste checkpoint. A lista deles está na seção 5. A ausência não autoriza inventar
  seu conteúdo, marcar a auditoria como refeita ou refazer toda a FOOD06.
- A PR #455 continua sendo a entrega FOOD06. Não abra outra PR para o mesmo
  incremento, não integre automaticamente branches e não recomece o produto inteiro.

## 3. Git e ambiente: confirmação antes de escrever

Repositório: `octanutri-clin/octaclin`.

| Item | Observado na preparação deste documento |
| --- | --- |
| Clone principal | `/workspace/octaclin` |
| Worktree de retomada | `/workspace/octaclin/.worktrees/food06-m01-rastreabilidade-recuperacao` |
| Branch da retomada | `feat/food06-m01-rastreabilidade-recuperacao` |
| Base de código | `137aa547cfc13fd380a554af81542bec0663a556` |
| Ref local buscada exclusivamente para essa base | `origin/pr-455-current` |
| PR #455 consultada | aberta, Draft, sem merge, head remoto `137aa547` |
| Branch remota da PR | `docs/food06-contratos-fontes` |
| Main remota na consulta | `3b35e104f5ceeebda10b7bf98355ebfb7272b496` |
| Clone principal local | `main` antiga em `774cf34f`, com `octaclin-web/next-env.d.ts` já modificado |
| Outra worktree FOOD06 | `.worktrees/food06-contratos-fontes`, em `004eab71`, divergente da PR |

A worktree desta retomada foi criada sobre o HEAD exato da PR. O commit local que
adiciona este guia será descendente dessa base. Não confunda a branch de retomada
com uma nova entrega de produto: ela isola o trabalho local para transferência.
Qualquer sincronização futura deve usar a PR existente, mediante autorização.

Não altere a main, o `next-env.d.ts` preexistente, a worktree divergente, branches
de outros agentes, seus commits ou arquivos não commitados. Não use reset, clean,
rebase destrutivo, checkout forçado, force-push ou prune para recuperar o ambiente.

Execute, ajustando os caminhos somente depois de localizar o clone real:

```bash
cd /workspace/octaclin/.worktrees/food06-m01-rastreabilidade-recuperacao
pwd
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short --branch
git diff --stat
git diff --cached --stat
git worktree list --porcelain
df -h . /tmp
node --version
pnpm --version
```

Confira a PR por ferramenta GitHub ou `gh pr view 455` se autenticado. Não imprima
configurações de autenticação. Para comparar refs sem atualizar branches:

```bash
git ls-remote origin refs/heads/docs/food06-contratos-fontes refs/pull/455/head
git log -5 --oneline
```

Se o HEAD remoto mudou, leia o delta antes de agir; não sobrescreva a nova versão
com a base deste documento. Se há alterações suas ou de outro escritor, inventarie
e preserve. Dois agentes não devem escrever simultaneamente na mesma worktree.

### Espaço em disco e persistência

O filesystem principal tinha 32 GiB ocupados e zero disponíveis. Com autorização
do proprietário, foram removidos somente sete caches `.next` ignorados pelo Git,
sem arquivos rastreados e sem processos Next/build ativos. Eram de PA06 cálculo,
PA06 ativação, PA06 planejamento, FOOD02 smoke, FOOD03 planning, PA07 e FOOD01.
Foram aproximadamente 2,5 GiB de artefatos regeneráveis. Após a limpeza, havia
922 MiB disponíveis antes do novo checkout: ainda é pouca folga para builds/PG.

A tentativa com `rm -rf` foi rejeitada pela ferramenta como remoção forçada. A
remoção sem força, de caminhos exatos previamente verificados, foi aceita. Não
houve alteração de código, docs históricas, `node_modules`, imagens/volumes Docker,
test-results, screenshots ou worktrees inteiras. Não reaplique a limpeza cegamente.

`/tmp` é um tmpfs separado de cerca de 4,9 GiB. Use-o apenas para arquivos
descartáveis. Mantenha código, novos documentos, patches necessários e checkpoints
no workspace; faça commits locais intencionais. Um commit local também não é um
backup externo se o executor inteiro for descartado: informe esse risco ao dono.

Se não há espaço suficiente, registre BLOCKED. Não altere infraestrutura, não
limpe Docker/volumes, não elimine evidências nem instale dependências em massa
para tentar resolver. Peça uma solução específica se a limpeza aprovada não bastar.

## 4. Leitura obrigatória do projeto, em ordem

Leia com buscas direcionadas, sem despejar arquivos inteiros na conversa.

1. `AGENTS.md` na raiz real da worktree.
2. `docs/agents/REGRAS.md`, `DATA_CLASSIFICATION.md`, `EXTERNAL_CODE_POLICY.md` e
   `ENVIRONMENT_PLAYBOOK.md` no mesmo diretório. Consulte `LESSONS_LEARNED.md` pelos
   assuntos aplicáveis: evidências, Git, armazenamento, RLS e falsos verdes.
3. Os trechos pertinentes de `STATUS_ATUAL_PROJETO.md`,
   `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, `DECISOES_ARQUITETURA.md`,
   `MATRIZ_CONFIABILIDADE_TESTES.md` e `SECURITY.md`. São índices/contexto; confronte
   declarações operacionais antigas com Git/PR e com as decisões deste handoff.
4. `octaclin-backend/AGENTS.md` e `octaclin-web/AGENTS.md` antes de alterar cada
   pacote. Na Web, consulte a documentação da versão instalada de Next indicada
   no AGENTS antes de alterar APIs do framework. Não remova blocos gerenciados.
5. `docs/agents/ux/PROCEDIMENTO.md`, `docs/agents/ux/templates/RELATORIO.md` e os
   papéis `.codex/agents/octaclin-nutricionista-ux.toml` e
   `.codex/agents/octaclin-paciente-ux.toml`.

Leia `VARIAVEIS_AMBIENTE.md` e runbooks apenas se precisar compreender a
configuração aplicável. Isso não autoriza abrir `.env` reais ou usar produção.
Não modifique AGENTS, configuração global do Claude, permissões ou ferramentas
para “se autoprogramar”: incorpore estas instruções ao fluxo normal da sessão.

## 5. Leitura FOOD06: mínimo necessário e aprofundamento

Primeiro, leia os checkpoints vigentes e as linhas relevantes de:

- `tasks/plan-pos-320-food06.md`
- `tasks/progresso-food06.md`
- `tasks/aceite-pos-320-food06.md`
- `tasks/especificacao-pos-320-food06-melhorias.md` — M01 e relações M02/M03/M05/M08.
- `tasks/onda-a-pos-320-food06.md`
- `tasks/todo-pos-320-food06.md` e `tasks/execucao-pos-320-food06.md`, somente o
  necessário para ligar requisito, implementação e evidência.

Depois, aprofunde os contratos diretamente envolvidos:

| Documento | O que procurar |
| --- | --- |
| `tasks/food06-contribuicoes-dominio.md` | Quantidades, porções congeladas, hierarquia e ausência de dupla contagem |
| `tasks/food06-interface-factual.md` | Estados, tabela e tratamento de ausências |
| `tasks/food06-fonte-versao.md` | Origem/revisão exata e leitura autorizada das versões salvas |
| `tasks/food06-construtor-registro-factual.md` | Envelope, integridade, campos congelados e compatibilidade |
| `tasks/food06-persistencia-factual.md` e `food06-leitura-factual.md` | Cifra, RLS, autorização antes da leitura e projeções |
| `tasks/food06-api-registros-factuais.md` | Contratos API/BFF e allowlists |
| `tasks/food06-m08-relatorio.md` | Resumo global de fontes já existente, impressão e limites |
| `tasks/food06-contexto-historico-relatorio.md` | Negociação formato1/2 e leitores antigos |
| `tasks/food06-m02-origem-ordenacao.md` | Identificação de origem autorizada, preparo e paginação |
| `tasks/food06-m11-previa-editor.md` | Incremento M11 que precisa permanecer intacto |

Os seis documentos perdidos da auditoria tinham estes nomes: não os trate como
presentes se `rg --files` não os encontrar:

- `tasks/food06-auditoria-consolidada.md`
- `tasks/food06-matriz-maturidade.md`
- `tasks/food06-pendencias-por-criterio.md`
- `tasks/food06-bloqueios-compartilhados.md`
- `tasks/food06-roadmap-conclusao.md`
- `tasks/food06-handoff-proxima-execucao.md`

Neste caso use a especificação, matriz canônica e diagnóstico atual para este
incremento. Registre a ausência no novo handoff. Não fabrique uma auditoria anterior.

### O que não ler por padrão

Não leia todo o histórico de fases, todos os relatórios UX, todos os repositórios
de referência ou o corpo histórico inteiro da PR. Use índices e símbolos. Não
abra fontes externas/TBCA, bases privadas, prompts com dados de pacientes, dumps,
`.env`, tokens, cookies ou configuração global de contas. Não leia outros módulos
para refatorar por conveniência. Acesso técnico a um arquivo não implica necessidade
ou autorização para expor seu conteúdo.

Consulte os documentos clínicos `docs/product/FICHA_VALIDACAO_CLINICA_FOOD06.md`,
`VALORES_CANDIDATOS_DRI_FOOD06.md` e `PARECER_FONTES_DRI_FOOD06.md` nos trechos
que delimitam interpretação. Não precisa rever todas as tabelas para projetar
origens factuais, nem pesquisar novas referências.

## 6. Produto e decisões que já estão tomadas

OctaClin é um SaaS brasileiro para nutricionistas, organizado por clínicas
(tenants), profissionais e pacientes, com console profissional e portal. Há planos,
refeições, receitas, biblioteca e substituições. As versões publicadas e snapshots
históricos são contratos que não podem ser reescritos por atualização de catálogo.

FOOD06 analisa **alimentação planejada**, não ingestão efetiva, deficiência,
toxicidade ou diagnóstico. As 12 melhorias M01–M12 foram aprovadas como escopo,
mas este turno autoriza só o incremento M01 descrito aqui. M09 tinha conclusão
técnica delimitada; M01/M02 são candidatas a fechamento, não fechadas. M11 está
parcial; uma seleção integrada à prévia M04 não conclui M11/M12.

O progresso administrativo documentado na base é 50%, pelo método fixo de pesos
iguais: PENDENTE=0, PARCIAL=0,5, CONCLUÍDA E VALIDADA=1. Não traduza isso em prazo,
esforço ou prontidão clínica, não invente “95% pronto” e não aumente por inferência.

Preserve CL01–CL08. A população ratificada é adultos19+, sem gestação/lactação,
com contexto confirmado pelo profissional. Comparação combinada diária exige
confirmação do mesmo dia; vitamina C exige tabagismo confirmado. DRI e seus direitos
possuem gates próprios. Nada neste incremento libera RDA, AI, UL numéricos ou
percentuais de adequação. Não use referências EFSA para completar DRI.

Fonte de composição (TACO, USDA, IBGE, manual/custom etc.) é diferente de referência
científica de ingestão (RDA/AI/UL/DRI). Não reúna ambas em um campo ambíguo chamado
“fonte” nem anuncie validação científica porque o registro tem origem identificada.

FOOD05-MDL/D18/T07-B/A06 permanecem fora deste incremento. Preserve o bloqueio D17
para equivalências por modelos. FOOD04/05/07 e PA06/PA07 devem manter contratos.
G06 operacional é um assunto separado: não presumir regularização produtiva com
base em data, quota anterior, migration no repositório ou evidência de staging.

## 7. Contratos de segurança e autorização operacional

- Sem push, nova PR, merge, deploy, migrations externas, alterações de Render,
  Neon, quota, cobrança, infraestrutura ou ativação em produção.
- A permissão de “colocar este guia no Git” é para seu commit documental local;
  não é autorização de publicação remota ou de execução produtiva.
- Use só cenários sintéticos e bancos locais descartáveis quando aplicável.
- Não leia pacientes reais, dados identificáveis ou credenciais. Não envie dados
  clínicos a fornecedores ou ferramentas externas.
- Tenant vem da identidade/capability verificada no servidor. Preserve papel,
  permissões, vínculo paciente/profissional, carteira, RLS e reautorização.
- Autorização deve preceder leitura/decifragem. A API devolve projeção mínima por
  allowlist; nunca entidade ORM, snapshot bruto ou ciphertext/contexto interno.
- Não copie PHI para logs, erros, URLs, localStorage, Cache Storage, screenshots,
  fixtures, prompts de revisão ou commits.
- Preserve CAS, revisões exatas, locks, idempotência, transações e rollback.
- Relatório continua autorizado especificamente e reautorizado antes de imprimir,
  sem PDF público/persistido nem envio automático ao paciente.
- Sem dependências, lockfiles, workflows ou refactors amplos para esta tarefa.

## 8. Diagnóstico técnico antes de implementar

Na base, o backend está em `octaclin-backend/src/modulos/planos-alimentares/`.
Use `rg --files`/`rg -n` e leia símbolos próximos, não todo o serviço enorme.

| Área | Pontos de entrada confirmados na base |
| --- | --- |
| Matemática/cobertura | `dominio/micronutrientes.ts`, `cobertura-dietetica.ts`, `contribuicoes-dieteticas.ts` e specs adjacentes |
| Fonte/composição | `dados/micronutrientes-fonte.ts`, `aplicacao/projecao-composicao.ts`, `projecao-origem-contribuicao.ts` |
| Contrato factual | `aplicacao/contrato-analise-micronutrientes.ts` e `servico-planos-alimentares.ts` |
| Registro/histórico | `aplicacao/construtor-analise-factual.ts`, `projecao-registro-factual.ts` e leitores/serviços localizados por busca |
| Resumo M08 existente | `aplicacao/fontes-relatorio-factual.ts` e seu spec |
| PostgreSQL registro | `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001081-RegistrosAnalisesFactuais.integracao.spec.ts` |
| Web leitores | `octaclin-web/lib/micronutrientes-factuais.ts`, `contribuicoes-micronutrientes.ts`, `relatorio-factual.ts` |
| Web componentes | Mesmos nomes em `octaclin-web/components/pacientes/`, extensão `.tsx` |
| Web specs | `octaclin-web/scripts/*micronutrientes*spec.ts`, `relatorio-factual.spec.ts` e runners `test-calculo-combinado-planos.mjs`, `test-planos-alimentares-bff.mjs` |
| Navegador/PDF | `octaclin-web/tests/visual/food06-tabela-factual.spec.mjs`, fixtures e `playwright.config.mjs` |

O resumo global M08 já agrupa a origem congelada por tipo/versão, conta itens e
sem referência, limita a50grupos. Não é uma prova por célula nutricional. Comece
comparando esse resumo com o que cada nutriente realmente contabiliza.

Antes do primeiro patch responda em `tasks/food06-m01-rastreabilidade-fontes.md`:

1. Onde estão congelados composição, quantidade e metadados de origem?
2. A origem é de alimento/composição ou comprovadamente de cada célula?
3. O que snapshots antigos preservam e o que não preservam?
4. Que serviço autorizado já leu esses dados? Há necessidade real de outra query?
5. O que já sai na API e o que a UI/relatório omitem?
6. Qual a menor mudança compatível em domínio/API/BFF/tabela/detalhes/relatório?

Use uma tabela de diagnóstico com superfície, comportamento existente, lacuna
demonstrada, mudança mínima e teste. Se já está implementado, registre a prova,
sem fabricar um RED. Não recrie o motor PA06 ou a persistência factual.

## 9. Regras exatas de proveniência e cobertura

- Somente metadados congelados e associados à contribuição utilizada podem
  fundamentar a apresentação. Nome do alimento não prova fonte.
- Origem geral registrada não prova que cada micronutriente foi medido naquela
  base: explicite a limitação. Se não há vínculo por célula, não o invente.
- Não complete versões, códigos, licença, edição ou autoridade com o catálogo
  atual. Versão desconhecida permanece desconhecida.
- Separe tipos/códigos comprovados quando necessário, inclusive subfontes USDA
  distintas. Não una fontes diferentes só porque a versão coincide.
- Não exponha texto livre de origem, IDs clínicos, hashes internos ou blobs.
  Projete somente identificadores/metadados mínimos permitidos e limitados.
- Fonte manual/custom tem os metadados realmente disponíveis, sem versão fictícia.
- Fontes de valores ausentes/incompatíveis não devem parecer contribuidoras do
  subtotal conhecido. Zero conhecido participa corretamente.
- Cobertura é por nutriente: COMPLETO/PARCIAL/DESCONHECIDO/INCOMPATÍVEL/INDISPONÍVEL,
  com contagens, causas e motivos preservados. Origem documentada não transforma
  cobertura parcial em completa ou percentagem de alimentos em confiança científica.
- Contribuições repetidas legitimamente em duas refeições contam duas vezes.
  Deduplicar metadados não pode deduplicar ingestão planejada.
- Não some principal e alternativa excludente, nem alternativas não selecionadas.
  Receita já porcionada não recebe fator de rendimento pela segunda vez.
- Não altere quantidades/totais, não converta ausência em zero e não some unidades
  ou formas incompatíveis. Subtotal conhecido é contabilizado; total permanece
  desconhecido quando a cobertura não é completa.

Prefira campos opcionais aditivos nas projeções e leitores compatíveis com registros
sem o novo campo. Reconstrua allowlists de estruturas aninhadas e também do objeto
raiz: spread de objeto interno pode carregar extras inesperados. Valide números
finitos, contagens inteiras, limites, códigos e reconciliação dos agrupamentos.
Mantenha ordenação determinística e truncamento explícito com contagens coerentes.

## 10. API, interface e relatório

Use uma fonte factual autoritativa no backend. BFF/React não devem deduzir fontes
nem recalcular nutrição independentemente. Todas as superfícies devem concordar
em nutriente, valor, cobertura, contagens, causas e origem disponível, respeitando
seus contratos de exposição. Isso não exige expor o mesmo payload completo.

A tabela traz resumo claro; detalhes acrescentam metadados permitidos. Explique
fonte desconhecida e versão desconhecida separadamente. Não use “fonte comprovada
do nutriente” quando só há origem do registro de composição.

Reutilize o relatório M08 e sua negociação explícita de formatos1/2. Não troque o
default, reconstrua PDF, crie URL pública ou armazene arquivos clínicos. Compare
prévia e impressão do mesmo registro autorizado; dados antigos continuam legíveis.
Se o formato antigo não comportar uma mudança aditiva, pare a parte incompatível
e apresente a menor alternativa antes de modificar contratos.

UI deve ter rótulos pt-BR, singular/plural corretos, estado textual, foco e teclado,
layout mobile e aumento de texto. Evite criar landmarks/níveis de heading repetidos
em cada célula ou item. Não enfraqueça axe para esconder defeito introduzido.
PDF Chromium/tagged e axe na prévia não provam PDF/UA ou leitor de tela humano.

## 11. TDD e matriz de testes

Comece por testes pequenos para lacunas demonstradas. RED precisa ser falha
funcional com setup válido; falha de instalação/compilação/container não conta.
Implemente o mínimo, registre GREEN e rode regressões pertinentes. Reutilize
testes existentes somente quando escopo e código forem equivalentes; evite somar
contagens de suítes sobrepostas.

| ID | Cenário obrigatório / evidência necessária |
| --- | --- |
| FT01 | Nutriente completo/uma fonte: total e origem registrada coerentes |
| FT02 | Completo/múltiplas fontes: contribuições e origens preservadas |
| FT03 | Parcial: subtotal conhecido e total desconhecido |
| FT04 | Zero conhecido continua conhecido e corretamente contado |
| FT05 | Ausência não vira zero nem fonte presumida |
| FT06 | Origem geral não vira vínculo comprovado por nutriente |
| FT07 | Atualização do catálogo não muda composição/metadados históricos |
| FT08 | Receita fracionária, sem reaplicar fator de porcionamento |
| FT09 | Alternativa não escolhida não contribui |
| FT10 | Repetição legítima em refeições conta ambas |
| FT11 | Unidade/forma incompatível: sem soma e com motivo |
| FT12 | Legado incompleto aceito com incerteza, contrato anterior preservado |
| FT13 | Mesmos fatos na API, tabela e detalhes |
| FT14 | Relatório autorizado/preview/PDF conserva fatos da análise |
| FT15 | Outro tenant/paciente/profissional: sem divulgação |
| FT16 | Revogação/transferência: leitura e exportação negadas |
| FT17 | Fonte alterada após registro: histórico/ciphertext imutáveis |
| FT18 | Manual/custom: só os metadados reais |
| FT19 | Contagens, limite de grupos, ordenação, truncamento e volume |
| FT20 | DRI bloqueada: nenhum percentual científico liberado |

Inclua canários de campos extras na raiz e aninhados das projeções/leitores. Verifique
que o payload e logs não carregam dados internos. Preserve leitor/construtor/envelope,
hashes e versões persistidas quando o incremento pode ser apenas de apresentação.

Para FT07/FT17, crie a análise a partir do estado congelado, altere a fonte atual
simulada ou em banco descartável, releia e compare fatos/bytes. Informação antes
ausente não pode aparecer retroativamente. Se uma prova é apenas em memória,
declare esse limite; use PostgreSQL/runtimeRLS para as propriedades que exigem DB.

Negativas: outro tenant, paciente, carteira transferida, acesso revogado, sem
permissão, registro de outra origem e request adulterado. Browser com mocks não
prova RLS; testes unitários de serviço não substituem integração de autorização.

Execute desktop/mobile, teclado, foco, responsividade, ampliação e axe para a
superfície alterada. Se mudar conteúdo/geração do relatório, gere PDF real sintético,
extraia texto e confira números/fontes/revisões. Não declare testes opcionais skipped
como aprovação. Se um reteste passa após falha, registre ambas e a causa quando
comprovada, sem inventar explicação de timeout.

## 12. Ferramentas e execução seletiva

Os manifests desta base exigem Node `>=22 <23` e declaram pnpm11.25.0 com hash.
Confirme `packageManager` em vez de instalar “latest”. Node22.21.1 já foi localizado
em `/workspace/.toolchains/food01/node-v22.21.1-linux-x64/bin/node`; verifique se
ainda existe e ajuste PATH apenas para a sessão. Não use Node24 nem altere engines.

Antes de reutilizar `node_modules` de outra worktree compare lockfiles, dependências,
devDependencies, engines e packageManager. Não altere instalações compartilhadas.
Symlinks podem afetar Next/Playwright: não mude a segurança/configuração do projeto
para contorná-los. Sem espaço para instalação congelada, registre o bloqueio.

Exemplos existentes, a adaptar aos arquivos efetivamente alterados:

```bash
# Na raiz; não precisa baixar pacotes para o scanner implementado em Node.
node scripts/scan-secrets.mjs
git diff --check

# Dentro de octaclin-backend, com dependências corretas.
pnpm exec jest --runInBand --runTestsByPath src/modulos/planos-alimentares/aplicacao/fontes-relatorio-factual.spec.ts
pnpm typecheck
pnpm build

# Dentro de octaclin-web.
pnpm test:calculo-combinado-planos
pnpm test:planos-alimentares:bff
pnpm typecheck
pnpm test:linguagem
pnpm exec playwright test tests/visual/food06-tabela-factual.spec.mjs --project=desktop-chromium --project=mobile-chromium --reporter=list
pnpm build
```

Leia os runners antes: alguns agregam muitas suítes. Acrescente o teste novo ao
caminho existente quando necessário, sem mudar workflows só por conveniência.
Lint dos arquivos afetados e regressões adequadas continuam gates. `test:authz`
é exigido se mudar BFF/autorização; não o execute por hábito se não tocar essa área,
mas não o dispense se a alteração realmente a atingir.

PostgreSQL: leia `octaclin-backend/scripts/test-rls-testcontainers.mjs` e o spec1081
antes da execução. Há opt-in `FOOD06_REGISTRO_TESTCONTAINERS=true`. O alvo deve ser
descartável, com role runtime sem owner/BYPASSRLS e FORCE RLS. Não aponte para Neon,
staging ou produção; não use credenciais existentes para superar Docker indisponível.
Sem Docker/espaço, marque a prova BLOCKED, não46falhas funcionais se o setup comum
falhar. Não rode migrations do projeto indiscriminadamente.

Playwright: confira configuração/servidor/portas; não rode build no mesmo diretório
de saída enquanto o dev server o utiliza. Encerre só os PIDs que você iniciou.
PDF real tem opt-in `FOOD06_PDF_REAL=true`; confira dependências de extração no spec.
Manifests, dados de teste e artefatos necessários devem permitir associar prova ao
commit/diff exato. Sem CI do novo código, estado é CI NOT RUN/PENDING.

## 13. UX e revisão independente

Siga o procedimento A/B/C/D versionado. Os papéis não são pessoas reais nem
processos permanentes. No Claude, leia as instruções TOML como texto se não existir
seleção nativa comprovada. Use subagentes restritos somente se suportados, com
brief sintético. Se avaliar sequencialmente como agente principal, registre esse
fallback e não diga que houve dois revisores independentes.

Nutricionista: verificar clareza das origens, contagens, subtotal parcial e acesso
aos detalhes no atendimento. Paciente pode ser N/A justificado porque o incremento
é consulta/relatório profissional, sem nova exposição/entrega ao portal; reavalie
se o fluxo real tiver impacto além disso. Não crie exposição para justificar a persona.

Faça A antes da implementação visual, B na primeira interface, C no fechamento
delimitado e deixe decisões para D. Leitura de código não é interação, captura
fornecida não é navegação própria. Preserve sugestões discordantes; só detalhe
reversível já aprovado pode ser incorporado diretamente. Nova decisão de produto
precisa de aprovação.

Mudanças em fronteiras clínicas/autorizadas exigem revisão R4 proporcional ao
risco. Solicite revisão cruzada independente do incremento após estabilização.
Registre revisor, commit/diff, escopo, achados, limitações e se executou testes.
Auto-revisão não é R4 independente; estática não equivale a prova de execução.
Se não houver revisor disponível, registre o gate pendente e continue itens seguros.

## 14. Gates de interrupção e proteção de escopo

Pare a parte afetada se a solução exigir migration, regravar clínicos/snapshots,
fonte sem direito aprovado, proveniência presumida, novo uso de dado sensível,
contrato incompatível, ampliação de acesso, alteração de motor sem defeito,
dependência arquitetural nova ou modificação de trabalho paralelo. Apresente
evidência, impacto e menor alternativa. Não contorne bloqueio silenciosamente.

Não implementar M11 individualizada/restrições, M12 cenários, FOOD05-MDL, FOOD08,
novas tabelas/modelos, bases nutricionais ou recomendações clínicas. Não reabrir
achados já aceitos sem regressão/vulnerabilidade nova comprovada.

## 15. Persistência do trabalho e handoff ao Codex

Só um escritor nesta worktree. Não inicie codificação se Codex ou outro agente
também estiver trabalhando nela. Ao receber este documento do dono, assuma a tarefa
e registre checkpoint inicial; ao devolver, pare as escritas e identifique a próxima
ação. Não mande mensagens a terceiros nem acione serviços externos sem autorização.

Mantenha `tasks/food06-m01-rastreabilidade-fontes.md` com:

- branch/base/HEAD e inventário preservado, contexto da perda do TEMP;
- diagnóstico por superfície e contratos reutilizados;
- regra de fonte comprovada versus origem geral/desconhecida;
- arquivos alterados e exemplos sintéticos;
- RED/GREEN reproduzível, comandos, commit/diff, resultados e limites;
- FT01–FT20 com PASS/PARCIAL/FAIL/BLOCKED/NOT RUN/N/A justificado;
- regressões, histórico/imutabilidade, autorização, volume, UX/R4 e PDF;
- estado individual M01-C1/C2/C3 e o que falta comprovar;
- uma única próxima tarefa recomendada, sem iniciá-la automaticamente.

Se atualizar progresso/aceite, preserve critérios e registros históricos. Não
altere arquivo com outro escritor ativo; registre proposta no handoff. Não
reconstrua os seis relatórios perdidos como se fossem os originais.

Faça commits locais em pontos coerentes, após revisar `git diff`, arquivos staged,
`git diff --check` e scanner de segredos. Use `git add` de paths explícitos; não
inclua symlinks de dependências, logs brutos, `.next`, screenshots sensíveis,
arquivos gerenciados de terceiros, lockfiles ou artefatos temporários por acidente.
Informe SHA e estado local; sem push o commit não está no GitHub e CI remoto não
validou o delta. Antes do limite de contexto, grave um handoff curto no workspace
e commit intencional se possível, não somente um resumo na conversa.

## 16. Aceite e primeira resposta esperada

Reavalie os três critérios oficiais, sem mudar suas definições:

| Critério | O que precisa comprovar |
| --- | --- |
| M01-C1 | Zero conhecido diferente de ausência; cobertura por nutriente em todas as projeções relevantes |
| M01-C2 | Cinco estados, motivos, contagens e origens realmente documentadas; incerteza e incompatibilidade explícitas |
| M01-C3 | Subtotal parcial correto, sem DRI liberada; API/tabela/detalhes/relatório coerentes e compatíveis com legados |

Separe implementação, validação e dependências. Concluir o incremento local não
aprova a M01 inteira, as outras melhorias, o CI ou a produção. M02/M03/M05/M08 só
recebem benefício comprovado, não promoção automática de status.

Sua primeira resposta deve confirmar: diretório/branch/HEAD, alterações existentes,
espaço/runtime/dependências, leitura das regras, menor diagnóstico e próximos
testes RED. Depois execute autonomamente a tarefa autorizada. Não pare apenas
oferecendo ajuda nem peça ao proprietário para repetir decisões presentes aqui.

Ao finalizar informe o que mudou, evidências reais, limites, M01-C1/C2/C3, três
eixos de maturidade, commits locais, CI/PR observados e próxima tarefa única. Se
o ambiente impedir a execução, seja específico sobre o que falhou e preserve o
trabalho. Não declare PASS para uma etapa que apenas começou.
