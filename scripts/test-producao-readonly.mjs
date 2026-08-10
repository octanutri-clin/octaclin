import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const teste = await readFile(
  new URL(
    "../octaclin-web/tests/visual/producao-readonly.spec.mjs",
    import.meta.url,
  ),
  "utf8",
);

assert.match(teste, /E2E_PRODUCAO_READONLY === ["']true["']/);
assert.match(teste, /E2E_PAPEL/);
assert.match(teste, /sessao\.papel\)\.toBe\(papel\)/);
assert.match(teste, /respostaLogin\.status\(\).*toBeLessThan/s);
assert.match(teste, /rotuloProibido.*toHaveCount\(0\)/s);
assert.match(teste, /resposta\.status\(\) >= 500/);
assert.match(teste, /requestfailed/);
assert.match(teste, /motivo !== ["']net::ERR_ABORTED["']/);
assert.match(teste, /pageerror/);
assert.match(teste, /mensagem\.type\(\) === ["']error["']/);
assert.doesNotMatch(teste, /page\.request\.(post|put|patch|delete)\(/);
assert.doesNotMatch(
  teste,
  /getByRole\(["']button["'].*name: ["'](Novo|Criar|Excluir|Arquivar|Enviar|Agendar)/s,
);

for (const caminho of [
  "/dashboard",
  "/agenda",
  "/pacientes",
  "/questionarios",
  "/comunicacoes",
  "/automacoes",
  "/ia",
  "/gamificacao",
  "/profissionais",
  "/operacoes",
  "/cliente",
  "/portal",
  "/portal/agenda",
  "/portal/checkins",
  "/portal/plano",
  "/portal/formularios",
  "/portal/mensagens",
  "/portal/perfil",
  "/portal/privacidade",
  "/portal/mais",
]) {
  assert.match(
    teste,
    new RegExp(`caminho: ["']${caminho.replace("/", "\\/")}["']`),
  );
}

console.log("Contrato do smoke autenticado somente leitura validado.");
