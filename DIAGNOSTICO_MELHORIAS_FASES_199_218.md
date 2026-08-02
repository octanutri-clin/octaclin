# OctaClin - Diagnostico de melhorias e roadmap das Fases 199 a 218

Criado em 2026-08-01, apos a conclusao da Fase 197. A Fase 198 (validacao
final de usabilidade e consolidacao visual) foi aceita pelo usuario em
2026-08-02 e encerrada no `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.

Este arquivo e um **diagnostico tecnico e de produto**, nao um substituto do
roadmap. Ele complementa:

- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`: roadmap vivo, fonte de verdade da ordem.
- `ESCOPO_SKILLS_AGENTES_FASES_191_198.md`: mesma estrutura, bloco anterior.
- `TESTES_E_VALIDACOES.md`: nenhum comando de validacao aqui substitui os de la.
- `DECISOES_ARQUITETURA.md`: decisoes marcadas abaixo como "registrar decisao"
  devem ir para la quando tomadas.

## Como este diagnostico foi produzido

Analise executada em 2026-08-01 sobre o codigo real (nao apenas documentacao),
com tres agentes em paralelo:

| Agente | Modelo | Escopo |
| --- | --- | --- |
| Auditoria de design (general-purpose + skills `web-design-guidelines` e `frontend-design`) | opus | Sistema visual, tokens, componentes compartilhados, hierarquia |
| `ecc:react-reviewer` | sonnet | Correcao React, data fetching, bundle, estados de UI |
| `ecc:architect` | opus | Lacunas funcionais de dominio, fricoes operacionais, riscos de arquitetura |

Cada achado abaixo cita arquivo e linha verificados na leitura, nao suposicao.

As referencias `ecc:*` identificam skills e agentes exclusivos do ambiente
Claude Code usado na auditoria original. Elas devem ser preservadas para esse
ambiente e nao implicam instalacao, substituicao ou mapeamento no Codex.

## Criterio de prioridade

Ordenacao por **(valor para o cliente pagante ou risco evitado) dividido por
esforco**, com tres regras duras que sobrepoem qualquer nota:

1. O que **quebra uso real hoje** vem antes do que e desejavel.
2. O que **cobra caro depois** (dado, dinheiro, mensagem duplicada) vem antes
   de estetica.
3. O que e **barato e muda percepcao do produto inteiro** vem antes do que e
   caro e muda uma tela.

Por isso a ordem sugerida na analise original (199 -> 202 -> 201 -> 200 -> 205)
foi renumerada: cada fase recebeu o numero correspondente a sua posicao real de
prioridade, como pedido. O mapa de renumeracao esta no Anexo C.

## Visao geral

| Fase | Titulo | Bloco | Origem do achado | Esforco | Risco se adiar |
| --- | --- | --- | --- | --- | --- |
| 199 | Busca, filtros e paginacao server-side | A | Bloco 1 + 4 | Medio | Alto |
| 200 | Upload seguro e anexos clinicos | A | Bloco 1 + 4 | Medio | Alto |
| 201 | Confiabilidade dos processadores em multiplas instancias | A | Bloco 1 + 4 | Medio | Alto |
| 202 | Sistema visual: tokens, tipografia e elevacao | B | Bloco 2 | Baixo | Medio |
| 203 | Componentes compartilhados e fim dos sistemas paralelos | B | Bloco 2 | Medio | Medio |
| 204 | Data fetching, resiliencia e code splitting | B | Bloco 3 | Medio | Medio |
| 205 | Recall automatico de retorno | C | Bloco 4 | Baixo | Baixo |
| 206 | Teleconsulta por link na consulta | C | Bloco 4 | Baixo | Medio |
| 207 | Antropometria e evolucao de medidas | C | Bloco 4 | Alto | Alto |
| 208 | Documentos clinicos gerados | C | Bloco 4 | Medio | Medio |
| 209 | Financeiro da consulta e pacote de sessoes | C | Bloco 4 | Medio | Alto |
| 210 | Notificacoes in-app e tempo real | D | Bloco 4 | Medio | Medio |
| 211 | Importacao em massa e exportacoes | D | Bloco 4 | Medio | Alto |
| 212 | Desfazer, lixeira e restauracao | D | Bloco 4 | Baixo | Medio |
| 213 | Command palette e atalhos de teclado | D | Bloco 4 | Baixo | Baixo |
| 214 | Refatoracao dos monolitos | E | Bloco 3 | Alto | Medio |
| 215 | Performance de backend | E | Bloco 4 | Medio | Medio |
| 216 | Plano alimentar e calculo nutricional (MVP) | E | Bloco 4 | Alto | Alto |
| 217 | PWA do portal do paciente | E | Bloco 4 | Medio | Baixo |
| 218 | API publica, chaves por tenant e webhooks | E | Bloco 4 | Alto | Medio |

Blocos: **A** = bloqueadores; **B** = percepcao e saude do frontend;
**C** = valor comercial direto; **D** = operacao diaria; **E** = divida tecnica
e expansao.

---

# Bloco A - Bloqueadores

Nada de estetica antes destas tres. Duas quebram uso real com massa de dados e
uma permite cobranca burlada.

## Fase 199 - Busca, filtros e paginacao server-side

**Como esta hoje**

`octaclin-web/lib/cadastros-api.ts:91` sempre chama
`/api/pacientes?pagina=1&limite=25`. O componente
`octaclin-web/components/cadastros/lista-pacientes.tsx:252` filtra em memoria
sobre esses 25 registros. E
`octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.ts:64`
nao aceita termo de busca nenhum: apenas ordena por `criadoEm DESC`.

O mesmo padrao de `limite=25` fixo existe em `/api/profissionais`
(`cadastros-api.ts:113`) e `/api/questionarios`
(`octaclin-web/lib/questionarios-api.ts:268`). A UI tambem nao tem controle de
pagina nem "carregar mais", embora o backend ja devolva `total`.

**Problema**

Numa clinica com 200 pacientes, o 26o paciente e inalcancavel pela interface, e
a caixa de busca responde "nao encontrado" para alguem que existe no banco. Isso
nao e lentidao: e **perda de acesso a dados que o cliente pagou para armazenar**.

Agravante: qualquer demonstracao comercial com a massa realista de staging
(`RUNBOOK_STAGING_DADOS.md`) expoe o defeito na primeira busca. E o achado mais
caro do diagnostico inteiro.

Existe uma causa raiz por tras: `paciente.nomeCriptografado` e `bytea`
(`octaclin-backend/src/modulos/pacientes/infraestrutura/paciente.orm.ts:17`),
entao `ILIKE` e `pg_trgm` sao impossiveis e a busca por nome exigiria decifrar
em memoria. A gambiarra client-side atual nasceu exatamente dessa restricao nao
resolvida.

**Solucao**

1. Decidir e registrar em `DECISOES_ARQUITETURA.md` a estrategia de busca sobre
   PII cifrada. Recomendacao: **indice cego** com HMAC de tokens normalizados
   (minusculo, sem acento, sem pontuacao), armazenando hashes separados dos
   tokens e dos prefixos explicitamente suportados. Um HMAC do nome completo
   permite apenas igualdade e, sozinho, nao permite busca parcial. Definir
   tamanho minimo/maximo dos prefixos para limitar enumeracao e crescimento do
   indice. Alternativa inferior: coluna de busca derivada em claro apenas com
   iniciais.
2. Mover busca, filtros (risco, status, profissional responsavel) e ordenacao
   para `servico-pacientes.listar`, **preservando o escopo por profissional
   responsavel** (`pacientes_responsaveis`) ja validado desde a Fase 130.
3. Adicionar paginacao real na UI de pacientes, profissionais e formularios,
   consumindo o `total` que o backend ja retorna.
4. Substituir o carregamento sem teto de `servico-pacientes.ts:87-92`, que hoje
   carrega **todas** as consultas historicas dos 25 pacientes da pagina so para
   calcular "ultima concluida" e "proxima", por duas agregacoes com `LIMIT 1`.
5. Persistir filtros na URL, seguindo o padrao ja adotado na Fase 193.

**Skill**

- `ecc:postgres-patterns`: indice cego, `pg_trgm`, estrategia de indexacao.
- `ecc:database-migrations`: coluna de busca e backfill dos registros existentes.
- `superpowers:writing-plans`: a decisao de indice cego afeta modelo de dados e
  precisa de plano escrito antes de codar.
- `superpowers:test-driven-development`: baseline do `AGENTS.md`.

**Agente**

- `ecc:database-reviewer` (**opus**): a decisao de indice cego e arquitetural e
  irreversivel na pratica; erro aqui vaza PII ou inviabiliza a busca de novo.
- `ecc:security-reviewer` (**opus**): indice cego e uma superficie nova sobre
  dado cifrado; precisa confirmar que nao permite enumeracao nem inferencia.
- `ecc:e2e-runner` (**sonnet**): jornada de busca com massa de staging.

**Outros**

- Criterio de aceite: com 500 pacientes sinteticos, busca por nome parcial
  retorna o paciente correto na primeira tela em menos de 1s; filtros persistem
  na URL; nenhum resultado fora do escopo do profissional aparece.
- Backfill da coluna de indice cego precisa de migration com janela planejada.
  Anotar em `RUNBOOK_PRODUCAO.md` junto com a regra de
  `BANCO_EXECUTAR_MIGRACOES=false`.
- Esta fase destrava a 211 (importacao em massa): importar 200 pacientes sem
  busca funcional so aumenta o problema.

---

## Fase 200 - Upload seguro e anexos clinicos

**Como esta hoje**

Em `octaclin-backend/src/modulos/mobile/aplicacao/servico-mobile.ts:79-92` a URL
de upload e uma concatenacao simples
(`${uploadBaseUrl}/${bucket}/${chaveObjeto}`), sem assinatura e sem expiracao. E
em `octaclin-backend/src/modulos/mobile/aplicacao/dtos.ts:28-50`, os campos
`tamanhoBytes`, `mimeType` e `hashConteudo` vem do DTO enviado pelo cliente.

