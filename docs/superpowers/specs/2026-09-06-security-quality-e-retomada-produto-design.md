# Programa de Security & Quality e retomada do produto

**Data:** 2026-09-06

**Status:** desenho aprovado pelo proprietario

**Repositorio:** `octanutri-clin/octaclin`
**Base observada:** `main` em `56afc7c2f3dbe3fc2d60120782b70c2062d66bde`

## Objetivo

Quitar primeiro o debito de seguranca e qualidade que possui correcao ou exige
triagem, comprovar os controles operacionais ja planejados e, depois do gate de
encerramento, retomar o desenvolvimento funcional do SaaS web pela Fase 256.

Debito quitado nao significa painel artificialmente zerado. Significa:

- zero alerta critico ou alto corrigivel;
- zero alerta sem triagem, responsavel e destino;
- zero secret scanning;
- alerta sem solucao disponivel mantido aberto, com justificativa e revisao;
- scanner executado sobre a `main` corrente e reconciliado com o ledger.

## Decisoes aprovadas

1. Adotar um mutirao de seguranca antes de voltar a funcionalidades.
2. Manter alertas sem solucao abertos enquanto nao existir remediacao segura.
3. Preservar as Fases de produto 256 a 262 e usar ondas `SQ-*` para o mutirao.
4. Manter o Mobile fora da oferta e em NO-GO.
5. Executar backup/restore e teste dinamico interno antes da retomada do produto.
6. Deixar o pentest independente para a superficie funcional final, depois da
   Fase 261 e antes do aceite da Fase 262.

## Estado observado

O inventario foi capturado pela API do GitHub em 2026-09-06:

| Fonte | Alertas abertos | Composicao |
| --- | ---: | --- |
| Code Scanning | 238 | 235 Trivy e 3 Semgrep OSS |
| Dependabot | 2 | dois advisories altos de `image-size` no Mobile |
| Secret Scanning | 0 | nenhum alerta aberto |

Os 235 alertas Trivy correspondem a 118 regras/CVEs, e nao a 235 causas
independentes. A distribuicao e:

- 62 alertas com versao corrigida informada pelo scanner: 16 altos, 22 medios e
  24 baixos;
- 173 sem versao corrigida: 3 criticos, 51 altos, 56 medios, 57 baixos e 6 sem
  severidade de seguranca;
- os 173 sem fix estao concentrados na imagem final do `octaclin-ai-service`;
- 40 dos corrigiveis estao nas imagens finais de backend e web, em
  `libssl3`/`libcrypto3` da base Alpine;
- 19 dos corrigiveis estao no npm que acompanha a imagem final do web;
- 3 dos corrigiveis aparecem como distribuicoes Python na imagem final do
  servico de IA e nao constam como dependencias diretas em `requirements.txt`.

Os tres achados Semgrep sao:

- chave HMAC aparentemente fixa em um teste de webhook;
- possivel prototype pollution na leitura de payload de comunicacao;
- possivel path traversal em um teste de opcoes do TypeORM.

O numero do painel e uma metrica observada e mutavel. Os gates usam propriedades
de seguranca e a classificacao factual de cada causa, nao uma meta cosmetica.

## Escopo

### Incluido

- inventario atual e deduplicado dos alertas;
- correcoes de imagens, dependencias e codigo identificadas pelo inventario;
- minimizacao das imagens finais e prova de que o runtime continua funcional;
- classificacao verificavel de falso positivo, mitigacao e risco aceito;
- SBOM e scans sobre os artefatos finais;
- backup/restore, RPO/RTO, resiliencia a ransomware, DAST, fuzzing e pentest
  interno conforme os PRs de governanca 53 e 54;
- retomada das Fases 256 a 262 depois dos gates de seguranca.

### Fora do escopo

- fechar em massa alertas sem evidencia;
- conceder privilegio ao runtime para facilitar rollout;
- executar DAST, fuzzing, restore destrutivo ou pentest em producao;
- distribuir ou habilitar sincronizacao do Mobile;
- migrar para Node 26 antes da data e dos gates ja aprovados;
- antecipar pentest independente sobre uma superficie que ainda sera alterada.

## Arquitetura do mutirao

### SQ-0 — Verdade do backlog

