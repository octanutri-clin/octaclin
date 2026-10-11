import { ServicoPacientes } from './servico-pacientes';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { AvaliacaoAntropometricaOrm } from '../infraestrutura/avaliacao-antropometrica.orm';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
const usuario: UsuarioAutenticado = { usuarioId: 'autor', tenantId: 'tenant', papel: 'Collaborator', emailHash: 'sintetico', permissoes: [] };
const dados = { chaveCriacao: '00000000-0000-4000-8000-000000000001', avaliadaEm: '2024-02-01', pesoKg: 0.8, alturaCm: 28, pediatrico: { confirmado: true as const, nascimento: '2024-01-01', sexoCurva: 'nao_informado' as const, tecnica: 'deitado' as const, edema: 'desconhecido' as const, nascimentoTipo: 'nao_informado' as const, tipoMedida: 'pos_natal' as const } };
function montar() {
  const paciente = { id: 'paciente', tenantId: 'tenant', dataNascimento: '2024-01-01', arquivadoEm: null };
  let registro: any;
  const qb: any = {};
  for (const metodo of ['where','andWhere','orderBy','addOrderBy','take']) qb[metodo] = jest.fn(() => qb);
  qb.getMany = jest.fn(async () => []);
  const repo = { createQueryBuilder: jest.fn(() => qb), findOne: jest.fn(async () => registro ?? null), create: (r: any) => r, save: jest.fn(async (r: any) => registro = { ...r, id: 'registro', criadoEm: new Date('2024-02-01') }) };
  const gerente = { query: jest.fn(async () => []), getRepository: (tipo: unknown) => tipo === PacienteOrm ? { findOne: async (q: any) => q.where.tenantId === paciente.tenantId ? paciente : null } : tipo === AvaliacaoAntropometricaOrm ? repo : { findOne: async () => null } };
  const executor = { executar: async (_: string, f: any) => f(gerente) };
  const crypto = { criptografar: (v: string) => Buffer.from(v), descriptografar: (v: Buffer) => v.toString() };
  return { servico: new ServicoPacientes(executor as never, crypto as never, {} as never), repo, paciente, qb };
}
describe('integração de serviço com snapshot pediátrico', () => {
  it('cifra contexto, exige chave, retorna replay sem recalcular após cadastro mudar', async () => {
    const { servico, repo, paciente } = montar();
    const primeiro = await servico.registrarAvaliacaoAntropometrica('tenant','paciente','autor',dados,usuario);
    expect(primeiro.resultado.pediatrico?.idade?.dias).toBe(31);
    expect(primeiro.medidas.pesoKg).toBe(0.8);
    paciente.dataNascimento = '2024-01-02';
    const replay = await servico.registrarAvaliacaoAntropometrica('tenant','paciente','autor',dados,usuario);
    expect(replay).toEqual(primeiro);
    expect(repo.save).toHaveBeenCalledTimes(1);
    await expect(servico.registrarAvaliacaoAntropometrica('tenant','paciente','autor',{ ...dados,pesoKg: 0.9 },usuario)).rejects.toBeInstanceOf(ConflictException);
  });
  it('revalida autorização antes de replay e divergência cadastral antes de criar', async () => {
    const { servico,paciente } = montar();
    await expect(servico.registrarAvaliacaoAntropometrica('outro','paciente','autor',dados,usuario)).rejects.toBeInstanceOf(NotFoundException);
    paciente.dataNascimento = '2024-01-02';
    await expect(servico.registrarAvaliacaoAntropometrica('tenant','paciente','autor',dados,usuario)).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejeita pediatria sem chave ou novo compartilhamento no portal', async () => {
    const { servico } = montar();
    await expect(servico.registrarAvaliacaoAntropometrica('tenant','paciente','autor',{ ...dados,chaveCriacao: undefined },usuario)).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.registrarAvaliacaoAntropometrica('tenant','paciente','autor',{ ...dados,metricasCompartilhadasPortal: ['imc'] },usuario)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('limita leitura antes de filtrar pediatria e avança cursor pelo último examinado', async () => {
    const { servico, qb } = montar();
    qb.getMany.mockResolvedValue([{ id: 'legado1', resultadoCriptografado: Buffer.from('{}') }, { id: 'legado2', resultadoCriptografado: Buffer.from('{}') }, { id: 'extra', resultadoCriptografado: Buffer.from('{}') }]);
    expect(await servico.listarAcompanhamentoPediatrico('tenant','paciente',usuario,{ limite: 2 })).toEqual({ itens: [], registrosExaminados: 2, itensExibidos: 0, temMaisHistorico: true, proximoCursor: 'legado2' });
    expect(qb.take).toHaveBeenCalledWith(3);
    expect(qb.where).toHaveBeenCalledWith(expect.stringContaining('a.tenant_id'), { tenantId: 'tenant', pacienteId: 'paciente' });
  });
  it('recusa cursor de outro escopo e limite inválido', async () => {
    const { servico } = montar();
    await expect(servico.listarAcompanhamentoPediatrico('tenant','paciente',usuario,{ cursor: 'externo' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.listarAcompanhamentoPediatrico('tenant','paciente',usuario,{ limite: 101 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('não permite ativar compartilhamento pediátrico pela rota legada', async () => {
    const { servico } = montar();
    const a = await servico.registrarAvaliacaoAntropometrica('tenant','paciente','autor',dados,usuario);
    await expect(servico.atualizarCompartilhamentoProgresso('tenant','paciente',a.id,{ metricasCompartilhadasPortal: ['imc'] },usuario)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('não publica IMC não finito após arredondamento de medidas extremas', async () => {
    const { servico } = montar();
    const a = await servico.registrarAvaliacaoAntropometrica('tenant','paciente','autor',{ ...dados,alturaCm: 1e-152 },usuario);
    expect(a.resultado.imc).toBeUndefined();
    expect(a.medidas.alturaCm).toBe(1e-152);
  });

});