A entidade `arquivos_midia`
(`octaclin-backend/src/modulos/mobile/infraestrutura/arquivo-midia.orm.ts`)
existe, mas esta amarrada a midia do diario do paciente e so aparece na area
administrativa Mobile/Operacoes, via `listarArquivosMidia` com `take: 50` fixo e
sem filtro por paciente. Nao ha nenhuma superficie de anexo no prontuario.

**Problema**

Tres consequencias, em ordem de gravidade:

1. **A cota de armazenamento e declarada pelo proprio cliente.** O limite
   `armazenamentoMb` de
   `octaclin-backend/src/modulos/clientes/dominio/planos-saas.ts` e alimentado
   por um numero que vem no request. Trocar esse numero contorna o bloqueio
   suave de plano da Fase 102. Cobranca e limite viram decorativos.
2. **Nada garante que o objeto foi gravado.** O registro em banco pode apontar
   para um objeto inexistente, e o erro so aparece quando alguem tenta abrir.
3. **O profissional nao tem onde guardar exame.** Hemograma chega por WhatsApp e
   fica no WhatsApp. Ticket de suporte na primeira semana de uso real.

**Solucao**

1. Substituir a URL concatenada por **presigned URL** com expiracao curta,
   gerada no backend, e **confirmacao server-side** apos o upload: o backend
   consulta o objeto (HEAD) e so entao marca o anexo como valido.
2. Derivar `tamanhoBytes`, `mimeType` e hash do **objeto real**, nunca do DTO, e
   recalcular o consumo de `armazenamentoMb` a partir dessa fonte.
3. Criar area de anexos por paciente no prontuario: upload, categoria
   (exame / documento / foto), visualizacao, exclusao auditada.
4. Expor no prontuario as midias que o paciente ja envia via formulario
   (`upload_midia`) e diario rapido, hoje visiveis apenas em Operacoes.
5. Manter escopo por profissional responsavel e criptografia coerente com o
   padrao ja usado em evolucoes clinicas.

**Skill**

- `ecc:security-review`: fronteira de upload e classicamente explorada
  (path traversal, content-type spoofing, upload de executavel).
- `ecc:healthcare-phi-compliance`: exame e PHI; retencao e exclusao precisam
  respeitar as politicas ja criadas nas Fases 117-119.
- `ecc:backend-patterns`: padrao de presign e confirmacao.
- `superpowers:test-driven-development`.

**Agente**

- `ecc:security-reviewer` (**opus**): e o achado de seguranca do diagnostico;
  precisa de raciocinio de ameaca, nao checklist.
- `ecc:healthcare-reviewer` (**sonnet**): integridade de dado clinico anexado.
- `ecc:silent-failure-hunter` (**sonnet**): upload que falha em silencio e pior
  que upload que erra alto.

**Outros**

- Criterio de aceite: upload sem confirmacao nao conta cota nem aparece no
  prontuario; metadado forjado no cliente nao altera consumo; exclusao gera
  evento de auditoria; escopo por profissional respeitado.
- **Nao liberar anexo de exame para clientes reais antes desta fase.** Habilitar
  a funcionalidade sobre o mecanismo atual multiplica o volume de dados sob um
  controle de cota que nao funciona.
- Depende de definir o provedor de objeto (bucket) em producao. Se ainda nao
  houver, registrar como pendencia operacional junto com a Fase 132 (dominio).

---

## Fase 201 - Confiabilidade dos processadores em multiplas instancias

**Como esta hoje**

Quatro processadores com `@Cron` rodando dentro do processo web:

| Arquivo | Intervalo |
| --- | --- |
| `processador-outbox-comunicacoes.ts:22` | 30 segundos |
| `processador-agendamentos.ts:16` | 1 minuto |
| `processador-lembretes-agenda.ts:16` | 5 minutos |
| `processador-renovacao-google-calendar.ts:33` | 3 horas |

Nao ha lock distribuido, nao ha `FOR UPDATE SKIP LOCKED` na selecao de
pendentes, e nao ha variavel de ambiente que separe processo worker de processo
web. Alem disso, `ProcessadorOutboxComunicacoes.processarPendentes()` faz `find`
de todos os tenants ativos e abre uma transacao por tenant, **em serie**.

Ha ainda `BullModule.forRoot()` declarado duas vezes
(`modulo-agenda.ts:47` e `modulo-comunicacoes.ts:27`) e `ScheduleModule.forRoot()`
tambem duas vezes (`modulo-agenda.ts:49` e `modulo-questionarios.ts:25`).

**Problema**

No dia em que o Render subir para duas instancias de backend, as duas leem o
mesmo evento pendente e o paciente recebe **WhatsApp e e-mail duplicados** — com
custo por mensagem cobrado pela Meta. E um bug que nao aparece em nenhum teste
local de instancia unica e so se manifesta em producao, sob carga, no pior
momento possivel.

Secundario mas real: a varredura O(tenants) a cada 30 segundos nao fecha a
janela com algumas centenas de tenants, e um tenant lento atrasa todos os
outros. O BullMQ ja esta no projeto e em producao; o outbox deveria enfileirar,
nao varrer.

O `forRoot()` duplicado significa que qualquer mudanca de conexao Redis precisa
ser feita em dois lugares, e a divergencia e silenciosa.

**Solucao**

1. Trocar a varredura por tenant do outbox por **enfileiramento em BullMQ**,
   mantendo o cron apenas como reconciliador de eventos orfaos.
2. Adicionar lock distribuido (Redis) ou `FOR UPDATE SKIP LOCKED` na selecao de
   eventos pendentes e de lembretes.
3. Consolidar `BullModule.forRoot()` e `ScheduleModule.forRoot()` num unico
   modulo de infraestrutura.
4. Introduzir separacao de papel do processo por variavel de ambiente
   (`OCTACLIN_PAPEL_PROCESSO=web|worker`), documentada em
   `VARIAVEIS_AMBIENTE.md` e `RUNBOOK_PRODUCAO.md`.
5. Adicionar gate de pipeline que compare migrations aplicadas contra as
   presentes no artefato, fechando o procedimento manual herdado da Fase 197
   (migrations `1011` e `1012` quando `BANCO_EXECUTAR_MIGRACOES=false`).

**Skill**

- `ecc:redis-patterns`: lock distribuido, idempotencia, BullMQ.
- `ecc:nestjs-patterns`: consolidacao de `forRoot()` e separacao web/worker.
- `ecc:postgres-patterns`: `FOR UPDATE SKIP LOCKED`.
- `superpowers:test-driven-development`: o teste de corrida entre dois
  consumidores e o entregavel central desta fase.

**Agente**

- `ecc:architect` (**opus**): a escolha entre lock Redis e `SKIP LOCKED` tem
  consequencia operacional de longo prazo.
- `ecc:database-reviewer` (**opus**): selecao concorrente sob RLS por tenant.
- `ecc:silent-failure-hunter` (**sonnet**): evento orfao nao pode sumir da fila.

**Outros**

- Criterio de aceite: com **duas instancias simultaneas em staging**, o mesmo
  evento pode ser entregue novamente pela fila, mas produz no maximo um efeito
  externo observavel, comprovado por chave de idempotencia, deduplicacao
  persistente e teste automatizado de corrida entre dois consumidores. Nao
  prometer semantica absoluta de `exactly once` para provedores externos.
- **Gate tecnico explicito: nao escalar o Render para mais de uma instancia de
  backend antes desta fase.** Registrar esse bloqueio em
  `CHECKLIST_GO_LIVE.md` e `RUNBOOK_PRODUCAO.md`.
- Correcao de registro: o debito de "rate limiting em memoria" listado no
  `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` (Fase 121) **ja foi quitado** —
  `octaclin-backend/src/modulos/auth/aplicacao/servico-protecao-abuso.ts` usa
  Redis com script Lua atomico. Atualizar a observacao da Fase 121.

---

# Bloco B - Percepcao e saude do frontend

Tres fases baratas que mudam a percepcao do produto inteiro. A 202 e a de maior
retorno absoluto do roadmap: dois arquivos, zero mudanca em componente.

## Fase 202 - Sistema visual: tokens, tipografia e elevacao

**Como esta hoje**

Contagem real no repositorio, nao impressao:

| Sintoma | Medida |
| --- | --- |
| Escala tipografica | 458 `text-sm` + 362 `text-xs` contra 11 `text-2xl`, 7 `text-lg`, 4 `text-xl` |
| Peso | 316 `font-semibold` contra 102 `font-medium` |
| Elevacao | 5 `shadow-sm`, 3 `shadow-lg` no app inteiro |
| Respiro | 234 `gap-2`, 200 `gap-3`, 130 `gap-1` contra 78 `gap-4`, 3 `gap-5`, 2 `gap-6` |
| Numeros tabulares | 0 ocorrencias de `tabular-nums` |
| Raios | 286 `rounded-md`, 41 `rounded-lg`, 33 `rounded-sm`, sem regra de aninhamento |

Pontos especificos:

- `octaclin-web/components/ui/cartao.tsx:28`: o titulo do cartao e
  `text-sm font-semibold`, exatamente o mesmo tamanho do corpo dentro dele.
- `octaclin-web/components/ui/cartao.tsx:6`: o cartao e
  `rounded-lg border border-linha bg-white`. Fundo `#F7F8FA`, linha `#D9DEE8` —
  cerca de 3% de diferenca de luminancia.
- `octaclin-web/components/app/portal-shell.tsx:153`: item ativo `#EAF3F7`,
  hover `#EEF3F6` — 1,5% de diferenca. O usuario nao sabe onde esta.
- `octaclin-web/app/globals.css:38-41` define outline global de 3px, e depois
  `botao.tsx:23`, `campo.tsx:8`, `abas.tsx:62`, `portal-shell.tsx:152` e
  `modal.tsx:88` redefinem o proprio. Dois sistemas de foco brigando.
- `octaclin-web/tailwind.config.ts:33-37`: raio maximo de 8px, sem escala de
  espacamento custom, sem sombras custom, `plugins: []`.
