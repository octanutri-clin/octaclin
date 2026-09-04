import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Torna `user_action_logs` append-only no banco (EXC-AUD-003 do PR 52).
 *
 * A fase 1 entregou a trilha e a redacao de metadados, e a norma passou a
 * afirmar em varios pontos que "a trilha e imutavel". Ate aqui isso era uma
 * frase: qualquer conexao com `update`/`delete` na tabela -- e a role de runtime
 * tem os dois, porque o mesmo grant serve todas as tabelas -- podia reescrever
 * ou apagar registro de acesso. Um modulo que afirma garantia que nao entrega e
 * exatamente o defeito que a fase 1 encontrou; esta migration troca a frase por
 * mecanismo.
 *
 * ## Por que trigger, e nao `REVOKE`, como mecanismo primario
 *
 * `REVOKE UPDATE, DELETE` so protege se a migration souber o nome da role de
 * runtime. O repo conhece dois nomes (`octaclin_runtime_integracao` e
 * `octaclin_app_producao`, fixados na migration 1030), mas nao ha nada que
 * obrigue um ambiente a usar um deles -- a conexao vem de `DATABASE_URL`, e em
 * provedor gerenciado o backend costuma conectar como o proprio dono do banco.
 * Nos dois casos o `REVOKE` hardcoded falha do pior jeito possivel: roda sem
 * erro, o CI fica verde, e a tabela continua mutavel. Pior ainda: `REVOKE`
 * contra o dono da tabela nao tem efeito nenhum, porque o dono tem direito
 * implicito sobre ela.
 *
 * O trigger e agnostico de role. Ele avalia no momento do DML e levanta excecao
 * para qualquer um que tente `UPDATE` ou `DELETE` -- inclusive o dono e
 * inclusive um superusuario. E o unico dos mecanismos disponiveis que protege
 * sem depender de um fato de ambiente que a migration nao pode verificar.
 *
 * O `REVOKE` continua aqui como defesa em profundidade, condicionado a
 * existencia da role (mesmo padrao da migration 1030): onde o nome bate, a
 * mutacao morre antes de chegar ao trigger; onde nao bate, nao faz nada, e essa
 * e a razao de ele nao ser o mecanismo e sim o reforco.
 *
 * ## Detalhes que parecem opcionais e nao sao
 *
 * - `enable always`: um trigger comum e ignorado quando a sessao esta com
 *   `session_replication_role = 'replica'`, modo usado por replicacao logica e
 *   por restore. `always` o mantem ativo nesse modo. Nao atrapalha restore
 *   porque restore so faz `INSERT`/`COPY`, que continuam livres.
 * - trigger separado de `TRUNCATE`: trigger de linha nao enxerga `TRUNCATE`.
 *   Sem o de statement, um unico `truncate user_action_logs` apagaria a trilha
 *   inteira sem disparar nada -- o furo mais barato de explorar.
 * - `errcode = '42501'` (insufficient_privilege) deliberado: e a mesma classe
 *   que o `REVOKE` produz. Quem trata o erro nao precisa saber qual das duas
 *   camadas barrou a mutacao.
 * - `INSERT` continua livre: os dois unicos caminhos de escrita legitimos
 *   (`ServicoAuditoria.registrar` e `registrarAuditoriaNaTransacao`) so
 *   inserem, e nenhum deles precisou mudar por causa desta migration.
 *
 * ## O que este mecanismo NAO cobre -- limites declarados, nao esquecidos
 *
 * 1. Nao protege contra quem e dono da tabela e age no nivel do catalogo:
 *    `alter table ... disable trigger` e `drop trigger` continuam possiveis, e
 *    uma migration futura pode remover isto sem cerimonia. Imutabilidade contra
 *    o administrador do banco nao existe aqui; detectar essa remocao exige
 *    monitoramento de `pg_trigger.tgenabled` fora do banco, que nao esta neste
 *    PR.
 * 2. Nao ha hash-chain. O trigger *impede* a mutacao pelo caminho SQL; ele nao
 *    *prova* que nao houve adulteracao. Escrita direta no arquivo de dados,
 *    restore de um dump adulterado ou um `DELETE` feito depois de desabilitar o
 *    trigger nao deixam evidencia detectavel pela propria tabela.
 * 3. Nao e WORM. O storage continua regravavel; retencao imutavel de backup e
 *    controle de infraestrutura, fora do alcance de uma migration.
 * 4. Consequencia operacional assumida: apagar linha da trilha -- inclusive por
 *    pedido de eliminacao LGPD -- passa a exigir procedimento fora de banda que
 *    desabilite o trigger com role administrativa. O que mantem dado pessoal
 *    fora da trilha em primeiro lugar continua sendo a redacao de metadados da
 *    fase 1, e nao a possibilidade de apagar depois.
 *
 * @aplicacao fora-de-banda
 */
