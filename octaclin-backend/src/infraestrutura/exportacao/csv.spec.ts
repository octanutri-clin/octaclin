import { campoCsv, montarCsv } from './csv';

describe('campoCsv', () => {
  it('deixa passar valor simples sem aspas', () => {
    expect(campoCsv('Maria Souza')).toBe('Maria Souza');
  });

  it('trata ausencia como vazio', () => {
    expect(campoCsv(undefined)).toBe('');
    expect(campoCsv(null)).toBe('');
  });

  it('cita e escapa quando o valor tem separador, aspas ou quebra de linha', () => {
    expect(campoCsv('Souza, Maria')).toBe('"Souza, Maria"');
    expect(campoCsv('ela disse "oi"')).toBe('"ela disse ""oi"""');
    expect(campoCsv('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });

  it('cita valor com espaco nas bordas, que planilha silenciosamente apararia', () => {
    expect(campoCsv(' 42 ')).toBe('" 42 "');
  });

  describe('injecao de formula', () => {
    // Nome de paciente e observacao vem de input do usuario e vao parar numa
    // planilha. Sem isto, `=HYPERLINK(...)` num nome exfiltra dado da linha
    // inteira quando a clinica abre o arquivo exportado.
    it.each(['=cmd', '+1+1', '@SUM(A1)', '\tvalor', '\rvalor'])(
      'neutraliza %j com apostrofo',
      (entrada) => {
        expect(campoCsv(entrada).replace(/^"|"$/g, '').startsWith("'")).toBe(true);
      }
    );

    it('cita o campo neutralizado para o apostrofo nao virar dado solto', () => {
      expect(campoCsv('=1+1')).toBe(`"'=1+1"`);
    });

    it('nao estraga numero negativo, que comeca com hifen e nao e formula', () => {
      expect(campoCsv(-50)).toBe('-50');
      expect(campoCsv('-50')).toBe('-50');
      expect(campoCsv('-50.5')).toBe('-50.5');
    });

    it('neutraliza hifen quando nao e numero', () => {
      expect(campoCsv('-=1+1')).toBe(`"'-=1+1"`);
    });
  });
});

describe('montarCsv', () => {
  it('junta cabecalho e linhas com newline final', () => {
    const csv = montarCsv(['nome', 'idade'], [['Maria', 30], ['Joao', 41]]);

    expect(csv).toBe('nome,idade\nMaria,30\nJoao,41\n');
  });

  it('escapa cada celula, inclusive no cabecalho', () => {
    const csv = montarCsv(['nome, completo'], [['=1+1']]);

    expect(csv).toBe(`"nome, completo"\n"'=1+1"\n`);
  });

  it('produz so o cabecalho quando nao ha linhas', () => {
    expect(montarCsv(['nome'], [])).toBe('nome\n');
  });
});
