# FOOD04 — handoff para Luna alto: interface T11–T12

## Estado a reconfirmar antes de escrever

Branch `docs/pos320-food04-planning`, worktree
`/workspace/octaclin/.worktrees/pos320-food04-planning`, base `9e1984a2`.
Conferir `git status`, log e diff: uma única PR funcional futura, não criar outra
branch nem usar o checkout principal. Há alteração preexistente de next-env.d.ts
no checkout principal, que deve continuar intacta. Commits e evidências atualizados
no [ledger](execucao-pos-320-food04.md); não supor que CI/produção foram verificados.

Desenvolvimento autorizado. Não executar migration externa, merge, deploy ou
ativação. Ler AGENTS raiz/Web e o guia da versão Next instalada antes de APIs
do framework. Não instalar dependência. Usar TDD e somente dados sintéticos.
Referências específicas FOOD04 recomendam código interno; não pesquisar todos
os repositórios do catálogo. Sol médio deve revisar segurança/gates após a UI.

## Concluído no checkpoint

Backend: domínio/DTOs, biblioteca cifrada, índices HMAC, administração segregada,
duplicação/idempotência/CAS, favoritos, filtros, arquivo/restauração, migration1078,
save editorial/proveniência cifrada e projeções mínimas. PostgreSQL real testado
com limites explícitos no ledger. BFF e tipos compartilhados implementados.
Não reimplementar esses contratos no frontend nem criar outro caminho de save.

Fontes de verdade: [plano D01–D08](plan-pos-320-food04.md),
[checklist](todo-pos-320-food04.md), `MAPA_ROTAS_PERMISSOES.md`.
O backend permanece autoritativo e rejeita novas aplicações de fontes/grupos obsoletos, revisões
vencidas e acesso revogado.409 exige reconferência; não fazer retry cego.

## APIs reais já disponíveis

Tipos em `octaclin-web/lib/grupos-substituicoes-tipos.ts`; funções em
`lib/plano-alimentar-api.ts`, todas com AbortSignal:

- `consultarGruposSubstituicoes(consulta, signal, administracao=false)`:
  paginação, busca no corpo, categoria, etiqueta, escopo, estado e favoritos.
  Busca exige3 caracteres e palavras até32; estado padrão ativo; limite máximo100.
- `obterGrupoSubstituicoes(id, signal, administracao=false)`: detalhe, revisão,
  `podeEditar`, entradas disponíveis ou indisponíveis. Entrada não autorizada
  pode ter somente id/disponivel/motivo: usar união discriminada antes de ler fonte.
- `criarGrupoSubstituicoes(entrada, signal)`: UUID idempotente por intenção;
  manter a chave ao repetir a mesma operação após falha de rede. Não reutilizar
  com dados diferentes; pessoal padrão.
- `atualizarGrupoSubstituicoes(id, entrada, signal, administracao=false)`:
  `revisaoEsperada` e exatamente uma alteração: `conteudo`, `estado` ou
  promoção `escopo:'clinica'`. Não há conversão de clínica para pessoal.
- `duplicarGrupoSubstituicoes(id, entrada, signal)`: conteúdo completo editável,
  revisão esperada da origem, UUID idempotente. Backend gera novoID/IDs de
  entrada; não reutilizar favoritos nem autoridade da origem. Fontes obsoletas
  devem ser explicitamente corrigidas/removidas, sem atualização silenciosa.
- `alterarFavoritoGrupoSubstituicoes(id, favorito, signal)`.
- `consultarFontesGruposAdministracao({origem,busca,pagina,limite}, signal)`:
  somente para Client/SuperAdmin com administrar. Catálogo ativo/aprovado e
  custom compartilhado. Nunca chamar consultas clínicas em nome do gestor.
  Professional usa os seletores de catálogo/FOOD02 já existentes.

Administração pode consultar/editar/arquivar/restaurar compartilhados, inclusive
órfãos; não cria grupo pessoal, duplica em nome de outro, favorita ou aplica.
Reutilizar componente da biblioteca com modo administrativo explícito; integrar
no `components/cliente/portal-cliente.tsx` ou superfície institucional já autorizada.
SuperAdmin deve conseguir acessar essa mesma capacidade sem identidade clínica
fabricada. Professional acessa biblioteca pelo editor do plano. Não deixar UI
inacessível para um dos papéis aprovados.

## T11 — biblioteca

Criar componente(s) dedicados, seguindo `alimentos-personalizados.tsx`,
`medidas-caseiras-alimento.tsx`, `modelos-plano-alimentar.tsx` e UI comum.
Nome obrigatório180, descrição2000, categoria80, até10 etiquetas40,1–20 entradas,
gramas explícitos0.001–10000 até3 casas. Quantidade e unidade não são densidade
nem equivalência nutricional. Não declarar grupo como clinicamente equivalente.

CRUD, duplicação personalizada, compartilhamento autorizado, favoritos, filtros,
paginação, arquivo/restauração e reordenação por teclado são essenciais.
Estados acessíveis de carregamento/vazio/erro/recuperação e foco em modal.
Dados só em memória, sem localStorage/cache/URL/analytics. Remover respostas
tardias ao mudar contexto, desmontar, perder acesso ou iniciar nova consulta.

## T12 — aplicação seletiva e editor

