import {
  CONSULTA_PRIVILEGIO_POSTGRES,
  RelatorioMenorPrivilegio,
  ResultadoVerificacao,
  avaliarEndpointArmazenamento,
  avaliarPrivilegioRolePostgres,
  avaliarTlsRedis,
  consolidarVeredicto,
  montarRelatorio,
  motivoDeBloqueio
} from './menor-privilegio-providers';

const ambienteOriginal = { ...process.env };

afterEach(() => {
  process.env = { ...ambienteOriginal };
});

function comAmbiente(valores: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...valores } as NodeJS.ProcessEnv;
}

describe('avaliarPrivilegioRolePostgres', () => {
  const roleMinima = {
    usuario: 'octaclin_app_producao',
    super: false,
    bypassrls: false,
    herdaPrivilegio: false,
    podeCriarNoSchema: false
  };

  it('aprova a role de runtime sem atributo privilegiado nem CREATE no schema', () => {
    expect(avaliarPrivilegioRolePostgres(roleMinima)).toEqual({ veredicto: 'conforme', motivos: [] });
  });

  it('reprova BYPASSRLS, porque a policy de RLS deixa de ser avaliada para a role', () => {
    const resultado = avaliarPrivilegioRolePostgres({ ...roleMinima, bypassrls: true });

    expect(resultado.veredicto).toBe('violado');
    expect(resultado.motivos.join(' ')).toContain('BYPASSRLS');
  });

  it('reprova SUPERUSER', () => {
    expect(avaliarPrivilegioRolePostgres({ ...roleMinima, super: true }).veredicto).toBe('violado');
  });

  it('reprova pertinencia a role privilegiada, que e alcancavel por SET ROLE', () => {
    const resultado = avaliarPrivilegioRolePostgres({ ...roleMinima, herdaPrivilegio: true });

    expect(resultado.veredicto).toBe('violado');
    expect(resultado.motivos.join(' ')).toContain('SET ROLE');
  });

  it('reprova CREATE no schema public, que desfaz a separacao owner/runtime das migrations', () => {
    const resultado = avaliarPrivilegioRolePostgres({ ...roleMinima, podeCriarNoSchema: true });

    expect(resultado.veredicto).toBe('violado');
    expect(resultado.motivos.join(' ')).toContain('CREATE');
  });

  it('acumula todos os motivos em vez de parar no primeiro', () => {
    const resultado = avaliarPrivilegioRolePostgres({
      usuario: 'neondb_owner',
      super: true,
      bypassrls: true,
      herdaPrivilegio: true,
      podeCriarNoSchema: true
    });

    expect(resultado.motivos).toHaveLength(4);
  });

  it('trata linha ausente como nao verificado, e nao como aprovacao', () => {
    expect(avaliarPrivilegioRolePostgres(undefined).veredicto).toBe('nao-verificado');
  });

  it('nao expoe o nome da role nos motivos', () => {
    const resultado = avaliarPrivilegioRolePostgres({ ...roleMinima, usuario: 'neondb_owner', bypassrls: true });

    expect(resultado.motivos.join(' ')).not.toContain('neondb_owner');
  });

  it('consulta a pertinencia por MEMBER, porque BYPASSRLS nao e herdado por USAGE', () => {
    expect(CONSULTA_PRIVILEGIO_POSTGRES).toContain("'MEMBER'");
    expect(CONSULTA_PRIVILEGIO_POSTGRES).not.toContain("'USAGE'");
  });
});

describe('avaliarTlsRedis', () => {
  it('aprova rediss://', () => {
    const env = comAmbiente({ APP_AMBIENTE: 'producao', REDIS_URL: 'rediss://usuario:senha@host:6379' });

    expect(avaliarTlsRedis(env).veredicto).toBe('conforme');
  });

  it('aprova redis:// com REDIS_TLS=true, espelhando criarConexaoRedis', () => {
    const env = comAmbiente({ APP_AMBIENTE: 'producao', REDIS_URL: 'redis://host:6379', REDIS_TLS: 'true' });

    expect(avaliarTlsRedis(env).veredicto).toBe('conforme');
  });

  it('reprova redis:// sem TLS em producao', () => {
    process.env.APP_AMBIENTE = 'producao';
    const resultado = avaliarTlsRedis(comAmbiente({ APP_AMBIENTE: 'producao', REDIS_URL: 'redis://host:6379' }));

    expect(resultado.veredicto).toBe('violado');
    expect(resultado.motivos.join(' ')).toContain('TLS');
  });

  it('nao expoe host nem credencial no motivo', () => {
    process.env.APP_AMBIENTE = 'producao';
    const resultado = avaliarTlsRedis(
      comAmbiente({ APP_AMBIENTE: 'producao', REDIS_URL: 'redis://usuario:senha@redis-interno:6379' })
    );

    expect(resultado.motivos.join(' ')).not.toContain('senha');
    expect(resultado.motivos.join(' ')).not.toContain('redis-interno');
  });

  it('nao reprova fora de staging e producao', () => {
    process.env.APP_AMBIENTE = 'local';

    expect(avaliarTlsRedis(comAmbiente({ REDIS_URL: 'redis://localhost:6379' })).veredicto).toBe('nao-verificado');
  });

  it('reprova URL invalida', () => {
    expect(avaliarTlsRedis(comAmbiente({ REDIS_URL: 'nao-e-url' })).veredicto).toBe('violado');
  });

  it('trata Redis ausente como nao verificado', () => {
    expect(avaliarTlsRedis(comAmbiente({})).veredicto).toBe('nao-verificado');
  });
});

