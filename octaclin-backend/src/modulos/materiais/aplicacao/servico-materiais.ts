import { Injectable, NotFoundException } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { CriarMaterialEducativoDto, EnviarMaterialPacienteDto, EnvioMaterialPacienteRespostaDto, MaterialEducativoRespostaDto } from './dtos';
import { EnvioMaterialPacienteOrm } from '../infraestrutura/envio-material-paciente.orm';
import { MaterialEducativoOrm } from '../infraestrutura/material-educativo.orm';

@Injectable()
export class ServicoMateriais {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async criarMaterial(tenantId: string, usuarioId: string, dados: CriarMaterialEducativoDto): Promise<MaterialEducativoRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(MaterialEducativoOrm);
      const material = repositorio.create({
        tenantId,
        criadoPorUsuarioId: usuarioId,
        titulo: dados.titulo.trim(),
        tipo: dados.tipo,
        categoria: dados.categoria?.trim() || undefined,
        resumo: dados.resumo?.trim() || undefined,
        url: dados.url?.trim() || undefined,
        conteudo: dados.conteudo?.trim() || undefined,
        ativo: true
      });

      return this.mapearMaterial(await repositorio.save(material));
    });
  }

  async listarMateriais(tenantId: string): Promise<MaterialEducativoRespostaDto[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const materiais = await gerenciador.getRepository(MaterialEducativoOrm).find({
        where: { tenantId, ativo: true },
        order: { criadoEm: 'DESC' },
        take: 200
      });

      return materiais.map((material) => this.mapearMaterial(material));
    });
  }

  async enviarMaterialParaPaciente(
    tenantId: string,
    pacienteId: string,
    usuarioId: string,
    dados: EnviarMaterialPacienteDto,
    usuario: UsuarioAutenticado
  ): Promise<EnvioMaterialPacienteRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
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

      const material = await gerenciador.getRepository(MaterialEducativoOrm).findOne({
        where: { id: dados.materialId, tenantId, ativo: true }
      });
      if (!material) throw new NotFoundException('Material nao encontrado.');

      const envio = gerenciador.getRepository(EnvioMaterialPacienteOrm).create({
        tenantId,
        pacienteId,
        materialId: material.id,
        enviadoPorUsuarioId: usuarioId,
        observacaoCriptografada: dados.observacao?.trim() ? this.criptografia.criptografar(dados.observacao.trim()) : undefined,
        status: 'enviado',
        enviadoEm: new Date()
      });

      return this.mapearEnvio(await gerenciador.getRepository(EnvioMaterialPacienteOrm).save(envio), material);
    });
  }

  async listarMateriaisPaciente(
    tenantId: string,
    pacienteId: string,
    usuario: UsuarioAutenticado
  ): Promise<EnvioMaterialPacienteRespostaDto[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
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

      const envios = await gerenciador.getRepository(EnvioMaterialPacienteOrm).find({
        where: { tenantId, pacienteId },
        order: { enviadoEm: 'DESC', criadoEm: 'DESC' },
        take: 100
      });
      const materiaisIds = Array.from(new Set(envios.map((envio) => envio.materialId)));
      const materiais = materiaisIds.length
        ? await gerenciador.getRepository(MaterialEducativoOrm).find({ where: { tenantId, id: In(materiaisIds) } })
        : [];
      const materiaisPorId = new Map(materiais.map((material) => [material.id, material]));

      return envios
        .map((envio) => {
          const material = materiaisPorId.get(envio.materialId);
          return material ? this.mapearEnvio(envio, material) : undefined;
        })
        .filter((envio): envio is EnvioMaterialPacienteRespostaDto => Boolean(envio));
    });
  }

  private mapearMaterial(material: MaterialEducativoOrm): MaterialEducativoRespostaDto {
    return {
      id: material.id,
      tenantId: material.tenantId,
      criadoPorUsuarioId: material.criadoPorUsuarioId,
      titulo: material.titulo,
      tipo: material.tipo,
      categoria: material.categoria,
      resumo: material.resumo,
      url: material.url,
      conteudo: material.conteudo,
      ativo: material.ativo,
      criadoEm: material.criadoEm,
      atualizadoEm: material.atualizadoEm
    };
  }

  private mapearEnvio(envio: EnvioMaterialPacienteOrm, material: MaterialEducativoOrm): EnvioMaterialPacienteRespostaDto {
    return {
      id: envio.id,
      tenantId: envio.tenantId,
      pacienteId: envio.pacienteId,
      materialId: envio.materialId,
      enviadoPorUsuarioId: envio.enviadoPorUsuarioId,
      titulo: material.titulo,
      tipo: material.tipo,
      categoria: material.categoria,
      resumo: material.resumo,
      url: material.url,
      conteudo: material.conteudo,
      observacao: envio.observacaoCriptografada ? this.criptografia.descriptografar(envio.observacaoCriptografada) : undefined,
      status: envio.status,
      enviadoEm: envio.enviadoEm,
      visualizadoEm: envio.visualizadoEm,
      criadoEm: envio.criadoEm,
      atualizadoEm: envio.atualizadoEm
    };
  }
}
