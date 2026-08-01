import { randomUUID } from 'crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
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

@Injectable()
export class ServicoMobile {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly senhas: ServicoSenhas
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

  async listarArquivosMidia(tenantId: string, usuario: UsuarioAutenticado): Promise<ArquivoMidiaOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const pacienteIds = await this.listarPacienteIdsPermitidos(gerenciador, tenantId, usuario);
      return gerenciador.getRepository(ArquivoMidiaOrm).find({
        where: { tenantId, ...(pacienteIds ? { pacienteId: In(pacienteIds) } : {}) },
        order: { criadoEm: 'DESC' },
        take: 50
      });
    });
  }

  async solicitarUploadMidia(tenantId: string, dados: SolicitarUploadMidiaDto, usuario: UsuarioAutenticado) {
    validarDuracaoMidia(dados.tipo, dados.duracaoSegundos);
    const bucket = process.env.ARMAZENAMENTO_BUCKET_MIDIA ?? 'octaclin-midias-local';
    const chaveObjeto = `${tenantId}/${dados.pacienteId}/${dados.tipo}/${randomUUID()}`;
    const uploadBaseUrl = process.env.ARMAZENAMENTO_UPLOAD_BASE_URL ?? 'http://localhost:9000';
    const uploadUrl = `${uploadBaseUrl}/${bucket}/${chaveObjeto}`;

    const arquivo = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacientePermitido(gerenciador, tenantId, dados.pacienteId, usuario);
      return this.criarArquivoMidia(gerenciador, tenantId, dados, bucket, chaveObjeto);
    });

    return { arquivo, uploadUrl };
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

    const payloadMidia = item.payload as Record<string, unknown>;
    const dadosMidia: SolicitarUploadMidiaDto = {
      pacienteId: String(payloadMidia.pacienteId),
      tipo: item.tipo === 'midia_audio' ? 'audio' : (payloadMidia.tipo as SolicitarUploadMidiaDto['tipo']) ?? 'imagem',
      mimeType: String(payloadMidia.mimeType ?? (item.tipo === 'midia_audio' ? 'audio/m4a' : 'image/jpeg')),
      tamanhoBytes: Number(payloadMidia.tamanhoBytes ?? 1),
      duracaoSegundos: payloadMidia.duracaoSegundos ? Number(payloadMidia.duracaoSegundos) : undefined,
      hashConteudo: payloadMidia.hashConteudo ? String(payloadMidia.hashConteudo) : undefined
    };
    validarDuracaoMidia(dadosMidia.tipo, dadosMidia.duracaoSegundos);
    const bucket = process.env.ARMAZENAMENTO_BUCKET_MIDIA ?? 'octaclin-midias-local';
    const chaveObjeto = `${tenantId}/${dadosMidia.pacienteId}/${dadosMidia.tipo}/${randomUUID()}`;
    const arquivo = await this.criarArquivoMidia(gerenciador, tenantId, dadosMidia, bucket, chaveObjeto);
    return arquivo.id;
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

  private async criarArquivoMidia(
    gerenciador: EntityManager,
    tenantId: string,
    dados: SolicitarUploadMidiaDto,
    bucket: string,
    chaveObjeto: string
  ): Promise<ArquivoMidiaOrm> {
    return gerenciador.getRepository(ArquivoMidiaOrm).save(
      gerenciador.getRepository(ArquivoMidiaOrm).create({
        tenantId,
        pacienteId: dados.pacienteId,
        tipo: dados.tipo,
        bucket,
        chaveObjeto,
        mimeType: dados.mimeType,
        tamanhoBytes: String(dados.tamanhoBytes),
        hashConteudo: dados.hashConteudo,
        metadados: { duracaoSegundos: dados.duracaoSegundos }
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

  private resumirAcompanhante(item: AcompanhanteOrm): AcompanhanteResumo {
    return {
      id: item.id,
      tenantId: item.tenantId,
      pacienteId: item.pacienteId,
      ativo: item.ativo,
      criadoEm: item.criadoEm
    };
  }
}
