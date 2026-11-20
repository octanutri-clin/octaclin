import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { textosParaValidacaoClinica } from "../lib/textos-validacao-clinica";

/**
 * Controle do ATV-1 para textos: todo texto clínico do portal está no registro versionado com o hash atual. Texto mudado
 * sem atualizar o registro falha aqui; o registro volta a "pendente" ao trocar o hash (a aprovação era de outro texto).
 * O runner copia `docs/clinico/validacao-textos-restricoes.json` para `validacao-textos-restricoes.json` na pasta temporária.
 */
interface Registro { id: string; sha256: string; status: "pendente" | "aprovado"; aprovacao?: { papel: string; data: string; versao: string } }
const registro = JSON.parse(readFileSync(join(__dirname, "..", "validacao-textos-restricoes.json"), "utf8")) as { textos: Registro[] };
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

test("ATV-1 (textos): cada texto clínico do portal está no registro com o hash do texto atual", () => {
  const atuais = textosParaValidacaoClinica();
  const ids = new Set(atuais.map((t) => t.id));
  for (const t of atuais) {
    const r = registro.textos.find((x) => x.id === t.id);
    assert.ok(r, `texto ${t.id} sem registro de validação`);
    assert.equal(r!.sha256, hash(t.variantes), `texto ${t.id} mudou: atualize o hash (${hash(t.variantes)}) e volte o status para "pendente"`);
  }
  for (const r of registro.textos) assert.ok(ids.has(r.id), `registro ${r.id} sem texto correspondente`);
});

test("ATV-1 (textos): aprovação só com papel, data e versão; nenhum dado pessoal no registro", () => {
  for (const r of registro.textos) {
    assert.ok(r.status === "pendente" || r.status === "aprovado", `${r.id}: status inválido`);
    if (r.status === "aprovado") {
      assert.ok(r.aprovacao && r.aprovacao.papel && /^\d{4}-\d{2}-\d{2}$/.test(r.aprovacao.data) && r.aprovacao.versao, `${r.id}: aprovação incompleta`);
    } else assert.equal(r.aprovacao, undefined, `${r.id}: pendente não carrega aprovação`);
  }
  assert.doesNotMatch(JSON.stringify(registro), /@|cpf|crn\s*\d|\b\d{11}\b/i);
});
