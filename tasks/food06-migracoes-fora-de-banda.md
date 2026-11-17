# FOOD06 — aplicação fora de banda das migrations 1083 a 1086

Roteiro para o proprietário. Não contém credenciais. **Nada aqui foi executado em staging nem em produção pelo agente.**
Segue a regra do `AGENTS.md`: confirmar ambiente, banco, branch e role antes de qualquer DDL, aplicar com a role owner, fora do
runtime, primeiro em staging e só depois em produção, verificando o resultado antes de publicar o backend.

## Por que a ordem importa

A `main` já chama, em toda desativação de conta, troca de papel, arquivamento de profissional e (depois da #552) desativação de
conta, arquivamento e eliminação de paciente, as cascatas que leem `delegacoes_carteira_profissional` e
`vinculos_representacao_paciente` (1085). **Isso vale com a flag `restricoes.clinicas` desligada.** Publicar o backend da `main`
num banco sem a 1085 faz essas operações falharem. O health check de migrations acusa o atraso.

| Ordem | Migration | O que faz | Observação |
| --- | --- | --- | --- |
| 1 | `1720000001083-RestricoesAlimentares` | Tabelas vazias de restrições (RLS FORCE, cifradas) | Aditiva |
| 2 | `1720000001084-ConcessoesPermissaoUsuario` | Concessão `restricoes.confirmar` | Segundo o proprietário, já aplicada; conferir no ledger |
| 3 | `1720000001085-DelegacoesCarteiraEVinculosRepresentacao` | Delegação de carteira e vínculo de representação, vazias | Aditiva |
| 4 | `1720000001086-ContaUnicaPaciente` | Índice único parcial `pacientes (tenant_id, usuario_id) where usuario_id is not null` | Recusa aplicar se houver duplicata |

## Antes da 1086: checagem de duplicatas (somente leitura)

Rodar com a role owner, em transação de leitura, e anotar **só a contagem** (sem copiar identificadores para chat, issue ou PR):

```sql
select count(*) as grupos_duplicados from (
  select tenant_id, usuario_id from pacientes
   where usuario_id is not null
   group by tenant_id, usuario_id having count(*) > 1) d;
```

- **0:** pode aplicar a 1086.
- **Maior que 0:** não aplicar. Cada grupo é uma conta de acesso ligada a mais de uma ficha (o portal legado já falha fechado
  nesse caso). Decidir caso a caso qual ficha fica com a conta, com quem administra a clínica; a correção de dado é uma operação
  própria, autorizada e auditada, fora deste roteiro.

A 1086 cria o índice com `lock table pacientes in share row exclusive mode`: as escritas em `pacientes` esperam durante a criação.
Aplicar em janela de baixo uso.

## Depois de cada migration

- Conferir no ledger (`migrations` do TypeORM) que a versão consta uma única vez.
- 1083 e 1085: `relrowsecurity` e `relforcerowsecurity` verdadeiros nas tabelas novas.
- 1086: o índice `ux_pacientes_conta_unica` existe.
- Health check do backend sem "migrations pendentes".

## Rollback

- 1083 e 1085: o `down` só roda com as tabelas vazias, em transação READ COMMITTED; recusa se houver dado.
- 1086: o `down` só remove o índice; nenhum dado muda.
- A flag `restricoes.clinicas` continua desligada; ligá-la depende dos bloqueios ATV-1 a ATV-9.
