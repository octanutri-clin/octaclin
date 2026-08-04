import {
  calcularAntropometria,
  classificarCircunferenciaCintura,
  classificarImc,
  classificarRcq,
  compararAvaliacoes,
  dobrasExigidas,
  idadeNaData,
  protocoloExigeIdade
} from './antropometria';

describe('antropometria - IMC e RCQ', () => {
  it('deve calcular IMC e classificar pela tabela da OMS', () => {
    const resultado = calcularAntropometria({
      medidas: { pesoKg: 70, alturaCm: 175 },
      protocolo: 'nenhum',
      idadeAnos: 35
    });

    expect(resultado.imc).toBe(22.86);
    expect(resultado.classificacaoImc).toBe('eutrofia');
    expect(resultado.avisos).toEqual([]);
  });

  it('deve cobrir todas as faixas de classificacao de IMC do adulto', () => {
    expect(classificarImc(17, 35)).toBe('baixo_peso');
    expect(classificarImc(18.5, 35)).toBe('eutrofia');
    expect(classificarImc(24.99, 35)).toBe('eutrofia');
    expect(classificarImc(25, 35)).toBe('sobrepeso');
    expect(classificarImc(29.99, 35)).toBe('sobrepeso');
    expect(classificarImc(30, 35)).toBe('obesidade_grau_1');
    expect(classificarImc(35, 35)).toBe('obesidade_grau_2');
    expect(classificarImc(40, 35)).toBe('obesidade_grau_3');
  });

  it('deve usar os cortes de Lipschitz no idoso, como faz o SISVAN', () => {
    // IMC 21 e eutrofia no adulto e baixo peso no idoso; usar corte de adulto
    // em idoso esconde desnutricao.
    expect(classificarImc(21, 40)).toBe('eutrofia');
    expect(classificarImc(21, 70)).toBe('baixo_peso');
    expect(classificarImc(26, 70)).toBe('eutrofia');
    expect(classificarImc(28, 70)).toBe('sobrepeso');
  });

  it('nao deve classificar IMC de menor de 20 anos com corte de adulto', () => {
    expect(classificarImc(19, 15)).toBeUndefined();

    const resultado = calcularAntropometria({
      medidas: { pesoKg: 50, alturaCm: 160 },
      protocolo: 'nenhum',
      idadeAnos: 15
    });
    expect(resultado.imc).toBe(19.53);
    expect(resultado.classificacaoImc).toBeUndefined();
    expect(resultado.avisos).toContain('imc_sem_classificacao_menor_de_20_exige_escore_z');
  });

  it('deve classificar pelo valor bruto, nao pelo arredondado', () => {
    // 24,996 arredonda para 25,00 mas ainda e eutrofia pelo corte da OMS.
    const resultado = calcularAntropometria({
      medidas: { pesoKg: 63.99, alturaCm: 160 },
      protocolo: 'nenhum',
      idadeAnos: 35
    });

    expect(resultado.imc).toBe(25);
    expect(resultado.classificacaoImc).toBe('eutrofia');
  });

  it('deve calcular RCQ e classificar risco pelos limites da OMS por sexo', () => {
    const homem = calcularAntropometria({
      medidas: { circunferencias: { cintura: 90, quadril: 100 } },
      protocolo: 'nenhum',
      sexo: 'masculino'
    });
    expect(homem.rcq).toBe(0.9);
    expect(homem.classificacaoRcq).toBe('elevado');

    const mulher = calcularAntropometria({
      medidas: { circunferencias: { cintura: 85, quadril: 100 } },
      protocolo: 'nenhum',
      sexo: 'feminino'
    });
    expect(mulher.rcq).toBe(0.85);
    expect(mulher.classificacaoRcq).toBe('elevado');
  });

  it('o mesmo RCQ classifica diferente conforme o sexo', () => {
    expect(classificarRcq(0.87, 'masculino')).toBe('abaixo_do_corte');
    expect(classificarRcq(0.87, 'feminino')).toBe('elevado');
  });

  it('nao deve elevar a classificacao de RCQ por causa do arredondamento', () => {
    // 0,895 arredonda para 0,90 mas esta abaixo do corte da OMS.
    const resultado = calcularAntropometria({
      medidas: { circunferencias: { cintura: 89.5, quadril: 100 } },
      protocolo: 'nenhum',
      sexo: 'masculino'
    });

    expect(resultado.rcq).toBe(0.9);
    expect(resultado.classificacaoRcq).toBe('abaixo_do_corte');
  });

  it('deve classificar a circunferencia da cintura isolada pelos cortes da OMS', () => {
    expect(classificarCircunferenciaCintura(93, 'masculino')).toBe('baixo');
    expect(classificarCircunferenciaCintura(94, 'masculino')).toBe('aumentado');
    expect(classificarCircunferenciaCintura(102, 'masculino')).toBe('muito_aumentado');
    expect(classificarCircunferenciaCintura(79, 'feminino')).toBe('baixo');
    expect(classificarCircunferenciaCintura(80, 'feminino')).toBe('aumentado');
    expect(classificarCircunferenciaCintura(88, 'feminino')).toBe('muito_aumentado');
  });

  it('deve recusar par peso/altura impossivel mesmo com cada valor isolado plausivel', () => {
    const resultado = calcularAntropometria({
      medidas: { pesoKg: 500, alturaCm: 30 },
      protocolo: 'nenhum'
    });

    expect(resultado.imc).toBeUndefined();
    expect(resultado.avisos).toContain('imc_fora_da_faixa_plausivel');
  });

  it('deve calcular RCQ sem sexo, mas avisar que ficou sem classificacao', () => {
    const resultado = calcularAntropometria({
      medidas: { circunferencias: { cintura: 90, quadril: 100 } },
      protocolo: 'nenhum'
    });

    expect(resultado.rcq).toBe(0.9);
    expect(resultado.classificacaoRcq).toBeUndefined();
    expect(resultado.avisos).toContain('rcq_sem_classificacao_sexo_ausente');
  });

  it('deve recusar peso e altura fora da faixa de plausibilidade', () => {
    const resultado = calcularAntropometria({
      medidas: { pesoKg: 700, alturaCm: 17 },
      protocolo: 'nenhum'
    });

    expect(resultado.imc).toBeUndefined();
    expect(resultado.avisos).toEqual(expect.arrayContaining(['peso_fora_da_faixa', 'altura_fora_da_faixa']));
  });
});

