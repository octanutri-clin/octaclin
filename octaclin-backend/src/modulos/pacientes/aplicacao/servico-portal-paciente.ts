import { createHmac, randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ConsentimentoLgpdOrm } from '../../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { EnvioQuestionarioOrm } from '../../questionarios/infraestrutura/envio-questionario.orm';
import { PerguntaOrm } from '../../questionarios/infraestrutura/pergunta.orm';
import { QuestionarioOrm } from '../../questionarios/infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../../questionarios/infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from '../../questionarios/infraestrutura/resposta-valor.orm';
import { AtualizarPerfilPacientePortalDto, RegistrarConsentimentoLgpdPortalDto, RegistrarSolicitacaoLgpdPortalDto } from './dtos';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

interface ContatoPacientePortal {
  email?: string;
  whatsapp?: string;
  preferencias: {
    email: boolean;
    whatsapp: boolean;
  };
}

export interface ResumoPortalPaciente {
  paciente: {
    id: string;
    nome: string;
    statusAdesao: string;
    scoreRisco: string;
    ultimoCheckinEm?: Date;
  };
  perfil: {
    contato?: string;
    email?: string;
    whatsapp?: string;
    preferenciasContato: {
      email: boolean;
      whatsapp: boolean;
    };
    dataNascimento?: string;
    profissionalResponsavelId: string;
    ultimoCheckinEm?: Date;
  };
  resumo: {
    consultasProximas: number;
    formulariosPendentes: number;
    formulariosRespondidos: number;
    mensagensRecentes: number;
  };
  consultasProximas: {
    id: string;
    titulo: string;
    inicioEm: Date;
    fimEm: Date;
    status: string;
    local?: string;
    googleEventHtmlLink?: string;
  }[];
  formulariosPendentes: {
    envioId: string;
    questionarioId: string;
    titulo: string;
    status: string;
    expiraEm?: Date;
    linkFormulario: string;
  }[];
  formulariosRespondidos: {
    respostaId: string;
    envioId: string;
    questionarioId: string;
    titulo: string;
    status: string;
    respondidoEm?: Date;
    finalizadoEm?: Date;
    scoreFinal?: string;
  }[];
  mensagensRecentes: {
    id: string;
    titulo: string;
    texto: string;
    status: string;
    criadoEm: Date;
    enviadoEm?: Date;
  }[];
  lgpd: LgpdPortalPaciente;
}

export interface PerfilPortalPaciente {
  paciente: ResumoPortalPaciente['paciente'];
  perfil: ResumoPortalPaciente['perfil'];
}

export interface LgpdPortalPaciente {
  versaoAtual: string;
  ultimoAceiteEm?: Date;
  consentimentos: {
    id: string;
    tipo: string;
    versao: string;
    aceitoEm: Date;
    metadados: Record<string, unknown>;
  }[];
  solicitacoes: SolicitacaoLgpdPortalPaciente[];
}

export interface ConsentimentoLgpdPortalPaciente extends PerfilPortalPaciente {
  lgpd: LgpdPortalPaciente;
}

export interface DetalheFormularioRespondidoPaciente {
  respostaId: string;
  envioId: string;
  questionarioId: string;
  titulo: string;
  descricao?: string;
  scoreFinal?: string;
  finalizadoEm?: Date;
  respostas: {
    perguntaId: string;
    enunciado: string;
    tipo: string;
    obrigatoria: boolean;
    ordem: number;
    valor: unknown;
    scorePonderado?: string;
  }[];
}

export interface ExportacaoDadosLgpdPaciente {
  geradoEm: Date;
  titular: {
    pacienteId: string;
    nome: string;
    email?: string;
    whatsapp?: string;
  };
  dados: ResumoPortalPaciente;
}

export interface SolicitacaoLgpdPaciente {
  protocolo: string;
  pacienteId: string;
  tipo: 'retificacao' | 'exclusao';
  status: 'recebida';
  criadoEm: Date;
}

type StatusSolicitacaoLgpdPortal = 'recebida' | 'em_tratamento' | 'concluida' | 'indeferida';

export interface SolicitacaoLgpdPortalPaciente {
  protocolo: string;
  pacienteId: string;
  tipo: 'retificacao' | 'exclusao';
  status: StatusSolicitacaoLgpdPortal;
  detalhes?: string;
  abertoEm: Date;
  atualizadoEm: Date;
  ultimaTratativa?: string;
  ultimaResposta?: string;
}

