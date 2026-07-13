const PALAVRAS_SENSIVEIS = ['idiota', 'burro', 'fracasso', 'vergonha'];

export interface ResultadoModeracao {
  status: 'aprovado' | 'pendente' | 'bloqueado';
  pontuacaoRisco: number;
  motivos: string[];
}

export function moderarConteudo(conteudo: string): ResultadoModeracao {
  const texto = conteudo.toLowerCase();
  const encontradas = PALAVRAS_SENSIVEIS.filter((palavra) => texto.includes(palavra));
  const pontuacaoRisco = Math.min(100, encontradas.length * 35);

  if (pontuacaoRisco >= 70) return { status: 'bloqueado', pontuacaoRisco, motivos: encontradas };
  if (pontuacaoRisco > 0) return { status: 'pendente', pontuacaoRisco, motivos: encontradas };
  return { status: 'aprovado', pontuacaoRisco, motivos: [] };
}
