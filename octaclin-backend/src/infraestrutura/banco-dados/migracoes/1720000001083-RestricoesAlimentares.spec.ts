import type { QueryRunner } from 'typeorm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RestricoesAlimentares1720000001083, TABELAS_RESTRICOES_ALIMENTARES } from './1720000001083-RestricoesAlimentares';
import { criarOpcoesTypeOrm } from '../opcoes-typeorm';
import { ESTADOS_SOLICITACAO, ESTADOS_FINAIS_SOLICITACAO } from '../../../modulos/planos-alimentares/dominio/solicitacao-restricao-paciente';
import { RestricaoPacienteOrm } from '../../../modulos/planos-alimentares/infraestrutura/restricao-paciente.orm';
import { RevisaoRestricaoPacienteOrm } from '../../../modulos/planos-alimentares/infraestrutura/revisao-restricao-paciente.orm';
import { AvaliacaoRestricoesPacienteOrm } from '../../../modulos/planos-alimentares/infraestrutura/avaliacao-restricoes-paciente.orm';
import { RevisaoAvaliacaoRestricoesOrm } from '../../../modulos/planos-alimentares/infraestrutura/revisao-avaliacao-restricoes.orm';
import { ReconfirmacaoRestricoesOrm } from '../../../modulos/planos-alimentares/infraestrutura/reconfirmacao-restricoes.orm';
import { SolicitacaoRestricaoPacienteOrm } from '../../../modulos/planos-alimentares/infraestrutura/solicitacao-restricao-paciente.orm';
import { MapeamentoAlimentoAlvoLocalOrm } from '../../../modulos/planos-alimentares/infraestrutura/mapeamento-alimento-alvo-local.orm';

const sqlDe = async (f: (q: QueryRunner) => Promise<void>, respostas: unknown[][] = []) => {
  const query = jest.fn(async (_s: string) => respostas.shift() ?? []);
  await f({ query } as unknown as QueryRunner);
  return query.mock.calls.map(c => c[0]).join('\n').toLowerCase();
};

const APPEND_ONLY = ['restricoes_pacientes_revisoes', 'avaliacoes_restricoes_revisoes', 'reconfirmacoes_restricoes', 'mapeamentos_alimento_alvo_locais'];
const MUTAVEIS = ['restricoes_pacientes', 'avaliacoes_restricoes_pacientes', 'solicitacoes_restricoes_pacientes'];