@Injectable()
export class ServicoPortalPaciente {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async obterResumoPortal(tenantId: string, usuarioId: string): Promise<ResumoPortalPaciente> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { tenantId, usuarioId, arquivadoEm: IsNull() }
      });
      if (!paciente) throw new ForbiddenException('Usuario nao possui paciente vinculado.');

      const consultas = (
        await gerenciador.getRepository(AgendaConsultaOrm).find({
          where: { tenantId, pacienteId: paciente.id, status: 'agendada' },
          order: { inicioEm: 'ASC' },
          take: 20
        })
      )
        .filter((consulta) => consulta.inicioEm >= new Date())
        .slice(0, 5);

      const envios = await gerenciador.getRepository(EnvioQuestionarioOrm).find({
        where: { tenantId, pacienteId: paciente.id, status: In(['pendente', 'enviado']) },
        order: { expiraEm: 'ASC' },
        take: 20
      });
      const enviosRespondidos = await gerenciador.getRepository(EnvioQuestionarioOrm).find({
        where: { tenantId, pacienteId: paciente.id, status: 'respondido' },
        order: { respondidoEm: 'DESC' },
        take: 20
      });
      const todosEnvios = [...envios, ...enviosRespondidos];
      const questionarios = todosEnvios.length
        ? await gerenciador.getRepository(QuestionarioOrm).find({
            where: { tenantId, id: In(todosEnvios.map((envio) => envio.questionarioId)) }
          })
        : [];
      const questionariosPorId = new Map(questionarios.map((questionario) => [questionario.id, questionario]));
      const respostasCheckin = enviosRespondidos.length
        ? await gerenciador.getRepository(RespostaCheckinOrm).find({
            where: { tenantId, pacienteId: paciente.id, envioQuestionarioId: In(enviosRespondidos.map((envio) => envio.id)) },
            order: { finalizadoEm: 'DESC' },
            take: 20
          })
        : [];
      const respostasPorEnvioId = new Map(respostasCheckin.map((resposta) => [resposta.envioQuestionarioId, resposta]));

      const mensagens = await gerenciador.getRepository(MensagemNotificacaoOrm).find({
        where: { tenantId, pacienteId: paciente.id },
        order: { criadoEm: 'DESC' },
        take: 5
      });
      const consentimentos = await this.listarConsentimentosPaciente(gerenciador, tenantId);

      const consultasProximas = consultas.map((consulta) => ({
        id: consulta.id,
        titulo: consulta.titulo,
        inicioEm: consulta.inicioEm,
        fimEm: consulta.fimEm,
        status: consulta.status,
        local: consulta.local,
        googleEventHtmlLink: consulta.googleEventHtmlLink
      }));
      const formulariosPendentes = envios.map((envio) => ({
        envioId: envio.id,
        questionarioId: envio.questionarioId,
        titulo: questionariosPorId.get(envio.questionarioId)?.titulo ?? 'Formulario',
        status: envio.status,
        expiraEm: envio.expiraEm,
        linkFormulario: this.montarLinkFormulario(tenantId, envio.id)
      }));
      const formulariosRespondidos = enviosRespondidos.map((envio) => {
        const resposta = respostasPorEnvioId.get(envio.id);
        return {
          respostaId: resposta?.id ?? envio.id,
          envioId: envio.id,
          questionarioId: envio.questionarioId,
          titulo: questionariosPorId.get(envio.questionarioId)?.titulo ?? 'Formulario',
          status: envio.status,
          respondidoEm: envio.respondidoEm,
          finalizadoEm: resposta?.finalizadoEm ?? envio.respondidoEm,
          scoreFinal: resposta?.scoreFinal
        };
      });
      const mensagensRecentes = mensagens.map((mensagem) => ({
        id: mensagem.id,
        titulo: this.textoPayload(mensagem.payload, 'assunto') ?? 'Mensagem OctaClin',
        texto: this.textoPayload(mensagem.payload, 'texto') ?? this.textoPayload(mensagem.payload, 'observacao') ?? '',
        status: mensagem.status,
        criadoEm: mensagem.criadoEm,
        enviadoEm: mensagem.enviadoEm
      }));
      const contato = this.obterContatoPaciente(paciente);

      return {
        paciente: {
          id: paciente.id,
          nome: this.criptografia.descriptografar(paciente.nomeCriptografado),
          statusAdesao: paciente.statusAdesao,
          scoreRisco: paciente.scoreRisco,
          ultimoCheckinEm: paciente.ultimoCheckinEm
        },
        perfil: {
          contato: contato.email ?? contato.whatsapp,
          email: contato.email,
          whatsapp: contato.whatsapp,
          preferenciasContato: contato.preferencias,
          dataNascimento: paciente.dataNascimento,
          profissionalResponsavelId: paciente.profissionalResponsavelId,
          ultimoCheckinEm: paciente.ultimoCheckinEm
        },
        resumo: {
          consultasProximas: consultasProximas.length,
          formulariosPendentes: formulariosPendentes.length,
          formulariosRespondidos: formulariosRespondidos.length,
          mensagensRecentes: mensagensRecentes.length
        },
        consultasProximas,
        formulariosPendentes,
        formulariosRespondidos,
        mensagensRecentes,
        lgpd: this.mapearLgpd(consentimentos, paciente.id, usuarioId)
      };
    });
  }

  async atualizarPerfil(
    tenantId: string,
    usuarioId: string,
    dados: AtualizarPerfilPacientePortalDto
  ): Promise<PerfilPortalPaciente> {
    const camposRecebidos = Object.values(dados).some((valor) => valor !== undefined && valor !== null && String(valor).trim() !== '');
    if (!camposRecebidos) throw new BadRequestException('Informe ao menos um dado para atualizar.');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(PacienteOrm);
      const paciente = await repositorio.findOne({
        where: { tenantId, usuarioId, arquivadoEm: IsNull() }
      });
      if (!paciente) throw new ForbiddenException('Usuario nao possui paciente vinculado.');

      if (dados.nome?.trim()) paciente.nomeCriptografado = this.criptografia.criptografar(dados.nome.trim());
      if (dados.dataNascimento) paciente.dataNascimento = dados.dataNascimento;

      const contatoAtual = this.obterContatoPaciente(paciente);
      const contatoAtualizado: ContatoPacientePortal = {
        email: dados.email !== undefined ? this.normalizarEmail(dados.email) : contatoAtual.email,
        whatsapp: dados.whatsapp !== undefined ? this.normalizarWhatsapp(dados.whatsapp) : contatoAtual.whatsapp,
        preferencias: {
          email: dados.prefereEmail ?? contatoAtual.preferencias.email,
          whatsapp: dados.prefereWhatsapp ?? contatoAtual.preferencias.whatsapp
        }
      };
      if (
        dados.email !== undefined ||
        dados.whatsapp !== undefined ||
        dados.prefereEmail !== undefined ||
        dados.prefereWhatsapp !== undefined
      ) {
        paciente.contatoCriptografado = this.criptografia.criptografar(this.serializarContato(contatoAtualizado));
      }

      return this.mapearPerfilPaciente(await repositorio.save(paciente));
    });
  }

  async registrarConsentimentoLgpd(
    tenantId: string,
    usuarioId: string,
    dados: RegistrarConsentimentoLgpdPortalDto
  ): Promise<ConsentimentoLgpdPortalPaciente> {
    if (!dados.aceiteLgpd) throw new BadRequestException('Aceite LGPD obrigatorio para registrar consentimento.');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioPacientes = gerenciador.getRepository(PacienteOrm);
      const paciente = await repositorioPacientes.findOne({
        where: { tenantId, usuarioId, arquivadoEm: IsNull() }
      });
      if (!paciente) throw new ForbiddenException('Usuario nao possui paciente vinculado.');

      if (dados.prefereEmail !== undefined || dados.prefereWhatsapp !== undefined) {
        const contatoAtual = this.obterContatoPaciente(paciente);
        paciente.contatoCriptografado = this.criptografia.criptografar(
          this.serializarContato({
            email: contatoAtual.email,
            whatsapp: contatoAtual.whatsapp,
            preferencias: {
              email: dados.prefereEmail ?? contatoAtual.preferencias.email,
              whatsapp: dados.prefereWhatsapp ?? contatoAtual.preferencias.whatsapp
            }
          })
        );
        await repositorioPacientes.save(paciente);
      }

      const preferenciasContato = this.obterContatoPaciente(paciente).preferencias;
      const repositorioConsentimentos = gerenciador.getRepository(ConsentimentoLgpdOrm);
      await repositorioConsentimentos.save(
        repositorioConsentimentos.create({
          tenantId,
          usuarioId,
          tipo: 'portal_paciente_lgpd',
          versao: dados.versaoLgpd ?? this.versaoLgpdAtual(),
          aceitoEm: new Date(),
          metadados: {
            pacienteId: paciente.id,
            origem: 'portal_paciente',
            preferenciasContato
          }
        })
      );

      return {
        ...this.mapearPerfilPaciente(paciente),
        lgpd: this.mapearLgpd(await this.listarConsentimentosPaciente(gerenciador, tenantId), paciente.id, usuarioId)
      };
    });
  }

  async exportarDadosLgpd(tenantId: string, usuarioId: string): Promise<ExportacaoDadosLgpdPaciente> {
    const dados = await this.obterResumoPortal(tenantId, usuarioId);
    return {
      geradoEm: new Date(),
      titular: {
        pacienteId: dados.paciente.id,
        nome: dados.paciente.nome,
        email: dados.perfil.email,
        whatsapp: dados.perfil.whatsapp
      },
      dados
    };
  }

  async registrarSolicitacaoLgpd(
    tenantId: string,
    usuarioId: string,
    dados: RegistrarSolicitacaoLgpdPortalDto
  ): Promise<SolicitacaoLgpdPaciente> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { tenantId, usuarioId, arquivadoEm: IsNull() }
      });
      if (!paciente) throw new ForbiddenException('Usuario nao possui paciente vinculado.');

      const criadoEm = new Date();
      const protocolo = `LGPD-${randomUUID()}`;
      const repositorioConsentimentos = gerenciador.getRepository(ConsentimentoLgpdOrm);
      await repositorioConsentimentos.save(
        repositorioConsentimentos.create({
          tenantId,
          usuarioId,
          tipo: `solicitacao_lgpd_${dados.tipo}`,
          versao: this.versaoLgpdAtual(),
          aceitoEm: criadoEm,
          metadados: {
            pacienteId: paciente.id,
            protocolo,
            status: 'recebida',
            canal: 'portal_paciente',
            detalhes: dados.detalhes?.trim() || undefined
          }
        })
      );

      return {
        protocolo,
        pacienteId: paciente.id,
        tipo: dados.tipo,
        status: 'recebida',
        criadoEm
      };
    });
  }

  async obterFormularioRespondido(
    tenantId: string,
    usuarioId: string,
    respostaId: string
  ): Promise<DetalheFormularioRespondidoPaciente> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { tenantId, usuarioId, arquivadoEm: IsNull() }
      });
      if (!paciente) throw new ForbiddenException('Usuario nao possui paciente vinculado.');

      const resposta = await gerenciador.getRepository(RespostaCheckinOrm).findOne({
        where: { id: respostaId, tenantId, pacienteId: paciente.id }
      });
      if (!resposta) throw new ForbiddenException('Formulario respondido indisponivel para este paciente.');

      const envio = await gerenciador.getRepository(EnvioQuestionarioOrm).findOne({
        where: { id: resposta.envioQuestionarioId, tenantId, pacienteId: paciente.id, status: 'respondido' }
      });
      if (!envio) throw new ForbiddenException('Formulario respondido indisponivel para este paciente.');

      const questionario = await gerenciador.getRepository(QuestionarioOrm).findOne({
        where: { id: envio.questionarioId, tenantId }
      });
      const perguntas = await gerenciador.getRepository(PerguntaOrm).find({
        where: { tenantId, questionarioId: envio.questionarioId },
        order: { ordem: 'ASC' }
      });
      const valores = await gerenciador.getRepository(RespostaValorOrm).find({
        where: { tenantId, respostaCheckinId: resposta.id }
      });
      const valoresPorPerguntaId = new Map(valores.map((valor) => [valor.perguntaId, valor]));

      return {
        respostaId: resposta.id,
        envioId: envio.id,
        questionarioId: envio.questionarioId,
        titulo: questionario?.titulo ?? 'Formulario',
        descricao: questionario?.descricao,
        scoreFinal: resposta.scoreFinal,
        finalizadoEm: resposta.finalizadoEm ?? envio.respondidoEm,
        respostas: perguntas.map((pergunta) => {
          const valor = valoresPorPerguntaId.get(pergunta.id);
          return {
            perguntaId: pergunta.id,
            enunciado: pergunta.enunciado,
            tipo: pergunta.tipo,
            obrigatoria: pergunta.obrigatoria,
            ordem: pergunta.ordem,
            valor: valor?.valor,
            scorePonderado: valor?.scorePonderado
          };
        })
      };
    });
  }

  private textoPayload(payload: Record<string, unknown>, chave: string): string | undefined {
    const valor = payload[chave];
    return typeof valor === 'string' && valor.trim() ? valor : undefined;
  }

  private mapearPerfilPaciente(paciente: PacienteOrm): PerfilPortalPaciente {
    const contato = this.obterContatoPaciente(paciente);
    return {
      paciente: {
        id: paciente.id,
        nome: this.criptografia.descriptografar(paciente.nomeCriptografado),
        statusAdesao: paciente.statusAdesao,
        scoreRisco: paciente.scoreRisco,
        ultimoCheckinEm: paciente.ultimoCheckinEm
      },
      perfil: {
        contato: contato.email ?? contato.whatsapp,
        email: contato.email,
        whatsapp: contato.whatsapp,
        preferenciasContato: contato.preferencias,
        dataNascimento: paciente.dataNascimento,
        profissionalResponsavelId: paciente.profissionalResponsavelId,
        ultimoCheckinEm: paciente.ultimoCheckinEm
      }
    };
  }

  private async listarConsentimentosPaciente(
    gerenciador: EntityManager,
    tenantId: string
  ): Promise<ConsentimentoLgpdOrm[]> {
    return gerenciador.getRepository(ConsentimentoLgpdOrm).find({
      where: { tenantId },
      order: { aceitoEm: 'DESC' },
      take: 200
    });
  }

  private mapearLgpd(consentimentos: ConsentimentoLgpdOrm[], pacienteId: string, usuarioId: string): LgpdPortalPaciente {
    const consentimentosPaciente = consentimentos.filter(
      (consentimento) => consentimento.usuarioId === usuarioId && !this.ehEventoSolicitacaoLgpd(consentimento.tipo)
    );

    return {
      versaoAtual: this.versaoLgpdAtual(),
      ultimoAceiteEm: consentimentosPaciente[0]?.aceitoEm,
      consentimentos: consentimentosPaciente.map((consentimento) => ({
        id: consentimento.id,
        tipo: consentimento.tipo,
        versao: consentimento.versao,
        aceitoEm: consentimento.aceitoEm,
        metadados: consentimento.metadados ?? {}
      })),
      solicitacoes: this.consolidarSolicitacoesLgpdPortal(consentimentos, pacienteId, usuarioId)
    };
  }

  private consolidarSolicitacoesLgpdPortal(
    eventos: ConsentimentoLgpdOrm[],
    pacienteId: string,
    usuarioId: string
  ): SolicitacaoLgpdPortalPaciente[] {
    const solicitacoes = new Map<string, SolicitacaoLgpdPortalPaciente>();

    eventos
      .filter((evento) => this.ehEventoSolicitacaoLgpd(evento.tipo))
      .filter((evento) => evento.usuarioId === usuarioId || this.metadadoTexto(evento.metadados, 'pacienteId') === pacienteId)
      .sort((a, b) => this.timestampData(a.aceitoEm) - this.timestampData(b.aceitoEm))
      .forEach((evento) => {
        const protocolo = this.metadadoTexto(evento.metadados, 'protocolo');
        if (!protocolo) return;

        if (evento.tipo.startsWith('solicitacao_lgpd_')) {
          const tipo = evento.tipo.replace('solicitacao_lgpd_', '');
          if (tipo !== 'retificacao' && tipo !== 'exclusao') return;

          solicitacoes.set(protocolo, {
            protocolo,
            pacienteId: this.metadadoTexto(evento.metadados, 'pacienteId') ?? pacienteId,
            tipo,
            status: this.normalizarStatusLgpd(this.metadadoTexto(evento.metadados, 'status')),
            detalhes: this.metadadoTexto(evento.metadados, 'detalhes'),
            abertoEm: evento.aceitoEm,
            atualizadoEm: evento.aceitoEm
          });
          return;
        }

        const solicitacao = solicitacoes.get(protocolo);
        if (!solicitacao) return;

        solicitacao.status = this.normalizarStatusLgpd(this.metadadoTexto(evento.metadados, 'status'));
        solicitacao.atualizadoEm = evento.aceitoEm;

        if (evento.tipo === 'tratativa_lgpd') {
          solicitacao.ultimaTratativa = this.metadadoTexto(evento.metadados, 'detalhes') ?? solicitacao.ultimaTratativa;
          return;
        }

        if (evento.tipo === 'resposta_lgpd_preparada') {
          solicitacao.ultimaResposta =
            this.metadadoTexto(evento.metadados, 'assuntoEmail') ??
            this.metadadoTexto(evento.metadados, 'detalhes') ??
            solicitacao.ultimaResposta;
        }
      });

    return Array.from(solicitacoes.values()).sort((a, b) => this.timestampData(b.atualizadoEm) - this.timestampData(a.atualizadoEm));
  }

  private ehEventoSolicitacaoLgpd(tipo: string): boolean {
    return tipo.startsWith('solicitacao_lgpd_') || tipo === 'tratativa_lgpd' || tipo === 'resposta_lgpd_preparada';
  }

  private metadadoTexto(metadados: Record<string, unknown> | undefined, chave: string): string | undefined {
    const valor = metadados?.[chave];
    return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
  }

  private normalizarStatusLgpd(status?: string): StatusSolicitacaoLgpdPortal {
    if (status === 'em_tratamento' || status === 'concluida' || status === 'indeferida') return status;
    return 'recebida';
  }

  private timestampData(valor?: Date): number {
    if (!valor) return 0;
    return valor instanceof Date ? valor.getTime() : new Date(valor).getTime();
  }

  private obterContatoPaciente(paciente: PacienteOrm): ContatoPacientePortal {
    const preferencias = { email: true, whatsapp: true };
    if (!paciente.contatoCriptografado) return { preferencias };

    const contato = this.criptografia.descriptografar(paciente.contatoCriptografado);
    try {
      const parseado = JSON.parse(contato) as {
        email?: unknown;
        whatsapp?: unknown;
        preferencias?: { email?: unknown; whatsapp?: unknown };
      };
      return {
        email: typeof parseado.email === 'string' ? this.normalizarEmail(parseado.email) : undefined,
        whatsapp: typeof parseado.whatsapp === 'string' ? this.normalizarWhatsapp(parseado.whatsapp) : undefined,
        preferencias: {
          email: typeof parseado.preferencias?.email === 'boolean' ? parseado.preferencias.email : true,
          whatsapp: typeof parseado.preferencias?.whatsapp === 'boolean' ? parseado.preferencias.whatsapp : true
        }
      };
    } catch {
      return contato.includes('@')
        ? { email: this.normalizarEmail(contato), preferencias }
        : { whatsapp: this.normalizarWhatsapp(contato), preferencias };
    }
  }

  private serializarContato(contato: ContatoPacientePortal): string {
    return JSON.stringify({
      email: contato.email,
      whatsapp: contato.whatsapp,
      preferencias: contato.preferencias
    });
  }

  private normalizarEmail(email?: string): string | undefined {
    const normalizado = email?.trim().toLowerCase();
    return normalizado || undefined;
  }

  private normalizarWhatsapp(whatsapp?: string): string | undefined {
    const normalizado = whatsapp?.replace(/\D/g, '');
    return normalizado || undefined;
  }

  private versaoLgpdAtual(): string {
    return process.env.OCTACLIN_LGPD_VERSAO ?? '2026-07';
  }

  private montarLinkFormulario(tenantId: string, envioId: string): string {
    const baseUrl = (process.env.OCTACLIN_WEB_URL ?? process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const assinatura = createHmac('sha256', process.env.FORMULARIO_PUBLICO_SEGREDO ?? 'dev-form-secret')
      .update(`${tenantId}.${envioId}`)
      .digest('base64url');
    return `${baseUrl}/formularios/${tenantId}.${envioId}.${assinatura}`;
  }
}
