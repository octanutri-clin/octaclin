import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
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
import { ProtegerArquivosMidia1720000001014 } from './migracoes/1720000001014-ProtegerArquivosMidia';
import { AdicionarTeleconsultaAgenda1720000001015 } from './migracoes/1720000001015-AdicionarTeleconsultaAgenda';
import { CriarAvaliacoesAntropometricas1720000001016 } from './migracoes/1720000001016-CriarAvaliacoesAntropometricas';
import { CriarDocumentosEmitidos1720000001017 } from './migracoes/1720000001017-CriarDocumentosEmitidos';
import { CriptografarConteudoNotificacoes1720000001018 } from './migracoes/1720000001018-CriptografarConteudoNotificacoes';
import { AdicionarFinanceiroConsulta1720000001019 } from './migracoes/1720000001019-AdicionarFinanceiroConsulta';
import { CriarNotificacoesUsuario1720000001020 } from './migracoes/1720000001020-CriarNotificacoesUsuario';
import { DashboardAlertaOcultoOrm } from '../../modulos/dashboard/infraestrutura/dashboard-alerta-oculto.orm';
import { AgendaBloqueioManualOrm } from '../../modulos/agenda/infraestrutura/agenda-bloqueio-manual.orm';

const ambienteOriginal = process.env;

describe('criarOpcoesTypeOrm', () => {
  beforeEach(() => {
    process.env = { ...ambienteOriginal };
    delete process.env.DATABASE_URL;
    delete process.env.BANCO_SSL;
    delete process.env.BANCO_POOL_MAX;
    delete process.env.BANCO_POOL_CONNECTION_TIMEOUT_MS;
    delete process.env.BANCO_POOL_IDLE_TIMEOUT_MS;
    delete process.env.BANCO_EXECUTAR_MIGRACOES;
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

  it('configura o pool Postgres com defaults finitos e permite ajuste por ambiente', () => {
    const padrao = criarOpcoesTypeOrm() as unknown as Record<string, unknown>;
    expect(padrao.extra).toEqual({
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000
    });

    process.env.BANCO_POOL_MAX = '6';
    process.env.BANCO_POOL_CONNECTION_TIMEOUT_MS = '2500';
    process.env.BANCO_POOL_IDLE_TIMEOUT_MS = '45000';

    const ajustado = criarOpcoesTypeOrm() as unknown as Record<string, unknown>;
    expect(ajustado.extra).toEqual({
      max: 6,
      connectionTimeoutMillis: 2500,
      idleTimeoutMillis: 45000
    });
  });

  it.each([
    ['BANCO_POOL_MAX', '0'],
    ['BANCO_POOL_MAX', '51'],
    ['BANCO_POOL_CONNECTION_TIMEOUT_MS', 'abc'],
    ['BANCO_POOL_IDLE_TIMEOUT_MS', '-1']
  ])('rejeita configuracao invalida do pool em %s', (nome, valor) => {
    process.env[nome] = valor;

    expect(() => criarOpcoesTypeOrm()).toThrow(nome);
  });

  it.each([
    [undefined, false],
    ['true', true],
    ['false', false]
  ])('executa migrations no boot somente com BANCO_EXECUTAR_MIGRACOES=%s', (valor, esperado) => {
    if (valor !== undefined) process.env.BANCO_EXECUTAR_MIGRACOES = valor;

    expect(criarOpcoesTypeOrm().migrationsRun).toBe(esperado);
  });

  it.each(['TRUE', '1', 'sim', ''])('rejeita BANCO_EXECUTAR_MIGRACOES invalido: %s', (valor) => {
    process.env.BANCO_EXECUTAR_MIGRACOES = valor;

    expect(() => criarOpcoesTypeOrm()).toThrow('BANCO_EXECUTAR_MIGRACOES deve ser "true" ou "false".');
  });

  it('registra toda migration que existe na pasta, sem depender de lembrar da lista', () => {
    // `opcoes.migrations` e uma lista explicita, e o teste vizinho usa
    // `arrayContaining`, que por construcao nunca acusa uma migration faltando.
    // Esquecer uma linha aqui produz um arquivo de migration que nunca roda, e
    // o CI nao pega porque nao executa migrations.
    const pasta = join(__dirname, 'migracoes');
    const nomesNaPasta = readdirSync(pasta)
      .filter((arquivo) => arquivo.endsWith('.ts') && !arquivo.endsWith('.spec.ts'))
      .map((arquivo) => {
        const conteudo = readFileSync(join(pasta, arquivo), 'utf8');
        const encontrado = /export class (\w+)/.exec(conteudo);
        if (!encontrado) throw new Error(`Migration sem classe exportada: ${arquivo}`);
        return encontrado[1];
      })
      .sort();
    const nomesRegistrados = (criarOpcoesTypeOrm().migrations as Function[]).map((classe) => classe.name).sort();

    expect(nomesRegistrados).toEqual(nomesNaPasta);
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
        AdicionarIndiceBuscaPacientes1720000001013,
        ProtegerArquivosMidia1720000001014,
        AdicionarTeleconsultaAgenda1720000001015,
        CriarAvaliacoesAntropometricas1720000001016,
        CriarDocumentosEmitidos1720000001017,
        CriptografarConteudoNotificacoes1720000001018,
        AdicionarFinanceiroConsulta1720000001019,
        CriarNotificacoesUsuario1720000001020
      ])
    );
  });
});
