import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  OBJETIVOS_RECUPERACAO,
  avaliarMedicaoRecuperacao,
  calcularDestinosBackup,
  validarManifestosRestore,
  validarConfiguracaoBackup,
  validarConfiguracaoRestore,
} from "./backup-producao.mjs";

function urlPostgres(role, host, banco) {
  return [
    "postgresql://",
    role,
    ":",
    "credencial-sintetica",
    "@",
    host,
    "/",
    banco,
    "?sslmode=verify-full",
  ].join("");
}

const base = {
  OCTACLIN_BACKUP_DATABASE_URL: urlPostgres(
    "octaclin_backup_producao",
    "ep-prod.neon.tech",
    "Octaclin-db-producao",
  ),
  OCTACLIN_BACKUP_DATABASE_EXPECTED: "Octaclin-db-producao",
  OCTACLIN_BACKUP_ROLE_EXPECTED: "octaclin_backup_producao",
  B2_BACKUP_ENDPOINT: "https://s3.us-east-005.backblazeb2.com",
  B2_BACKUP_REGION: "us-east-005",
  B2_BACKUP_BUCKET: "octaclin-backups-private",
  B2_BACKUP_KEY_ID: "id-sintetico",
  B2_BACKUP_APPLICATION_KEY: "segredo-sintetico",
};

assert.equal(validarConfiguracaoBackup(base).ok, true);
assert(!JSON.stringify(validarConfiguracaoBackup(base)).includes("segredo"));

const owner = validarConfiguracaoBackup({
  ...base,
  OCTACLIN_BACKUP_DATABASE_URL: base.OCTACLIN_BACKUP_DATABASE_URL.replace(
    "octaclin_backup_producao",
    "neondb_owner",
  ),
});
assert.equal(owner.ok, false);
assert(
  owner.erros.includes("A URL de backup nao usa a role dedicada esperada."),
);

assert.equal(
  validarConfiguracaoBackup({
    ...base,
    B2_BACKUP_ENDPOINT: "http://127.0.0.1:9000",
  }).ok,
  false,
);

assert.deepEqual(OBJETIVOS_RECUPERACAO, {
  rpoHoras: 24,
  toleranciaAlertaRpoHoras: 2,
  rtoRestoreMinutos: 30,
});

const tabelasTenant = [
  {
    tabela: "pacientes",
    rls: true,
    rlsForcada: true,
    policyCompleta: true,
  },
  {
    tabela: "usuarios",
    rls: true,
    rlsForcada: true,
    policyCompleta: true,
  },
];
const manifestoOrigem = {
  banco: "Octaclin-db-producao",
  role: "octaclin_backup_producao",
  migrations: ["CriarSessoesUsuario1720000001036", "TornarTrilhaAuditoriaImutavel1720000001038"],
  tabelasPublicas: ["migrations", "pacientes", "tenants", "usuarios"],
  tabelasTenant,
  contagensCriticas: { pacientes: "7", tenants: "2", usuarios: "4" },
};
const manifestoDestino = {
  ...manifestoOrigem,
  banco: "octaclin_restore_fase219",
  role: "neondb_owner",
};

assert.equal(
  validarManifestosRestore({
    origem: manifestoOrigem,
    destino: manifestoDestino,
    bancoOrigemEsperado: "Octaclin-db-producao",
    bancoDestinoEsperado: "octaclin_restore_fase219",
    roleOrigemEsperada: "octaclin_backup_producao",
    roleDestinoEsperada: "neondb_owner",
  }).ok,
  true,
);
assert.equal(
  validarManifestosRestore({
    origem: manifestoOrigem,
    destino: {
      ...manifestoDestino,
      tabelasTenant: [{ ...tabelasTenant[0], rlsForcada: false }],
    },
    bancoOrigemEsperado: "Octaclin-db-producao",
    bancoDestinoEsperado: "octaclin_restore_fase219",
    roleOrigemEsperada: "octaclin_backup_producao",
    roleDestinoEsperada: "neondb_owner",
  }).ok,
  false,
);
assert.equal(
  validarManifestosRestore({
    origem: manifestoOrigem,
    destino: {
      ...manifestoDestino,
      contagensCriticas: { ...manifestoDestino.contagensCriticas, tenants: "invalido" },
    },
    bancoOrigemEsperado: "Octaclin-db-producao",
    bancoDestinoEsperado: "octaclin_restore_fase219",
    roleOrigemEsperada: "octaclin_backup_producao",
    roleDestinoEsperada: "neondb_owner",
  }).ok,
  false,
);

assert.deepEqual(
  avaliarMedicaoRecuperacao({
    snapshotEm: "2026-09-08T08:00:00.000Z",
    restoreIniciadoEm: "2026-09-08T08:01:00.000Z",
    restoreConcluidoEm: "2026-09-08T08:04:00.000Z",
  }),
  {
    idadeSnapshotSegundos: 240,
    restoreSegundos: 180,
    rpoDentroObjetivo: true,
    rtoDentroObjetivo: true,
  },
);
assert.equal(
  avaliarMedicaoRecuperacao({
    snapshotEm: "2026-09-07T05:00:00.000Z",
    restoreIniciadoEm: "2026-09-08T08:01:00.000Z",
    restoreConcluidoEm: "2026-09-08T08:40:00.000Z",
  }).rtoDentroObjetivo,
  false,
);
assert.equal(
  validarConfiguracaoBackup({ ...base, OCTACLIN_BACKUP_DATABASE_URL: "" }).ok,
  false,
);

