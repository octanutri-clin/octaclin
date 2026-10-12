import { EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ServicoConfiguracaoPiloto } from './servico-configuracao-piloto';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
const gestor: UsuarioAutenticado = { tenantId: 'tenant-sintetico', usuarioId: 'gestor-sintetico', emailHash: '', papel: 'Client', permissoes: ['cliente.configuracoes.gerenciar'] };
function preparar(ativo=true) {
  let registro: any = null;
  const repo = { findOne: async () => registro, create: (v: any) => v, save: async (v: any) => { registro = v; return v; } };
  const m = { query: async (sql:string) => sql.includes("from usuarios") ? (ativo ? [{id:gestor.usuarioId}] : []) : (sql.includes("from tenants") ? [{id:gestor.tenantId}] : []), getRepository: () => repo } as unknown as EntityManager;
  const executor = { executar: async (_t: string, f: (m: EntityManager) => unknown) => f(m) } as ExecutorTenant;
  return new ServicoConfiguracaoPiloto(executor);
}
describe('configuracao administrativa317', () => {
  const anterior = process.env.GAMIFICACAO_PILOTO_OPERACAO_APROVADA;
  beforeEach(() => { delete process.env.GAMIFICACAO_PILOTO_OPERACAO_APROVADA; });
  afterEach(() => { if (anterior === undefined) delete process.env.GAMIFICACAO_PILOTO_OPERACAO_APROVADA; else process.env.GAMIFICACAO_PILOTO_OPERACAO_APROVADA = anterior; });
  it('inicia desligado mesmo quando flags legadas estiverem habilitadas', async () => {
    expect(await preparar().obter(gestor.tenantId, gestor)).toEqual({ conquistas: false, comunidade: false, versao: 0, operacaoAprovada: false });
  });
  it('impede ativacao administrativa sem gate operacional', async () => {
    delete process.env.GAMIFICACAO_PILOTO_OPERACAO_APROVADA;
    await expect(preparar().atualizar(gestor.tenantId, gestor, { conquistas: true, comunidade: false, versaoEsperada: 0 })).rejects.toThrow();
  });
  it('nao concede configuracao ao profissional ou acesso cross-tenant ao gestor', async () => {
    const servico = preparar();
    await expect(servico.obter('outro-tenant', gestor)).rejects.toThrow();
    await expect(servico.obter(gestor.tenantId, { ...gestor, papel: 'Professional' })).rejects.toThrow();
  });
  it('salva flags explicitamente e rejeita versao antiga', async () => {
    process.env.GAMIFICACAO_PILOTO_OPERACAO_APROVADA = 'true';
    const servico = preparar();
    expect(await servico.atualizar(gestor.tenantId, gestor, { conquistas: true, comunidade: false, versaoEsperada: 0 })).toEqual({ conquistas: true, comunidade: false, versao: 1, operacaoAprovada: true });
    await expect(servico.atualizar(gestor.tenantId, gestor, { conquistas: false, comunidade: false, versaoEsperada: 0 })).rejects.toThrow('Configuracao mudou');
  });
  it('revalida gestor ativo no banco antes de ler configuracao',async()=>{
    await expect(preparar(false).obter(gestor.tenantId,gestor)).rejects.toThrow('Acesso nao autorizado');
  });

});
