# Fase 308 — Exames fora da faixa no resumo clínico

## Estado e entrada para implementação

Planejamento preparado em 2026-10-09, a pedido do proprietário. Este registro
preserva a base observada no planejamento; a execução da fase está registrada
na seção “Resultado da implementação” abaixo. Base observada:
`04e66efc1dcd5d193db82c1da9feafc271f28170`, merge do PR #384/Fase 307.
Branch: `feature/fase-308-resumo-exames`. Worktree local:
`/workspace/octaclin/.worktrees/feature-fase-308-resumo-exames`.
Esta branch deve receber a implementação e uma única PR com plano e código.
Checklist executável: `tasks/todo.md`; entrada de handoff: `tasks/plan.md`.

O proprietário pediu otimização de tokens e troca manual de modelo. O
planejamento encerra antes do código. Modelo recomendado para implementar:
**GPT-6 Luna, esforço Alto**, com uma tarefa por vez e os checkpoints abaixo.
Não repetir a auditoria completa. Reconfirmar Git, instruções e contratos
indicados; escalar fato novo de segurança ou incompatibilidade ao usuário.

## Resultado da implementação (2026-10-09)

Implementação realizada na branch `feature/fase-308-resumo-exames` a partir da
base planejada. O resumo consome PB-17 por leitura mínima tenant-scoped,
compartilha a classificação de faixa com o writer, e apresenta resultados
recentes por grupo na seção “Leitura clínica”. Inclui nomes livres agrupados
conservadoramente, cobertura de 100 coletas, até 10 destaques, duplicidade sem
escolha e estado indisponível sem payload parcial. O BFF usa
`Cache-Control: private, no-store`. Nenhuma migration/deploy ou consulta a
dados reais foi executada.

**Gates locais:** backend Jest integral PASS (263 suítes, 2.379 testes; 3
suítes/38 testes ignorados pela configuração existente); typecheck/build do
backend PASS; typecheck/lint do Web PASS (63 avisos de lint, nenhum erro);
Playwright da Fase 308 PASS (6 testes em desktop/mobile); acessibilidade focada
do detalhe PASS (2 testes em desktop/mobile); teste BFF focado PASS (4/4);
scanner local de secrets PASS; `git diff --check` PASS após a revisão final.
O comando geral `test:authz` foi interrompido após os harnesses relevantes e
alguns harnesses gerais passarem, pois executa 19 compilações TypeScript
isoladas em série; o harness do prontuário passou diretamente. A suíte a11y
completa foi interrompida após três testes de áreas não relacionadas; o teste
focado do prontuário passou. Web/backend builds passaram e o diff foi revisado.

**PR #385:** https://github.com/octanutri-clin/octaclin/pull/385, commit
`537665ce`, aberta na mesma branch. CI obrigatório passou: OctaClin CI
`37982409232` (inclui Demo local smoke em 16m12s e Governança); imagens
`37982409141` (backend/ia-service/web e Trivy warning PASS; `Provenance do
SBOM` SKIPPED); CodeQL `37982409220` PASS; Dependency Review `37982409219`
PASS; Semgrep `37982409360` e Semgrep OSS PASS. PostgreSQL/RLS local não foi
executado. Não declarar prova de isolamento além dos testes disponíveis.
R4: revisão humana ainda pendente na PR. Sem aceite de produção. Próximo passo:
revisão humana e resolução de comentários; merge, migration e deploy seguem
fora do escopo.

## Objetivo, risco e limites

Completar PB-16 com uma leitura factual de PB-17 na seção “Leitura clínica”
da aba Resumo do prontuário. Mostrar nome, resultado, unidade, referência
efetivamente registrada, data civil de coleta e origem de agrupamento.
**R4**, por dados clínicos e autorização. A fase é somente leitura, sem schema
novo, backfill, provider, upload, notificações, score ou decisão clínica.
Portal do paciente e API pública `/v1` não recebem este campo.

