import { TipoPergunta } from './tipos-pergunta';

export interface ModeloQuestionarioCategoria {
  nome: string;
  iconeSvg: string;
  corHex: string;
  ordem: number;
}

export interface ModeloQuestionarioPergunta {
  categoria: ModeloQuestionarioCategoria;
  tipo: TipoPergunta;
  enunciado: string;
  peso: number;
  obrigatoria: boolean;
  configuracao: Record<string, unknown>;
  opcoes?: { rotulo: string; valor: string; imagemUrl?: string }[];
}

export interface ModeloQuestionario {
  id: string;
  titulo: string;
  descricao: string;
  objetivo: string;
  estimativaMinutos: number;
  perguntas: ModeloQuestionarioPergunta[];
}

export interface ModeloQuestionarioResumo {
  id: string;
  titulo: string;
  descricao: string;
  objetivo: string;
  estimativaMinutos: number;
  totalPerguntas: number;
  secoes: string[];
}

const categorias = {
  nutricao: { nome: 'Nutricao', iconeSvg: 'utensils', corHex: '#247BA0', ordem: 1 },
  sono: { nome: 'Sono', iconeSvg: 'moon', corHex: '#6A5ACD', ordem: 2 },
  atividade: { nome: 'Atividade fisica', iconeSvg: 'activity', corHex: '#2F9E44', ordem: 3 },
  emocional: { nome: 'Emocional', iconeSvg: 'heart', corHex: '#C77D1A', ordem: 4 }
} satisfies Record<string, ModeloQuestionarioCategoria>;

