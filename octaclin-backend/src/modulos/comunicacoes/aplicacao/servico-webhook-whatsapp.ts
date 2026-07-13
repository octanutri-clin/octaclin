import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { CanalNotificacaoOrm } from '../infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';

export interface StatusWebhookWhatsapp {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: unknown[];
}

export interface MensagemRecebidaWebhookWhatsapp {
  phoneNumberId?: string;
  mensagem: {
    id?: string;
    from?: string;
    timestamp?: string;
    type?: string;
    text?: {
      body?: string;
    };
  };
}

interface ResultadoProcessamentoStatus {
  atualizados: number;
  ignorados: number;
}

interface ResultadoProcessamentoMensagens {
  criadas: number;
  ignoradas: number;
}

@Injectable()
export class ServicoWebhookWhatsapp {
  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async registrarStatus(statuses: StatusWebhookWhatsapp[]): Promise<ResultadoProcessamentoStatus> {
    const statusesComId = statuses.filter((status) => status.id);
    if (!statusesComId.length) return { atualizados: 0, ignorados: statuses.length };

    const tenants = await this.fonteDados.getRepository(TenantOrm).find({
      select: { id: true },
      where: { status: 'ativo' }
    });

    let atualizados = 0;
    let ignorados = statuses.length - statusesComId.length;

    for (const status of statusesComId) {
      const atualizado = await this.registrarStatusEmAlgumTenant(tenants, status);
      if (atualizado) {
        atualizados += 1;
      } else {
        ignorados += 1;
      }
    }

    return { atualizados, ignorados };
  }

  async registrarMensagensRecebidas(mensagens: MensagemRecebidaWebhookWhatsapp[]): Promise<ResultadoProcessamentoMensagens> {
    const mensagensComId = mensagens.filter((entrada) => entrada.mensagem.id && entrada.mensagem.from);
    if (!mensagensComId.length) return { criadas: 0, ignoradas: mensagens.length };

    const tenants = await this.fonteDados.getRepository(TenantOrm).find({
      select: { id: true },
      where: { status: 'ativo' }
    });

    let criadas = 0;
    let ignoradas = mensagens.length - mensagensComId.length;

    for (const entrada of mensagensComId) {
      const criada = await this.registrarMensagemEmAlgumTenant(tenants, entrada);
      if (criada) {
        criadas += 1;
      } else {
        ignoradas += 1;
      }
    }

    return { criadas, ignoradas };
  }

  private async registrarStatusEmAlgumTenant(
    tenants: Array<Pick<TenantOrm, 'id'>>,
    status: StatusWebhookWhatsapp
  ): Promise<boolean> {
    for (const tenant of tenants) {
      const atualizado = await this.executorTenant.executar(tenant.id, (gerenciador) =>
        this.registrarStatusNoTenant(gerenciador.getRepository(MensagemNotificacaoOrm), status)
      );
      if (atualizado) return true;
    }

    return false;
  }

  private async registrarStatusNoTenant(
    repositorioMensagens: Repository<MensagemNotificacaoOrm>,
    status: StatusWebhookWhatsapp
  ): Promise<boolean> {
    const mensagem = await repositorioMensagens
      .createQueryBuilder('mensagem')
      .where("mensagem.payload #>> '{resultadoEnvio,idExterno}' = :idExterno", { idExterno: status.id })
      .getOne();
    if (!mensagem) return false;

    mensagem.payload = {
      ...mensagem.payload,
      ultimoStatusMeta: this.limparObjeto({
        status: status.status,
        timestamp: status.timestamp,
        recipientId: status.recipient_id,
        errors: status.errors
      })
    };

    if (status.status === 'failed') {
      mensagem.status = 'falhou';
      mensagem.erro = this.resumirErro(status.errors);
    }

    await repositorioMensagens.save(mensagem);
    return true;
  }