export class TornarTrilhaAuditoriaImutavel1720000001038 implements MigrationInterface {
  name = 'TornarTrilhaAuditoriaImutavel1720000001038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create or replace function rejeitar_mutacao_trilha_auditoria()
      returns trigger
      language plpgsql
      as $$
      begin
        raise exception
          'user_action_logs e append-only: % rejeitado pela trilha de auditoria.', tg_op
          using errcode = '42501';
      end;
      $$;
    `);

    await queryRunner.query(`
      drop trigger if exists trg_trilha_auditoria_append_only on user_action_logs;
      create trigger trg_trilha_auditoria_append_only
        before update or delete on user_action_logs
        for each row execute function rejeitar_mutacao_trilha_auditoria();
      alter table user_action_logs
        enable always trigger trg_trilha_auditoria_append_only;
    `);

    await queryRunner.query(`
      drop trigger if exists trg_trilha_auditoria_sem_truncate on user_action_logs;
      create trigger trg_trilha_auditoria_sem_truncate
        before truncate on user_action_logs
        for each statement execute function rejeitar_mutacao_trilha_auditoria();
      alter table user_action_logs
        enable always trigger trg_trilha_auditoria_sem_truncate;
    `);

    // Defesa em profundidade. `public` nao recebe grant nenhum por padrao nesta
    // tabela; o revoke existe para que um `grant ... to public` futuro nao
    // reabra a mutacao por engano. As roles nomeadas sao as mesmas da migration
    // 1030 -- se o ambiente usar outro nome, este bloco nao faz nada, e o
    // trigger acima continua sendo o que protege.
    await queryRunner.query(`
      revoke update, delete, truncate on user_action_logs from public;

      do $$
      declare
        papel text;
      begin
        foreach papel in array array['octaclin_runtime_integracao', 'octaclin_app_producao'] loop
          if exists (select 1 from pg_roles where rolname = papel) then
            execute format('revoke update, delete, truncate on user_action_logs from %I', papel);
          end if;
        end loop;
      end;
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // O rollback devolve o estado anterior de verdade: sem os triggers a tabela
    // volta a ser mutavel, entao o grant que existia antes precisa voltar junto,
    // ou o rollback deixaria um estado que nunca existiu. `truncate` nao volta
    // porque nunca foi concedido -- o provisionamento da role de runtime
    // concede apenas select/insert/update/delete.
    await queryRunner.query('drop trigger if exists trg_trilha_auditoria_sem_truncate on user_action_logs;');
    await queryRunner.query('drop trigger if exists trg_trilha_auditoria_append_only on user_action_logs;');
    await queryRunner.query('drop function if exists rejeitar_mutacao_trilha_auditoria();');
    await queryRunner.query(`
      do $$
      declare
        papel text;
      begin
        foreach papel in array array['octaclin_runtime_integracao', 'octaclin_app_producao'] loop
          if exists (select 1 from pg_roles where rolname = papel) then
            execute format('grant update, delete on user_action_logs to %I', papel);
          end if;
        end loop;
      end;
      $$;
    `);
  }
}
