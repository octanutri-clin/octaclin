import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { In } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import {
  AssociarContatoWhatsappDto,
  CriarCanalNotificacaoDto,
  CriarTemplateMensagemDto,
  DispararMensagemDto,
  RegistrarNotaWhatsappDto
} from './dtos';
import { redisConfigurado } from './configuracao-redis';
import { CanalNotificacaoOrm } from '../infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../infraestrutura/template-mensagem.orm';

export const FILA_NOTIFICACOES = 'notificacoes';

@Injectable()
export class ServicoComunicacoes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    @InjectQueue(FILA_NOTIFICACOES) private readonly filaNotificacoes: Queue,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async criarCanal(tenantId: string, dados: CriarCanalNotificacaoDto): Promise<CanalNotificacaoOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(CanalNotificacaoOrm).save(
        gerenciador.getRepository(CanalNotificacaoOrm).create({
          tenantId,
          tipo: dados.tipo,
          nome: dados.nome,
          configuracao: dados.configuracao,
          ativo: dados.ativo ?? true
        })
      )
    );
  }

  async listarCanais(tenantId: string): Promise<CanalNotificacaoOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(CanalNotificacaoOrm).find({ where: { tenantId }, order: { nome: 'ASC' } })
    );
  }

  async criarTemplate(tenantId: string, dados: CriarTemplateMensagemDto): Promise<TemplateMensagemOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(TemplateMensagemOrm).save(
        gerenciador.getRepository(TemplateMensagemOrm).create({
          tenantId,
          canal: dados.canal,
          codigoExterno: dados.codigoExterno,
          nome: dados.nome,
          conteudo: dados.conteudo,
          aprovado: dados.aprovado ?? false
        })
      )
    );
  }

  async listarTemplates(tenantId: string): Promise<TemplateMensagemOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(TemplateMensagemOrm).find({ where: { tenantId }, order: { nome: 'ASC' } })
    );
  }

  async listarMensagens(tenantId: string, usuario: UsuarioAutenticado): Promise<MensagemNotificacaoOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);

      if (profissionalId) {
        const pacientes = await gerenciador.getRepository(PacienteOrm).find({
          where: { tenantId, profissionalResponsavelId: profissionalId }
        });
        const pacienteIds = pacientes.map((paciente) => paciente.id);
        if (!pacienteIds.length) return [];

        return gerenciador.getRepository(MensagemNotificacaoOrm).find({
          where: { tenantId, pacienteId: In(pacienteIds) },
          order: { criadoEm: 'DESC' },
          take: 200
        });
      }

      return gerenciador.getRepository(MensagemNotificacaoOrm).find({
        where: { tenantId },
        order: { criadoEm: 'DESC' },
        take: 200
      });
    });
  }

  async obterMensagem(tenantId: string, mensagemId: string): Promise<MensagemNotificacaoOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const mensagem = await gerenciador.getRepository(MensagemNotificacaoOrm).findOne({
        where: { id: mensagemId, tenantId }
      });
      if (!mensagem) throw new NotFoundException('Mensagem de notificacao nao encontrada.');
      return mensagem;
    });
  }

  async associarContatoWhatsapp(tenantId: string, dados: AssociarContatoWhatsappDto) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioPacientes = gerenciador.getRepository(PacienteOrm);
      const paciente = await repositorioPacientes.findOne({ where: { id: dados.pacienteId, tenantId } });
      if (!paciente) throw new NotFoundException('Paciente nao encontrado.');

      const contatoNormalizado = this.normalizarTelefone(dados.contato);
      if (!contatoNormalizado) throw new BadRequestException('Contato WhatsApp invalido.');

      const repositorioMensagens = gerenciador.getRepository(MensagemNotificacaoOrm);
      const mensagens = await repositorioMensagens.find({
        where: { tenantId },
        order: { criadoEm: 'DESC' },
        take: 200
      });
      const mensagensAssociadas = mensagens.filter((mensagem) => this.mensagemPertenceAoContatoWhatsapp(mensagem, contatoNormalizado));

      for (const mensagem of mensagensAssociadas) {
        mensagem.pacienteId = paciente.id;
        mensagem.payload = {
          ...mensagem.payload,
          contatoAssociadoManualmente: true,
          contatoAssociadoEm: new Date().toISOString()
        };
      }

      const contatoPacienteAtualizado = Boolean(dados.atualizarContatoPaciente && !paciente.contatoCriptografado);
      if (contatoPacienteAtualizado) {
        paciente.contatoCriptografado = this.criptografia.criptografar(dados.contato);
        await repositorioPacientes.save(paciente);
      }

      if (mensagensAssociadas.length) await repositorioMensagens.save(mensagensAssociadas);

      return {
        pacienteId: paciente.id,
        contato: dados.contato,
        mensagensAtualizadas: mensagensAssociadas.length,
        contatoPacienteAtualizado
      };
    });
  }

  async registrarNotaWhatsapp(tenantId: string, dados: RegistrarNotaWhatsappDto): Promise<MensagemNotificacaoOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const texto = dados.texto.trim();
      if (!texto) throw new BadRequestException('Nota interna nao pode ficar vazia.');

      if (dados.pacienteId) {
        const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
          where: { id: dados.pacienteId, tenantId }
        });
        if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
      }

      const repositorioMensagens = gerenciador.getRepository(MensagemNotificacaoOrm);
      return repositorioMensagens.save(
        repositorioMensagens.create({
          tenantId,
          pacienteId: dados.pacienteId,
          status: 'nota',
          payload: {
            origem: 'whatsapp',
            direcao: 'nota',
            tipo: 'nota_interna',
            contato: dados.contato,
            texto,
            statusAtendimento: dados.statusAtendimento,
            registradoEm: new Date().toISOString()
          }
        })
      );
    });
  }

  async dispararMensagem(tenantId: string, dados: DispararMensagemDto): Promise<MensagemNotificacaoOrm> {
    const mensagem = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const canal = await gerenciador.getRepository(CanalNotificacaoOrm).findOne({
        where: { id: dados.canalId, tenantId, ativo: true }
      });
      if (!canal) throw new NotFoundException('Canal de notificacao nao encontrado ou inativo.');

      const template = await gerenciador.getRepository(TemplateMensagemOrm).findOne({
        where: { id: dados.templateId, tenantId }
      });
      if (!template) throw new NotFoundException('Template de mensagem nao encontrado.');
      if (template.canal !== canal.tipo) throw new BadRequestException('Template incompativel com o canal.');
      if (canal.tipo === 'whatsapp' && !template.aprovado) {
        throw new BadRequestException('Templates WhatsApp devem estar aprovados antes do disparo.');
      }

      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { id: dados.pacienteId, tenantId }
      });
      if (!paciente) throw new NotFoundException('Paciente nao encontrado.');

      const mensagemCriada = await gerenciador.getRepository(MensagemNotificacaoOrm).save(
        gerenciador.getRepository(MensagemNotificacaoOrm).create({
          tenantId,
          pacienteId: dados.pacienteId,
          canalId: canal.id,
          templateId: template.id,
          status: 'pendente',
          payload: dados.payload
        })
      );

      await gerenciador.getRepository(OutboxEventoOrm).save(
        gerenciador.getRepository(OutboxEventoOrm).create({
          tenantId,
          tipo: 'notificacao.enviar',
          status: 'pendente',
          payload: { mensagemId: mensagemCriada.id }
        })
      );

      return mensagemCriada;
    });

    return mensagem;
  }

  async publicarEventoNotificacao(tenantId: string, mensagemId: string): Promise<void> {
    if (!redisConfigurado()) return;

    await this.filaNotificacoes.add(
      'enviar',
      { tenantId, mensagemId },
      {
        jobId: `mensagem:${mensagemId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000
      }
    );
  }

  private mensagemPertenceAoContatoWhatsapp(mensagem: MensagemNotificacaoOrm, contatoNormalizado: string) {
    if (mensagem.payload.origem !== 'whatsapp' && !mensagem.canalId) return false;

    const candidatos = [
      mensagem.payload.remetente,
      mensagem.payload.contato,
      mensagem.payload.destino,
      this.obterValorAninhado(mensagem.payload, ['ultimoStatusMeta', 'recipientId'])
    ];

    return candidatos.some((valor) => typeof valor === 'string' && this.normalizarTelefone(valor) === contatoNormalizado);
  }

  private obterValorAninhado(payload: Record<string, unknown>, caminho: string[]) {
    let atual: unknown = payload;
    for (const chave of caminho) {
      if (!atual || typeof atual !== 'object' || Array.isArray(atual)) return undefined;
      atual = (atual as Record<string, unknown>)[chave];
    }
    return atual;
  }

  private normalizarTelefone(valor: string) {
    return valor.replace(/\D/g, '');
  }
}