describe('1083 restrições alimentares (P1b): schema aditivo e vazio', () => {
  let sql: string;
  beforeAll(async () => { sql = await sqlDe(q => new RestricoesAlimentares1720000001083().up(q)); });

  it('cria só as sete tabelas novas, sem backfill, sem dado e sem tocar em tabela existente', () => {
    expect([...TABELAS_RESTRICOES_ALIMENTARES].sort()).toEqual([...APPEND_ONLY, ...MUTAVEIS].sort());
    for (const t of TABELAS_RESTRICOES_ALIMENTARES) expect(sql).toContain(`create table ${t} (`);
    expect(sql).not.toMatch(/insert into|update \w+ set|delete from|copy |drop table|alter table (pacientes|usuarios|tenants|resposta_valores|envios_questionario)/);
    expect(sql).not.toMatch(/resposta_valores|respostas_rascunho/);
  });

  it('cada tabela tem tenant_id, RLS ENABLE + FORCE e policies só por app.tenant_id, sem DELETE/ALL', () => {
    for (const t of TABELAS_RESTRICOES_ALIMENTARES) {
      expect(sql).toMatch(new RegExp(`create table ${t} \\([^;]*tenant_id uuid not null references tenants\\(id\\) on delete restrict`));
      expect(sql).toContain(`alter table ${t} enable row level security`);
      expect(sql).toContain(`alter table ${t} force row level security`);
      expect(sql).toMatch(new RegExp(`create policy ${t}_leitura on ${t} for select\\s+using \\(tenant_id = nullif\\(current_setting\\('app.tenant_id', true\\), ''\\)::uuid\\)`));
      expect(sql).toMatch(new RegExp(`create policy ${t}_criacao on ${t} for insert\\s+with check \\(tenant_id = nullif\\(current_setting\\('app.tenant_id', true\\), ''\\)::uuid\\)`));
    }
    expect(sql).not.toMatch(/for (delete|all)\b/);
    expect(sql).not.toMatch(/bypassrls|grant /);
  });

  it('só as tabelas de estado aceitam UPDATE (com tenant no using e no with check); histórico não', () => {
    const tenant = "\\(tenant_id = nullif\\(current_setting\\('app.tenant_id', true\\), ''\\)::uuid\\)";
    for (const t of MUTAVEIS) expect(sql).toMatch(new RegExp(`create policy ${t}_atualizacao on ${t} for update\\s+using ${tenant}\\s+with check ${tenant}`));
    for (const t of APPEND_ONLY) expect(sql).not.toContain(`on ${t} for update`);
  });

  it('histórico append-only por instrução (padrão 1082) e DELETE/TRUNCATE bloqueados em todas', () => {
    for (const t of APPEND_ONLY) {
      expect(sql).toMatch(new RegExp(`before update or delete or truncate on ${t}\\s+for each statement execute function rejeitar_mutacao_restricoes_alimentares\\(\\)`));
      expect(sql).toMatch(new RegExp(`revoke update, delete, truncate on ${t} from public`));
    }
    for (const t of MUTAVEIS) {
      expect(sql).toMatch(new RegExp(`before delete or truncate on ${t}\\s+for each statement execute function rejeitar_mutacao_restricoes_alimentares\\(\\)`));
      expect(sql).toMatch(new RegExp(`revoke delete, truncate on ${t} from public`));
    }
    for (const t of APPEND_ONLY) expect(sql).toContain(`alter table ${t} enable always trigger trg_${t}_append_only`);
    for (const t of MUTAVEIS) expect(sql).toContain(`alter table ${t} enable always trigger trg_${t}_sem_exclusao`);
    expect(sql).toMatch(/errcode = '42501'/);
    expect(sql).toMatch(/octaclin_runtime_integracao.*octaclin_app_producao/s);
  });

  it('conteúdo clínico só em bytea cifrado; sem razão religiosa (Q4) nem alvo/natureza em claro', () => {
    for (const c of ['conteudo_criptografado bytea not null', 'justificativa_criptografada bytea', 'explicacao_paciente_criptografada bytea',
      'justificativa_interna_criptografada bytea', 'resultado_criptografado bytea not null', 'evidencia_criptografada bytea']) expect(sql).toContain(c);
    expect(sql).not.toMatch(/\brazao\b|natureza|subtipo|gravidade|observacao|alvo_declarado|alvo_tipo/);
    // Nenhuma coluna de texto livre ou jsonb em claro (lição do Q5).
    expect(sql).not.toMatch(/\bjsonb?\b|\btext (not null|null|check|default)|\btext,/);
  });

  it('origem do mapeamento: a tabela do tenant só aceita local_profissional e liberação exige evidência', () => {
    expect(sql).toMatch(/origem varchar\(20\) not null default 'local_profissional' check \(origem = 'local_profissional'\)/);
    expect(sql).toMatch(/check \(relacao <> 'nao_contem_confirmado' or evidencia_criptografada is not null\)/);
  });

  it('Q3: inativação no histórico exige motivo, justificativa cifrada e confirmação em dois passos, sem reautenticação', () => {
    expect(sql).toMatch(/check \(\(evento = 'inativacao'\) = \(motivo_inativacao is not null\)\)/);
    expect(sql).toMatch(/check \(evento <> 'inativacao' or \(justificativa_criptografada is not null and confirmacao_dois_passos\)\)/);
    expect(sql).not.toMatch(/reautentica/);
  });

  it('Q10: reconfirmação exige os seis campos e referencia a revisão real da avaliação', () => {
    for (const c of ['paciente_id uuid not null', 'atestado_por_usuario_id uuid not null', 'atestado_em timestamptz not null',
      "meio varchar(24) not null check (meio in ('presencial', 'teleconsulta', 'portal', 'contato_documentado'))", 'resultado_criptografado bytea not null',
      'revisao_avaliacao integer not null']) expect(sql).toContain(c);
    expect(sql).toMatch(/foreign key \(tenant_id, avaliacao_id, revisao_avaliacao\) references avaliacoes_restricoes_revisoes\(tenant_id, avaliacao_id, numero\)/);
    // D4 (#531): avaliação obrigatória, restrição opcional com revisão; individual nunca renova a avaliação global
    expect(sql).toContain('avaliacao_id uuid not null');
    expect(sql).toContain('check ((restricao_id is null) = (revisao_restricao is null))');
    expect(sql).toContain('check (restricao_id is null or vence_em is null)');
    expect(sql).toContain('check (vence_em is null or vence_em > atestado_em)');
  });

  it('D7-a: solicitação guarda explicação ao paciente separada da justificativa interna e decisão exige explicação', () => {
    expect(sql).toMatch(/check \(estado not in \('atendida', 'parcial', 'recusada'\) or explicacao_paciente_criptografada is not null\)/);
    expect(sql).toMatch(/check \(\(estado in \('atendida', 'parcial', 'recusada'\)\) = \(desfecho_criptografado is not null\)\)/);
    expect(sql).toContain('desfecho_criptografado bytea check');
  });

  it('D1 (#531): os estados do banco são exatamente os do domínio, com parcial terminal e só a partir de em_analise', () => {
    const lista = ESTADOS_SOLICITACAO.map(e => `'${e}'`).join(', ');
    expect(sql).toContain(`estado varchar(24) not null default 'criada' check (estado in (${lista}))`);
    expect(sql).toContain(`if old.estado in (${ESTADOS_FINAIS_SOLICITACAO.map(e => `'${e}'`).join(', ')}) then`);
    expect(sql).toContain("('em_analise', 'parcial')");
    expect(sql).not.toMatch(/\('criada', 'parcial'\)/);
  });

  it('FKs compostas por tenant, nunca cascade', () => {
    expect(sql).toMatch(/foreign key \(tenant_id, paciente_id\) references pacientes\(tenant_id, id\) on delete restrict/);
    expect(sql).toMatch(/foreign key \(tenant_id, autor_usuario_id\) references usuarios\(tenant_id, id\) on delete restrict/);
    expect(sql).not.toMatch(/on delete cascade|on update cascade/);
  });
});

