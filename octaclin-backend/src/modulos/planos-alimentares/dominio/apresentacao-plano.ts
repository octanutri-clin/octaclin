import type { NutrientesPorcaoPlano } from './plano-alimentar';

export interface PreferenciasExibicaoRefeicoes {
  horario: boolean;
  macros: boolean;
  medidasCaseiras: boolean;
  orientacoes: boolean;
  substituicoesExpandidas: boolean;
  modoCompacto: boolean;
}
export interface PreferenciasApresentacaoPlano {
  schemaVersao: 1;
  profissional: PreferenciasExibicaoRefeicoes;
  paciente: PreferenciasExibicaoRefeicoes;
}
const FLAGS = ['horario', 'macros', 'medidasCaseiras', 'orientacoes', 'substituicoesExpandidas', 'modoCompacto'] as const;
function registro(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Preferências de apresentação inválidas.');
  return valor as Record<string, unknown>;
}
function conjunto(valor: unknown): PreferenciasExibicaoRefeicoes {
  const entrada = registro(valor);
  if (Object.keys(entrada).length !== FLAGS.length || FLAGS.some(flag => typeof entrada[flag] !== 'boolean')) {
    throw new Error('Preferências de apresentação inválidas.');
  }
  return Object.fromEntries(FLAGS.map(flag => [flag, entrada[flag]])) as unknown as PreferenciasExibicaoRefeicoes;
}
export function validarPreferenciasApresentacao(valor: unknown): PreferenciasApresentacaoPlano | undefined {
  if (valor === undefined) return undefined;
  const entrada = registro(valor);
  if (Object.keys(entrada).length !== 3 || entrada.schemaVersao !== 1) throw new Error('Preferências de apresentação inválidas.');
  return { schemaVersao: 1, profissional: conjunto(entrada.profissional), paciente: conjunto(entrada.paciente) };
}

export interface OpcaoPacienteEntrada {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  porcaoGramas: number;
  nutrientes: Partial<NutrientesPorcaoPlano>;
}
export interface ItemPacienteEntrada extends OpcaoPacienteEntrada {
  substituicoes: (OpcaoPacienteEntrada & { liberadaParaPaciente?: boolean; preferida?: boolean })[];
  substituicoesVisiveisInicialmente?: number;
  escolhaAtualSubstituicaoId?: string;
}
export interface RefeicaoPacienteEntrada {
  id: string;
  nome: string;
  horarioLocal?: string;
  orientacoes?: string;
  itens: ItemPacienteEntrada[];
}
function opcaoPaciente(item: OpcaoPacienteEntrada): OpcaoPacienteEntrada {
  const nutrientes: Partial<NutrientesPorcaoPlano> = {};
  for (const campo of ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG', 'fibrasG', 'sodioMg'] as const) {
    const valor = item.nutrientes[campo];
    if (typeof valor === 'number' && Number.isFinite(valor) && valor >= 0) nutrientes[campo] = valor;
  }
  return { id: item.id, descricao: item.descricao, quantidade: item.quantidade, unidade: item.unidade, porcaoGramas: item.porcaoGramas, nutrientes };
}
/** Allowlist comum ao portal e à prévia profissional para entrega ao paciente. */
export function projetarRefeicoesPaciente(refeicoes: RefeicaoPacienteEntrada[]) {
  return refeicoes.map(refeicao => ({
    id: refeicao.id,
    nome: refeicao.nome,
    ...(refeicao.horarioLocal ? { horarioLocal: refeicao.horarioLocal } : {}),
    ...(refeicao.orientacoes ? { orientacoes: refeicao.orientacoes } : {}),
    itens: refeicao.itens.map(item => {
      const substituicoes = item.substituicoes
        .filter(alternativa => alternativa.liberadaParaPaciente === true)
        .slice().sort((a, b) => Number(b.preferida === true) - Number(a.preferida === true))
        .map(alternativa => ({ ...opcaoPaciente(alternativa), preferida: alternativa.preferida === true }));
      return {
        ...opcaoPaciente(item),
        ...(item.substituicoesVisiveisInicialmente !== undefined ? { substituicoesVisiveisInicialmente: item.substituicoesVisiveisInicialmente } : {}),
        ...(substituicoes.some(x => x.id === item.escolhaAtualSubstituicaoId) ? { escolhaAtualSubstituicaoId: item.escolhaAtualSubstituicaoId } : {}),
        substituicoes
      };
    })
  }));
}

export interface ApresentacaoVersao {
  apresentacaoEstado: 'legado' | 'configurada' | 'indisponivel';
  apresentacaoRevisao: number;
  preferenciasApresentacao?: PreferenciasApresentacaoPlano;
}
export function lerApresentacaoVersao(
  cipher: Buffer | null | undefined,
  revisao: number | undefined,
  decifrar: (valor: Buffer) => string
): ApresentacaoVersao {
  const apresentacaoRevisao = revisao ?? 0;
  if (!Number.isSafeInteger(apresentacaoRevisao) || apresentacaoRevisao < 0) return { apresentacaoEstado: 'indisponivel', apresentacaoRevisao: 0 };
  if (!cipher) return { apresentacaoEstado: apresentacaoRevisao === 0 ? 'legado' : 'indisponivel', apresentacaoRevisao };
  try {
    const preferenciasApresentacao = validarPreferenciasApresentacao(JSON.parse(decifrar(cipher)));
    if (!preferenciasApresentacao) throw new Error('Snapshot ausente.');
    return { apresentacaoEstado: 'configurada', apresentacaoRevisao, preferenciasApresentacao };
  } catch {
    return { apresentacaoEstado: 'indisponivel', apresentacaoRevisao };
  }
}

export function projetarMetasPaciente(valor: unknown) {
  const calculo = valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
  const origem = calculo.metasMacronutrientes && typeof calculo.metasMacronutrientes === 'object' ? calculo.metasMacronutrientes as Record<string, unknown> : {};
  const macros: Partial<Pick<NutrientesPorcaoPlano, 'proteinasG' | 'carboidratosG' | 'gordurasG'>> = {};
  for (const campo of ['proteinasG', 'carboidratosG', 'gordurasG'] as const) {
    const numero = origem[campo];
    if (typeof numero === 'number' && Number.isFinite(numero) && numero >= 0) macros[campo] = numero;
  }
  const energia = calculo.metaEnergeticaKcal;
  return {
    ...(typeof energia === 'number' && Number.isFinite(energia) && energia >= 0 ? { metaEnergeticaKcal: energia } : {}),
    ...(Object.keys(macros).length ? { macros } : {})
  };
}
