import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoAgenda } from '../../agenda/aplicacao/servico-agenda';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoPortalPaciente } from '../aplicacao/servico-portal-paciente';
import { ControladorPortalPaciente } from './controlador-portal-paciente';

/**
 * O portal do paciente e o call site com a maior concentracao de PHI por linha
 * de trilha: quem chama e o proprio titular, e tudo que ele envia e sobre ele.
 * Estes casos cobrem as duas pontas da mesma decisao -- o que nao pode chegar a
 * `user_action_logs`, e o que nao pode ser apagado dela.
 */
describe('ControladorPortalPaciente', () => {
  const usuario: UsuarioAutenticado = {
    usuarioId: 'usuario-1',
    tenantId: 'tenant-1',
    papel: 'Patient',
    emailHash: 'hash',
    permissoes: []
  };

  function criarCenario(servicos: Record<string, unknown> = {}) {
    const registrar = jest.fn().mockResolvedValue(undefined);
    const registrarCheckinRapido = jest.fn().mockResolvedValue({
      id: 'checkin-1',
      pacienteId: 'paciente-1',
      humor: 'muito_mal',
      adesaoPlano: 20
    });
    const registrarConsentimentoLgpd = jest.fn().mockResolvedValue({ paciente: { id: 'paciente-1' } });
    const exportarDadosLgpd = jest.fn().mockResolvedValue({
      formato: 'json',
      titular: { pacienteId: 'paciente-1' },
      escopo: { categorias: ['cadastro', 'consultas'] },
      geradoEm: '2026-09-02T12:00:00.000Z',
      integridade: { hash: 'a'.repeat(64) }
    });

    const controlador = new ControladorPortalPaciente(
      {
        registrarCheckinRapido,
        registrarConsentimentoLgpd,
        exportarDadosLgpd,
        ...servicos
      } as unknown as ServicoPortalPaciente,
      {} as ServicoAgenda,
      { registrar } as unknown as ServicoAuditoria
    );

    const requisicao = {
      header: jest.fn(),
      headers: { 'user-agent': 'jest' },
      ip: '127.0.0.1'
    } as unknown as Request;

    return { controlador, registrar, requisicao };
  }

  describe('check-in rapido', () => {
    /**
     * Teste negativo do vazamento que este PR fechou. O mesmo objeto de
     * metadados reduzia `sintomas` e `observacoes` a booleano por serem
     * clinicos, e gravava `humor` e `adesaoPlano` crus ao lado. Serem enum e
     * escala em vez de texto livre muda o formato, nao a natureza.
     */
    it('nao deve deixar humor nem adesao do paciente chegarem a trilha', async () => {
      const { controlador, registrar, requisicao } = criarCenario();

      await controlador.registrarCheckinRapido(usuario, requisicao, {
        humor: 'muito_mal',
        adesaoPlano: 20,
        sintomas: 'tontura pela manha',
        observacoes: 'nao consegui almocar'
      } as never);

      const entrada = registrar.mock.calls[0][0] as { metadados: Record<string, unknown> };
      const serializado = JSON.stringify(entrada.metadados);

      expect(serializado).not.toContain('muito_mal');
      expect(serializado).not.toContain('tontura');
      expect(serializado).not.toContain('almocar');
      expect(entrada.metadados).toEqual({
        pacienteId: 'paciente-1',
        possuiSintomas: true,
        possuiObservacoes: true
      });
    });

    it('deve declarar ausencia de texto clinico em vez de omitir os campos', async () => {
      const { controlador, registrar, requisicao } = criarCenario();

      await controlador.registrarCheckinRapido(usuario, requisicao, {
        humor: 'bem',
        adesaoPlano: 90
      } as never);

      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          metadados: { pacienteId: 'paciente-1', possuiSintomas: false, possuiObservacoes: false }
        })
      );
    });
  });

  describe('evidencia de LGPD que a trilha existe para guardar', () => {
    /**
     * O outro lado da mesma moeda. A trilha e imutavel: apagar estas flags
     * destroi de forma definitiva a unica prova de a quais canais o titular
     * consentiu. Elas sao a evidencia, e nao o dado.
     */
    it('deve registrar as flags de consentimento por canal', async () => {
      const { controlador, registrar, requisicao } = criarCenario();

      await controlador.registrarConsentimentoLgpd(usuario, requisicao, {
        versaoLgpd: '2026-01',
        prefereEmail: true,
        prefereWhatsapp: false
      } as never);

      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'portal.paciente.lgpd.consentimento_registrar',
          metadados: {
            versaoLgpd: '2026-01',
            preferenciasContato: { email: true, whatsapp: false }
          }
        })
      );
    });

    /**
     * `hashIntegridade` e o digest do artefato entregue ao proprio titular. O
     * registro da exportacao nao guarda id nenhum do arquivo: apagado o digest,
     * some a unica prova de *qual* artefato foi entregue.
     */
    it('deve registrar o hash de integridade do artefato entregue ao titular', async () => {
      const { controlador, registrar, requisicao } = criarCenario();

      await controlador.exportarDadosLgpd(usuario, requisicao);

      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'portal.paciente.lgpd.exportar_dados',
          metadados: expect.objectContaining({ hashIntegridade: 'a'.repeat(64) })
        })
      );
    });
  });
});
