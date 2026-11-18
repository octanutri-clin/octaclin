const BACKPORTS_TEMPORARIOS = new Map([
  [
    'GHSA-vfj7-8cjw-p6xm',
    { pacote: 'braces', faixa: '<=3.0.3' },
  ],
]);

// Exceções temporárias: advisory sem versão corrigida publicada, em dependência só de build/desenvolvimento do app
// (mobile segue NO-GO para distribuição). Valem só para o advisory exato (pacote, faixa e gravidade), até o prazo,
// sem avisos silenciados e sem nenhum outro advisory. Se a faixa mudar (correção publicada) ou o prazo vencer, o gate
// volta a reprovar. Decisão do proprietário de 2026-11-18; registro em docs/agents/LESSONS_LEARNED.md.
const EXCECOES_TEMPORARIAS = new Map([
  [
    'GHSA-fc5q-39xc-vjpf',
    { pacote: 'picomatch', faixa: '<=4.0.7', severidade: 'high', expiraEm: '2026-12-18' },
  ],
]);

function excecaoVigente(advisory, agora) {
  const id = advisory.github_advisory_id ?? advisory.id;
  const excecao = EXCECOES_TEMPORARIAS.get(id);
  return Boolean(
    excecao &&
      advisory.module_name === excecao.pacote &&
      advisory.vulnerable_versions === excecao.faixa &&
      advisory.severity === excecao.severidade &&
      agora.getTime() <= Date.parse(`${excecao.expiraEm}T23:59:59Z`),
  );
}

export function avaliarAuditoria(relatorio, { backportsValidados = false, agora = new Date() } = {}) {
  const totais = relatorio.metadata?.vulnerabilities;
  const metadadosValidos =
    totais &&
    ['info', 'low', 'moderate', 'high', 'critical'].every((chave) => Number.isInteger(totais[chave]));

  if (!metadadosValidos || relatorio.error) {
    return {
      aprovado: false,
      excecoes: [],
      mensagem: 'Auditoria reprovada. Relatorio ausente, incompleto ou com erro.',
    };
  }

  const advisories = Object.values(relatorio.advisories ?? {});
  const semVulnerabilidades =
    advisories.length === 0 && Object.values(totais).every((total) => total === 0);
  const semAvisosSilenciados = (relatorio.muted ?? []).length === 0;

  if (semVulnerabilidades && semAvisosSilenciados) {
    return { aprovado: true, excecoes: [], mensagem: 'Auditoria sem vulnerabilidades.' };
  }

  const mitigacoesLocaisCorrespondem =
    backportsValidados &&
    semAvisosSilenciados &&
    advisories.length > 0 &&
    totais.high === advisories.length &&
    ['info', 'low', 'moderate', 'critical'].every((chave) => totais[chave] === 0) &&
    advisories.every((advisory) => {
      const id = advisory.github_advisory_id ?? advisory.id;
      const backport = BACKPORTS_TEMPORARIOS.get(id);
      return (
        backport &&
        advisory.severity === 'high' &&
        advisory.module_name === backport.pacote &&
        advisory.vulnerable_versions === backport.faixa
      );
    });

  if (mitigacoesLocaisCorrespondem) {
    const ids = advisories
      .map((advisory) => advisory.github_advisory_id ?? advisory.id)
      .join(', ');
    return {
      aprovado: true,
      excecoes: advisories.map((advisory) => advisory.github_advisory_id ?? advisory.id),
      mensagem: `Advisories mitigados por backports locais verificados; aguardando correcoes upstream: ${ids}.`,
    };
  }

  const somenteExcecoesVigentes =
    semAvisosSilenciados &&
    advisories.length > 0 &&
    totais.high === advisories.length &&
    ['info', 'low', 'moderate', 'critical'].every((chave) => totais[chave] === 0) &&
    advisories.every((advisory) => excecaoVigente(advisory, agora));

  if (somenteExcecoesVigentes) {
    const vigentes = advisories.map((advisory) => advisory.github_advisory_id ?? advisory.id);
    const prazos = vigentes.map((id) => `${id} ate ${EXCECOES_TEMPORARIAS.get(id).expiraEm}`).join(', ');
    return {
      aprovado: true,
      excecoes: vigentes,
      mensagem: `Excecao temporaria sem correcao upstream publicada: ${prazos}.`,
    };
  }

  const ids = advisories
    .map((advisory) => advisory.github_advisory_id ?? advisory.id)
    .filter(Boolean)
    .join(', ');
  const detalhe = ids || (semAvisosSilenciados ? 'metadados divergentes' : 'avisos silenciados');
  return {
    aprovado: false,
    excecoes: [],
    mensagem: `Auditoria reprovada. Vulnerabilidades ou supressoes presentes: ${detalhe}.`,
  };
}
