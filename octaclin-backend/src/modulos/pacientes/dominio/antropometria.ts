/**
 * Calculo antropometrico. Formula errada aqui e erro clinico, nao bug: cada
 * protocolo traz a referencia publicada no comentario, e o texto da formula
 * aplicada e devolvido para ser gravado junto do registro (historico imutavel).
 *
 * Sexo e idade sao entrada do calculo, nao do cadastro: as equacoes de dobras
 * dependem dos dois, e a avaliacao precisa continuar reproduzivel mesmo que o
 * cadastro do paciente mude depois.
 */

export type SexoBiologico = 'masculino' | 'feminino';

export type ProtocoloComposicao = 'nenhum' | 'pollock_3' | 'pollock_7' | 'faulkner' | 'guedes';

export const PROTOCOLOS_COMPOSICAO: ProtocoloComposicao[] = [
  'nenhum',
  'pollock_3',
  'pollock_7',
  'faulkner',
  'guedes'
];

export type SitioDobra =
  | 'peitoral'
  | 'axilarMedia'
  | 'triceps'
  | 'subescapular'
  | 'abdominal'
  | 'suprailiaca'
  | 'coxa'
  | 'panturrilha';

export type SitioCircunferencia = 'cintura' | 'quadril' | 'abdomen' | 'braco' | 'coxa' | 'panturrilha';

/** Dobras em milimetros. */
export type DobrasCutaneas = Partial<Record<SitioDobra, number>>;
/** Circunferencias em centimetros. */
export type Circunferencias = Partial<Record<SitioCircunferencia, number>>;

export interface MedidasAntropometricas {
  pesoKg?: number;
  alturaCm?: number;
  circunferencias?: Circunferencias;
  dobras?: DobrasCutaneas;
}

export interface EntradaCalculoAntropometrico {
  medidas: MedidasAntropometricas;
  protocolo: ProtocoloComposicao;
  sexo?: SexoBiologico;
  idadeAnos?: number;
}

export type ClassificacaoImc =
  | 'baixo_peso'
  | 'eutrofia'
  | 'sobrepeso'
  | 'obesidade_grau_1'
  | 'obesidade_grau_2'
  | 'obesidade_grau_3';

/**
 * Binaria de proposito. A OMS 2008 define um unico ponto de corte; faixa
 * "moderada" nao existe nessa fonte. Tabela com tres faixas (Bray & Gray 1988)
 * e estratificada por idade — se o produto pedir tres faixas, e essa a fonte a
 * implementar, com a estratificacao junto.
 */
export type ClassificacaoRcq = 'abaixo_do_corte' | 'elevado';

export type ClassificacaoCircunferenciaCintura = 'baixo' | 'aumentado' | 'muito_aumentado';

export interface ResultadoAntropometrico {
  imc?: number;
  classificacaoImc?: ClassificacaoImc;
  rcq?: number;
  classificacaoRcq?: ClassificacaoRcq;
  circunferenciaCinturaCm?: number;
  classificacaoCircunferenciaCintura?: ClassificacaoCircunferenciaCintura;
  percentualGordura?: number;
  massaGordaKg?: number;
  massaMagraKg?: number;
  protocoloAplicado: ProtocoloComposicao;
  /** Texto da equacao usada, gravado no registro para auditoria clinica. */
  formulaAplicada?: string;
  /** Por que um calculo nao saiu. Nunca silencioso: quem avalia precisa saber. */
  avisos: string[];
}

// Faixas de plausibilidade. Fora delas e erro de digitacao, nao paciente atipico:
// rejeitar e melhor que gravar IMC de 900 no historico clinico.
const LIMITES = {
  pesoKg: { minimo: 1, maximo: 500 },
  alturaCm: { minimo: 30, maximo: 250 },
  // Nenhum adipometro em uso clinico passa de ~85mm (Lange ~65, Harpenden ~80,
  // Cescorf ~85). Acima disso o valor nao foi medido, foi digitado errado.
  dobraMm: { minimo: 2, maximo: 80 },
  circunferenciaCm: { minimo: 10, maximo: 300 },
  idadeAnos: { minimo: 1, maximo: 120 },
  // Peso e altura validados isolados deixam passar o par absurdo (500kg com 30cm).
  // A guarda que fecha o par e o proprio IMC.
  imc: { minimo: 8, maximo: 100 }
} as const;

