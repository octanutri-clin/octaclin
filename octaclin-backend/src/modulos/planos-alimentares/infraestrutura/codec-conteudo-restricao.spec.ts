import { randomUUID } from 'node:crypto';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { cifrarConteudoRestricao, decifrarConteudoRestricao, ConteudoRestricaoIlegivelError, type VinculoConteudoRestricao } from './codec-conteudo-restricao';
import { ConteudoRestricaoInvalidoError } from '../dominio/conteudo-restricao';

/** FOOD06 D2 (#531): único caminho de cifra/decifra do conteúdo clínico da restrição; falha fechada. */
const CANARIO = 'CANARIO_CODEC_NAO_VAZAR';
const cripto = new CriptografiaDadosSensiveis();
const conteudo = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alergeno', id: 'sintetico-1' }, observacao: CANARIO };
const vinculo = (extra: Partial<VinculoConteudoRestricao> = {}): VinculoConteudoRestricao =>
  ({ finalidade: 'restricao', tenantId: randomUUID(), pacienteId: randomUUID(), restricaoId: randomUUID(), revisao: 1, ...extra });

describe('FOOD06 D2: codec do conteúdo clínico', () => {
  it('cifra só conteúdo válido e decifra para o mesmo objeto quando o vínculo bate', () => {
    const v = vinculo();
    const b = cifrarConteudoRestricao(cripto, conteudo, v);
    expect(Buffer.isBuffer(b)).toBe(true);
    expect(b.toString('utf8')).not.toContain(CANARIO);
    expect(b.toString('latin1')).not.toMatch(/alergia|alergeno|clinica/);
    expect(decifrarConteudoRestricao(cripto, b, v)).toEqual(conteudo);
  });
  it('recusa cifrar conteúdo inválido ou vínculo malformado, sem gravar nada', () => {
    expect(() => cifrarConteudoRestricao(cripto, { ...conteudo, natureza: 'escolha' }, vinculo())).toThrow(ConteudoRestricaoInvalidoError);
    for (const ruim of [{ tenantId: 'x' }, { revisao: 0 }, { finalidade: 'outra' }, { pacienteId: '' }]) {
      expect(() => cifrarConteudoRestricao(cripto, conteudo, vinculo(ruim as never))).toThrow(ConteudoRestricaoIlegivelError);
    }
  });
  it('vínculo divergente (outro tenant, paciente, restrição, revisão ou finalidade) falha fechado, nunca vira ausência', () => {
    const v = vinculo(); const b = cifrarConteudoRestricao(cripto, conteudo, v);
    for (const outro of [{ tenantId: randomUUID() }, { pacienteId: randomUUID() }, { restricaoId: randomUUID() }, { revisao: 2 }, { finalidade: 'revisao_restricao' as const }]) {
      expect(() => decifrarConteudoRestricao(cripto, b, { ...v, ...outro })).toThrow(ConteudoRestricaoIlegivelError);
    }
  });
  it('bytes adulterados, cifra estranha ou JSON de outro formato falham com erro genérico, sem eco', () => {
    const v = vinculo(); const b = Buffer.from(cifrarConteudoRestricao(cripto, conteudo, v)); b[b.length - 1] ^= 1;
    const estranhos = [b, Buffer.alloc(40, 1), cripto.criptografar(JSON.stringify(conteudo)),
      cripto.criptografar(JSON.stringify({ formato: 'food06-restricao-conteudo', versao: 2, vinculo: v, conteudo })),
      cripto.criptografar(JSON.stringify({ formato: 'food06-restricao-conteudo', versao: 1, vinculo: v, conteudo: { ...conteudo, natureza: 'x' } })),
      cripto.criptografar(JSON.stringify({ formato: 'food06-restricao-conteudo', versao: 1, vinculo: v, conteudo, extra: 1 })),
      cripto.criptografar('nao-json')];
    for (const e of estranhos) {
      try { decifrarConteudoRestricao(cripto, e, v); fail('deveria falhar'); } catch (erro) {
        expect(erro).toBeInstanceOf(ConteudoRestricaoIlegivelError);
        expect(String((erro as Error).message)).not.toContain(CANARIO);
        expect(Object.keys(erro as object)).not.toContain('cause');
      }
    }
  });
});

