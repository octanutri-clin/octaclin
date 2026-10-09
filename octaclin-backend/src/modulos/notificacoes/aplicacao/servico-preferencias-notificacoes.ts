import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import {
  MODO_ENTREGA_PADRAO,
  TIMEZONE_NOTIFICACAO_PADRAO,
  TIPOS_NOTIFICACAO_CONFIGURAVEIS,
  TIPOS_NOTIFICACAO_OBRIGATORIOS,
  type TipoNotificacaoConfiguravel
} from '../dominio/politica-notificacoes';
import { validarTimezoneNotificacao } from '../dominio/calendario-resumo';
import { PreferenciaNotificacaoUsuarioOrm } from '../infraestrutura/preferencia-notificacao-usuario.orm';
import { NotificacaoOrm } from '../infraestrutura/notificacao.orm';
import { ResumoNotificacaoUsuarioOrm } from '../infraestrutura/resumo-notificacao-usuario.orm';
import { PreferenciasNotificacaoDto } from './dtos';

const PAPÉIS_CONSOLE = ['SuperAdmin', 'Professional', 'Collaborator'] as const;

export interface PreferenciasNotificacaoResposta {
  modos: Record<TipoNotificacaoConfiguravel, string>;
  timezone: string;
  emailResumo: boolean;
  classesElegiveis: readonly TipoNotificacaoConfiguravel[];
  tiposObrigatorios: typeof TIPOS_NOTIFICACAO_OBRIGATORIOS;
}