export const MODELOS_QUESTIONARIO: ModeloQuestionario[] = [
  {
    id: 'checkin-adesao-semanal',
    titulo: 'Check-in semanal de adesao',
    descricao: 'Acompanhamento rapido para monitorar adesao alimentar, treino, sono e percepcao geral.',
    objetivo: 'Monitorar aderencia e sinais de ajuste do plano entre consultas.',
    estimativaMinutos: 5,
    perguntas: [
      {
        categoria: categorias.nutricao,
        tipo: 'likert',
        enunciado: 'O quanto voce conseguiu seguir o plano alimentar nesta semana?',
        peso: 3,
        obrigatoria: true,
        configuracao: {
          secao: 'Adesao alimentar',
          escalaMin: 1,
          escalaMax: 5,
          rotuloMin: 'Nao consegui seguir',
          rotuloMax: 'Segui muito bem'
        }
      },
      {
        categoria: categorias.nutricao,
        tipo: 'multipla_escolha',
        enunciado: 'Quais pontos mais dificultaram a adesao?',
        peso: 2,
        obrigatoria: false,
        configuracao: { secao: 'Adesao alimentar', multipla: true },
        opcoes: [
          { rotulo: 'Fome', valor: 'fome' },
          { rotulo: 'Rotina corrida', valor: 'rotina_corrida' },
          { rotulo: 'Eventos sociais', valor: 'eventos_sociais' },
          { rotulo: 'Falta de preparo', valor: 'falta_preparo' }
        ]
      },
      {
        categoria: categorias.atividade,
        tipo: 'metrica',
        enunciado: 'Quantos treinos voce realizou nesta semana?',
        peso: 2,
        obrigatoria: true,
        configuracao: { secao: 'Movimento', unidade: 'treinos', minimo: 0, maximo: 14, passo: 1 }
      },
      {
        categoria: categorias.sono,
        tipo: 'linear',
        enunciado: 'Como foi a qualidade media do seu sono?',
        peso: 2,
        obrigatoria: true,
        configuracao: { secao: 'Recuperacao', minimo: 0, maximo: 10, passo: 1, rotuloMin: 'Ruim', rotuloMax: 'Excelente' }
      },
      {
        categoria: categorias.emocional,
        tipo: 'texto_longo',
        enunciado: 'Tem algo importante que eu deveria saber antes do proximo acompanhamento?',
        peso: 1,
        obrigatoria: false,
        configuracao: { secao: 'Observacoes', limiteCaracteres: 800, placeholder: 'Conte em poucas palavras' }
      }
    ]
  },
  {
    id: 'recordatorio-24h',
    titulo: 'Recordatorio alimentar 24h',
    descricao: 'Formulario para registrar consumo alimentar recente e contexto das refeicoes.',
    objetivo: 'Coletar base alimentar objetiva antes de ajustes no plano.',
    estimativaMinutos: 8,
    perguntas: [
      {
        categoria: categorias.nutricao,
        tipo: 'texto_longo',
        enunciado: 'Descreva tudo que consumiu no cafe da manha.',
        peso: 2,
        obrigatoria: true,
        configuracao: { secao: 'Refeicoes', limiteCaracteres: 1200, placeholder: 'Inclua alimentos, quantidades e horarios' }
      },
      {
        categoria: categorias.nutricao,
        tipo: 'texto_longo',
        enunciado: 'Descreva tudo que consumiu no almoco e jantar.',
        peso: 3,
        obrigatoria: true,
        configuracao: { secao: 'Refeicoes', limiteCaracteres: 1600, placeholder: 'Inclua alimentos, quantidades e horarios' }
      },
      {
        categoria: categorias.nutricao,
        tipo: 'upload_midia',
        enunciado: 'Anexe fotos das refeicoes, se tiver.',
        peso: 1,
        obrigatoria: false,
        configuracao: { secao: 'Evidencias', tiposAceitos: ['image/*'], maxArquivos: 5 }
      },
      {
        categoria: categorias.emocional,
        tipo: 'multipla_escolha',
        enunciado: 'Como estava sua fome ao longo do dia?',
        peso: 2,
        obrigatoria: true,
        configuracao: { secao: 'Contexto', multipla: false },
        opcoes: [
          { rotulo: 'Baixa', valor: 'baixa' },
          { rotulo: 'Moderada', valor: 'moderada' },
          { rotulo: 'Alta', valor: 'alta' }
        ]
      }
    ]
  },
  {
    id: 'triagem-primeira-consulta',
    titulo: 'Triagem de primeira consulta',
    descricao: 'Coleta inicial para entender rotina, objetivos, historico e prioridades do paciente.',
    objetivo: 'Preparar a primeira consulta com dados clinicos e comportamentais essenciais.',
    estimativaMinutos: 10,
    perguntas: [
      {
        categoria: categorias.nutricao,
        tipo: 'texto_longo',
        enunciado: 'Qual e seu principal objetivo com o acompanhamento?',
        peso: 3,
        obrigatoria: true,
        configuracao: { secao: 'Objetivos', limiteCaracteres: 1000, placeholder: 'Ex.: emagrecimento, performance, saude intestinal' }
      },
      {
        categoria: categorias.nutricao,
        tipo: 'multipla_escolha',
        enunciado: 'Voce possui alguma restricao alimentar?',
        peso: 2,
        obrigatoria: true,
        configuracao: { secao: 'Historico alimentar', multipla: true },
        opcoes: [
          { rotulo: 'Lactose', valor: 'lactose' },
          { rotulo: 'Gluten', valor: 'gluten' },
          { rotulo: 'Vegetariano/vegano', valor: 'vegetariano_vegano' },
          { rotulo: 'Nenhuma', valor: 'nenhuma' }
        ]
      },
      {
        categoria: categorias.atividade,
        tipo: 'sim_nao',
        enunciado: 'Voce pratica atividade fisica atualmente?',
        peso: 2,
        obrigatoria: true,
        configuracao: { secao: 'Rotina', rotuloSim: 'Sim', rotuloNao: 'Nao' }
      },
      {
        categoria: categorias.sono,
        tipo: 'metrica',
        enunciado: 'Quantas horas voce costuma dormir por noite?',
        peso: 2,
        obrigatoria: true,
        configuracao: { secao: 'Rotina', unidade: 'horas', minimo: 0, maximo: 14, passo: 0.5 }
      },
      {
        categoria: categorias.emocional,
        tipo: 'linear',
        enunciado: 'Como voce avalia seu nivel de estresse atualmente?',
        peso: 2,
        obrigatoria: true,
        configuracao: { secao: 'Rotina', minimo: 0, maximo: 10, passo: 1, rotuloMin: 'Baixo', rotuloMax: 'Muito alto' }
      }
    ]
  }
];

export function resumirModeloQuestionario(modelo: ModeloQuestionario): ModeloQuestionarioResumo {
  return {
    id: modelo.id,
    titulo: modelo.titulo,
    descricao: modelo.descricao,
    objetivo: modelo.objetivo,
    estimativaMinutos: modelo.estimativaMinutos,
    totalPerguntas: modelo.perguntas.length,
    secoes: Array.from(new Set(modelo.perguntas.map((pergunta) => String(pergunta.configuracao.secao ?? 'Sem secao'))))
  };
}
