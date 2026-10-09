import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, LessThan } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { PreferenciaNotificacaoUsuarioOrm } from '../infraestrutura/preferencia-notificacao-usuario.orm';
import { ResumoNotificacaoUsuarioOrm } from '../infraestrutura/resumo-notificacao-usuario.orm';
import { AdaptadorEmailSmtp } from '../../comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp';

const LIMITE_RESUMOS_RODADA = 50;
const PAPÉIS_COM_EMAIL = ['SuperAdmin', 'Professional'] as const;

interface EnvioReivindicado {
  resumoId: string;
  usuarioId: string;
  tentativaEm: Date;
  destino: string;
  origem: string;
  periodoInicio: Date;
  periodoFim: Date;
  contagens: Record<string, number>;
}

@Injectable()
export class ProcessadorEmailResumos {
  private readonly logger = new Logger(ProcessadorEmailResumos.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly email: AdaptadorEmailSmtp
  ) {}

  @Cron('*/30 * * * * *')
  async processarPendentes(): Promise<void> {
    await executarPorTenantAtivo(
      this.fonteDados,
      this.logger,
      'E-mail de resumos de notificacoes',
      async (tenantId) => {
        await this.marcarReservasVencidas(tenantId);
        const ids = await this.executorTenant.executar(tenantId, async (manager) => {
          const candidatas = await manager.getRepository(ResumoNotificacaoUsuarioOrm).find({
            select: { id: true },
            where: { tenantId, estadoEmail: 'pendente' },
            order: { geradoEm: 'ASC', id: 'ASC' },
            take: LIMITE_RESUMOS_RODADA
          });
          return candidatas.map(({ id }) => id);
        });
        for (const resumoId of ids) await this.processarUm(tenantId, resumoId);
      },
      { timeoutMs: 120_000 }
    );
  }

  private async marcarReservasVencidas(tenantId: string): Promise<void> {
    await this.executorTenant.executar(tenantId, async (manager) => {
      await manager.getRepository(ResumoNotificacaoUsuarioOrm).update({
        tenantId,
        estadoEmail: 'reservado',
        tentativaEmailEm: LessThan(new Date(Date.now() - 10 * 60_000))
      }, { estadoEmail: 'incerto', finalizadoEmailEm: new Date() });
    });
  }

  private async processarUm(tenantId: string, resumoId: string): Promise<void> {
    const preparado = await this.prepararEReivindicar(tenantId, resumoId);
    if (!preparado) return;

    try {
      const periodo = `${preparado.periodoInicio.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a ${preparado.periodoFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`;
      const texto = [
        'Seu resumo de notificações da OctaClin está disponível.',
        `Período: ${periodo}.`,
        ...Object.entries(preparado.contagens).filter(([, quantidade]) => quantidade > 0).map(([tipo, quantidade]) => `${this.rotulo(tipo)}: ${quantidade}.`),
        `Acesse sua conta: ${preparado.origem}/conta/notificacoes`
      ].join('\n');
      await this.email.enviar({
        canal: {
          id: 'resumo-notificacoes', tenantId, tipo: 'email', nome: 'Resumo de notificacoes', ativo: true, configuracao: {}
        },
        template: {
          id: 'resumo-notificacoes', tenantId, canal: 'email', nome: 'Resumo de notificacoes', aprovado: true,
          conteudo: { assunto: 'Seu resumo de notificações OctaClin', texto }
        },
        payload: { destino: preparado.destino, assunto: 'Seu resumo de notificações OctaClin', texto }
      });
      await this.finalizar(tenantId, preparado, 'enviado');
    } catch {
      // A chamada pode ter sido aceita pelo provedor antes da falha. Não tentar de novo.
      await this.finalizar(tenantId, preparado, 'incerto');
      this.logger.warn('Envio de resumo sem confirmacao; nao sera repetido.');
    }
  }