Criar um inventario ativo separado do snapshot historico do PR 37. Cada causa
deve agrupar os numeros de alerta que compartilham ferramenta, regra,
componente, pacote e versao instalada. O registro inclui:

- commit e data da captura;
- ferramenta, categoria SARIF e artefato analisado;
- numeros dos alertas e regra/CVE;
- pacote, versao instalada e versao corrigida quando informadas;
- severidade do scanner e severidade apos analise de contexto;
- pre-condicoes, alcance, mitigacoes e impacto;
- disposicao: corrigir, falso positivo, mitigado ou aguardando upstream;
- responsavel, data de revisao e PR de remediacao quando aplicavel.

O gate de triagem deve reprovar alerta ausente, alerta duplicado em duas causas,
causa sem destino e excecao vencida. O snapshot historico do PR 37 permanece
imutavel como historia; consumidores passam a apontar para o inventario ativo.

### SQ-1 — Alertas corrigiveis

O trabalho fica separado em PRs independentes para evitar que uma regressao de
imagem esconda uma alteracao de dependencia.

#### SQ-1A — Base Node/Alpine

Atualizar o digest da base Node 22 para uma imagem oficial que contenha as
versoes corrigidas de `libssl3` e `libcrypto3`. Backend e web devem usar a mesma
linha de runtime aprovada, sem alterar a major do Node.

Aceite:

- as imagens constroem a partir de digest imutavel;
- os 40 achados corrigiveis da base desaparecem no novo scan;
- UID non-root, root filesystem read-only, capabilities removidas, limites e
  healthchecks continuam aprovados;
- o digest anterior fica registrado como rollback.

#### SQ-1B — Runtime Node minimo

O npm presente na imagem oficial Node aparece na imagem final do web, embora o
runtime nao deva instalar pacotes. A remediacao deve remover essa superficie do
estagio final ou adotar composicao minima equivalente, sem executar gerenciador
de pacotes no runtime.

Aceite:

- `node` e o servidor Next continuam executaveis;
- `npm`, `npx`, `pnpm` e `corepack` nao ficam disponiveis no estagio final;
- nenhum arquivo necessario ao runtime e removido;
- os 19 alertas associados ao npm desaparecem do scan da imagem final;
- build, healthcheck e smoke do web passam sob as restricoes do harness.

#### SQ-1C — Distribuicoes Python da imagem final

Antes de alterar o lock da aplicacao, a implementacao deve provar a procedencia
dos tres achados exibidos como `Python`. Eles nao sao dependencias diretas do
`requirements.txt`. A correcao deve ocorrer na origem real: base, ferramenta de
empacotamento ou dependencia transitiva do runtime.

Aceite:

- nenhuma dependencia inexistente e adicionada apenas para silenciar o scanner;
- a origem de `msgpack` e `setuptools` fica demonstrada no SBOM;
- versoes vulneraveis deixam a imagem final;
- o lock universal por hash e os testes do servico permanecem aprovados.

### SQ-2 — Superficie do servico de IA

Os 173 alertas sem fixed version exigem uma comparacao de runtime, nao 173 PRs.
Devem ser avaliadas, com digest imutavel:

1. a base Python slim corrente com digest atualizado;
2. a variante Alpine oficial compativel com o grafo travado;
3. uma composicao minima/distroless que possua origem, manutencao e suporte
   verificaveis para a versao de Python adotada.

A escolha usa a seguinte ordem de decisao:

1. compatibilidade funcional e suporte;
2. ausencia de criticos/altos corrigiveis;
3. menor quantidade de pacotes e ferramentas no runtime;
4. disponibilidade multiarch e atualizacao previsivel;
5. operacao non-root, read-only e healthcheck sem ampliar privilegios.

Uma alternativa que reduz alertas mas quebra wheels, healthcheck, depuracao
operacional necessaria ou suporte nao sera adotada. Se nenhuma base suportada
for materialmente melhor, a imagem atual permanece e cada causa sem patch fica
aberta com a mesma contencao operacional: IA desativada por padrao, runtime
hardened, responsavel e revisao agendada.

### SQ-3 — Triagem manual

Cada alerta Semgrep deve ser confrontado com fonte, sink e entrada controlavel
no codigo atual. Achado real recebe teste negativo antes da correcao. Falso
positivo ou achado mitigado so pode ser encerrado manualmente depois de a
evidencia ser versionada e ligada ao numero do alerta.

