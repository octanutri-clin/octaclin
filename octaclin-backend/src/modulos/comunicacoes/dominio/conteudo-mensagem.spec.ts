import { campoFicaEmClaro, juntarConteudoMensagem, separarConteudoMensagem } from './conteudo-mensagem';

describe('separarConteudoMensagem', () => {
  it('manda texto, assunto e nomes para o lado criptografado', () => {
    const { metadados, conteudo } = separarConteudoMensagem({
      destino: 'ana@example.com',
      assunto: 'Consulta agendada',
      texto: 'Ola Ana Souza, sua consulta foi agendada.',
      nomePaciente: 'Ana Souza',
      profissionalNome: 'Dra. Carla'
    });

    expect(metadados).toEqual({ destino: 'ana@example.com' });
    expect(conteudo).toEqual({
      assunto: 'Consulta agendada',
      texto: 'Ola Ana Souza, sua consulta foi agendada.',
      nomePaciente: 'Ana Souza',
      profissionalNome: 'Dra. Carla'
    });
  });

  it('mantem em claro o que a infra consulta em SQL', () => {
    const { metadados, conteudo } = separarConteudoMensagem({
      idExterno: 'wamid.123',
      resultadoEnvio: { idExterno: 'smtp-1' },
      ultimoStatusMeta: { recipientId: '5581999999999' },
      direcao: 'recebida',
      origem: 'whatsapp'
    });

    expect(conteudo).toBeUndefined();
    expect(metadados.idExterno).toBe('wamid.123');
    expect(metadados.resultadoEnvio).toEqual({ idExterno: 'smtp-1' });
    expect(metadados.ultimoStatusMeta).toEqual({ recipientId: '5581999999999' });
  });

  /*
   * Esta e a garantia que justifica allowlist: campo novo entra criptografado
   * sozinho. Com denylist, um `observacaoClinica` novo vazaria calado.
   */
  it('criptografa campo desconhecido por padrao', () => {
    const { metadados, conteudo } = separarConteudoMensagem({
      destino: 'ana@example.com',
      campoInventadoAmanha: 'diagnostico do paciente'
    });

    expect(metadados).toEqual({ destino: 'ana@example.com' });
    expect(conteudo).toEqual({ campoInventadoAmanha: 'diagnostico do paciente' });
  });

  it('nao cria bloco de conteudo quando so ha metadado', () => {
    expect(separarConteudoMensagem({ destino: 'ana@example.com' }).conteudo).toBeUndefined();
    expect(separarConteudoMensagem({}).conteudo).toBeUndefined();
    expect(separarConteudoMensagem().metadados).toEqual({});
  });

  it('leva os parametros do template WhatsApp para o lado criptografado', () => {
    // `components` carrega nome de paciente e profissional como parametros.
    const { conteudo } = separarConteudoMensagem({
      destino: '5581999999999',
      idioma: 'pt_BR',
      components: [{ type: 'body', parameters: [{ type: 'text', text: 'Ana Souza' }] }]
    });

    expect(conteudo).toHaveProperty('components');
  });

  it('leva o link de teleconsulta para o lado criptografado', () => {
    const { metadados, conteudo } = separarConteudoMensagem({
      destino: 'ana@example.com',
      linkTeleconsulta: 'https://meet.example.com/sala-privada'
    });

    expect(metadados).not.toHaveProperty('linkTeleconsulta');
    expect(conteudo?.linkTeleconsulta).toBe('https://meet.example.com/sala-privada');
  });
});

describe('juntarConteudoMensagem', () => {
  it('remonta o payload como quem escreveu entregou', () => {
    const original = {
      destino: 'ana@example.com',
      assunto: 'Consulta agendada',
      texto: 'Ola Ana.',
      consultaId: 'consulta-1'
    };
    const { metadados, conteudo } = separarConteudoMensagem(original);

    expect(juntarConteudoMensagem(metadados, conteudo)).toEqual(original);
  });

  it('funciona sem conteudo', () => {
    expect(juntarConteudoMensagem({ destino: 'ana@example.com' })).toEqual({ destino: 'ana@example.com' });
    expect(juntarConteudoMensagem()).toEqual({});
  });
});

describe('campoFicaEmClaro', () => {
  it('reconhece campo de roteamento e recusa campo de conteudo', () => {
    expect(campoFicaEmClaro('destino')).toBe(true);
    expect(campoFicaEmClaro('texto')).toBe(false);
  });
});
