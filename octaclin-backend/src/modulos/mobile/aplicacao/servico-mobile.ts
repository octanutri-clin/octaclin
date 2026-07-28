import { createHash, randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import {
  resolverFiltroEscopoRecursosPaciente,
  validarPacienteNoEscopo
} from '../../../infraestrutura/seguranca/escopo-recursos-paciente';
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
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(LogDiarioRapidoOrm).find({
        where: { tenantId, ...(await this.resolverFiltroPacienteId(gerenciador, tenantId, usuario)) },
        order: { registradoEm: 'DESC' },
        take: 50
      })
    );
  }

  async registrarDiarioRapido(
    tenantId: string,
    dados: RegistrarDiarioRapidoDto,
    usuario: UsuarioAutenticado
  ): Promise<LogDiarioRapidoOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario);
      return this.criarLogDiario(gerenciador, tenantId, { ...dados, pacienteId: paciente.id });
    });
  }

  async listarArquivosMidia(tenantId: string, usuario: UsuarioAutenticado): Promise<ArquivoMidiaOrm[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(ArquivoMidiaOrm).find({
        where: { tenantId, ...(await this.resolverFiltroPacienteId(gerenciador, tenantId, usuario)) },
        order: { criadoEm: 'DESC' },
        take: 50
      })
    );
  }

  async solicitarUploadMidia(
    tenantId: string,
    dados: SolicitarUploadMidiaDto,
    usuario: UsuarioAutenticado
  ) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      validarDuracaoMidia(dados.tipo, dados.duracaoSegundos);
      const paciente = await validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario);
      const dadosAutorizados = { ...dados, pacienteId: paciente.id };
      const bucket = process.env.ARMAZENAMENTO_BUCKET_MIDIA ?? 'octaclin-midias-local';
      const chaveObjeto = `${tenantId}/${paciente.id}/${dados.tipo}/${randomUUID()}`;
      const uploadBaseUrl = process.env.ARMAZENAMENTO_UPLOAD_BASE_URL ?? 'http://localhost:9000';
      const uploadUrl = `${uploadBaseUrl}/${bucket}/${chaveObjeto}`;
      const arquivo = await this.criarArquivoMidia(
        gerenciador,
        tenantId,
        dadosAutorizados,
        bucket,
        chaveObjeto
      );

      return { arquivo, uploadUrl };
    });
  }

  async listarAcompanhantes(tenantId: string, usuario: UsuarioAutenticado): Promise<AcompanhanteResumo[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const acompanhantes = await gerenciador.getRepository(AcompanhanteOrm).find({
        where: { tenantId, ...(await this.resolverFiltroPacienteId(gerenciador, tenantId, usuario)) },
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
      const paciente = await validarPacienteNoEscopo(gerenciador, tenantId, dados.pacienteId, usuario);
      const acompanhante = await this.criarAcompanhanteInterno(gerenciador, tenantId, {
        ...dados,
        pacienteId: paciente.id
      });
      return this.resumirAcompanhante(acompanhante);
    });
  }

  async sincronizarLote(
    tenantId: string,
    dados: SincronizarLoteMobileDto,
    usuario: UsuarioAutenticado
  ): Promise<{ resultados: ResultadoItemSincronizacao[] }> {
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
      const pacienteIdInformado = typeof item.payload.pacienteId === 'string' ? item.payload.pacienteId : '';
      const paciente = await validarPacienteNoEscopo(gerenciador, tenantId, pacienteIdInformado, usuario);
      const itemAutorizado: ItemSincronizacaoMobileDto = {
        ...item,
        payload: { ...item.payload, pacienteId: paciente.id }
      };
      const repositorioSync = gerenciador.getRepository(SincronizacaoMobileOrm);
      const idLocalEscopado = this.criarIdLocalEscopado(paciente.id, item.idLocal);
      const existenteEscopado = await repositorioSync.findOne({
        where: { tenantId, idLocal: idLocalEscopado }
      });
      if (existenteEscopado) {
        if (await this.sincronizacaoPertenceAoPaciente(gerenciador, tenantId, paciente.id, item, existenteEscopado)) {
          return existenteEscopado.recursoId as string;
        }
        throw new NotFoundException('Paciente nao encontrado.');
      }

      const existenteLegado = await repositorioSync.findOne({ where: { tenantId, idLocal: item.idLocal } });
      if (
        existenteLegado &&
        (await this.sincronizacaoPertenceAoPaciente(gerenciador, tenantId, paciente.id, item, existenteLegado))
      ) {
        return existenteLegado.recursoId as string;
      }

      const recursoId = await this.sincronizarItem(gerenciador, tenantId, itemAutorizado);
      await repositorioSync.save(
        repositorioSync.create({
          tenantId,
          idLocal: idLocalEscopado,
          tipo: item.tipo,
          status: 'sincronizado',
          recursoTipo: item.tipo,
          recursoId
        })
      );

      return recursoId;
    });
  }

  private async resolverFiltroPacienteId(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado
  ) {
    const filtro = await resolverFiltroEscopoRecursosPaciente(gerenciador, tenantId, usuario);
    if (filtro.pacienteId) return { pacienteId: filtro.pacienteId };
    if (!filtro.profissionalResponsavelId) return {};

    const pacientes = await gerenciador.getRepository(PacienteOrm).find({
      select: { id: true },
      where: {
        tenantId,
        profissionalResponsavelId: filtro.profissionalResponsavelId,
        arquivadoEm: IsNull()
      }
    });
    return { pacienteId: In(pacientes.map((paciente) => paciente.id)) };
  }

  private criarIdLocalEscopado(pacienteId: string, idLocal: string): string {
    const hash = createHash('sha256').update(pacienteId).update('\0').update(idLocal).digest('hex');
    return `paciente:${hash}`;
  }

  private async sincronizacaoPertenceAoPaciente(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    item: ItemSincronizacaoMobileDto,
    sincronizacao: SincronizacaoMobileOrm
  ): Promise<boolean> {
    if (!sincronizacao.recursoId || (sincronizacao.recursoTipo ?? sincronizacao.tipo) !== item.tipo) {
      return false;
    }

    const where = { id: sincronizacao.recursoId, tenantId, pacienteId };
    if (item.tipo === 'diario_rapido') {
      return Boolean(await gerenciador.getRepository(LogDiarioRapidoOrm).findOne({ where }));
    }
    if (item.tipo === 'acompanhante') {
      return Boolean(await gerenciador.getRepository(AcompanhanteOrm).findOne({ where }));
    }
    return Boolean(await gerenciador.getRepository(ArquivoMidiaOrm).findOne({ where }));
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
