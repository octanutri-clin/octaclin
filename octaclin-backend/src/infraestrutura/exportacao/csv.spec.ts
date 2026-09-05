import { analisarCsv, campoCsv, contarLinhasCsv, montarCsv } from './csv';

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

describe('analisarCsv', () => {
  it('le cabecalho e linhas de um arquivo limpo', () => {
    const resultado = analisarCsv('nome,contato\nMaria,maria@octaclin.test\nJoao,11988887777\n');

    expect(resultado.cabecalho).toEqual(['nome', 'contato']);
    expect(resultado.linhas).toEqual([
      { numero: 2, campos: ['Maria', 'maria@octaclin.test'] },
      { numero: 3, campos: ['Joao', '11988887777'] }
    ]);
  });

  it('ignora BOM que o Excel grava no inicio do arquivo', () => {
    expect(analisarCsv('﻿nome\nMaria\n').cabecalho).toEqual(['nome']);
  });

  it('aceita CRLF do Windows', () => {
    expect(analisarCsv('nome\r\nMaria\r\n').linhas).toEqual([{ numero: 2, campos: ['Maria'] }]);
  });

  it('detecta ponto e virgula, que e o separador do Excel em pt-BR', () => {
    const resultado = analisarCsv('nome;contato\nMaria;11988887777\n');

    expect(resultado.cabecalho).toEqual(['nome', 'contato']);
    expect(resultado.linhas[0].campos).toEqual(['Maria', '11988887777']);
  });

  it('detecta tabulacao de planilha colada como texto', () => {
    expect(analisarCsv('nome\tcontato\nMaria\t11988887777').cabecalho).toEqual(['nome', 'contato']);
  });

  it('respeita campo citado com separador, aspas e quebra de linha dentro', () => {
    const resultado = analisarCsv('nome,obs\n"Souza, Maria","disse ""oi""\nna consulta"\n');

    expect(resultado.linhas[0].campos).toEqual(['Souza, Maria', 'disse "oi"\nna consulta']);
  });

  it('conta o numero da linha do arquivo mesmo com campo multilinha', () => {
    const resultado = analisarCsv('nome,obs\n"Maria","a\nb"\nJoao,c\n');

    expect(resultado.linhas.map((linha) => linha.numero)).toEqual([2, 4]);
  });

  it('descarta linhas em branco no meio e no fim, que planilha exporta as centenas', () => {
    const resultado = analisarCsv('nome\nMaria\n\n   \nJoao\n\n\n');

    expect(resultado.linhas.map((linha) => linha.campos[0])).toEqual(['Maria', 'Joao']);
  });

  it('apara espaco em volta do campo nao citado', () => {
    expect(analisarCsv('nome , contato\n Maria , 11988887777 ').cabecalho).toEqual(['nome', 'contato']);
    expect(analisarCsv('nome, contato\n Maria , 11988887777 ').linhas[0].campos).toEqual([
      'Maria',
      '11988887777'
    ]);
  });

  it('preserva espaco dentro de campo citado', () => {
    expect(analisarCsv('nome\n" Maria "').linhas[0].campos).toEqual([' Maria ']);
  });

  it('normaliza cabecalho para minusculo sem acento, para casar "Nome" e "nome"', () => {
    expect(analisarCsv('Nome;Data de Nascimento\nMaria;2000-01-01').cabecalho).toEqual([
      'nome',
      'data de nascimento'
    ]);
  });

  it('devolve vazio para conteudo sem nada util', () => {
    expect(analisarCsv('   \n\n')).toEqual({ cabecalho: [], linhas: [] });
  });

  it('mantem linha com contagem de colunas diferente, para o validador acusar', () => {
    const resultado = analisarCsv('nome,contato\nMaria\nJoao,x,y');

    expect(resultado.linhas[0].campos).toEqual(['Maria']);
    expect(resultado.linhas[1].campos).toEqual(['Joao', 'x', 'y']);
  });
});

describe('contarLinhasCsv', () => {
  it('conta registros de dado e ignora o cabecalho', () => {
    expect(contarLinhasCsv(montarCsv(['a', 'b'], [[1, 2], [3, 4], [5, 6]]))).toBe(3);
  });

  it('devolve zero para exportacao vazia ou so com cabecalho', () => {
    expect(contarLinhasCsv('')).toBe(0);
    expect(contarLinhasCsv(montarCsv(['a', 'b'], []))).toBe(0);
  });

  it('nao infla a contagem com quebra de linha dentro de celula citada', () => {
    const csv = montarCsv(['observacao'], [['linha um\nlinha dois\nlinha tres'], ['simples']]);

    expect(contarLinhasCsv(csv)).toBe(2);
  });

  it('trata aspas escapada dentro do campo sem desalinhar a contagem', () => {
    const csv = montarCsv(['observacao'], [['ele disse "sim"\ne saiu'], ['outra']]);

    expect(contarLinhasCsv(csv)).toBe(2);
  });

  // Os call sites atuais so passam saida de `montarCsv`, que sempre fecha com
  // `\n`. A invariante nao e checada na fronteira, e o repositorio ja usa
  // `csv.trim().split('\n')` em outros pontos -- entao a contagem nao pode
  // depender daquela quebra final.
  it('conta o ultimo registro de um CSV que termina sem quebra de linha', () => {
    expect(contarLinhasCsv('nome,idade\nMaria,30')).toBe(1);
  });

  it('conta certo um CSV trimado, que perde a quebra final', () => {
    const csv = montarCsv(['nome', 'idade'], [['Maria', 30], ['Joao', 41]]);

    expect(contarLinhasCsv(csv.trim())).toBe(2);
  });

  it('nao conta o cabecalho sozinho como registro, com ou sem quebra final', () => {
    expect(contarLinhasCsv('nome,idade')).toBe(0);
    expect(contarLinhasCsv('nome,idade\n')).toBe(0);
  });

  // Aspas desbalanceada e bug do produtor. A escolha e contar o melhor possivel
  // em vez de lancar: quem chama e a auditoria de uma exportacao ja produzida, e
  // derrubar a exportacao para registra-la inverteria a prioridade. O que nao
  // pode acontecer e devolver zero e fazer um volume real parecer nulo.
  it('cai para a contagem de linhas fisicas quando a aspas nunca fecha', () => {
    expect(contarLinhasCsv('"observacao\nMaria\nJoao\nAna\n')).toBe(3);
    expect(contarLinhasCsv('observacao\nMaria\nJoao"')).toBe(2);
  });
});
