import { destinatariosDaNotificacao, UsuarioDestinavel } from './destinatarios-notificacao';

const usuarios: UsuarioDestinavel[] = [
  { id: 'admin', role: 'SuperAdmin' },
  { id: 'colab', role: 'Collaborator' },
  { id: 'prof-ana', role: 'Professional' },
  { id: 'prof-bruno', role: 'Professional' },
  { id: 'paciente', role: 'Patient' },
  { id: 'gestor', role: 'Client' }
];

describe('destinatariosDaNotificacao', () => {
  it('entrega evento operacional a quem opera o console da clinica', () => {
    const destinatarios = destinatariosDaNotificacao(usuarios, undefined, 'mensagem_recebida');

    expect(destinatarios).toContain('admin');
    expect(destinatarios).toContain('colab');
  });

  it('nao entrega resposta clinica a colaborador operacional', () => {
    const destinatarios = destinatariosDaNotificacao(usuarios, 'prof-ana', 'formulario_respondido');

    expect(destinatarios).toContain('admin');
    expect(destinatarios).toContain('prof-ana');
    expect(destinatarios).not.toContain('colab');
  });

  it('nunca entrega a paciente nem a gestor da conta', () => {
    // Paciente tem o proprio canal (Fase 116) e gestor da conta nao opera a
    // clinica; ambos no sino do console seriam vazamento, nao conveniencia.
    const destinatarios = destinatariosDaNotificacao(usuarios, 'prof-ana', 'mensagem_recebida');

    expect(destinatarios).not.toContain('paciente');
    expect(destinatarios).not.toContain('gestor');
  });

  it('entrega ao profissional responsavel quando o evento tem dono', () => {
    const destinatarios = destinatariosDaNotificacao(usuarios, 'prof-ana', 'formulario_respondido');

    expect(destinatarios).toContain('prof-ana');
  });

  it('nao entrega a profissional fora do escopo do evento', () => {
    // O criterio de aceite da fase: notificacao nao vaza entre profissionais.
    const destinatarios = destinatariosDaNotificacao(usuarios, 'prof-ana', 'formulario_respondido');

    expect(destinatarios).not.toContain('prof-bruno');
  });

  it('nao entrega a nenhum profissional quando o evento nao tem dono', () => {
    // Sem responsavel identificado, mandar para todos os profissionais seria
    // exatamente o vazamento que a linha acima proibe.
    const destinatarios = destinatariosDaNotificacao(usuarios, undefined, 'formulario_respondido');

    expect(destinatarios).not.toContain('prof-ana');
    expect(destinatarios).not.toContain('prof-bruno');
  });

  it('nao repete o destinatario quando o responsavel tambem e SuperAdmin', () => {
    const destinatarios = destinatariosDaNotificacao(
      [{ id: 'admin-e-prof', role: 'SuperAdmin' }],
      'admin-e-prof',
      'formulario_respondido'
    );

    expect(destinatarios).toEqual(['admin-e-prof']);
  });
});
