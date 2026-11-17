import { validarConteudoRestricao } from './conteudo-restricao';

/**
 * FOOD06 P2d-3b (Q11): o que o PORTAL mostra das restrições de um paciente. Domínio puro, por allowlist.
 * Aparecem: restrições confirmadas e ativas (ou em reavaliação), declarações do próprio paciente aguardando conferência e
 * registros da equipe aguardando conferência. Campos: natureza, subtipo, alvo, alvo declarado e gravidade, mais um selo
 * por chave de texto (os textos são da P3). Nunca: observação (pode conter anotação da equipe), justificativa, motivo,
 * autor, origem, estado, revisão ou código interno. Rejeitadas, inativas e preferências ficam fora.
 */
const SELO_REGISTRADA = 'restricoes.portal.registrada';
const SELO_INFORMADA = 'restricoes.portal.informada_por_voce';
const SELO_EQUIPE = 'restricoes.portal.anotada_pela_equipe';
export const CHAVES_SELO_PORTAL_RESTRICAO: readonly string[] = Object.freeze([SELO_REGISTRADA, SELO_INFORMADA, SELO_EQUIPE]);

export interface RestricaoPortal {
  id: string; selo: string; natureza: string; subtipoClinico?: string;
  alvo: { tipo: string; id?: string }; alvoDeclarado?: string; gravidade?: string;
}
export interface ResumoPortal { restricoes: RestricaoPortal[]; ultimaConfirmacaoEm?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORIGENS = ['profissional', 'colaborador', 'declaracao_paciente', 'questionario_legado'];
const ESTADOS = ['ativa', 'em_reavaliacao', 'inativa'];
const CONFIRMACOES = ['pendente', 'confirmada', 'rejeitada'];
function indisponivel(): never { throw new Error('Projeção indisponível.'); }

export function projetarResumoPortal(
  linhas: ReadonlyArray<{ id: unknown; origem: unknown; estado: unknown; confirmacao: unknown; conteudo: unknown }>,
  avaliacao: { confirmadoEm?: Date | null } | null
): ResumoPortal {
  if (!Array.isArray(linhas)) return indisponivel();
  const restricoes: RestricaoPortal[] = [];
  for (const l of linhas) {
    if (!l || typeof l.id !== 'string' || !UUID.test(l.id) || !ORIGENS.includes(l.origem as string) ||
      !ESTADOS.includes(l.estado as string) || !CONFIRMACOES.includes(l.confirmacao as string)) return indisponivel();
    let conteudo: ReturnType<typeof validarConteudoRestricao>;
    try { conteudo = validarConteudoRestricao(l.conteudo); } catch { return indisponivel(); }
    if (l.estado === 'inativa' || l.confirmacao === 'rejeitada' || conteudo.natureza === 'preferencia') continue;
    const selo = l.confirmacao === 'confirmada' ? SELO_REGISTRADA : l.origem === 'declaracao_paciente' ? SELO_INFORMADA : SELO_EQUIPE;
    restricoes.push({
      id: l.id, selo, natureza: conteudo.natureza,
      ...(conteudo.subtipoClinico ? { subtipoClinico: conteudo.subtipoClinico } : {}),
      alvo: conteudo.alvo.id ? { tipo: conteudo.alvo.tipo, id: conteudo.alvo.id } : { tipo: conteudo.alvo.tipo },
      ...(conteudo.alvoDeclarado ? { alvoDeclarado: conteudo.alvoDeclarado } : {}),
      ...(conteudo.gravidade ? { gravidade: conteudo.gravidade } : {})
    });
  }
  const confirmado = avaliacao?.confirmadoEm;
  if (confirmado != null && (!(confirmado instanceof Date) || !Number.isFinite(confirmado.getTime()))) return indisponivel();
  return { restricoes, ...(confirmado ? { ultimaConfirmacaoEm: confirmado.toISOString() } : {}) };
}
