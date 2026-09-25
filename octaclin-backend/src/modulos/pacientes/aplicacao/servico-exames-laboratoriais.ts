import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CriarColetaExameLaboratorialDto } from './dtos';
import { resolverConsultaOpcional } from './vinculo-consulta';
import { ColetaExameLaboratorialOrm } from '../infraestrutura/coleta-exame-laboratorial.orm';
import { MarcadorExameLaboratorialOrm } from '../infraestrutura/marcador-exame-laboratorial.orm';
import { CatalogoMarcadorExameOrm } from '../infraestrutura/catalogo-marcador-exame.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

type ResultadoMarcador = {
  nome: string; valor: string; unidade?: string; referencia?: string; metodo?: string;
  limiteInferior?: string; limiteSuperior?: string;
};
type DefinicaoCatalogo = { nome: string; unidade?: string; limiteInferior?: string; limiteSuperior?: string };
type SituacaoFaixa = 'dentro_da_faixa' | 'fora_da_faixa';
export type ColetaExameLaboratorialResposta = {
  id: string; coletadaEm: string; recebidaEm?: string; laboratorio?: string; observacoes?: string; consultaId?: string;
  marcadores: Array<ResultadoMarcador & { id: string; catalogoMarcadorId?: string; situacaoFaixa?: SituacaoFaixa }>;
};

function numeroDecimal(valor: string | undefined): number | undefined {
  if (!valor || !/^-?\d+(?:[.,]\d+)?$/.test(valor.trim())) return undefined;
  const numero = Number(valor.trim().replace(',', '.'));
  return Number.isFinite(numero) ? numero : undefined;
}

function situacaoFaixa(resultado: ResultadoMarcador): SituacaoFaixa | undefined {
  if (!resultado.unidade?.trim()) return undefined;
  const valor = numeroDecimal(resultado.valor);
  const inferior = numeroDecimal(resultado.limiteInferior);
  const superior = numeroDecimal(resultado.limiteSuperior);
  if (valor === undefined || (inferior === undefined && superior === undefined)) return undefined;
  return (inferior !== undefined && valor < inferior) || (superior !== undefined && valor > superior)
    ? 'fora_da_faixa' : 'dentro_da_faixa';
}

@Injectable()
export class ServicoExamesLaboratoriais {
  constructor(private readonly executorTenant: ExecutorTenant, private readonly criptografia: CriptografiaDadosSensiveis) {}

