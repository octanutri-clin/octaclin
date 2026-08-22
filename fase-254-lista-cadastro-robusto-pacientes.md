# Fase 254 - Lista e cadastro robusto de pacientes

Criado em 2026-08-21. Fase essencial e pre-piloto, sucessora da Fase 253.

Estado em 2026-08-22: Incremento 1 concluido e integrado no PR `#93`.
Migration `1720000001035` aplicada; producao registra 48 migrations. Os
Incrementos 2 e 3 permanecem pendentes e devem sair em PRs separados.

Incremento 2 implementado localmente em 2026-08-22, com rotas proprias,
autorizacao especifica, componentes separados e rascunho por sessao. Aguarda
integracao do PR para ser considerado concluido.

## Objetivo

Separar listagem, criacao e edicao de pacientes, hoje concentradas em um unico
componente de 728 linhas com cerca de 28 estados locais, e fechar tres lacunas
que impedem o piloto: nao existe visao de trabalho salva, nao existe aviso de
paciente duplicado no cadastro interativo e um cadastro longo se perde inteiro
quando a rede ou a sessao falham.

A fase nao amplia coleta de dado pessoal. Nenhum campo novo de paciente e
criado, nenhum dado clinico muda de lugar e nenhuma protecao de tenant, escopo
ou auditoria e afrouxada para simplificar tela.

## Entrega

A fase e executada em tres incrementos, cada um em seu proprio PR, cada um
verde sozinho na `main` antes do seguinte. O DDL sai isolado no Incremento 1:
migration junto de refatoracao grande de interface e o erro 10 de `AGENTS.md`.

### Incremento 1 - Fundacao de dados e servicos

- Migration `1720000001035`, aditiva, cria `filtros_salvos_pacientes`.
- Servico de filtros salvos: criar, listar, aplicar, arquivar; validacao dos
  criterios por allowlist estrita; teto de 20 filtros ativos por profissional e
  20 de clinica por tenant, aplicado no servico, porque `check` nao conta
  linhas. Filtro arquivado nao conta para o teto.
- Verificacao de duplicidade, sem DDL: **extrai** o
  `buscarPossiveisDuplicidades` que hoje e metodo privado de
  `servico-perfil-cadastro-paciente.ts` para um servico proprio, com duas
  entradas - a partir de um paciente salvo, como hoje, e a partir de texto
  digitado, para o cadastro novo. O perfil passa a chamar o servico e perde a
  copia privada.
- Registro da decisao de dispensar duplicidade na auditoria existente.
- Sem interface. Sem backfill: a tabela nasce vazia.

### Incremento 2 - Rotas proprias e quebra do componente

- `rotasEspecificas` entra em `ModuloConsole`, e
  `permissaoExigidaParaRotaConsole` passa a consulta-lo antes de cair em
  `permissaoDetalhe`.
- `/pacientes/novo` e `/pacientes/[id]/editar` viram paginas; o modal de
  cadastro e removido.
- `lista-pacientes.tsx` e dividido em `lista-pacientes`, `filtros-pacientes`,
  `formulario-paciente` e `lixeira-pacientes`. `importacao-pacientes.tsx` fica
  intacto.
- Rascunho em `sessionStorage`, por tenant e por alvo, apagado somente apos
  sucesso confirmado.
- O atalho `#novo-paciente` da Fase 252 passa a navegar em vez de abrir modal.

### Incremento 3 - Filtros salvos e duplicidade na interface

- Seletor de visoes salvas na barra de filtros, com origem pessoal e da
  clinica.
- Aviso de possivel duplicado no formulario, com os candidatos e a escolha
  entre abrir o existente ou confirmar pessoa diferente.
- Estados de falha, vazio, permissao negada e filtro desatualizado.
- Portoes de linguagem, acessibilidade, Playwright, Lighthouse e Chrome
  DevTools.

## Modelo de dados