1. Helper puro com testes antes da implementação: prévia, seleção parcial,
   porções personalizadas, principal excluído, duplicata pela identidade da fonte
   e peso físico em gramas (mesmo se unidade/quantidade apresentadas diferirem).
   Mesmo alimento com gramas diferentes exige confirmação explícita; preservar
   alternativas anteriores. Não presumir equivalência pela descrição textual.
2. Na confirmação, acrescentar apenas selecionadas com chaves novas estáveis;
   `preferida:false`, `liberadaParaPaciente:false`, sem substituir principal.
   Uma `aplicacaoId` UUID por ação, mantida nos retries; cada alternativa tem
   entradaId próprio. Não copiar metadados internos retornados acidentalmente.
3. Exemplo de intenção editorial (UUIDs exclusivamente sintéticos):

```json
{
  "grupoId": "10000000-0000-4000-8000-000000000051",
  "revisao": 1,
  "entradaId": "10000000-0000-4000-8000-000000000052",
  "aplicacaoId": "10000000-0000-4000-8000-000000000053",
  "confirmarPorcaoDistinta": true
}
```

4. Campo é `origemGrupo` em cada **substituição**, não no alimento principal.
   Backend canonicaliza fonte/nutrientes e flags. Nunca enviar `schemaVersao`,
   porção aplicada ou origem de cópia no campo: só intenção permitida acima.
5. `components/pacientes/plano-alimentar-profissional.tsx`: estender tipo do
   formulário/alternativa, `documentoDoFormulario` e reidratação schema1 com
   seletor fechado da intenção. Preservar em saves/reabertura; ao trocar a
   identidade do alimento, limpar intenção antiga. Não espalhar objetos da API.
6. Reutilizar `iniciarCopia`, `aguardarEnvio`, `contextoEdicao`, token e
   `formularioAtualRef`/`atualizar`; verificar contrato real antes de adaptar.
   Suspender autosave enquanto a ação opera, aguardar envio em curso, conferir
   novamente paciente/plano/rascunho/posse e mesclar no formulário atual.
   Um segundo pedido não pode liberar suspensão da operação anterior.
7. Cancelamento e resposta tardia não alteram documento. Verificar limites20/item,
   50 refeições e96KiB antes de confirmar; erro visível, sem truncamento silencioso.
8. Undo local remove somente chaves inseridas pela ação que não foram editadas,
   no mesmo contexto/posse, antes de qualquer envio que as inclua. Desabilitar
   quando save inicia ou há edição dependente. Não restaurar formulário inteiro.
9. PA02/modelos continuam copiando fatos sem transformar intenção antiga em
   nova autorização. Histórico da aplicação original permanece; nova versão do
   mesmo plano recupera proveniência no backend. Não anexar UUID antigo a outro
   pai. Nenhuma sincronização com biblioteca editada/arquivada.

## Aceite e gates ao devolver para Sol

- Testes de helpers e wrappers efetivamente ligados aos runners; BFF permanece
  fechado. Mudança necessária em contrato de segurança deve voltar a Sol.
- Playwright desktop/mobile: CRUD/dup/favorito/filtros/ordem, administração
  segregada, seleção/porções/cancelamento/repetição, indisponibilidade e409,
  autosave60s/envio em voo/perda de posse/troca de contexto/undo e foco acessível.
- Regressões PA02–PA07/FOOD01–03; typecheck/lint/Web build/test:authz e a11y
  proporcionais. Não declarar gate não executado como PASS.
- Atualizar ledger/checklist e manter única PR. Revisão independente/CI/scanners
  permanecem gates finais distintos; não atribuir independência à autorrevisão.
- Sem alertas de alergia inferidos, aplicação simultânea multidestino, undo
  persistente, equivalência FOOD05 ou liberação automática ao paciente.

## Ambiente local

Node22.23.4/pnpm11.25.0 em `/tmp/food04-tools`; dependências por symlink do
checkout FOOD03 (mesmos lockfiles). Workspace com pouco espaço; `/tmp` tem
filesystem separado. Não remover trabalho de outras fases para construir.
Usar evidências de build alternativas explicitamente identificadas no ledger;
preflight oficial PowerShell e cadeia PG com extensões não têm PASS local.

## Atualização: correção de segurança antes da retomada — 2026-10-24

- Revisão local focada encontrou risco de troca do alvo da biblioteca enquanto
  o conteúdo continuava em edição e confirmações que persistiam entre grupos.
  A revisão foi manual, feita pelo mesmo agente e não é independente.
- Corrigido na branch desta PR: captura imutável de ID/revisão ao iniciar
  edição/duplicação, bloqueio da navegação e ações da lista durante edição,
  invalidação da leitura pendente e limpeza de confirmações ao trocar/fechar
  grupo. Não houve alteração de backend, contrato, schema ou autorização.
- Regressões TDD: os dois testes novos reproduziram o comportamento antes da
  correção em desktop/mobile (4 RED); depois passaram em desktop/mobile (4
  GREEN). FOOD04 visual: 17/18 no agregado, com timeout transitório do axe; o
  caso restante passou isolado, total final observado 18/18. BFF planos 60/60,
  aplicação 4/4, ESLint, typecheck, secret scan e diff-check PASS.
- O teste local usou Node 24, fora da engine declarada 22.x; checks oficiais do
  novo HEAD ainda são necessários. Não faça merge até CI/scanners e revisão R4
  independente concluírem; os checks verdes anteriores não cobrem esta
  correção. Nenhuma operação externa foi executada.
