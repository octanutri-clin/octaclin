# Fase 212 - Desfazer, lixeira e restauracao

Status: concluida em 2026-08-08.

## Problema

Pacientes e profissionais ja eram arquivados de forma logica, mas nao havia
como consultar esses registros nem corrigir um arquivamento acidental. Na
pratica, a interface apresentava uma acao destrutiva sem desfazer e exigia
intervencao direta no banco para recuperar o cadastro.

## Entregue

### Lixeira de pacientes

`GET /pacientes/arquivados` lista somente pacientes arquivados que o usuario
pode enxergar. Professional continua limitado a propria carteira; SuperAdmin
respeita o tenant da sessao. A consulta e paginada, ordenada pelo arquivamento
mais recente e exige `pacientes.listar`.

`PATCH /pacientes/:id/restaurar` limpa `arquivado_em` sem recriar o paciente,
preservando prontuario, agenda, documentos, formularios e demais vinculos. A
restauracao exige `pacientes.gerenciar`, aplica o mesmo escopo profissional da
edicao e volta a validar o limite de pacientes do plano. Se o plano estiver no
limite, o registro permanece na lixeira.

Novos arquivamentos deixam de sobrescrever `status_adesao` com `inativo`.
Assim, restaurar devolve o paciente com a situacao clinica que tinha antes do
arquivamento. Registros arquivados por versoes anteriores podem continuar com
`inativo`, porque o valor anterior ja foi perdido e nao deve ser inventado.

### Lixeira de profissionais

`GET /profissionais/arquivados` e
`PATCH /profissionais/:id/restaurar` sao exclusivos de SuperAdmin com
`profissionais.gerenciar`. A restauracao limpa `arquivado_em` no perfil e
reativa o usuario associado.

Refresh tokens revogados no arquivamento nao sao restaurados. O profissional
volta a poder entrar com uma nova autenticacao, sem recuperar sessoes que ja
foram encerradas.

### Auditoria e interface

Listagem e restauracao registram eventos proprios na auditoria:
`pacientes.lixeira.listar`, `pacientes.restaurar`,
`profissionais.lixeira.listar` e `profissionais.restaurar`.

Na web, pacientes ganharam botao de lixeira, restauracao por registro e acao
imediata "Desfazer" depois do arquivamento. A tela de profissionais ganhou uma
aba de lixeira com a mesma recuperacao. As acoes mutaveis de pacientes so
aparecem com `pacientes.gerenciar`; gestao e lixeira de profissionais exigem
simultaneamente o papel SuperAdmin e `profissionais.gerenciar`.

Os BFFs repetem a verificacao de permissao antes de consultar o backend. A
autorizacao do backend continua sendo a barreira definitiva.

## Testes e validacoes

- `servico-pacientes.spec.ts`: escopo da lixeira, preservacao do status e
  restauracao sujeita ao limite do plano.
- `servico-profissionais.spec.ts`: listagem arquivada e reativacao sem reviver
  refresh tokens.
- `controlador-pacientes.spec.ts` e `controlador-profissionais.spec.ts`:
  permissoes, papel e auditoria das novas rotas.
- Backend: `697` testes em `99` suites, `typecheck` aprovado.
- Web: `typecheck`, `lint`, `test:authz`, `test:next15` (`69` arquivos) e
  `build` (`116` paginas) aprovados.

Nenhuma migration foi criada. As colunas `arquivado_em`, os relacionamentos e
as regras de RLS existentes foram reutilizados.

## Limites conhecidos

- A interface carrega ate 100 itens por abertura da lixeira; os endpoints ja
  suportam paginacao para evoluir a tela sem alterar o contrato.
- O desfazer fica disponivel durante a permanencia da mensagem de sucesso; a
  restauracao permanente continua acessivel pela lixeira.
- Esta fase cobre os dois cadastros que ja tinham arquivamento logico explicito:
  pacientes e profissionais. Outros modulos so devem ganhar lixeira quando
  houver semantica de arquivamento e vinculos definida, em vez de simular
  recuperacao sobre exclusao fisica.