/**
 * Somas maximas por protocolo de Pollock. As equacoes sao quadraticas com
 * concavidade para cima: acima do vertice (Sigma3 ~258mm masculino, ~216mm
 * feminino; Sigma7 ~395/419mm) a densidade volta a SUBIR, e mais gordura medida
 * devolveria MENOS percentual de gordura — invertendo o resultado justamente em
 * obesidade grave. Os limites abaixo ficam dentro da faixa de validacao dos
 * estudos originais, bem antes do vertice.
 */
const SOMA_DOBRAS_MAXIMA: Record<'pollock_3' | 'pollock_7', number> = {
  pollock_3: 150,
  pollock_7: 350
};

/**
 * Faixa etaria da amostra de validacao de cada equacao. Fora dela o calculo sai,
 * mas com aviso: e extrapolacao, nao medida.
 */
const FAIXA_ETARIA_VALIDACAO: Record<Exclude<ProtocoloComposicao, 'nenhum'>, { minimo: number; maximo: number }> = {
  pollock_3: { minimo: 18, maximo: 61 },
  pollock_7: { minimo: 18, maximo: 61 },
  faulkner: { minimo: 18, maximo: 60 },
  guedes: { minimo: 18, maximo: 30 }
};

/**
 * Padronizacao de sitios assumida. O mesmo nome de dobra tem tecnica diferente
 * entre escolas: a suprailiaca de Jackson & Pollock e diagonal na linha axilar
 * anterior, enquanto a tradicao brasileira (Petroski, usada por Guedes e
 * Faulkner) mede na linha axilar media. Gravar isso junto do resultado evita
 * que troca de protocolo entre avaliacoes vire "evolucao" que e so tecnica.
 */
const PADRONIZACAO_SITIOS: Record<Exclude<ProtocoloComposicao, 'nenhum'>, string> = {
  pollock_3: 'sitios pela padronizacao de Jackson & Pollock (suprailiaca diagonal na linha axilar anterior)',
  pollock_7: 'sitios pela padronizacao de Jackson & Pollock (suprailiaca diagonal na linha axilar anterior)',
  faulkner: 'sitios pela padronizacao brasileira (Petroski); suprailiaca na linha axilar media',
  guedes: 'sitios pela padronizacao brasileira (Petroski); suprailiaca na linha axilar media'
};

export const SITIOS_DOBRA: SitioDobra[] = [
  'peitoral',
  'axilarMedia',
  'triceps',
  'subescapular',
  'abdominal',
  'suprailiaca',
  'coxa',
  'panturrilha'
];

export const SITIOS_CIRCUNFERENCIA: SitioCircunferencia[] = [
  'cintura',
  'quadril',
  'abdomen',
  'braco',
  'coxa',
  'panturrilha'
];

