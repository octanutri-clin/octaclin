/** Ponto de partida para edição. Nenhuma estrutura é um modelo persistido ou prescrição. */
const ESTRUTURAS = [
  { id: 'tres-refeicoes', nome: 'Três refeições', refeicoes: ['Refeição 1', 'Refeição 2', 'Refeição 3'] },
  { id: 'cinco-refeicoes', nome: 'Cinco refeições', refeicoes: ['Refeição 1', 'Refeição 2', 'Refeição 3', 'Refeição 4', 'Refeição 5'] }
] as const;

export function listarEstruturasIniciaisPlano() {
  return ESTRUTURAS.map((estrutura) => ({
    id: estrutura.id,
    nome: estrutura.nome,
    refeicoes: estrutura.refeicoes.map((nome) => ({ nome, itens: [] as [] }))
  }));
}
