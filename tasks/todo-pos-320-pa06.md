# PA06 — checklist: autosave, ativação e cálculo combinado

Planejamento: [plan-pos-320-pa06.md](plan-pos-320-pa06.md).
Base `eae74b1e`, 2026-10-15. Núcleo T01–T06 e UI T07/T08 implementados nesta
worktree. T09/T10 (integração final, revisão independente, CI/PR) e as entregas
T08a–T08d continuam pendentes.

## T00 — base, evidência e produto (1–3 documentos)

- [x] Merge #419 e árvore iguais ao HEAD aprovado; CI/checks aplicáveis PASS.
- [x] Preservar worktrees e criar branch dedicada a partir de origin/main.
- [x] Ler contratos FND02/PA02–PA05 e pesquisar só R013/R014 fixados no plano.
- [x] Registrar gaps, referências, risco R4, gates e sequência de modelos.
- [x] D01: habilitado por padrão, ciclo de 60 segundos; D02: alimentos válidos salvos mesmo
  com formulário incompleto; D03: salvar e sair/continuar/descartar confirmados.
- [x] D04: on/off simples oculta e exclui dos macros, sem arquivar/excluir ou
  exigir nova revisão para reexibir; D05: preservar linhas incompletas e pendentes.
- [x] D06: plano inteiro e cada refeição; D07/D08: seleção de vários planos e
  refeições para calorias/macros/micros, excluindo automaticamente os desativados.
- [x] D09: todos os planos ativos publicados acessíveis no portal; desativados,
  arquivados e excluídos inacessíveis. D10: somente versão publicada atual salva
  no cálculo combinado, sem rascunho ou versão histórica.
- [x] Autorização de implementação recebida em “Pode começar”; primeira entrega em curso.

## T01 — testes RED e contrato de revisão geral (2–4 arquivos)

Dependência: T00 e autorização. Sol médio.

- [x] Reproduzir resposta A sobrescrevendo edição B em Promise controlada.
- [x] Reproduzir PUT legado que altera conteúdo sem incrementar revisão PA05.
- [x] Reproduzir recusa atual de guardar alimento válido quando meta/objetivo faltam.
- [x] Fixar DTO/retorno de revisão geral, geração e transição de clientes antigos;
  proteger rascunho aderido contra PUT sem precondição sem alterar dados antigos.

Aceite: RED do comportamento e contrato inequívoco de novos/legados, sem usar
timestamp como versão nem mudar a semântica do contador de apresentação.
Verificação: testes focados de serviço e motor de gravação, estado anterior falha.

## T02 — persistência de revisão e migration aditiva (3–5 arquivos)

Dependência: T01. Sol médio.

- [x] Criar revisão monotônica e adesão protegida mínima em versão; registro e DTO.
- [x] Prever documento de edição parcial cifrado e vínculo entre revisão editorial,
  materialização clínica e completude, sem afrouxar tabelas clínicas existentes.
- [x] Conferir todos os writers de rascunho/transições, compatibilidade, overflow,
  clones e preservação de hash/snapshot publicado; nenhuma escrita parcial.
- [x] Migration nova com testes e registro; próximo número revalidado, nunca editar1072.

Aceite: precondição checada sob lock antes dos filhos; erro não avança revisão;
desligar autosave não reabre legado inseguro; rollback não perde histórico.
Verificação: serviço/DTO/migration/clone/hash unitários e integridade do inventário.

## T03 — salvar/reabrir edição parcial (3–5 arquivos)

Dependência: T02, D02/D05. Sol médio.

- [x] DTO profissional explícito de edição, limites e formato versionado cifrado;
  preservar alimentos com porção válida sem avaliação/objetivo/meta completos.
- [x] Reabrir snapshot editorial autorizado; tratar linhas incompletas conforme D05,
  sem perder linha válida, zerar vazio ou permitir IDs de outra clínica/paciente.
- [x] Materializar cálculo/estrutura quando aptos, marcando revisão correspondente;
  backend bloqueia revisar/publicar e projeção clínica de edição ainda pendente.