- `octaclin-web/components/agenda/agenda-semanal.tsx:92-96`: `classeConsulta`
  tem **duas** cores para os **cinco** status do dominio
  (`painel-dashboard.tsx:48`: agendada, reagendada, concluida, falta, cancelada).
  Sem indicador de "agora", sem hairline de meia hora, sem distincao entre
  passado e futuro.
- `octaclin-web/app/layout.tsx:6-18`: Figtree (headings) + Noto Sans (corpo).
- `octaclin-web/components/app/console-shell.tsx:103`: a marca e o icone
  `UsersRound` do Lucide dentro de um quadrado azul. Nao ha logotipo.

**Problema**

Sem salto tipografico nao existe hierarquia, e sem hierarquia o olho le tudo
como formulario. Quando 316 elementos sao semibold, nada se destaca — peso virou
substituto de hierarquia. Cartao sem elevacao sobre fundo quase igual e a
assinatura visual de painel administrativo interno.

Em software clinico especificamente, coluna de numeros que balanca (sem
`tabular-nums`) e o sinal mais direto de "nao passou por designer".

E a agenda — a tela mais usada do produto — e a mais crua: funcionalmente
correta, visualmente inerte.

**Solucao**

Trocar a base, sem tocar em componente. Os nomes de token existentes sao
preservados (`linha` tem 348 usos, `text-tinta` 195, `bg-white` 163), entao
**apenas os valores mudam e nada quebra**:

1. `octaclin-web/app/globals.css`: introduzir camada de CSS variables semanticas
   (`--superficie-base`, `--linha-base`, `--texto-corpo`, `--anel-foco`), escala
   neutra fria (matiz ~235, croma ~0.008 — cinza puro e o que faz interface
   parecer nao desenhada), `tabular-nums` global para tabela/time, foco unico em
   anel duplo (offset branco + halo) e `prefers-reduced-motion`.
2. `octaclin-web/tailwind.config.ts`: escala tipografica com entrelinha
   corrigida (o ajuste de maior retorno, sem sobrescrever os 820 usos de
   `text-sm`/`text-xs`), escala de raio 6/8/12/16, sombras em duas camadas
   **tingidas com a tinta e nao preto puro** (sombra preta sobre fundo frio
   parece suja), espacamentos semanticos (`campo`, `cartao`, `secao`) e escala
   completa de primaria e neutro.
3. `ui/cartao.tsx:6`: trocar `border border-linha` por `shadow-cartao` (anel de
   1px embutido + duas camadas). Uma linha, cerca de 20 telas herdam.
4. `ui/cartao.tsx:28,37`: titulo `text-sm` para `text-md`, padding `p-4` para
   `p-cartao` (20px). Primeiro salto tipografico real do produto.
5. `app/portal-shell.tsx:118`: sidebar escura (`bg-neutro-900`). **Maior mudanca
   de percepcao por linha alterada em todo o repositorio** — e o que separa
   visualmente "ferramenta interna" de "produto".
6. `app/portal-shell.tsx:153`: nav ativa com barra indicadora de 3px, resolvendo
   os 1,5% de luminancia.
7. `ui/botao.tsx`: adicionar `tamanho` (sm/md/lg) e `carregando`, trocar
   `transition-colors` por transicao com propriedades listadas e
   `active:translate-y-px` — o pixel de "press" e o que da sensacao fisica.
8. `agenda-semanal.tsx:92`: cinco status com barra lateral de 3px em vez de duas
   cores; barra de cor le melhor que borda completa.

**Tipografia — recomendacao com opiniao**

Figtree + Noto Sans e um par sem intencao: Noto Sans e literalmente a fonte de
fallback universal do Google. Proposta: **IBM Plex Sans + IBM Plex Mono**. A
justificativa nao e estetica: em software clinico o dado e o heroi — horarios,
scores, faixas de dias, IDs de prontuario. Dar aos dados voz tipografica propria
(mono, tabular por construcao) e hierarquia real, nao decoracao. Ambas estao no
Google Fonts; o custo e editar `app/layout.tsx:6-18` e nada mais.

Se a troca de familia for considerada fora de escopo: manter Figtree/Noto e
aplicar apenas a escala e `tabular-nums` ja entrega cerca de 70% do ganho.

**Skill**

- `frontend-design:frontend-design`: calibragem de investimento de design.
- `web-design-guidelines`: revisao contra as Web Interface Guidelines.
- `ui-ux-pro-max` (busca, `--domain ux`): baseline ja definida para o bloco
  191-198, mantida aqui.
- `dataviz`: **obrigatoria antes de escrever qualquer grafico** — relevante
  para a Fase 207, mas a paleta categorica precisa nascer junto com os tokens
  desta fase, nao depois.

**Agente**

- Auditoria de design (general-purpose + skills acima) (**opus**): decisao de
  sistema visual e ambigua e de alto impacto.
- `ecc:a11y-architect` (**sonnet**): todos os pares de cor novos precisam passar
  em WCAG AA; os valores propostos ja foram calculados para isso, mas exigem
  verificacao.
- `ecc:react-reviewer` (**sonnet**): baseline do bloco anterior.

**Outros**

- Criterio de aceite: regressao visual Playwright atualizada e revisada
  manualmente (a suite vai acusar diff em praticamente todas as telas — isso e
  esperado, e o ponto da fase); contraste AA verificado em todos os pares novos;
  `pnpm --dir octaclin-web build` e `test:a11y` verdes.
- **Dark mode: nao fazer agora.** Justificativa completa no Anexo A.
- Esta fase deve ser executada **junto ou logo apos a Fase 198**, que ja e a
  consolidacao visual. Se a 198 rodar antes, ela vira o baseline; se rodar
  depois, retrabalho.
- Manter a regra da Fase 190: nenhum segundo sistema de componentes. Nao
  instalar shadcn/Radix; os componentes proprios continuam sendo a base.

---

## Fase 203 - Componentes compartilhados e fim dos sistemas paralelos

**Como esta hoje**

O design system existe e nao e usado:

- `octaclin-web/components/ui/etiqueta.tsx` e importado em **2** arquivos,
  enquanto `octaclin-web/components/portal/portal-paciente.tsx` contem **15
  badges ad hoc** (`rounded-full border border-linha bg-white px-2 py-1 text-xs
  font-semibold`) nas linhas 797, 829, 832, 862, 896, 917, 947, 1001, 1184,
  1224, 1249, 1290, 1327 e seguintes.
- O botao primario/secundario e reimplementado a mao em
  `painel-dashboard.tsx:67` (`LinkAcao`), `console-shell.tsx:66`
  (`AtalhoShell`) e `portal-paciente.tsx:629, 651, 668, 688, 702` — cada um com
  altura diferente (`min-h-11` contra `h-9`).
- `portal-paciente.tsx:93` define um `classeCampo` paralelo (`h-10`,
  `focus:ring-2`) que diverge de `ui/campo.tsx:18` (`min-h-11`,
  `focus-visible:outline`). **Dois design systems concorrentes no mesmo
  arquivo.**
- `painel-dashboard.tsx:169` usa `window.confirm` nativo para cancelar consulta,
  embora `ModalConfirmacao` exista em `ui/modal.tsx:116`. Sao 3 ocorrencias no
  repo.
- `ui/modal.tsx:70`: sem `overscroll-behavior: contain`, sem animacao de
  entrada. `ui/modal.tsx:133`: `'Processando'` sem reticencias e sem spinner.
- `portal-shell.tsx:81`: menu de conta via `<details>` — nao fecha ao clicar
  fora, sem `role="menu"`.
- `agenda-semanal.tsx:307, 321, 427` e `console-shell.tsx:64`: tooltip via
  `title=` nativo, com 1s de atraso e visual do sistema operacional.
- `painel-dashboard.tsx:190`: grupo de periodo com `aria-label` num `div` sem
  `role="group"`.
- `painel-dashboard.tsx:71, 190, 203, 204, 210, 218`: linhas unicas de mais de
  1000 caracteres de JSX.
- Apenas 8 `transition-colors` no app inteiro; nenhuma outra transicao.

**Problema**

Tokens novos (Fase 202) vazam com o tempo se cada tela continuar reimplementando
botao e badge. Um `window.confirm` do Chrome no meio de uma acao clinica anula
qualquer polimento das oito mudancas da fase anterior. E linha de 1000
caracteres nao e so ilegibilidade: e a razao pela qual o design nunca fica
consistente, porque ninguem edita isso sem quebrar algo.

**Solucao**

Criar apenas o que falta de verdade — `Esqueleto`, `EsqueletoPagina`,
`EstadoVazio` e `EstadoPermissaoNegada` **ja existem e sao bons**
(`ui/feedback.tsx:57, 61, 87, 98`), nao recriar:

| Componente | Substitui |
| --- | --- |
| `Aviso` (toast regional, `aria-live="polite"`) | Blocos inline duplicados em `painel-dashboard.tsx:197`, `painel-agenda.tsx:498`, `portal-paciente.tsx:599`, que empurram o layout |
| `EtiquetaStatus` (mapa dominio -> variante) | Os 15 badges ad hoc e as 2 cores para 5 status da agenda |
| `Avatar` (iniciais sobre cor derivada do id) | `UserRound` generico de `portal-shell.tsx:89`; maior injecao de textura por linha numa lista clinica |
| `Dica` (tooltip) | Os `title=` nativos |
| `Menu` (dropdown acessivel) | O `<details>` de `portal-shell.tsx:81` |
| `CabecalhoSecao` | Padrao titulo+descricao+acoes repetido a mao em ~30 telas |
| `Metrica` | Promover `painel-dashboard.tsx:70` (`Indicador`) para `ui/`, com `tabular-nums` e delta |

Alem disso: eliminar as 3 ocorrencias de `window.confirm`, migrar os badges e
botoes ad hoc, e adicionar prop `densidade` na `ui/tabela.tsx` existente.

**Nao criar** (registrado para evitar desperdicio futuro): breadcrumb (a
navegacao tem 1 nivel, `console-shell.tsx:25-34`); data table nova (a `Tabela`
por divs funciona); biblioteca de toast de terceiros; sistema de icones proprio.

