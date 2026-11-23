import type { RespostaQuestionarioRecebida, LeituraClinicaQuestionario } from './servico-questionarios';
import type { TipoPergunta } from '../dominio/tipos-pergunta';
export interface PerguntaResumo { id:string; enunciado:string; tipo:TipoPergunta }
export function resumirRespostas(questionarioId:string, respostasFiltradas:RespostaQuestionarioRecebida[], perguntas:PerguntaResumo[], pacienteId?:string, estrito=false, incompativeis:ReadonlySet<string>=new Set()):LeituraClinicaQuestionario {
    const pacientesPorId = new Map<
      string,
      {
        pacienteId: string;
        totalRespostas: number;
        totalValoresRespondidos: number;
        ultimaRespostaEm?: Date;
      }
    >();
    const valoresPorPergunta = new Map<string, { valor: unknown; finalizadoEm?: Date }[]>();
    let totalValoresRespondidos = 0;

    respostasFiltradas.forEach((resposta) => {
      totalValoresRespondidos += resposta.totalRespostas;
      const paciente = pacientesPorId.get(resposta.pacienteId) ?? {
        pacienteId: resposta.pacienteId,
        totalRespostas: 0,
        totalValoresRespondidos: 0,
        ultimaRespostaEm: resposta.finalizadoEm
      };
      paciente.totalRespostas += 1;
      paciente.totalValoresRespondidos += resposta.totalRespostas;
      if ((resposta.finalizadoEm?.getTime() ?? 0) > (paciente.ultimaRespostaEm?.getTime() ?? 0)) {
        paciente.ultimaRespostaEm = resposta.finalizadoEm;
      }
      pacientesPorId.set(resposta.pacienteId, paciente);

      resposta.respostas.forEach((item) => {
        const valores = valoresPorPergunta.get(item.perguntaId) ?? [];
        valores.push({ valor: item.valor, finalizadoEm: resposta.finalizadoEm });
        valoresPorPergunta.set(item.perguntaId, valores);
      });
    });

    const pacientes = Array.from(pacientesPorId.values())
      .sort((a, b) => (b.ultimaRespostaEm?.getTime() ?? 0) - (a.ultimaRespostaEm?.getTime() ?? 0))
      .map((paciente) => ({
        ...paciente,
        mediaRespostasPorEnvio: arredondarMedia(paciente.totalValoresRespondidos, paciente.totalRespostas)
      }));

    const perguntasAgregadas = perguntas.map((pergunta) => {
      const valores = valoresPorPergunta.get(pergunta.id) ?? [];
      const permiteMediaNumerica = !incompativeis.has(pergunta.id) && (pergunta.tipo === 'metrica' || pergunta.tipo === 'linear' || pergunta.tipo === 'likert');
      const numericos = permiteMediaNumerica ? valores.filter(item => !estrito || typeof item.valor === 'number' || (typeof item.valor === 'string' && item.valor.trim() !== '')).map((item) => Number(item.valor)).filter((valor) => Number.isFinite(valor)) : [];
      const totalSim = valores.filter((item) => item.valor === true).length;
      const totalNao = valores.filter((item) => item.valor === false).length;

      return {
        perguntaId: pergunta.id,
        enunciado: pergunta.enunciado,
        tipo: pergunta.tipo,
        totalRespostas: valores.length,
        totalSim: pergunta.tipo === 'sim_nao' ? totalSim : undefined,
        totalNao: pergunta.tipo === 'sim_nao' ? totalNao : undefined,
        mediaNumerica: numericos.length ? arredondarMedia(numericos.reduce((total, valor) => total + valor, 0), numericos.length) : undefined,
        textosRecentes: valores
          .filter((item) => typeof item.valor === 'string' && item.valor.trim())
          .sort((a, b) => (b.finalizadoEm?.getTime() ?? 0) - (a.finalizadoEm?.getTime() ?? 0))
          .slice(0, 3)
          .map((item) => String(item.valor)),
        distribuicao: montarDistribuicao(valores.map((item) => item.valor))
      };
    });

    return {
      questionarioId,
      filtroPacienteId: pacienteId,
      resumo: {
        totalRespostas: respostasFiltradas.length,
        totalPacientes: pacientes.length,
        totalPerguntas: perguntas.length,
        mediaRespostasPorEnvio: arredondarMedia(totalValoresRespondidos, respostasFiltradas.length),
        ultimaRespostaEm: respostasFiltradas[0]?.finalizadoEm
      },
      pacientes,
      perguntas: perguntasAgregadas,
      respostas: respostasFiltradas
    };
}
function arredondarMedia(total:number,divisor:number):number {return divisor ? Math.round(total/divisor*100)/100 : 0;}
function montarDistribuicao(valores: unknown[]): { valor: string; total: number }[] {
    const contagem = new Map<string, number>();
    valores.forEach((valor) => {
      const itens = Array.isArray(valor) ? valor : [valor];
      itens.forEach((item) => {
        const chave = valorDistribuicao(item);
        contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
      });
    });
    return Array.from(contagem.entries())
      .map(([valor, total]) => ({ valor, total }))
      .sort((a, b) => b.total - a.total || a.valor.localeCompare(b.valor));
  }

function valorDistribuicao(valor: unknown): string {
    if (valor === true) return 'Sim';
    if (valor === false) return 'Nao';
    if (valor === null || valor === undefined || valor === '') return 'Sem resposta';
    if (typeof valor === 'object') return JSON.stringify(valor);
    return String(valor);
  }