Aceite: snapshot parcial é persistido e reaberto com segurança, sem simular
completude clínica; versões publicadas ficam imutáveis e sem campos editoriais.
Verificação: DTO/serviço/controlador, cifragem, projeções e negativos de autorização.
Não criar preferência persistente de autosave por profissional nesta revisão.

## T04 — prova PostgreSQL/RLS/concorrência (2–4 arquivos)

Dependência: T02/T03. Sol médio. Banco descartável com fixtures próprias.

- [x] Save/save com mesma revisão: um sucesso e um409; replay e geração antiga negados.
- [x] Writers PA05/legados↔PA06, adesão monotônica e save↔revisão/publicação;
  tenant/carteira/transferência/arquivamento/revogação, sem bypass de RLS.
- [x] Conferir FORCE RLS/role runtime; snapshot editorial no banco real;
  executar também casos adjacentes PA04/PA05 para não esconder contaminação.

Aceite: provas com PostgreSQL real e barreiras explícitas, sem depender de sleeps.
Verificação: `pnpm --dir octaclin-backend test:rls:testcontainers`; gate integral
não pode virar PASS por fixture que omite Timescale/pgvector.

### Checkpoint A — contrato antes da UI

- [x] T01–T04 GREEN e limitações documentadas; backend completo tipado e buildável.
- [x] Nenhuma alteração publicada a pacientes; produção/migrations externas SKIPPED.

## T05 — coordenador em memória (2–4 arquivos)

Dependência: checkpoint A. Sol médio.

- [x] Extrair regras puras mínimas sem reescrever o editor; ciclo de 60 segundos, um request,
  pendente mais recente, snapshot A/edição B, retorno obsoleto e iniciar/encerrar idempotentes (React StrictMode emT07).
- [x] Implementar save manual no mesmo coordenador; ligação ao formulário emT07; cópia/IME bloqueiam envio; campos
  clínicos pendentes não bloqueiam snapshot editorial estruturalmente válido;
  manter baseline confirmado, chaves locais/foco e dirty até último ACK.
- [x] Rede incerta,401/403/404,400/422 e409 pausam conforme plano; sem retry/flush
  no unmount, reconexão, foco, beacon ou persistência em navegador.

Aceite:59.999ms sem envio,60.000ms com alteração envia,120.000ms próximo ciclo;
digitação não reinicia relógio; tick sem mudança não grava; timers/Promises
comprovam preservação de B e nenhum Salvo prematuro. Sem fila crescente.
Verificação: unitários executáveis do motor e validação; novo script registrado
na suíte/CI existente, sem testes órfãos.

## T06 — BFF e cliente (3–5 arquivos)

Dependência: T05. Sol médio.

- [x] Encaminhar edição parcial/revisão e manter PUT clínico legado protegido;
  retorno mínimo e no-store, permissões existentes reutilizadas e mapa de rotas atualizado.
- [x] Estado de completude e revisão calculada explícitos; sem campo editorial no portal.
- [x] Preservar status de conflito/acesso e mensagens sanitizadas, sem entidade crua.

Aceite: sessão/tenant vêm do servidor; falhas de edição ou save não viram200.
Verificação: testes específicos em `test-planos-alimentares-bff.mjs`, negativos
de edição parcial e `pnpm --dir octaclin-web test:authz` na integração final.

### Checkpoint B — troca opcional para Luna

- [x] T05–T06 GREEN focado; DTOs, motor e fixtures fechados, handoff atualizado.
  `test:authz` integral e gates de integração mantidos emT09 até conclusão.
- [x] Handoff preparado para aviso “GPT-6 Luna alto” e pausa antes deT07/T08;
  não assumir troca automática.

## T07 — controles e estados acessíveis (2–4 arquivos)

Dependência: checkpoint B, D01/D02. Luna alto suficiente.

- [x] React StrictMode sem dois ciclos, cleanup sem gravação, autosave ligado inicialmente, status de ciclo/último ACK e ações de erro em
  desktop/mobile; teclado/aria-live, sem chamada imediata só por abrir plano.
- [x] Salvar manual permanece; preservar metas/subtotais, PA05, colapso e chaves
  durante edição simultânea ao request; opção desligada não faz flush implícito.
