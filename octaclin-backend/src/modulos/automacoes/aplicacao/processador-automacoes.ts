import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { In } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { OPCOES_WORKER_BULLMQ } from '../../../infraestrutura/processamento/opcoes-worker-bullmq';
import {
  ContratoAcaoAutomacaoInvalido,
  ResultadoAcaoAutomacao,
  criarResultadosAcoes,
  validarAcoesAutomacao
} from '../dominio/acoes-automacao';
import { avaliarCondicoes } from '../dominio/avaliador-regras';
import { ExecucaoRegraOrm } from '../infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';
import {
  DespachanteAcoesAutomacao,
  FalhaDefinitivaAcaoAutomacao
} from './despachante-acoes-automacao';
import { FILA_AUTOMACOES } from './servico-automacoes';

interface JobAutomacao {
  tenantId: string;
  execucaoId: string;
  contexto: Record<string, unknown>;
}

interface ExecucaoPreparada {
  regra: RegraAutomacaoOrm;
  execucao: ExecucaoRegraOrm;
  acoes: ResultadoAcaoAutomacao[];
}

@Injectable()
@Processor(FILA_AUTOMACOES, OPCOES_WORKER_BULLMQ)
export class ProcessadorAutomacoes extends WorkerHost {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly despachanteAcoes: DespachanteAcoesAutomacao
  ) {
    super();
  }

  async process(job: Job<JobAutomacao>): Promise<void> {
    const preparada = await this.preparar(job);
    if (!preparada) return;

    for (const resultadoAcao of preparada.acoes) {
      if (resultadoAcao.status === 'executada' || resultadoAcao.status === 'ignorada') continue;
      const acao = preparada.regra.acoes[resultadoAcao.indice];
      const emExecucao = await this.marcarAcaoExecutando(job.data.tenantId, preparada.execucao.id, resultadoAcao);

      try {
        const resultado = await this.despachanteAcoes.executar({
          tenantId: job.data.tenantId,
          execucaoId: preparada.execucao.id,
          regraId: preparada.regra.id,
          profissionalId: preparada.regra.profissionalId,
          pacienteId: preparada.execucao.pacienteId,
          contexto: job.data.contexto,
          acao,
          chaveIdempotencia: emExecucao.chaveIdempotencia
        });
        await this.registrarSucessoAcao(job.data.tenantId, preparada.execucao.id, emExecucao, resultado);
      } catch (erro) {
        const deveRetentar = this.erroRetriavel(erro) && this.possuiNovaTentativa(job);
        await this.registrarFalhaAcao(job.data.tenantId, preparada.execucao.id, emExecucao, erro, deveRetentar);
        if (deveRetentar) throw erro;
        return;
      }
    }

    await this.finalizar(job.data.tenantId, preparada.execucao.id);
  }

  private preparar(job: Job<JobAutomacao>): Promise<ExecucaoPreparada | null> {
    return this.executorTenant.executar(job.data.tenantId, async (gerenciador) => {
      const repositorioExecucoes = gerenciador.getRepository(ExecucaoRegraOrm);
      const statusPermitido = this.ehRetomada(job)
        ? In<ExecucaoRegraOrm['status']>(['pendente', 'processando'])
        : 'pendente';
      const reivindicacao = await repositorioExecucoes.update(
        { id: job.data.execucaoId, tenantId: job.data.tenantId, status: statusPermitido },
        { status: 'processando', erro: null }
      );
      if (!reivindicacao.affected) return null;

      const execucao = await repositorioExecucoes.findOne({
        where: { id: job.data.execucaoId, tenantId: job.data.tenantId }
      });
      if (!execucao) return null;

      const regra = await gerenciador.getRepository(RegraAutomacaoOrm).findOne({
        where: { id: execucao.regraId, tenantId: job.data.tenantId, ativa: true }
      });
      if (!regra) {
        execucao.status = 'falhou';
        execucao.erro = 'Regra de automacao nao encontrada ou inativa.';
        await repositorioExecucoes.save(execucao);
        return null;
      }

      try {
        regra.acoes = validarAcoesAutomacao(regra.acoes);
      } catch (erro) {
        execucao.status = 'falhou';
        execucao.erro =
          erro instanceof ContratoAcaoAutomacaoInvalido
            ? 'Configuracao de acoes da regra e invalida.'
            : 'Falha ao validar a configuracao de acoes.';
        await repositorioExecucoes.save(execucao);
        return null;
      }

      const avaliacao = avaliarCondicoes(regra.condicoes, job.data.contexto);
      if (!avaliacao.executar) {
        execucao.status = 'ignorado';
        execucao.resultado = {
          executar: false,
          motivos: avaliacao.motivos,
          acoesPlanejadas: [],
          acoes: [],
          contexto: job.data.contexto
        };
        await repositorioExecucoes.save(execucao);
        return null;
      }

      const anteriores = execucao.resultado?.acoes;
      const acoes = criarResultadosAcoes(execucao.id, regra.acoes, 'pendente', anteriores);
      execucao.resultado = {
        executar: true,
        motivos: avaliacao.motivos,
        acoesPlanejadas: regra.acoes,
        acoes,
        contexto: job.data.contexto
      };
      await repositorioExecucoes.save(execucao);
      return { regra, execucao, acoes };
    });
  }

  private marcarAcaoExecutando(
    tenantId: string,
    execucaoId: string,
    resultadoAcao: ResultadoAcaoAutomacao
  ): Promise<ResultadoAcaoAutomacao> {
    return this.atualizarAcao(tenantId, execucaoId, resultadoAcao.indice, (atual) => ({
      ...atual,
      status: 'executando',
      tentativas: atual.tentativas + 1,
      codigoErro: undefined
    }));
  }

  private async registrarSucessoAcao(
    tenantId: string,
    execucaoId: string,
    resultadoAcao: ResultadoAcaoAutomacao,
    resultado: { status: 'executada' | 'ignorada' }
  ): Promise<void> {
    await this.atualizarAcao(tenantId, execucaoId, resultadoAcao.indice, (atual) => ({
      ...atual,
      status: resultado.status
    }));
  }

  private async registrarFalhaAcao(
    tenantId: string,
    execucaoId: string,
    resultadoAcao: ResultadoAcaoAutomacao,
    erro: unknown,
    deveRetentar: boolean
  ): Promise<void> {
    const falhaDefinitiva = erro instanceof FalhaDefinitivaAcaoAutomacao;
    const mensagem = falhaDefinitiva
      ? erro.message
      : deveRetentar
        ? 'Falha temporaria ao executar acao de automacao.'
        : 'Falha definitiva ao executar acao de automacao.';
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ExecucaoRegraOrm);
      const execucao = await repositorio.findOne({ where: { id: execucaoId, tenantId } });
      if (!execucao) return;
      const acoes = this.resultadosDaExecucao(execucao);
      acoes[resultadoAcao.indice] = {
        ...acoes[resultadoAcao.indice],
        status: deveRetentar ? 'pendente' : 'falhou',
        codigoErro: falhaDefinitiva ? erro.codigo : 'falha_execucao'
      };
      execucao.status = deveRetentar ? 'pendente' : 'falhou';
      execucao.erro = mensagem;
      execucao.resultado = { ...execucao.resultado, acoes };
      await repositorio.save(execucao);
    });
  }

  private async finalizar(tenantId: string, execucaoId: string): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ExecucaoRegraOrm);
      const execucao = await repositorio.findOne({ where: { id: execucaoId, tenantId } });
      if (!execucao || execucao.status !== 'processando') return;
      const acoes = this.resultadosDaExecucao(execucao);
      execucao.status = acoes.some((acao) => acao.status === 'executada') ? 'executado' : 'ignorado';
      execucao.erro = null;
      await repositorio.save(execucao);
    });
  }

  private atualizarAcao(
    tenantId: string,
    execucaoId: string,
    indice: number,
    alterar: (atual: ResultadoAcaoAutomacao) => ResultadoAcaoAutomacao
  ): Promise<ResultadoAcaoAutomacao> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ExecucaoRegraOrm);
      const execucao = await repositorio.findOne({ where: { id: execucaoId, tenantId, status: 'processando' } });
      if (!execucao) throw new Error('Execucao de regra nao esta disponivel para atualizar a acao.');
      const acoes = this.resultadosDaExecucao(execucao);
      const atualizada = alterar(acoes[indice]);
      acoes[indice] = atualizada;
      execucao.resultado = { ...execucao.resultado, acoes };
      await repositorio.save(execucao);
      return atualizada;
    });
  }

  private resultadosDaExecucao(execucao: ExecucaoRegraOrm): ResultadoAcaoAutomacao[] {
    const acoes = execucao.resultado?.acoes;
    if (!Array.isArray(acoes)) throw new Error('Plano de acoes da execucao nao encontrado.');
    return [...(acoes as ResultadoAcaoAutomacao[])];
  }

  private possuiNovaTentativa(job: Job<JobAutomacao>): boolean {
    return job.attemptsMade + 1 < Number(job.opts.attempts ?? 1);
  }

  private ehRetomada(job: Job<JobAutomacao>): boolean {
    return job.attemptsMade > 0 || job.stalledCounter > 0 || job.attemptsStarted > 1;
  }

  private erroRetriavel(erro: unknown): boolean {
    return !(erro instanceof FalhaDefinitivaAcaoAutomacao);
  }
}