**Skill**

- `ecc:accessibility` e `ecc:frontend-a11y`: `Menu`, `Dica` e `Aviso` sao
  exatamente os componentes onde ARIA costuma ser feito errado.
- `web-design-guidelines`.
- `ui-ux-pro-max --domain ux "menu tooltip toast"`.

**Agente**

- `ecc:a11y-architect` (**opus**): dropdown e tooltip acessiveis exigem
  raciocinio de interacao, nao checklist; foco, escape, clique fora, leitor de
  tela.
- `ecc:react-reviewer` (**sonnet**).
- `ecc:refactor-cleaner` (**sonnet**): a migracao dos badges e botoes ad hoc e
  trabalho mecanico de alto volume.

**Outros**

- Criterio de aceite: zero `window.confirm` no repo; `ui/etiqueta.tsx` importado
  em todas as telas que exibem status; `test:a11y` verde; nenhum componente novo
  fora de `components/ui/`.
- A migracao dos ad hoc e mecanica, nao e decisao de design — pode ser dividida
  em subagentes paralelos por modulo (`superpowers:subagent-driven-development`).

---

## Fase 204 - Data fetching, resiliencia e code splitting

**Como esta hoje**

- **Nenhum dos 5 monolitos cancela requisicao obsoleta.**
  `painel-operacoes.tsx` tem cerca de 15 funcoes de carregamento (`carregar:260`,
  `filtrarAuditoria:318`, `filtrarOutbox:340`, `trocarPaginaAuditoria:362`,
  `trocarPaginaOutbox:384`, `trocarPaginaFalhasComunicacao:406`,
  `filtrarFalhasComunicacao:426`, `recarregarSolicitacoesAssinatura:446`,
  `filtrarLgpd:496`, `trocarPaginaLgpd:516`) e nenhuma usa `AbortController` ou
  guarda de sequencia.
- `portal-cliente.tsx:285-369`: `carregarUsuarios`, `carregarConvites`,
  `carregarHistoricoConvites`, `carregarConfiguracoes`, `carregarPerfilEmpresa`
  nao cancelam nem checam montagem — **enquanto os dois primeiros `useEffect` do
  mesmo arquivo (234-252, 262-283) ja usam flag `ativo`.** Inconsistencia
  interna.
- **O padrao correto ja existe no repo:** `painel-dashboard.tsx:89-147` usa
  `AbortController` + `sequenciaRequisicao` (ref-counter).
  `agenda-semanal.tsx:159-172` chega perto (flag `cancelado`) mas nao cancela o
  fetch de fato.
- **Estado derivado calculado em `useEffect`**: `painel-comunicacoes.tsx:591-595,
  597-601, 603-607` e `agenda-semanal.tsx:127-130, 132-137`.
- `painel-operacoes.tsx:675` e `:682`: `eslint-disable-next-line
  react-hooks/exhaustive-deps` sem comentario de justificativa (idem
  `editor-questionario.tsx:29`).
- **100% client-side.** Todos os 35 componentes tem `'use client'`; as paginas em
  `app/` sao wrappers triviais. `Suspense` aparece 3 vezes
  (`app/agenda/page.tsx:8`, `app/dashboard/page.tsx:9`, `app/pacientes/page.tsx:8`)
  e duas delas com `fallback={null}` — tela em branco ate hidratar.
- **Nenhum `loading.tsx` ou `error.tsx`** nos 44 arquivos sob `app/`. Nenhum
  error boundary React.
- **Nenhum `React.lazy`/`next/dynamic`.** As 9 sub-rotas do portal do paciente
  importam o mesmo `portal-paciente.tsx` (1473 linhas): quem abre
  `/portal/perfil` baixa as 9 secoes.
- `painel-operacoes.tsx` e `portal-cliente.tsx` montam todas as abas no DOM com
  `hidden={areaAtiva !== 'x'}`.
- **Sem SWR/React Query** no `package.json`: cada painel reimplementa
  `carregar()` mais botao "Atualizar". Duas abas divergem.
- **Nenhum update otimista** em nenhuma das 5 telas.

**Problema**

Cliques rapidos em "Proxima"/"Filtrar" podem fazer uma resposta antiga
sobrescrever uma mais nova — corrupcao visivel de dado em tela, dificil de
reproduzir e facil de culpar o backend. Estado derivado em efeito gera um paint
extra com valor vazio a cada montagem. E se qualquer monolito lancar excecao de
render (nao de fetch, que ja tem try/catch), **a pagina inteira quebra em branco
sem fallback**.

**Solucao**

1. Extrair o padrao `AbortController` + contador de sequencia de
   `painel-dashboard.tsx:89-147` para um hook compartilhado e aplicar nos 5
   monolitos. **Nao inventar padrao novo** — este ja esta provado no repo.
2. Mover os 5 casos de estado derivado do `useEffect` para o render
   (`const conversaAtiva = conversaSelecionadaId ?? conversasFiltradas[0]?.id`).
3. Adicionar `error.tsx` e `loading.tsx` por rota — convencao do App Router,
   praticamente zero codigo customizado.
4. Trocar `fallback={null}` por esqueleto nos 3 `Suspense` existentes (1 linha
   por arquivo, ganho de percepcao imediato).
5. Aplicar `next/dynamic` por secao no portal do paciente.
6. Buscar o resumo inicial de `app/cliente/page.tsx` e `app/operacoes/page.tsx`
   no Server Component e passar como prop, eliminando o flash de
   "Carregando conta" antes de qualquer dado.
7. Justificar ou remover os `exhaustive-deps` desabilitados.

**Skill**

- `ecc:react-patterns` e `ecc:react-performance`.
- `vercel:nextjs` e `vercel:react-best-practices`: Server Components, streaming,
  convencoes de `loading.tsx`/`error.tsx`.
- `context7-mcp`: confirmar API do Next 15.5 antes de codar (o repo esta em
  15.5.22, com shim `UnsafeUnwrappedCookies` pendente).

**Agente**

- `ecc:react-reviewer` (**sonnet**): baseline, e foi quem levantou os achados.
- `ecc:performance-optimizer` (**sonnet**): medir antes e depois do splitting,
  nao adivinhar.
- `ecc:silent-failure-hunter` (**sonnet**): a race condition e uma falha
  silenciosa por definicao.

**Outros**

- Criterio de aceite: teste que dispara duas requisicoes em sequencia rapida e
  garante que a resposta antiga nao sobrescreve a nova; `error.tsx` capturando
  excecao de render sem tela branca; bundle da rota `/portal/perfil` medido
  antes e depois.
- **Nao introduzir SWR/React Query nesta fase.** A adocao de uma camada de dados
  e decisao de arquitetura que afeta 35 componentes; deve ser avaliada junto da
  Fase 214 (refatoracao dos monolitos), com o hook compartilhado desta fase como
  ponte. Adicionar biblioteca agora significa dois padroes convivendo.
- **O que ja esta bom e nao precisa de acao** (verificado): todas as `key` de
  lista sao estaveis, nenhuma usa indice; nenhuma mutacao direta de estado
  (todos os updates usam spread); `painel-operacoes.tsx:731-742` ja tem
  `BarraCarregamento` agregando 7 flags e `EstadoVazio` em toda lista.

---

# Bloco C - Valor comercial direto

O que falta para o OctaClin competir com Dietbox, Nutrium, WebDiet, Avanutri e
iClinic no mercado brasileiro.

## Fase 205 - Recall automatico de retorno

**Como esta hoje**

Existe fila de retorno no painel clinico (Fase 145) e lembrete automatico de 24h
antes da consulta (`servico-lembretes-agenda.ts`, Fase 110). O modulo de
Automacoes da Fase 197 ja tem motor Quando/Fazer com simulacao obrigatoria antes
da ativacao. Nao existe gatilho de **inatividade**: "paciente sem consulta ha N
dias, enviar mensagem".

**Problema**

O paciente que some e o que da prejuizo. Hoje recuperar carteira depende de
alguem olhar a fila de retorno manualmente todo dia.

**Solucao**

Adicionar gatilho de inatividade ao motor de automacoes existente: condicao
(dias sem consulta concluida, opcionalmente filtrada por status de adesao ou
profissional responsavel), acao (mensagem por canal preferido do paciente,
respeitando opt-in da Fase 111), e simulacao antes de ativar, como as demais
automacoes.

**Skill**

- `superpowers:test-driven-development`.
- `ecc:api-design`: o gatilho vira contrato em linguagem comum, mesmo padrao da
  recorrencia amigavel da Fase 194.

**Agente**

- `ecc:silent-failure-hunter` (**sonnet**): automacao que dispara e falha em
  silencio manda paciente embora sem ninguem saber.
- `ecc:security-reviewer` (**sonnet**): escopo por profissional responsavel e
  opt-in de comunicacao sao as duas fronteiras; ambos ja validados, entao
  sonnet basta.

**Outros**

- **Maior razao valor/esforco de todo o roadmap.** O motor ja existe, a
  simulacao ja existe, o envio ja existe, a preferencia de canal ja existe.
  Falta apenas a condicao.
- Criterio de aceite: automacao de inatividade simulada mostra exatamente quais
  pacientes seriam contatados antes de ativar; paciente com opt-out nao entra;
  paciente fora do escopo do profissional nao entra.
- Cuidado comercial: definir teto de frequencia para nao transformar recall em
  spam, que queima o numero na Meta.

---

## Fase 206 - Teleconsulta por link na consulta

**Como esta hoje**

Zero ocorrencias de teleconsulta, video ou meet em todo o repositorio. A consulta
nao tem modalidade.

**Problema**

Consulta online e padrao no Brasil desde 2020. Um SaaS clinico sem campo de
teleconsulta e descartado na primeira comparacao comercial — nao por falta de
recurso sofisticado, mas por falta de um campo.

**Solucao**

MVP deliberadamente pequeno, sem construir plataforma de video:

1. Adicionar modalidade (presencial/online) e link da sala na consulta, com
   migration.
