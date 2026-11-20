/**
 * Textos clínicos do portal que só valem para ativação depois de aprovados pelo responsável clínico (ATV-1 do contrato v3
 * de restrições). Cada texto entra com as variantes exatas (conta própria e responsável, com o nome como `{nome}`). O
 * registro versionado `docs/clinico/validacao-textos-restricoes.json` guarda o hash de cada um e o status; mudar o texto
 * muda o hash e o teste `scripts/validacao-textos-clinicos.spec.ts` exige nova aprovação.
 */
import { TEXTOS_PORTAL_RESTRICOES as T, textoSeloPortal, type ContextoPessoaPortal } from "./textos-restricoes";

const PROPRIA: ContextoPessoaPortal = { representante: false, nome: "{nome}" };
const RESPONSAVEL: ContextoPessoaPortal = { representante: true, nome: "{nome}" };

export interface TextoParaValidacao {
  id: string;
  finalidade: string;
  variantes: { propria: string; responsavel: string };
}

export function textosParaValidacaoClinica(): TextoParaValidacao[] {
  return [
    { id: "portal.urgencia", finalidade: "Aviso de urgência no formulário de informar restrição (NUX-27).",
      variantes: { propria: T.urgencia(PROPRIA), responsavel: T.urgencia(RESPONSAVEL) } },
    { id: "portal.informarSucesso", finalidade: "Mensagem depois de informar uma restrição pelo portal (PUX-01 da etapa A).",
      variantes: { propria: T.informarSucesso(PROPRIA), responsavel: T.informarSucesso(RESPONSAVEL) } },
    { id: "portal.seloRevisada", finalidade: "Selo da informação rejeitada, visível por 30 dias (PUX-01/05).",
      variantes: { propria: textoSeloPortal("restricoes.portal.revisada", PROPRIA), responsavel: textoSeloPortal("restricoes.portal.revisada", RESPONSAVEL) } },
    { id: "portal.planoNaoMuda", finalidade: "Registrar uma restrição não altera o plano automaticamente (PUX-03 da P3-3).",
      variantes: { propria: T.planoNaoMuda(PROPRIA), responsavel: T.planoNaoMuda(RESPONSAVEL) } },
  ];
}
