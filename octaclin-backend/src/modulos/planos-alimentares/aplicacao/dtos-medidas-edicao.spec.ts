import { validarDocumentoEdicaoPlano } from '../dominio/edicao-plano';
const uuid = '10000000-0000-4000-8000-000000000001';
const referencia = () => ({ id: uuid, revisao: 1, aplicacaoId: uuid });
const doc = (ref: any) => ({ schemaVersao: 1, refeicoes: [{ chaveCliente: 'r', itens: [{ chaveCliente: 'i', alimentoComposicaoId: uuid, medidaCaseira: ref }] }] });
describe('FOOD01 contrato editorial de intenção de medida', () => {
    it('aceita referência mínima sem aceitar equivalência alegada pelo cliente', () => {
        expect(validarDocumentoEdicaoPlano(doc(referencia())).refeicoes[0].itens[0]).toHaveProperty('medidaCaseira', referencia());
    });
    it('aceita null como desvinculação explícita, distinta de omissão legada', () => expect(validarDocumentoEdicaoPlano(doc(null)).refeicoes[0].itens[0]).toHaveProperty('medidaCaseira', null));
    it.each([{}, { ...referencia(), id: 'x' }, { ...referencia(), revisao: 0 }, { ...referencia(), revisao: 1.5 }, { ...referencia(), aplicacaoId: 'x' }, { ...referencia(), pesoReferenciaGramas: 25 }])('rejeita referência inválida %#', ref => expect(() => validarDocumentoEdicaoPlano(doc(ref))).toThrow());
});