2. Injetar o link no lembrete de 24h e na confirmacao, reutilizando
   `ServicoLembretesAgenda` e os templates WhatsApp ja mapeados na Fase 109.
3. Exibir o link no portal do paciente e no card da agenda, com copia rapida e
   ocultacao apos o fim da consulta.

**Skill**

- `superpowers:test-driven-development`.
- `ecc:healthcare-emr-patterns`: modalidade de atendimento e dado de prontuario,
  nao so de agenda.

**Agente**

- `ecc:database-reviewer` (**sonnet**): migration simples sobre tabela quente de
  agenda.
- `ecc:e2e-runner` (**sonnet**): jornada consulta online -> lembrete com link ->
  portal.

**Outros**

- Criterio de aceite: consulta online envia lembrete contendo o link; paciente ve
  o link no portal apenas na janela valida; consulta presencial nao exibe nenhum
  campo de video.
- **Nao construir video proprio.** Link para Meet/Zoom/Whereby resolve 100% da
  demanda comercial a 2% do custo. Registrar essa decisao em
  `DECISOES_ARQUITETURA.md` para nao ser reaberta.
- O link e dado sensivel de sessao clinica: nao deve vazar em log nem em
  auditoria com PHI.

---

## Fase 207 - Antropometria e evolucao de medidas

**Como esta hoje**

`octaclin-backend/src/modulos/pacientes/infraestrutura/paciente.orm.ts` tem
apenas nome, contato, nascimento, `statusAdesao`, `scoreRisco` e
`ultimoCheckinEm`. Nao ha peso, altura, IMC, circunferencias, dobras cutaneas,
percentual de gordura, massa magra, protocolo de avaliacao nem RCQ.

O unico caminho hoje e criar uma pergunta do tipo `metrica` num questionario
(`octaclin-backend/src/modulos/questionarios/dominio/tipos-pergunta.ts`).

E `octaclin-web/package.json` **nao tem nenhuma biblioteca de grafico**; nao ha
nenhum componente de grafico no repositorio. A matriz longitudinal da Fase 194
(`components/questionarios/area-respostas.tsx`) e uma tabela.

**Problema**

Antropometria e o **nucleo** do software de nutricionista brasileiro. Sem ela o
produto nao entra na comparacao — nao perde a comparacao, nao entra.

E a ausencia de grafico e o segundo problema: o paciente nao ve a propria curva
de peso e o profissional nao tem o que mostrar na consulta. Curva de progresso e
o artefato numero 1 de retencao de portal do paciente em todos os concorrentes.

**Solucao**

1. Criar entidade de avaliacao antropometrica (peso, altura, circunferencias,
   dobras, composicao) com migration e criptografia coerente com o padrao atual
   de dado clinico.
2. Calcular IMC, RCQ e percentual de gordura por **protocolo selecionavel**
   (Pollock 3/7, Faulkner, Guedes), com formula e protocolo **registrados no
   proprio registro** — imutaveis no historico, mesma logica do snapshot de
   formulario da Fase 170.
3. Adicionar aba de avaliacoes no prontuario com comparacao entre datas e delta
   explicito.
4. Adicionar grafico de evolucao no prontuario e versao simplificada no portal
   do paciente, **sem expor score de risco clinico** — regra estabelecida na
   Fase 161 e mantida desde entao.
5. Preparar o modelo para receber peso vindo de balanca Wi-Fi / Health Connect /
   Apple Health no futuro, sem implementar a integracao agora.

**Skill**

- `dataviz`: **obrigatoria antes de escrever a primeira linha de codigo de
  grafico.** Define forma, paleta categorica acessivel, eixos e tooltip.
- `ecc:healthcare-emr-patterns`: avaliacao seriada e padrao conhecido de EMR.
- `ecc:database-migrations`.
- `superpowers:writing-plans`: modelagem nova de dominio exige plano antes.

**Agente**

- `ecc:architect` (**opus**): modelagem de dominio clinico novo, com protocolos
  multiplos e imutabilidade historica.
- `ecc:healthcare-reviewer` (**opus**): formula errada de composicao corporal e
  erro clinico, nao bug de software.
- `ecc:database-reviewer` (**sonnet**): migration e indices da serie temporal.
- `ecc:a11y-architect` (**sonnet**): grafico precisa de alternativa textual e
  nao pode depender so de cor.

**Outros**

- Criterio de aceite: duas avaliacoes do mesmo paciente produzem delta correto;
  o protocolo usado fica registrado e imutavel; paciente ve a curva de peso sem
  ver score de risco; testes de calculo contra **valores de referencia
  publicados** para cada protocolo.
- **Nao adotar biblioteca de grafico sem consultar `dataviz` antes.** Escolha
  errada aqui contamina 3 telas e a paleta do produto.
- A paleta categorica do grafico deve sair dos tokens da Fase 202, nao ser
  inventada aqui.
- Fase de esforco alto: e a maior do bloco C. Considerar
  `superpowers:subagent-driven-development` (modelo + calculo + UI + grafico sao
  tarefas independentes).

---

## Fase 208 - Documentos clinicos gerados

**Como esta hoje**

Existe consentimento LGPD versionado (Fase 117) e o perfil fiscal da empresa
(Fase 97). Nao existe: contrato de atendimento assinado, declaracao de
comparecimento, atestado, encaminhamento nem relatorio de alta.

**Problema**

Declaracao de comparecimento e pedida toda semana em clinica. Hoje a resposta e
Word. Relatorio de alta e o documento que fecha o ciclo de acompanhamento — sem
ele o paciente sai sem entregavel e a percepcao de valor cai no exato momento em
que ele decide renovar.

**Solucao**

1. Criar modelos de documento por tenant com variaveis (paciente, profissional,
   data, conteudo livre).
2. Gerar declaracao de comparecimento a partir de consulta **concluida** e
   relatorio de alta a partir do plano de acompanhamento.
3. Aplicar a identidade da clinica ja configurada (Fase 195) e registrar cada
   emissao na auditoria.
4. Entregar impressao/PDF e envio pelo canal de comunicacao existente.

**Skill**

- `ecc:healthcare-emr-patterns`.
- `superpowers:test-driven-development`.

**Agente**

- `ecc:security-reviewer` (**sonnet**): documento com dado clinico saindo do
  sistema e uma fronteira; template com variavel e superficie de injecao.
- `ecc:healthcare-reviewer` (**sonnet**): conteudo clinico emitido em nome do
  profissional.

**Outros**

- Criterio de aceite: emitir declaracao a partir de consulta concluida, ver a
  emissao na auditoria, entrega-la por e-mail e imprimir sem quebra de layout;
  documento **nao** e emitido para consulta nao concluida.
- Assinatura digital (ICP-Brasil) fica **fora** desta fase. Documento gerado e
  identificado com dados do profissional resolve o caso de uso dominante;
  assinatura qualificada e outra fase, se houver demanda real.
- Esta fase e pre-requisito da 209 (o recibo reusa o mesmo gerador).

---

## Fase 209 - Financeiro da consulta e pacote de sessoes

**Como esta hoje**

A consulta (`octaclin-backend/src/modulos/agenda`) nao tem valor, forma de
pagamento nem status pago/pendente. Nao ha recibo, RPS nem NFS-e. O perfil
fiscal do cliente existe, mas so descreve a empresa. Nao existe pacote de
sessoes.

**Problema**

Sem financeiro nao ha relatorio de faturamento — e **faturamento e o numero que
o dono de clinica olha para decidir se renova a assinatura**. E um recurso que
protege receita recorrente, nao apenas uma conveniencia.

Pacote de sessoes (por exemplo 10 consultas com validade) e o formato dominante
de venda de acompanhamento nutricional no Brasil; sem ele o profissional
controla em planilha paralela.

**Solucao**

1. Adicionar valor, forma de pagamento e status (pendente/pago/isento) na
   consulta, com migration.
2. Criar recibo a partir da consulta paga, reutilizando o gerador de documentos
   da Fase 208 e o perfil fiscal do tenant.
3. Adicionar visao de recebimentos por periodo e por profissional no portal do
   cliente.
4. Introduzir pacote de sessoes (quantidade contratada, consumidas, validade)
   como agrupador **opcional** de consultas.

**Skill**

- `ecc:finance-billing-ops`: padroes de cobranca e conciliacao.
- `ecc:database-migrations`.
- `superpowers:test-driven-development`: caminho de dinheiro exige teste, sem
  excecao.

**Agente**

- `ecc:architect` (**opus**): pacote de sessoes cria relacao nova entre consulta
  e contrato; modelar errado gera retrabalho caro.
- `ecc:database-reviewer` (**sonnet**).
- `ecc:security-reviewer` (**sonnet**): valor e forma de pagamento sao dados que
  nao podem cruzar tenant nem escopo de profissional.

**Outros**

- Criterio de aceite: agenda do mes fecha com total recebido e pendente; recibo
  traz os dados fiscais reais do tenant; consulta cancelada nao entra no
  faturamento.
- **Sem integracao com gateway nesta fase.** O gateway definitivo ja e uma
  pendencia separada registrada no `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` e diz
  respeito a assinatura do tenant no OctaClin, nao ao pagamento da consulta do
  paciente. Sao dois fluxos diferentes; nao misturar.
- NFS-e envolve prefeitura por municipio e nao cabe num MVP. Recibo resolve a
  necessidade imediata.

---

# Bloco D - Operacao diaria

Fricoes que geram ticket de suporte a partir do primeiro dia com cliente real.

## Fase 210 - Notificacoes in-app e tempo real

**Como esta hoje**

`octaclin-web/components/app/console-shell.tsx:95` e um **link estatico** para
`/comunicacoes`. Sem badge, sem contador, sem centro de notificacoes.

Zero SSE ou WebSocket em todo o repositorio. Inbox de WhatsApp, agenda
compartilhada e fila de solicitacoes publicas so atualizam com F5.

**Problema**

Solicitacao publica de agendamento e mensagem de WhatsApp ficam invisiveis ate
alguem abrir a tela certa. O sino existe visualmente e nao notifica nada — o que
e pior que nao ter sino, porque o usuario confia nele.

