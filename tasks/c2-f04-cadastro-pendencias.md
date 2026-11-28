# C2-F04 — alterações pendentes no cadastro

## Escopo, base e risco

Plano aprovado: `cb39c2c5:tasks/plan-ciclo2-login-cadastro-formularios-operacao.md`, seção 9 (F04-C1–C4). Branch `feat/c2-f04-cadastro-pendencias`, base main `0fd46a01`. R4 por PII; mudança de interface e estado volátil, sem alterar autorização, BFF, persistência, FOOD06 ou infraestrutura.

Reaproveitamento explícito: cherry-pick **somente** `c5adf9ba`, correção de seletor exato de título na lista vazia de pacientes, gerou `1455aaa2`. Não integra as implementações F01/F02/F03 nem suas PRs.

## Diagnóstico e contratos

O modal fechava sem conferir alterações. Saves não mantinham referência dos valores confirmados por seção. Identificação possui dois PATCHs independentes, sem transação ou CAS. Fiscal GET inclui `atualizadoEm`, que não pertence ao DTO de escrita. Remover nascimento com `undefined` não remove o dado no servidor.

Reutilizados: Modal, Botao, hook `useProtecaoAlteracoesNaoSalvas`, APIs cadastrais, qualidade e regras de permissão existentes. `obterPaciente` recebeu apenas opção aditiva de cache; abertura usa `no-store` para buscar básicos atuais em vez de props atrasadas da ficha. Demais consumidores mantêm o comportamento padrão. Leituras agrupadas em Promise.all; nenhuma consulta por campo ou polling.

## Implementação

- Baseline normalizada por identificação/básicos, contato, operação e fiscal; hidratação e reversão ao valor original não criam pendência.
- Resumo das seções pendentes, confirmação explícita com Continuar editando/Sair sem salvar. Dados já confirmados permanecem salvos; não oferece Salvar tudo.
- Usa o mesmo diálogo, sem empilhar um segundo trap de foco. Foco inicial seguro, retorno por rótulo público de campo/seção e rolagem; atributos não contêm valores do paciente.
- Fechar/Escape/backdrop e links internos ordinários protegidos; navegação confirmada é consumida uma única vez. Navegação nativa preserva outras proteções beforeunload do prontuário.
- ACK confirma somente o retrato enviado; edição posterior fica pendente. Falha mantém entrada. Leitura de qualidade falha não desfaz o ACK nem deixa dados antigos de qualidade como atuais.
- Básicos confirmados são reconhecidos mesmo se o segundo PATCH falhar; mensagem distingue confirmação parcial. Reabrir consulta os básicos atuais autorizados, evitando reintroduzir dados de props atrasadas.
- Época por abertura + remount por paciente descartam leituras/ACKs antigos do editor. Falha de leitura, identidade divergente ou acesso negado não habilitam escrita com formulário vazio.
- Guardas síncronas serializam saves e operações de portal/LGPD deste editor; campos continuam editáveis durante save. Saída com operação em voo aguarda conclusão.
- Fiscal projeta apenas campos graváveis conhecidos e preserva os permitidos não exibidos. Remoção de nascimento não suportada é recusada antes de escrever, com mensagem honesta e entrada pendente.
- Nenhum rascunho em localStorage/cache/log; nenhuma mudança de prescrição, consentimento, backend, dependência ou schema.

## Evidências e histórico de execução

Node 22.21.1; dados exclusivamente sintéticos.

| Evidência | Resultado e alcance |
| --- | --- |
| RED inicial | 3 falhas funcionais: Escape descartava edição; link mudava paciente; ACK anterior deixava sair com edição posterior |
| GREEN inicial | 10/10: três casos novos e duas regressões, desktop/mobile |
| RED R4 | 2 falhas funcionais: básicos antigos reapareciam após save parcial; navegação era repetida após cancelar beforeunload de outro rascunho |
| RED leitura atual | Básicos atuais divergiam de props antigas; teste exibiu o nome antigo |
| RED foco / viewport | Qualidade removida durante confirmação deslocava o índice de foco; depois, assert de viewport comprovou foco fora da área visível. Ambos corrigidos, sem aumentar timeouts |
| GREEN extras | 6/6 desktop/mobile: acesso negado, identidade divergente e foco após mudança da qualidade |
| Beforeunload existente | 4/4 unitários; não substituem teste de navegador |
| Pacientes BFF Fase254 | 3/3, runtime simulado; não é prova PostgreSQL/RLS |
| Autorização de rotas | 30/30; não é prova de autorização clínica em banco |
| Types/lint/linguagem | PASS finais após encerrar Next: typecheck Web, ESLint afetado sem erros/avisos e linguagem |
| Rodada final navegador | **44/44 PASS**: 34 execuções F04 + 10 regressões de portal/LGPD/tarefa e a11y de pacientes, desktop/mobile; último delta de produção incluído |

Intermediários substituídos: 26 PASS/2 FAIL por harness que aguardava `load` após cancelar reload; corrigido para avaliar reload e aguardar o próprio diálogo, sem aumentar timeout. Uma tentativa de retomada do runner iniciou Turbopack incompatível com symlink e falhou no setup; não foi RED funcional. Reiniciado somente o servidor desta worktree com webpack/Node22, sem alterar configuração ou dependências. Outra rodada teve 29 PASS/1 FAIL durante carregamento anterior ao formulário fiscal mobile, com Next/compilações sobrepostas; permanece FAIL dessa rodada e exige confirmação na rodada final. Nenhum desses resultados aprova o HEAD final por inferência.