ClamAV não é dependência desta leitura de resultados já estruturados. Os gates
de upload/extração da Fase 316 continuam em sua trilha. A migration 1064 da
Fase 307 é pré-requisito da versão integrada quando o ambiente usar seus
campos; sua aplicação não foi verificada neste ciclo. Não executar migration,
deploy, merge ou consultar dados clínicos reais durante a implementação.

## Evidência e análise de gaps

| Superfície observada | Gap | Decisão de implementação |
| --- | --- | --- |
| `ServicoPacientes.obterProntuario`, em `aplicacao/servico-pacientes.ts`, agrega antropometria/plano/condutas em uma transação tenant-scoped | Não consulta exames para `leituraClinica` | Acrescentar leitura mínima usando o mesmo `EntityManager`, depois de validar paciente/carteira |
| `aplicacao/servico-exames-laboratoriais.ts` contém `numeroDecimal`, `situacaoFaixa` e `ResultadoMarcador` privados | Duplicar regra criaria divergência entre aba e resumo | Extrair regra/tipos para `dominio/resultado-exame-laboratorial.ts` e reutilizar nos dois consumidores |
| PB-17 salva `resultadoCriptografado`, com unidade/limites do resultado; catálogo pode ser arquivado | Reconsultar o padrão atual mudaria fatos históricos | Classificar apenas pelo snapshot do resultado; não consultar catálogo para reclassificar |
| `ServicoExamesLaboratoriais.listar` lista todo o histórico e também decifra laboratório/observações | Reutilização integral aumentaria dados/processamento e abriria outra transação | Criar leitor específico com projeções e limites, sem chamar `listar` |
| `catalogoMarcadorId` opcional; identidade dos nomes livres está cifrada | Não existe identidade persistida para agrupamento livre | Agrupamento transitório conservador, aprovado abaixo, sem migration |
| `dtos.ts` e Web `lib/prontuario-api.ts` não contêm o novo resumo | Contrato e fixtures incompletos | Adicionar campo opcional e união discriminada; atualizar expectativas/fixtures afetadas |
| Ambos os controladores usam `SuperAdmin`, `Professional`, `Collaborator` + `pacientes.ler`; profissional é limitado pela carteira | A UI não substitui a proteção do serviço | Revalidar autorização do novo segmento e testar negações antes de consultas de exames |
| `components/pacientes/estrutura-prontuario.ts` permite Exames sem permissão adicional | Não há autorização clínica adicional existente para esta aba | Preservar política atual, sem inventar permissão/papel novo |
| BFF `app/api/pacientes/[id]/prontuario/route.ts` repassa o resumo, sem cabeçalho explícito de cache na resposta ao navegador | Dado clínico novo exige proteção explícita de resposta | `Cache-Control: no-store` no sucesso e erros da rota; preservar wrapper/sessão/params assíncronos |
| `console-regression.spec.mjs` tem helper de prontuário e cenário PB-17; `test-prontuario-timeline-bff.mjs` não compila a rota de resumo | Falta cobertura do contrato novo/BFF e estados visuais | Expandir harness existente, fixtures e cenários Fase 308 |
| Status/checklist/roadmap ainda indicam 307 em execução | Handoff poderia reiniciar fase já mergeada | Reconciliação documental nesta branch; implementação atualiza somente seu resultado real |

Leitura mínima antes de editar: `AGENTS.md`, `docs/agents/REGRAS.md`, AGENTS
dos pacotes, `SECURITY.md`, classificação de dados, decisões de arquitetura,
linha PB-17 de `MATRIZ_CONFIABILIDADE_TESTES.md`, planos 273/278, este plano
e arquivos da tarefa ativa. A auditoria de produto é histórica; não reabri-la.

## Decisões confirmadas pelo proprietário nesta sessão

1. Considerar **o resultado mais recente por grupo**, não só a última coleta
   inteira, nem o último resultado alterado. Resultado posterior dentro da
   faixa ou sem classificação substitui o anterior; nunca ressuscitar o antigo.