**Solucao**

1. Criar centro de notificacoes por usuario (mensagem nova, solicitacao publica,
   formulario respondido, falha de envio) com estado lido/nao lido.
2. Ligar o sino do `console-shell` a contador real de nao lidas.
3. Publicar eventos por **SSE** com escopo de tenant e de profissional
   responsavel, reaproveitando o Redis ja provisionado.
4. Aplicar atualizacao automatica na inbox de comunicacoes, na fila de
   solicitacoes e na agenda do dia.

**Skill**

- `ecc:redis-patterns`: pub/sub para fan-out de SSE entre instancias.
- `vercel:nextjs`: streaming e route handlers para SSE no App Router.
- `context7-mcp`: confirmar comportamento de SSE no Next 15.5 e no Render.

**Agente**

- `ecc:architect` (**opus**): SSE com escopo multi-tenant e decisao estrutural;
  vazamento aqui e vazamento de PHI entre clinicas.
- `ecc:security-reviewer` (**opus**): canal persistente por usuario e uma
  fronteira de confianca nova, como o rascunho publico foi na Fase 195.
- `ecc:e2e-runner` (**sonnet**).

**Outros**

- Criterio de aceite: mensagem recebida aparece em ate 5s sem recarga;
  notificacao **nao vaza entre tenants nem entre profissionais fora do escopo**;
  queda do SSE degrada para recarga periodica sem erro visivel ao usuario.
- Depende da Fase 201: SSE com multiplas instancias sem fan-out via Redis
  entrega evento so para quem estiver conectado na instancia que publicou.
- Render tem timeout de conexao; documentar reconexao no `RUNBOOK_PRODUCAO.md`.

---

## Fase 211 - Importacao em massa e exportacoes do cliente

**Como esta hoje**

Nao ha importacao de pacientes. Migrar quem vem de planilha ou de concorrente e
um a um, na mao.

Exportacao existe apenas onde ninguem pede: CSV de convites, auditoria, outbox e
protocolo LGPD (rotas em `octaclin-web/app/api/operacoes/...`). Nao ha exportar
lista de pacientes, respostas de formulario, agenda nem evolucoes.

**Problema**

Sem importacao, onboarding de clinica com carteira formada e inviavel — e clinica
com carteira formada e exatamente o cliente que paga mais. E a ausencia de
exportacao do que o cliente considera "seus dados" e, alem de fricao comercial,
um argumento fraco em conversa sobre portabilidade LGPD.

**Solucao**

1. Importar pacientes por CSV/planilha com pre-visualizacao, validacao linha a
   linha, deteccao de duplicidade e relatorio de erros.
2. Exportar lista de pacientes, respostas de formulario e agenda em CSV,
   respeitando escopo e registrando a exportacao na auditoria.
3. **Reutilizar o padrao de exportacao ja existente** em Operacoes/LGPD, sem
   criar um segundo mecanismo.
4. Aplicar limite de plano e protecao anti-abuso na importacao.

**Skill**

- `superpowers:test-driven-development`: parser de CSV com dados sujos e
  exatamente o tipo de codigo que quebra em producao sem teste.
- `ecc:healthcare-phi-compliance`: exportacao em massa de PHI precisa de trilha.

**Agente**

- `ecc:security-reviewer` (**opus**): importacao e exportacao em massa sao os
  dois vetores classicos de exfiltracao; escopo e limite precisam ser
  verificados com raciocinio de ameaca.
- `ecc:silent-failure-hunter` (**sonnet**): linha invalida que some sem
  relatorio e o pior resultado possivel de uma importacao.

**Outros**

- Criterio de aceite: importar 200 pacientes com 5 linhas invalidas produz 195
  criados e relatorio claro dos 5 erros, **sem duplicar nada em reimportacao**;
  exportacoes nao incluem paciente fora do escopo do solicitante.
- Depende da Fase 199: importar 200 pacientes sem busca funcional so agrava o
  problema.
- Depende da Fase 200 se a importacao trouxer anexos.

---

## Fase 212 - Desfazer, lixeira e restauracao

**Como esta hoje**

Arquivar paciente (`servico-pacientes.ts:136`), cancelar consulta e arquivar
profissional (que agora revoga acesso, Fase 196) sao acoes de confirmacao e
ponto final. Reverter depende de SuperAdmin ou SQL direto.

**Problema**

"Arquivei sem querer" e um dos tickets mais frequentes em qualquer SaaS. Aqui
ele escala para intervencao tecnica, que e o pior custo de suporte possivel — e
com dado clinico envolvido, o pior risco de erro humano.

**Solucao**

1. Desfazer imediato (janela curta, via o componente `Aviso` da Fase 203) para
   arquivar paciente, cancelar consulta e arquivar profissional.
2. Visao de arquivados com restauracao explicita e auditada, incluindo
   reativacao de acesso quando aplicavel.
3. Padronizar o feedback de acao destrutiva nos componentes compartilhados, sem
   criar um segundo sistema.

**Skill**

- `superpowers:test-driven-development`.
- `ui-ux-pro-max --domain ux "undo destructive action"`.

**Agente**

- `ecc:security-reviewer` (**sonnet**): restauracao de profissional reativa
  acesso; e uma escalacao de privilegio se a permissao nao for checada.
- `ecc:silent-failure-hunter` (**sonnet**).

**Outros**

- Criterio de aceite: arquivar e restaurar paciente devolve escopo, vinculos e
  acesso ao estado anterior, com **dois eventos de auditoria distintos**;
  restauracao indevida bloqueada por permissao.
- Depende da Fase 203 (componente `Aviso`).

---

## Fase 213 - Command palette e atalhos de teclado

**Como esta hoje**

So existem atalhos de link no shell (`#novo-paciente`, `#novo-agendamento`,
corrigidos na Fase 193). Nao ha command palette nem atalho de teclado.

**Problema**

Com 4 areas de navegacao e cerca de 29 rotas, circular exige mouse e memoria de
menu. Recepcao que agenda 40 vezes por dia sente todo dia. E command palette e,
em 2026, um sinal direto de produto moderno.

**Solucao**

1. Command palette (Ctrl+K / Cmd+K) com navegacao por rota, busca de paciente
   (reusando a busca server-side da Fase 199) e acoes rapidas.
2. Atalhos para as acoes de maior frequencia: novo paciente, novo agendamento,
   buscar.
3. Tela de referencia de atalhos.

**Skill**

- `ecc:accessibility`: palette e um dialogo modal com foco preso e navegacao por
  teclado; e facil torna-lo inacessivel.
- `ui-ux-pro-max --domain ux "command palette keyboard navigation"`.

**Agente**

- `ecc:a11y-architect` (**sonnet**): foco, escape, leitor de tela,
  `aria-activedescendant`.
- `ecc:react-reviewer` (**sonnet**).

**Outros**

- Criterio de aceite: palette abre e fecha por teclado, navegavel sem mouse,
  anuncia resultados a leitor de tela, e a busca de paciente respeita escopo.
- **Depende da Fase 199.** Command palette sobre uma busca que so ve 25
  registros e pior que nao ter palette: parece moderno e mente.
- Fase de polimento. Se o cronograma apertar, e a primeira candidata a adiar
  dentro do bloco D.

---

# Bloco E - Divida tecnica e expansao

## Fase 214 - Refatoracao dos monolitos

**Como esta hoje**

| Arquivo | Linhas | Abas internas |
| --- | --- | --- |
| `components/cliente/portal-cliente.tsx` | 1737 | 8 (ativacao, assinatura, consumo, equipe, preferencias, marca, integracoes, fiscal) |
| `components/operacoes/painel-operacoes.tsx` | 1513 | 6 (saude, incidentes, comunicacoes, LGPD, auditoria, filas) |
| `components/portal/portal-paciente.tsx` | 1473 | dividido por rota (9 paginas) |
| `components/comunicacoes/painel-comunicacoes.tsx` | 1244 | nenhuma |
| `components/agenda/painel-agenda.tsx` | 940 | nenhuma |

`portal-cliente.tsx:201-222` tem 8 pares `erroX/sucessoX` distintos, enquanto
`painel-operacoes.tsx:193-194` usa **um unico par global** compartilhado por
cerca de 12 acoes — a mensagem de sucesso de uma acao fica visivel enquanto o
usuario mexe em outra aba.

**Problema**

Nao e o tamanho em si: e que o tamanho impede consistencia. Foi o que aconteceu
com os badges ad hoc e o `classeCampo` paralelo do bloco B.

**Solucao**

Aplicar o padrao **ja provado na Fase 194** — `editor-questionario.tsx` (56
linhas, so orquestra) + `usar-workspace-questionarios.ts` (781 linhas, todo o
estado) + cinco `area-*.tsx` que recebem `workspace` como prop.

Aplicar **somente** em `painel-operacoes.tsx` e `portal-cliente.tsx`: sao os dois
casos com abas internas reais e mais de 1500 linhas — mesmo criterio que levou a
divisao do editor de questionarios.

**Nao dividir**: `painel-comunicacoes.tsx` e `painel-agenda.tsx` nao tem abas
internas; dividi-los da mesma forma seria criar abstracao sem abas para
justifica-la. `portal-paciente.tsx` ja e dividido por rota — o ganho la e
`next/dynamic` (Fase 204), nao split de hook.

Nesta fase tambem avaliar a adocao de SWR ou React Query, adiada da Fase 204.

**Skill**

- `superpowers:writing-plans`: refatoracao de 3250 linhas exige plano por
  escrito antes de tocar em codigo.
- `superpowers:subagent-driven-development`: as areas sao independentes entre si.
- `ecc:react-patterns`.

**Agente**

- `ecc:code-architect` (**opus**): desenhar a fronteira hook/area antes de
  dividir.
- `ecc:react-reviewer` (**sonnet**).
- `ecc:e2e-runner` (**sonnet**): a rede de seguranca da refatoracao e a suite
  Playwright existente; ela precisa passar sem alteracao.

**Outros**

