import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { CHAVE_PAPEIS } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ControladorIa } from './controlador-ia';

const usuario: UsuarioAutenticado = {
  usuarioId: 'usuario-1',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash',
  permissoes: ['ia.executar']
};

describe('ControladorIa', () => {
  it('restringe o modulo a SuperAdmin e Professional', () => {
    expect(Reflect.getMetadata(CHAVE_PAPEIS, ControladorIa)).toEqual(['SuperAdmin', 'Professional']);
  });

  it('consome o limite antes de enviar sentimento ao servico', async () => {
    const protecaoAbuso = { consumirTentativa: jest.fn(async () => undefined) };
    const servicoIa = {
      analisarSentimento: jest.fn(async () => ({ id: 'analise-1', alertaDisparado: false }))
    };
    const auditoria = { registrar: jest.fn(async () => undefined) };
    const controlador = new ControladorIa(servicoIa as never, auditoria as never, protecaoAbuso as never);

    await controlador.analisarSentimento(
      usuario,
      { ip: '127.0.0.1', headers: {} } as never,
      { pacienteId: '11111111-1111-4111-8111-111111111111', texto: 'Relato sintetico.' }
    );

    expect(protecaoAbuso.consumirTentativa).toHaveBeenCalledWith(
      'ia:sentimento:tenant:tenant-1',
      expect.objectContaining({ maxTentativas: 120, janelaMs: 15 * 60 * 1000 })
    );
    expect(protecaoAbuso.consumirTentativa).toHaveBeenCalledWith(
      'ia:sentimento:tenant-1:usuario-1',
      expect.objectContaining({ maxTentativas: 30, janelaMs: 15 * 60 * 1000 })
    );
    expect(protecaoAbuso.consumirTentativa).toHaveBeenCalledTimes(2);
    expect(protecaoAbuso.consumirTentativa.mock.invocationCallOrder[0])
      .toBeLessThan(servicoIa.analisarSentimento.mock.invocationCallOrder[0]);
  });

  it('nao executa IA quando o limite agregado do tenant e recusado', async () => {
    const protecaoAbuso = {
      consumirTentativa: jest.fn(async (chave: string) => {
        if (chave === 'ia:sentimento:tenant:tenant-1') throw new Error('limite do tenant');
      })
    };
    const servicoIa = { analisarSentimento: jest.fn() };
    const controlador = new ControladorIa(servicoIa as never, { registrar: jest.fn() } as never, protecaoAbuso as never);

    await expect(controlador.analisarSentimento(
      usuario,
      { ip: '127.0.0.1', headers: {} } as never,
      { pacienteId: '11111111-1111-4111-8111-111111111111', texto: 'Relato sintetico.' }
    )).rejects.toThrow('limite do tenant');

    expect(servicoIa.analisarSentimento).not.toHaveBeenCalled();
  });

  describe('trilha do acesso a dado clinico', () => {
    const requisicao = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } } as never;
    const relato = 'A paciente Sintetica relatou ansiedade antes das refeicoes e enjoo pela manha.';

    const montar = (servicoIa: Record<string, unknown>) => {
      const auditoria = { registrar: jest.fn(async (_entrada: Record<string, unknown>) => undefined) };
      const protecaoAbuso = { consumirTentativa: jest.fn(async () => undefined) };
      const controlador = new ControladorIa(servicoIa as never, auditoria as never, protecaoAbuso as never);
      return { controlador, auditoria };
    };

    it('registra a analise de sentimento com metadado operacional, e nunca com o texto enviado', async () => {
      const { controlador, auditoria } = montar({
        analisarSentimento: jest.fn(async () => ({
          id: 'analise-1',
          modelo: 'sentimento-v2',
          alertaDisparado: true,
          explicacao: { provedor: 'servico-ia-interno', sinais: { ansiedade: ['antes das refeicoes'] } }
        }))
      });

      await controlador.analisarSentimento(usuario, requisicao, {
        pacienteId: '11111111-1111-4111-8111-111111111111',
        texto: relato,
        contexto: { origem: 'checkin_manual' }
      });

      const entrada = auditoria.registrar.mock.calls[0][0];
      expect(entrada).toMatchObject({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        acao: 'ia.sentimento.analisar',
        recursoTipo: 'analise_sentimento',
        recursoId: 'analise-1',
        metadados: {
          pacienteId: '11111111-1111-4111-8111-111111111111',
          origemContexto: 'checkin_manual',
          modelo: 'sentimento-v2',
          tamanhoTextoCaracteres: relato.length
        }
      });
      expect((entrada as { metadados: { duracaoMs: number } }).metadados.duracaoMs).toBeGreaterThanOrEqual(0);
      // `alertaDisparado` e a classificacao de risco do paciente (derivada de
      // `frustracaoScore >= 70`), e nao o rastro do acesso. Fica fora da trilha
      // pela mesma razao que `humor` e `adesaoPlano` ficaram.
      expect(entrada.metadados).not.toHaveProperty('alertaDisparado');

      // O prompt e a explicacao do provedor sao o dado clinico. Gravar
      // qualquer um deles no log do acesso ao dado anula a separacao de papeis
      // que a trilha existe para sustentar.
      const serializada = JSON.stringify(entrada);
      expect(serializada).not.toContain(relato);
      expect(serializada).not.toContain('Sintetica');
      expect(serializada).not.toContain('ansiedade');
      expect(serializada).not.toContain('antes das refeicoes');
    });

    it('registra o reconhecimento alimentar sem os alimentos inferidos', async () => {
      const { controlador, auditoria } = montar({
        reconhecerAlimento: jest.fn(async () => ({
          id: 'reconhecimento-1',
          provedor: 'visao-alimentar-sintetica',
          imagemHash: 'f'.repeat(64),
          alimentosDetectados: [{ nome: 'arroz integral', confianca: 0.9 }, { nome: 'file de frango', confianca: 0.8 }]
        }))
      });

      await controlador.reconhecerAlimento(usuario, requisicao, {
        pacienteId: '11111111-1111-4111-8111-111111111111',
        arquivoMidiaId: '22222222-2222-4222-8222-222222222222',
        contexto: { observacao: 'Almoco da paciente Sintetica no domingo.' }
      });

      const entrada = auditoria.registrar.mock.calls[0][0];
      expect(entrada).toMatchObject({
        acao: 'ia.reconhecimento_alimentar.criar',
        recursoTipo: 'reconhecimento_alimentar',
        recursoId: 'reconhecimento-1',
        metadados: {
          arquivoMidiaId: '22222222-2222-4222-8222-222222222222',
          totalAlimentos: 2,
          provedor: 'visao-alimentar-sintetica'
        }
      });
      const serializada = JSON.stringify(entrada);
      expect(serializada).not.toContain('arroz integral');
      expect(serializada).not.toContain('file de frango');
      expect(serializada).not.toContain('Almoco da paciente');
    });

    it('registra a revisao humana pela decisao, sem a correcao clinica escrita pelo profissional', async () => {
      const { controlador, auditoria } = montar({
        revisarAnaliseSentimento: jest.fn(async () => ({ id: 'analise-1' }))
      });

      await controlador.revisarAnaliseSentimento(usuario, requisicao, 'analise-1', {
        decisao: 'editada',
        observacao: 'O escore de ansiedade nao reflete o quadro clinico da paciente.',
        conteudoEditado: { ansiedade_score: 20 }
      });

      const entrada = auditoria.registrar.mock.calls[0][0];
      expect(entrada).toMatchObject({
        acao: 'ia.sentimento.revisar',
        metadados: { decisao: 'editada', houveTextoLivre: true, conteudoEditadoInformado: true }
      });
      const serializada = JSON.stringify(entrada);
      expect(serializada).not.toContain('quadro clinico');
      expect(serializada).not.toContain('ansiedade_score');
    });

    it('nao deixa a trilha indisponivel derrubar a inferencia ja executada', async () => {
      // `ServicoAuditoria` de verdade com o executor de banco falhando: a
      // resposta da IA ja foi produzida e persistida quando a trilha e
      // chamada, entao propagar a falha aqui descartaria trabalho concluido
      // sem impedir nenhum acesso.
      const executorTenant = {
        executar: jest.fn(async () => {
          throw new Error('trilha indisponivel');
        })
      };
      const auditoria = new ServicoAuditoria(executorTenant as never);
      const servicoIa = { analisarSentimento: jest.fn(async () => ({ id: 'analise-1', modelo: 'v2', alertaDisparado: false })) };
      const protecaoAbuso = { consumirTentativa: jest.fn(async () => undefined) };
      const controlador = new ControladorIa(servicoIa as never, auditoria, protecaoAbuso as never);

      await expect(
        controlador.analisarSentimento(usuario, requisicao, {
          pacienteId: '11111111-1111-4111-8111-111111111111',
          texto: relato
        })
      ).resolves.toMatchObject({ id: 'analise-1' });
      expect(auditoria.obterTotalFalhas()).toBe(1);
    });
  });
});
