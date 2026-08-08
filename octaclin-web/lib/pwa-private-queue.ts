const NOME_BANCO = 'octaclin-pwa-private-v1';
const NOME_STORE = 'operacoes';
const EVENTO_FILA = 'octaclin:pwa-fila';
const EVENTO_SINCRONIZADO = 'octaclin:pwa-operacao-sincronizada';

export type TipoOperacaoPwa = 'checkin' | 'formulario';

interface OperacaoPwa {
  id: string;
  tipo: TipoOperacaoPwa;
  endpoint: string;
  method: 'POST';
  payload: unknown;
}

interface RegistroCriptografado {
  id: string;
  tipo: TipoOperacaoPwa;
  criadoEm: number;
  iv: number[];
  cifra: ArrayBuffer;
}

let chaveSessao: CryptoKey | null = null;
let inicializacao: Promise<void> | null = null;
let processamento: Promise<number> | null = null;

function noNavegador() {
  return typeof window !== 'undefined' && 'indexedDB' in window && Boolean(window.crypto?.subtle);
}

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const requisicao = indexedDB.open(NOME_BANCO, 1);
    requisicao.onupgradeneeded = () => {
      if (!requisicao.result.objectStoreNames.contains(NOME_STORE)) {
        requisicao.result.createObjectStore(NOME_STORE, { keyPath: 'id' });
      }
    };
    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () => reject(requisicao.error);
  });
}

async function executarStore<T>(
  modo: IDBTransactionMode,
  executar: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const banco = await abrirBanco();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transacao = banco.transaction(NOME_STORE, modo);
      const requisicao = executar(transacao.objectStore(NOME_STORE));
      requisicao.onsuccess = () => resolve(requisicao.result);
      requisicao.onerror = () => reject(requisicao.error);
      transacao.onerror = () => reject(transacao.error);
    });
  } finally {
    banco.close();
  }
}

function notificarFila() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_FILA));
}

async function inicializar() {
  if (!noNavegador()) return;
  if (!inicializacao) {
    inicializacao = (async () => {
      const total = await executarStore('readonly', (store) => store.count());
      // A chave nunca e persistida. Apos reload, qualquer fila antiga e irrecuperavel
      // por desenho e deve ser eliminada para nao reter dado clinico no dispositivo.
      if (total > 0 && !chaveSessao) await executarStore('readwrite', (store) => store.clear());
    })();
  }
  await inicializacao;
}

async function obterChave() {
  if (!chaveSessao) {
    chaveSessao = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  return chaveSessao;
}

async function criptografar(operacao: OperacaoPwa): Promise<RegistroCriptografado> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifra = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await obterChave(),
    new TextEncoder().encode(JSON.stringify(operacao))
  );
  return { id: operacao.id, tipo: operacao.tipo, criadoEm: Date.now(), iv: Array.from(iv), cifra };
}

async function descriptografar(registro: RegistroCriptografado): Promise<OperacaoPwa> {
  if (!chaveSessao) throw new Error('Fila offline sem chave da sessao.');
  const claro = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(registro.iv) },
    chaveSessao,
    registro.cifra
  );
  return JSON.parse(new TextDecoder().decode(claro)) as OperacaoPwa;
}

export function ehFalhaDeRede(erro: unknown) {
  return (typeof navigator !== 'undefined' && !navigator.onLine) || erro instanceof TypeError;
}

export async function enfileirarOperacaoPwa(operacao: OperacaoPwa) {
  if (!noNavegador()) throw new Error('Armazenamento offline indisponivel neste navegador.');
  await inicializar();
  const registro = await criptografar(operacao);
  await executarStore('readwrite', (store) => store.put(registro));
  notificarFila();
}

export async function contarOperacoesPwa() {
  if (!noNavegador()) return 0;
  await inicializar();
  return executarStore('readonly', (store) => store.count());
}

export async function processarOperacoesPwa(): Promise<number> {
  if (!noNavegador() || !navigator.onLine) return 0;
  if (processamento) return processamento;
  processamento = (async () => {
    await inicializar();
    if (!chaveSessao) return 0;
    const registros = await executarStore<RegistroCriptografado[]>('readonly', (store) => store.getAll());
    let sincronizadas = 0;
    for (const registro of registros.sort((a, b) => a.criadoEm - b.criadoEm)) {
      let operacao: OperacaoPwa;
      try {
        operacao = await descriptografar(registro);
      } catch {
        await executarStore('readwrite', (store) => store.delete(registro.id));
        continue;
      }

      let resposta: Response;
      try {
        resposta = await fetch(operacao.endpoint, {
          method: operacao.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operacao.payload)
        });
      } catch {
        break;
      }

      if (resposta.status === 401) {
        await purgarDadosPrivadosPwa();
        return sincronizadas;
      }
      if (resposta.status >= 500) break;

      await executarStore('readwrite', (store) => store.delete(registro.id));
      if (resposta.ok) {
        sincronizadas += 1;
        window.dispatchEvent(new CustomEvent(EVENTO_SINCRONIZADO, { detail: { tipo: operacao.tipo } }));
      }
    }
    notificarFila();
    return sincronizadas;
  })().finally(() => {
    processamento = null;
  });
  return processamento;
}

export async function purgarDadosPrivadosPwa() {
  chaveSessao = null;
  inicializacao = null;
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  await new Promise<void>((resolve) => {
    const requisicao = indexedDB.deleteDatabase(NOME_BANCO);
    requisicao.onsuccess = () => resolve();
    requisicao.onerror = () => resolve();
    requisicao.onblocked = () => resolve();
  });
  navigator.serviceWorker?.controller?.postMessage({ tipo: 'PURGAR_DADOS_PRIVADOS' });
  notificarFila();
}

export function assinarMudancasFila(listener: () => void) {
  window.addEventListener(EVENTO_FILA, listener);
  return () => window.removeEventListener(EVENTO_FILA, listener);
}

export function assinarOperacoesSincronizadas(listener: (tipo: TipoOperacaoPwa) => void) {
  const tratar = (evento: Event) => listener((evento as CustomEvent<{ tipo: TipoOperacaoPwa }>).detail.tipo);
  window.addEventListener(EVENTO_SINCRONIZADO, tratar);
  return () => window.removeEventListener(EVENTO_SINCRONIZADO, tratar);
}

export function criarIdOperacaoPwa(prefixo: string) {
  return `${prefixo}-${crypto.randomUUID()}`;
}