- [x] Diferenciar pendente inválido, falha, conflito e envio incerto sem roubar foco;
  após ACK, subtotais usam a materialização canônica retornada pelo backend sem
  substituir valores, foco, caret ou composição IME do formulário local.

Aceite: todos os estados têm texto e comportamento verificáveis; não publicar
nem revisar automaticamente; nenhum vazamento em cache/URL/telemetria.
Verificação executada: Playwright focado em `console-regression.spec.mjs` (desktop
e mobile, reordenação, fake clock de 60 s, autosave parcial, Axe e salvar-e-sair);
regressões focadas PA02/PA03 (5 cenários desktop/mobile) e PA05 conflito/versão
(desktop/mobile). ESLint nos arquivos alterados: zero erros, 12 avisos de hooks
já presentes nos componentes de prontuário/editor. A suíte visual integral ainda
é gate de T09.

## T08 — saída interna e transições (2–4 arquivos)

Dependência: T07, D03 confirmada. Luna alto com contrato já fechado por Sol.

- [x] Integração com `prontuario-paciente.tsx`; manter guardas
  de outros editores e beforeunload FND02; navegação só após confirmação atual.
- [x] Troca de paciente/plano/geração invalida timers/respostas; nova versão,
  cópia, revisão/publicação e arquivo não compartilham request pendente indevido.
- [x] Salvar e sair não descarta outras pendências; erro409/rede mantém a tela.

Aceite: nenhum POST/PUT de cleanup, nenhum “Salvo” após troca e nenhum save
recebido pelo paciente errado. Guardas existentes continuam cobertas.
Verificação executada: navegação entre abas, salvar e sair, proteção FND02
(`test:proteger-alteracoes-nao-salvas`, 4/4), requests CAS em PA02/PA05 e
acessibilidade no fluxo Playwright desktop/mobile. Falha 409 preserva edição e
expõe Reconciliação, sem retry automático. Troca de paciente/plano, arquivo,
revisão/publicação e chamadas atrasadas recebem regressão final em T09.

### Resultado local da implementação T07/T08 — integração Sol em andamento

- Web typecheck PASS; BFF de planos 29/29; coordenador/nutrição 33/33; proteção
  contra saída 4/4.
- Playwright focado: editor e saída segura 2/2; PA02/PA03 10 execuções de cenário
  (5 cenários × desktop/mobile) GREEN após correção dos totais canônicos; PA05
  preferências/conflict 2/2.
- Um timeout inicial do Playwright ocorreu ao reutilizar servidor Next antigo;
  reinício limpo eliminou o problema. Um teste PA02 inicialmente detectou subtotal
  local divergente do ACK; corrigido para usar snapshot materializado do backend e
  repetido em desktop/mobile (2/2 PASS).
- ESLint encerra com zero erros e 12 warnings de regras `react-hooks` em efeitos
  observados no editor/prontuário. Sem atribuir anterioridade sem comparação de base.
- Nenhuma ativação, migration externa ou alteração de fluxo no portal. PR em preparação.
  Confirmar `next-env.d.ts` e `git status` limpos de artefatos antes do checkpoint.
- T09/T10 ainda exigem regressão integral, build/gates, revisão R4 independente e
  validação CI do HEAD; abrir Draft após gates locais, manter merge/deploy bloqueados.

## T08a — visibilidade on/off, contrato/backend (3–5 arquivos por fatia)

Dependência: D04/D06 confirmadas, D09 e T04. Sol médio.

- [ ] OFF/ON no plano e refeição sem arquivar, excluir ou reescrever publicação;
  impedir fallback automático para outro plano e entrega de edição incompleta.
- [ ] Identidade lógica estável das refeições através de save/clone/ordenação;
  cópia para outro plano não compartilha estado operacional da origem.
- [ ] Estado aditivo com revisão operacional/histórico e transação/CAS,
  autorização e leitura/ações do portal protegidas, incluindo IDs conhecidos.
- [ ] Provar concorrência OFF/publicação/escolha em PostgreSQL e RLS; estado
  de visibilidade não é o switch de autosave nem aprovação clínica automática.