Os dois advisories de `image-size` permanecem abertos enquanto o upstream nao
publicar versao corrigida. A excecao `SC-2026-005`, sua data de revisao e o
Mobile NO-GO continuam sendo o controle; o alerta nao deve ser escondido.

### SQ-4 — Encerramento

Depois dos merges, CodeQL, Semgrep, Trivy, Dependabot e Secret Scanning devem
rodar sobre a `main` corrente. O mutirao termina somente quando:

- criticos e altos corrigiveis forem zero;
- todo alerta remanescente estiver no inventario ativo;
- nenhum responsavel ou data de revisao estiver ausente;
- Secret Scanning continuar em zero;
- CI, SBOM, scans, testes de runtime e scanner de secrets estiverem verdes;
- o Security tab e o inventario ativo concordarem.

Sem reducao na imagem de IA, o piso indicativo e cerca de 175 alertas abertos:
173 da imagem de IA e 2 do Mobile. Esse numero nao e criterio de aceite e pode
mudar quando o scanner ou o upstream mudar.

## Controles antes da retomada funcional

### PR de governanca 53

Provar backup, restore, RPO/RTO e resiliencia a ransomware conforme o programa
vigente. Testes mutaveis usam banco e armazenamento descartaveis. Producao e
somente fonte de evidencia de leitura autorizada; nenhum restore, DDL ou teste
destrutivo sera executado nela por inferencia deste desenho.

### PR de governanca 54

Executar DAST, fuzzing e pentest interno somente em staging isolado, com dados
sinteticos, limites de carga e janela identificada. Achado critico ou alto
exploravel volta ao fluxo de correcao antes da Fase 256.

### PRs 55 e 56

O pentest independente do PR 55 ocorre depois da Fase 261 e antes do GO da
Fase 262. O PR 56/MASVS so e aberto quando houver decisao explicita de preparar
distribuicao Mobile.

## Retomada do produto

### Fase 256 — Formularios e check-ins ponta a ponta

Entregar criacao, biblioteca, versao e distribuicao pelo profissional;
rascunho, retomada e envio pelo paciente; leitura clinica, matriz longitudinal
e registro no prontuario. Carregamento, indisponibilidade, erro, retomada e
acessibilidade devem ser cobertos em desktop e web movel com dados sinteticos.

### Fase 257 — Portal do paciente orientado por tarefas

Priorizar proxima consulta e proxima acao e organizar plano, check-ins,
formularios, tarefas, materiais, mensagens, perfil e privacidade. O paciente
nao recebe classificacao de risco clinico nem detalhes internos.

### Fase 258 — Central de comunicacoes confiavel

Unificar conversas por paciente, canal, responsavel e pendencia; mostrar envio,
entrega, leitura, falha, retentativa e origem. Gmail e WhatsApp preservam
template, idempotencia, consentimento, opt-out e degradacao segura.

### Fase 259 — Acesso, convite e ativacao sem suporte manual

Revisar login, primeiro acesso, recuperacao, convite, troca de senha, expiracao,
aceites legais, bloqueio e permissao. Os quatro papeis devem manter isolamento,
tenant server-side e redirecionamento correto.

### Fase 260 — Desempenho, resiliencia e diagnostico

Definir orcamentos de carregamento e chamadas, remover cascatas, revisar cache e
invalidacao e carregar detalhe clinico somente quando autorizado e solicitado.
Correlacionar UI, BFF e backend sem PHI. Tornar a auditoria de mutacoes clinicas
transacional ou baseada em outbox em PR R4/R5 separado.

### Fase 261 — Regressao de seguranca e privacidade

Revalidar auth, authz, RLS, tenancy, uploads, OAuth, webhooks, rate limit,
auditoria e LGPD depois das novas superficies. Conteudo clinico livre ainda em
claro recebe migration e rollback separados. Nenhum alerta critico/alto
corrigivel pode chegar ao aceite.

### Fase 262 — Aceite e prontidao para piloto

Executar jornadas sinteticas de SuperAdmin, cliente, profissional e paciente em
desktop e web movel. Consolidar P0/P1, observabilidade, backup/restore, suporte,
rollback, juridico e operacao. O piloto so recebe GO com todos os gates
bloqueadores e o reteste independente aprovados.