const nome = "octaclin-postgres-20260809T031700Z.dump";
assert.deepEqual(
  calcularDestinosBackup(nome, new Date("2026-08-09T03:17:00.000Z")).destinos,
  [`daily/2026/08/${nome}`, `weekly/2026/${nome}`],
);
assert.deepEqual(
  calcularDestinosBackup(
    "octaclin-postgres-20261101T031700Z.dump",
    new Date("2026-11-01T03:17:00.000Z"),
  ).destinos,
  [
    "daily/2026/11/octaclin-postgres-20261101T031700Z.dump",
    "weekly/2026/octaclin-postgres-20261101T031700Z.dump",
    "monthly/2026/octaclin-postgres-20261101T031700Z.dump",
  ],
);
assert.throws(
  () => calcularDestinosBackup("../producao.dump"),
  /fora do contrato/,
);

assert.equal(
  validarConfiguracaoRestore({
    ...base,
    OCTACLIN_RESTORE_DATABASE_URL: urlPostgres(
      "neondb_owner",
      "ep-restore.neon.tech",
      "octaclin_restore_fase219",
    ),
    OCTACLIN_RESTORE_DATABASE_EXPECTED: "octaclin_restore_fase219",
    OCTACLIN_RESTORE_ROLE_EXPECTED: "neondb_owner",
  }).ok,
  true,
);
assert.equal(
  validarConfiguracaoRestore({
    ...base,
    OCTACLIN_RESTORE_DATABASE_URL: base.OCTACLIN_BACKUP_DATABASE_URL,
    OCTACLIN_RESTORE_DATABASE_EXPECTED: "Octaclin-db-producao",
    OCTACLIN_RESTORE_ROLE_EXPECTED: "octaclin_backup_producao",
  }).ok,
  false,
);

const workflow = readFileSync(
  new URL("../.github/workflows/backup-producao.yml", import.meta.url),
  "utf8",
);
const lifecycle = JSON.parse(
  readFileSync(
    new URL("../.github/backblaze-backup-lifecycle.json", import.meta.url),
    "utf8",
  ),
);
assert.match(
  workflow,
  /github\.event_name == 'workflow_dispatch' \|\| vars\.OCTACLIN_BACKUP_AUTOMATICO_HABILITADO == 'true'/,
);
assert.match(
  workflow,
  /OCTACLIN_BACKUP_ROLE_EXPECTED: octaclin_backup_producao/,
);
assert.match(workflow, /OCTACLIN_RESTORE_ROLE_EXPECTED: neondb_owner/);
assert.match(workflow, /manifesto-restore-producao\.sql/);
assert.match(workflow, /validar-manifestos/);
assert.match(workflow, /medir-recuperacao/);
assert.match(workflow, /get-object-lock-configuration/);
assert.match(workflow, /ObjectLockMode/);
assert.match(workflow, /ObjectLockRetainUntilDate/);
assert.match(workflow, /OCTACLIN_BACKUP_IMUTABILIDADE_OBRIGATORIA/);
assert.match(workflow, /--exclude-extension=timescaledb/);
assert.match(workflow, /--sse AES256/);
assert.match(workflow, /get-bucket-lifecycle-configuration/);
assert.match(workflow, /put-bucket-lifecycle-configuration/);
assert.match(workflow, /configurar_retencao:[\s\S]*?default: false/);
assert.match(workflow, /\.Grantee\.URI\? \/\/ ""/);
assert.match(workflow, /if: always\(\)/);
assert.doesNotMatch(workflow, /upload-artifact/);
assert.doesNotMatch(workflow, /neondb_owner.*OCTACLIN_BACKUP_DATABASE_URL/);
const sqlManifesto = readFileSync(
  new URL("./manifesto-restore-producao.sql", import.meta.url),
  "utf8",
);
assert.match(sqlManifesto, /a\.attname = 'tenant_id'/);
assert.match(sqlManifesto, /c\.relrowsecurity/);
assert.match(sqlManifesto, /c\.relforcerowsecurity/);
assert.match(sqlManifesto, /current_setting\(''app\.tenant_id/);
assert.match(sqlManifesto, /from public\.migrations/);

const runbookRansomware = readFileSync(
  new URL("../RUNBOOK_RECUPERACAO_RANSOMWARE.md", import.meta.url),
  "utf8",
);
assert.match(runbookRansomware, /RPO[^\n]*24 horas/i);
assert.match(runbookRansomware, /RTO[^\n]*30 minutos/i);
assert.match(runbookRansomware, /Object Lock[^\n]*nao comprovad/i);
assert.match(runbookRansomware, /Nao restaurar[^\n]*producao/i);
for (const prefixo of ["daily", "weekly", "monthly"]) {
  assert(
    lifecycle.Rules.some(
      (regra) =>
        regra.ID === `octaclin-${prefixo}-delete-markers` &&
        regra.Filter?.Prefix === `${prefixo}/` &&
        regra.Expiration?.ExpiredObjectDeleteMarker === true,
    ),
  );
}

console.log("Contrato de backup de producao validado.");
