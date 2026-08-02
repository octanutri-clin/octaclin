import { randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ServicoArmazenamentoObjetos, validarUploadSolicitado } from '../../../infraestrutura/armazenamento/servico-armazenamento-objetos';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoPortalCliente } from '../../clientes/aplicacao/servico-portal-cliente';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { validarDuracaoMidia } from '../dominio/validacao-midia';
import { AcompanhanteOrm } from '../infraestrutura/acompanhante.orm';
import { ArquivoMidiaOrm } from '../infraestrutura/arquivo-midia.orm';
import { LogDiarioRapidoOrm } from '../infraestrutura/log-diario-rapido.orm';
import { SincronizacaoMobileOrm } from '../infraestrutura/sincronizacao-mobile.orm';
import {
  CriarAcompanhanteDto,
  ItemSincronizacaoMobileDto,
  RegistrarDiarioRapidoDto,
  SincronizarLoteMobileDto,
  SolicitarUploadMidiaDto
} from './dtos';

export interface ResultadoItemSincronizacao {
  idLocal: string;
  status: 'sincronizado' | 'erro';
  recursoId?: string;
  erro?: string;
}

export interface AcompanhanteResumo {
  id: string;
  tenantId: string;
  pacienteId: string;
  ativo: boolean;
  criadoEm: Date;
}

export interface ArquivoMidiaResumo {
  id: string;
  pacienteId: string;
  tipo: ArquivoMidiaOrm['tipo'];
  categoria: ArquivoMidiaOrm['categoria'];
  nomeArquivo?: string;
  mimeType: string;
  tamanhoBytes: string;
  hashConteudo?: string;
  status: ArquivoMidiaOrm['status'];
  criadoEm: Date;
  confirmadoEm?: Date;
}