## Fluxo de erros e bloqueios

- Divergencia entre scanner e inventario reprova SQ-4; nao se encerra o alerta.
- Correcao que quebra runtime volta ao digest/artefato anterior e permanece
  aberta; seguranca nao transforma regressao operacional em sucesso.
- Ausencia de patch gera estado `aguardando-upstream`, nunca `corrigido`.
- Evidencia externa indisponivel bloqueia apenas o item dependente; causas
  independentes continuam.
- Fato novo R4/R5 exige atualizar risco, rollback e revisao antes de prosseguir.

## Estrategia de testes

Todos os PRs executam `git diff --check` e `pnpm security:secrets`. Alem disso:

- inventario: `pnpm test:triagem-seguranca`, teste de cobertura e teste de
  excecoes vencidas;
- Node: `pnpm test:dockerfiles-runtime`, `pnpm test:versao-node`, builds de
  backend/web, harness real das imagens, Trivy e SBOM;
- Python/IA: `pnpm test:lock-python`, instalacao por hashes, testes do FastAPI,
  build, healthcheck, harness real, Trivy e SBOM;
- Semgrep: teste negativo focal quando houver defeito real e nova execucao do
  workflow Semgrep;
- fechamento: workflows da `main`, `pnpm test:confiabilidade` e reconciliacao
  automatizada GitHub-versus-ledger;
- PR 53: gates de backup existentes e restore em alvo descartavel;
- PR 54: plano de teste aprovado, staging isolado e evidencia sanitizada.

`SKIPPED` e reportado com motivo e nunca convertido em aprovacao.

## Modelo de entrega

- Uma causa ou conjunto acoplado por branch e PR.
- Um unico escritor ativo por branch/worktree.
- Nenhum push direto, force-push ou bypass na `main`.
- Todo PR declara risco, rollback, alertas afetados, resultado esperado e
  validacoes PASS/FAIL/NA/SKIPPED.
- Mudancas de base Node, runtime npm, imagem Python e classificacao Semgrep nao
  compartilham o mesmo PR.
- Numeros mutaveis ficam em snapshot/relatorio; regras duraveis ficam nas
  politicas; estado e proximo passo ficam em `STATUS_ATUAL_PROJETO.md`.

Depois do mutirao e dos PRs 53/54, a capacidade volta a produto com manutencao
continua de seguranca: 80% para produto e 20% para higiene, atualizacoes e
triagem. Novo critico ou alto corrigivel interrompe a fase ativa; alerta sem
patch e com controle vigente nao paralisa desenvolvimento.

## Decomposicao dos planos de implementacao

Este documento governa um programa, nao um unico diff. Para manter revisao e
rollback independentes, cada unidade abaixo recebe seu proprio plano antes da
execucao:

- um plano para SQ-0;
- um plano por PR de SQ-1A, SQ-1B e SQ-1C;
- um plano para o experimento e a decisao de SQ-2;
- um plano para SQ-3 e outro para o gate SQ-4;
- os planos especializados ja previstos para os PRs 53 e 54;
- um desenho e plano proprio para cada Fase de produto 256 a 262.

O primeiro plano executavel sera o de SQ-0. As ondas seguintes partem do
inventario que ele produzir; nao devem antecipar nomes de arquivos, contagens ou
correcoes que a evidencia de SQ-0 contradiga.

## Sequencia final

1. SQ-0 — inventario e gate de verdade.
2. SQ-1A — base Node/Alpine.
3. SQ-1B — runtime Node minimo.
4. SQ-1C — distribuicoes Python da imagem final.
5. SQ-2 — decisao e minimizacao da imagem de IA.
6. SQ-3 — Semgrep e residuos sem patch.
7. SQ-4 — re-scan e gate de encerramento.
8. PR 53 — backup, restore, RPO/RTO e ransomware.
9. PR 54 — DAST, fuzzing e pentest interno em staging.
10. Fases 256 a 261 — retomada funcional e estabilizacao.
11. PR 55 — pentest independente e reteste.
12. Fase 262 — aceite final e GO/NO-GO do piloto.
13. PR 56 — somente antes de eventual distribuicao Mobile.