```sql
create table if not exists filtros_salvos_pacientes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  origem varchar(20) not null check (origem in ('pessoal', 'clinica')),
  profissional_id uuid,
  nome_criptografado bytea not null,
  criterios jsonb not null,
  criado_por_usuario_id uuid not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  arquivado_em timestamptz,
  constraint ux_filtros_salvos_pacientes_tenant_id_id unique (tenant_id, id),
  constraint fk_filtros_salvos_pacientes_profissional
    foreign key (tenant_id, profissional_id) references profissionais (tenant_id, id) on delete cascade,
  constraint fk_filtros_salvos_pacientes_usuario
    foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict,
  constraint filtros_salvos_pacientes_origem_profissional_check check (
    (origem = 'pessoal' and profissional_id is not null)
    or (origem = 'clinica' and profissional_id is null)
  )
);
create index if not exists idx_filtros_salvos_pacientes_listagem
  on filtros_salvos_pacientes (tenant_id, origem, arquivado_em, atualizado_em desc);
create index if not exists idx_filtros_salvos_pacientes_profissional
  on filtros_salvos_pacientes (tenant_id, profissional_id, arquivado_em, atualizado_em desc)
  where profissional_id is not null;
alter table filtros_salvos_pacientes enable row level security;
alter table filtros_salvos_pacientes force row level security;
create policy isolamento_tenant_filtros_salvos_pacientes on filtros_salvos_pacientes
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
```

A forma copia `receitas_nutricionais` da migration `1033`: mesma dupla
`origem`/`profissional_id`, mesma FK composta por `(tenant_id, id)`, mesmo RLS
`force` com politica por `app.tenant_id`.

Decisoes e o motivo de cada uma:

- **O filtro salvo nao guarda o texto da busca livre.** O campo de busca aceita
  nome e CPF. Um filtro compartilhado com a clinica carregando esse texto
  vazaria PII para toda a equipe dentro do nome de uma visao. Guardar apenas
  criterio estruturado tambem e mais util: "Risco alto sem retorno" e uma
  visao; "busca: Maria" nao e.
- **`criterios jsonb` e nao `bytea`**, porque sem texto livre nao ha PII. O
  servico valida contra allowlist de `risco`, `status`, `profissionalId` e
  `semProximaConsulta`, e **rejeita** chave desconhecida em vez de ignorar.
- **`nome_criptografado bytea`**, porque o nome da visao e texto que o
  profissional digita e pode conter qualquer coisa. O custo e nao poder ordenar
  por nome em SQL; a lista e pequena por tenant e ordena na aplicacao.
- **`on delete cascade` no profissional**, diferente do `restrict` da `1033`:
  receita e conteudo clinico reaproveitavel, visao salva e preferencia pessoal
  e nao sobrevive a saida de quem a criou.
- **Sem unicidade de nome.** Cifrado, exigiria coluna de hash so para isso.
  Dois filtros homonimos nao quebram nada.
- **Nenhuma tabela de duplicidade.** A decisao de dispensar vai para a trilha
  de auditoria que ja existe.

## Contrato de duplicidade

```
POST /pacientes/verificacao-duplicidade
body: { nome, contato?, dataNascimento? }
resposta: { candidatos: [{ pacienteId, nome, motivos }] }
```

`POST` e nao `GET` porque nome e contato sao PII e nao podem ir em query
string, que vaza para log de acesso, historico de navegador e cabecalho
referer.

**A logica ja existe e nao sera reescrita.** `buscarPossiveisDuplicidades`, hoje
privado em `servico-perfil-cadastro-paciente.ts`, ja usa
`ArrayOverlap(buscaHashes)` sobre o indice GIN da migration `1013`, ja limita ao
`profissionalResponsavelId` e ja corta em 5 candidatos. A fase extrai esse
metodo para `ServicoDuplicidadePacientes` com duas entradas e faz o perfil
chamar o servico. Escrever um segundo detector ao lado do primeiro criaria duas
regras de duplicidade que divergem na primeira manutencao.

`motivos` mantem o vocabulario existente e ganha um terceiro valor:

| Motivo | Quando |
| --- | --- |
| `nome_e_nascimento` | Nome normalizado identico **e** mesma data de nascimento |
| `contato` | E-mail ou celular normalizado identico |
| `nome` | Nome normalizado identico quando **nao ha** nascimento nos dois lados |

O `nome` sozinho e novo e existe por causa do cadastro: durante a digitacao a
data de nascimento normalmente ainda nao foi preenchida, e exigir os dois
tornaria a checagem inutil justo onde ela serve. Ele nao muda o comportamento do
perfil, que sempre tem o paciente salvo com nascimento quando ha um.

