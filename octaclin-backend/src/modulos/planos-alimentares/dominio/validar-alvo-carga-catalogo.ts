export interface AlvoCargaCatalogo {
  bancoAtual: string;
  roleAtual: string;
  bancoEsperado: string;
  roleEsperada: string;
}

export function validarAlvoCargaCatalogo(alvo: AlvoCargaCatalogo): void {
  if (!alvo.bancoEsperado.trim() || !alvo.roleEsperada.trim()) {
    throw new Error('Carga recusada: banco e role esperados são obrigatórios.');
  }
  if (alvo.bancoAtual !== alvo.bancoEsperado || alvo.roleAtual !== alvo.roleEsperada) {
    throw new Error('Carga recusada: banco/role conectados não correspondem aos valores esperados.');
  }
}