Aceite: desligar preserva dados, exclui dos macros vigentes e impede novas
leituras/ações afetadas; reexibir não exige edição/nova revisão ou confirmação
extra. Histórico/PDF já obtido não são apagados; primeira publicação mantém contrato.
Plano OFF prevalece sobre as refeições, sem alterar seus estados individuais;
autosave antigo não religa plano/refeição; macros/micros filtrados pelo backend.
Verificação: negativos de portal, carteira, transferência, replay e concorrência.

## T08b — controle on/off e projeções (2–4 arquivos)

Dependência: T08a e T07. Luna alto só após contrato backend fechado por Sol.

- [ ] Switch com nome acessível correspondente ao efeito, liga/desliga direto;
  erro não afirma mudança aceita nem altera publicação só por clicar.
- [ ] Resumo do console distingue salvo/parcial/revisado/publicado/visível;
  portal respeita retirada, sem expor DTO profissional ou edição incompleta.
- [ ] Portal lista/pagina todos os planos ativos publicados; detalhe e ações
  negam desativados/arquivados/excluídos/outro paciente, inclusive IDs conhecidos.
- [ ] Cobrir teclado/mobile, reload, múltiplos planos e edição de nova versão
  enquanto a publicação anterior está visível.

Aceite: todo estado exibido corresponde ao ACK autorizado do backend; nenhuma
publicação/retirada disparada pelo timer. Verificação: Playwright e BFF alvo.

## T08c — nutrientes e agregação entre planos, backend (fatias de3–5 arquivos)

Dependência: T08a, D07 confirmada e D10. Sol médio.

- [ ] Primeira fatia: whitelist versionada de micronutrientes/unidades verificados,
  snapshot por composição e contrato manual. Legado incompleto não vira zero nem
  consulta catálogo atual para fingir cálculo histórico. Sem IDR/UL ou TBCA.
- [ ] Segunda fatia: projeção de cálculo combinado com planos/refeições/versões
  selecionados do mesmo paciente, autorização em lote e consistência de revisão;
  não confiar em valores do cliente nem limitar à página exibida.
- [ ] Terceira fatia: filtro comum plano ativo E selecionado E refeição ativa E
  selecionada; totais/cobertura por nutriente, sem somar substituições ou metas.
- [ ] Negativos para outro paciente/tenant/carteira, versão duplicada, seleção
  alterada, catálogo inválido, dado ausente, unidades incompatíveis e plano OFF;
  rascunhos e versões históricas nunca alimentam o cálculo combinado.

Aceite: prova sintética de todas as16 combinações dos quatro booleanos de inclusão,
além de vazio, soma multipágina e ausência por nutriente. Resultado independente
de ordem, sem dupla contagem; limites de cardinalidade definidos e testados.
Verificação: unitários de domínio/snapshot/DTO e integração PostgreSQL/RLS com
barreiras de cálculo↔ativação/transferência/save e regressões PA04/PA05.

## T08d — seleção combinada e nutrientes, console/BFF (fatias de2–4 arquivos)

Dependência: T08c e T07. Luna alto após contrato de cálculo fechado por Sol.

- [ ] Seleção explícita de planos ativos publicados e refeições; exibir número/data
  da publicação atual de cada plano, sem seletor de rascunho. Seleção entre páginas
  só em memória, limpa ao trocar paciente/sessão e independente do acesso no portal.
- [ ] Mostrar “Desativado — fora do cálculo” sem apagar seleção; plano OFF
  prevalece, reativação respeita estado de cada refeição. Erro não afirma ACK.
- [ ] Tabela acessível de energia/macros/micros com unidade, fonte/cobertura e
  estado parcial, sem zeros inventados, percentuais DRI ou interpretação automática.
- [ ] Request atrasado, seleção alterada, acesso revogado e toggle não exibem
  totais obsoletos como atuais; portal segue D09 e não recebe seleção do console.

Aceite: cálculo por seleção é planejamento, não consumo nem soma de metas;
keyboard/mobile/desktop, flags e arredondamento coerentes com backend.
Verificação: BFF positivo/negativo e Playwright da seleção e múltiplos planos,
incluindo páginas, OFF/ON, mudança de publicação e versões antigas sem micros.
Rascunho parcial deve ficar fora da soma, mesmo se tiver valores calculáveis.

