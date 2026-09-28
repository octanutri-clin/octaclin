import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ServicoRevisaoFormularios } from './servico-revisao-formularios';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';

jest.mock('../../auth/infraestrutura/configuracao-jwt', () => ({ obterSegredoAcesso: () => 'segredo-sintetico-de-teste-com-trinta-e-dois-bytes' }));
jest.mock('../../../infraestrutura/seguranca/escopo-profissional', () => ({ resolverProfissionalIdDoUsuario: jest.fn().mockResolvedValue('profissional-a') }));

const usuario: UsuarioAutenticado = { usuarioId: 'usuario-a', tenantId: 'tenant-a', papel: 'Professional', emailHash: 'hash-sintetico', permissoes: ['questionarios.gerenciar'] };
const envio = { id: 'envio-a', tenantId: 'tenant-a', pacienteId: 'paciente-a', questionarioId: 'questionario-a', status: 'respondido', respondidoEm: new Date('2026-09-27T10:00:00Z'), snapshotEstrutura: { titulo: 'Questionário', perguntas: [{ id: 'pergunta-a', enunciado: 'Pergunta histórica', tipo: 'texto_longo', ordem: 1 }] } };
const paciente = { id: 'paciente-a', tenantId: 'tenant-a', profissionalResponsavelId: 'profissional-a', nomeCriptografado: Buffer.from('Paciente sintético') };

function cenario(pacienteEncontrado: unknown = paciente, valorResposta: unknown = 'Resposta sintética', proximaConsulta: unknown = null) {
  const repositorios = new Map<unknown, unknown>();
  const consulta = {
    innerJoin: jest.fn(), where: jest.fn(), andWhere: jest.fn(), orderBy: jest.fn(),
    addOrderBy: jest.fn(), skip: jest.fn(), take: jest.fn(), getManyAndCount: jest.fn(async () => [[envio], 1])
  };
  [consulta.innerJoin, consulta.where, consulta.andWhere, consulta.orderBy,
    consulta.addOrderBy, consulta.skip, consulta.take].forEach((metodo) => metodo.mockReturnValue(consulta));
  const findOne = jest.fn(async (opcoes: { where: Record<string, unknown> }) => {
    if ('inicioEm' in opcoes.where) return proximaConsulta;
    if ('status' in opcoes.where) return envio;
    if ('profissionalResponsavelId' in opcoes.where) return pacienteEncontrado;
    if ('envioQuestionarioId' in opcoes.where) return { id: 'resposta-a', pacienteId: 'paciente-a', finalizadoEm: new Date('2026-09-27T10:00:00Z') };
    if ('questionarioId' in opcoes.where) return { titulo: 'Questionário' };
    return pacienteEncontrado;
  });
  const find = jest.fn(async (opcoes?: { select?: Record<string, unknown> }) => opcoes?.select
    ? [paciente]
    : [{ perguntaId: 'pergunta-a', valor: valorResposta }]);
  const save = jest.fn(async (valor) => valor);
  const gerenciador = { getRepository: jest.fn((entidade) => {
    if (!repositorios.has(entidade)) repositorios.set(entidade, { findOne, find, save, createQueryBuilder: jest.fn(() => consulta) });
    return repositorios.get(entidade);
  }) };
  const executor = { executar: jest.fn(async (_tenant, fn) => fn(gerenciador)) };
  const servico = new ServicoRevisaoFormularios(executor as never, { descriptografar: () => 'Paciente sintético' } as never);
  return { servico, findOne, save, executor, consulta };
}

