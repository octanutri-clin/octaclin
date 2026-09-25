import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { CatalogoMarcadorExameOrm } from '../infraestrutura/catalogo-marcador-exame.orm';
import { ServicoCatalogoMarcadoresExames } from './servico-catalogo-marcadores-exames';

const tenantId = '10000000-0000-4000-8000-000000000001';
const outroTenantId = '20000000-0000-4000-8000-000000000001';
const usuario = {
  tenantId, usuarioId: '10000000-0000-4000-8000-000000000002', papel: 'Professional',
  permissoes: ['pacientes.ler', 'pacientes.gerenciar']
};

describe('ServicoCatalogoMarcadoresExames', () => {
  function criarServico() {
    const registros: Record<string, any>[] = [{
      id: 'outro-item', tenantId: outroTenantId, arquivadoEm: null,
      definicaoCriptografada: Buffer.from('cifrado:{"nome":"Outro","unidade":"mg/dL"}')
    }];
    const repositorio = {
      create: jest.fn((entrada: Record<string, unknown>) => entrada),
      save: jest.fn(async (entrada: Record<string, any>) => {
        const salvo = { id: entrada.id ?? `item-${registros.length}`, ...entrada };
        const indice = registros.findIndex((item) => item.id === salvo.id);
        if (indice === -1) registros.push(salvo); else registros[indice] = salvo;
        return salvo;
      }),
      findAndCount: jest.fn(async ({ where }: { where: { tenantId: string } }) => {
        const itens = registros.filter((item) => item.tenantId === where.tenantId && !item.arquivadoEm);
        return [itens, itens.length];
      }),
      findOne: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        registros.find((item) => item.id === where.id && item.tenantId === where.tenantId && !item.arquivadoEm) ?? null)
    };
    const auditoria = { save: jest.fn(async (item: unknown) => item), create: jest.fn((item: unknown) => item) };
    const gerenciador = { getRepository: jest.fn((entidade: unknown) =>
      entidade === CatalogoMarcadorExameOrm ? repositorio : entidade === UserActionLogOrm ? auditoria : undefined) };
    const criptografia = {
      criptografar: (valor: string) => Buffer.from(`cifrado:${valor}`),
      descriptografar: (valor: Buffer) => valor.toString().replace('cifrado:', '')
    };
    const servico = new ServicoCatalogoMarcadoresExames({ executar: async (_: string, fn: (arg: unknown) => unknown) => fn(gerenciador) } as never, criptografia as never);
    return { servico, repositorio, registros, auditoria };
  }

  it('cifra a definicao e lista somente itens ativos do tenant', async () => {
    const { servico, repositorio, auditoria } = criarServico();
    const criado = await servico.criar(tenantId, usuario as never, {
      nome: 'Ferritina', unidade: 'ng/mL', limiteInferior: '10', limiteSuperior: '40'
    });
    const salvo = repositorio.save.mock.calls[0][0];
    expect(salvo.tenantId).toBe(tenantId);
    expect(salvo.nome).toBeUndefined();
    expect(salvo.definicaoCriptografada).toBeInstanceOf(Buffer);
    expect(criado).toEqual(expect.objectContaining({ nome: 'Ferritina', limiteInferior: '10' }));
    const listagem = await servico.listar(tenantId, usuario as never, { pagina: 1, limite: 25 });
    expect(listagem.total).toBe(1);
    expect(listagem.itens[0].nome).toBe('Ferritina');
    expect(auditoria.save).toHaveBeenCalled();
  });

  it('recusa arquivar item de outro tenant e nega escrita sem permissao', async () => {
    const { servico } = criarServico();
    await expect(servico.arquivar(tenantId, 'outro-item', usuario as never)).rejects.toBeInstanceOf(NotFoundException);
    await expect(servico.criar(tenantId, { ...usuario, permissoes: ['pacientes.ler'] } as never, {
      nome: 'Ferritina', unidade: 'ng/mL'
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite leitura ao colaborador com permissao, mas recusa gestao do catalogo', async () => {
    const { servico } = criarServico();
    const colaborador = { ...usuario, papel: 'Collaborator', permissoes: ['pacientes.ler', 'pacientes.gerenciar'] } as never;
    const listagem = await servico.listar(tenantId, colaborador, { pagina: 1, limite: 25 });
    expect(listagem.total).toBe(0);
    await expect(servico.criar(tenantId, colaborador, { nome: 'Ferritina', unidade: 'ng/mL' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('nega tenant divergente da credencial antes de ler ou gravar', async () => {
    const { servico, repositorio } = criarServico();
    await expect(servico.listar(outroTenantId, usuario as never))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(servico.criar(outroTenantId, usuario as never, { nome: 'Ferritina' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(repositorio.findAndCount).not.toHaveBeenCalled();
    expect(repositorio.save).not.toHaveBeenCalled();
  });
});