/* ───────────── R3 (#531): o mesmo codec para TODOS os campos cifrados da 1083 ───────────── */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cifrarCampo, decifrarCampo, CAMPOS_CIFRADOS, type CampoCifrado, type VinculoCampo } from './codec-conteudo-restricao';

const AMOSTRAS: Record<CampoCifrado, unknown> = {
  'restricoes_pacientes.conteudo_criptografado': conteudo,
  'restricoes_pacientes_revisoes.conteudo_criptografado': conteudo,
  'restricoes_pacientes_revisoes.justificativa_criptografada': 'justificativa sintética ' + CANARIO,
  'reconfirmacoes_restricoes.resultado_criptografado': { resultado: 'sem_alteracao', observacao: 'nota ' + CANARIO },
  'solicitacoes_restricoes_pacientes.conteudo_criptografado': { itens: [{ item: 'item-1', texto: 'pedido ' + CANARIO }, { item: 'item-2', texto: 'outro' }] },
  'solicitacoes_restricoes_pacientes.explicacao_paciente_criptografada': 'explicação ao paciente ' + CANARIO,
  'solicitacoes_restricoes_pacientes.justificativa_interna_criptografada': 'interna ' + CANARIO,
  'solicitacoes_restricoes_pacientes.desfecho_criptografado': { estadoFinal: 'parcial', alterados: [{ item: 'item-1', restricaoId: 'r1', revisaoResultante: 2 }], inalterados: ['item-2'] },
  'mapeamentos_alimento_alvo_locais.evidencia_criptografada': 'referência documental ' + CANARIO,
  'mapeamentos_alimento_alvo_locais.justificativa_criptografada': 'justificativa ' + CANARIO
};
const CAMPOS = Object.keys(CAMPOS_CIFRADOS) as CampoCifrado[];
const vinc = (campo: CampoCifrado, extra: Partial<VinculoCampo> = {}): VinculoCampo => ({
  tenantId: randomUUID(), registroId: randomUUID(), revisao: CAMPOS_CIFRADOS[campo].revisaoFixa ?? 3,
  ...(CAMPOS_CIFRADOS[campo].comPaciente ? { pacienteId: randomUUID() } : {}), ...extra
});

