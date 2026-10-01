import { createHash } from 'crypto';

export interface NutrientesCatalogoFonte {
  energiaKcal: number | null;
  proteinasG: number | null;
  carboidratosG: number | null;
  lipidiosG: number | null;
  fibrasG: number | null;
  sodioMg: number | null;
}

export interface RegistroCatalogoFonte {
  externalId: string;
  nome: string;
  preparacao?: string;
  baseGramas: number;
  nutrientes: NutrientesCatalogoFonte;
  metadadosOrigem: Record<string, unknown>;
}

export interface ManifestoCatalogoFonte {
  codigo: string;
  nome: string;
  instituicao: string;
  versao: string;
  baseCodigo: string;
  urlFonte: string;
  urlArtefato: string;
  licenca: string;
  checksumArquivo: string;
  hashConteudo: string;
  capturadaEm: string;
  esquemaVersao: string;
  contagem: Record<string, number>;
  metadadosOrigem?: Record<string, unknown>;
}

export interface CatalogoFonteNormalizado {
  fonte: ManifestoCatalogoFonte;
  registros: RegistroCatalogoFonte[];
}

export function sha256Catalogo(valor: string | Buffer): string {
  return createHash('sha256').update(valor).digest('hex');
}

function ordenarChaves(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarChaves);
  if (!valor || typeof valor !== 'object') return valor;
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([chave, item]) => [chave, ordenarChaves(item)])
  );
}

export function serializarCatalogoCanonico(valor: unknown): string {
  return JSON.stringify(ordenarChaves(valor));
}

export function calcularHashRegistroCatalogo(registro: RegistroCatalogoFonte): string {
  return sha256Catalogo(serializarCatalogoCanonico(registro));
}

export function calcularHashConteudoCatalogo(registros: RegistroCatalogoFonte[]): string {
  return sha256Catalogo(serializarCatalogoCanonico(registros));
}

export function limitarPrecisaoNutriente(valor: number | null): number | null {
  if (valor === null) return null;
  const resultado = Math.round((valor + Number.EPSILON) * 100_000_000) / 100_000_000;
  return Object.is(resultado, -0) ? 0 : resultado;
}

export function validarCatalogoFonte(catalogo: CatalogoFonteNormalizado): void {
  const { fonte, registros } = catalogo;
  if (!fonte.codigo.trim() || !fonte.versao.trim() || !fonte.baseCodigo.trim()) {
    throw new Error('Catálogo sem identidade completa de fonte, versão e base.');
  }
  if (!fonte.nome.trim() || !fonte.instituicao.trim() || !fonte.urlFonte.trim() || !fonte.urlArtefato.trim() || !fonte.licenca.trim()) {
    throw new Error('Catálogo sem nome, instituição, referência ou licença da fonte.');
  }
  if (!/^[0-9a-f]{64}$/i.test(fonte.checksumArquivo)) {
    throw new Error('Catálogo com checksum de arquivo inválido.');
  }
  if (!/^[0-9a-f]{64}$/i.test(fonte.hashConteudo)) throw new Error('Catálogo com hash de conteúdo inválido.');
  if (!fonte.esquemaVersao.trim() || Number.isNaN(Date.parse(fonte.capturadaEm))) {
    throw new Error('Catálogo sem esquema ou data de captura válida.');
  }
  if (calcularHashConteudoCatalogo(registros) !== fonte.hashConteudo) {
    throw new Error('Hash do conteúdo normalizado não confere.');
  }
  const ids = new Set<string>();
  for (const registro of registros) {
    if (!registro.externalId.trim() || registro.externalId.length > 120 || !registro.nome.trim() || registro.nome.length > 240) {
      throw new Error('Registro sem externalId ou nome.');
    }
    if (registro.preparacao && registro.preparacao.length > 180) {
      throw new Error(`Preparação acima do limite no registro ${registro.externalId}.`);
    }
    if (ids.has(registro.externalId)) throw new Error(`externalId duplicado no catálogo: ${registro.externalId}.`);
    ids.add(registro.externalId);
    if (!Number.isFinite(registro.baseGramas) || registro.baseGramas <= 0) {
      throw new Error(`Base inválida no registro ${registro.externalId}.`);
    }
    for (const valor of Object.values(registro.nutrientes)) {
      if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
        throw new Error(`Nutriente inválido no registro ${registro.externalId}.`);
      }
    }
  }
}
