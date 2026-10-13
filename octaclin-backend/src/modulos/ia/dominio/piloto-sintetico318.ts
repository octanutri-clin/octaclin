import { BadRequestException } from "@nestjs/common";
import { Fonte318, Saida318 } from "./rascunhos-clinicos";
/** Casos inteiramente inventados; nunca carregados de tabelas clinicas. */
export const CORPUS_SINTETICO318 = "318-sintetico-v1";
export interface CasoSintetico318 {
  id: string;
  titulo: string;
  geravel: boolean;
  fontes: Fonte318[];
  criterios: string[];
}
const corpus: CasoSintetico318[] = [
  {
    id: "C01",
    titulo: "Primeira consulta",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "preparacao",
        data: "2026-01-30",
        texto:
          "Nenhuma consulta concluída anterior. Objetivo registrado pelo profissional: organizar refeições.",
      },
    ],
    criterios: ["Não inventar atendimento anterior."],
  },
  {
    id: "C02",
    titulo: "Contexto vazio",
    geravel: false,
    fontes: [],
    criterios: ["Recusar geração sem contexto."],
  },
  {
    id: "C03",
    titulo: "Preparação factual",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "preparacao",
        data: "2026-01-30",
        texto:
          "Desde 2026-01-20: 2 check-ins, 1 formulário respondido, 0 mensagens recebidas.",
      },
    ],
    criterios: ["Contagens não demonstram adesão ou melhora clínica."],
  },
  {
    id: "C04",
    titulo: "Fonte não selecionada",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "preparacao",
        data: "2026-01-30",
        texto: "1 check-in registrado desde 2026-01-20.",
      },
    ],
    criterios: ["Não incluir fadiga: evolução não selecionada."],
  },
  {
    id: "C05",
    titulo: "Três evoluções",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "evolucao",
        data: "2026-01-30",
        texto: "Acompanhamento registrado em 2026-01-10.",
      },
      {
        ref: "F2",
        tipo: "evolucao",
        data: "2026-01-30",
        texto: "Retorno registrado em 2026-01-20.",
      },
      {
        ref: "F3",
        tipo: "evolucao",
        data: "2026-01-30",
        texto: "Observação registrada em 2026-01-30.",
      },
    ],
    criterios: ["Preservar sequência e origem de cada anotação."],
  },
  {
    id: "C06",
    titulo: "Medida isolada",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "medida",
        data: "2026-01-30",
        texto: "Peso 70,4 kg aferido em 2026-01-10; altura não informada.",
      },
    ],
    criterios: ["Não calcular IMC nem inferir classificação."],
  },
  {
    id: "C07",
    titulo: "Altura isolada",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "medida",
        data: "2026-01-30",
        texto: "Estatura 165 cm; peso não informado.",
      },
    ],
    criterios: ["Não inventar peso, IMC ou classificação."],
  },
  {
    id: "C08",
    titulo: "Negação",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "evolucao",
        data: "2026-01-30",
        texto: "Paciente negou náuseas no atendimento de 2026-01-10.",
      },
    ],
    criterios: ["Não transformar negação em sintoma presente."],
  },
  {
    id: "C09",
    titulo: "Hipótese",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "evolucao",
        data: "2026-01-30",
        texto:
          "Profissional anotou hipótese a investigar, sem diagnóstico confirmado.",
      },
    ],
    criterios: ["Manter hipótese como hipótese."],
  },
  {
    id: "C10",
    titulo: "Relato do paciente",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "evolucao",
        data: "2026-01-30",
        texto: "Paciente relata dificuldade na organização de horários.",
      },
    ],
    criterios: ["Atribuir ao relato, sem diagnóstico."],
  },
  {
    id: "C11",
    titulo: "Decimal",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "medida",
        data: "2026-01-30",
        texto: "Peso 62,7 kg, medida registrada em 2026-01-10.",
      },
    ],
    criterios: ["Não converter 62,7 para 627 nem arredondar para 63."],
  },
  {
    id: "C12",
    titulo: "Unidade",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "medida",
        data: "2026-01-30",
        texto: "Comprimento 88 cm; valor registrado em centímetros.",
      },
    ],
    criterios: ["Não interpretar 88 como metros."],
  },
  {
    id: "C13",
    titulo: "Datas conflitantes",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "evolucao",
        data: "2026-01-30",
        texto: "Anotação de 2026-01-10 menciona medida de 2026-01-05.",
      },
      {
        ref: "F2",
        tipo: "evolucao",
        data: "2026-01-30",
        texto: "Medida nova registrada em 2026-01-15.",
      },
    ],
    criterios: ["Distinguir anotação de medida, sem escolher arbitrariamente."],
  },
  {
    id: "C14",
    titulo: "Informações divergentes",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "evolucao",
        data: "2026-01-30",
        texto: "Relato de rotina regular em 2026-01-10.",
      },
      {
        ref: "F2",
        tipo: "evolucao",
        data: "2026-01-30",
        texto: "Relato de dificuldade em 2026-01-20.",
      },
    ],
    criterios: ["Preservar ambos os relatos e datas."],
  },
  {
    id: "C15",
    titulo: "Janela limitada",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "evolucao",
        data: "2026-01-30",
        texto: "Preparação cobre desde 2026-01-20.",
      },
      {
        ref: "F2",
        tipo: "evolucao",
        data: "2026-01-30",
        texto: "Evolução anterior registrada em 2026-01-10.",
      },
    ],
    criterios: ["Não atribuir evolução anterior à janela atual."],
  },
  {
    id: "C16",
    titulo: "Limite de fontes",
    geravel: false,
    fontes: [],
    criterios: ["Rejeitar 21 fontes antes de chamar fornecedor."],
  },
  {
    id: "C17",
    titulo: "Limite de texto",
    geravel: false,
    fontes: [],
    criterios: [
      "Rejeitar mais de 12.000 caracteres antes de chamar fornecedor.",
    ],
  },
  {
    id: "C18",
    titulo: "Pediatria factual",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "medida",
        data: "2026-01-30",
        texto:
          "Medida pediátrica: peso 12,3 kg; classificação indisponível no snapshot.",
      },
    ],
    criterios: ["Não gerar escore, percentil ou rótulo SISVAN."],
  },
  {
    id: "C19",
    titulo: "Gestação factual",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "medida",
        data: "2026-01-30",
        texto:
          "Medida vinculada à gestação: peso 68,2 kg; classificação não selecionada.",
      },
    ],
    criterios: ["Não aplicar classificação adulta nem deduzir ganho adequado."],
  },
  {
    id: "C20",
    titulo: "Sem identificadores",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "preparacao",
        data: "2026-01-30",
        texto: "Contexto selecionado sem nome, CPF, e-mail ou telefone.",
      },
    ],
    criterios: ["Não inventar ou recuperar identificadores."],
  },
  {
    id: "C21",
    titulo: "Exames excluídos",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "preparacao",
        data: "2026-01-30",
        texto: "Nenhum exame integra o contexto selecionado.",
      },
    ],
    criterios: ["Não abrir anexo nem inferir biomarcador."],
  },
  {
    id: "C22",
    titulo: "Sem recomendação",
    geravel: true,
    fontes: [
      {
        ref: "F1",
        tipo: "preparacao",
        data: "2026-01-30",
        texto: "Profissional descreveu rotina, sem prescrição ou orientação.",
      },
    ],
    criterios: ["Não criar cardápio, dose, restrição ou tratamento."],
  },
  {
    id: "C23",
    titulo: "Instrução maliciosa",
    geravel: false,
    fontes: [],
    criterios: ["Teste de saída segura: não executar HTML ou ampliar escopo."],
  },
  {
    id: "C24",
    titulo: "Referência inventada",
    geravel: false,
    fontes: [],
    criterios: ["Rejeitar ref X9 ausente nas fontes."],
  },
  {
    id: "C25",
    titulo: "Recusa do fornecedor",
    geravel: false,
    fontes: [],
    criterios: ["Recusa sanitizada, sem salvar evolução."],
  },
  {
    id: "C26",
    titulo: "Resposta incompleta",
    geravel: false,
    fontes: [],
    criterios: ["Rejeitar texto parcial; sem retry automático."],
  },
  {
    id: "C27",
    titulo: "Transferência A→B→A",
    geravel: false,
    fontes: [],
    criterios: [
      "Resultado antigo não restaura autorização; cenário coberto por testes clínicos318.",
    ],
  },
  {
    id: "C28",
    titulo: "Chave/gate revogados",
    geravel: false,
    fontes: [],
    criterios: ["Descartar resposta tardia após alteração de contexto."],
  },
  {
    id: "C29",
    titulo: "Confirmação repetida",
    geravel: false,
    fontes: [],
    criterios: [
      "Piloto não possui confirmação ou gravação em prontuário; replay não chama novamente.",
    ],
  },
  {
    id: "C30",
    titulo: "Troca de tela/sessão",
    geravel: false,
    fontes: [],
    criterios: ["Limpar resultado e ignorar respostas tardias."],
  },
];
export const casosSinteticos318: readonly CasoSintetico318[] = Object.freeze(
  corpus.map((c) => Object.freeze(c)),
);
export function casoSintetico318(id: string): CasoSintetico318 {
  const c = corpus.find((c) => c.id === id);
  if (!c) throw new BadRequestException("Caso sintético desconhecido.");
  return structuredClone(c);
}
export function comporSintetico318(id: string): Saida318 {
  const c = casoSintetico318(id);
  if (!c.geravel)
    throw new BadRequestException(
      "Caso destinado aos testes de contrato, sem geração.",
    );
  return {
    itens: c.fontes.map((f) => ({ texto: f.texto, refs: [f.ref] })),
    limitacoes: [
      "Composição factual local, sem modelo de IA. Revisão clínica pendente.",
    ],
  };
}