describe('antropometria - protocolos de composicao corporal', () => {
  // Valores de referencia conferidos fora da implementacao, a partir das equacoes
  // publicadas de cada autor somadas a conversao de Siri (1961).

  it('Pollock 3 dobras masculino (Jackson & Pollock 1978)', () => {
    const resultado = calcularAntropometria({
      medidas: { pesoKg: 80, alturaCm: 180, dobras: { peitoral: 10, abdominal: 20, coxa: 15 } },
      protocolo: 'pollock_3',
      sexo: 'masculino',
      idadeAnos: 30
    });

    expect(resultado.percentualGordura).toBe(13.61);
    expect(resultado.protocoloAplicado).toBe('pollock_3');
    expect(resultado.formulaAplicada).toContain('Jackson & Pollock 1978');
    expect(resultado.massaGordaKg).toBe(10.89);
    expect(resultado.massaMagraKg).toBe(69.11);
  });

  it('Pollock 3 dobras feminino (Jackson, Pollock & Ward 1980)', () => {
    const resultado = calcularAntropometria({
      medidas: { dobras: { triceps: 18, suprailiaca: 14, coxa: 22 } },
      protocolo: 'pollock_3',
      sexo: 'feminino',
      idadeAnos: 25
    });

    expect(resultado.percentualGordura).toBe(21.83);
    expect(resultado.formulaAplicada).toContain('Jackson, Pollock & Ward 1980');
  });

  it('Pollock 7 dobras masculino e feminino', () => {
    const homem = calcularAntropometria({
      medidas: {
        dobras: {
          peitoral: 10,
          axilarMedia: 12,
          triceps: 14,
          subescapular: 16,
          abdominal: 18,
          suprailiaca: 15,
          coxa: 15
        }
      },
      protocolo: 'pollock_7',
      sexo: 'masculino',
      idadeAnos: 30
    });
    expect(homem.percentualGordura).toBe(14.63);

    const mulher = calcularAntropometria({
      medidas: {
        dobras: {
          peitoral: 12,
          axilarMedia: 14,
          triceps: 20,
          subescapular: 18,
          abdominal: 20,
          suprailiaca: 16,
          coxa: 20
        }
      },
      protocolo: 'pollock_7',
      sexo: 'feminino',
      idadeAnos: 25
    });
    expect(mulher.percentualGordura).toBe(23.46);
  });

  it('Faulkner 1968 usa a mesma equacao para os dois sexos', () => {
    const dobras = { triceps: 15, subescapular: 15, suprailiaca: 15, abdominal: 15 };

    const homem = calcularAntropometria({ medidas: { dobras }, protocolo: 'faulkner', sexo: 'masculino' });
    const mulher = calcularAntropometria({ medidas: { dobras }, protocolo: 'faulkner', sexo: 'feminino' });

    expect(homem.percentualGordura).toBe(14.96);
    expect(mulher.percentualGordura).toBe(14.96);
    expect(homem.formulaAplicada).toContain('Faulkner 1968 (4 dobras): %G = S*0,153 + 5,783');
  });

  it('Guedes 1985 usa sitios diferentes por sexo', () => {
    expect(dobrasExigidas('guedes', 'masculino')).toEqual(['triceps', 'suprailiaca', 'abdominal']);
    expect(dobrasExigidas('guedes', 'feminino')).toEqual(['coxa', 'suprailiaca', 'subescapular']);

    const homem = calcularAntropometria({
      medidas: { dobras: { triceps: 12, suprailiaca: 16, abdominal: 22 } },
      protocolo: 'guedes',
      sexo: 'masculino'
    });
    expect(homem.percentualGordura).toBe(18.12);

    const mulher = calcularAntropometria({
      medidas: { dobras: { coxa: 25, suprailiaca: 18, subescapular: 15 } },
      protocolo: 'guedes',
      sexo: 'feminino'
    });
    expect(mulher.percentualGordura).toBe(25.07);
  });

  it('so Pollock depende de idade', () => {
    expect(protocoloExigeIdade('pollock_3')).toBe(true);
    expect(protocoloExigeIdade('pollock_7')).toBe(true);
    expect(protocoloExigeIdade('faulkner')).toBe(false);
    expect(protocoloExigeIdade('guedes')).toBe(false);
  });
});

