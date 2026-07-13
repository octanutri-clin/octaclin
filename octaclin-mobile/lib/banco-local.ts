import * as SQLite from 'expo-sqlite';

let banco: SQLite.SQLiteDatabase | null = null;

function criarIdLocal() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function obterBanco() {
  if (!banco) {
    banco = await SQLite.openDatabaseAsync('octaclin-offline.db');
  }
  return banco;
}

export async function inicializarBancoLocal() {
  const db = await obterBanco();
  await db.execAsync(`
    create table if not exists fila_sincronizacao (
      id text primary key,
      tipo text not null,
      payload text not null,
      criado_em text not null,
      sincronizado_em text
    );
  `);
}

export async function enfileirarSincronizacao(tipo: string, payload: Record<string, unknown>) {
  const db = await obterBanco();
  await db.runAsync(
    'insert into fila_sincronizacao (id, tipo, payload, criado_em) values (?, ?, ?, ?)',
    criarIdLocal(),
    tipo,
    JSON.stringify(payload),
    new Date().toISOString()
  );
}

export interface ItemFilaSincronizacao {
  id: string;
  tipo: string;
  payload: string;
  criado_em: string;
}

export async function listarPendentes(limite = 50) {
  const db = await obterBanco();
  return db.getAllAsync<ItemFilaSincronizacao>(
    'select id, tipo, payload, criado_em from fila_sincronizacao where sincronizado_em is null order by criado_em asc limit ?',
    limite
  );
}

export async function marcarSincronizado(id: string) {
  const db = await obterBanco();
  await db.runAsync('update fila_sincronizacao set sincronizado_em = ? where id = ?', new Date().toISOString(), id);
}

export async function contarPendentes() {
  const db = await obterBanco();
  const resultado = await db.getFirstAsync<{ total: number }>(
    'select count(*) as total from fila_sincronizacao where sincronizado_em is null'
  );
  return resultado?.total ?? 0;
}