- Criterio de aceite: comportamento identico antes e depois, comprovado pela
  suite Playwright existente **sem modificacao nos testes**; nenhum arquivo novo
  acima de 500 linhas.
- Refatoracao pura, sem mudanca funcional. Nao aproveitar a fase para "ja que
  estou aqui" — foi o que gerou os sistemas paralelos.
- Unificar o estado de mensagem de operacao junto, resolvendo o par global de
  `painel-operacoes.tsx:193`.

---

## Fase 215 - Performance de backend: cache, agregacoes e pool

**Como esta hoje**

- `octaclin-backend/src/infraestrutura/banco-dados/executor-tenant.ts` envolve
  **cada** operacao numa transacao para setar `app.tenant_id`. Correto para RLS,
  mas prende uma conexao do pool por operacao — e varias telas fazem N chamadas
  sequenciais ao BFF.
- `servico-pacientes.ts:87-92` carrega todas as consultas historicas dos 25
  pacientes da pagina (tratado parcialmente na Fase 199).
- Redis e usado so para rate limit, fila e health check. **Nenhum cache de
  leitura.** Dashboard clinico e prontuario recomputam tudo a cada visita.
- Rotas sem versionamento (`/pacientes`, `/questionarios`, sem `/v1`).

**Problema**

Com Neon (limite de conexoes) e Render, a transacao por leitura e o **primeiro
gargalo real de concorrencia** — nao aparece com 5 usuarios e aparece de uma vez
com 50.

**Solucao**

1. Avaliar `SET LOCAL` fora de transacao para leituras, ou pool dedicado de
   leitura, **sem enfraquecer o RLS** — a garantia de tenant e inegociavel.
2. Introduzir cache de leitura no Redis para dashboard clinico e resumos, com
   invalidacao por evento.
3. Fechar as agregacoes sem teto que sobrarem da Fase 199.
4. Introduzir prefixo `/v1` na superficie que virara publica (preparacao para a
   Fase 218), mantendo o BFF interno inalterado.

**Skill**

- `ecc:postgres-patterns` e `ecc:redis-patterns`.
- `ecc:api-design`: estrategia de versionamento.
- `ecc:latency-critical-systems`.

**Agente**

- `ecc:database-reviewer` (**opus**): qualquer mexida no `executor-tenant` toca
  a garantia de isolamento multi-tenant, que ja teve bug real (Fase 122).
- `ecc:performance-optimizer` (**sonnet**): medir antes de otimizar.
- `ecc:security-reviewer` (**opus**): cache de dado clinico entre requisicoes e
  um caminho classico de vazamento cross-tenant.

**Outros**

- Criterio de aceite: teste de carga em staging com N conexoes simultaneas antes
  e depois; **teste negativo de isolamento multi-tenant continua passando** apos
  qualquer mudanca no `executor-tenant`.
- **Nao comecar por cache.** Medir primeiro: se o gargalo for o pool, cache nao
  resolve e adiciona risco de vazamento.

---

## Fase 216 - Plano alimentar e calculo nutricional (MVP)

**Como esta hoje**

Os "planos de acompanhamento" sao tarefas, metas e check-ins
(`acompanhamento-tarefa.orm.ts`), nao refeicoes. Nao ha TMB/GET, distribuicao de
macronutrientes, montagem de refeicoes, tabela de composicao, lista de
substituicoes nem PDF do plano.

**Problema**

Enquanto isso nao existir, o nutricionista mantem Word/Excel — ou o concorrente
— aberto ao lado. E e nesse outro software que ele percebe valor todo dia.

**Solucao**

1. Calcular TMB/GET por formula selecionavel (Mifflin-St Jeor, Harris-Benedict,
   FAO/OMS) e distribuicao de macros, com a formula usada **registrada no
   plano**.
2. Montar plano por refeicoes com alimentos, porcoes e substituicoes,
   **versionado** como os formularios ja sao (Fase 170).
3. Usar base de composicao publica (TACO/IBGE) como fonte inicial, com origem e
   limitacao explicitas na tela.
4. Entregar o plano ao paciente no portal e em PDF com a identidade da clinica
   (reusando o gerador da Fase 208).

**Skill**

- `ecc:healthcare-emr-patterns`.
- `superpowers:writing-plans`: e a fase de maior escopo do roadmap.
- `superpowers:subagent-driven-development`.

**Agente**

- `ecc:architect` (**opus**): dominio novo e grande; a modelagem de
  refeicao/alimento/substituicao decide o custo de tudo que vier depois.
- `ecc:healthcare-reviewer` (**opus**): formula de TMB errada gera prescricao
  errada. E erro clinico.
- `ecc:database-reviewer` (**sonnet**).

**Outros**

- Criterio de aceite: montar, versionar e publicar um plano de ponta a ponta;
  paciente ve a versao publicada e nao o rascunho; total calculado bate com
  conferencia manual dentro da tolerancia documentada.
- **Fase mais cara do roadmap.** Avaliar antes se o publico-alvo real do
  OctaClin (consultoria e acompanhamento) precisa de prescricao alimentar
  completa ou se antropometria (Fase 207) mais planos de acompanhamento ja
  cobrem. Decisao comercial, nao tecnica — mas tomar antes de comecar.
- A base TACO tem licenca propria; verificar antes de embutir.

---

## Fase 217 - PWA do portal do paciente

**Como esta hoje**

Sem `manifest.json` e sem service worker. O modulo `mobile` do backend serve
sincronizacao e midia para um app que **nao existe no repositorio**. O portal e
responsivo (Fase 163 entregou navegacao inferior no celular), mas nao instalavel
e sem push.

**Problema**

O portal do paciente e onde a adesao acontece, e adesao cai com atrito. Icone na
tela inicial e check-in que funciona com rede ruim sao os dois ganhos concretos.

**Solucao**

1. Manifest, icones e service worker com cache do shell e das telas de plano e
   check-in.
2. Check-in e resposta de formulario offline com sincronizacao posterior
   **idempotente**, reaproveitando o rascunho versionado da Fase 195.
3. Avaliar push de lembrete apenas onde a plataforma permitir, sem prometer
   paridade com app nativo.

**Skill**

- `vercel:nextjs`: PWA no App Router.
- `ecc:healthcare-phi-compliance`: dado clinico em cache de dispositivo tem
  regra propria.
- `context7-mcp`: suporte de push em iOS muda com frequencia.

**Agente**

- `ecc:security-reviewer` (**opus**): PHI em cache de dispositivo e limpeza no
  logout sao o risco central desta fase.
- `ecc:e2e-runner` (**sonnet**).

**Outros**

- Criterio de aceite: portal instalavel em Android e iOS; check-in feito em modo
  aviao sincroniza sem duplicar ao voltar a rede; **nenhum dado clinico
  permanece em cache apos logout**.
- Decidir antes o destino do modulo `mobile` do backend: ele serve um app que
  nao existe. Ou o PWA passa a consumi-lo, ou ele deveria ser removido.
  Registrar a decisao em `DECISOES_ARQUITETURA.md`.

---

## Fase 218 - API publica, chaves por tenant e webhooks

**Como esta hoje**

Nao existe API publica, chave de API por tenant nem webhook de saida. As rotas
nao tem versionamento.

**Problema**

Trava integracao com Make/n8n/Zapier, RD Station e contabilidade, e trava
parcerias. Em 2026 isso e requisito de compra em clinica media, nao diferencial.

E versionar retroativamente, depois que existir app mobile ou consumidor
externo, custa caro.

**Solucao**

1. Prefixo `/v1` para a superficie publica (iniciado na Fase 215), mantendo o
   BFF interno inalterado.
2. Chaves de API por tenant com escopo de permissao, rotacao, revogacao e rate
   limit no Redis ja existente.
3. Webhooks de saida (paciente criado, consulta criada/cancelada, formulario
   respondido) com assinatura HMAC, reentrega e historico de falhas em
   Operacoes.
4. Documentar contratos e limites, sem expor PII alem do estritamente contratado.

**Skill**

- `ecc:api-design` e `ecc:contract-first`.
- `ecc:redis-patterns`: rate limit por chave.
- `ecc:healthcare-phi-compliance`: o que uma integracao externa pode receber.

**Agente**

- `ecc:architect` (**opus**): superficie publica e contrato que nao se quebra
  depois.
- `ecc:security-reviewer` (**opus**): chave de API e a credencial de maior
  alcance que o produto vai emitir.
- `ecc:database-reviewer` (**sonnet**): escopo por tenant em toda rota publica.

**Outros**

- Criterio de aceite: integrar consumidor externo de ponta a ponta com chave
  escopada; receber webhook assinado; revogar a chave e ver acesso negado
  imediatamente; **nenhuma rota publica devolve dado de outro tenant**.
- Depende da Fase 201: webhook com reentrega precisa de fila confiavel.
- Exige atualizar `PACOTE_JURIDICO_COMERCIAL.md` e o mapa de responsabilidades
  LGPD: integracao externa cria suboperador.

---

# Anexo A - Decisoes de "nao fazer" (registradas para nao serem reabertas)

Cada item abaixo foi avaliado e recusado com motivo. Registrar aqui evita que a
proxima sessao de IA ou o proximo desenvolvedor gaste esforco redescobrindo.

**Dark mode — nao fazer agora.** O codigo usa 163 `bg-white`, 195 `text-tinta` e
348 `border-linha` como utilitarios diretos, e ha **zero** ocorrencias de `dark:`
no app. Dark mode hoje significaria tocar cerca de 700 pontos espalhados por
monolitos de 1737, 1513 e 1473 linhas — a pior razao impacto/esforco do roadmap
inteiro. Alem disso, nao e o problema: o que faz o produto parecer generico e a
ausencia de hierarquia, elevacao e respiro **no tema claro**; um dark mode sobre
o sistema atual seria um admin generico escuro. Contexto de uso tambem pesa:
consultorio e recepcao sao ambientes iluminados, uso diurno, com tela
frequentemente compartilhada com o paciente. O `darkMode: ['class']` em
`tailwind.config.ts:4` e declaracao sem implementacao. **O que fazer no lugar:**
a camada de CSS variables semanticas da Fase 202 deixa o dark mode futuro em um
bloco de ~40 linhas, desde que as telas novas usem os tokens semanticos em vez
de `bg-white`; e a sidebar escura entrega boa parte da percepcao por duas linhas.

