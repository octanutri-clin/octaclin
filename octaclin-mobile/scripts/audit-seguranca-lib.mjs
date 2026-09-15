export function avaliarAuditoria(relatorio) {
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
