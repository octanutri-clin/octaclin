import { CriptografiaDadosSensiveis } from './criptografia-dados-sensiveis';

describe('CriptografiaDadosSensiveis - indice cego', () => {
  const ambienteOriginal = process.env;

  beforeEach(() => {
    process.env = {
      ...ambienteOriginal,
      CRIPTOGRAFIA_CHAVE_AES_256: 'chave-fase-199-com-material-suficiente'
    };
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('normaliza acentos e gera hashes compativeis para prefixos pesquisaveis', () => {
    const criptografia = new CriptografiaDadosSensiveis();
    const indice = criptografia.gerarHashesBuscaPii('tenant-1', ['Ana Júlia', 'ana.julia@example.com']);
    const consulta = criptografia.gerarHashesConsultaPii('tenant-1', 'jul');

    expect(consulta).toHaveLength(1);
    expect(indice).toEqual(expect.arrayContaining(consulta));
    expect(JSON.stringify(indice)).not.toContain('ana');
    expect(JSON.stringify(indice)).not.toContain('julia');
  });

  it('isola o mesmo termo entre tenants', () => {
    const criptografia = new CriptografiaDadosSensiveis();

    expect(criptografia.gerarHashesConsultaPii('tenant-1', 'maria')).not.toEqual(
      criptografia.gerarHashesConsultaPii('tenant-2', 'maria')
    );
  });

  it('ignora termos menores que tres caracteres', () => {
    const criptografia = new CriptografiaDadosSensiveis();

    expect(criptografia.gerarHashesConsultaPii('tenant-1', 'de')).toEqual([]);
  });
});
