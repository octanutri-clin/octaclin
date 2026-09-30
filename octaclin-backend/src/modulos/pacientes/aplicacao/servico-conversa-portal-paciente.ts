import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull, LessThanOrEqual } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { ConversaPortalPacienteOrm, MensagemPortalPacienteOrm } from '../infraestrutura/conversa-portal-paciente.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

const SLA_PADRAO_HORAS = 24;
const LIMITE_HISTORICO = 100;
const TAMANHO_PAGINA_FILA = 100;
const MAXIMO_CARACTERES = 5000;
const MAXIMO_MENSAGENS_JANELA = 5;
const JANELA_ENVIO_MINUTOS = 10;

export interface MensagemConversaPortalPacienteDto {
  id: string;
  autor: 'paciente' | 'equipe';
  texto: string;
  criadoEm: Date;
}

export interface ConversaPortalPacienteDto {
  id: string;
  pacienteId?: string;
  pacienteNome?: string;
  profissionalResponsavelId?: string;
  status: ConversaPortalPacienteOrm['status'];
  ultimaMensagemEm: Date;
  prazoRespostaEm?: Date;
  atrasada: boolean;
  mensagens: MensagemConversaPortalPacienteDto[];
}

export interface FilaConversaPortalPacienteDto {
  itens: ConversaPortalPacienteDto[];
  pagina: number;
  temMais: boolean;
}

export type FiltroStatusConversaPortalPaciente = 'aguardando_clinica' | 'aguardando_paciente' | 'encerrada' | 'todas';

