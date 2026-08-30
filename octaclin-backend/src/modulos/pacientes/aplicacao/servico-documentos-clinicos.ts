import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { ROTULOS_FORMA_PAGAMENTO, formatarValorBRL } from '../../agenda/dominio/financeiro-consulta';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoPortalCliente } from '../../clientes/aplicacao/servico-portal-cliente';
import { ServicoComunicacoes } from '../../comunicacoes/aplicacao/servico-comunicacoes';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import {
  enderecoEmLinha,
  paragrafosDocumento,
  renderizarDocumento,
  resolverModelo
} from '../dominio/documentos-clinicos';
import type { TipoDocumentoClinico } from '../dominio/documentos-clinicos';
import { AcompanhamentoTarefaOrm } from '../infraestrutura/acompanhamento-tarefa.orm';
import { DocumentoEmitidoOrm } from '../infraestrutura/documento-emitido.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import {
  CancelarDocumentoClinicoDto,
  DocumentoClinicoRespostaDto,
  EmitirDocumentoClinicoDto,
  ResultadoEnvioDocumentoDto
} from './dtos';

/** Cabecalho da clinica congelado no momento da emissao. */
interface CabecalhoDocumento {
  clinicaNome: string;
  clinicaDocumento: string;
  clinicaEndereco: string;
  profissionalNome: string;
  profissionalRegistro: string;
  profissionalEspecialidade: string;
  emitidoPor: string;
}

/**
 * Tipos que podem sair por e-mail.
 *
 * `relatorio_alta` fica **fora de proposito**: o corpo dele e narrativa clinica e
 * `mensagens_notificacao.payload` e jsonb em claro. Enfiar o relatorio ali
 * colocaria texto clinico sem criptografia numa tabela que existe para
 * telemetria de entrega. A alta e impressa e entregue na consulta de
 * encerramento, que e como ela acontece na clinica.
 */
const TIPOS_ENVIAVEIS_POR_EMAIL: readonly TipoDocumentoClinico[] = [
  'declaracao_comparecimento',
  'recibo_consulta'
];

/** Tipos que exigem consulta de origem. Sem ela o documento nao prova nada. */
const TIPOS_COM_CONSULTA: readonly TipoDocumentoClinico[] = ['declaracao_comparecimento', 'recibo_consulta'];

