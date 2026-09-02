import { AmbienteExecucao, ambienteExigeFalhaFechada, obterAmbienteExecucao } from './ambiente-execucao';

/**
 * Verificacao de menor privilegio dos providers externos (PR 51).
 *
 * Ate aqui o repositorio *declarava* o menor privilegio -- `DATABASE_URL` com
 * "papel sem BYPASSRLS" em `VARIAVEIS_AMBIENTE.md`, TLS obrigatorio no
 * Postgres desde o PR 39, bucket privado com credencial restrita -- mas nada
 * media o estado real do processo em execucao. As unicas verificacoes de papel
 * viviam nos scripts de E2E (`validar-ambiente-staging-e2e.ts`,
 * `validar-prontuario-fase235.ts`), que nao rodam em producao.
 *
 * Isso importa porque o isolamento entre tenants provado no PR 43 depende
 * inteiramente de a role do runtime *nao* ter `BYPASSRLS`: a policy de RLS
 * simplesmente nao e avaliada para uma role que a ignora. Colar a URL da role
 * owner no painel do Render nao produz nenhum erro -- a aplicacao sobe, os
 * testes de fumaca passam e o isolamento deixa de existir em silencio.
 *
 * Este modulo so mede e relata. Nao derruba o boot, por decisao registrada no
 * PR 51 e pela licao de 2026-08-22 em `docs/agents/LESSONS_LEARNED.md`: um
 * check novo avaliado contra configuracao presumida, e nao contra o ambiente
 * real, ja degradou a saude de producao uma vez. A conversao para falha
 * fechada acontece depois da evidencia de producao, no PR seguinte, conforme
 * `docs/governance/POLITICA_PROVIDERS_MENOR_PRIVILEGIO.md`.
 */

export type VeredictoMenorPrivilegio = 'conforme' | 'violado' | 'nao-verificado';

export interface ResultadoVerificacao {
  veredicto: VeredictoMenorPrivilegio;
  /** Motivos legiveis, sempre sem host, credencial ou nome de role. */
  motivos: string[];
}

export interface RelatorioMenorPrivilegio {
  ambiente: AmbienteExecucao;
  veredicto: VeredictoMenorPrivilegio;
  verificadoEm: string;
  postgres: ResultadoVerificacao;
  redis: ResultadoVerificacao;
  armazenamento: ResultadoVerificacao;
}

/** Linha unica devolvida por {@link CONSULTA_PRIVILEGIO_POSTGRES}. */
export interface PrivilegioRolePostgres {
  usuario: string;
  super: boolean;
  bypassrls: boolean;
  herdaPrivilegio: boolean;
  podeCriarNoSchema: boolean;
}

/**
 * `pg_has_role(..., 'MEMBER')` e proposital, e nao `'USAGE'`.
 *
 * `BYPASSRLS` e `SUPERUSER` sao atributos de role: nao sao herdados pela
 * associacao, mesmo com `INHERIT`. O que a associacao concede e o direito de
 * `SET ROLE` para a role alvo -- e depois do `SET ROLE` os atributos passam a
 * valer. Entao o caminho de escalonamento que interessa e a *pertinencia*
 * (`MEMBER`), nao a heranca automatica (`USAGE`).
 *
 * A direcao inversa e segura e existe de proposito neste projeto: o
 * `AUDITORIA_FINAL_FASE_235_2026-08-13.md` registra que "a associacao
 * preexistente do owner com a role runtime foi preservada". Owner membro do
 * runtime nao aparece aqui, porque a consulta parte de `current_user`.
 */
export const CONSULTA_PRIVILEGIO_POSTGRES = `
  select
    current_user::text as usuario,
    coalesce(atual.rolsuper, false) as super,
    coalesce(atual.rolbypassrls, false) as bypassrls,
    exists (
      select 1
      from pg_roles alvo
      where (alvo.rolsuper or alvo.rolbypassrls)
        and alvo.rolname <> current_user
        and pg_has_role(current_user, alvo.oid, 'MEMBER')
    ) as "herdaPrivilegio",
    has_schema_privilege(current_user, 'public', 'CREATE') as "podeCriarNoSchema"
  from pg_roles atual
  where atual.rolname = current_user
`;

