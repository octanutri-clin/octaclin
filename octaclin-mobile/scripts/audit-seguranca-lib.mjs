const BACKPORTS_TEMPORARIOS = new Map([
  [
    'GHSA-86w9-cpqp-85rv',
    { pacote: 'node-forge', faixa: '<=1.4.0' },
  ],
  [
    'GHSA-vfj7-8cjw-p6xm',
    { pacote: 'braces', faixa: '<=3.0.3' },
  ],
]);

export function avaliarAuditoria(relatorio, { backportsValidados = false } = {}) {
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