  private async registrarMensagemEmAlgumTenant(
    tenants: Array<Pick<TenantOrm, 'id'>>,
    entrada: MensagemRecebidaWebhookWhatsapp
  ): Promise<boolean> {
    for (const tenant of tenants) {
      const criada = await this.executorTenant.executar(tenant.id, async (gerenciador) => {
        const canal = await this.obterCanalWhatsapp(gerenciador.getRepository(CanalNotificacaoOrm), tenant.id, entrada.phoneNumberId);
        if (!canal) return false;

        return this.registrarMensagemNoTenant(
          gerenciador.getRepository(MensagemNotificacaoOrm),
          gerenciador.getRepository(PacienteOrm),
          tenant.id,
          canal,
          entrada
        );
      });
      if (criada) return true;
    }

    return false;
  }

  private async obterCanalWhatsapp(
    repositorioCanais: Repository<CanalNotificacaoOrm>,
    tenantId: string,
    phoneNumberId?: string
  ): Promise<CanalNotificacaoOrm | null> {
    const canais = await repositorioCanais.find({
      where: { tenantId, tipo: 'whatsapp', ativo: true },
      order: { nome: 'ASC' }
    });

    if (!phoneNumberId) return canais[0] ?? null;

    return (
      canais.find((canal) => String(canal.configuracao.phoneNumberId ?? process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? '') === phoneNumberId) ??
      null
    );
  }

  private async registrarMensagemNoTenant(
    repositorioMensagens: Repository<MensagemNotificacaoOrm>,
    repositorioPacientes: Repository<PacienteOrm>,
    tenantId: string,
    canal: CanalNotificacaoOrm,
    entrada: MensagemRecebidaWebhookWhatsapp
  ): Promise<boolean> {
    const idExterno = entrada.mensagem.id;
    if (!idExterno || !entrada.mensagem.from) return false;

    const existente = await repositorioMensagens
      .createQueryBuilder('mensagem')
      .where("mensagem.payload #>> '{idExterno}' = :idExterno", { idExterno })
      .getOne();
    if (existente) return false;

    const pacienteId = await this.encontrarPacientePorContato(repositorioPacientes, tenantId, entrada.mensagem.from);
    const criadaEm = this.converterTimestampMeta(entrada.mensagem.timestamp) ?? new Date();

    await repositorioMensagens.save(
      repositorioMensagens.create({
        tenantId,
        pacienteId,
        canalId: canal.id,
        status: 'recebido',
        payload: this.limparObjeto({
          direcao: 'recebida',
          origem: 'whatsapp',
          idExterno,
          remetente: entrada.mensagem.from,
          phoneNumberId: entrada.phoneNumberId,
          tipo: entrada.mensagem.type,
          texto: entrada.mensagem.text?.body,
          timestamp: entrada.mensagem.timestamp
        }),
        criadoEm: criadaEm
      })
    );

    return true;
  }

  private async encontrarPacientePorContato(
    repositorioPacientes: Repository<PacienteOrm>,
    tenantId: string,
    remetente: string
  ): Promise<string | undefined> {
    const remetenteNormalizado = this.normalizarTelefone(remetente);
    if (!remetenteNormalizado) return undefined;

    const pacientes = await repositorioPacientes.find({ where: { tenantId } });
    const paciente = pacientes.find((item) => {
      if (!item.contatoCriptografado) return false;

      try {
        return this.normalizarTelefone(this.criptografia.descriptografar(item.contatoCriptografado)) === remetenteNormalizado;
      } catch {
        return false;
      }
    });

    return paciente?.id;
  }

  private limparObjeto(objeto: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor !== undefined));
  }

  private resumirErro(errors?: unknown[]): string {
    if (!errors?.length) return 'Falha reportada pela Meta Cloud API.';

    const primeiroErro = errors[0] as { title?: unknown; message?: unknown; code?: unknown };
    return String(primeiroErro.title ?? primeiroErro.message ?? primeiroErro.code ?? 'Falha reportada pela Meta Cloud API.');
  }

  private converterTimestampMeta(timestamp?: string): Date | undefined {
    if (!timestamp) return undefined;
    const segundos = Number(timestamp);
    if (!Number.isFinite(segundos)) return undefined;
    return new Date(segundos * 1000);
  }

  private normalizarTelefone(valor?: string): string {
    return String(valor ?? '').replace(/\D/g, '');
  }
}