2. Incluir resultados vinculados ao catálogo e os de nome livre.
3. Para nomes livres, agrupar por **nome + unidade + método**. Ignorar somente
   maiúsculas/minúsculas e espaços no nome/método. Unidade mantém diferença
   de caixa, símbolos e grafia. Não inferir sinônimos, remover acentos,
   converter unidade ou associar automaticamente texto livre a catálogo.
4. Grupos livres e grupos do catálogo ficam separados, com origem visível.
   “Vit D” e “Vitamina D” são diferentes; a transição de livre para catálogo
   não substitui automaticamente o grupo antigo.
5. Analisar **as 100 coletas mais recentes** e devolver **até 10 destaques**,
   com cobertura e truncamento explícitos. “Mais recente” é dentro desta
   cobertura, não promessa de revisar todo o histórico.
6. Se o grupo tiver dois ou mais resultados na sua coleta mais recente,
   sinalizar duplicidade e encaminhar para Exames. Não escolher um resultado,
   classificar o grupo ou recorrer à coleta anterior, mesmo se valores iguais.

## Algoritmo e contrato fechados

### Leitura e ordenação

Implementar `obterLeituraExamesResumo` em
`aplicacao/leitura-exames-resumo.ts`, sem provider/Nest/injeção adicional.
Recebe gerenciador já tenant-scoped, criptografia, tenant e paciente; não é
endpoint nem substitui a autorização do chamador. Retorno tipado pelo DTO.

1. Em `obterProntuario`, após `garantirPacienteExiste`, só chamar o leitor se
   `tenantId === usuario.tenantId`, papel estiver entre os três papéis acima
   e houver `pacientes.ler`. Se não, omitir o novo campo e não consultar nem
   decifrar exames. Manter as guardas já existentes no controlador. Os testes
   diretos antigos do serviço usam permissões reduzidas: continuar sem exames,
   não enfraquecer esta condição para fazê-los passar.
2. Buscar `ColetaExameLaboratorialOrm` com `tenantId`, `pacienteId`,
   `excluidaEm: IsNull()`, `order: { coletadaEm: 'DESC', criadoEm: 'DESC',
   id: 'DESC' }`, `take: 101`, `select` só de `id`, `coletadaEm`, `criadoEm`.
   Cortar em 100 antes de buscar resultados; a 101ª só detecta histórico
   truncado. Sem coletas, devolver resumo disponível vazio sem consulta extra.
3. Buscar `MarcadorExameLaboratorialOrm` com `tenantId`, `coletaId: In(ids)`,
   `excluidoEm: IsNull()`. Projetar `id`, `coletaId`, `catalogoMarcadorId`,
   `ordemExibicao`, `resultadoCriptografado`; ordenar por `ordemExibicao ASC`,
   `id ASC`. `take: 10001`: a criação atual aceita até 100 resultados/coleta,
   mas esse limite não é constraint. Mais de 10000 resultados torna a seção
   indisponível; não devolver contagem parcial como se fosse completa.
4. Organizar os resultados por coleta; percorrer as coletas na ordem do passo
   2. Decifrar somente resultados incluídos. Validar estrutura mínima:
   objeto JSON, `nome` não vazio e `valor` string, campos opcionais string
   quando presentes. Falha de decifragem/JSON/estrutura invalida a seção.
   Não retornar nem logar payload, ciphertext, nome/valor ou chave de grupo.
5. Chave de catálogo: `JSON.stringify(['catalogo', catalogoMarcadorId])`.
   Chave livre: `JSON.stringify(['livre', normalizar(nome), unidade?.trim()
   ?? '', normalizar(metodo ?? '')])`; `normalizar` = trim, colapsar whitespace
   para um espaço e `toLocaleLowerCase('pt-BR')`. Chaves só em memória, nunca
   em resposta/log/telemetria. Catálogo agrupa por ID mesmo se unidade/método
   mudou, sempre usando snapshot da última coleta; livre usa a chave completa.
