import { listarConsultasAgenda, type ConsultaAgendaApi } from './agenda-api';
import { listarPacientes, type PacienteResumo, type RespostaPaginada } from './cadastros-api';
import { listarMensagens, type MensagemNotificacaoApi } from './comunicacoes-api';
import { listarQuestionarios, type QuestionarioApi } from './questionarios-api';

export interface DashboardProfissionalApi {
  consultas: ConsultaAgendaApi[];
  pacientes: RespostaPaginada<PacienteResumo>;
  questionarios: RespostaPaginada<QuestionarioApi>;
  mensagens: MensagemNotificacaoApi[];
}

export async function carregarDashboardProfissional(): Promise<DashboardProfissionalApi> {
  const [consultas, pacientes, questionarios, mensagens] = await Promise.all([
    listarConsultasAgenda(),
    listarPacientes(),
    listarQuestionarios(),
    listarMensagens()
  ]);

  return { consultas, pacientes, questionarios, mensagens };
}
