import {
  MODELOS_PADRAO,
  enderecoEmLinha,
  extrairVariaveis,
  paragrafosDocumento,
  renderizarDocumento,
  resolverModelo,
  validarModelo,
  variaveisDoTipo
} from './documentos-clinicos';

describe('documentos clinicos - modelos', () => {
  it('resolve o modelo padrao quando o tenant nao configurou nada', () => {
    const modelo = resolverModelo('declaracao_comparecimento');
    expect(modelo).toEqual(MODELOS_PADRAO.declaracao_comparecimento);
  });

  it('resolve o override do tenant por cima do padrao, campo a campo', () => {
    const modelo = resolverModelo('declaracao_comparecimento', { titulo: 'Comprovante de presenca' });
    expect(modelo.titulo).toBe('Comprovante de presenca');
    expect(modelo.corpo).toBe(MODELOS_PADRAO.declaracao_comparecimento.corpo);
  });

  it('ignora override em branco e volta ao padrao', () => {
    const modelo = resolverModelo('relatorio_alta', { titulo: '   ', corpo: '' });
    expect(modelo).toEqual(MODELOS_PADRAO.relatorio_alta);
  });

  it('todo modelo padrao so usa variaveis que o proprio tipo resolve', () => {
    for (const tipo of ['declaracao_comparecimento', 'relatorio_alta'] as const) {
      expect(validarModelo(tipo, MODELOS_PADRAO[tipo])).toEqual([]);
    }
  });
});

describe('documentos clinicos - validacao de modelo', () => {
  it('recusa variavel desconhecida em vez de renderizar buraco', () => {
    const erros = validarModelo('declaracao_comparecimento', {
      titulo: 'Declaracao',
      corpo: 'Paciente {{pacienteNome}} portador do CPF {{cpfPaciente}}.'
    });
    expect(erros).toContain('variavel_desconhecida:cpfPaciente');
  });

  it('recusa variavel de outro tipo de documento', () => {
    const erros = validarModelo('declaracao_comparecimento', {
      titulo: 'Declaracao',
      corpo: 'Metas: {{metasConcluidas}}.'
    });
    expect(erros).toContain('variavel_desconhecida:metasConcluidas');
  });

  it('recusa corpo acima do limite', () => {
    const erros = validarModelo('relatorio_alta', { titulo: 'Alta', corpo: 'x'.repeat(8001) });
    expect(erros).toContain('corpo_muito_longo');
  });

  it('aceita modelo valido sem erro', () => {
    const erros = validarModelo('relatorio_alta', {
      titulo: 'Alta de {{pacienteNome}}',
      corpo: '{{conteudo}}\n\n{{profissionalNome}}'
    });
    expect(erros).toEqual([]);
  });
});

describe('documentos clinicos - renderizacao', () => {
  it('substitui variaveis e reporta as que ficaram vazias', () => {
    const resultado = renderizarDocumento(
      { titulo: 'Declaracao', corpo: 'Paciente {{pacienteNome}}, registro {{profissionalRegistro}}.' },
      { pacienteNome: 'Ana Souza' }
    );
    expect(resultado.corpo).toBe('Paciente Ana Souza, registro .');
    expect(resultado.variaveisVazias).toEqual(['profissionalRegistro']);
  });

  it('trata valor em branco como ausente', () => {
    const resultado = renderizarDocumento(
      { titulo: 'T', corpo: '{{profissionalRegistro}}' },
      { profissionalRegistro: '   ' }
    );
    expect(resultado.variaveisVazias).toEqual(['profissionalRegistro']);
  });

  it('nao reexpande variavel vinda do valor: passada unica', () => {
    const resultado = renderizarDocumento(
      { titulo: 'T', corpo: 'Paciente {{pacienteNome}}.' },
      { pacienteNome: '{{profissionalRegistro}}', profissionalRegistro: 'CRN 1234' }
    );
    expect(resultado.corpo).toBe('Paciente {{profissionalRegistro}}.');
    expect(resultado.corpo).not.toContain('CRN 1234');
  });

  it('mantem texto do paciente literal, sem interpretar marcacao', () => {
    const resultado = renderizarDocumento(
      { titulo: 'T', corpo: '{{pacienteNome}}' },
      { pacienteNome: '<script>alert(1)</script>' }
    );
    expect(resultado.corpo).toBe('<script>alert(1)</script>');
  });

  it('extrai variaveis sem repetir', () => {
    expect(extrairVariaveis('{{a}} {{ a }} {{b}}')).toEqual(['a', 'b']);
  });
});

describe('documentos clinicos - apresentacao', () => {
  it('quebra o corpo em paragrafos por linha vazia', () => {
    expect(paragrafosDocumento('linha um\nlinha dois\n\n\nlinha tres\n')).toEqual([
      'linha um\nlinha dois',
      'linha tres'
    ]);
  });

  it('monta endereco pulando campo nao preenchido', () => {
    expect(enderecoEmLinha({ logradouro: 'Rua A', numero: '10', cidade: 'Recife', uf: 'PE' })).toBe(
      'Rua A, 10 - Recife/PE'
    );
    expect(enderecoEmLinha({})).toBe('');
  });

  it('lista as variaveis do tipo incluindo as comuns', () => {
    const variaveis = variaveisDoTipo('declaracao_comparecimento');
    expect(variaveis).toContain('pacienteNome');
    expect(variaveis).toContain('horaInicio');
    expect(variaveis).not.toContain('conteudo');
  });
});
