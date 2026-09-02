import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CONSULTA_PRIVILEGIO_POSTGRES,
  PrivilegioRolePostgres,
  RelatorioMenorPrivilegio,
  ResultadoVerificacao,
  avaliarPrivilegioRolePostgres,
  montarRelatorio
} from './menor-privilegio-providers';

/**
 * Mede o menor privilegio dos providers no processo real e guarda o resultado.
 *
 * Roda uma vez no bootstrap para que a evidencia exista no log do deploy, e
 * fica disponivel sob demanda em `GET /operacoes/providers`, que exige
 * SuperAdmin. O relatorio nao entra em `/health/detalhado` por dois motivos:
 * aquele endpoint e publico e nao autenticado, e a licao de 2026-08-22 diz que
 * check novo nao deve mexer na saude global antes de ser medido no ambiente
 * real.
 */
@Injectable()
export class ServicoMenorPrivilegioProviders implements OnApplicationBootstrap {
  private readonly logger = new Logger(ServicoMenorPrivilegioProviders.name);
  private ultimoRelatorio?: RelatorioMenorPrivilegio;

  constructor(private readonly fonteDados: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const relatorio = await this.avaliar();
    const resumo = {
      ambiente: relatorio.ambiente,
      veredicto: relatorio.veredicto,
      postgres: relatorio.postgres.veredicto,
      redis: relatorio.redis.veredicto,
      armazenamento: relatorio.armazenamento.veredicto
    };

    if (relatorio.veredicto === 'violado') {
      // Nivel `error` de proposito: e o sinal que o monitor externo e a revisao
      // de deploy precisam ver. A mensagem carrega motivo, nunca host, role ou
      // credencial.
      this.logger.error(
        `Menor privilegio de providers violado: ${this.motivos(relatorio).join(' ')}`,
        undefined,
        JSON.stringify(resumo)
      );
      return;
    }

    this.logger.log(`Menor privilegio de providers: ${JSON.stringify(resumo)}`);
  }

  async avaliar(): Promise<RelatorioMenorPrivilegio> {
    const relatorio = montarRelatorio(await this.verificarPostgres());
    this.ultimoRelatorio = relatorio;
    return relatorio;
  }

  obterUltimoRelatorio(): RelatorioMenorPrivilegio | undefined {
    return this.ultimoRelatorio;
  }

  private async verificarPostgres(): Promise<ResultadoVerificacao> {
    if (!this.fonteDados.isInitialized) {
      return { veredicto: 'nao-verificado', motivos: ['DataSource nao inicializado.'] };
    }

    try {
      const linhas = (await this.fonteDados.query(CONSULTA_PRIVILEGIO_POSTGRES)) as PrivilegioRolePostgres[];
      return avaliarPrivilegioRolePostgres(linhas?.[0]);
    } catch (erro) {
      // Uma role sem leitura em `pg_roles` e um estado legitimo e restritivo;
      // tratar a falha como violacao criaria alarme falso. Fica
      // `nao-verificado`, que o relatorio ja distingue de aprovacao.
      return {
        veredicto: 'nao-verificado',
        motivos: [`A consulta de privilegio falhou: ${erro instanceof Error ? erro.message : 'erro desconhecido'}.`]
      };
    }
  }

  private motivos(relatorio: RelatorioMenorPrivilegio): string[] {
    return [...relatorio.postgres.motivos, ...relatorio.redis.motivos, ...relatorio.armazenamento.motivos];
  }
}