describe('avaliarEndpointArmazenamento', () => {
  it('aprova endpoint HTTPS', () => {
    const env = comAmbiente({ APP_AMBIENTE: 'producao', ARMAZENAMENTO_S3_ENDPOINT: 'https://s3.regiao.provedor.com' });

    expect(avaliarEndpointArmazenamento(env).veredicto).toBe('conforme');
  });

  it('reprova endpoint HTTP em producao', () => {
    process.env.APP_AMBIENTE = 'producao';
    const resultado = avaliarEndpointArmazenamento(
      comAmbiente({ ARMAZENAMENTO_S3_ENDPOINT: 'http://s3.regiao.provedor.com' })
    );

    expect(resultado.veredicto).toBe('violado');
    expect(resultado.motivos.join(' ')).toContain('HTTPS');
  });

  it('nao reprova MinIO local', () => {
    process.env.APP_AMBIENTE = 'local';

    expect(
      avaliarEndpointArmazenamento(comAmbiente({ ARMAZENAMENTO_S3_ENDPOINT: 'http://localhost:9000' })).veredicto
    ).toBe('nao-verificado');
  });

  it('trata armazenamento ausente como nao verificado', () => {
    expect(avaliarEndpointArmazenamento(comAmbiente({})).veredicto).toBe('nao-verificado');
  });
});

describe('consolidarVeredicto', () => {
  it('deixa uma violacao contaminar o veredicto geral', () => {
    expect(
      consolidarVeredicto([
        { veredicto: 'conforme', motivos: [] },
        { veredicto: 'violado', motivos: ['x'] },
        { veredicto: 'nao-verificado', motivos: [] }
      ])
    ).toBe('violado');
  });

  it('nao trata ausencia de verificacao como aprovacao', () => {
    expect(
      consolidarVeredicto([
        { veredicto: 'nao-verificado', motivos: [] },
        { veredicto: 'nao-verificado', motivos: [] }
      ])
    ).toBe('nao-verificado');
  });

  it('aprova quando ao menos uma verificacao passou e nenhuma foi violada', () => {
    expect(
      consolidarVeredicto([
        { veredicto: 'conforme', motivos: [] },
        { veredicto: 'nao-verificado', motivos: [] }
      ])
    ).toBe('conforme');
  });
});

describe('motivoDeBloqueio', () => {
  const conforme: ResultadoVerificacao = { veredicto: 'conforme', motivos: [] };
  const naoVerificado: ResultadoVerificacao = { veredicto: 'nao-verificado', motivos: [] };
  const violado: ResultadoVerificacao = { veredicto: 'violado', motivos: ['x'] };

  function relatorio(partes: Partial<RelatorioMenorPrivilegio>): RelatorioMenorPrivilegio {
    return {
      ambiente: 'producao',
      veredicto: 'conforme',
      verificadoEm: new Date().toISOString(),
      postgres: conforme,
      redis: conforme,
      armazenamento: conforme,
      ...partes
    };
  }

  it('nao bloqueia quando os tres providers estao conformes', () => {
    expect(motivoDeBloqueio(relatorio({}))).toBeUndefined();
  });

  it('bloqueia qualquer provider violado e nomeia quais', () => {
    const motivo = motivoDeBloqueio(relatorio({ redis: violado, armazenamento: violado }));

    expect(motivo).toContain('redis');
    expect(motivo).toContain('armazenamento');
    expect(motivo).not.toContain('postgres');
  });

  it('bloqueia postgres nao-verificado, porque dele depende o isolamento entre tenants', () => {
    expect(motivoDeBloqueio(relatorio({ postgres: naoVerificado }))).toContain('isolamento entre tenants');
  });

  /**
   * O `worker` de producao nao configura `ARMAZENAMENTO_S3_ENDPOINT` porque nao
   * serve anexo. Foi assim que ele reportou em 2026-09-02, e bloquear por isso
   * mataria o processo por nao usar um provider que ele nao usa mesmo.
   */
  it('nao bloqueia redis e armazenamento nao-verificados, que e o caso real do worker', () => {
    expect(motivoDeBloqueio(relatorio({ redis: naoVerificado, armazenamento: naoVerificado }))).toBeUndefined();
  });

  it('prioriza a violacao sobre a ausencia de verificacao na mensagem', () => {
    expect(motivoDeBloqueio(relatorio({ postgres: violado }))).toContain('violado');
  });
});

describe('montarRelatorio', () => {
  it('reune os tres providers, o ambiente e o instante da medicao', () => {
    process.env.APP_AMBIENTE = 'producao';
    const env = comAmbiente({
      APP_AMBIENTE: 'producao',
      REDIS_URL: 'rediss://host:6379',
      ARMAZENAMENTO_S3_ENDPOINT: 'https://s3.regiao.provedor.com'
    });

    const relatorio = montarRelatorio({ veredicto: 'conforme', motivos: [] }, env);

    expect(relatorio.ambiente).toBe('producao');
    expect(relatorio.veredicto).toBe('conforme');
    expect(relatorio.redis.veredicto).toBe('conforme');
    expect(relatorio.armazenamento.veredicto).toBe('conforme');
    expect(Date.parse(relatorio.verificadoEm)).not.toBeNaN();
  });

  it('reprova o conjunto quando o Postgres esta violado, mesmo com os demais conformes', () => {
    process.env.APP_AMBIENTE = 'producao';
    const env = comAmbiente({
      APP_AMBIENTE: 'producao',
      REDIS_URL: 'rediss://host:6379',
      ARMAZENAMENTO_S3_ENDPOINT: 'https://s3.regiao.provedor.com'
    });

    const relatorio = montarRelatorio({ veredicto: 'violado', motivos: ['BYPASSRLS'] }, env);

    expect(relatorio.veredicto).toBe('violado');
  });
});