@Injectable()
export class ServicoMobile {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly senhas: ServicoSenhas,
    private readonly armazenamento: ServicoArmazenamentoObjetos,
    private readonly portalCliente: ServicoPortalCliente
  ) {}

  async listarDiarioRapido(tenantId: string, usuario: UsuarioAutenticado): Promise<LogDiarioRapidoOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const pacienteIds = await this.listarPacienteIdsPermitidos(gerenciador, tenantId, usuario);
      return gerenciador.getRepository(LogDiarioRapidoOrm).find({
        where: { tenantId, ...(pacienteIds ? { pacienteId: In(pacienteIds) } : {}) },
        order: { registradoEm: 'DESC' },
        take: 50
      });
    });
  }

  async registrarDiarioRapido(
    tenantId: string,
    dados: RegistrarDiarioRapidoDto,
    usuario: UsuarioAutenticado
  ): Promise<LogDiarioRapidoOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacientePermitido(gerenciador, tenantId, dados.pacienteId, usuario);
      return this.criarLogDiario(gerenciador, tenantId, dados);
    });
  }

  async listarArquivosMidia(
    tenantId: string,
    usuario: UsuarioAutenticado,
    pacienteId?: string
  ): Promise<ArquivoMidiaResumo[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      if (pacienteId) await this.garantirPacientePermitido(gerenciador, tenantId, pacienteId, usuario);
      const pacienteIds = await this.listarPacienteIdsPermitidos(gerenciador, tenantId, usuario);
      const arquivos = await gerenciador.getRepository(ArquivoMidiaOrm).find({
        where: {
          tenantId,
          status: 'confirmado',
          ...(pacienteId ? { pacienteId } : pacienteIds ? { pacienteId: In(pacienteIds) } : {})
        },
        order: { criadoEm: 'DESC' },
        take: 50
      });
      return arquivos.map((arquivo) => this.resumirArquivo(arquivo));
    });
  }

  async solicitarUploadMidia(
    tenantId: string,
    dados: SolicitarUploadMidiaDto,
    usuario: UsuarioAutenticado,
    vinculo: Record<string, string> = {}
  ) {
    return this.solicitarUploadMidiaInterno(tenantId, dados, vinculo, (gerenciador) =>
      this.garantirPacientePermitido(gerenciador, tenantId, dados.pacienteId, usuario)
    );
  }

  async solicitarUploadMidiaFormularioPublico(
    tenantId: string,
    dados: SolicitarUploadMidiaDto,
    vinculo: Record<string, string>
  ) {
    return this.solicitarUploadMidiaInterno(tenantId, dados, vinculo, (gerenciador) =>
      this.garantirPacienteExistente(gerenciador, tenantId, dados.pacienteId)
    );
  }

  private async solicitarUploadMidiaInterno(
    tenantId: string,
    dados: SolicitarUploadMidiaDto,
    vinculo: Record<string, string>,
    autorizarPaciente: (gerenciador: EntityManager) => Promise<void>
  ) {
    validarDuracaoMidia(dados.tipo, dados.duracaoSegundos);
    validarUploadSolicitado(dados.tipo, dados.mimeType, dados.tamanhoBytes);
    const id = randomUUID();
    const bucket = this.armazenamento.bucket;
    const chaveObjeto = `pendentes/${tenantId}/${dados.pacienteId}/${dados.tipo}/${id}`;

    const { arquivo, expirados } = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      await gerenciador.query('SELECT pg_advisory_xact_lock(hashtext($1))', [tenantId]);
      await autorizarPaciente(gerenciador);
      const repositorio = gerenciador.getRepository(ArquivoMidiaOrm);
      const agora = Date.now();
      const pendentes = await repositorio.find({ where: { tenantId, status: 'pendente' } });
      const expirados = pendentes.filter((item) => item.criadoEm && agora - item.criadoEm.getTime() >= 24 * 60 * 60 * 1000);
      for (const item of expirados) {
        item.status = 'excluido';
        item.excluidoEm = new Date(agora);
        await repositorio.save(item);
      }

      const limite = await this.portalCliente.checarLimite(tenantId, 'armazenamentoMb');
      const reservadoBytes = pendentes
        .filter((item) => !expirados.includes(item))
        .reduce((total, item) => total + Number(item.metadados?.tamanhoSolicitadoBytes ?? 0), 0);
      if (!limite.permitido || (limite.restante !== null && reservadoBytes + dados.tamanhoBytes > limite.restante * 1024 * 1024)) {
        throw new ForbiddenException(limite.mensagem ?? 'Limite de armazenamento do plano atingido.');
      }

      const arquivo = await repositorio.save(
        repositorio.create({
          id,
          tenantId,
          pacienteId: dados.pacienteId,
          tipo: dados.tipo,
          categoria: dados.categoria ?? (dados.tipo === 'imagem' ? 'foto' : dados.tipo === 'documento' ? 'documento' : 'diario'),
          bucket,
          chaveObjeto,
          mimeType: dados.mimeType,
          tamanhoBytes: '0',
          hashConteudo: undefined,
          status: 'pendente',
          nomeOriginalCriptografado: dados.nomeArquivo ? this.criptografia.criptografar(dados.nomeArquivo) : undefined,
          metadados: { duracaoSegundos: dados.duracaoSegundos, tamanhoSolicitadoBytes: dados.tamanhoBytes, vinculo }
        })
      );
      return { arquivo, expirados };
    });

    await Promise.allSettled(expirados.map((item) => this.armazenamento.excluirObjeto(item.bucket, item.chaveObjeto)));

    const metadadosUpload = { tenantid: tenantId, pacienteid: dados.pacienteId, arquivoid: arquivo.id, ...vinculo };
    const uploadUrl = await this.armazenamento.criarUploadAssinado({
      chaveObjeto,
      mimeType: dados.mimeType,
      tamanhoMaximoBytes: dados.tamanhoBytes,
      metadados: metadadosUpload
    });
    return {
      arquivo: this.resumirArquivo(arquivo),
      uploadUrl,
      uploadHeaders: {
        'Content-Type': dados.mimeType,
        'If-None-Match': '*',
        ...Object.fromEntries(Object.entries(metadadosUpload).map(([chave, valor]) => [`x-amz-meta-${chave}`, valor]))
      },
      expiraEmSegundos: 300
    };
  }

  async confirmarUploadMidia(
    tenantId: string,
    arquivoId: string,
    usuario: UsuarioAutenticado,
    vinculoEsperado: Record<string, string> = {}
  ): Promise<ArquivoMidiaResumo> {
    return this.confirmarUploadMidiaInterno(
      tenantId,
      arquivoId,
      vinculoEsperado,
      (gerenciador) => this.obterArquivoPermitido(gerenciador, tenantId, arquivoId, usuario)
    );
  }

  async confirmarUploadMidiaFormularioPublico(
    tenantId: string,
    arquivoId: string,
    pacienteId: string,
    vinculoEsperado: Record<string, string>
  ): Promise<ArquivoMidiaResumo> {
    return this.confirmarUploadMidiaInterno(
      tenantId,
      arquivoId,
      vinculoEsperado,
      (gerenciador) => this.obterArquivoDoFormulario(gerenciador, tenantId, arquivoId, pacienteId)
    );
  }

  private async confirmarUploadMidiaInterno(
    tenantId: string,
    arquivoId: string,
    vinculoEsperado: Record<string, string>,
    obterArquivo: (gerenciador: EntityManager) => Promise<ArquivoMidiaOrm>
  ): Promise<ArquivoMidiaResumo> {
    const arquivo = await this.executorTenant.executar(tenantId, obterArquivo);
    if (arquivo.status === 'confirmado') return this.resumirArquivo(arquivo);
    if (arquivo.status !== 'pendente') throw new BadRequestException('Anexo nao pode ser confirmado.');
    const vinculo = (arquivo.metadados?.vinculo ?? {}) as Record<string, string>;
    if (Object.entries(vinculoEsperado).some(([chave, valor]) => vinculo[chave] !== valor)) {
      throw new NotFoundException('Anexo nao encontrado.');
    }

    let inspecao: { tamanhoBytes: number; mimeType: string; hashConteudo: string };
    const chaveConfirmada = `confirmados/${tenantId}/${arquivo.pacienteId}/${arquivo.tipo}/${arquivo.id}`;
    try {
      inspecao = await this.armazenamento.inspecionarObjeto(arquivo.bucket, arquivo.chaveObjeto, arquivo.tipo, {
        tenantid: tenantId,
        pacienteid: arquivo.pacienteId,
        arquivoid: arquivo.id,
        ...vinculo
      });
      await this.armazenamento.promoverObjeto(arquivo.bucket, arquivo.chaveObjeto, chaveConfirmada);
    } catch (erro) {
      await Promise.allSettled([
        this.armazenamento.excluirObjeto(arquivo.bucket, arquivo.chaveObjeto),
        this.executorTenant.executar(tenantId, async (gerenciador) => {
          const atual = await obterArquivo(gerenciador);
          atual.status = 'excluido';
          atual.excluidoEm = new Date();
          await gerenciador.getRepository(ArquivoMidiaOrm).save(atual);
        })
      ]);
      throw erro;
    }
    try {
      const confirmado = await this.executorTenant.executar(tenantId, async (gerenciador) => {
        const atual = await obterArquivo(gerenciador);
        if (atual.status === 'confirmado') return this.resumirArquivo(atual);
        if (atual.status !== 'pendente') throw new BadRequestException('Anexo nao pode ser confirmado.');
        Object.assign(atual, inspecao, {
          chaveObjeto: chaveConfirmada,
          tamanhoBytes: String(inspecao.tamanhoBytes),
          status: 'confirmado',
          confirmadoEm: new Date()
        });
        return this.resumirArquivo(await gerenciador.getRepository(ArquivoMidiaOrm).save(atual));
      });
      await Promise.allSettled([this.armazenamento.excluirObjeto(arquivo.bucket, arquivo.chaveObjeto)]);
      return confirmado;
    } catch (erro) {
      await Promise.allSettled([this.armazenamento.excluirObjeto(arquivo.bucket, chaveConfirmada)]);
      throw erro;
    }
  }

  async gerarAcessoArquivoMidia(tenantId: string, arquivoId: string, usuario: UsuarioAutenticado) {
    const arquivo = await this.executorTenant.executar(tenantId, (gerenciador) =>
      this.obterArquivoPermitido(gerenciador, tenantId, arquivoId, usuario)
    );
    if (arquivo.status !== 'confirmado') throw new NotFoundException('Anexo nao encontrado.');
    return { url: await this.armazenamento.criarDownloadAssinado(arquivo.bucket, arquivo.chaveObjeto), expiraEmSegundos: 300 };
  }

  async excluirArquivoMidia(tenantId: string, arquivoId: string, usuario: UsuarioAutenticado): Promise<void> {
    if (usuario.papel === 'Patient') throw new ForbiddenException('Paciente nao pode excluir anexo do prontuario.');
    const arquivo = await this.executorTenant.executar(tenantId, (gerenciador) =>
      this.obterArquivoPermitido(gerenciador, tenantId, arquivoId, usuario)
    );
    if (arquivo.status === 'excluido') return;
    await this.armazenamento.excluirObjeto(arquivo.bucket, arquivo.chaveObjeto);
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const atual = await this.obterArquivoPermitido(gerenciador, tenantId, arquivoId, usuario);
      atual.status = 'excluido';
      atual.excluidoEm = new Date();
      await gerenciador.getRepository(ArquivoMidiaOrm).save(atual);
    });
  }

  async listarAcompanhantes(tenantId: string, usuario: UsuarioAutenticado): Promise<AcompanhanteResumo[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const pacienteIds = await this.listarPacienteIdsPermitidos(gerenciador, tenantId, usuario);
      const acompanhantes = await gerenciador.getRepository(AcompanhanteOrm).find({
        where: { tenantId, ...(pacienteIds ? { pacienteId: In(pacienteIds) } : {}) },
        order: { criadoEm: 'DESC' },
        take: 50
      });

      return acompanhantes.map((item) => this.resumirAcompanhante(item));
    });
  }

  async criarAcompanhante(
    tenantId: string,
    dados: CriarAcompanhanteDto,
    usuario: UsuarioAutenticado
  ): Promise<AcompanhanteResumo> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacientePermitido(gerenciador, tenantId, dados.pacienteId, usuario);
      const acompanhante = await this.criarAcompanhanteInterno(gerenciador, tenantId, dados);
      return this.resumirAcompanhante(acompanhante);
    });
  }

  async sincronizarLote(
    tenantId: string,
    dados: SincronizarLoteMobileDto,
    usuario: UsuarioAutenticado
  ): Promise<{ resultados: ResultadoItemSincronizacao[] }> {
    this.garantirPapelPermitido(usuario);
    const resultados: ResultadoItemSincronizacao[] = [];

    for (const item of dados.itens) {
      try {
        const recursoId = await this.sincronizarItemIdempotente(tenantId, item, usuario);
        resultados.push({ idLocal: item.idLocal, status: 'sincronizado', recursoId });
      } catch (erro) {
        resultados.push({
          idLocal: item.idLocal,
          status: 'erro',
          erro: erro instanceof Error ? erro.message : 'Falha desconhecida ao sincronizar item.'
        });
      }
    }

    return { resultados };
  }

  private async sincronizarItemIdempotente(
    tenantId: string,
    item: ItemSincronizacaoMobileDto,
    usuario: UsuarioAutenticado
  ): Promise<string> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const pacienteId = String(item.payload.pacienteId ?? '');
      await this.garantirPacientePermitido(gerenciador, tenantId, pacienteId, usuario);
      const repositorioSync = gerenciador.getRepository(SincronizacaoMobileOrm);
      const existente = await repositorioSync.findOne({ where: { tenantId, pacienteId, idLocal: item.idLocal } });
      if (existente?.recursoId) return existente.recursoId;

      const recursoId = await this.sincronizarItem(gerenciador, tenantId, item);
      await repositorioSync.save(
        repositorioSync.create({
          tenantId,
          pacienteId,
          idLocal: item.idLocal,
          tipo: item.tipo,
          status: 'sincronizado',
          recursoTipo: item.tipo,
          recursoId
        })
      );

      return recursoId;
    });
  }

  private async sincronizarItem(gerenciador: EntityManager, tenantId: string, item: ItemSincronizacaoMobileDto): Promise<string> {
    if (item.tipo === 'diario_rapido') {
      const registro = await this.criarLogDiario(gerenciador, tenantId, item.payload as unknown as RegistrarDiarioRapidoDto);
      return registro.id;
    }

    if (item.tipo === 'acompanhante') {
      const acompanhante = await this.criarAcompanhanteInterno(
        gerenciador,
        tenantId,
        item.payload as unknown as CriarAcompanhanteDto
      );
      return acompanhante.id;
    }

    throw new BadRequestException('Midias devem ser enviadas pelo fluxo de upload assinado.');
  }

  private async criarLogDiario(
    gerenciador: EntityManager,
    tenantId: string,
    dados: RegistrarDiarioRapidoDto
  ): Promise<LogDiarioRapidoOrm> {
    return gerenciador.getRepository(LogDiarioRapidoOrm).save(
      gerenciador.getRepository(LogDiarioRapidoOrm).create({
        tenantId,
        pacienteId: dados.pacienteId,
        tipo: dados.tipo,
        valor: dados.valor,
        registradoEm: new Date()
      })
    );
  }

  private async criarAcompanhanteInterno(
    gerenciador: EntityManager,
    tenantId: string,
    dados: CriarAcompanhanteDto
  ): Promise<AcompanhanteOrm> {
    return gerenciador.getRepository(AcompanhanteOrm).save(
      gerenciador.getRepository(AcompanhanteOrm).create({
        tenantId,
        pacienteId: dados.pacienteId,
        nomeCriptografado: this.criptografia.criptografar(dados.nome),
        contatoCriptografado: dados.contato ? this.criptografia.criptografar(dados.contato) : undefined,
        pinHash: this.senhas.gerarHash(dados.pin),
        ativo: true
      })
    );
  }

  private garantirPapelPermitido(usuario: UsuarioAutenticado): void {
    if (!['Patient', 'Professional', 'SuperAdmin'].includes(usuario.papel)) {
      throw new ForbiddenException('Usuario sem permissao para operar mobile.');
    }
  }

  private async listarPacienteIdsPermitidos(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado
  ): Promise<string[] | undefined> {
    this.garantirPapelPermitido(usuario);
    if (usuario.papel === 'SuperAdmin') return undefined;

    const repositorio = gerenciador.getRepository(PacienteOrm);
    if (usuario.papel === 'Patient') {
      const paciente = await repositorio.findOne({
        where: { tenantId, usuarioId: usuario.usuarioId, arquivadoEm: IsNull() }
      });
      if (!paciente) throw new ForbiddenException('Usuario nao possui paciente vinculado.');
      return [paciente.id];
    }

    const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const pacientes = await repositorio.find({
      where: { tenantId, profissionalResponsavelId, arquivadoEm: IsNull() }
    });
    return pacientes.map((paciente) => paciente.id);
  }

  private async garantirPacientePermitido(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado
  ): Promise<void> {
    this.garantirPapelPermitido(usuario);
    const where: Record<string, unknown> = { id: pacienteId, tenantId, arquivadoEm: IsNull() };

    if (usuario.papel === 'Patient') where.usuarioId = usuario.usuarioId;
    if (usuario.papel === 'Professional') {
      where.profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    }

    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
  }

  private async garantirPacienteExistente(gerenciador: EntityManager, tenantId: string, pacienteId: string): Promise<void> {
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: { id: pacienteId, tenantId, arquivadoEm: IsNull() }
    });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
  }

  private resumirAcompanhante(item: AcompanhanteOrm): AcompanhanteResumo {
    return {
      id: item.id,
      tenantId: item.tenantId,
      pacienteId: item.pacienteId,
      ativo: item.ativo,
      criadoEm: item.criadoEm
    };
  }

  private async obterArquivoPermitido(
    gerenciador: EntityManager,
    tenantId: string,
    arquivoId: string,
    usuario: UsuarioAutenticado
  ): Promise<ArquivoMidiaOrm> {
    const arquivo = await gerenciador.getRepository(ArquivoMidiaOrm).findOne({ where: { id: arquivoId, tenantId } });
    if (!arquivo) throw new NotFoundException('Anexo nao encontrado.');
    await this.garantirPacientePermitido(gerenciador, tenantId, arquivo.pacienteId, usuario);
    return arquivo;
  }

  private async obterArquivoDoFormulario(
    gerenciador: EntityManager,
    tenantId: string,
    arquivoId: string,
    pacienteId: string
  ): Promise<ArquivoMidiaOrm> {
    const arquivo = await gerenciador.getRepository(ArquivoMidiaOrm).findOne({
      where: { id: arquivoId, tenantId, pacienteId }
    });
    if (!arquivo) throw new NotFoundException('Anexo nao encontrado.');
    return arquivo;
  }

  private resumirArquivo(arquivo: ArquivoMidiaOrm): ArquivoMidiaResumo {
    return {
      id: arquivo.id,
      pacienteId: arquivo.pacienteId,
      tipo: arquivo.tipo,
      categoria: arquivo.categoria,
      nomeArquivo: arquivo.nomeOriginalCriptografado && Buffer.isBuffer(arquivo.nomeOriginalCriptografado)
        ? this.criptografia.descriptografar(arquivo.nomeOriginalCriptografado)
        : undefined,
      mimeType: arquivo.mimeType,
      tamanhoBytes: arquivo.tamanhoBytes,
      hashConteudo: arquivo.hashConteudo,
      status: arquivo.status,
      criadoEm: arquivo.criadoEm,
      confirmadoEm: arquivo.confirmadoEm
    };
  }
}