describe('antropometria - recusa de calculo', () => {
  it('nao deve calcular composicao sem sexo informado', () => {
    const resultado = calcularAntropometria({
      medidas: { dobras: { peitoral: 10, abdominal: 20, coxa: 15 } },
      protocolo: 'pollock_3',
      idadeAnos: 30
    });

    expect(resultado.percentualGordura).toBeUndefined();
    expect(resultado.protocoloAplicado).toBe('nenhum');
    expect(resultado.avisos).toContain('protocolo_exige_sexo');
  });

  it('nao deve calcular Pollock sem idade', () => {
    const resultado = calcularAntropometria({
      medidas: { dobras: { peitoral: 10, abdominal: 20, coxa: 15 } },
      protocolo: 'pollock_3',
      sexo: 'masculino'
    });

    expect(resultado.percentualGordura).toBeUndefined();
    expect(resultado.avisos).toContain('protocolo_exige_idade');
  });

  it('deve dizer QUAL dobra faltou ou saiu da faixa', () => {
    const faltando = calcularAntropometria({
      medidas: { dobras: { peitoral: 10, abdominal: 20 } },
      protocolo: 'pollock_3',
      sexo: 'masculino',
      idadeAnos: 30
    });
    expect(faltando.avisos).toContain('dobra_ausente:coxa');

    const foraDaFaixa = calcularAntropometria({
      medidas: { dobras: { peitoral: 10, abdominal: 20, coxa: 95 } },
      protocolo: 'pollock_3',
      sexo: 'masculino',
      idadeAnos: 30
    });
    expect(foraDaFaixa.percentualGordura).toBeUndefined();
    expect(foraDaFaixa.avisos).toContain('dobra_fora_da_faixa:coxa');
  });

  it('nao deve calcular Pollock acima da faixa de validacao, onde a equacao inverte', () => {
    // A equacao e quadratica com vertice em ~258mm (Sigma3 masculino): acima dele
    // mais gordura medida devolveria MENOS percentual. Recusar e obrigatorio.
    const resultado = calcularAntropometria({
      medidas: { dobras: { peitoral: 60, abdominal: 60, coxa: 60 } },
      protocolo: 'pollock_3',
      sexo: 'masculino',
      idadeAnos: 40
    });

    expect(resultado.percentualGordura).toBeUndefined();
    expect(resultado.protocoloAplicado).toBe('nenhum');
    expect(resultado.avisos).toContain('soma_dobras_fora_da_faixa_de_validacao');
  });

  it('deve avisar quando a idade cai fora da amostra de validacao da equacao', () => {
    const idoso = calcularAntropometria({
      medidas: { dobras: { peitoral: 10, abdominal: 20, coxa: 15 } },
      protocolo: 'pollock_3',
      sexo: 'masculino',
      idadeAnos: 72
    });
    expect(idoso.percentualGordura).toBe(18.36);
    expect(idoso.avisos).toContain('idade_fora_da_faixa_de_validacao_da_equacao');

    const crianca = calcularAntropometria({
      medidas: { dobras: { triceps: 15, subescapular: 15, suprailiaca: 15, abdominal: 15 } },
      protocolo: 'faulkner',
      sexo: 'masculino',
      idadeAnos: 10
    });
    expect(crianca.avisos).toContain('equacao_de_adulto_aplicada_a_menor_de_idade');
  });

  it('deve gravar padronizacao de sitios e faixa de validacao junto da formula', () => {
    const resultado = calcularAntropometria({
      medidas: { dobras: { triceps: 12, suprailiaca: 16, abdominal: 22 } },
      protocolo: 'guedes',
      sexo: 'masculino',
      idadeAnos: 25
    });

    expect(resultado.formulaAplicada).toContain('Guedes 1985');
    expect(resultado.formulaAplicada).toContain('padronizacao brasileira');
    expect(resultado.formulaAplicada).toContain('amostra de validacao 18-30 anos');
  });

  it('deve avisar percentual abaixo da gordura essencial em vez de aceitar em silencio', () => {
    const resultado = calcularAntropometria({
      medidas: { dobras: { coxa: 5, suprailiaca: 4, subescapular: 3 } },
      protocolo: 'guedes',
      sexo: 'feminino'
    });

    expect(resultado.percentualGordura).toBeDefined();
    expect(resultado.avisos).toContain('percentual_gordura_abaixo_da_gordura_essencial');
  });

  it('nao deve gravar percentual negativo produzido por dobras minimas', () => {
    // Dobras de 2 mm levam a densidade alta e Siri devolve percentual negativo.
    // Numero impossivel nao entra no historico clinico.
    const resultado = calcularAntropometria({
      medidas: { dobras: { triceps: 2, suprailiaca: 2, abdominal: 2 } },
      protocolo: 'guedes',
      sexo: 'masculino'
    });

    expect(resultado.percentualGordura).toBeUndefined();
    expect(resultado.protocoloAplicado).toBe('nenhum');
    expect(resultado.avisos).toContain('percentual_gordura_implausivel');
  });

  it('deve deixar passar valor extremo porem possivel, sem substituir o julgamento clinico', () => {
    // Obesidade grave chega a percentuais muito altos. A trava e para o impossivel,
    // nao para o incomum: censurar aqui esconderia o caso real de quem avalia.
    // Faulkner e linear, entao nao inverte como Pollock.
    const resultado = calcularAntropometria({
      medidas: { dobras: { triceps: 80, subescapular: 80, suprailiaca: 80, abdominal: 80 } },
      protocolo: 'faulkner',
      sexo: 'masculino',
      idadeAnos: 45
    });

    expect(resultado.percentualGordura).toBe(54.74);
  });

  it('deve calcular percentual sem peso, mas sem inventar massa gorda', () => {
    const resultado = calcularAntropometria({
      medidas: { dobras: { triceps: 15, subescapular: 15, suprailiaca: 15, abdominal: 15 } },
      protocolo: 'faulkner',
      sexo: 'masculino'
    });

    expect(resultado.percentualGordura).toBe(14.96);
    expect(resultado.massaGordaKg).toBeUndefined();
    expect(resultado.massaMagraKg).toBeUndefined();
    expect(resultado.avisos).toContain('massa_sem_peso_valido');
  });
});