6. Primeiro reservar todos os resultados de cada grupo na coleta. Um grupo
   visto em coleta anterior não será revisitado. Duas ocorrências no grupo
   daquela coleta = duplicidade. Isso impede que uma ocorrência fora da faixa
   seja escolhida antes de detectar a outra. Não filtrar fora da faixa antes
   de determinar o grupo mais recente.
7. Nos grupos únicos, classificar com helper compartilhado. Exigir unidade
   não vazia, valor decimal finito, pelo menos um limite numérico válido, todos
   os limites presentes válidos e inferior <= superior. Aceitar vírgula/ponto
   decimal e limites unilaterais. Igual ao limite fica dentro da faixa;
   `<5`, `>200`, texto, referência só textual ou unidade ausente não recebem
   classificação. Não extrair números de `referencia`.
8. Contar grupos: fora, dentro, sem classificação e duplicados são conjuntos
   disjuntos. `gruposAnalisados` é a soma desses quatro conjuntos. Selecionar
   só os fora da faixa, na ordem da coleta recente; dentro da mesma coleta,
   `ordemExibicao ASC`, `id ASC`. Contar todos antes de cortar a lista em 10.

O helper compartilhado deve preservar PB-17 nos inputs válidos e tratar
limites malformados/invertidos como sem classificação. Os writers já validam
limites; este é um controle defensivo para leitura legada, coberto por teste
nos dois consumidores. Não usar `parseFloat` nem classificação no navegador.
Exportar `ResultadoMarcador`, `SituacaoFaixa`, `numeroDecimal` e `situacaoFaixa`
do novo arquivo de domínio; o writer também usa `numeroDecimal` e deve
importá-lo, mantendo a validação de criação.

Fixture sintética mínima para o teste de integração: duas coletas; quatro
grupos aparecem na mais recente. Catálogo Ferritina = 42 ng/mL (10–40), livre
Glicose = 85 mg/dL (70–99), livre Vit D = `<5` ng/mL (20–50), e livre marcador
“Controle sintético” repetido duas vezes com mesma unidade/método. A anterior
contém Glicose = 120 e Vit D = 55. Esperado: `gruposAnalisados: 4`,
`gruposNomeLivre: 3`, `totalForaFaixa: 1`, `semClassificacao: 1`,
`duplicadosNaUltimaColeta: 1`; apenas Ferritina na lista. Resultado antigo
alterado não pode ressurgir. Sem truncamento, `coletasAnalisadas: 2`.

### DTO proposto (mesmos nomes em backend e Web)

Novo campo opcional em `resumo.leituraClinica.examesForaFaixa`:

```ts
type ExamesForaFaixaResumo =
  | { status: 'indisponivel' }
  | {
      status: 'disponivel';
      coletasAnalisadas: number;
      limiteColetas: 100;
      historicoTruncado: boolean;
      gruposAnalisados: number;
      gruposNomeLivre: number; // inclui sem classificação/duplicados
      semClassificacao: number;
      duplicadosNaUltimaColeta: number;
      totalForaFaixa: number;
      itensLimitados: boolean; // totalForaFaixa > itens.length
      itens: Array<{
        resultadoId: string;
        coletaId: string;
        origemAgrupamento: 'catalogo' | 'nome_livre';
        nome: string;
        valor: string;
        unidade: string;
        coletadaEm: string; // YYYY-MM-DD, data civil
        limiteInferior?: string;
        limiteSuperior?: string;
        referencia?: string;
        metodo?: string;
      }>;
    };
```

Construir itens por allowlist, nunca espalhar payload JSON/entidade. IDs são
somente do resultado/coleta autorizados, para identidade React; não exibir ou
enviar para logs/telemetria. Não incluir laboratório, notas, autor, consulta,
tenant, paciente, ciphertext, catálogo atual ou chave de agrupamento.

