# Fase 196 - Comunicacoes, equipe e conta do cliente

Status: concluida e validada localmente em 2026-08-01.

## Entregue

- Comunicacoes divididas em `Conversas`, `Nova mensagem` e `Configuracoes`,
  abrindo no inbox e exibindo configuracoes apenas para quem administra canais
  e templates.
- Nova tentativa preparada a partir da mensagem que falhou, preservando canal,
  template e destino; o erro tecnico deixou de aparecer na interface clinica.
- Estado retornado depois do processamento de envio passou a refletir o valor
  persistido, inclusive falha, e a auditoria registra esse estado final.
- Listagens operacionais de canais e templates liberadas para envio sem expor
  tenant ou configuracao sensivel.
- Profissionais divididos em `Diretorio`, `Disponibilidade` e `Integracoes`,
  com agenda interna independente do Google e estado externo explicito.
- Link de disponibilidade corrigido para selecionar `profissionalId` na
  agenda.
- Arquivamento de profissional agora desativa o login vinculado e revoga seus
  refresh tokens.
- Portal comercial dividido em `Ativacao`, `Assinatura`, `Consumo`, `Equipe`,
  `Preferencias`, `Marca`, `Integracoes` e `Dados fiscais`.
- Gestor da conta pode alternar um acesso entre equipe administrativa e
  profissional. A promocao cria ou reativa o perfil clinico; a reducao exige
  reatribuicao previa de pacientes e consultas futuras, arquiva o perfil,
  revoga sessoes antigas e registra auditoria.
- IDs, escopos, origem de assinatura e nomes internos de papel foram removidos
  da interface comercial.
- Gate de teclado corrigido para respeitar o `tabindex=-1` do padrao roving
  usado pelas abas.

## Seguranca

- Troca de papel rejeita autoalteracao, `Client`, usuario ausente e usuario de
  outro tenant.
- Reducao de acesso profissional falha enquanto houver pacientes ativos ou
  consultas futuras vinculadas ao perfil.
- Refresh tokens do usuario alterado ou arquivado sao revogados; o access token
  existente conserva somente sua janela curta atual.
- Dados clinicos usados para criar o perfil profissional nao entram na
  auditoria.
- Configuracao sensivel de canal nao e devolvida na listagem operacional.
- Troca de contexto de painel permanece exclusiva do `SuperAdmin`; nenhuma
  regra desse fluxo foi ampliada.

## Validacoes

```powershell
pnpm --dir octaclin-backend test -- --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:next15
pnpm --dir octaclin-web build
pnpm --dir octaclin-web exec playwright test tests/visual/fase-196-comunicacoes-equipe.spec.mjs tests/visual/portal-cliente.spec.mjs --reporter=line
pnpm --dir octaclin-web exec playwright test tests/visual/acessibilidade.spec.mjs --grep "portal do cliente" --reporter=line
pnpm security:secrets
pnpm test:confiabilidade
```

Resultados: backend com 65 suites e 358 testes aprovados; lint, typechecks e
builds limpos; 23 verificacoes de autorizacao/BFF; 50 rotas dinamicas; 12
jornadas Playwright da fase em desktop e celular; 2 cenarios de acessibilidade;
scanner de secrets e matriz de confiabilidade aprovados.

## Operacao

- Nao ha migration de banco nesta fase.
- Usuarios cujo papel for alterado devem entrar novamente para receber o novo
  pacote de permissoes.
- O deploy de backend deve ocorrer antes ou junto da web por causa do novo
  `PATCH /cliente/usuarios/:id` e da permissao
  `cliente.usuarios.gerenciar`.

## Proxima fase

Fase 197 - Racionalizacao dos modulos avancados.
