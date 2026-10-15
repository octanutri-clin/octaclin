# PA06 — checklist de implementação

Planejamento: [plan-pos-320-pa06.md](plan-pos-320-pa06.md).
Base `eae74b1e`, 2026-10-15. Somente T00 executada nesta rodada documental.

## T00 — base, evidência e produto (1–3 documentos)

- [x] Merge #419 e árvore iguais ao HEAD aprovado; CI/checks aplicáveis PASS.
- [x] Preservar worktrees e criar branch dedicada a partir de origin/main.
- [x] Ler contratos FND02/PA02–PA05 e pesquisar só R013/R014 fixados no plano.
- [x] Registrar gaps, referências, risco R4, gates e sequência de modelos.
- [ ] Incorporar respostas D01, D02, D03; sem resposta não presumir recomendação aceita.
- [ ] Receber autorização de implementação; não iniciar T01–T10 automaticamente.

## T01 — testes RED e contrato de revisão geral (2–4 arquivos)

Dependência: T00 e autorização. Sol médio.

- [ ] Reproduzir resposta A sobrescrevendo edição B em Promise controlada.
- [ ] Reproduzir PUT legado que altera conteúdo sem incrementar revisão PA05.
- [ ] Fixar DTO/retorno de revisão geral, geração e transição de clientes antigos;
  proteger rascunho aderido contra PUT sem precondição sem alterar dados antigos.

Aceite: RED do comportamento e contrato inequívoco de novos/legados, sem usar
timestamp como versão nem mudar a semântica do contador de apresentação.
Verificação: testes focados de serviço e motor de gravação, estado anterior falha.

## T02 — persistência de revisão e migration aditiva (3–5 arquivos)

Dependência: T01. Sol médio.

- [ ] Criar revisão monotônica e adesão protegida mínima em versão; registro e DTO.
- [ ] Conferir todos os writers de rascunho/transições, compatibilidade, overflow,
  clones e preservação de hash/snapshot publicado; nenhuma escrita parcial.
- [ ] Migration nova com testes e registro; próximo número revalidado, nunca editar1072.

Aceite: precondição checada sob lock antes dos filhos; erro não avança revisão;
desligar autosave não reabre legado inseguro; rollback não perde histórico.
Verificação: serviço/DTO/migration/clone/hash unitários e integridade do inventário.

## T03 — preferência própria, caso D01 persistente (3–5 arquivos)

Dependência: T02, D01. Sol médio. Se apenas sessão, registrar NA desta persistência.

- [ ] Booleano default false no vínculo profissional; reaproveitar migration
  aditiva da fase antes de integrá-la, sem tabela/perfil genérico.
- [ ] GET/PUT próprio com papel, permissão e vínculo ativo; não aceitar alvo no body.
- [ ] Isolar tenant/usuário e retornar só preferência; erro não afirma persistência.

Aceite: profissional não lê/altera colega, gestor/SuperAdmin não impersonam;
cadastro antigo continua desligado; falha de leitura não ativa autosave.
Verificação: DTO/serviço/controlador e testes negativos de autorização.

## T04 — prova PostgreSQL/RLS/concorrência (2–4 arquivos)

Dependência: T02/T03. Sol médio. Banco descartável com fixtures próprias.

- [ ] Save/save com mesma revisão: um sucesso e um409; replay e geração antiga negados.
- [ ] Writers PA05/legados↔PA06, adesão monotônica e save↔revisão/publicação;
  tenant/carteira/transferência/arquivamento/revogação, sem bypass de RLS.
- [ ] Conferir FORCE RLS/role runtime; preferência própria no banco real, se aplicável;
  executar também casos adjacentes PA04/PA05 para não esconder contaminação.

Aceite: provas com PostgreSQL real e barreiras explícitas, sem depender de sleeps.
Verificação: `pnpm --dir octaclin-backend test:rls:testcontainers`; gate integral
não pode virar PASS por fixture que omite Timescale/pgvector.

### Checkpoint A — contrato antes da UI

- [ ] T01–T04 GREEN e limitações documentadas; backend completo tipado e buildável.
- [ ] Nenhuma alteração publicada a pacientes; produção/migrations externas SKIPPED.

## T05 — coordenador em memória (2–4 arquivos)

Dependência: checkpoint A. Sol médio.

- [ ] Extrair regras puras mínimas sem reescrever o editor; debounce3s, um request,
  pendente mais recente, snapshot A/edição B, retorno obsoleto e StrictMode.
- [ ] Integrar save manual no mesmo coordenador; cópia/IME/inválido não dispara;
  manter baseline confirmado, chaves locais/foco e dirty até último ACK.
- [ ] Rede incerta,401/403/404,400/422 e409 pausam conforme plano; sem retry/flush
  no unmount, reconexão, foco, beacon ou persistência em navegador.

Aceite: timers/Promises determinísticos comprovam que não se perde B nem se
declara Salvo enquanto existe pendência; não há fila crescente de snapshots.
Verificação: unitários executáveis do motor e validação; novo script registrado
na suíte/CI existente, sem testes órfãos.

## T06 — BFF e cliente (3–5 arquivos)

