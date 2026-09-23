import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { ExpedienteProfissionalOrm } from '../infraestrutura/expediente-profissional.orm';
import { FaixaExpedienteRespostaDto, SalvarExpedienteDto } from './dtos';

function minutosDoDia(horaMinuto: string): number {
  const [hora, minuto] = horaMinuto.split(':').map(Number);
  return hora * 60 + minuto;
}

function faixasSobrepoem(a: { diaSemana: number; horaInicio: string; horaFim: string }, b: typeof a): boolean {
  if (a.diaSemana !== b.diaSemana) return false;
  return minutosDoDia(a.horaInicio) < minutosDoDia(b.horaFim) && minutosDoDia(b.horaInicio) < minutosDoDia(a.horaFim);
}

/**
 * Jornada semanal por profissional (PB-18, Fase 276): substituicao sempre da
 * jornada inteira (delete + insert numa transacao), nunca incremental --
 * mais simples que CRUD por faixa e evita faixa orfa esquecida. Sem nenhuma
 * faixa salva, o profissional continua sem restricao de horario no
 * agendamento publico (mesmo comportamento de antes desta fase).
 */
@Injectable()
export class ServicoExpedientes {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async obter(
    tenantId: string,
    usuario: UsuarioAutenticado,
    profissionalIdConsultado?: string
  ): Promise<FaixaExpedienteRespostaDto[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissional = await this.resolverProfissionalAlvo(gerenciador, tenantId, usuario, profissionalIdConsultado);
      const faixas = await gerenciador.getRepository(ExpedienteProfissionalOrm).find({
        where: { tenantId, profissionalId: profissional.id },
        order: { diaSemana: 'ASC', horaInicio: 'ASC' }
      });
      return faixas.map((faixa) => this.mapear(faixa));
    });
  }

  async salvar(
    tenantId: string,
    dados: SalvarExpedienteDto,
    usuario: UsuarioAutenticado
  ): Promise<FaixaExpedienteRespostaDto[]> {
    this.validarFaixas(dados.faixas);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissional = await this.resolverProfissionalAlvo(gerenciador, tenantId, usuario, dados.profissionalId);
      const repositorio = gerenciador.getRepository(ExpedienteProfissionalOrm);

      await repositorio.delete({ tenantId, profissionalId: profissional.id });
      const salvas = dados.faixas.length
        ? await repositorio.save(
            dados.faixas.map((faixa) =>
              repositorio.create({
                tenantId,
                profissionalId: profissional.id,
                diaSemana: faixa.diaSemana,
                horaInicio: faixa.horaInicio,
                horaFim: faixa.horaFim
              })
            )
          )
        : [];

      await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId,
        usuarioId: usuario.usuarioId,
        acao: 'agenda.expediente.salvar',
        recursoTipo: 'expediente_profissional',
        recursoId: profissional.id,
        metadados: { totalFaixas: salvas.length }
      });

      return salvas
        .slice()
        .sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio))
        .map((faixa) => this.mapear(faixa));
    });
  }

  private validarFaixas(faixas: SalvarExpedienteDto['faixas']): void {
    for (const faixa of faixas) {
      if (minutosDoDia(faixa.horaFim) <= minutosDoDia(faixa.horaInicio)) {
        throw new BadRequestException('horaFim deve ser posterior a horaInicio em cada faixa do expediente.');
      }
    }
    for (let i = 0; i < faixas.length; i += 1) {
      for (let j = i + 1; j < faixas.length; j += 1) {
        if (faixasSobrepoem(faixas[i], faixas[j])) {
          throw new BadRequestException('Faixas de expediente do mesmo dia nao podem se sobrepor.');
        }
      }
    }
  }

  private async resolverProfissionalAlvo(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado,
    profissionalIdConsultado?: string
  ): Promise<ProfissionalOrm> {
    const profissionalIdDoUsuario = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const profissionalId = profissionalIdDoUsuario ?? profissionalIdConsultado;
    if (!profissionalId) throw new BadRequestException('Selecione um profissional para configurar o expediente.');

    const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
      where: { id: profissionalId, tenantId, arquivadoEm: IsNull() }
    });
    if (!profissional) throw new NotFoundException('Profissional nao encontrado.');
    return profissional;
  }

  private mapear(faixa: ExpedienteProfissionalOrm): FaixaExpedienteRespostaDto {
    return {
      id: faixa.id,
      diaSemana: faixa.diaSemana,
      horaInicio: faixa.horaInicio.slice(0, 5),
      horaFim: faixa.horaFim.slice(0, 5)
    };
  }
}
