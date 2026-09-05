import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ambienteExigeFalhaFechada } from './ambiente-execucao';
import {
  CONSULTA_PRIVILEGIO_POSTGRES,
  PrivilegioRolePostgres,
  RelatorioMenorPrivilegio,
  ResultadoVerificacao,
  avaliarPrivilegioRolePostgres,
  montarRelatorio,
  motivoDeBloqueio
} from './menor-privilegio-providers';

/**
 * Mede o menor privilegio dos providers no processo real e guarda o resultado.
 *
 * Roda uma vez no bootstrap e, em staging e producao, derruba o processo quando
 * `motivoDeBloqueio` aponta um motivo. Fica tambem disponivel sob demanda em
 * `GET /operacoes/providers`, que exige SuperAdmin.
 *
 * O relatorio nao entra em `/health/detalhado`: aquele endpoint e publico e nao
 * autenticado, e dizer a um anonimo qual provider esta fora de conformidade
 * seria entregar o mapa.
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

    const bloqueio = motivoDeBloqueio(relatorio);
    if (bloqueio) {
      // Nivel `error` de proposito: e o sinal que o monitor externo e a revisao
      // de deploy precisam ver. A mensagem carrega motivo, nunca host, role ou
      // credencial.
      this.logger.error(
        `Menor privilegio de providers: ${bloqueio} ${this.motivos(relatorio).join(' ')}`.trim(),
        undefined,
        JSON.stringify(resumo)
      );

      // Fora de staging e producao a medicao continua sendo so observacao: um
      // MinIO local em `http://` ou um Postgres de desenvolvimento com role
      // ampla nao sao motivo para impedir alguem de rodar o projeto.
      if (ambienteExigeFalhaFechada()) throw new Error(bloqueio);
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
