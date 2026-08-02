import { criarOpcoesTypeOrm } from './opcoes-typeorm';
import { AdicionarDesfechosConsultaAgenda1720000001002 } from './migracoes/1720000001002-AdicionarDesfechosConsultaAgenda';
import { AdicionarRevisaoClinicaEnviosQuestionario1720000001003 } from './migracoes/1720000001003-AdicionarRevisaoClinicaEnviosQuestionario';
import { CriarAlertasOcultosDashboardClinico1720000001004 } from './migracoes/1720000001004-CriarAlertasOcultosDashboardClinico';
import { ProtegerCanaisWatchGoogleAgenda1720000001005 } from './migracoes/1720000001005-ProtegerCanaisWatchGoogleAgenda';
import { CriarBloqueiosManuaisAgenda1720000001006 } from './migracoes/1720000001006-CriarBloqueiosManuaisAgenda';
import { AdicionarSnapshotEstruturaEnviosQuestionario1720000001007 } from './migracoes/1720000001007-AdicionarSnapshotEstruturaEnviosQuestionario';
import { AdicionarBibliotecaPerguntas1720000001008 } from './migracoes/1720000001008-AdicionarBibliotecaPerguntas';
import { VincularAgendamentoQuestionarioPaciente1720000001009 } from './migracoes/1720000001009-VincularAgendamentoQuestionarioPaciente';
import { AdicionarRascunhoEnviosQuestionario1720000001010 } from './migracoes/1720000001010-AdicionarRascunhoEnviosQuestionario';
import { AdicionarRevisaoHumanaIa1720000001011 } from './migracoes/1720000001011-AdicionarRevisaoHumanaIa';
import { IsolarIdempotenciaMobilePorPaciente1720000001012 } from './migracoes/1720000001012-IsolarIdempotenciaMobilePorPaciente';
import { AdicionarIndiceBuscaPacientes1720000001013 } from './migracoes/1720000001013-AdicionarIndiceBuscaPacientes';
import { DashboardAlertaOcultoOrm } from '../../modulos/dashboard/infraestrutura/dashboard-alerta-oculto.orm';
import { AgendaBloqueioManualOrm } from '../../modulos/agenda/infraestrutura/agenda-bloqueio-manual.orm';

const ambienteOriginal = process.env;

describe('criarOpcoesTypeOrm', () => {
  beforeEach(() => {
    process.env = { ...ambienteOriginal };
    delete process.env.DATABASE_URL;
    delete process.env.BANCO_SSL;
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('usa DATABASE_URL quando informada', () => {
    process.env.DATABASE_URL = 'postgresql://usuario%40app:senha@ep-demo.neon.tech/octaclin?sslmode=require';

    const opcoes = criarOpcoesTypeOrm() as unknown as Record<string, unknown>;

    expect(opcoes.host).toBe('ep-demo.neon.tech');
    expect(opcoes.port).toBe(5432);
    expect(opcoes.username).toBe('usuario@app');
    expect(opcoes.password).toBe('senha');
    expect(opcoes.database).toBe('octaclin');
    expect(opcoes.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('mantem fallback por BANCO_* quando DATABASE_URL nao existe', () => {
    process.env.BANCO_HOST = 'localhost';
    process.env.BANCO_PORTA = '5433';
    process.env.BANCO_USUARIO = 'octaclin';
    process.env.BANCO_SENHA = 'local';
    process.env.BANCO_NOME = 'octaclin_local';
    process.env.BANCO_SSL = 'false';

    const opcoes = criarOpcoesTypeOrm() as unknown as Record<string, unknown>;

    expect(opcoes.host).toBe('localhost');
    expect(opcoes.port).toBe(5433);
    expect(opcoes.username).toBe('octaclin');
    expect(opcoes.password).toBe('local');
    expect(opcoes.database).toBe('octaclin_local');
    expect(opcoes.ssl).toBe(false);
  });

  it('registra a entidade e a sequencia de migrations das fases clinicas', () => {
    const opcoes = criarOpcoesTypeOrm();

    expect(opcoes.entities).toEqual(expect.arrayContaining([DashboardAlertaOcultoOrm, AgendaBloqueioManualOrm]));
    expect(opcoes.migrations).toEqual(
      expect.arrayContaining([
        AdicionarDesfechosConsultaAgenda1720000001002,
        AdicionarRevisaoClinicaEnviosQuestionario1720000001003,
        CriarAlertasOcultosDashboardClinico1720000001004,
        ProtegerCanaisWatchGoogleAgenda1720000001005,
        CriarBloqueiosManuaisAgenda1720000001006,
        AdicionarSnapshotEstruturaEnviosQuestionario1720000001007,
        AdicionarBibliotecaPerguntas1720000001008,
        VincularAgendamentoQuestionarioPaciente1720000001009,
        AdicionarRascunhoEnviosQuestionario1720000001010,
        AdicionarRevisaoHumanaIa1720000001011,
        IsolarIdempotenciaMobilePorPaciente1720000001012,
        AdicionarIndiceBuscaPacientes1720000001013
      ])
    );
  });
});