  private async prepararEReivindicar(tenantId: string, resumoId: string): Promise<EnvioReivindicado | undefined> {
    return this.executorTenant.executar(tenantId, async (manager) => {
      const resumoRepo = manager.getRepository(ResumoNotificacaoUsuarioOrm);
      const candidato = await resumoRepo.findOne({ where: { tenantId, id: resumoId } });
      if (!candidato) return undefined;

      // Ordem de locks user -> resumo também é usada por PUT e geração.
      const usuario = await manager.getRepository(UsuarioOrm).findOne({
        select: { id: true, tenantId: true, role: true, ativo: true, emailCriptografado: true },
        where: { id: candidato.usuarioId, tenantId },
        lock: { mode: 'pessimistic_write' }
      });
      const preferencia = await manager.getRepository(PreferenciaNotificacaoUsuarioOrm).findOne({
        where: { tenantId, usuarioId: candidato.usuarioId }
      });
      const resumo = await resumoRepo.findOne({
        where: { tenantId, usuarioId: candidato.usuarioId, id: resumoId, estadoEmail: 'pendente' },
        lock: { mode: 'pessimistic_write' }
      });
      if (!resumo) return undefined;

      if (!usuario?.ativo || !PAPÉIS_COM_EMAIL.includes(usuario.role as (typeof PAPÉIS_COM_EMAIL)[number]) || !preferencia?.emailResumo) {
        resumo.estadoEmail = 'cancelado';
        resumo.finalizadoEmailEm = new Date();
        await resumoRepo.save(resumo);
        return undefined;
      }

      let origem: URL;
      let destino: string;
      try {
        const origemConfigurada = process.env.OCTACLIN_WEB_URL ?? process.env.WEB_URL;
        if (!origemConfigurada) throw new Error();
        origem = new URL(origemConfigurada);
        if (origem.protocol !== 'https:' || origem.username || origem.password) throw new Error();
        destino = this.criptografia.descriptografar(usuario.emailCriptografado).trim();
        if (!/^\S+@\S+\.\S+$/.test(destino)) throw new Error();
        const remetente = process.env.EMAIL_REMETENTE ?? process.env.EMAIL_SMTP_USUARIO ?? process.env.GMAIL_USUARIO;
        if (!remetente?.trim()) throw new Error();
        this.validarConfiguracaoTransporte();
      } catch {
        resumo.estadoEmail = 'falhou';
        resumo.finalizadoEmailEm = new Date();
        await resumoRepo.save(resumo);
        return undefined;
      }

      const tentativaEm = new Date();
      resumo.estadoEmail = 'reservado';
      resumo.tentativaEmailEm = tentativaEm;
      await resumoRepo.save(resumo);
      return {
        resumoId,
        usuarioId: resumo.usuarioId,
        tentativaEm,
        destino,
        origem: origem.origin,
        periodoInicio: resumo.periodoInicioEm,
        periodoFim: resumo.periodoFimEm,
        contagens: resumo.contagensEmail
      };
    });
  }

  private async finalizar(tenantId: string, envio: EnvioReivindicado, estado: 'enviado' | 'incerto'): Promise<void> {
    await this.executorTenant.executar(tenantId, async (manager) => {
      await manager.getRepository(ResumoNotificacaoUsuarioOrm).update({
        tenantId,
        usuarioId: envio.usuarioId,
        id: envio.resumoId,
        estadoEmail: 'reservado',
        tentativaEmailEm: envio.tentativaEm
      }, { estadoEmail: estado, finalizadoEmailEm: new Date() });
    });
  }

  private rotulo(tipo: string): string {
    const nomes: Record<string, string> = {
      formulario_respondido: 'Formulários respondidos',
      tarefa_concluida: 'Tarefas concluídas',
      automacao_executada: 'Automações executadas'
    };
    return nomes[tipo] ?? 'Outras notificações';
  }

  private validarConfiguracaoTransporte(): void {
    const provedor = process.env.EMAIL_PROVEDOR?.trim() || 'smtp';
    if (provedor === 'gmail_api') {
      if (!process.env.GMAIL_CLIENT_ID?.trim() || !process.env.GMAIL_CLIENT_SECRET?.trim() || !process.env.GMAIL_REFRESH_TOKEN?.trim()) {
        throw new Error();
      }
      return;
    }
    if (provedor !== 'smtp' || !process.env.EMAIL_SMTP_USUARIO?.trim() || !process.env.EMAIL_SMTP_SENHA?.trim()) {
      throw new Error();
    }
    const porta = Number(process.env.EMAIL_SMTP_PORT ?? 587);
    if (!Number.isInteger(porta) || porta < 1 || porta > 65535) throw new Error();
  }
}