describe('antropometria - comparacao entre avaliacoes', () => {
  it('deve produzir delta correto entre duas avaliacoes', () => {
    const deltas = compararAvaliacoes(
      { pesoKg: 82.4, imc: 26.9, percentualGordura: 24.5 },
      { pesoKg: 78.1, imc: 25.5, percentualGordura: 21.2 }
    );

    expect(deltas).toEqual([
      { campo: 'pesoKg', anterior: 82.4, atual: 78.1, variacao: -4.3 },
      { campo: 'imc', anterior: 26.9, atual: 25.5, variacao: -1.4 },
      { campo: 'percentualGordura', anterior: 24.5, atual: 21.2, variacao: -3.3 }
    ]);
  });

  it('nao deve inventar variacao quando o campo so existe em uma das avaliacoes', () => {
    const deltas = compararAvaliacoes({ pesoKg: 80 }, { pesoKg: 78, percentualGordura: 20 });

    expect(deltas).toEqual([{ campo: 'pesoKg', anterior: 80, atual: 78, variacao: -2 }]);
  });
});

describe('antropometria - idade na data da avaliacao', () => {
  it('deve usar anos completos na data da avaliacao, nao a idade de hoje', () => {
    expect(idadeNaData('1990-06-15', new Date('2026-06-14T12:00:00.000Z'))).toBe(35);
    expect(idadeNaData('1990-06-15', new Date('2026-06-15T12:00:00.000Z'))).toBe(36);
  });

  it('deve devolver undefined para nascimento ausente ou invalido', () => {
    expect(idadeNaData(undefined, new Date())).toBeUndefined();
    expect(idadeNaData('nao-e-data', new Date())).toBeUndefined();
  });
});
