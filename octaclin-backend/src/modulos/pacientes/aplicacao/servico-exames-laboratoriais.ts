import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CriarColetaExameLaboratorialDto } from './dtos';
import { ColetaExameLaboratorialOrm } from '../infraestrutura/coleta-exame-laboratorial.orm';
import { MarcadorExameLaboratorialOrm } from '../infraestrutura/marcador-exame-laboratorial.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

type ResultadoMarcador = { nome: string; valor: string; unidade?: string; referencia?: string; metodo?: string };
export type ColetaExameLaboratorialResposta = {
  id: string; coletadaEm: string; recebidaEm?: string; laboratorio?: string; observacoes?: string;
  marcadores: Array<ResultadoMarcador & { id: string }>;
};

@Injectable()
export class ServicoExamesLaboratoriais {
  constructor(private readonly executorTenant: ExecutorTenant, private readonly criptografia: CriptografiaDadosSensiveis) {}

  async criar(tenantId: string, pacienteId: string, dados: CriarColetaExameLaboratorialDto, usuario: UsuarioAutenticado): Promise<ColetaExameLaboratorialResposta> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const coletas = gerenciador.getRepository(ColetaExameLaboratorialOrm);
      const marcadores = gerenciador.getRepository(MarcadorExameLaboratorialOrm);
      const coleta = await coletas.save(coletas.create({
        tenantId, pacienteId, autorUsuarioId: usuario.usuarioId, coletadaEm: dados.coletadaEm,
        recebidaEm: dados.recebidaEm,
        laboratorioCriptografado: dados.laboratorio ? this.criptografia.criptografar(dados.laboratorio) : undefined,
        observacoesCriptografadas: dados.observacoes ? this.criptografia.criptografar(dados.observacoes) : undefined
      }));
      const itens = await Promise.all(dados.marcadores.map(async (marcador, ordemExibicao) => marcadores.save(marcadores.create({
        tenantId, coletaId: coleta.id, ordemExibicao,
        resultadoCriptografado: this.criptografia.criptografar(JSON.stringify(marcador))
      }))));
      return this.responder(coleta, itens);
    });
  }

  async listar(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado): Promise<ColetaExameLaboratorialResposta[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const coletas = await gerenciador.getRepository(ColetaExameLaboratorialOrm).find({
        where: { tenantId, pacienteId, excluidaEm: IsNull() }, order: { coletadaEm: 'DESC', criadoEm: 'DESC' }
      });
      if (!coletas.length) return [];
      const marcadores = await gerenciador.getRepository(MarcadorExameLaboratorialOrm).find({
        where: { tenantId, coletaId: In(coletas.map((coleta) => coleta.id)), excluidoEm: IsNull() }, order: { ordemExibicao: 'ASC' }
      });
      return coletas.map((coleta) => this.responder(coleta, marcadores.filter((marcador) => marcador.coletaId === coleta.id)));
    });
  }

  private async garantirPacienteAcessivel(gerenciador: EntityManager, tenantId: string, pacienteId: string, usuario: UsuarioAutenticado) {
    const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
      where: { id: pacienteId, tenantId, arquivadoEm: IsNull(), ...(profissionalResponsavelId ? { profissionalResponsavelId } : {}) }
    });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
  }

  private responder(coleta: ColetaExameLaboratorialOrm, marcadores: MarcadorExameLaboratorialOrm[]): ColetaExameLaboratorialResposta {
    return {
      id: coleta.id, coletadaEm: coleta.coletadaEm, recebidaEm: coleta.recebidaEm,
      laboratorio: coleta.laboratorioCriptografado ? this.criptografia.descriptografar(coleta.laboratorioCriptografado) : undefined,
      observacoes: coleta.observacoesCriptografadas ? this.criptografia.descriptografar(coleta.observacoesCriptografadas) : undefined,
      marcadores: marcadores.map((marcador) => ({ id: marcador.id, ...JSON.parse(this.criptografia.descriptografar(marcador.resultadoCriptografado)) as ResultadoMarcador }))
    };
  }
}