export function avaliarPrivilegioRolePostgres(linha?: PrivilegioRolePostgres): ResultadoVerificacao {
  if (!linha?.usuario) {
    return {
      veredicto: 'nao-verificado',
      motivos: ['A consulta de privilegio nao devolveu a role corrente.']
    };
  }

  const motivos: string[] = [];
  if (linha.super) motivos.push('A role do runtime tem SUPERUSER.');
  if (linha.bypassrls) motivos.push('A role do runtime tem BYPASSRLS; a policy de RLS nao e avaliada para ela.');
  if (linha.herdaPrivilegio) {
    motivos.push('A role do runtime e membro de uma role com SUPERUSER ou BYPASSRLS e pode assumi-la com SET ROLE.');
  }
  // DDL fora de banda com role owner e a correcao registrada na licao de
  // 2026-08-22: o deploy tentou migration com a role runtime e falhou por
  // falta de CREATE. Ter CREATE de volta no schema desfaz aquela separacao sem
  // que nada reclame.
  if (linha.podeCriarNoSchema) {
    motivos.push('A role do runtime tem CREATE no schema public; migrations devem rodar fora de banda com a role owner.');
  }

  return motivos.length ? { veredicto: 'violado', motivos } : { veredicto: 'conforme', motivos: [] };
}

/**
 * Espelha exatamente a decisao de `criarConexaoRedis`: com `REDIS_URL`, o TLS
 * liga por `rediss://` **ou** por `REDIS_TLS=true`; sem ela, so por
 * `REDIS_TLS=true`. Uma regra que divergisse da conexao real relataria um
 * estado que o processo nao tem.
 */
export function avaliarTlsRedis(env: NodeJS.ProcessEnv = process.env): ResultadoVerificacao {
  const url = env.REDIS_URL?.trim();
  const host = env.REDIS_HOST?.trim();
  const porta = env.REDIS_PORTA?.trim();
  const tlsExplicito = env.REDIS_TLS === 'true';

  if (!url && !host && !porta) {
    return { veredicto: 'nao-verificado', motivos: ['Redis nao configurado neste processo.'] };
  }

  let tlsAtivo = tlsExplicito;
  if (url) {
    try {
      tlsAtivo = new URL(url).protocol === 'rediss:' || tlsExplicito;
    } catch {
      return { veredicto: 'violado', motivos: ['REDIS_URL nao e uma URL valida.'] };
    }
  }

  if (tlsAtivo) return { veredicto: 'conforme', motivos: [] };
  if (!ambienteExigeFalhaFechada()) {
    return { veredicto: 'nao-verificado', motivos: ['TLS do Redis so e exigido em staging e producao.'] };
  }

  return {
    veredicto: 'violado',
    motivos: [
      'A conexao Redis nao usa TLS; credencial e payload de fila trafegam em claro. Use rediss:// ou REDIS_TLS=true.'
    ]
  };
}

/**
 * O endpoint S3 e usado literalmente por `servico-armazenamento-objetos.ts`,
 * inclusive na assinatura das URLs entregues ao navegador. Endpoint `http://`
 * em producao poe anexo clinico e URL assinada em texto claro na rede.
 */
export function avaliarEndpointArmazenamento(env: NodeJS.ProcessEnv = process.env): ResultadoVerificacao {
  const endpoint = env.ARMAZENAMENTO_S3_ENDPOINT?.trim();
  if (!endpoint) {
    return { veredicto: 'nao-verificado', motivos: ['Armazenamento de anexos nao configurado neste processo.'] };
  }

  let protocolo: string;
  try {
    protocolo = new URL(endpoint).protocol;
  } catch {
    return { veredicto: 'violado', motivos: ['ARMAZENAMENTO_S3_ENDPOINT nao e uma URL valida.'] };
  }

  if (protocolo === 'https:') return { veredicto: 'conforme', motivos: [] };
  if (!ambienteExigeFalhaFechada()) {
    return { veredicto: 'nao-verificado', motivos: ['HTTPS no endpoint so e exigido em staging e producao.'] };
  }

  return {
    veredicto: 'violado',
    motivos: ['ARMAZENAMENTO_S3_ENDPOINT nao usa HTTPS; anexo clinico e URL assinada trafegariam em claro.']
  };
}

/**
 * Um `violado` em qualquer provider contamina o veredicto geral. `conforme`
 * exige que nada tenha sido violado e que ao menos uma verificacao tenha
 * acontecido de fato -- tres `nao-verificado` nao sao aprovacao.
 */
export function consolidarVeredicto(partes: ResultadoVerificacao[]): VeredictoMenorPrivilegio {
  if (partes.some((parte) => parte.veredicto === 'violado')) return 'violado';
  if (partes.some((parte) => parte.veredicto === 'conforme')) return 'conforme';
  return 'nao-verificado';
}

export function montarRelatorio(
  postgres: ResultadoVerificacao,
  env: NodeJS.ProcessEnv = process.env
): RelatorioMenorPrivilegio {
  const redis = avaliarTlsRedis(env);
  const armazenamento = avaliarEndpointArmazenamento(env);

  return {
    ambiente: obterAmbienteExecucao(),
    veredicto: consolidarVeredicto([postgres, redis, armazenamento]),
    verificadoEm: new Date().toISOString(),
    postgres,
    redis,
    armazenamento
  };
}
