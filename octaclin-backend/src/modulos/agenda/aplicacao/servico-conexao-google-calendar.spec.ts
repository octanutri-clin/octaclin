import { DataSource } from 'typeorm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ServicoConexaoGoogleCalendar } from './servico-conexao-google-calendar';

describe('ServicoConexaoGoogleCalendar', () => {
  const criptografia = new CriptografiaDadosSensiveis();

  function construirServico() {
    const executorTenant = { executar: jest.fn((_tenantId: string, callback: (gerenciador: any) => any) => callback(gerenciadorFalso)) } as unknown as ExecutorTenant;
    const gerenciadorFalso = criarGerenciadorFalso();
    const fonteDados = { transaction: jest.fn() } as unknown as DataSource;
    const servico = new ServicoConexaoGoogleCalendar(executorTenant, criptografia);
    return { servico, gerenciadorFalso, executorTenant };
  }

  function criarGerenciadorFalso() {
    const registros = new Map<string, any>();
    return {
      getRepository: () => ({
        findOne: jest.fn(async ({ where }: any) => registros.get(`${where.tenantId}:${where.profissionalId}`) ?? null),
        create: jest.fn((dados: any) => dados),
        save: jest.fn(async (dados: any) => {
          const chave = `${dados.tenantId}:${dados.profissionalId}`;
          const salvo = { id: 'conexao-1', ...registros.get(chave), ...dados };
          registros.set(chave, salvo);
          return salvo;
        })
      })
    };
  }

  it('gera uma URL de autorizacao com state assinado contendo tenantId e profissionalId', () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    const { servico } = construirServico();

    const url = servico.gerarUrlAutorizacao('tenant-1', 'profissional-1', 'https://backend/agenda/google/callback');

    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=client-id');
    const parametros = new URL(url).searchParams;
    const decodificado = servico.validarEDecodificarState(parametros.get('state') ?? '');
    expect(decodificado).toEqual({ tenantId: 'tenant-1', profissionalId: 'profissional-1' });
  });

  it('rejeita um state adulterado', () => {
    const { servico } = construirServico();
    expect(() => servico.validarEDecodificarState('valor-invalido')).toThrow();
  });
});