describe('FOOD06 R3: vínculo contextual em todos os campos cifrados', () => {
  it('o registro cobre exatamente as colunas *_criptografad[oa] de cada tabela da 1083', () => {
    const sql = readFileSync(join(__dirname, '..', '..', '..', 'infraestrutura', 'banco-dados', 'migracoes', '1720000001083-RestricoesAlimentares.ts'), 'utf8');
    const encontrados: string[] = [];
    for (const m of sql.matchAll(/create table (\w+) \(([\s\S]*?)\n {6}\)`\);/g)) {
      for (const c of m[2].matchAll(/(?:CIFRADO\('|\b)(\w+_criptografad[oa])\b/g)) encontrados.push(`${m[1]}.${c[1]}`);
    }
    expect([...new Set(encontrados)].sort()).toEqual([...CAMPOS].sort());
    expect(CAMPOS).toHaveLength(10);
  });
  it.each(CAMPOS)('%s: ida e volta com o vínculo certo; o valor é validado e não aparece no bytea', campo => {
    const v = vinc(campo);
    const b = cifrarCampo(cripto, campo, AMOSTRAS[campo], v);
    expect(b.toString('latin1')).not.toContain(CANARIO);
    expect(decifrarCampo(cripto, campo, b, v)).toEqual(AMOSTRAS[campo]);
  });
  it.each(CAMPOS)('%s: outro registro, outro tenant, outro paciente, outra revisão ou outro campo falham fechados', campo => {
    const v = vinc(campo); const b = cifrarCampo(cripto, campo, AMOSTRAS[campo], v);
    const outros: VinculoCampo[] = [{ ...v, registroId: randomUUID() }, { ...v, tenantId: randomUUID() }, { ...v, revisao: v.revisao + 1 }];
    if (v.pacienteId) outros.push({ ...v, pacienteId: randomUUID() });
    for (const o of outros) expect(() => decifrarCampo(cripto, campo, b, o)).toThrow(ConteudoRestricaoIlegivelError);
    for (const outro of CAMPOS.filter(c => c !== campo && CAMPOS_CIFRADOS[c].comPaciente === CAMPOS_CIFRADOS[campo].comPaciente)) {
      const vo = { ...v, revisao: CAMPOS_CIFRADOS[outro].revisaoFixa ?? v.revisao };
      expect(() => decifrarCampo(cripto, outro, b, vo)).toThrow(ConteudoRestricaoIlegivelError);
    }
  });
  it('recusa valor inválido ao cifrar e vínculo incompatível com o campo', () => {
    const ruins: Array<[CampoCifrado, unknown]> = [
      ['restricoes_pacientes_revisoes.justificativa_criptografada', ''], ['restricoes_pacientes_revisoes.justificativa_criptografada', 'a\u0000'],
      ['restricoes_pacientes_revisoes.justificativa_criptografada', 'a'.repeat(4001)], ['reconfirmacoes_restricoes.resultado_criptografado', { resultado: 'ok' }],
      ['reconfirmacoes_restricoes.resultado_criptografado', { resultado: 'sem_alteracao', extra: 1 }],
      ['solicitacoes_restricoes_pacientes.conteudo_criptografado', { itens: [] }],
      ['solicitacoes_restricoes_pacientes.conteudo_criptografado', { itens: [{ item: 'a', texto: 'x' }, { item: 'a', texto: 'y' }] }],
      ['solicitacoes_restricoes_pacientes.desfecho_criptografado', { estadoFinal: 'parcial', alterados: [], inalterados: ['x'] }],
      ['mapeamentos_alimento_alvo_locais.evidencia_criptografada', 1]
    ];
    for (const [campo, valor] of ruins) expect(() => cifrarCampo(cripto, campo, valor, vinc(campo))).toThrow(ConteudoRestricaoInvalidoError);
    expect(() => cifrarCampo(cripto, 'mapeamentos_alimento_alvo_locais.evidencia_criptografada', 'x', { ...vinc('mapeamentos_alimento_alvo_locais.evidencia_criptografada'), pacienteId: randomUUID() }))
      .toThrow(ConteudoRestricaoIlegivelError);
    const semPaciente = vinc('reconfirmacoes_restricoes.resultado_criptografado'); delete semPaciente.pacienteId;
    expect(() => cifrarCampo(cripto, 'reconfirmacoes_restricoes.resultado_criptografado', AMOSTRAS['reconfirmacoes_restricoes.resultado_criptografado'], semPaciente))
      .toThrow(ConteudoRestricaoIlegivelError);
    expect(() => cifrarCampo(cripto, 'reconfirmacoes_restricoes.resultado_criptografado', AMOSTRAS['reconfirmacoes_restricoes.resultado_criptografado'],
      { ...vinc('reconfirmacoes_restricoes.resultado_criptografado'), revisao: 2 })).toThrow(ConteudoRestricaoIlegivelError);
    expect(() => cifrarCampo(cripto, 'tabela.inexistente' as CampoCifrado, 'x', vinc('mapeamentos_alimento_alvo_locais.evidencia_criptografada'))).toThrow(ConteudoRestricaoIlegivelError);
  });
  it('envelope de versão desconhecida, valor inválido dentro do envelope, cifra adulterada e não-JSON falham fechados, sem eco', () => {
    const campo: CampoCifrado = 'solicitacoes_restricoes_pacientes.explicacao_paciente_criptografada'; const v = vinc(campo);
    const env = (x: object) => cripto.criptografar(JSON.stringify({ formato: 'food06-restricoes-campo', versao: 1, campo, vinculo: v, valor: 'ok', ...x }));
    const b = Buffer.from(cifrarCampo(cripto, campo, 'texto ' + CANARIO, v)); b[b.length - 1] ^= 1;
    for (const e of [env({ versao: 2 }), env({ formato: 'outro' }), env({ valor: '' }), env({ extra: 1 }), b, cripto.criptografar('nao-json'), Buffer.alloc(48, 7)]) {
      try { decifrarCampo(cripto, campo, e, v); fail('deveria falhar'); } catch (erro) {
        expect(erro).toBeInstanceOf(ConteudoRestricaoIlegivelError); expect(String((erro as Error).message)).not.toContain(CANARIO);
      }
    }
  });
});
