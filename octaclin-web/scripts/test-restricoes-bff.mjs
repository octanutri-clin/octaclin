// FOOD06 P3: textos, projeções e BFF de restrições. Mesmo padrão de test-fase-318-bff.mjs:
// compila só os arquivos listados, simula next/server e next/headers e roda node:test.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temp = mkdtempSync(join(tmpdir(), "octaclin-restricoes-bff-"));
const specs = ["scripts/restricoes-portal.spec.ts", "scripts/validacao-textos-clinicos.spec.ts", "scripts/restricoes-bff.spec.ts", "scripts/restricoes-equipe.spec.ts", "scripts/restricoes-equipe-bff.spec.ts"];
const files = [
  ...specs,
  "lib/textos-restricoes.ts",
  "lib/restricoes-portal.ts",
  "lib/textos-validacao-clinica.ts",
  "lib/restricoes-equipe.ts",
  "lib/textos-equipe-restricoes.ts",
  "lib/server/restricoes-portal-bff.ts",
  "lib/server/restricoes-bff-comum.ts",
  "lib/server/restricoes-equipe-bff.ts",
  "lib/server/funcionalidades-web-bff.ts",
  "lib/server/sessao-bff.ts",
  "lib/server/permissoes-bff.ts",
  "lib/server/seguranca-bff.ts",
  "lib/server/mfa-bff.ts",
  "lib/server/correlacao-requisicao-bff.ts",
  "lib/server/correlacao-bff.ts",
  "lib/server/cold-start-bff.ts",
];
function run(args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) throw new Error(`Falhou: ${args.join(" ")}`);
}
try {
  writeFileSync(
    join(temp, "tsconfig.json"),
    JSON.stringify({
      extends: join(root, "tsconfig.json"),
      compilerOptions: {
        noEmit: false,
        outDir: temp,
        rootDir: root,
        module: "commonjs",
        moduleResolution: "node",
        ignoreDeprecations: "6.0",
        target: "ES2022",
      },
      include: [],
      files: files.map((file) => join(root, file)),
    }),
  );
  run([join(root, "node_modules/typescript/bin/tsc"), "-p", join(temp, "tsconfig.json")]);
  mkdirSync(join(temp, "node_modules/next"), { recursive: true });
  writeFileSync(
    join(temp, "node_modules/next/server.js"),
    `class NextResponse extends Response { static json(data,init={}) { const headers=new Headers(init.headers??{}); if(!headers.has('Content-Type')) headers.set('Content-Type','application/json'); return new NextResponse(JSON.stringify(data),{...init,headers}); } } module.exports={NextResponse};`,
  );
  writeFileSync(
    join(temp, "node_modules/next/headers.js"),
    `const values=new Map(); function cookies(){ return Promise.resolve({get(name){const value=values.get(name);return value===undefined?undefined:{name,value};},set(name,value){values.set(name,String(value));},delete(name){values.delete(name);}}); } function headers(){return Promise.resolve(new Headers());} function __clearCookies(){values.clear();} module.exports={cookies,headers,__clearCookies};`,
  );
  const alias = join(temp, "node_modules/@/lib");
  mkdirSync(dirname(alias), { recursive: true });
  cpSync(join(temp, "lib"), alias, { recursive: true });
  // Registro de validação clínica dos textos (ATV-1), lido pelo spec a partir da pasta temporária.
  cpSync(join(root, "..", "docs", "clinico", "validacao-textos-restricoes.json"), join(temp, "validacao-textos-restricoes.json"));
  run(["--test", ...specs.map((s) => join(temp, s.replace(/\.ts$/, ".js")))], temp);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