Falha de crypto/JSON/estrutura ou overflow no leitor devolve somente
`{ status: 'indisponivel' }`, sem contagens ou itens parciais. Consultas ORM
ficam fora desse catch: erro SQL propaga para o erro sanitizado/recuperação
existente do prontuário inteiro. **Não engolir exceção SQL dentro da transação
do ExecutorTenant**: PostgreSQL pode deixar a transação abortada, fazendo
consultas seguintes/commit falharem. Não criar savepoint ou outra conexão para
contornar isso nesta fase. Não capturar auth/carteira como ausência de exame.
Campo ausente em backend antigo significa “Resumo de exames indisponível”;
jamais significa zero resultados alterados.

### UI e estados

Criar `components/pacientes/resumo-exames-fora-faixa.tsx`, usando os tipos do
prontuário. Renderizar como bloco próprio abaixo do `dl` atual de Leitura
clínica; não transformar o grid de quatro itens em cinco colunas apertadas.
Integrar pelo `ProntuarioPaciente`, passando navegação/recarregamento existentes.

- Título: “Exames fora da faixa informada”. Contexto: “Último resultado por
  grupo nas N coletas mais recentes.”
- Cada destaque mostra nome, valor original + unidade, data e faixa numérica
  do snapshot; renderizar dois limites como “X a Y unidade”, só inferior como
  “A partir de X unidade”, só superior como “Até Y unidade”. Referência textual
  e método aparecem quando presentes, sem substituir a faixa numérica.
- Origem: “Catálogo” ou “Nome livre”. Se `gruposNomeLivre > 0`, explicar que
  “Nomes livres são agrupados por nome, unidade e método e permanecem separados
  dos marcadores do catálogo.” Data explícita evita apresentar fato antigo como
  recente por inferência. Não inferir nível de gravidade ou orientação.
- Zero coletas: “Nenhum exame registrado.” Coletas sem grupos: “Nenhum
  resultado de exame disponível nas coletas analisadas.”
- Zero fora, havendo grupos: “Nenhum resultado fora da faixa informada nos
  grupos classificáveis analisados.” Nunca “Todos os exames estão normais”.
- `semClassificacao > 0`: informar N grupos sem classificação por ausência de
  valor numérico, unidade ou faixa válida; consultar Exames para o detalhe.
- `duplicadosNaUltimaColeta > 0`: informar N grupos com “Resultado duplicado
  na coleta — consultar Exames”. Sem escolher resultado ou exibir valor antigo.
- `historicoTruncado`: “Resumo limitado às 100 coletas mais recentes. Há
  histórico anterior na aba Exames.” `itensLimitados`: “Mostrando 10 de N
  resultados fora da faixa nas coletas analisadas.” Ambos independentes.
- Campo ausente/indisponível: mensagem indisponível e “Tentar novamente”
  chamando `carregar`; não transformar erro em estado vazio. Carregamento
  inicial acompanha skeleton do prontuário; retries mantêm indicação de espera.
- Acesso ausente na sessão: não renderizar dados nem ação para Exames; indicar
  “Acesso não disponível”. Para acesso permitido, botão “Ver exames
  laboratoriais” usa `solicitarTrocaAba('exames_laboratoriais')`, respeitando
  controle atual de mudança de aba e formulário não salvo; esta função foi
  conferida no código durante o planejamento.
- Usar lista semântica/heading acessível, texto além de cor, foco visível,
  wrapping para nomes/referências longos. Datas civis com o helper usado na
  aba Exames (`T12:00:00Z`/UTC); não aplicar fuso que mude o dia da coleta.

## Autorização, privacidade e compatibilidade

| Caso | Resultado esperado do novo segmento |
| --- | --- |
| Professional + pacientes.ler + paciente próprio ativo | Dados somente deste paciente e tenant |
| Professional sem vínculo ou paciente de outra carteira | 404 do fluxo existente; nenhuma leitura/decifragem de exame |
| SuperAdmin/Collaborator + pacientes.ler | Acesso tenant-scoped conforme política atual |
| Tenant da chamada diferente da credencial | Novo segmento ausente; nenhuma consulta/decifragem de exame; HTTP resolve tenant pela credencial |
| Permissão ausente ou Patient/Client | Guardas HTTP negam; serviço não produz segmento mesmo em chamada direta |
| Paciente arquivado/inexistente ou outro tenant | 404 antes de examinar resultados |