@Injectable()
export class ServicoPreferenciasNotificacoes {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async obter(usuario: UsuarioAutenticado): Promise<PreferenciasNotificacaoResposta> {
    return this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      await this.usuarioAtivo(gerenciador, usuario);
      const preferencia = await gerenciador.getRepository(PreferenciaNotificacaoUsuarioOrm).findOne({
        where: { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId }
      });
      const elegiveis: readonly TipoNotificacaoConfiguravel[] = usuario.papel === 'Collaborator' ? [] : TIPOS_NOTIFICACAO_CONFIGURAVEIS;
      return {
        modos: {
          formulario_respondido: elegiveis.includes('formulario_respondido')
            ? preferencia?.modoFormularioRespondido ?? MODO_ENTREGA_PADRAO : MODO_ENTREGA_PADRAO,
          tarefa_concluida: elegiveis.includes('tarefa_concluida')
            ? preferencia?.modoTarefaConcluida ?? MODO_ENTREGA_PADRAO : MODO_ENTREGA_PADRAO,
          automacao_executada: elegiveis.includes('automacao_executada')
            ? preferencia?.modoAutomacaoExecutada ?? MODO_ENTREGA_PADRAO : MODO_ENTREGA_PADRAO
        },
        timezone: preferencia?.timezone ?? TIMEZONE_NOTIFICACAO_PADRAO,
        emailResumo: usuario.papel !== 'Collaborator' && (preferencia?.emailResumo ?? false),
        classesElegiveis: elegiveis,
        tiposObrigatorios: TIPOS_NOTIFICACAO_OBRIGATORIOS
      };
    });
  }

  async salvar(usuario: UsuarioAutenticado, dados: PreferenciasNotificacaoDto): Promise<PreferenciasNotificacaoResposta> {
    let timezone: string;
    try {
      timezone = validarTimezoneNotificacao(dados.timezone);
    } catch {
      throw new BadRequestException('Fuso horario invalido.');
    }
    const temDigest = Object.values(dados.modos).some((modo) => modo === 'diario' || modo === 'semanal');
    if (dados.emailResumo && !temDigest) {
      throw new BadRequestException('Ative pelo menos um resumo interno antes do resumo por e-mail.');
    }
    if (usuario.papel === 'Collaborator' &&
        (Object.values(dados.modos).some((modo) => modo !== MODO_ENTREGA_PADRAO) || dados.emailResumo)) {
      throw new ForbiddenException('Este papel nao possui classes opcionais de notificacao.');
    }

    return this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      await this.usuarioAtivo(gerenciador, usuario, true);
      const repositorio = gerenciador.getRepository(PreferenciaNotificacaoUsuarioOrm);
      const atual = await repositorio.findOne({
        where: { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId }
      });
      const preferencias = repositorio.create({
        ...atual,
        tenantId: usuario.tenantId,
        usuarioId: usuario.usuarioId,
        modoFormularioRespondido: dados.modos.formulario_respondido,
        modoTarefaConcluida: dados.modos.tarefa_concluida,
        modoAutomacaoExecutada: dados.modos.automacao_executada,
        timezone,
        emailResumo: usuario.papel !== 'Collaborator' && dados.emailResumo
      });
      await repositorio.save(preferencias);

      if (!dados.emailResumo) {
        const agora = new Date();
        await gerenciador.getRepository(NotificacaoOrm).update({
          tenantId: usuario.tenantId,
          usuarioId: usuario.usuarioId,
          resumoId: IsNull(),
          emailResumo: true,
          emailCanceladoEm: IsNull()
        }, { emailCanceladoEm: agora });
        await gerenciador.getRepository(ResumoNotificacaoUsuarioOrm).update({
          tenantId: usuario.tenantId,
          usuarioId: usuario.usuarioId,
          estadoEmail: 'pendente'
        }, { estadoEmail: 'cancelado', finalizadoEmailEm: agora });
      }
      return this.obterNoGerenciador(gerenciador, usuario);
    });
  }

  private async obterNoGerenciador(gerenciador: EntityManager, usuario: UsuarioAutenticado) {
    const preferencia = await gerenciador.getRepository(PreferenciaNotificacaoUsuarioOrm).findOne({
      where: { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId }
    });
    const elegiveis: readonly TipoNotificacaoConfiguravel[] = usuario.papel === 'Collaborator' ? [] : TIPOS_NOTIFICACAO_CONFIGURAVEIS;
    return {
      modos: {
        formulario_respondido: elegiveis.includes('formulario_respondido')
          ? preferencia?.modoFormularioRespondido ?? MODO_ENTREGA_PADRAO : MODO_ENTREGA_PADRAO,
        tarefa_concluida: elegiveis.includes('tarefa_concluida')
          ? preferencia?.modoTarefaConcluida ?? MODO_ENTREGA_PADRAO : MODO_ENTREGA_PADRAO,
        automacao_executada: elegiveis.includes('automacao_executada')
          ? preferencia?.modoAutomacaoExecutada ?? MODO_ENTREGA_PADRAO : MODO_ENTREGA_PADRAO
      },
      timezone: preferencia?.timezone ?? TIMEZONE_NOTIFICACAO_PADRAO,
      emailResumo: usuario.papel !== 'Collaborator' && (preferencia?.emailResumo ?? false),
      classesElegiveis: elegiveis,
      tiposObrigatorios: TIPOS_NOTIFICACAO_OBRIGATORIOS
    } satisfies PreferenciasNotificacaoResposta;
  }

  private async usuarioAtivo(
    gerenciador: EntityManager,
    usuario: UsuarioAutenticado,
    travar = false
  ): Promise<void> {
    if (!PAPÉIS_CONSOLE.includes(usuario.papel as (typeof PAPÉIS_CONSOLE)[number]) ||
        !usuario.permissoes.includes('console.acessar')) {
      throw new ForbiddenException();
    }
    const atual = await gerenciador.getRepository(UsuarioOrm).findOne({
      select: { id: true, role: true, ativo: true },
      where: { id: usuario.usuarioId, tenantId: usuario.tenantId },
      ...(travar ? { lock: { mode: 'pessimistic_write' as const } } : {})
    });
    if (!atual?.ativo || atual.role !== usuario.papel) throw new ForbiddenException();
  }
}
