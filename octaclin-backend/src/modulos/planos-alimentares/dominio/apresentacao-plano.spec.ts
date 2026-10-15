import { validarPreferenciasApresentacao, projetarRefeicoesPaciente, lerApresentacaoVersao, projetarMetasPaciente } from './apresentacao-plano';

const conjunto = () => ({ horario: true, macros: true, medidasCaseiras: true, orientacoes: true, substituicoesExpandidas: true, modoCompacto: false });
const preferencias = () => ({ schemaVersao: 1, profissional: conjunto(), paciente: conjunto() });

describe('PA05 — contrato de apresentação', () => {
  it('reconhece somente ausência como legado e conserva flags falsas', () => {
    expect(validarPreferenciasApresentacao(undefined)).toBeUndefined();
    const entrada = preferencias();
    entrada.paciente.macros = false;
    expect(validarPreferenciasApresentacao(entrada)).toEqual(entrada);
    expect(validarPreferenciasApresentacao(entrada)).not.toBe(entrada);
  });
  it.each([null, [], {}, { ...preferencias(), schemaVersao: 2 }, { ...preferencias(), segredo: 'sintetico' }, { ...preferencias(), paciente: { ...conjunto(), horario: 'false' } }, { ...preferencias(), paciente: { ...conjunto(), extra: true } }, { ...preferencias(), profissional: undefined }])('recusa formato inválido/corrompido, sem defaults silenciosos (%#)', (valor) => {
    expect(() => validarPreferenciasApresentacao(valor)).toThrow('Preferências de apresentação inválidas.');
  });
});

describe('PA05 — projeção paciente explícita', () => {
  it('remove flags privadas, campos extras e alternativas não liberadas sem alterar porções', () => {
    const entrada = [{ id: 'refeicao-sintetica', nome: 'Almoço', horarioLocal: '12:00', orientacoes: 'Texto sintético', segredo: 'privado', itens: [{ id: 'item-sintetico', descricao: 'Arroz', quantidade: 2, unidade: 'colher', porcaoGramas: 80, nutrientes: { energiaKcal: 100, proteinasG: 0, metadados: 'privado' }, composicaoSnapshotCriptografada: 'privado', substituicoesVisiveisInicialmente: 1, substituicoes: [
      { id: 'negada', descricao: 'Privada', liberadaParaPaciente: false },
      { id: 'omitida', descricao: 'Sem liberação' },
      { id: 'normal', descricao: 'Alternativa', liberadaParaPaciente: true, preferida: false, quantidade: 1, unidade: 'colher', porcaoGramas: 30, nutrientes: { energiaKcal: 50 } },
      { id: 'preferida', descricao: 'Preferida', liberadaParaPaciente: true, preferida: true, quantidade: 1, unidade: 'unidade', porcaoGramas: 20, nutrientes: { energiaKcal: 20 } }
    ] }] }];
    const copia = structuredClone(entrada);
    const saida = projetarRefeicoesPaciente(entrada as never);
    expect(saida[0].itens[0].substituicoes.map(x => x.id)).toEqual(['preferida', 'normal']);
    expect(saida[0].itens[0].porcaoGramas).toBe(80);
    expect(saida[0].itens[0].nutrientes).toEqual({ energiaKcal: 100, proteinasG: 0 });
    expect(Object.keys(saida[0])).toEqual(['id', 'nome', 'horarioLocal', 'orientacoes', 'itens']);
    expect(saida[0].itens[0]).not.toHaveProperty('composicaoSnapshotCriptografada');
    expect(saida[0].itens[0].substituicoes[0]).not.toHaveProperty('liberadaParaPaciente');
    expect(entrada).toEqual(copia);
  });
  it('retira escolha não liberada e nutrientes inválidos, preservando ausência', () => {
    const saida = projetarRefeicoesPaciente([{ id: 'r', nome: 'R', itens: [{ id: 'i', descricao: 'I', quantidade: 1, unidade: 'g', porcaoGramas: 1, nutrientes: { energiaKcal: NaN, proteinasG: -1, carboidratosG: 0 }, escolhaAtualSubstituicaoId: 'negada', substituicoes: [] }] }]);
    expect(saida[0].itens[0].nutrientes).toEqual({ carboidratosG: 0 });
    expect(saida[0].itens[0]).not.toHaveProperty('escolhaAtualSubstituicaoId');
  });
});

describe('PA05 — leitura de snapshot e metas autorizadas', () => {
  it('ausência em revisão zero é legado; cipher ausente com revisão positiva é corrupção', () => {
    expect(lerApresentacaoVersao(null, 0, () => '')).toEqual({ apresentacaoEstado: 'legado', apresentacaoRevisao: 0 });
    expect(lerApresentacaoVersao(null, 1, () => '')).toEqual({ apresentacaoEstado: 'indisponivel', apresentacaoRevisao: 1 });
    expect(lerApresentacaoVersao(Buffer.from('sintetico'), 1, () => { throw new Error('erro interno'); })).toEqual({ apresentacaoEstado: 'indisponivel', apresentacaoRevisao: 1 });
  });
  it('metas são números finitos sem campos de cálculo interno ou zeros artificiais', () => {
    expect(projetarMetasPaciente({ metaEnergeticaKcal: 0, metasMacronutrientes: { proteinasG: NaN, carboidratosG: 0, gordurasG: -1 }, segredo: 'privado' })).toEqual({ metaEnergeticaKcal: 0, macros: { carboidratosG: 0 } });
    expect(projetarMetasPaciente(undefined)).toEqual({});
  });
});
