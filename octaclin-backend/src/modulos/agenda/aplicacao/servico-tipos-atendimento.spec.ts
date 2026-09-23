import { NotFoundException } from '@nestjs/common';
import { TipoAtendimentoOrm } from '../infraestrutura/tipo-atendimento.orm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoTiposAtendimento } from './servico-tipos-atendimento';

const usuario: UsuarioAutenticado = {
  usuarioId: 'usuario-1',
  tenantId: 'tenant-1',
  papel: 'SuperAdmin',
  emailHash: 'hash',
  permissoes: ['agenda.consultas.criar']
};

describe('ServicoTiposAtendimento', () => {
  function criarServico() {
    const tipos: Record<string, unknown>[] = [];
    const repositorio = {
      create: jest.fn((dados: Record<string, unknown>) => ({ id: `tipo-${tipos.length + 1}`, criadoEm: new Date(), atualizadoEm: new Date(), ...dados })),
      save: jest.fn(async (dados: Record<string, unknown>) => {
        const existente = tipos.find((item) => item.id === dados.id);
        if (existente) {
          Object.assign(existente, dados);
          return existente;
        }
        tipos.push(dados);
        return dados;
      }),
      find: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        tipos.filter((tipo) =>
          Object.entries(where).every(([chave, valor]) => tipo[chave] === valor)
        )
      ),
      findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        tipos.find((tipo) => Object.entries(where).every(([chave, valor]) => tipo[chave] === valor)) ?? null
      )
    };
    const gerenciador = { getRepository: jest.fn(() => repositorio) };
    const servico = new ServicoTiposAtendimento({
      executar: async (_tenantId: string, fn: (gerenciador: unknown) => unknown) => fn(gerenciador)
    } as never);
    return { servico, tipos };
  }

  it('cria um tipo de atendimento ativo', async () => {
    const { servico, tipos } = criarServico();

    const tipo = await servico.criar('tenant-1', { nome: 'Primeira consulta', duracaoMinutos: 60 }, usuario);

    expect(tipo).toMatchObject({ nome: 'Primeira consulta', duracaoMinutos: 60, ativo: true });
    expect(tipos[0]).toMatchObject({ tenantId: 'tenant-1', nome: 'Primeira consulta', duracaoMinutos: 60 });
  });

  it('lista somente ativos quando solicitado', async () => {
    const { servico } = criarServico();
    await servico.criar('tenant-1', { nome: 'Retorno', duracaoMinutos: 30 }, usuario);
    const arquivado = await servico.criar('tenant-1', { nome: 'Descontinuado', duracaoMinutos: 45 }, usuario);
    await servico.arquivar('tenant-1', arquivado.id, usuario);

    const ativos = await servico.listar('tenant-1', true);
    const todos = await servico.listar('tenant-1', false);

    expect(ativos.map((item) => item.nome)).toEqual(['Retorno']);
    expect(todos.map((item) => item.nome).sort()).toEqual(['Descontinuado', 'Retorno']);
  });

  it('arquivar torna o tipo inativo', async () => {
    const { servico } = criarServico();
    const tipo = await servico.criar('tenant-1', { nome: 'Retorno', duracaoMinutos: 30 }, usuario);

    const resultado = await servico.arquivar('tenant-1', tipo.id, usuario);

    expect(resultado).toEqual({ id: tipo.id });
    const [ativo] = await servico.listar('tenant-1', true);
    expect(ativo).toBeUndefined();
  });

  it('rejeita arquivar tipo inexistente ou ja arquivado', async () => {
    const { servico } = criarServico();

    await expect(servico.arquivar('tenant-1', 'tipo-inexistente', usuario)).rejects.toBeInstanceOf(NotFoundException);
  });
});