Não mudar permissões globais nem os outros blocos do resumo nesta tarefa.
Não criar rota nova nem dependência circular. Campo opcional tolera rollout
com backend antigo. O BFF repassa só a resposta do backend autenticado e o
header no-store, sem aceitar tenant/query do navegador. Preservar a auditoria
`pacientes.prontuario.ler` sem incluir os valores novos em metadata.

## Matriz de testes obrigatória

| Conjunto | Casos mínimos |
| --- | --- |
| Helper de faixa | Acima/abaixo/igual aos limites, negativo/zero/vírgula, unilateral, texto, unidade ausente, só referência textual, limite inválido/invertido, snapshot distinto do catálogo |
| Grupos/recência | Fora antigo → dentro novo; fora antigo → não classificável novo; dois marcadores em coletas diferentes; livre caixa/espaço iguais; unidade/método/nome/acentos diferentes; livre vs catálogo separados; ID igual com unidade alterada; duplicidade mais recente sem ressuscitar anterior |
| Consulta mínima | Tenant/paciente/soft-delete explícitos; 101ª coleta nunca decifrada; 0/100/101 coletas; >10 destaques; >10000 resultados indisponível; nenhum header sensível decifrado; ordenação estável de datas civis/ties |
| Serviço/auth | Papéis permitidos; Professional sem vínculo e outra carteira; outro tenant, paciente arquivado, permissão ausente, Patient/Client; consultas de exames/crypto não chamadas nas negações |
| Dados/erro | Allowlist sem vazamento de campos extras; crypto/JSON/overflow = indisponível, nunca zero; erro SQL propaga para recuperação do prontuário; nenhuma captura de auth; não retornar valores parciais |
| BFF | 401 sem sessão sem fetch, rota/paciente codificado, wrapper preservado, 403/404 backend preservados, body novo não alterado, no-store inclusive erros, query tenant arbitrário não encaminhada |
| Browser desktop/mobile | Destaque, origem livre/catálogo, referência/unilateral/data, vazio, sem classificação, duplicado, dois limites da cobertura, ausente/indisponível + retry, acesso negado, navegação Exames, nomes longos sem overflow, a11y |

Usar dados sintéticos. Testes que mockam repositório devem conferir filtros
e negação antes da consulta; fixtures sem filtragem não provam isolamento.
Não adicionar teste que só confira que um texto está no source.

## Sequência, comandos e gates

As tarefas com dependências/arquivos e critérios estão em `tasks/todo.md`.
Ordem: helper → leitor → integração/backend → BFF → UI → Playwright → docs/PR.
TDD nas mudanças de comportamento/contrato; registrar RED real antes do GREEN.
Para a nova leitura ORM com filtros/RLS já existentes, specs dos serviços e
testes negativos são o gate local. RLS PostgreSQL é gate separado já existente
no CI, a manter aprovado. Se implementação introduzir SQL específico, mudar
RLS/constraints ou não conseguir provar o filtro pela API ORM, a prova em
PostgreSQL descartável torna-se obrigatória antes de concluir a fase.

Na raiz do worktree, sob Node 22/pnpm 11.25.0:

```bash
pnpm --dir octaclin-backend test --runInBand resultado-exame-laboratorial.spec.ts leitura-exames-resumo.spec.ts servico-exames-laboratoriais.spec.ts servico-pacientes.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web exec node scripts/test-prontuario-timeline-bff.mjs
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs --grep 'Fase 308|PB-17|resumo clinico acionavel' --reporter=list
pnpm --dir octaclin-web test:a11y
git diff --check
pnpm security:secrets
```

