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