**Dividir `painel-comunicacoes.tsx` e `painel-agenda.tsx`.** Nao tem abas
internas. Dividir sem abas para justificar seria abstracao gratuita. Ver Fase 214.

**Breadcrumb.** A navegacao tem 1 nivel (`console-shell.tsx:25-34`).

**Data table nova.** A `ui/tabela.tsx` por divs funciona; adicionar prop
`densidade` basta.

**Biblioteca de toast de terceiros e sistema de icones proprio.** Lucide ja
resolve; o `Aviso` da Fase 203 sao ~40 linhas.

**shadcn/Radix.** A Fase 190 estabeleceu "nenhum segundo sistema de
componentes"; os componentes proprios continuam sendo a base.

**Video proprio de teleconsulta.** Link externo resolve 100% da demanda
comercial a 2% do custo. Ver Fase 206.

**Assinatura digital ICP-Brasil.** Fora do escopo da Fase 208; documento gerado
e identificado resolve o caso dominante.

**NFS-e.** Envolve prefeitura por municipio; recibo resolve a necessidade
imediata. Ver Fase 209.

**SWR/React Query na Fase 204.** Adiado para a 214 para nao ter dois padroes de
data fetching convivendo durante a refatoracao.

# Anexo B - Correcoes de registro no roadmap atual

Achados que contradizem o que esta escrito hoje e devem ser corrigidos ao
aplicar este documento:

1. **Fase 121 — debito de rate limiting em memoria: ja quitado.** O
   `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` registra "migrar contadores para
   Redis/Upstash antes de producao multi-replica", mas
   `octaclin-backend/src/modulos/auth/aplicacao/servico-protecao-abuso.ts` ja
   usa Redis com script Lua atomico. Atualizar a observacao.
2. **Novo gate operacional.** Registrar em `CHECKLIST_GO_LIVE.md` e
   `RUNBOOK_PRODUCAO.md`: nao escalar o backend para mais de uma instancia antes
   da Fase 201.
3. **Modulo `mobile` do backend.** Serve sincronizacao e midia para um app que
   nao existe no repositorio. Decidir destino na Fase 217.

# Anexo C - Mapa de renumeracao

A analise original propunha uma numeracao sequencial com ordem de execucao
separada. Este documento renumerou cada fase para a sua posicao real de
prioridade, como solicitado.

| Numero original | Numero neste documento | Titulo |
| --- | --- | --- |
| 199 | 199 | Busca, filtros e paginacao server-side |
| 201 | 200 | Upload seguro e anexos clinicos |
| 205 | 201 | Confiabilidade dos processadores |
| (bloco 2, sem numero) | 202 | Sistema visual: tokens, tipografia e elevacao |
| (bloco 2, sem numero) | 203 | Componentes compartilhados |
| (bloco 3, sem numero) | 204 | Data fetching, resiliencia e code splitting |
| (bloco 4, item 1.10) | 205 | Recall automatico de retorno |
| 202 | 206 | Teleconsulta por link |
| 200 | 207 | Antropometria e evolucao de medidas |
| 203 | 208 | Documentos clinicos gerados |
| 204 | 209 | Financeiro da consulta e pacote de sessoes |
| 206 | 210 | Notificacoes in-app e tempo real |
| 207 | 211 | Importacao em massa e exportacoes |
| 208 | 212 | Desfazer, lixeira e restauracao |
| (bloco 4, modernidade) | 213 | Command palette e atalhos |
| (bloco 3, sem numero) | 214 | Refatoracao dos monolitos |
| (bloco 4, riscos) | 215 | Performance de backend |
| 209 | 216 | Plano alimentar e calculo nutricional |
| 210 | 217 | PWA do portal do paciente |
| 211 | 218 | API publica, chaves e webhooks |

# Anexo D - Resumo de skills e agentes por fase

| Fase | Skills | Agentes (modelo) |
| --- | --- | --- |
| 199 | `ecc:postgres-patterns`, `ecc:database-migrations`, `superpowers:writing-plans` | `ecc:database-reviewer` (opus), `ecc:security-reviewer` (opus), `ecc:e2e-runner` (sonnet) |
| 200 | `ecc:security-review`, `ecc:healthcare-phi-compliance`, `ecc:backend-patterns` | `ecc:security-reviewer` (opus), `ecc:healthcare-reviewer` (sonnet), `ecc:silent-failure-hunter` (sonnet) |
| 201 | `ecc:redis-patterns`, `ecc:nestjs-patterns`, `ecc:postgres-patterns` | `ecc:architect` (opus), `ecc:database-reviewer` (opus), `ecc:silent-failure-hunter` (sonnet) |
| 202 | `frontend-design`, `web-design-guidelines`, `ui-ux-pro-max`, `dataviz` | Auditoria de design (opus), `ecc:a11y-architect` (sonnet), `ecc:react-reviewer` (sonnet) |
| 203 | `ecc:accessibility`, `ecc:frontend-a11y`, `web-design-guidelines` | `ecc:a11y-architect` (opus), `ecc:react-reviewer` (sonnet), `ecc:refactor-cleaner` (sonnet) |
| 204 | `ecc:react-patterns`, `ecc:react-performance`, `vercel:nextjs`, `context7-mcp` | `ecc:react-reviewer` (sonnet), `ecc:performance-optimizer` (sonnet), `ecc:silent-failure-hunter` (sonnet) |
| 205 | `ecc:api-design` | `ecc:silent-failure-hunter` (sonnet), `ecc:security-reviewer` (sonnet) |
| 206 | `ecc:healthcare-emr-patterns` | `ecc:database-reviewer` (sonnet), `ecc:e2e-runner` (sonnet) |
| 207 | `dataviz`, `ecc:healthcare-emr-patterns`, `ecc:database-migrations`, `superpowers:writing-plans` | `ecc:architect` (opus), `ecc:healthcare-reviewer` (opus), `ecc:database-reviewer` (sonnet), `ecc:a11y-architect` (sonnet) |
| 208 | `ecc:healthcare-emr-patterns` | `ecc:security-reviewer` (sonnet), `ecc:healthcare-reviewer` (sonnet) |
| 209 | `ecc:finance-billing-ops`, `ecc:database-migrations` | `ecc:architect` (opus), `ecc:database-reviewer` (sonnet), `ecc:security-reviewer` (sonnet) |
| 210 | `ecc:redis-patterns`, `vercel:nextjs`, `context7-mcp` | `ecc:architect` (opus), `ecc:security-reviewer` (opus), `ecc:e2e-runner` (sonnet) |
| 211 | `ecc:healthcare-phi-compliance` | `ecc:security-reviewer` (opus), `ecc:silent-failure-hunter` (sonnet) |
| 212 | `ui-ux-pro-max` | `ecc:security-reviewer` (sonnet), `ecc:silent-failure-hunter` (sonnet) |
| 213 | `ecc:accessibility`, `ui-ux-pro-max` | `ecc:a11y-architect` (sonnet), `ecc:react-reviewer` (sonnet) |
| 214 | `superpowers:writing-plans`, `superpowers:subagent-driven-development`, `ecc:react-patterns` | `ecc:code-architect` (opus), `ecc:react-reviewer` (sonnet), `ecc:e2e-runner` (sonnet) |
| 215 | `ecc:postgres-patterns`, `ecc:redis-patterns`, `ecc:api-design`, `ecc:latency-critical-systems` | `ecc:database-reviewer` (opus), `ecc:performance-optimizer` (sonnet), `ecc:security-reviewer` (opus) |
| 216 | `ecc:healthcare-emr-patterns`, `superpowers:writing-plans`, `superpowers:subagent-driven-development` | `ecc:architect` (opus), `ecc:healthcare-reviewer` (opus), `ecc:database-reviewer` (sonnet) |
| 217 | `vercel:nextjs`, `ecc:healthcare-phi-compliance`, `context7-mcp` | `ecc:security-reviewer` (opus), `ecc:e2e-runner` (sonnet) |
| 218 | `ecc:api-design`, `ecc:contract-first`, `ecc:redis-patterns`, `ecc:healthcare-phi-compliance` | `ecc:architect` (opus), `ecc:security-reviewer` (opus), `ecc:database-reviewer` (sonnet) |

Baseline que se aplica a **todas** as fases, herdada de
`ESCOPO_SKILLS_AGENTES_FASES_191_198.md`: `superpowers:test-driven-development`
(exigida pelo `AGENTS.md`), `ecc:react-reviewer` e `ecc:typescript-reviewer` em
todo diff, e `ecc:a11y-architect` em toda fase que toca UI.

Heuristica de modelo (`ecc:model-route`): `haiku` = mecanico e baixo risco;
`sonnet` = padrao de implementacao; `opus` = arquitetura, revisao profunda ou
requisito ambiguo/alto risco. `haiku` e `opus` so entram via `model` explicito na
chamada do Agent tool; sem isso o subagente herda o modelo da sessao.

# Como usar este arquivo

1. Antes de iniciar qualquer fase deste bloco, reler a secao correspondente aqui
   junto com `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, `AGENTS.md` e
   `MAPA_ROTAS_PERMISSOES.md` se a fase tocar permissao.
2. Ao concluir a fase, seguir as regras do `CLAUDE.md`: atualizar o checklist, o
   `RESUMO_FASES_CONCLUIDAS.md`, o `STATUS_ATUAL_PROJETO.md`, criar o arquivo
   `fase-XXX-*.md` e rodar as validacoes de `TESTES_E_VALIDACOES.md`.
3. Se o mapeamento de skill/agente usado divergir do planejado no Anexo D,
   atualizar a tabela junto com o registro da fase.
4. Se uma decisao do Anexo A for revertida, registrar o motivo aqui **e** em
   `DECISOES_ARQUITETURA.md`. Nao remover a entrada.
