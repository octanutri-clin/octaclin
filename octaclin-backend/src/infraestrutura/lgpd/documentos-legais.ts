export type TipoDocumentoLegal = 'termos_uso' | 'politica_privacidade' | 'consentimento_lgpd';

export interface DocumentoLegal<Perfil extends 'paciente' | 'staff' = 'paciente' | 'staff'> {
  tipo: TipoDocumentoLegal;
  titulo: string;
  versao: string;
  perfil: Perfil;
  resumo: string;
  obrigatorio: true;
}

interface VersoesDocumentosLegaisPaciente {
  versaoTermosUso?: string;
  versaoPoliticaPrivacidade?: string;
  versaoLgpd?: string;
}

interface VersoesDocumentosLegaisStaff {
  versaoTermosUso?: string;
  versaoPoliticaPrivacidade?: string;
}

const VERSAO_LEGAL_PADRAO = '2026-07';

export function obterVersaoLegalPadrao(): string {
  return process.env.OCTACLIN_LEGAL_VERSAO ?? process.env.OCTACLIN_LGPD_VERSAO ?? VERSAO_LEGAL_PADRAO;
}

export function listarDocumentosLegaisPaciente(versoes: VersoesDocumentosLegaisPaciente = {}): DocumentoLegal<'paciente'>[] {
  const versaoPadrao = obterVersaoLegalPadrao();
  return [
    {
      tipo: 'termos_uso',
      titulo: 'Termos de uso',
      versao: versoes.versaoTermosUso ?? process.env.OCTACLIN_TERMOS_USO_VERSAO ?? versaoPadrao,
      perfil: 'paciente',
      resumo: 'Regras de acesso, responsabilidades e uso adequado do OctaClin.',
      obrigatorio: true
    },
    {
      tipo: 'politica_privacidade',
      titulo: 'Politica de privacidade',
      versao: versoes.versaoPoliticaPrivacidade ?? process.env.OCTACLIN_POLITICA_PRIVACIDADE_VERSAO ?? versaoPadrao,
      perfil: 'paciente',
      resumo: 'Como dados pessoais e dados de saude sao tratados, protegidos e compartilhados.',
      obrigatorio: true
    },
    {
      tipo: 'consentimento_lgpd',
      titulo: 'Consentimento LGPD',
      versao: versoes.versaoLgpd ?? process.env.OCTACLIN_CONSENTIMENTO_LGPD_VERSAO ?? process.env.OCTACLIN_LGPD_VERSAO ?? versaoPadrao,
      perfil: 'paciente',
      resumo: 'Autorizacao para tratamento de dados no acompanhamento clinico e uso do portal.',
      obrigatorio: true
    }
  ];
}

/**
 * Convite de staff (Client/Professional/Collaborator) nao lida com dado
 * clinico do proprio titular — so o convite de paciente pede consentimento
 * LGPD. Termos de uso e politica de privacidade continuam obrigatorios: quem
 * acessa a clinica como equipe tambem trata dado de paciente sob essas regras.
 */
export function listarDocumentosLegaisStaff(versoes: VersoesDocumentosLegaisStaff = {}): DocumentoLegal<'staff'>[] {
  const versaoPadrao = obterVersaoLegalPadrao();
  return [
    {
      tipo: 'termos_uso',
      titulo: 'Termos de uso',
      versao: versoes.versaoTermosUso ?? process.env.OCTACLIN_TERMOS_USO_VERSAO ?? versaoPadrao,
      perfil: 'staff',
      resumo: 'Regras de acesso, responsabilidades e uso adequado do OctaClin.',
      obrigatorio: true
    },
    {
      tipo: 'politica_privacidade',
      titulo: 'Politica de privacidade',
      versao: versoes.versaoPoliticaPrivacidade ?? process.env.OCTACLIN_POLITICA_PRIVACIDADE_VERSAO ?? versaoPadrao,
      perfil: 'staff',
      resumo: 'Como dados pessoais e dados de saude sao tratados, protegidos e compartilhados.',
      obrigatorio: true
    }
  ];
}
