export type TipoDocumentoLegalPaciente = 'termos_uso' | 'politica_privacidade' | 'consentimento_lgpd';

export interface DocumentoLegalPaciente {
  tipo: TipoDocumentoLegalPaciente;
  titulo: string;
  versao: string;
  perfil: 'paciente';
  resumo: string;
  obrigatorio: true;
}

interface VersoesDocumentosLegaisPaciente {
  versaoTermosUso?: string;
  versaoPoliticaPrivacidade?: string;
  versaoLgpd?: string;
}

const VERSAO_LEGAL_PADRAO = '2026-07';

export function obterVersaoLegalPadrao(): string {
  return process.env.OCTACLIN_LEGAL_VERSAO ?? process.env.OCTACLIN_LGPD_VERSAO ?? VERSAO_LEGAL_PADRAO;
}

export function listarDocumentosLegaisPaciente(versoes: VersoesDocumentosLegaisPaciente = {}): DocumentoLegalPaciente[] {
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
