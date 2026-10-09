import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { PreferenciaNotificacaoUsuarioOrm } from '../infraestrutura/preferencia-notificacao-usuario.orm';
import { ResumoNotificacaoUsuarioOrm } from '../infraestrutura/resumo-notificacao-usuario.orm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { AdaptadorEmailSmtp } from '../../comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp';
import { ContextoEnvioNotificacao } from '../../comunicacoes/infraestrutura/adaptadores/adaptador-notificacao';
import { ProcessadorEmailResumos } from './processador-email-resumos';

function criarProcessador(erroEnvio?: Error, emailResumo = true) {
  const resumo = {
    id: '00000000-0000-4000-8000-000000000003', tenantId: '00000000-0000-4000-8000-000000000001',
    usuarioId: '00000000-0000-4000-8000-000000000002', estadoEmail: 'pendente',
    periodoInicioEm: new Date('2026-09-01T12:00:00Z'), periodoFimEm: new Date('2026-09-02T12:00:00Z'),
    contagensEmail: { tarefa_concluida: 2 }, tentativaEmailEm: null, finalizadoEmailEm: null
  };
  const repoResumo = {
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.estadoEmail === 'pendente') return resumo.estadoEmail === 'pendente' ? resumo : null;
      return resumo;
    }),
    save: jest.fn(async (registro) => { Object.assign(resumo, registro); return resumo; }),
    update: jest.fn(async (criterio: Record<string, unknown>, valores: Record<string, unknown>) => {
      if (resumo.estadoEmail === criterio.estadoEmail && resumo.tentativaEmailEm === criterio.tentativaEmailEm) {
        Object.assign(resumo, valores);
        return { affected: 1 };
      }
      return { affected: 0 };
    })
  };
  const manager = {
    getRepository: jest.fn((tipo: { name: string }) => {
      if (tipo === ResumoNotificacaoUsuarioOrm) return repoResumo;
      if (tipo === UsuarioOrm) return { findOne: jest.fn(async () => ({ ativo: true, role: 'Professional', emailCriptografado: Buffer.from('cipher') })) };
      if (tipo === PreferenciaNotificacaoUsuarioOrm) return { findOne: jest.fn(async () => ({ emailResumo })) };
      throw new Error(`Repositorio nao mapeado: ${tipo.name}`);
    })
  };
  const executor = { executar: jest.fn((_tenantId, operation) => operation(manager)) };
  const email = { enviar: jest.fn(async (_contexto: ContextoEnvioNotificacao) => { if (erroEnvio) throw erroEnvio; return { idExterno: 'nao-persiste' }; }) };
  const criptografia = { descriptografar: jest.fn(() => 'sintetico@example.test') };
  const processador = new ProcessadorEmailResumos(
    {} as never, executor as never, criptografia as unknown as CriptografiaDadosSensiveis,
    email as unknown as AdaptadorEmailSmtp
  );
  return { processador, email, resumo, repoResumo, criptografia };
}

describe('ProcessadorEmailResumos', () => {
  const origemAnterior = process.env.OCTACLIN_WEB_URL;
  const remetenteAnterior = process.env.EMAIL_REMETENTE;
  const provedorAnterior = process.env.EMAIL_PROVEDOR;
  const usuarioAnterior = process.env.EMAIL_SMTP_USUARIO;
  const senhaAnterior = process.env.EMAIL_SMTP_SENHA;
  beforeEach(() => {
    process.env.OCTACLIN_WEB_URL = 'https://app.octaclin.test';
    process.env.EMAIL_REMETENTE = 'no-reply@example.test';
    process.env.EMAIL_PROVEDOR = 'smtp';
    process.env.EMAIL_SMTP_USUARIO = 'no-reply@example.test';
    process.env.EMAIL_SMTP_SENHA = 'senha-sintetica';
  });
  afterAll(() => {
    if (origemAnterior === undefined) delete process.env.OCTACLIN_WEB_URL;
    else process.env.OCTACLIN_WEB_URL = origemAnterior;
    if (remetenteAnterior === undefined) delete process.env.EMAIL_REMETENTE;
    else process.env.EMAIL_REMETENTE = remetenteAnterior;
    if (provedorAnterior === undefined) delete process.env.EMAIL_PROVEDOR;
    else process.env.EMAIL_PROVEDOR = provedorAnterior;
    if (usuarioAnterior === undefined) delete process.env.EMAIL_SMTP_USUARIO;
    else process.env.EMAIL_SMTP_USUARIO = usuarioAnterior;
    if (senhaAnterior === undefined) delete process.env.EMAIL_SMTP_SENHA;
    else process.env.EMAIL_SMTP_SENHA = senhaAnterior;
  });

  it('reivindica antes do transporte e conclui apenas uma tentativa confirmada', async () => {
    const { processador, email, resumo } = criarProcessador();
    await (processador as unknown as { processarUm: (tenant: string, id: string) => Promise<void> })
      .processarUm(resumo.tenantId, resumo.id);
    expect(email.enviar).toHaveBeenCalledTimes(1);
    expect(email.enviar.mock.calls[0][0].payload.destino).toBe('sintetico@example.test');
    expect(email.enviar.mock.calls[0][0].payload.texto).toContain('2.');
    expect(resumo.estadoEmail).toBe('enviado');
  });

  it('marca entrega incerta sem reenvio quando o provedor falha', async () => {
    const { processador, email, resumo } = criarProcessador(new Error('erro externo privado'));
    const processar = (processador as unknown as { processarUm: (tenant: string, id: string) => Promise<void> }).processarUm;
    await processar.call(processador, resumo.tenantId, resumo.id);
    await processar.call(processador, resumo.tenantId, resumo.id);
    expect(email.enviar).toHaveBeenCalledTimes(1);
    expect(resumo.estadoEmail).toBe('incerto');
  });

  it('falha na preparacao sem chamar o transporte quando a origem Web nao e HTTPS', async () => {
    process.env.OCTACLIN_WEB_URL = 'http://inseguro.example.test';
    const { processador, email, resumo } = criarProcessador();
    await (processador as unknown as { processarUm: (tenant: string, id: string) => Promise<void> })
      .processarUm(resumo.tenantId, resumo.id);
    expect(email.enviar).not.toHaveBeenCalled();
    expect(resumo.estadoEmail).toBe('falhou');
  });

  it('cancela antes da reivindicacao quando o usuario desligou o opt-in', async () => {
    const { processador, email, resumo } = criarProcessador(undefined, false);
    await (processador as unknown as { processarUm: (tenant: string, id: string) => Promise<void> })
      .processarUm(resumo.tenantId, resumo.id);
    expect(email.enviar).not.toHaveBeenCalled();
    expect(resumo.estadoEmail).toBe('cancelado');
  });
});
