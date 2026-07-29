import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import {
  criarFonteDadosPostgresIntegracao,
  obterUrlPostgresIntegracao,
  prepararSchemaPostgresMobileIntegracao
} from '../../../infraestrutura/testes/postgres-integracao';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { SincronizacaoMobileOrm } from '../infraestrutura/sincronizacao-mobile.orm';
import { ServicoMobile } from './servico-mobile';

const urlIntegracao = obterUrlPostgresIntegracao();
const descreverPostgres = urlIntegracao ? describe : describe.skip;

// Neon remoto tem latencia superior ao timeout padrao unitario do Jest.
jest.setTimeout(30_000);

interface CenarioMobile {
  tenantId: string;
  paciente: PacienteOrm;
  profissional: ProfissionalOrm;
}

descreverPostgres('ServicoMobile com PostgreSQL real', () => {
  let fonteDados: DataSource;
  let servico: ServicoMobile;

  beforeAll(async () => {
    fonteDados = criarFonteDadosPostgresIntegracao(urlIntegracao!);
    await fonteDados.initialize();
    await prepararSchemaPostgresMobileIntegracao(fonteDados);
    servico = new ServicoMobile(
      new ExecutorTenant(fonteDados),
      {} as CriptografiaDadosSensiveis,
      {} as ServicoSenhas
    );
  });

  beforeEach(async () => {
    await fonteDados.query('drop function if exists atrasar_diario_mobile() cascade');
    await fonteDados.query(
      'truncate table sincronizacoes_mobile, logs_diario_rapido, pacientes, profissionais restart identity cascade'
    );
  });

  afterAll(async () => {
    await fonteDados.destroy();
  });

  it('recupera a corrida de chave unica sem duplicar o recurso sincronizado', async () => {
    const cenario = await criarCenarioMobile(fonteDados);
    await fonteDados.query(`
      create function atrasar_diario_mobile() returns trigger as $$
      begin
        perform pg_sleep(0.25);
        return new;
      end;
      $$ language plpgsql;
      create trigger atraso_diario_mobile before insert on logs_diario_rapido
      for each row execute function atrasar_diario_mobile();
    `);
    const item = criarItemDiario(cenario.paciente.id, 'local-concorrente');
    const usuario = criarSuperAdmin(cenario.tenantId);

    const [primeiro, segundo] = await Promise.all([
      servico.sincronizarLote(cenario.tenantId, { itens: [item] }, usuario),
      servico.sincronizarLote(cenario.tenantId, { itens: [item] }, usuario)
    ]);
    const sincronizacoes = await fonteDados.getRepository(SincronizacaoMobileOrm).find();

    expect(primeiro.resultados[0]).toMatchObject({ idLocal: item.idLocal, status: 'sincronizado' });
    expect(segundo.resultados[0]).toMatchObject({ idLocal: item.idLocal, status: 'sincronizado' });
    expect(primeiro.resultados[0].recursoId).toBe(segundo.resultados[0].recursoId);
    expect(sincronizacoes).toHaveLength(1);
  });

  it('aceita o mesmo idLocal para pacientes diferentes sem reutilizar recurso', async () => {
    const primeiro = await criarCenarioMobile(fonteDados);
    const segundo = await criarCenarioMobile(fonteDados, primeiro.tenantId);
    const usuario = criarSuperAdmin(primeiro.tenantId);
    const idLocal = 'local-compartilhado';

    const resultadoPrimeiro = await servico.sincronizarLote(
      primeiro.tenantId,
      { itens: [criarItemDiario(primeiro.paciente.id, idLocal)] },
      usuario
    );
    const resultadoSegundo = await servico.sincronizarLote(
      primeiro.tenantId,
      { itens: [criarItemDiario(segundo.paciente.id, idLocal)] },
      usuario
    );
    const sincronizacoes = await fonteDados.getRepository(SincronizacaoMobileOrm).find();

    expect(resultadoPrimeiro.resultados[0].recursoId).not.toBe(resultadoSegundo.resultados[0].recursoId);
    expect(sincronizacoes).toHaveLength(2);
    expect(sincronizacoes[0].idLocal).not.toBe(sincronizacoes[1].idLocal);
  });

  it('nao reserva sincronizacao ao receber paciente de outro profissional', async () => {
    const permitido = await criarCenarioMobile(fonteDados);
    const naoPermitido = await criarCenarioMobile(fonteDados, permitido.tenantId);
    const profissional = criarProfissionalAutenticado(permitido.tenantId, permitido.profissional.usuarioId);
    const item = criarItemDiario(naoPermitido.paciente.id, 'local-nao-autorizado');

    const resultado = await servico.sincronizarLote(permitido.tenantId, { itens: [item] }, profissional);
    const sincronizacoes = await fonteDados.getRepository(SincronizacaoMobileOrm).find();

    expect(resultado.resultados).toEqual([
      { idLocal: item.idLocal, status: 'erro', erro: 'Paciente nao encontrado.' }
    ]);
    expect(sincronizacoes).toHaveLength(0);
  });
});

async function criarCenarioMobile(fonteDados: DataSource, tenantId: string = randomUUID()): Promise<CenarioMobile> {
  const profissional = await fonteDados.getRepository(ProfissionalOrm).save({
    id: randomUUID(),
    tenantId,
    usuarioId: randomUUID(),
    nomeCriptografado: Buffer.from('Profissional mobile')
  });
  const paciente = await fonteDados.getRepository(PacienteOrm).save({
    id: randomUUID(),
    tenantId,
    profissionalResponsavelId: profissional.id,
    nomeCriptografado: Buffer.from('Paciente mobile'),
    scoreRisco: '0'
  });
  return { tenantId, paciente, profissional };
}

function criarItemDiario(pacienteId: string, idLocal: string) {
  return {
    idLocal,
    tipo: 'diario_rapido' as const,
    payload: { pacienteId, tipo: 'humor' as const, valor: { nivel: 4 } }
  };
}

function criarSuperAdmin(tenantId: string): UsuarioAutenticado {
  return { usuarioId: randomUUID(), tenantId, papel: 'SuperAdmin', emailHash: 'admin', permissoes: [] };
}

function criarProfissionalAutenticado(tenantId: string, usuarioId: string): UsuarioAutenticado {
  return { usuarioId, tenantId, papel: 'Professional', emailHash: 'profissional', permissoes: [] };
}