**Escopo: a carteira do profissional, nao o tenant inteiro** - herdado do metodo
existente e igual ao que a importacao aplica. O preco e explicito: um duplicado
sob outro profissional nao e detectado. Ampliar para o tenant inteiro e decisao
de privacidade propria, nao acabamento desta fase.

**Tetos conhecidos**, os dois herdados do metodo existente e nenhum resolvido
nesta fase:

1. **Acento separa.** O `ArrayOverlap` sobre hashes e so o pre-filtro, e ele
   remove diacritico via `normalizarTermosBusca`. A comparacao final usa
   `normalizar`, que so faz `trim`, minuscula e colapso de espaco. `Joao Silva`
   e `Joao Silva` com til passam o pre-filtro e falham na igualdade. Corrigir e
   uma linha - aplicar NFKD tambem em `normalizar` - mas isso muda o
   comportamento do perfil, que hoje depende dessa comparacao, entao sai desta
   fase e vira item proprio.
2. **Erro de digitacao nao casa.** `Marai` nao encontra `Maria`, nem no
   pre-filtro nem na igualdade. Nao existe distancia de edicao aqui. O caminho
   de upgrade, se doer, e comparacao fonetica sobre o dado ja decifrado.

A decisao de dispensar grava apenas UUID:

```ts
await this.auditoria.registrar({
  tenantId, usuarioId,
  acao: 'paciente.duplicidade_dispensada',
  recursoTipo: 'paciente', recursoId: pacienteCriadoId,
  metadados: { candidatosDispensados: [ids] }
});
```

Nome de paciente nao entra em log de auditoria.

## Fronteiras de seguranca

- RLS por tenant na tabela nova, `force` inclusive para o dono, no mesmo molde
  das tabelas anteriores.
- Criar, editar ou arquivar filtro de origem `clinica` exige
  `pacientes.gerenciar`. Filtro pessoal so e visivel e editavel pelo proprio
  profissional. Filtro de clinica e legivel por quem tem `pacientes.listar`,
  porque ele nao carrega dado de paciente, apenas criterio estruturado.
- `/pacientes/novo` e `/pacientes/[id]/editar` exigem `pacientes.gerenciar` na
  rota. Hoje `permissaoExigidaParaRotaConsole` aplica `permissaoDetalhe`, que
  para pacientes e `pacientes.ler`, a qualquer sub-rota: um `Collaborator`
  abriria o formulario inteiro e so levaria 403 no envio. O backend ja barra,
  entao nao ha buraco de seguranca, mas ha falha tardia que parece
  indisponibilidade e e permissao negada, exatamente o que a Fase 248 mandou
  eliminar.
- Rascunho em `sessionStorage` e nao `localStorage`: carrega nome, contato e
  nascimento. Em maquina compartilhada de clinica, `localStorage` deixaria PII
  no disco para o proximo turno. `sessionStorage` entrega a recuperacao sem
  criar deposito persistente que a Fase 261 teria de auditar.
- Verificacao de duplicidade respeita o escopo de paciente do solicitante e nao
  revela existencia de paciente fora dele.
- **Filtro salvo nao amplia escopo.** Um filtro de clinica e apenas criterio; a
  listagem continua passando pelo escopo por profissional responsavel de
  `servico-pacientes.listar`. Aplicar uma visao compartilhada que filtra por
  outro profissional nao mostra a carteira dele: devolve o cruzamento com o
  escopo de quem aplicou, que para um `Professional` e vazio. A tela trata esse
  vazio como filtro sem resultado no escopo, nao como ausencia de pacientes.

## Falhas e estados

Reaproveita `classificarFalhaInterface` e `TipoFalhaInterface` da Fase 248.

**A verificacao de duplicidade falha aberta.** Se a checagem cair, o cadastro
continua; a tela informa que nao foi possivel verificar e libera o envio. Ela e
consultiva e a decisao final ja e humana. Bloquear transformaria uma
conveniencia em impedimento de cadastrar paciente, que e trabalho essencial da
clinica. **Se um dia a duplicidade virar bloqueio automatico, ela deixa de
poder falhar aberta.**

O `sessionStorage` so e limpo apos sucesso confirmado. Nenhum caminho de erro
navega para longe do formulario.