@Injectable()
export class ServicoConversaPortalPaciente {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async obterConversaPaciente(tenantId: string, usuarioId: string): Promise<ConversaPortalPacienteDto | null> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { tenantId, usuarioId, arquivadoEm: IsNull() }
      });
      if (!paciente || paciente.statusCicloVida === 'DELETED') throw new ForbiddenException();
      const conversa = await gerenciador.getRepository(ConversaPortalPacienteOrm).findOne({
        where: { tenantId, pacienteId: paciente.id }
      });
      if (!conversa) return null;
      return this.mapearConversa(gerenciador, conversa);
    });
  }

  async enviarMensagemPaciente(tenantId: string, usuarioId: string, texto: string): Promise<ConversaPortalPacienteDto> {
    const conteudo = this.validarTexto(texto);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const pacientes = await gerenciador.query<Array<{ id: string }>>(
        `select id from pacientes where tenant_id = $1 and usuario_id = $2 and arquivado_em is null for update`,
        [tenantId, usuarioId]
      );
      const pacienteId = pacientes[0]?.id;
      if (!pacienteId) throw new ForbiddenException();

      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { id: pacienteId, tenantId } });
      if (!paciente || paciente.statusCicloVida === 'DELETED') throw new ForbiddenException();
      const conversas = gerenciador.getRepository(ConversaPortalPacienteOrm);
      let conversa = await conversas.findOne({ where: { tenantId, pacienteId }, lock: { mode: 'pessimistic_write' } });
      const agora = new Date();
      const prazoRespostaEm = new Date(agora.getTime() + (await this.slaHoras(gerenciador, tenantId)) * 60 * 60 * 1000);
      if (!conversa) {
        conversa = conversas.create({
          tenantId,
          pacienteId,
          profissionalResponsavelId: paciente.profissionalResponsavelId,
          status: 'aguardando_clinica',
          ultimaMensagemEm: agora,
          prazoRespostaEm
        });
      } else {
        conversa.profissionalResponsavelId = paciente.profissionalResponsavelId;
        conversa.status = 'aguardando_clinica';
        conversa.ultimaMensagemEm = agora;
        conversa.prazoRespostaEm = prazoRespostaEm;
        const recentes = await gerenciador.query<Array<{ total: number }>>(
          `select count(*)::int as total
             from mensagens_portal_paciente
            where tenant_id = $1
              and conversa_id = $2
              and autor_usuario_id = $3
              and autor_tipo = 'paciente'
              and criado_em > now() - interval '${JANELA_ENVIO_MINUTOS} minutes'`,
          [tenantId, conversa.id, usuarioId]
        );
        if (Number(recentes[0]?.total ?? 0) >= MAXIMO_MENSAGENS_JANELA) {
          throw new HttpException(
            'Você enviou muitas mensagens em sequência. Aguarde alguns minutos antes de tentar novamente.',
            HttpStatus.TOO_MANY_REQUESTS
          );
        }
      }
      conversa = await conversas.save(conversa);
      await this.gravarMensagem(gerenciador, tenantId, conversa.id, usuarioId, 'paciente', conteudo, agora);
      return this.mapearConversa(gerenciador, conversa);
    });
  }

  async listarFila(
    tenantId: string,
    usuario: UsuarioAutenticado,
    somenteAtrasadas = false,
    pagina = 0,
    statusFiltro: FiltroStatusConversaPortalPaciente = 'aguardando_clinica'
  ): Promise<FilaConversaPortalPacienteDto> {
    this.validarTenant(usuario, tenantId);
    this.validarPermissaoEquipe(usuario, 'comunicacoes.mensagens.ler');
    if (!Number.isSafeInteger(pagina) || pagina < 0 || !Number.isSafeInteger(pagina * TAMANHO_PAGINA_FILA)) {
      throw new BadRequestException('Página inválida.');
    }
    if (!['aguardando_clinica', 'aguardando_paciente', 'encerrada', 'todas'].includes(statusFiltro)) {
      throw new BadRequestException('Filtro de status inválido.');
    }
    if (somenteAtrasadas && statusFiltro !== 'aguardando_clinica') {
      throw new BadRequestException('O filtro de atraso só se aplica às respostas aguardando a clínica.');
    }
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const where = {
        tenantId,
        ...(statusFiltro === 'todas' ? {} : { status: statusFiltro }),
        ...(profissionalId ? { profissionalResponsavelId: profissionalId } : {}),
        ...(somenteAtrasadas ? { prazoRespostaEm: LessThanOrEqual(new Date()) } : {})
      };
      const conversas = await gerenciador.getRepository(ConversaPortalPacienteOrm).find({
        where,
        order: { prazoRespostaEm: 'ASC', ultimaMensagemEm: 'DESC' },
        skip: pagina * TAMANHO_PAGINA_FILA,
        take: TAMANHO_PAGINA_FILA + 1
      });
      const temMais = conversas.length > TAMANHO_PAGINA_FILA;
      const itensPagina = conversas.slice(0, TAMANHO_PAGINA_FILA);
      const pacientes = itensPagina.length
        ? await gerenciador.getRepository(PacienteOrm).find({
          where: { tenantId, id: In(itensPagina.map((conversa) => conversa.pacienteId)) }
        })
        : [];
      const pacientesPorId = new Map(pacientes.map((paciente) => [paciente.id, paciente]));
      const itens = await Promise.all(
        itensPagina.map((conversa) => this.mapearConversa(
          gerenciador,
          conversa,
          true,
          false,
          pacientesPorId.get(conversa.pacienteId) ?? null
        ))
      );
      return { itens, pagina, temMais };
    });
  }

  async obterConversaEquipe(tenantId: string, usuario: UsuarioAutenticado, conversaId: string): Promise<ConversaPortalPacienteDto> {
    this.validarTenant(usuario, tenantId);
    this.validarPermissaoEquipe(usuario, 'comunicacoes.mensagens.ler');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const conversa = await this.obterConversaAutorizada(gerenciador, tenantId, usuario, conversaId);
      return this.mapearConversa(gerenciador, conversa, true);
    });
  }

  async responderEquipe(tenantId: string, usuario: UsuarioAutenticado, conversaId: string, texto: string): Promise<ConversaPortalPacienteDto> {
    this.validarTenant(usuario, tenantId);
    this.validarPermissaoEquipe(usuario, 'comunicacoes.mensagens.enviar');
    const conteudo = this.validarTexto(texto);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const conversa = await this.obterConversaAutorizada(gerenciador, tenantId, usuario, conversaId, true);
      if (conversa.status === 'encerrada') throw new ConflictException('Esta conversa foi encerrada.');
      const agora = new Date();
      await this.gravarMensagem(gerenciador, tenantId, conversa.id, usuario.usuarioId, 'equipe', conteudo, agora);
      conversa.status = 'aguardando_paciente';
      conversa.ultimaMensagemEm = agora;
      conversa.prazoRespostaEm = undefined;
      await gerenciador.getRepository(ConversaPortalPacienteOrm).save(conversa);
      return this.mapearConversa(gerenciador, conversa, true);
    });
  }

  async encerrarConversa(tenantId: string, usuario: UsuarioAutenticado, conversaId: string): Promise<void> {
    this.validarTenant(usuario, tenantId);
    this.validarPermissaoEquipe(usuario, 'comunicacoes.mensagens.enviar');
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const conversa = await this.obterConversaAutorizada(gerenciador, tenantId, usuario, conversaId, true);
      conversa.status = 'encerrada';
      conversa.prazoRespostaEm = undefined;
      await gerenciador.getRepository(ConversaPortalPacienteOrm).save(conversa);
    });
  }

  private async obterConversaAutorizada(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado,
    conversaId: string,
    bloquear = false
  ): Promise<ConversaPortalPacienteOrm> {
    const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const conversa = await gerenciador.getRepository(ConversaPortalPacienteOrm).findOne({
      where: { id: conversaId, tenantId, ...(profissionalId ? { profissionalResponsavelId: profissionalId } : {}) },
      ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {})
    });
    if (!conversa) throw new NotFoundException('Conversa não encontrada.');
    return conversa;
  }

  private async gravarMensagem(
    gerenciador: EntityManager,
    tenantId: string,
    conversaId: string,
    autorUsuarioId: string,
    autorTipo: 'paciente' | 'equipe',
    texto: string,
    criadoEm: Date
  ) {
    await gerenciador.getRepository(MensagemPortalPacienteOrm).save(
      gerenciador.getRepository(MensagemPortalPacienteOrm).create({
        tenantId,
        conversaId,
        autorUsuarioId,
        autorTipo,
        conteudoCriptografado: this.criptografia.criptografar(texto),
        criadoEm
      })
    );
  }

  private async mapearConversa(
    gerenciador: EntityManager,
    conversa: ConversaPortalPacienteOrm,
    incluirPaciente = false,
    incluirMensagens = true,
    pacienteCarregado?: PacienteOrm | null
  ): Promise<ConversaPortalPacienteDto> {
    const mensagensRecentes = incluirMensagens ? await gerenciador.getRepository(MensagemPortalPacienteOrm).find({
      where: { tenantId: conversa.tenantId, conversaId: conversa.id },
      order: { criadoEm: 'DESC', id: 'DESC' },
      take: LIMITE_HISTORICO
    }) : [];
    const mensagens = mensagensRecentes.reverse();
    const paciente = pacienteCarregado !== undefined
      ? pacienteCarregado
      : incluirPaciente
        ? await gerenciador.getRepository(PacienteOrm).findOne({ where: { id: conversa.pacienteId, tenantId: conversa.tenantId } })
        : undefined;
    const agora = new Date();
    return {
      id: conversa.id,
      ...(incluirPaciente ? {
        pacienteId: conversa.pacienteId,
        pacienteNome: paciente ? this.criptografia.descriptografar(paciente.nomeCriptografado) : undefined
      } : {}),
      profissionalResponsavelId: conversa.profissionalResponsavelId,
      status: conversa.status,
      ultimaMensagemEm: conversa.ultimaMensagemEm,
      prazoRespostaEm: conversa.prazoRespostaEm,
      atrasada: conversa.status === 'aguardando_clinica' && Boolean(conversa.prazoRespostaEm && conversa.prazoRespostaEm <= agora),
      mensagens: mensagens.map((mensagem) => ({
        id: mensagem.id,
        autor: mensagem.autorTipo,
        texto: this.criptografia.descriptografar(mensagem.conteudoCriptografado),
        criadoEm: mensagem.criadoEm
      }))
    };
  }

  private validarTexto(texto: string): string {
    if (typeof texto !== 'string') throw new BadRequestException('Informe uma mensagem.');
    const conteudo = texto.trim();
    if (!conteudo || conteudo.length > MAXIMO_CARACTERES) {
      throw new BadRequestException(`A mensagem deve conter de 1 a ${MAXIMO_CARACTERES} caracteres.`);
    }
    return conteudo;
  }

  private validarPermissaoEquipe(usuario: UsuarioAutenticado, permissao: 'comunicacoes.mensagens.ler' | 'comunicacoes.mensagens.enviar') {
    if (!['Professional', 'Collaborator', 'SuperAdmin'].includes(usuario.papel) ||
        !usuario.permissoes.includes('pacientes.ler') || !usuario.permissoes.includes(permissao)) {
      throw new ForbiddenException();
    }
  }

  private validarTenant(usuario: UsuarioAutenticado, tenantId: string) {
    if (tenantId !== usuario.tenantId) throw new ForbiddenException();
  }

  private async slaHoras(gerenciador: EntityManager, tenantId: string): Promise<number> {
    const configuracao = await gerenciador.getRepository(TenantConfiguracaoOrm).findOne({
      where: { tenantId, chave: 'conta_cliente' }
    });
    const horas = configuracao?.valor?.slaRespostaPacienteHoras;
    return typeof horas === 'number' && Number.isInteger(horas) && horas >= 1 && horas <= 168 ? horas : SLA_PADRAO_HORAS;
  }
}
