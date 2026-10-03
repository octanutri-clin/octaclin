import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { processarDetalhesLgpd } from './cifrar-detalhes-solicitacoes-lgpd';

interface Evento {
  id: string;
  tenantId: string;
  tipo: string;
  metadados: Record<string, unknown>;
  detalhesCriptografados: Buffer | null;
}

function criarBanco(eventos: Evento[]) {
  let tenantAtivo: string | undefined;
  const consultas: { sql: string; parametros?: unknown[]; tenantAtivo?: string }[] = [];
  const gerenciador = {
    query: jest.fn(async (sql: string, parametros?: unknown[]) => {
      consultas.push({ sql, parametros, tenantAtivo });
      if (sql.includes("set_config('app.tenant_id'")) {
        tenantAtivo = parametros?.[0] as string;
        return [{ set_config: tenantAtivo }];
      }
      const tenantId = parametros?.[0] as string;
      expect(tenantAtivo).toBe(tenantId);
      const elegiveis = eventos.filter((evento) => evento.tenantId === tenantId &&
        ['solicitacao_lgpd_retificacao', 'solicitacao_lgpd_exclusao', 'tratativa_lgpd'].includes(evento.tipo) &&
        Object.hasOwn(evento.metadados, 'detalhes'));
      if (sql.includes('count(*)')) return [{ total: elegiveis.length }];
      if (sql.includes('limit 100')) return elegiveis.slice(0, 100).map((evento) => ({
        id: evento.id, metadados: { ...evento.metadados },
        detalhesCriptografados: evento.detalhesCriptografados
      }));
      if (sql.includes('update consentimentos_lgpd')) {
        const evento = elegiveis.find((item) => item.id === parametros?.[1]);
        if (!evento) return [];
        evento.detalhesCriptografados = parametros?.[2] as Buffer | null;
        delete evento.metadados.detalhes;
        return [];
      }
      throw new Error('Consulta inesperada no cenario de backfill.');
    })
  };
  const fonte = {
    query: jest.fn(async () => [{ banco: 'octaclin_teste', papel: 'owner_teste' }]),
    getRepository: jest.fn(() => ({ find: async () => [{ id: 'tenant-a' }, { id: 'tenant-b' }] })),
    transaction: jest.fn(async (operacao: (gerenciador: unknown) => Promise<unknown>) => {
      tenantAtivo = undefined;
      return operacao(gerenciador);
    })
  };
  return { fonte, consultas };
}

describe('backfill dos detalhes LGPD', () => {
  const criptografia = new CriptografiaDadosSensiveis();

  it('cifra por tenant, remove JSON legado e e idempotente', async () => {
    const eventos: Evento[] = [
      { id: 'a', tenantId: 'tenant-a', tipo: 'solicitacao_lgpd_retificacao',
        metadados: { protocolo: 'LGPD-A', detalhes: 'Corrigir contato.' }, detalhesCriptografados: null },
      { id: 'b', tenantId: 'tenant-b', tipo: 'tratativa_lgpd',
        metadados: { protocolo: 'LGPD-B', detalhes: 'Análise interna.' }, detalhesCriptografados: null },
      { id: 'c', tenantId: 'tenant-b', tipo: 'consentimento_termos',
        metadados: { detalhes: 'Texto fora do escopo.' }, detalhesCriptografados: null }
    ];
    const { fonte, consultas } = criarBanco(eventos);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await expect(processarDetalhesLgpd(fonte as never, criptografia, 'octaclin_teste', 'owner_teste'))
        .resolves.toEqual({ convertidos: 2, tenants: 2 });
      expect(criptografia.descriptografar(eventos[0].detalhesCriptografados!)).toBe('Corrigir contato.');
      expect(criptografia.descriptografar(eventos[1].detalhesCriptografados!)).toBe('Análise interna.');
      expect(eventos[0].metadados).not.toHaveProperty('detalhes');
      expect(eventos[1].metadados).not.toHaveProperty('detalhes');
      expect(eventos[2].metadados.detalhes).toBe('Texto fora do escopo.');
      expect(consultas.filter((consulta) => consulta.sql.includes('update consentimentos_lgpd'))
        .map((consulta) => [consulta.tenantAtivo, consulta.parametros?.[0]])).toEqual([
        ['tenant-a', 'tenant-a'], ['tenant-b', 'tenant-b']
      ]);
      await expect(processarDetalhesLgpd(fonte as never, criptografia, 'octaclin_teste', 'owner_teste'))
        .resolves.toEqual({ convertidos: 0, tenants: 2 });
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('recusa banco ou role divergente antes de varrer tenants', async () => {
    const { fonte } = criarBanco([]);
    await expect(processarDetalhesLgpd(fonte as never, criptografia, 'outro_banco', 'owner_teste')).rejects.toThrow();
    await expect(processarDetalhesLgpd(fonte as never, criptografia, 'octaclin_teste', 'outra_role')).rejects.toThrow();
    expect(fonte.getRepository).not.toHaveBeenCalled();
    expect(fonte.transaction).not.toHaveBeenCalled();
  });

  it('interrompe se a cifra existente nao corresponde ao texto legado', async () => {
    const eventos: Evento[] = [{
      id: 'a', tenantId: 'tenant-a', tipo: 'solicitacao_lgpd_exclusao',
      metadados: { protocolo: 'LGPD-A', detalhes: 'Texto correto.' },
      detalhesCriptografados: criptografia.criptografar('Outro texto.')
    }];
    const { fonte } = criarBanco(eventos);
    await expect(processarDetalhesLgpd(fonte as never, criptografia, 'octaclin_teste', 'owner_teste')).rejects.toThrow();
    expect(eventos[0].metadados).toHaveProperty('detalhes');
  });
});