Dependência: T05. Sol médio.

- [ ] Repassar DTO e revisão pelo PUT existente; retorno mínimo e no-store.
- [ ] Preferência própria autenticada, se D01; catálogo de permissões e mapa de rotas.
- [ ] Preservar status de conflito/acesso e mensagens sanitizadas, sem entidade crua.

Aceite: sessão/tenant vêm do servidor; falhas de preferência ou save não viram200.
Verificação: testes específicos em `test-planos-alimentares-bff.mjs`, negativos
da preferência e `pnpm --dir octaclin-web test:authz` na integração final.

### Checkpoint B — troca opcional para Luna

- [ ] T05–T06 GREEN; DTOs, motor e fixtures fechados, handoff atualizado.
- [ ] Avisar “GPT-6 Luna alto” e pausar para troca manual; não assumir alteração.

## T07 — controles e estados acessíveis (2–4 arquivos)

Dependência: checkpoint B, D01/D02. Luna alto suficiente.

- [ ] Opt-in, status e ações de reconferência/erro em desktop/mobile; teclado/aria-live.
- [ ] Salvar manual permanece; preservar metas/subtotais, PA05, colapso e chaves
  durante edição simultânea ao request; opção desligada não faz flush implícito.
- [ ] Diferenciar pendente inválido, falha, conflito e envio incerto sem roubar foco.

Aceite: todos os estados têm texto e comportamento verificáveis; não publicar
nem revisar automaticamente; nenhum vazamento em cache/URL/telemetria.
Verificação: Playwright novo `tests/visual/pa06-autosave.spec.mjs` com Axe/teclado.

## T08 — saída interna e transições (2–4 arquivos)

Dependência: T07, D03. Luna alto com contrato já fechado por Sol.

- [ ] Integração com `prontuario-paciente.tsx` só se D03 aprovada; manter guardas
  de outros editores e beforeunload FND02; navegação só após confirmação atual.
- [ ] Troca de paciente/plano/geração invalida timers/respostas; nova versão,
  cópia, revisão/publicação e arquivo não compartilham request pendente indevido.
- [ ] Salvar e sair não descarta outras pendências; erro409/rede mantém a tela.

Aceite: nenhum POST/PUT de cleanup, nenhum “Salvo” após troca e nenhum save
recebido pelo paciente errado. Guardas existentes continuam cobertas.
Verificação: navegação de abas/agenda/voltar e refresh, erros e request atrasado
em Playwright; `pnpm --dir octaclin-web test:proteger-alteracoes-nao-salvas`.

### Checkpoint C — integração Sol

- [ ] Voltar para GPT-6.1 Sol médio com aviso e pausa manual.
- [ ] Sem achado aberto de perda de edição, conflito silencioso ou authz.

## T09 — regressão e revisão R4 (3–5 arquivos por rodada de correção)

Dependência: checkpoint C. Sol médio.

- [ ] Backend/Web lint, typecheck/build e testes proporcionais; banco real integral;
  revisão cruzada estática R4 com limites/autoria e correções em RED/GREEN.
- [ ] PA02 cópia, PA03 subtotais/colapso, PA04 listagem e PA05 preferências/preview/
  portal/print; no-op não invalida revisão nem recria filhos.
- [ ] Atualizar matriz de confiabilidade/rotas, docs e plano externo de implantação/
  rollback; não confundir merge com schema ou deploy efetivo.

Verificação: `pnpm --dir octaclin-backend test -- --runInBand`, `typecheck`, `build`;
`pnpm --dir octaclin-web lint`, `typecheck`, `build`, `test:authz`; Playwright
PA06 + `pa02-copia-refeicoes.spec.mjs`, `fase-320-pa05-apresentacao.spec.mjs`,
`portal-paciente.spec.mjs` e regressões PA04/BFF. Usar Node22/pnpm11.25 declarados;
um servidor Next por worktree; não reaproveitar órfão de outro teste.

## T10 — PR única e gates do HEAD

Dependência: T09. Sol médio.

- [ ] Uma PR com código/plano/evidências; não criar PR documental separada.
- [ ] `git diff --check`, `pnpm security:secrets`, governança, scanners e CI
  Backend/Web/Demo/PR Gate do HEAD final PASS; SKIPPED justificados.
- [ ] Nenhum merge/deploy/migration externa/ativação sem autorização e alvo.

Aceite: relatório de segurança, limitações e sequência operacional explícitos.
Checks de PA05 não provam implementação PA06.

## Resultado desta rodada documental

- PASS: leitura Git/PR/checks e contratos; referências R013/R014 verificadas.
- PENDENTE: D01–D03 e autorização de implementação.
- SKIPPED: testes de implementação, PostgreSQL, lint/build/Playwright de PA06,
  revisão R4 de código PA06 e CI PA06 — runtime não alterado.
- NA: prova de produção nesta análise; nenhum banco externo foi acessado.
- PASS: `git diff --check`, 21 links locais do plano/checklist/handoff sem
  destino ausente e `pnpm security:secrets` com Node22.21.1/pnpm11.25.0.
  Essas verificações documentais não são testes de implementação PA06.