describe('1083 registro e rollback', () => {
  it('declara aplicação fora de banda e fica registrada uma vez, logo depois da 1082', () => {
    const fonte = readFileSync(join(__dirname, '1720000001083-RestricoesAlimentares.ts'), 'utf8');
    expect(fonte).toMatch(/@aplicacao fora-de-banda/);
    const o = criarOpcoesTypeOrm();
    expect(o.synchronize).toBe(false);
    const nomes = (o.migrations as Array<{ name: string }>).map(m => m.name);
    expect(nomes.filter(n => n === 'RestricoesAlimentares1720000001083')).toHaveLength(1);
    expect(nomes.indexOf('RestricoesAlimentares1720000001083')).toBe(nomes.indexOf('RegistrosFactuaisAppendOnly1720000001082') + 1);
    for (const e of [RestricaoPacienteOrm, RevisaoRestricaoPacienteOrm, AvaliacaoRestricoesPacienteOrm, RevisaoAvaliacaoRestricoesOrm,
      ReconfirmacaoRestricoesOrm, SolicitacaoRestricaoPacienteOrm, MapeamentoAlimentoAlvoLocalOrm]) {
      expect((o.entities as unknown[]).filter(x => x === e)).toHaveLength(1);
    }
  });

  it('down recusa quando existe qualquer linha, sem apagar nada', async () => {
    const query = jest.fn(async (s: string) => (/select\s+exists/i.test(s) ? [{ existe: true }] : []));
    await expect(new RestricoesAlimentares1720000001083().down({ query } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    const sql = query.mock.calls.map(c => c[0]).join('\n').toLowerCase();
    expect(sql).toMatch(/set local row_security = off/);
    expect(sql).not.toMatch(/drop |delete from|truncate /);
  });

  it('down com tabelas vazias remove só o que a 1083 criou', async () => {
    const sql = await sqlDe(q => new RestricoesAlimentares1720000001083().down(q), [[], [{ existe: false }]]);
    for (const t of TABELAS_RESTRICOES_ALIMENTARES) expect(sql).toContain(`drop table ${t}`);
    expect(sql).toContain('drop function rejeitar_mutacao_restricoes_alimentares()');
    expect(sql).not.toMatch(/drop table (pacientes|usuarios|tenants|registros_analises_factuais)|delete from|truncate /);
  });
});
