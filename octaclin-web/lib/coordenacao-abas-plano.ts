export type EstadoCoordenacaoAbasPlano = 'inicializando' | 'editando' | 'consulta' | 'transferindo' | 'reconferir' | 'indisponivel' | 'encerrado';
export interface MensagemAbasPlano { v: 1; tipo: 'solicitar' | 'liberado'; de: string; pedido: string; para?: string }
export interface CanalAbasPlano {
  enviar: (mensagem: MensagemAbasPlano) => void;
  ouvir: (ouvinte: (mensagem: unknown) => void) => () => void;
  fechar: () => void;
}
export interface TravaAbasPlano { adquirir: (signal: AbortSignal) => Promise<(() => void) | null> }
export interface OpcoesCoordenacaoAbasPlano {
  instancia: string;
  iniciarEmConsulta?: boolean;
  trava?: TravaAbasPlano;
  canal?: CanalAbasPlano;
  conferir: (signal: AbortSignal) => Promise<boolean>;
  drenar: () => Promise<void>;
  notificar?: () => void;
}
function mensagemValida(valor: unknown): valor is MensagemAbasPlano {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const m = valor as Record<string, unknown>;
  const id = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,96}$/.test(v);
  return Object.keys(m).every(k => ['v', 'tipo', 'de', 'pedido', 'para'].includes(k))
    && m.v === 1 && id(m.de) && id(m.pedido)
    && (m.tipo === 'solicitar' ? m.para === undefined : m.tipo === 'liberado' && id(m.para));
}
/** Coordenação consultiva local. A revisão/autorização do servidor é obrigatória. */
export class CoordenacaoAbasPlano {
  private atual: EstadoCoordenacaoAbasPlano = 'inicializando';
  private readonly controlador = new AbortController();
  private liberar?: () => void;
  private desouvir?: () => void;
  private iniciado = false;
  private operacao = 0;
  private conferindo = false;
  private readonly ultimosPedidos = new Map<string, number>();
  private numeroPedido = 0;
  private espera?: { pedido: string; concluir: () => void; timer: ReturnType<typeof setTimeout> };
  constructor(private readonly opcoes: OpcoesCoordenacaoAbasPlano) {}
  get estado() { return this.atual; }
  get podeEditar() { return this.atual === 'editando' || this.atual === 'indisponivel'; }
  private mudar(estado: EstadoCoordenacaoAbasPlano) {
    if (this.atual === 'encerrado') return;
    this.atual = estado;
    this.opcoes.notificar?.();
  }
  private liberarTrava() { const liberar = this.liberar; this.liberar = undefined; liberar?.(); }
  private cancelarEspera() {
    const espera = this.espera; this.espera = undefined;
    if (espera) { clearTimeout(espera.timer); espera.concluir(); }
  }
  async iniciar() {
    if (this.iniciado || this.controlador.signal.aborted) return;
    this.iniciado = true;
    this.desouvir = this.opcoes.canal?.ouvir(m => { void this.receber(m); });
    if (this.opcoes.iniciarEmConsulta) this.mudar('consulta');
    else await this.adquirir();
  }
  private async adquirir(): Promise<'ocupado' | 'concluido'> {
    if (this.conferindo) return 'concluido';
    this.conferindo = true;
    const operacao = ++this.operacao;
    this.mudar('reconferir');
    try {
      const liberar = this.opcoes.trava ? await this.opcoes.trava.adquirir(this.controlador.signal) : undefined;
      if (this.controlador.signal.aborted || operacao !== this.operacao) { liberar?.(); return 'concluido'; }
      if (liberar === null) { this.mudar('consulta'); return 'ocupado'; }
      this.liberar = liberar;
      await this.conferir(operacao);
    } catch {
      if (operacao === this.operacao) { this.liberarTrava(); this.mudar('reconferir'); }
    }
    finally { this.conferindo = false; }
    return 'concluido';
  }
  private async conferir(operacao: number) {
    const permitido = await this.opcoes.conferir(this.controlador.signal);
    if (this.controlador.signal.aborted || operacao !== this.operacao) return;
    if (!permitido) { this.liberarTrava(); this.mudar('reconferir'); return; }
    this.mudar(this.opcoes.trava ? 'editando' : 'indisponivel');
  }
  async assumir() {
    if (!this.iniciado || !['consulta', 'reconferir'].includes(this.atual) || this.espera) return;
    if (await this.adquirir() !== 'ocupado' || !this.opcoes.canal || this.controlador.signal.aborted) return;
    const pedido = `${this.opcoes.instancia}-${++this.numeroPedido}`;
    this.mudar('transferindo');
    await new Promise<void>(concluir => {
      const timer = setTimeout(() => {
        if (this.espera?.pedido !== pedido) return;
        this.mudar('consulta'); this.cancelarEspera();
      }, 8_000);
      this.espera = { pedido, concluir, timer };
      try { this.opcoes.canal!.enviar({ v: 1, tipo: 'solicitar', de: this.opcoes.instancia, pedido }); }
      catch { this.mudar('consulta'); this.cancelarEspera(); }
    });
  }
  private async receber(valor: unknown) {
    if (this.controlador.signal.aborted || !mensagemValida(valor) || valor.de === this.opcoes.instancia) return;
    if (valor.tipo === 'liberado') {
      if (valor.para !== this.opcoes.instancia || valor.pedido !== this.espera?.pedido) return;
      // Consome a correlação antes do await; replay não inicia outra aquisição.
      const espera = this.espera!; this.espera = undefined; clearTimeout(espera.timer);
      try { await this.adquirir(); } finally { espera.concluir(); }
      return;
    }
    if (this.atual !== 'editando') return;
    const prefixo = `${valor.de}-`;
    const numero = valor.pedido.startsWith(prefixo) ? Number(valor.pedido.slice(prefixo.length)) : NaN;
    if (!Number.isSafeInteger(numero) || numero < 1 || numero <= (this.ultimosPedidos.get(valor.de) ?? 0)) return;
    if (!this.ultimosPedidos.has(valor.de) && this.ultimosPedidos.size >= 64) return;
    this.ultimosPedidos.set(valor.de, numero);
    this.mudar('transferindo'); // Suspensão síncrona, antes de drenar o envio.
    const operacao = ++this.operacao;
    try {
      await this.opcoes.drenar();
      if (this.controlador.signal.aborted || operacao !== this.operacao) return;
      this.liberarTrava(); this.mudar('consulta');
      this.opcoes.canal?.enviar({ v: 1, tipo: 'liberado', de: this.opcoes.instancia, para: valor.de, pedido: valor.pedido });
    } catch {
      if (operacao === this.operacao) { this.liberarTrava(); this.mudar('reconferir'); }
    }
  }
  async revalidar() {
    if (!this.podeEditar || this.conferindo || this.controlador.signal.aborted) return;
    this.conferindo = true;
    this.mudar('reconferir');
    const operacao = ++this.operacao;
    try {
      await this.opcoes.drenar();
      if (!this.controlador.signal.aborted && operacao === this.operacao) await this.conferir(operacao);
    } catch {
      if (operacao === this.operacao) { this.liberarTrava(); this.mudar('reconferir'); }
    } finally { this.conferindo = false; }
  }
  encerrar() {
    if (this.controlador.signal.aborted) return;
    this.operacao++;
    this.controlador.abort();
    this.cancelarEspera();
    this.liberarTrava();
    this.desouvir?.(); this.opcoes.canal?.fechar();
    this.mudar('encerrado');
  }
}