@Injectable()
export class ServicoDocumentosClinicos {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly portalCliente: ServicoPortalCliente,
    private readonly comunicacoes: ServicoComunicacoes
  ) {}

  async emitir(
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado,
    dados: EmitirDocumentoClinicoDto
  ): Promise<DocumentoClinicoRespostaDto> {
    const [configuracoes, perfil, modelos] = await Promise.all([
      this.portalCliente.obterConfiguracoes(tenantId),
      this.portalCliente.obterPerfilEmpresa(tenantId),
      this.portalCliente.obterModelosDocumento(tenantId)
    ]);

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario);
      const consulta = await this.resolverConsultaDeOrigem(gerenciador, tenantId, paciente, dados);
      const profissional = await this.resolverProfissional(gerenciador, tenantId, paciente, consulta);
      await this.garantirAutoriaLegitima(gerenciador, tenantId, usuario, dados.tipo, profissional);

      const emitidoEm = new Date();
      const timezone = configuracoes.timezone || 'America/Sao_Paulo';
      const cabecalho: CabecalhoDocumento = {
        clinicaNome: configuracoes.marca.nomeExibido || perfil.nomeFantasia || perfil.nomeLegal,
        clinicaDocumento: perfil.documento,
        clinicaEndereco: enderecoEmLinha(perfil.endereco),
        profissionalNome: profissional ? this.criptografia.descriptografar(profissional.nomeCriptografado) : '',
        profissionalRegistro: profissional?.registroProfissional ?? '',
        profissionalEspecialidade: profissional?.especialidade ?? '',
        emitidoPor: usuario.usuarioId
      };

      const variaveis = {
        ...cabecalho,
        pacienteNome: this.criptografia.descriptografar(paciente.nomeCriptografado),
        dataEmissao: this.dataExtenso(emitidoEm, timezone),
        cidadeEmissao: dados.cidadeEmissao?.trim() || perfil.endereco.cidade,
        ...(consulta ? this.variaveisDaConsulta(consulta) : {}),
        ...(dados.tipo === 'recibo_consulta' && consulta ? this.variaveisDoRecibo(consulta, timezone) : {}),
        ...(dados.tipo === 'relatorio_alta'
          ? await this.variaveisDoAcompanhamento(
              gerenciador,
              tenantId,
              pacienteId,
              profissional?.id,
              timezone,
              dados.conteudo
            )
          : {})
      };

      const modeloSalvo = modelos.modelos.find((item) => item.tipo === dados.tipo);
      const renderizado = renderizarDocumento(
        resolverModelo(dados.tipo, modeloSalvo && { titulo: modeloSalvo.titulo, corpo: modeloSalvo.corpo }),
        variaveis
      );

      this.garantirDocumentoIdentificavel(renderizado.variaveisVazias);

      const repositorio = gerenciador.getRepository(DocumentoEmitidoOrm);
      const documento = await this.salvarProtegidoContraDuplicidade(() =>
        repositorio.save(
          repositorio.create({
            tenantId,
            pacienteId,
            profissionalId: profissional?.id,
            autorUsuarioId: usuario.usuarioId,
            tipo: dados.tipo,
            consultaId: consulta?.id,
            titulo: renderizado.titulo,
            corpoCriptografado: this.criptografia.criptografar(renderizado.corpo),
            cabecalhoCriptografado: this.criptografia.criptografar(JSON.stringify(cabecalho)),
            emitidoEm
          })
        )
      );

      return this.mapear(documento, renderizado.variaveisVazias);
    });
  }

  async listar(
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado
  ): Promise<DocumentoClinicoRespostaDto[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario);
      const documentos = await gerenciador.getRepository(DocumentoEmitidoOrm).find({
        where: { tenantId, pacienteId },
        order: { emitidoEm: 'DESC' },
        take: 100
      });

      return documentos.map((documento) => this.mapear(documento));
    });
  }

  async obter(
    tenantId: string,
    pacienteId: string,
    documentoId: string,
    usuario: UsuarioAutenticado
  ): Promise<DocumentoClinicoRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario);
      return this.mapear(await this.buscarDocumento(gerenciador, tenantId, pacienteId, documentoId));
    });
  }

  /**
   * Cancela o documento. Nao apaga e nao edita: o papel ja pode estar com
   * terceiro, e o registro do que foi emitido tem de continuar existindo.
   */
  async cancelar(
    tenantId: string,
    pacienteId: string,
    documentoId: string,
    usuario: UsuarioAutenticado,
    dados: CancelarDocumentoClinicoDto
  ): Promise<DocumentoClinicoRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario);
      const repositorio = gerenciador.getRepository(DocumentoEmitidoOrm);
      const documento = await this.buscarDocumento(gerenciador, tenantId, pacienteId, documentoId);
      if (documento.canceladoEm) throw new ConflictException('Documento ja cancelado.');

      documento.canceladoEm = new Date();
      documento.motivoCancelamento = dados.motivo?.trim() || undefined;
      return this.mapear(await repositorio.save(documento));
    });
  }

  async enviarPorEmail(
    tenantId: string,
    pacienteId: string,
    documentoId: string,
    usuario: UsuarioAutenticado
  ): Promise<ResultadoEnvioDocumentoDto> {
    const contexto = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await this.garantirPacienteNoEscopo(gerenciador, tenantId, pacienteId, usuario);
      const documento = await this.buscarDocumento(gerenciador, tenantId, pacienteId, documentoId);
      if (documento.canceladoEm) throw new BadRequestException('Documento cancelado nao pode ser enviado.');
      if (!TIPOS_ENVIAVEIS_POR_EMAIL.includes(documento.tipo)) {
        throw new BadRequestException(
          'Este documento nao e enviado por e-mail. Imprima e entregue ao paciente.'
        );
      }

      return { documento, email: this.emailDoPaciente(paciente) };
    });

    if (!contexto.email) return { status: 'ignorado', motivo: 'contato_ausente' };

    const [canais, templates] = await Promise.all([
      this.comunicacoes.listarCanais(tenantId),
      this.comunicacoes.listarTemplates(tenantId)
    ]);
    const canal = canais.find((item) => item.tipo === 'email' && item.ativo);
    if (!canal) return { status: 'ignorado', motivo: 'canal_ausente' };
    const template = templates.find((item) => item.canal === 'email');
    if (!template) return { status: 'ignorado', motivo: 'template_ausente' };

    // Corpo ilegivel nao vira e-mail: melhor recusar do que mandar aviso de falha ao paciente.
    let corpo: string;
    try {
      corpo = this.criptografia.descriptografar(contexto.documento.corpoCriptografado);
    } catch {
      throw new BadRequestException('Conteudo do documento nao pode ser recuperado. Emita outro antes de enviar.');
    }

    const mensagem = await this.comunicacoes.dispararMensagem(tenantId, {
      pacienteId,
      canalId: canal.id,
      templateId: template.id,
      payload: {
        destino: contexto.email,
        assunto: contexto.documento.titulo,
        texto: corpo,
        documentoId: contexto.documento.id
      }
    }, usuario);
    await this.comunicacoes.publicarEventoNotificacao(tenantId, mensagem.id);

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      await gerenciador
        .getRepository(DocumentoEmitidoOrm)
        .update({ id: contexto.documento.id, tenantId }, { enviadoEm: new Date() });
    });

    return { status: 'pendente', mensagemId: mensagem.id };
  }

  private async resolverConsultaDeOrigem(
    gerenciador: EntityManager,
    tenantId: string,
    paciente: PacienteOrm,
    dados: EmitirDocumentoClinicoDto
  ): Promise<AgendaConsultaOrm | undefined> {
    if (!TIPOS_COM_CONSULTA.includes(dados.tipo)) return undefined;
    if (!dados.consultaId) {
      throw new BadRequestException('Este documento exige a consulta de origem.');
    }

    const consulta = await gerenciador.getRepository(AgendaConsultaOrm).findOne({
      where: { id: dados.consultaId, tenantId, pacienteId: paciente.id }
    });
    if (!consulta) throw new NotFoundException('Consulta nao encontrada para este paciente.');

    if (dados.tipo === 'recibo_consulta') {
      // Recibo declara dinheiro que entrou. Emitir antes do pagamento e declarar
      // recebimento que nao aconteceu — e o paciente fica com a prova disso.
      if (consulta.statusPagamento !== 'pago') {
        throw new BadRequestException('Recibo so pode ser emitido a partir de consulta com pagamento registrado.');
      }
      if (consulta.pacoteId) {
        throw new BadRequestException(
          'Consulta de pacote nao gera recibo proprio: o valor foi pago no pacote de sessoes.'
        );
      }
      return consulta;
    }

    // Criterio de aceite da fase 208: so consulta concluida gera declaracao.
    if (consulta.status !== 'concluida') {
      throw new BadRequestException(
        'Declaracao de comparecimento so pode ser emitida a partir de consulta concluida.'
      );
    }

    return consulta;
  }

  private async resolverProfissional(
    gerenciador: EntityManager,
    tenantId: string,
    paciente: PacienteOrm,
    consulta?: AgendaConsultaOrm
  ): Promise<ProfissionalOrm | null> {
    const profissionalId = consulta?.profissionalId ?? paciente.profissionalResponsavelId;
    if (!profissionalId) return null;
    // Profissional arquivado nao assina documento novo: ex-funcionario nao emite.
    return gerenciador.getRepository(ProfissionalOrm).findOne({
      where: { id: profissionalId, tenantId, arquivadoEm: IsNull() }
    });
  }

  /**
   * Documento sem paciente identificado nao serve como documento, e documento
   * sem profissional identificado e registrado no conselho nao vale como prova:
   * quem recebe nao tem como saber quem assinou.
   *
   * Isto e bloqueio, nao aviso. O aviso da interface nao sai na folha impressa —
   * o terceiro receberia a linha de assinatura em branco sem sinal de que algo
   * faltou.
   */
  private garantirDocumentoIdentificavel(variaveisVazias: string[]): void {
    const obrigatorias: Record<string, string> = {
      pacienteNome: 'Paciente sem nome cadastrado',
      profissionalNome: 'Profissional responsavel nao identificado',
      profissionalRegistro: 'Profissional sem registro no conselho cadastrado'
    };
    const faltando = Object.keys(obrigatorias).filter((campo) => variaveisVazias.includes(campo));
    if (!faltando.length) return;

    throw new BadRequestException(
      `${faltando.map((campo) => obrigatorias[campo]).join('; ')}. Documento nao pode ser emitido.`
    );
  }

  /**
   * Relatorio de alta carrega narrativa clinica escrita na hora e sai assinado
   * pelo profissional creditado. Quem escreve tem de ser quem assina: caso
   * contrario o texto de um sai sob o registro de conselho de outro, sem que o
   * outro tenha visto.
   *
   * Declaracao de comparecimento nao entra nesta regra — ela nao tem conteudo
   * autoral, so relata o que a agenda ja registrou.
   */
  private async garantirAutoriaLegitima(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado,
    tipo: TipoDocumentoClinico,
    profissional: ProfissionalOrm | null
  ): Promise<void> {
    if (tipo !== 'relatorio_alta') return;

    const profissionalDoUsuario = await gerenciador.getRepository(ProfissionalOrm).findOne({
      where: { usuarioId: usuario.usuarioId, tenantId, arquivadoEm: IsNull() }
    });

    if (!profissionalDoUsuario || profissionalDoUsuario.id !== profissional?.id) {
      throw new ForbiddenException(
        'Relatorio de alta so pode ser emitido pelo proprio profissional responsavel pelo acompanhamento.'
      );
    }
  }

  private variaveisDaConsulta(consulta: AgendaConsultaOrm): Record<string, string> {
    const timezone = consulta.timezone || 'America/Sao_Paulo';
    const duracaoMinutos = Math.max(
      1,
      Math.round((consulta.fimEm.getTime() - consulta.inicioEm.getTime()) / 60000)
    );

    return {
      dataConsulta: this.dataCurta(consulta.inicioEm, timezone),
      horaInicio: this.hora(consulta.inicioEm, timezone),
      horaFim: this.hora(consulta.fimEm, timezone),
      duracaoMinutos: String(duracaoMinutos),
      modalidade: consulta.modalidade === 'online' ? 'online' : 'presencial'
    };
  }

  /** Dinheiro sai do inteiro em centavos direto para "R$ 180,00". */
  private variaveisDoRecibo(consulta: AgendaConsultaOrm, timezone: string): Record<string, string> {
    return {
      valor: formatarValorBRL(consulta.valorCentavos ?? 0),
      formaPagamento: consulta.formaPagamento ? ROTULOS_FORMA_PAGAMENTO[consulta.formaPagamento] : '',
      dataPagamento: consulta.pagoEm ? this.dataCurta(consulta.pagoEm, timezone) : ''
    };
  }

  /**
   * Numeros do relatorio ficam **restritos ao profissional creditado**.
   *
   * Somar consultas e metas de toda a clinica inflaria o acompanhamento de quem
   * assina e, pior, contaria a quem recebe o papel que o paciente tambem e
   * atendido por outra especialidade na mesma casa. O relatorio fecha um
   * acompanhamento, nao a vida clinica inteira do paciente.
   */
  private async variaveisDoAcompanhamento(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    profissionalId: string | undefined,
    timezone: string,
    conteudo?: string
  ): Promise<Record<string, string>> {
    const escopo = { tenantId, pacienteId, ...(profissionalId ? { profissionalId } : {}) };
    const [consultas, tarefas] = await Promise.all([
      gerenciador.getRepository(AgendaConsultaOrm).find({
        where: { ...escopo, status: 'concluida' },
        order: { inicioEm: 'ASC' }
      }),
      gerenciador.getRepository(AcompanhamentoTarefaOrm).find({ where: escopo })
    ]);

    const metas = tarefas.filter((tarefa) => tarefa.status !== 'cancelada');
    const primeira = consultas[0];
    const ultima = consultas[consultas.length - 1];

    return {
      periodoInicio: primeira ? this.dataCurta(primeira.inicioEm, timezone) : '',
      periodoFim: ultima ? this.dataCurta(ultima.inicioEm, timezone) : '',
      totalConsultas: String(consultas.length),
      metasConcluidas: String(metas.filter((tarefa) => tarefa.status === 'concluida').length),
      metasTotais: String(metas.length),
      conteudo: conteudo?.trim() ?? ''
    };
  }

  private async buscarDocumento(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    documentoId: string
  ): Promise<DocumentoEmitidoOrm> {
    const documento = await gerenciador.getRepository(DocumentoEmitidoOrm).findOne({
      where: { id: documentoId, tenantId, pacienteId }
    });
    if (!documento) throw new NotFoundException('Documento nao encontrado.');
    return documento;
  }

  /** Mesmo escopo por profissional que o resto do prontuario aplica. */
  private async garantirPacienteNoEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado
  ): Promise<PacienteOrm> {
    const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: {
        id: pacienteId,
        tenantId,
        arquivadoEm: IsNull(),
        ...(profissionalResponsavelId ? { profissionalResponsavelId } : {})
      }
    });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
    return paciente;
  }

  /** O indice unico parcial e quem garante uma declaracao viva por consulta. */
  private async salvarProtegidoContraDuplicidade(
    salvar: () => Promise<DocumentoEmitidoOrm>
  ): Promise<DocumentoEmitidoOrm> {
    try {
      return await salvar();
    } catch (erro) {
      if ((erro as { code?: string }).code === '23505') {
        throw new ConflictException(
          'Ja existe declaracao de comparecimento valida para esta consulta. Cancele a anterior antes de emitir outra.'
        );
      }
      throw erro;
    }
  }

  private emailDoPaciente(paciente: PacienteOrm): string | undefined {
    if (!paciente.contatoCriptografado) return undefined;
    const contato = this.criptografia.descriptografar(paciente.contatoCriptografado);
    try {
      const parseado = JSON.parse(contato) as { email?: unknown; preferencias?: { email?: unknown } };
      if (parseado.preferencias?.email === false) return undefined;
      return typeof parseado.email === 'string' ? parseado.email.trim().toLowerCase() || undefined : undefined;
    } catch {
      return contato.includes('@') ? contato.trim().toLowerCase() : undefined;
    }
  }

  private mapear(documento: DocumentoEmitidoOrm, variaveisVazias: string[] = []): DocumentoClinicoRespostaDto {
    const corpo = this.lerCorpo(documento);
    return {
      id: documento.id,
      tipo: documento.tipo,
      titulo: documento.titulo,
      corpo,
      paragrafos: paragrafosDocumento(corpo),
      cabecalho: this.lerCabecalho(documento),
      consultaId: documento.consultaId,
      emitidoEm: documento.emitidoEm.toISOString(),
      canceladoEm: documento.canceladoEm?.toISOString(),
      motivoCancelamento: documento.motivoCancelamento,
      enviadoEm: documento.enviadoEm?.toISOString(),
      podeEnviarPorEmail: TIPOS_ENVIAVEIS_POR_EMAIL.includes(documento.tipo),
      variaveisVazias
    };
  }

  /**
   * Registro ilegivel nao derruba a lista inteira do paciente: o documento
   * aparece marcado como ilegivel e os outros continuam abrindo. Mesmo criterio
   * da leitura de avaliacao antropometrica.
   */
  private lerCorpo(documento: DocumentoEmitidoOrm): string {
    try {
      return this.criptografia.descriptografar(documento.corpoCriptografado);
    } catch {
      return 'Conteudo ilegivel: o documento nao pode ser recuperado. Emita outro.';
    }
  }

  /**
   * Devolve campo a campo, nao o objeto inteiro: `emitidoPor` e id interno de
   * usuario e fica so no registro e na auditoria. Objeto repassado direto leva
   * junto todo campo que o cabecalho ganhar depois.
   */
  private lerCabecalho(documento: DocumentoEmitidoOrm): DocumentoClinicoRespostaDto['cabecalho'] {
    try {
      const cabecalho = JSON.parse(
        this.criptografia.descriptografar(documento.cabecalhoCriptografado)
      ) as CabecalhoDocumento;

      return {
        clinicaNome: cabecalho.clinicaNome,
        clinicaDocumento: cabecalho.clinicaDocumento,
        clinicaEndereco: cabecalho.clinicaEndereco,
        profissionalNome: cabecalho.profissionalNome,
        profissionalRegistro: cabecalho.profissionalRegistro,
        profissionalEspecialidade: cabecalho.profissionalEspecialidade
      };
    } catch {
      return undefined;
    }
  }

  private dataCurta(instante: Date, timezone: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(instante);
  }

  private dataExtenso(instante: Date, timezone: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(instante);
  }

  private hora(instante: Date, timezone: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit'
    }).format(instante);
  }
}