## Revisão e UX

R4 independente `/root/c2_f04_r4`: somente leitura, sem execução própria de testes e sem dados reais. Dois P2 reproduzidos/corrigidos e variante de respostas sobrepostas resolvida por leitura autorizada atual. Parecer final estático: sem achados reproduzíveis pendentes no escopo. Correção posterior de foco também conferida pelo revisor, favorável.

Personas independentes `/root/c2_f04_nux_a` e `/root/c2_f04_pux_a`, papel explícito, sem histórico nem ferramentas usadas. Não comprova seleção nativa de TOML ou isolamento técnico próprio. Relatórios/sínteses e manifesto em `docs/agents/ux/reports/C2-F04-ABC-2026-11-25/`. A/B baseadas em proposta e relatos sanitizados; coordenador inspecionou captura real. C final favorável por relato; recebeu adendo 44/44, com foco e visibilidade comprovados, sem prometer preservação pixel a pixel de scroll. Sem pesquisa com pessoas ou validação clínica.

## Limites, rollback e gates

- **Sem garantia de interceptar Back/Forward SPA, redirects programáticos ou encerramento de sessão.** Não manipula histórico nem cria rascunho ao sair da sessão.
- Beforeunload depende do suporte e da interação prévia do navegador. Testes Chromium desktop/mobile não provam todos os navegadores.
- Sem CAS entre profissionais e sem atomicidade entre PATCHs; não promete salvar tudo, cancelar requisição já enviada ou desfazer gravação confirmada.
- Remover nascimento exige contrato posterior, não realizado aqui. Outros erros por campo pertencem à F05.
- Operações portal/LGPD conservam contratos anteriores. Proteção de saída não equivale a novo protocolo de cancelamento/revogação de comandos já aceitos.
- Leitor de tela manual NOT RUN. Axe/teclado/zoom não são prova de experiência assistiva completa.
- Build local SKIPPED por limite de disco (aproximadamente 300 MB livres nesta rodada). Build e scanners oficiais dependem do CI do HEAD enviado; nenhum PASS de outra PR é herdado.
- PostgreSQL/RLS local NA: nenhuma implementação de consulta, persistência ou autorização do backend alterada. Browser interceptado não prova banco.
- Suítes globais locais SKIPPED: seleção proporcional das superfícies afetadas; CI continua obrigatório.

Rollback: reverter exclusivamente o código deste incremento pelo fluxo de PR, sem apagar/restaurar dados. Writes cadastrais já confirmados não são revertidos por rollback visual. Sem migration, configuração, merge ou deploy.

## Matriz F04

| Critério | Evidência | Estado |
| --- | --- | --- |
| F04-C1 — limpo/alterado por seção | Baselines, hidratação, reversão, quatro seções | PASS local |
| F04-C2 — saídas suportadas | Fechar/Escape/link, descarte/cancelar, beforeunload | PASS local nas saídas suportadas; limites acima |
| F04-C3 — save/erro/ACK/contexto | Parcial, edição posterior, leitura antiga, básicos atuais, acesso negado | PASS local |
| F04-C4 — browser/UX/regressões | 44/44 desktop/mobile, Axe, R4 estática e personas | PASS local automatizado; CI/build/revisão formal pendentes; leitor de tela manual NOT RUN |

Próxima entrega prevista: F05, erros de cadastro associados aos campos, conforme plano aprovado. Não executada neste incremento. Preservar Claude/FOOD06 e demais worktrees.

## Checkpoint de entrega

Código funcional e testes no commit `3005c6c1`; pré-requisito isolado `1455aaa2`.
Nenhuma alteração de produção após os 44/44 PASS e a conferência R4 final. Guardas
AGENTS/next-env geradas pelo Next foram restauradas somente quando correspondiam
exatamente à transformação esperada, após parar o servidor próprio. Não são parte
da implementação. SHA256 dos arquivos avaliados em `hashes.sha256` no relatório UX.

PASS adicionais: matriz de acessibilidade 20/20, matriz de confiabilidade
(40 referências válidas), tooling de agentes 12/12 e papéis UX Python 5/5.
Varredura de secrets sobre a worktree completa PASS; inclui os arquivos
intencionalmente staged, sem alegar detecção universal de segredos. `git diff
--check` PASS. Builds locais e suítes globais seguem SKIPPED pelos motivos acima.
Nenhum teste cancelado, setup falho ou evidência histórica contado como PASS final.

Reprodução da rodada final no Web, com servidor webpack Node22 já iniciado:

```bash
E2E_WEB_URL=http://localhost:3335 E2E_REUSE_EXISTING_SERVER=true node node_modules/@playwright/test/cli.js test tests/visual/console-regression.spec.mjs tests/visual/acessibilidade.spec.mjs --grep 'C2-F04|revisa qualidade cadastral|distingue desativar conta|preserva foco e tarefa|lista - estado vazio|cadastra paciente, preserva foco' --output=/tmp/c2-f04-entrega --reporter=list
```

`node` neste comando representa Node 22.21.1. `--webpack` pertence ao servidor,
não à configuração/dependência do projeto. Não altera o workflow para contornar
symlink ou falha de testes. Relatórios/traces/capturas de teste são somente
sintéticos; os resultados duráveis estão neste handoff, sem versionar artefatos
binários ou registros clínicos.

PR Draft independente para main. CI/build/scanners do HEAD enviado ainda pendentes
antes da criação; consultar o HEAD remoto, sem herdar PASS das #593–#595. Este
checkpoint não autoriza retirar Draft, merge ou operação externa.