Não executar build, typecheck, harnesses ou Next dev em paralelo no mesmo
pacote: Next gera tipos e já houve falha de authz por essa concorrência na 307.
Playwright tem projetos `desktop-chromium` e `mobile-chromium`; não limitar a
desktop. Consultar documentação da versão instalada do Next antes de editar
rota. Backend full Jest é exigido pelas instruções do pacote se houver mudança
transversal; esta extração/integração de contratos compartilhados deve fechar
com `pnpm --dir octaclin-backend test --runInBand`. Não repetir suite já
aprovada sem mudança, falha ou preocupação nova. CI mantém Demo local smoke,
Governança e os gates existentes. Monitorar a PR pelo ID exato do run.

Ambiente preparado neste planejamento: Node `22.23.2` e pnpm `11.25.0`
disponibilizados via npm exec, versões conferidas; install congelado de backend
e Web **PASS**, sem diff de lockfiles. O shell padrão continua Node `24.19.0` /
pnpm `11.19.0`; usar o wrapper abaixo em cada chamada de ferramenta, pois um
export de PATH em uma chamada pode não persistir na seguinte:

```bash
npm exec --yes --package=node@22.23.2 --package=pnpm@11.25.0 -- sh -c 'node --version && pnpm --version'
# Exemplo de comando de implementação com o runtime preparado:
npm exec --yes --package=node@22.23.2 --package=pnpm@11.25.0 -- sh -c 'pnpm --dir octaclin-backend test --runInBand resultado-exame-laboratorial.spec.ts'
```

Não compartilhar node_modules/.next do worktree 307, alterar engines ou
regravar lockfiles. Binário Chromium apontado pelo Playwright existe neste
ambiente; lançamento/funcionamento ainda não testados. Se o ambiente/worktree
for recriado, repetir install congelado e conferir browser antes do checkpoint.

## Rollback, evidência e handoff

Rollback: reverter o commit da funcionalidade, mantendo schema e resultados
já registrados. Nenhuma reversão de dados/migration é necessária para 308.
Revisão cruzada de R4 é desejável; revisão pelo mesmo modelo não é independente.
Não delegar automaticamente: usuário pediu implementação autônoma pelo Luna.

Evidência deste ciclo: PR #384 `MERGED`; CI principal na base observada
`SUCCESS`, run [37971450248](https://github.com/octanutri-clin/octaclin/actions/runs/37971450248).
CodeQL/Semgrep/Trivy da mesma base constaram `success`. Monitor produção
[37977323201](https://github.com/octanutri-clin/octaclin/actions/runs/37977323201)
falhou no job “Saude externa”; causa não diagnosticada neste planejamento.
Não inferir health/rollout de produção de CI nem atribuir a causa só ao ClamAV.
O CI histórico da base 306 teve falha; o CI principal da integração 307 é a
evidência atual, não uma reclassificação daquele run antigo.

PASS de planejamento: fontes e base conferidas, quatro decisões de produto
respondidas, plano/contrato/checklist preparados, runtime e installs congelados,
links locais do handoff e `git diff --check`, scanner `pnpm security:secrets`.
Testes de implementação, build, prova externa de banco e deploy: **SKIPPED**,
fase autorizada neste turno é preparação. Não confundir dependências
instaladas com build/teste funcional aprovado.

Primeira ação exata do Luna: ler `tasks/plan.md`, reconfirmar branch/status/log,
ativar o wrapper de runtime e executar Tarefa 1, com teste RED do helper.
Se o usuário apenas trocar o modelo sem autorizar implementação, continuar
aguardando a instrução de implementar. Abrir PR draft somente quando houver
código revisável; não abrir PR isolada só para esta reconciliação documental.

Escalar e pausar o item afetado se precisar de migration, nova permissão,
equivalência de marcadores, upload/provider, alteração do escopo aprovado ou
falha de isolamento. Comunicar ao usuário se for necessário voltar para
GPT-6.1 Sol Alto e pausar para a troca manual. Não há pergunta de produto
pendente após as quatro respostas registradas acima.
