import { fileURLToPath } from 'node:url';

export function avaliarGateLancamento(estado) {
  const bloqueios = [];
  if (!estado.readiness) bloqueios.push('readiness_indisponivel');
  if (!estado.dependencias) bloqueios.push('dependencias_nao_saudaveis');
  if (!estado.web) bloqueios.push('web_indisponivel');
  if (!estado.backupRecente) bloqueios.push('backup_nao_confirmado');
  if (estado.migracoesPendentes !== 0) bloqueios.push('migracoes_pendentes');
  if (estado.incidentesP0P1Abertos !== 0) bloqueios.push('incidente_critico_aberto');
  if (!estado.responsaveisConfirmados) bloqueios.push('responsaveis_nao_confirmados');
  if (!estado.juridicoLiberado) bloqueios.push('juridico_nao_liberado');
  if (!estado.identidadePublicaLiberada) bloqueios.push('identidade_publica_nao_liberada');
  return { decisao: bloqueios.length === 0 ? 'GO' : 'NO-GO', bloqueios };
}

export function classificarIncidente(sinais) {
  if (sinais.indisponibilidadeGeral || sinais.suspeitaDados || sinais.perdaDados) {
    return { severidade: 'P0', primeiraRespostaMinutos: 15 };
  }
  if (sinais.tenantCriticoIndisponivel || sinais.fluxoCriticoSemAlternativa) {
    return { severidade: 'P1', primeiraRespostaMinutos: 30 };
  }
  if (sinais.degradacaoComAlternativa) {
    return { severidade: 'P2', primeiraRespostaMinutos: 240 };
  }
  return { severidade: 'P3', primeiraRespostaMinutos: 480 };
}

export function executarExercicioSintetico() {
  const incidente = classificarIncidente({ indisponibilidadeGeral: true });
  const marcos = [
    { evento: 'deteccao_monitor', minuto: 3, limiteMinutos: 10 },
    { evento: 'classificacao_e_comando', minuto: 7, limiteMinutos: 15 },
    { evento: 'pausa_onboarding_e_aviso_inicial', minuto: 10, limiteMinutos: 15 },
    { evento: 'decisao_rollback', minuto: 14, limiteMinutos: 20 },
    { evento: 'deploy_anterior_restaurado', minuto: 24, limiteMinutos: 30 },
    { evento: 'segunda_leitura_saudavel', minuto: 31, limiteMinutos: 45 },
    { evento: 'comunicacao_recuperacao', minuto: 34, limiteMinutos: 45 }
  ];
  const aprovado = marcos.every((marco) => marco.minuto <= marco.limiteMinutos);

  return {
    id: 'EX-SINTETICO-F232-001',
    sintetico: true,
    dadosReais: false,
    cenario: 'readiness_503_apos_deploy_backend',
    severidade: incidente.severidade,
    acaoPrimaria: 'rollback_deploy',
    resultado: aprovado ? 'aprovado' : 'reprovado',
    marcos,
    criterios: {
      onboardingPausado: true,
      nenhumaMigrationRevertida: true,
      recuperacaoConfirmadaPorDuasLeituras: true,
      comunicacaoSemDadosSensiveis: true,
      postMortemObrigatorio: true
    }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(executarExercicioSintetico(), null, 2));
}
