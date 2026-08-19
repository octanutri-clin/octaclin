export interface NutrientesPorcaoPlano {
  energiaKcal: number;
  proteinasG: number;
  carboidratosG: number;
  gordurasG: number;
  fibrasG?: number;
  sodioMg?: number;
}

export interface SubstituicaoPlanoAlimentar {
  alimentoComposicaoId?: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  porcaoGramas: number;
  nutrientes: NutrientesPorcaoPlano;
}

/**
 * Uma alternativa e uma substituicao com as duas decisoes do profissional: se o
 * paciente pode escolhe-la e se ela vem recomendada. As duas nao entram em
 * `SubstituicaoPlanoAlimentar` porque o item principal herda essa interface e
 * nao e alternativa de nada — liberar ou preferir o proprio item nao significa
 * coisa alguma.
 */
export interface AlternativaPlanoAlimentar extends SubstituicaoPlanoAlimentar {
  liberadaParaPaciente: boolean;
  preferida: boolean;
}

export interface ItemPlanoAlimentar extends SubstituicaoPlanoAlimentar {
  substituicoes: AlternativaPlanoAlimentar[];
  /** Ausente significa mostrar todas as liberadas, sem recolher nenhuma. */
  substituicoesVisiveisInicialmente?: number;
}

export interface RefeicaoPlanoAlimentar {
  nome: string;
  horarioLocal?: string;
  orientacoes?: string;
  itens: ItemPlanoAlimentar[];
}

export interface EstruturaPlanoAlimentar {
  refeicoes: RefeicaoPlanoAlimentar[];
}

function arredondar4(valor: number): number {
  return Math.round((valor + 1e-10) * 10_000) / 10_000;
}

function validarTexto(valor: string, rotulo: string, maximo: number): void {
  if (!valor.trim()) throw new Error(`${rotulo} e obrigatorio.`);
  if (valor.trim().length > maximo) throw new Error(`${rotulo} excede ${maximo} caracteres.`);
}

function validarNutrientes(nutrientes: NutrientesPorcaoPlano): void {
  for (const [campo, valor] of Object.entries(nutrientes)) {
    if (valor !== undefined && (!Number.isFinite(valor) || valor < 0)) {
      throw new Error(`Nutriente ${campo} precisa ser um numero nao negativo.`);
    }
  }
}

function validarItem(item: SubstituicaoPlanoAlimentar, rotulo: string): void {
  validarTexto(item.descricao, `${rotulo}: descricao`, 240);
  validarTexto(item.unidade, `${rotulo}: unidade`, 40);
  if (!Number.isFinite(item.quantidade) || item.quantidade <= 0 || item.quantidade > 10_000) {
    throw new Error(`${rotulo}: quantidade invalida.`);
  }
  if (!Number.isFinite(item.porcaoGramas) || item.porcaoGramas <= 0 || item.porcaoGramas > 10_000) {
    throw new Error(`${rotulo}: porcao em gramas invalida.`);
  }
  validarNutrientes(item.nutrientes);
}

function validarLimiteVisivel(item: ItemPlanoAlimentar, indiceItem: number): void {
  const limite = item.substituicoesVisiveisInicialmente;
  if (limite === undefined || limite === null) return;
  const rotulo = `Item ${indiceItem + 1}: substituicoes visiveis inicialmente`;
  if (!Number.isInteger(limite) || limite < 1 || limite > 20) {
    throw new Error(`${rotulo} precisa ser um inteiro entre 1 e 20.`);
  }
  if (!item.substituicoes.length) {
    // Limite sobre lista vazia nao descreve nada e so sobrevive ate alguem
    // tentar interpreta-lo na tela do paciente.
    throw new Error(`${rotulo} exige ao menos uma substituicao.`);
  }
}

export function validarEstruturaPlano(estrutura: EstruturaPlanoAlimentar): void {
  if (!estrutura.refeicoes.length) throw new Error('Plano alimentar precisa de ao menos uma refeicao.');
  if (estrutura.refeicoes.length > 50) throw new Error('Plano alimentar excede o limite de 50 refeicoes.');

  estrutura.refeicoes.forEach((refeicao, indiceRefeicao) => {
    validarTexto(refeicao.nome, `Refeicao ${indiceRefeicao + 1}: nome`, 180);
    if (refeicao.orientacoes && refeicao.orientacoes.length > 2_000) {
      throw new Error(`Refeicao ${indiceRefeicao + 1}: orientacoes excedem 2.000 caracteres.`);
    }
    if (!refeicao.itens.length) throw new Error(`Refeicao ${indiceRefeicao + 1} precisa de ao menos um item.`);
    if (refeicao.itens.length > 100) throw new Error(`Refeicao ${indiceRefeicao + 1} excede 100 itens.`);

    refeicao.itens.forEach((item, indiceItem) => {
      validarItem(item, `Refeicao ${indiceRefeicao + 1}, item ${indiceItem + 1}`);
      validarLimiteVisivel(item, indiceItem);
      if (item.substituicoes.length > 20) {
        throw new Error(`Item ${indiceItem + 1} excede 20 substituicoes.`);
      }
      item.substituicoes.forEach((substituicao, indice) =>
        validarItem(substituicao, `Item ${indiceItem + 1}, substituicao ${indice + 1}`)
      );
    });
  });
}

export function calcularTotaisPlano(estrutura: EstruturaPlanoAlimentar): NutrientesPorcaoPlano {
  validarEstruturaPlano(estrutura);
  const itens = estrutura.refeicoes.flatMap((refeicao) => refeicao.itens);
  const somar = (campo: keyof NutrientesPorcaoPlano): number | undefined => {
    const valores = itens.map((item) => item.nutrientes[campo]);
    if (valores.some((valor) => valor === undefined)) return undefined;
    return arredondar4((valores as number[]).reduce((soma, valor) => soma + valor, 0));
  };

  return {
    energiaKcal: somar('energiaKcal')!,
    proteinasG: somar('proteinasG')!,
    carboidratosG: somar('carboidratosG')!,
    gordurasG: somar('gordurasG')!,
    fibrasG: somar('fibrasG'),
    sodioMg: somar('sodioMg')
  };
}
