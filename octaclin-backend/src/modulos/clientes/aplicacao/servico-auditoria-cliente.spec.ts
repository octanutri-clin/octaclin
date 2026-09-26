import { BadRequestException } from '@nestjs/common';
import { ServicoAuditoriaCliente } from './servico-auditoria-cliente';

describe('ServicoAuditoriaCliente', () => {
  const idUsuario = '10000000-0000-4000-8000-000000000001';
  const linha = { id: 'evento-a', usuarioId: idUsuario, acao: 'pacientes.criar', recursoTipo: 'paciente', criadoEm: new Date('2026-09-01T12:00:00Z'), metadados: { proibido: 'conteudo-sintetico' }, ip: '192.0.2.1', recursoId: 'recurso-proibido' };
  const query = jest.fn(async () => [linha]);
  const executar = jest.fn(async (_tenant: string, fn: (manager: unknown) => Promise<unknown>) => fn({ query }));
  const servico = new ServicoAuditoriaCliente({ executar } as never);

  beforeEach(() => { jest.clearAllMocks(); query.mockResolvedValue([linha]); });

  it('projeta somente campos aprovados, usando transacao RLS e filtro de tenant', async () => {
    const resultado = await servico.listar('tenant-a');
    expect(executar).toHaveBeenCalledWith('tenant-a', expect.any(Function));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('a.tenant_id = $1'), expect.arrayContaining(['tenant-a']));
    expect(resultado.itens).toEqual([{ usuarioId: idUsuario, acao: linha.acao, recursoTipo: linha.recursoTipo, criadoEm: linha.criadoEm.toISOString() }]);
    expect(JSON.stringify(resultado)).not.toMatch(/conteudo-sintetico|192\.0\.2\.1|recurso-proibido/);
  });

  it('limita a pagina e busca uma linha adicional sem contagem irrestrita', async () => {
    query.mockResolvedValue([linha, linha, linha]);
    const resultado = await servico.listar('tenant-a', { pagina: '2', limite: '2' });
    expect(resultado).toMatchObject({ pagina: 2, limite: 2, temMais: true });
    expect(resultado.itens).toHaveLength(2);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY a.criado_em DESC, a.id DESC'), expect.arrayContaining([3, 2]));
  });

  it('parametriza filtros exatos e datas UTC com limite final exclusivo', async () => {
    await servico.listar('tenant-a', { usuarioId: idUsuario, acao: 'pacientes.criar', recursoTipo: 'paciente', inicio: '2026-09-01', fim: '2026-09-02' });
    expect(query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([idUsuario, 'pacientes.criar', 'paciente', new Date('2026-09-01T00:00:00Z'), new Date('2026-09-03T00:00:00Z')]));
  });

  it.each([{ limite: '101' }, { pagina: '0' }, { pagina: '10001' }, { pagina: ['1', '2'] }, { acao: ['pacientes.criar'] }, { usuarioId: 'invalido' }, { inicio: '2026-02-30' }, { inicio: '2026-09-02', fim: '2026-09-01' }, { tenantId: 'tenant-b' }])('rejeita filtros invalidos antes do banco: %j', async (filtros) => {
    await expect(servico.listar('tenant-a', filtros)).rejects.toBeInstanceOf(BadRequestException);
    expect(executar).not.toHaveBeenCalled();
  });
});