  async criar(tenantId: string, pacienteId: string, dados: CriarColetaExameLaboratorialDto, usuario: UsuarioAutenticado): Promise<ColetaExameLaboratorialResposta> {
    this.garantirTenantDaCredencial(tenantId, usuario);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.garantirPacienteAcessivel(gerenciador, tenantId, pacienteId, usuario);
      const consultaId = await resolverConsultaOpcional(gerenciador, tenantId, pacienteId, dados.consultaId);
      const marcadoresPreparados = await Promise.all(dados.marcadores.map((marcador) =>
        this.prepararMarcador(gerenciador, tenantId, marcador)
      ));
      const coletas = gerenciador.getRepository(ColetaExameLaboratorialOrm);
      const marcadores = gerenciador.getRepository(MarcadorExameLaboratorialOrm);
      const coleta = await coletas.save(coletas.create({
        tenantId, pacienteId, autorUsuarioId: usuario.usuarioId, coletadaEm: dados.coletadaEm,
        recebidaEm: dados.recebidaEm,
        laboratorioCriptografado: dados.laboratorio ? this.criptografia.criptografar(dados.laboratorio) : undefined,
        observacoesCriptografadas: dados.observacoes ? this.criptografia.criptografar(dados.observacoes) : undefined,
        consultaId
      }));
      const itens = await Promise.all(marcadoresPreparados.map(async (marcador, ordemExibicao) => marcadores.save(marcadores.create({
        tenantId, coletaId: coleta.id, ordemExibicao, catalogoMarcadorId: marcador.catalogoMarcadorId,
        resultadoCriptografado: this.criptografia.criptografar(JSON.stringify(marcador.resultado))
      }))));
      return this.responder(coleta, itens);
    });
  }

  async listar(tenantId: string, pacienteId: string, usuario: UsuarioAutenticado): Promise<ColetaExameLaboratorialResposta[]> {
    this.garantirTenantDaCredencial(tenantId, usuario);
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

  private garantirTenantDaCredencial(tenantId: string, usuario: UsuarioAutenticado) {
    if (tenantId !== usuario.tenantId) throw new ForbiddenException('Tenant nao corresponde a credencial.');
  }

  private async prepararMarcador(
    gerenciador: EntityManager,
    tenantId: string,
    marcador: CriarColetaExameLaboratorialDto['marcadores'][number]
  ): Promise<{ catalogoMarcadorId?: string; resultado: ResultadoMarcador }> {
    let definicao: DefinicaoCatalogo | undefined;
    if (marcador.catalogoMarcadorId) {
      const item = await gerenciador.getRepository(CatalogoMarcadorExameOrm).findOne({
        where: { id: marcador.catalogoMarcadorId, tenantId, arquivadoEm: IsNull() }
      });
      if (!item) throw new NotFoundException('Marcador do catalogo nao encontrado.');
      definicao = JSON.parse(this.criptografia.descriptografar(item.definicaoCriptografada)) as DefinicaoCatalogo;
    }
    const unidade = marcador.unidade === null ? undefined : marcador.unidade?.trim() || definicao?.unidade;
    const mesmaUnidade = !!definicao?.unidade && unidade === definicao.unidade;
    const limiteInferior = marcador.limiteInferior === null ? undefined
      : marcador.limiteInferior ?? (mesmaUnidade ? definicao?.limiteInferior : undefined);
    const limiteSuperior = marcador.limiteSuperior === null ? undefined
      : marcador.limiteSuperior ?? (mesmaUnidade ? definicao?.limiteSuperior : undefined);
    const inferior = numeroDecimal(limiteInferior);
    const superior = numeroDecimal(limiteSuperior);
    if ((limiteInferior !== undefined && inferior === undefined)
      || (limiteSuperior !== undefined && superior === undefined)
      || (inferior !== undefined && superior !== undefined && inferior > superior)) {
      throw new BadRequestException('Faixa de referencia numerica invalida.');
    }
    return {
      catalogoMarcadorId: marcador.catalogoMarcadorId,
      resultado: {
        nome: definicao?.nome ?? marcador.nome.trim(), valor: marcador.valor.trim(), unidade,
        referencia: marcador.referencia?.trim(), metodo: marcador.metodo?.trim(),
        limiteInferior: limiteInferior?.replace(',', '.'), limiteSuperior: limiteSuperior?.replace(',', '.')
      }
    };
  }

  private responder(coleta: ColetaExameLaboratorialOrm, marcadores: MarcadorExameLaboratorialOrm[]): ColetaExameLaboratorialResposta {
    return {
      id: coleta.id, coletadaEm: coleta.coletadaEm, recebidaEm: coleta.recebidaEm,
      laboratorio: coleta.laboratorioCriptografado ? this.criptografia.descriptografar(coleta.laboratorioCriptografado) : undefined,
      observacoes: coleta.observacoesCriptografadas ? this.criptografia.descriptografar(coleta.observacoesCriptografadas) : undefined,
      consultaId: coleta.consultaId,
      marcadores: marcadores.map((marcador) => {
        const resultado = JSON.parse(this.criptografia.descriptografar(marcador.resultadoCriptografado)) as ResultadoMarcador;
        return { id: marcador.id, catalogoMarcadorId: marcador.catalogoMarcadorId,
          ...resultado, situacaoFaixa: situacaoFaixa(resultado) };
      })
    };
  }
}