/** Dobras exigidas por protocolo e sexo. Faltando uma, o protocolo nao roda. */
const DOBRAS_EXIGIDAS: Record<Exclude<ProtocoloComposicao, 'nenhum'>, Record<SexoBiologico, SitioDobra[]>> = {
  pollock_3: {
    masculino: ['peitoral', 'abdominal', 'coxa'],
    feminino: ['triceps', 'suprailiaca', 'coxa']
  },
  pollock_7: {
    masculino: ['peitoral', 'axilarMedia', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
    feminino: ['peitoral', 'axilarMedia', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa']
  },
  faulkner: {
    masculino: ['triceps', 'subescapular', 'suprailiaca', 'abdominal'],
    feminino: ['triceps', 'subescapular', 'suprailiaca', 'abdominal']
  },
  guedes: {
    masculino: ['triceps', 'suprailiaca', 'abdominal'],
    feminino: ['coxa', 'suprailiaca', 'subescapular']
  }
};

export function dobrasExigidas(protocolo: ProtocoloComposicao, sexo?: SexoBiologico): SitioDobra[] {
  if (protocolo === 'nenhum' || !sexo) return [];
  return DOBRAS_EXIGIDAS[protocolo][sexo];
}

/** Protocolos que dependem da idade do avaliado (equacoes de Jackson & Pollock). */
export function protocoloExigeIdade(protocolo: ProtocoloComposicao): boolean {
  return protocolo === 'pollock_3' || protocolo === 'pollock_7';
}

function numeroFinito(valor: unknown): number | undefined {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : undefined;
}

function dentroDaFaixa(valor: number, faixa: { minimo: number; maximo: number }): boolean {
  return valor >= faixa.minimo && valor <= faixa.maximo;
}

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

/**
 * Equacao de Siri (1961) para converter densidade corporal em percentual de gordura.
 * Siri WE. Body composition from fluid spaces and density. 1961.
 */
function siri(densidadeCorporal: number): number {
  return 495 / densidadeCorporal - 450;
}

/** Diz qual sitio faltou ou saiu da faixa: quem avalia precisa saber o que corrigir. */
function somaDobras(dobras: DobrasCutaneas, sitios: SitioDobra[], avisos: string[]): number | undefined {
  let soma = 0;
  let completa = true;
  for (const sitio of sitios) {
    const valor = numeroFinito(dobras[sitio]);
    if (valor === undefined) {
      avisos.push(`dobra_ausente:${sitio}`);
      completa = false;
      continue;
    }
    if (!dentroDaFaixa(valor, LIMITES.dobraMm)) {
      avisos.push(`dobra_fora_da_faixa:${sitio}`);
      completa = false;
      continue;
    }
    soma += valor;
  }
  return completa ? soma : undefined;
}

interface EquacaoComposicao {
  percentualGordura: number;
  formula: string;
}

/**
 * Jackson AS, Pollock ML. Generalized equations for predicting body density of men.
 * Br J Nutr. 1978;40(3):497-504. (3 dobras: peitoral, abdominal, coxa)
 * Jackson AS, Pollock ML, Ward A. Generalized equations for predicting body density
 * of women. Med Sci Sports Exerc. 1980;12(3):175-181. (3 dobras: triceps, suprailiaca, coxa)
 */
function pollock3(soma: number, sexo: SexoBiologico, idadeAnos: number): EquacaoComposicao {
  const densidade =
    sexo === 'masculino'
      ? 1.10938 - 0.0008267 * soma + 0.0000016 * soma ** 2 - 0.0002574 * idadeAnos
      : 1.0994921 - 0.0009929 * soma + 0.0000023 * soma ** 2 - 0.0001392 * idadeAnos;
  return {
    percentualGordura: siri(densidade),
    formula:
      sexo === 'masculino'
        ? 'Jackson & Pollock 1978 (3 dobras, masculino): Dc = 1,10938 - 0,0008267*S + 0,0000016*S^2 - 0,0002574*idade; %G por Siri (1961)'
        : 'Jackson, Pollock & Ward 1980 (3 dobras, feminino): Dc = 1,0994921 - 0,0009929*S + 0,0000023*S^2 - 0,0001392*idade; %G por Siri (1961)'
  };
}

/**
 * Jackson AS, Pollock ML. 1978 (homens) e Jackson, Pollock & Ward 1980 (mulheres),
 * versao de 7 dobras: peitoral, axilar media, triceps, subescapular, abdominal,
 * suprailiaca e coxa.
 */
function pollock7(soma: number, sexo: SexoBiologico, idadeAnos: number): EquacaoComposicao {
  const densidade =
    sexo === 'masculino'
      ? 1.112 - 0.00043499 * soma + 0.00000055 * soma ** 2 - 0.00028826 * idadeAnos
      : 1.097 - 0.00046971 * soma + 0.00000056 * soma ** 2 - 0.00012828 * idadeAnos;
  return {
    percentualGordura: siri(densidade),
    formula:
      sexo === 'masculino'
        ? 'Jackson & Pollock 1978 (7 dobras, masculino): Dc = 1,112 - 0,00043499*S + 0,00000055*S^2 - 0,00028826*idade; %G por Siri (1961)'
        : 'Jackson, Pollock & Ward 1980 (7 dobras, feminino): Dc = 1,097 - 0,00046971*S + 0,00000056*S^2 - 0,00012828*idade; %G por Siri (1961)'
  };
}

/**
 * Faulkner JA. Physiology of swimming and diving. 1968. Soma de 4 dobras
 * (triceps, subescapular, suprailiaca, abdominal), mesma equacao para ambos os sexos.
 * Devolve percentual direto, sem passar por densidade corporal.
 */
function faulkner(soma: number): EquacaoComposicao {
  return {
    percentualGordura: soma * 0.153 + 5.783,
    formula: 'Faulkner 1968 (4 dobras): %G = S*0,153 + 5,783'
  };
}

/**
 * Guedes DP. Estudo da gordura corporal atraves da mensuracao dos valores de
 * densidade corporal e da espessura de dobras cutaneas em universitarios. 1985.
 * Homens: triceps, suprailiaca, abdominal. Mulheres: coxa, suprailiaca, subescapular.
 */
function guedes(soma: number, sexo: SexoBiologico): EquacaoComposicao {
  const densidade =
    sexo === 'masculino'
      ? 1.17136 - 0.06706 * Math.log10(soma)
      : 1.1665 - 0.07063 * Math.log10(soma);
  return {
    percentualGordura: siri(densidade),
    formula:
      sexo === 'masculino'
        ? 'Guedes 1985 (3 dobras, masculino): Dc = 1,17136 - 0,06706*log10(S); %G por Siri (1961)'
        : 'Guedes 1985 (3 dobras, feminino): Dc = 1,16650 - 0,07063*log10(S); %G por Siri (1961)'
  };
}

/**
 * Classificacao de IMC. Adulto (20-59) pelos cortes da OMS; idoso (60+) por
 * Lipschitz (1994), que e o criterio adotado pelo SISVAN/Ministerio da Saude —
 * usar corte de adulto em idoso classifica IMC 21 como eutrofia quando e baixo
 * peso. Menor de 20 anos nao e classificado aqui: exige escore-z da OMS 2007,
 * que depende das tabelas LMS por idade e sexo.
 */
export function classificarImc(imc: number, idadeAnos?: number): ClassificacaoImc | undefined {
  if (idadeAnos !== undefined && idadeAnos < 20) return undefined;

  if (idadeAnos !== undefined && idadeAnos >= 60) {
    if (imc < 22) return 'baixo_peso';
    if (imc <= 27) return 'eutrofia';
    return 'sobrepeso';
  }

  if (imc < 18.5) return 'baixo_peso';
  if (imc < 25) return 'eutrofia';
  if (imc < 30) return 'sobrepeso';
  if (imc < 35) return 'obesidade_grau_1';
  if (imc < 40) return 'obesidade_grau_2';
  return 'obesidade_grau_3';
}

/**
 * Risco associado a relacao cintura-quadril. OMS, Waist Circumference and
 * Waist-Hip Ratio: Report of a WHO Expert Consultation, Geneva 2008 (pub. 2011):
 * risco substancialmente aumentado a partir de 0,90 em homens e 0,85 em mulheres.
 */
export function classificarRcq(rcq: number, sexo: SexoBiologico): ClassificacaoRcq {
  const limiteElevado = sexo === 'masculino' ? 0.9 : 0.85;
  return rcq >= limiteElevado ? 'elevado' : 'abaixo_do_corte';
}

/**
 * Circunferencia da cintura isolada, mesmo relatorio da OMS 2008, que conclui
 * predizer risco cardiometabolico melhor que a RCQ. Homens: >=94 aumentado,
 * >=102 muito aumentado. Mulheres: >=80 aumentado, >=88 muito aumentado.
 */
export function classificarCircunferenciaCintura(
  cinturaCm: number,
  sexo: SexoBiologico
): ClassificacaoCircunferenciaCintura {
  const [aumentado, muitoAumentado] = sexo === 'masculino' ? [94, 102] : [80, 88];
  if (cinturaCm >= muitoAumentado) return 'muito_aumentado';
  if (cinturaCm >= aumentado) return 'aumentado';
  return 'baixo';
}

export function calcularAntropometria(entrada: EntradaCalculoAntropometrico): ResultadoAntropometrico {
  const avisos: string[] = [];
  const resultado: ResultadoAntropometrico = { protocoloAplicado: 'nenhum', avisos };

  const pesoKg = numeroFinito(entrada.medidas.pesoKg);
  const alturaCm = numeroFinito(entrada.medidas.alturaCm);
  const pesoValido = pesoKg !== undefined && dentroDaFaixa(pesoKg, LIMITES.pesoKg);
  const alturaValida = alturaCm !== undefined && dentroDaFaixa(alturaCm, LIMITES.alturaCm);

  if (pesoKg !== undefined && !pesoValido) avisos.push('peso_fora_da_faixa');
  if (alturaCm !== undefined && !alturaValida) avisos.push('altura_fora_da_faixa');

  if (pesoValido && alturaValida) {
    const alturaM = (alturaCm as number) / 100;
    const imc = (pesoKg as number) / alturaM ** 2;
    if (!dentroDaFaixa(imc, LIMITES.imc)) {
      // Peso e altura plausiveis isolados, par impossivel junto (ou virgula errada).
      avisos.push('imc_fora_da_faixa_plausivel');
    } else {
      resultado.imc = arredondar(imc, 2);
      // Classifica pelo valor bruto: arredondar antes joga a faixa [24,995; 25)
      // inteira para sobrepeso, justamente onde o corte importa.
      resultado.classificacaoImc = classificarImc(imc, entrada.idadeAnos);
      if (resultado.classificacaoImc === undefined) {
        avisos.push(
          entrada.idadeAnos === undefined
            ? 'imc_sem_classificacao_idade_ausente'
            : 'imc_sem_classificacao_menor_de_20_exige_escore_z'
        );
      }
    }
  }

  const cintura = numeroFinito(entrada.medidas.circunferencias?.cintura);
  const quadril = numeroFinito(entrada.medidas.circunferencias?.quadril);
  const cinturaValida = cintura !== undefined && dentroDaFaixa(cintura, LIMITES.circunferenciaCm);

  if (cinturaValida && quadril !== undefined && dentroDaFaixa(quadril, LIMITES.circunferenciaCm)) {
    const rcq = (cintura as number) / quadril;
    resultado.rcq = arredondar(rcq, 2);
    if (entrada.sexo) resultado.classificacaoRcq = classificarRcq(rcq, entrada.sexo);
    else avisos.push('rcq_sem_classificacao_sexo_ausente');
  }

  if (cinturaValida && entrada.sexo) {
    // A propria OMS 2008 conclui que a cintura isolada prediz risco
    // cardiometabolico melhor que a RCQ, e o dado ja esta na mao.
    resultado.circunferenciaCinturaCm = arredondar(cintura as number, 1);
    resultado.classificacaoCircunferenciaCintura = classificarCircunferenciaCintura(
      cintura as number,
      entrada.sexo
    );
  }

  const equacao = aplicarProtocolo(entrada, avisos);
  if (!equacao) return resultado;

  const percentual = arredondar(equacao.percentualGordura, 2);
  if (percentual <= 0 || percentual >= 75) {
    // Resultado impossivel indica dobra digitada errada; gravar seria pior que nao calcular.
    avisos.push('percentual_gordura_implausivel');
    return resultado;
  }

  // Gordura essencial e ~3% em homens e ~12% em mulheres. Abaixo disso o valor
  // sai, mas sinalizado: e mais provavel erro de medida que atleta de elite.
  const gorduraEssencial = entrada.sexo === 'feminino' ? 12 : 3;
  if (percentual < gorduraEssencial) avisos.push('percentual_gordura_abaixo_da_gordura_essencial');

  resultado.protocoloAplicado = entrada.protocolo;
  resultado.formulaAplicada = equacao.formula;
  resultado.percentualGordura = percentual;
  if (pesoValido) {
    const massaGorda = ((pesoKg as number) * percentual) / 100;
    resultado.massaGordaKg = arredondar(massaGorda, 2);
    resultado.massaMagraKg = arredondar((pesoKg as number) - massaGorda, 2);
  } else {
    avisos.push('massa_sem_peso_valido');
  }

  return resultado;
}

function aplicarProtocolo(
  entrada: EntradaCalculoAntropometrico,
  avisos: string[]
): EquacaoComposicao | undefined {
  if (entrada.protocolo === 'nenhum') return undefined;
  if (!entrada.sexo) {
    avisos.push('protocolo_exige_sexo');
    return undefined;
  }

  const idadeAnos = numeroFinito(entrada.idadeAnos);
  const idadeValida = idadeAnos !== undefined && dentroDaFaixa(idadeAnos, LIMITES.idadeAnos);
  if (protocoloExigeIdade(entrada.protocolo) && !idadeValida) {
    avisos.push('protocolo_exige_idade');
    return undefined;
  }

  const sitios = dobrasExigidas(entrada.protocolo, entrada.sexo);
  const soma = somaDobras(entrada.medidas.dobras ?? {}, sitios, avisos);
  if (soma === undefined) return undefined;

  const somaMaxima = SOMA_DOBRAS_MAXIMA[entrada.protocolo as 'pollock_3' | 'pollock_7'];
  if (somaMaxima !== undefined && soma > somaMaxima) {
    // Acima daqui a equacao inverte (ver SOMA_DOBRAS_MAXIMA). Melhor nao devolver
    // numero do que devolver um que diminui quando a gordura aumenta.
    avisos.push('soma_dobras_fora_da_faixa_de_validacao');
    return undefined;
  }

  if (idadeValida) {
    const faixa = FAIXA_ETARIA_VALIDACAO[entrada.protocolo];
    if ((idadeAnos as number) < faixa.minimo || (idadeAnos as number) > faixa.maximo) {
      avisos.push('idade_fora_da_faixa_de_validacao_da_equacao');
    }
    if ((idadeAnos as number) < 18) {
      // Antes da maturidade a densidade da massa livre de gordura nao e 1,100 g/cc,
      // premissa de Siri. Equacao de adulto em crianca nao e imprecisa, e invalida.
      avisos.push('equacao_de_adulto_aplicada_a_menor_de_idade');
    }
  }

  const padronizacao = PADRONIZACAO_SITIOS[entrada.protocolo];
  const faixaValidacao = FAIXA_ETARIA_VALIDACAO[entrada.protocolo];
  const complemento = `; ${padronizacao}; amostra de validacao ${faixaValidacao.minimo}-${faixaValidacao.maximo} anos`;

  const equacao = (() => {
    switch (entrada.protocolo) {
      case 'pollock_3':
        return pollock3(soma, entrada.sexo as SexoBiologico, idadeAnos as number);
      case 'pollock_7':
        return pollock7(soma, entrada.sexo as SexoBiologico, idadeAnos as number);
      case 'faulkner':
        return faulkner(soma);
      case 'guedes':
        return guedes(soma, entrada.sexo as SexoBiologico);
    }
  })();

  return equacao ? { ...equacao, formula: `${equacao.formula}${complemento}` } : undefined;
}

export interface DeltaAntropometrico {
  campo: string;
  anterior: number;
  atual: number;
  variacao: number;
}

/**
 * Comparacao entre duas avaliacoes. So compara o que existe nas duas: campo
 * medido em uma e nao na outra nao vira "variou para zero".
 */
export function compararAvaliacoes(
  anterior: Partial<ResultadoAntropometrico> & { pesoKg?: number },
  atual: Partial<ResultadoAntropometrico> & { pesoKg?: number }
): DeltaAntropometrico[] {
  const campos: (keyof (ResultadoAntropometrico & { pesoKg?: number }))[] = [
    'pesoKg',
    'imc',
    'rcq',
    'percentualGordura',
    'massaGordaKg',
    'massaMagraKg'
  ];

  const deltas: DeltaAntropometrico[] = [];
  for (const campo of campos) {
    const valorAnterior = numeroFinito(anterior[campo as keyof typeof anterior]);
    const valorAtual = numeroFinito(atual[campo as keyof typeof atual]);
    if (valorAnterior === undefined || valorAtual === undefined) continue;
    deltas.push({
      campo: campo as string,
      anterior: valorAnterior,
      atual: valorAtual,
      variacao: arredondar(valorAtual - valorAnterior, 2)
    });
  }
  return deltas;
}

const TIMEZONE_CLINICA = 'America/Sao_Paulo';

/**
 * Data civil (YYYY-MM-DD) de um instante no fuso da clinica. Sem isso, avaliacao
 * feita as 21h30 cai no dia UTC seguinte e o paciente e gravado um ano mais
 * velho na vespera do aniversario.
 */
export function dataCivil(instante: Date, timezone = TIMEZONE_CLINICA): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(instante);
}

/** Idade em anos completos na data da avaliacao, ambas como data civil. */
export function idadeNaData(
  dataNascimento: string | undefined,
  dataAvaliacao: Date | string,
  timezone = TIMEZONE_CLINICA
): number | undefined {
  if (!dataNascimento) return undefined;
  const nascimento = new Date(`${dataNascimento}T00:00:00.000Z`);
  if (Number.isNaN(nascimento.getTime())) return undefined;

  const civil =
    typeof dataAvaliacao === 'string' ? dataAvaliacao : dataCivil(dataAvaliacao, timezone);
  const referencia = new Date(`${civil}T00:00:00.000Z`);
  if (Number.isNaN(referencia.getTime())) return undefined;

  let idade = referencia.getUTCFullYear() - nascimento.getUTCFullYear();
  const mes = referencia.getUTCMonth() - nascimento.getUTCMonth();
  if (mes < 0 || (mes === 0 && referencia.getUTCDate() < nascimento.getUTCDate())) idade -= 1;
  return idade >= 0 && idade <= LIMITES.idadeAnos.maximo ? idade : undefined;
}