describe('ServicoRevisaoFormularios', () => {
  it('abre só o envio autorizado e usa o enunciado histórico', async () => {
    const { servico, executor } = cenario();
    const detalhe = await servico.obterDetalhe('tenant-a', 'envio-a', usuario);
    expect(detalhe.respostas[0].enunciado).toBe('Pergunta histórica');
    expect(detalhe.respostas[0].valor).toBe('Resposta sintética');
    expect(detalhe.comprovanteLeitura).toBeTruthy();
    expect(executor.executar).toHaveBeenCalledWith('tenant-a', expect.any(Function));
  });

  it('não expõe resposta sem paciente sob responsabilidade atual', async () => {
    const { servico } = cenario(null);
    await expect(servico.obterDetalhe('tenant-a', 'envio-a', usuario)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('busca o envio pelo tenant e rejeita quando não existe nesse escopo', async () => {
    const { servico, findOne } = cenario();
    findOne.mockResolvedValueOnce(null);
    await expect(servico.obterDetalhe('tenant-b', 'envio-a', { ...usuario, tenantId: 'tenant-b' })).rejects.toBeInstanceOf(NotFoundException);
    expect(findOne).toHaveBeenCalledWith({ where: { id: 'envio-a', tenantId: 'tenant-b', status: 'respondido' } });
  });

  it('rejeita comprovante de outro usuário ou adulterado', async () => {
    const { servico } = cenario();
    const detalhe = await servico.obterDetalhe('tenant-a', 'envio-a', usuario);
    expect(() => servico.validarComprovante(detalhe.comprovanteLeitura!, 'tenant-a', 'envio-a', { ...usuario, usuarioId: 'outro' })).toThrow(BadRequestException);
    expect(() => servico.validarComprovante(`${detalhe.comprovanteLeitura}x`, 'tenant-a', 'envio-a', usuario)).toThrow(BadRequestException);
    expect(() => servico.validarComprovante(detalhe.comprovanteLeitura!, 'outro-tenant', 'envio-a', usuario)).toThrow(BadRequestException);
    expect(() => servico.validarComprovante(detalhe.comprovanteLeitura!, 'tenant-a', 'outro-envio', usuario)).toThrow(BadRequestException);
    expect(() => servico.validarComprovante(detalhe.comprovanteLeitura!, 'tenant-a', 'envio-a', { ...usuario, sessaoId: 'outra-sessao' })).toThrow(BadRequestException);
  });

  it('pagina a fila do tenant e do profissional com ordem estável', async () => {
    const { servico, consulta } = cenario();
    const lista = await servico.listarPendentes('tenant-a', usuario, 2);
    expect(lista).toEqual(expect.objectContaining({ pagina: 2, tamanho: 20, total: 1 }));
    expect(lista.itens[0]).toEqual(expect.objectContaining({ id: 'envio-a', pacienteNome: 'Paciente sintético' }));
    expect(consulta.where).toHaveBeenCalledWith('envio.tenantId = :tenantId', { tenantId: 'tenant-a' });
    expect(consulta.andWhere).toHaveBeenCalledWith('paciente.profissionalResponsavelId = :profissionalId', { profissionalId: 'profissional-a' });
    expect(consulta.skip).toHaveBeenCalledWith(20);
    expect(consulta.addOrderBy).toHaveBeenCalledWith('envio.id', 'ASC');
  });

  it('não emite comprovante para envio já revisado', async () => {
    const { servico } = cenario();
    const revisadoEm = new Date('2026-09-27T11:00:00Z');
    (envio as typeof envio & { revisadoEm?: Date }).revisadoEm = revisadoEm;
    try {
      const detalhe = await servico.obterDetalhe('tenant-a', 'envio-a', usuario);
      expect(detalhe.comprovanteLeitura).toBeUndefined();
    } finally {
      delete (envio as { revisadoEm?: Date }).revisadoEm;
    }
  });

  it('recusa comprovante expirado', async () => {
    const relogio = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    try {
      const { servico } = cenario();
      const detalhe = await servico.obterDetalhe('tenant-a', 'envio-a', usuario);
      relogio.mockReturnValue(1_000_000 + 10 * 60 * 1000 + 1);
      expect(() => servico.validarComprovante(detalhe.comprovanteLeitura!, 'tenant-a', 'envio-a', usuario)).toThrow(BadRequestException);
    } finally {
      relogio.mockRestore();
    }
  });

  it('traduz opção pelo snapshot e oculta identificadores de anexos', async () => {
    const pergunta = envio.snapshotEstrutura.perguntas[0] as typeof envio.snapshotEstrutura.perguntas[0] & { opcoes?: { valor: string; rotulo: string }[] };
    pergunta.tipo = 'multipla_escolha';
    pergunta.opcoes = [{ valor: 'a', rotulo: 'Opção histórica' }];
    try {
      const escolha = await cenario(paciente, 'a').servico.obterDetalhe('tenant-a', 'envio-a', usuario);
      expect(escolha.respostas[0].valor).toBe('Opção histórica');
      pergunta.tipo = 'upload_midia';
      const anexo = await cenario(paciente, ['arquivo-opaco']).servico.obterDetalhe('tenant-a', 'envio-a', usuario);
      expect(anexo.respostas[0].valor).toBe('1 anexo informado');
    } finally {
      pergunta.tipo = 'texto_longo';
      delete pergunta.opcoes;
    }
  });

  it('mostra a próxima consulta separadamente do agendamento do questionário', async () => {
    const inicioEm = new Date('2026-10-01T13:00:00Z');
    const { servico, findOne } = cenario(paciente, 'Resposta sintética', { id: 'consulta-a', inicioEm });
    const detalhe = await servico.obterDetalhe('tenant-a', 'envio-a', usuario);
    expect(detalhe.proximaConsultaEm).toEqual(inicioEm);
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-a', pacienteId: 'paciente-a' })
    }));
    expect(detalhe).not.toHaveProperty('agendamentoId');
  });
});