| Tipo | Comportamento |
| --- | --- |
| `validacao` | Erro junto do campo, rascunho intacto, sem toast generico |
| `conflito` | Aviso de alteracao concorrente; escolha entre recarregar perdendo ou seguir editando |
| `permissao` | Estado de permissao negada, distinto de indisponivel, sem sugerir nova tentativa |
| `sessao` | Rascunho salvo **antes** do redirecionamento ao login e restaurado na volta |
| `indisponivel` | Nova tentativa acionavel, rascunho intacto |
| `nao_encontrado` | Apenas na edicao: paciente arquivado ou removido, com atalho para a lixeira |

Filtros salvos degradam sem derrubar a lista: se a chamada falhar, a listagem
carrega com os filtros da URL e some apenas o seletor de visoes.

Filtro salvo apontando para profissional removido nao devolve lista vazia em
silencio. Os criterios sao validados na leitura e a visao e marcada como
desatualizada, dizendo qual criterio caducou e oferecendo remove-lo. Vazio por
dado inexistente e vazio por filtro quebrado sao estados diferentes.

## Migration e rollout

Producao vai de 47 para 48 migrations.

1. Backup com teste de restore real.
2. Aplicar e verificar em `octaclin_test_fase150b` primeiro.
3. Registrar `1720000001035` no array explicito de `migrations` em
   `opcoes-typeorm.ts`. Criar o arquivo nao registra a migration e o CI nao
   pega isso.
4. Merge do Incremento 1.
5. `migration:run` fora de banda com `neondb_owner`. A role de runtime
   `octaclin_app_producao` nao tem `CREATE` no schema `public`, entao aplicar
   pelo boot falha.
6. Deploy.
7. Verificar `/health/detalhado` com 48 migrations e monitor verde.

## Portoes por incremento

**Incremento 1**

- Spec da migration no molde das `1033` e `1034`: sobe, verifica tabela,
  indices, RLS `force` e politica, e desce limpo.
- Suites de `servico-pacientes` e do servico de filtros salvos cobrindo
  allowlist rejeitando chave desconhecida, teto por profissional, `origem`
  pessoal exigindo profissional e clinica exigindo nulo, duplicidade limitada a
  carteira, e auditoria gravando apenas UUID.
- `typecheck` e `build` do backend.

**Incremento 2**

- `test:authz`: `Collaborator` recebe permissao negada em `/pacientes/novo`
  antes de ver o formulario.
- `test:paleta` e `test:fase252`: o catalogo ganhou campo novo e a navegacao
  nao pode regredir.
- Conferencia das dez specs Playwright que mockam `pacientes`, com atencao a
  `fase-199-busca-paginacao`, `fase-248`, `fase-249`, `fase-251` e `fase-252`.
  Mock de Playwright duplica contrato de API e ja quebrou por isso antes.
- `lint`, `typecheck`, `build`.

**Incremento 3**

- `test:fase254` novo: filtro salvo pessoal e de clinica; filtro com criterio
  caducado marcado como desatualizado em vez de lista vazia; duplicidade
  avisando e permitindo prosseguir; duplicidade indisponivel nao bloqueando;
  rascunho sobrevivendo a recarga e sumindo ao fechar a aba.
- `test:linguagem`: a microcopy nova passa pelo gate AST da Fase 251.
- `test:a11y`, Lighthouse e Chrome DevTools nas rotas novas, em 1440 px e
  390 px.

Duas ressalvas registradas antes da execucao:

1. `catalogo-taco.spec.ts` falha sempre no checkout Windows por `LF/CRLF` e
   passa no CI. Vai aparecer vermelho e nao e regressao desta fase. O JSON nao
   se normaliza.
2. Toda afirmacao de "validado" nomeia os comandos efetivamente executados.
   Suite parcial apresentada como completa ja mandou quebra para a `main`.

## Skills e modelo

Conforme `MATRIZ_SKILLS_PLUGINS_MODELOS_FASES_243_248_262.md`:
`ecc:healthcare-emr-patterns`, `ecc:frontend-patterns`,
`ecc:database-migrations`, `ecc:frontend-a11y` e `codex-security:validation`,
com Playwright e Chrome DevTools. A matriz condiciona Neon e SQL a uma
migration realmente necessaria; a escolha de filtros salvos compartilhaveis
pela clinica torna a migration necessaria, e a decisao foi tomada com esse
custo a vista.

## Proxima fase

Fase 255 - Prontuario clinico orientado a linha de cuidado, bloqueadora do
piloto.
