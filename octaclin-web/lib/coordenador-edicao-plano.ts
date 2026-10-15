export const INTERVALO_AUTOSAVE_PLANO = 60_000;
export type EstadoSalvamentoPlano = 'salvo' | 'alterado' | 'salvando' | 'erro' | 'conflito' | 'incerto' | 'acesso-negado';
export interface PrecondicaoEdicaoPlano {
  rascunhoIdEsperado: string;
  rascunhoRevisaoEsperada: number;
}
export interface OpcoesCoordenadorEdicao<T> {
  documentoInicial: T;
  precondicao: PrecondicaoEdicaoPlano;
  enviar: (documento: T, precondicao: PrecondicaoEdicaoPlano, signal: AbortSignal) => Promise<{ id: string; rascunhoRevisao: number }>;
  notificar?: () => void;
  agendar?: (tarefa: () => void, intervalo: number) => () => void;
}
const bloqueios = new Set<EstadoSalvamentoPlano>(['conflito', 'incerto', 'acesso-negado']);
/** Uma instância por geração/contexto. Somente memória; encerrar nunca grava. */
export class CoordenadorEdicaoPlano<T> {
  private assinatura: string;
  private confirmada: string;
  private precondicao: PrecondicaoEdicaoPlano;
  private status: EstadoSalvamentoPlano = 'salvo';
  private habilitado = true;
  private suspenso = false;
  private pausado = false;
  private encerrado = false;
  private solicitado = false;
  private voo?: Promise<void>;
  private cancelarCiclo?: () => void;
  private abortar?: AbortController;
  constructor(private readonly opcoes: OpcoesCoordenadorEdicao<T>) {
    this.assinatura = this.confirmada = JSON.stringify(opcoes.documentoInicial);
    this.precondicao = { ...opcoes.precondicao };
  }
  iniciar() {
    if (this.encerrado || this.cancelarCiclo) return;
    const agendar = this.opcoes.agendar ?? ((tarefa, intervalo) => {
      const timer = setInterval(tarefa, intervalo);
      return () => clearInterval(timer);
    });
    this.cancelarCiclo = agendar(() => {
      if (this.habilitado && !this.pausado && !this.suspenso) void this.solicitar();
    }, INTERVALO_AUTOSAVE_PLANO);
  }
  alterar(documento: T) {
    if (this.encerrado) return;
    this.assinatura = JSON.stringify(documento);
    if (!this.voo && !this.pausado) this.status = this.alterado ? 'alterado' : 'salvo';
    this.notificar();
  }
  configurar(opcoes: { habilitado?: boolean; suspenso?: boolean }) {
    if (opcoes.habilitado !== undefined) this.habilitado = opcoes.habilitado;
    if (opcoes.suspenso !== undefined) this.suspenso = opcoes.suspenso;
    // Cancelar só solicitações que ainda não começaram. Não promete desfazer o request em voo.
    if (!this.habilitado || this.suspenso) this.solicitado = false;
  }
  private get alterado() { return this.assinatura !== this.confirmada; }
  get estado() {
    return { status: this.status, alterado: this.alterado || this.status === 'salvando' || this.status === 'incerto', precondicao: { ...this.precondicao } };
  }
  /** Uma transição recusada/incerta não pode ser destravada por fim de IME. */
  invalidar(status: 'conflito' | 'incerto' | 'acesso-negado') {
    if (!this.encerrado) this.falhar(status);
  }
  async salvarManual(): Promise<boolean> {
    if (this.encerrado || this.suspenso || bloqueios.has(this.status)) return false;
    this.pausado = false; // Reenvio após rejeição validada exige ação explícita.
    if (!this.voo && !this.alterado) {
      this.status = 'salvo'; this.notificar(); return true;
    }
    await this.solicitar();
    return !this.encerrado && !this.alterado && this.status === 'salvo';
  }
  private solicitar(): Promise<void> {
    if (this.encerrado || this.suspenso || this.pausado || (!this.alterado && !this.voo)) return this.voo ?? Promise.resolve();
    this.solicitado = true;
    if (!this.voo) {
      this.voo = this.executar().finally(() => { this.voo = undefined; });
    }
    return this.voo;
  }
  private async executar() {
    while (this.solicitado && !this.encerrado && !this.suspenso && !this.pausado && this.alterado) {
      this.solicitado = false;
      const assinaturaEnviada = this.assinatura;
      const documentoEnviado = JSON.parse(assinaturaEnviada) as T;
      const precondicaoEnviada = { ...this.precondicao };
      this.abortar = new AbortController();
      this.status = 'salvando'; this.notificar();
      try {
        const ack = await this.opcoes.enviar(documentoEnviado, precondicaoEnviada, this.abortar.signal);
        if (this.encerrado) return;
        if (ack.id !== precondicaoEnviada.rascunhoIdEsperado || !Number.isSafeInteger(ack.rascunhoRevisao) || ack.rascunhoRevisao !== precondicaoEnviada.rascunhoRevisaoEsperada + 1) {
          this.falhar('incerto'); return;
        }
        this.precondicao.rascunhoRevisaoEsperada = ack.rascunhoRevisao;
        this.confirmada = assinaturaEnviada;
        // Nunca aplica o documento retornado sobre campos, chaves, foco ou IME locais.
        this.status = this.alterado ? 'alterado' : 'salvo'; this.notificar();
      } catch (erro) {
        if (this.encerrado) return;
        const codigo = typeof erro === 'object' && erro !== null && 'status' in erro ? erro.status : undefined;
        this.falhar(codigo === 409 ? 'conflito' : [401, 403, 404].includes(codigo as number) ? 'acesso-negado' : [400, 413, 422, 429].includes(codigo as number) ? 'erro' : 'incerto');
      } finally { this.abortar = undefined; }
    }
    this.solicitado = false;
  }
  private falhar(status: EstadoSalvamentoPlano) {
    this.status = status; this.pausado = true; this.solicitado = false; this.notificar();
  }
  private notificar() { if (!this.encerrado) this.opcoes.notificar?.(); }
  encerrar() {
    this.encerrado = true; this.solicitado = false;
    this.cancelarCiclo?.(); this.cancelarCiclo = undefined;
    this.abortar?.abort();
  }
}
