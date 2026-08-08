import { BadRequestException, Injectable } from '@nestjs/common';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoAgenda } from '../../agenda/aplicacao/servico-agenda';
import type { ConsultaAgendaRespostaDto } from '../../agenda/aplicacao/dtos';
import { ServicoPacientes } from '../../pacientes/aplicacao/servico-pacientes';
import type { ContextoApiPublica } from '../dominio/contratos-integracao';
import { CriarConsultaApiPublicaDto, CriarPacienteApiPublicaDto, ListarApiPublicaDto, ListarConsultasApiPublicaDto } from './dtos';

@Injectable()
export class ServicoApiPublica {
  constructor(
    private readonly pacientes: ServicoPacientes,
    private readonly agenda: ServicoAgenda,
    private readonly auditoria: ServicoAuditoria
  ) {}

  async listarPacientes(contexto: ContextoApiPublica, filtros: ListarApiPublicaDto) {
    const resultado = await this.pacientes.listar(contexto.tenantId, this.usuarioIntegracao(contexto), filtros.pagina, filtros.limite);
    return this.paginar(resultado.itens.map((item) => this.mapearPaciente(item)), resultado.total, filtros);
  }

  async obterPaciente(contexto: ContextoApiPublica, pacienteId: string) {
    return { data: this.mapearPaciente(await this.pacientes.obterPorId(contexto.tenantId, pacienteId, this.usuarioIntegracao(contexto))) };
  }

  async criarPaciente(contexto: ContextoApiPublica, dados: CriarPacienteApiPublicaDto) {
    const paciente = await this.pacientes.criar(contexto.tenantId, dados, this.usuarioIntegracao(contexto));
    await this.auditar(contexto, 'api_publica.paciente.criar', 'paciente', paciente.id);
    return { data: this.mapearPaciente(paciente) };
  }

  async listarConsultas(contexto: ContextoApiPublica, filtros: ListarConsultasApiPublicaDto) {
    const agora = new Date();
    const inicioEm = filtros.inicioEm ?? new Date(agora.getTime() - 30 * 86_400_000).toISOString();
    const fimEm = filtros.fimEm ?? new Date(agora.getTime() + 90 * 86_400_000).toISOString();
    const inicio = new Date(inicioEm);
    const fim = new Date(fimEm);
    if (fim <= inicio || fim.getTime() - inicio.getTime() > 366 * 86_400_000) {
      throw new BadRequestException('O periodo da agenda deve ser positivo e ter no maximo 366 dias.');
    }
    const itens = await this.agenda.listarFeed(contexto.tenantId, { inicioEm, fimEm }, this.usuarioIntegracao(contexto));
    const consultas = itens.filter((item) => item.tipo === 'consulta').map((item) => this.mapearConsulta(item));
    const deslocamento = (filtros.pagina - 1) * filtros.limite;
    return this.paginar(consultas.slice(deslocamento, deslocamento + filtros.limite), consultas.length, filtros);
  }

  async criarConsulta(contexto: ContextoApiPublica, dados: CriarConsultaApiPublicaDto) {
    const consulta = await this.agenda.criarConsulta(contexto.tenantId, dados, this.usuarioIntegracao(contexto));
    await this.auditar(contexto, 'api_publica.consulta.criar', 'agenda_consulta', consulta.id);
    return { data: this.mapearConsulta(consulta) };
  }

  async cancelarConsulta(contexto: ContextoApiPublica, consultaId: string) {
    const consulta = await this.agenda.cancelarConsulta(
      contexto.tenantId,
      consultaId,
      {},
      this.usuarioIntegracao(contexto)
    );
    await this.auditar(contexto, 'api_publica.consulta.cancelar', 'agenda_consulta', consulta.id);
    return { data: this.mapearConsulta(consulta) };
  }

  private usuarioIntegracao(contexto: ContextoApiPublica): UsuarioAutenticado {
    return {
      tenantId: contexto.tenantId,
      usuarioId: contexto.criadoPorUsuarioId ?? contexto.chaveId,
      papel: 'Client',
      emailHash: `api:${contexto.chaveId}`,
      permissoes: []
    };
  }

  private mapearPaciente(paciente: Awaited<ReturnType<ServicoPacientes['obterPorId']>>) {
    return {
      id: paciente.id,
      referenciaExterna: paciente.referenciaExterna,
      profissionalResponsavelId: paciente.profissionalResponsavelId,
      nome: paciente.nome,
      contato: paciente.contato,
      dataNascimento: paciente.dataNascimento,
      status: paciente.statusAdesao,
      criadoEm: paciente.criadoEm,
      atualizadoEm: paciente.atualizadoEm
    };
  }

  private mapearConsulta(consulta: ConsultaAgendaRespostaDto) {
    const campos = ['id', 'referenciaExterna', 'pacienteId', 'profissionalId', 'inicioEm', 'fimEm', 'timezone', 'status', 'modalidade', 'local', 'criadoEm', 'atualizadoEm'];
    const registro = consulta as unknown as Record<string, unknown>;
    return Object.fromEntries(campos.filter((campo) => registro[campo] !== undefined).map((campo) => [campo, registro[campo]]));
  }

  private paginar<T>(itens: T[], total: number, filtros: ListarApiPublicaDto) {
    return {
      data: itens,
      meta: { pagina: filtros.pagina, limite: filtros.limite, total },
      links: { proxima: filtros.pagina * filtros.limite < total ? filtros.pagina + 1 : null }
    };
  }

  private auditar(contexto: ContextoApiPublica, acao: string, recursoTipo: string, recursoId: string) {
    return this.auditoria.registrar({
      tenantId: contexto.tenantId,
      acao,
      recursoTipo,
      recursoId,
      metadados: { chaveApiId: contexto.chaveId }
    });
  }
}