### Checkpoint C — integração Sol

- [x] Voltar para GPT-6.1 Sol médio com aviso e pausa manual; troca realizada.
- [x] Sem achado estático R4 aberto de perda de edição, conflito silencioso ou authz;
  revisão cruzada da autoria, sem equivalência com revisão humana externa.

## T09 — regressão e revisão R4 (3–5 arquivos por rodada de correção)

Dependência: checkpoint C da entrega atual e suas fatias, conforme sequência
de três PRs no plano. Sol médio; repetir estes gates em cada entrega.

- [ ] Backend/Web lint, typecheck/build e testes proporcionais; banco real integral;
  revisão cruzada estática R4 com limites/autoria e correções em RED/GREEN.
- [x] PA02 cópia, PA03 subtotais/colapso, PA04 listagem e PA05 preferências/preview/
  portal/print; no-op não invalida revisão nem recria filhos.
- [x] Atualizar matriz de confiabilidade/rotas, docs e plano externo de implantação/
  rollback; não confundir merge com schema ou deploy efetivo.

Verificação: `pnpm --dir octaclin-backend test --runInBand`, `typecheck`, `build`;
`pnpm --dir octaclin-web lint`, `typecheck`, `build`, `test:authz`; Playwright
PA06 + `pa02-copia-refeicoes.spec.mjs`, `fase-320-pa05-apresentacao.spec.mjs`,
`portal-paciente.spec.mjs` e regressões PA04/BFF. Usar Node22/pnpm11.25 declarados;
um servidor Next por worktree; não reaproveitar órfão de outro teste.

## T10 — PR individual por entrega e gates do HEAD

Dependência: T09. Sol médio.

- [ ] Uma PR por recurso: autosave parcial → ativação → cálculo combinado.
  Cada uma inclui código/plano/evidências; não criar PR documental separada.
- [ ] `git diff --check`, `pnpm security:secrets`, governança, scanners e CI
  Backend/Web/Demo/PR Gate do HEAD final PASS; SKIPPED justificados.
- [x] Nenhum merge/deploy/migration externa/ativação sem autorização e alvo.

Aceite: relatório de segurança, limitações e sequência operacional explícitos.
Checks de PA05 ou da primeira entrega não provam a próxima entrega PA06.

## Resultado desta rodada documental

- PASS: leitura Git/PR/checks e contratos; referências R013/R014 verificadas.
- PASS: decisões de produto D01–D10 registradas nesta sessão.
- PENDENTE: autorização de implementação; nenhum código ou teste de runtime alterado.
- SKIPPED: testes de implementação, PostgreSQL, lint/build/Playwright de PA06,
  revisão R4 de código PA06 e CI PA06 — runtime não alterado.
- NA: prova de produção nesta análise; nenhum banco externo foi acessado.
- PASS: `git diff --check`, 21 links locais do plano/checklist/handoff sem
  destino ausente e `pnpm security:secrets` com Node22.21.1/pnpm11.25.0.
  Essas verificações documentais não são testes de implementação PA06.


### Primeira entrega — fechamento local de integração

- PASS: Web/backend builds e typecheck; lint Web (69 warnings/zero erros),
  governança/secrets, R4 estática independente da autoria após correções.
- PASS: backend integral329 suítes/2907 testes;6 suítes/113 testes SKIPPED.
  DTO final22/22; PostgreSQL focado12 PASS/31 SKIPPED; BFF29/29; nutrição/
  coordenador/campos38/38; saída4/4; cópia7/7.
- PASS: Playwright final82/82 (41 desktop/41 mobile), incluindo modo manual,
  portal/print, página de planos, cópia, autosave parcial, retry e saída/Axe.
- PENDENTE: conclusão de `test:authz` integral local e CI do HEAD. Banco integral
  Timescale/pgvector não comprovado localmente; não converter SKIPPED em PASS.
- T10: preparar/publicar uma PR Draft desta entrega; acompanhar Backend, Web,
  Demo, governança e scanners antes de propor merge. T08a–T08d fora desta PR.
