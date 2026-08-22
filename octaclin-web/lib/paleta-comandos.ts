import { MODULOS_CONSOLE, modulosConsolePermitidos } from './navegacao-console';

export interface ContextoComandos {
  papel?: string;
  permissoes: readonly string[];
}

export interface ComandoPaleta {
  id: string;
  rotulo: string;
  descricao: string;
  href: string;
  grupo: 'Navegação' | 'Ações';
  permissao: string;
  papeisPermitidos?: readonly string[];
  atalho?: string;
  termos?: readonly string[];
}

const COMANDOS_NAVEGACAO: readonly ComandoPaleta[] = MODULOS_CONSOLE.map((modulo) => ({
  id: `navegar-${modulo.id}`,
  rotulo: modulo.rotulo,
  descricao: modulo.descricao,
  href: modulo.href,
  grupo: 'Navegação',
  permissao: modulo.permissao,
  papeisPermitidos: modulo.papeisPermitidos,
  atalho: modulo.atalho,
  termos: modulo.termos
}));

export const COMANDOS_PALETA: readonly ComandoPaleta[] = [
  ...COMANDOS_NAVEGACAO,
  {
    id: 'novo-agendamento',
    rotulo: 'Novo agendamento',
    descricao: 'Abrir a agenda pronta para cadastrar uma consulta',
    href: '/agenda#novo-agendamento',
    grupo: 'Ações',
    permissao: 'agenda.consultas.criar',
    atalho: 'N A',
    termos: ['agendar', 'consulta', 'horario']
  },
  {
    id: 'novo-paciente',
    rotulo: 'Novo paciente',
    descricao: 'Abrir o cadastro de paciente',
    href: '/pacientes/novo',
    grupo: 'Ações',
    permissao: 'pacientes.gerenciar',
    atalho: 'N P',
    termos: ['cadastrar', 'adicionar', 'carteira']
  }
] as const;

function normalizar(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function comandosPermitidos(contexto: ContextoComandos): ComandoPaleta[] {
  const idsModulos = new Set(modulosConsolePermitidos(contexto).map((modulo) => `navegar-${modulo.id}`));
  return COMANDOS_PALETA.filter((comando) => {
    if (comando.grupo === 'Navegação') return idsModulos.has(comando.id);
    if (!contexto.permissoes.includes(comando.permissao)) return false;
    return !comando.papeisPermitidos || Boolean(contexto.papel && comando.papeisPermitidos.includes(contexto.papel));
  });
}

export function filtrarComandos(comandos: readonly ComandoPaleta[], busca: string): ComandoPaleta[] {
  const termosBusca = normalizar(busca).split(/\s+/).filter(Boolean);
  if (!termosBusca.length) return [...comandos];

  return comandos.filter((comando) => {
    const palavrasIndice = normalizar([
      comando.rotulo,
      comando.descricao,
      ...(comando.termos ?? [])
    ].join(' ')).split(/\s+/);
    return termosBusca.every((termo) => palavrasIndice.some((palavra) => palavra.startsWith(termo)));
  });
}

export function resolverAtalho(comandos: readonly ComandoPaleta[], teclas: readonly string[]) {
  const atalho = teclas.map(normalizar).join(' ');
  return comandos.find((comando) => comando.atalho && normalizar(comando.atalho) === atalho);
}
