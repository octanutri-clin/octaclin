import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analisarFonte,
  avaliarContraste,
  avaliarProjeto,
  extrairEstilos,
  extrairPaleta,
  extrairTags,
  razaoContraste,
  temAtributo,
} from './auditoria-acessibilidade-lib.mjs';
import { carregarProjeto } from './auditoria-acessibilidade.mjs';

test('extrai tag mesmo com arrow function no atributo', () => {
  const tags = extrairTags('<Pressable onPress={() => salvar()} accessibilityRole="button" />');
  assert.equal(tags.length, 1);
  assert.equal(tags[0].nome, 'Pressable');
  assert.match(tags[0].atributos, /accessibilityRole="button"/);
});

test('temAtributo aceita atributo sem valor, com valor e entre espacos ou quebras de linha', () => {
  assert.equal(temAtributo('accessibilityElementsHidden', 'accessibilityElementsHidden'), true);
  assert.equal(temAtributo('{...props} aria-hidden />', 'aria-hidden'), true);
  assert.equal(temAtributo('accessibilityRole="button"', 'accessibilityRole'), true);
  assert.equal(temAtributo('\n  importantForAccessibility="no-hide-descendants"\n', 'importantForAccessibility'), true);
  assert.equal(temAtributo('value={v}\n  accessibilityLabel = "Nome"', 'accessibilityLabel'), true);
  assert.equal(temAtributo('disabled={incompleto}', 'disabled'), true);
  assert.equal(temAtributo('value={v}', 'accessibilityLabel'), false);
});

test('temAtributo nao confunde nome que e prefixo ou sufixo de outro', () => {
  assert.equal(temAtributo('accessibilityLabelledBy="x"', 'accessibilityLabel'), false);
  assert.equal(temAtributo('dataAccessibilityRole="button"', 'accessibilityRole'), false);
  assert.equal(temAtributo('aria-hiddenish', 'aria-hidden'), false);
  assert.equal(temAtributo('accessibilityStateful={x}', 'accessibilityState'), false);
});

test('temAtributo rejeita nome de atributo nao cadastrado', () => {
  // Fail-closed: um atributo novo sem padrao literal derruba a auditoria em vez
  // de ser tratado como ausente ou presente por acidente.
  assert.throws(
    () => temAtributo('accessibilityValue={{ now: 1 }}', 'accessibilityValue'),
    /Atributo nao suportado pela auditoria: accessibilityValue/,
  );
  assert.throws(() => temAtributo('qualquer', ''), /Atributo nao suportado/);
});

test('cobra papel e nome acessivel em Pressable', () => {
  const problemas = analisarFonte('components/x.tsx', '<Pressable onPress={f}><Text>Ok</Text></Pressable>');
  assert.equal(problemas.filter((p) => p.includes('accessibilityRole')).length, 1);
  assert.equal(problemas.filter((p) => p.includes('accessibilityLabel')).length, 1);
});

test('cobra accessibilityState quando o controle tem disabled', () => {
  const fonte = '<Pressable accessibilityRole="button" accessibilityLabel="Salvar" disabled={!nome} />';
  assert.equal(analisarFonte('components/x.tsx', fonte).length, 1);

  const corrigido = '<Pressable accessibilityRole="button" accessibilityLabel="Salvar" disabled={!nome} accessibilityState={{ disabled: !nome }} />';
  assert.deepEqual(analisarFonte('components/x.tsx', corrigido), []);
});

test('cobra rotulo em TextInput e em CameraView', () => {
  assert.equal(analisarFonte('components/x.tsx', '<TextInput value={v} />').length, 1);
  assert.deepEqual(analisarFonte('components/x.tsx', '<TextInput value={v} accessibilityLabel="Nome" />'), []);
  assert.equal(analisarFonte('components/x.tsx', '<CameraView facing="back" />').length, 1);
});

test('bloqueia Ionicons fora do componente de icone decorativo', () => {
  const fonte = '<Ionicons name="water" size={22} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden />';
  assert.equal(analisarFonte('components/cartao.tsx', fonte).length, 1);
  assert.deepEqual(analisarFonte('components/icone.tsx', fonte), []);
});

test('exige as tres props de ocultacao no icone decorativo', () => {
  // react-native-web ignora accessibilityElementsHidden e importantForAccessibility.
  const semWeb = '<Ionicons {...props} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />';
  const problemas = analisarFonte('components/icone.tsx', semWeb);
  assert.deepEqual(problemas, ['components/icone.tsx:1: icone decorativo sem aria-hidden.']);
});

test('exige cabecalho nas telas, nao nos layouts nem no redirect', () => {
  assert.equal(analisarFonte('app/(tabs)/agenda.tsx', '<View />').length, 1);
  assert.deepEqual(analisarFonte('app/(tabs)/_layout.tsx', '<View />'), []);
  assert.deepEqual(analisarFonte('app/index.tsx', '<View />'), []);
  assert.deepEqual(analisarFonte('app/(tabs)/agenda.tsx', '<Text accessibilityRole="header">Agenda</Text>'), []);
});

test('extrai estilos e reprova altura fixa ou alvo de toque pequeno', () => {
  const estilos = extrairEstilos('const styles = StyleSheet.create({\n  botao: { height: 48 },\n  input: { minHeight: 40 }\n});');
  assert.deepEqual(Object.keys(estilos), ['botao', 'input']);

  const fonte = 'const styles = StyleSheet.create({\n  botao: { height: 48 },\n  input: { minHeight: 40 }\n});';
  const problemas = analisarFonte('components/x.tsx', fonte);
  assert.equal(problemas.filter((p) => p.includes('height fixo')).length, 1);
  assert.equal(problemas.filter((p) => p.includes('alvo de toque')).length, 1);
});

test('aceita minHeight igual ou maior que 44', () => {
  const fonte = 'const styles = StyleSheet.create({\n  botao: { minHeight: 44 }\n});';
  assert.deepEqual(analisarFonte('components/x.tsx', fonte), []);
});

test('razao de contraste segue a formula WCAG', () => {
  assert.equal(razaoContraste('#000000', '#FFFFFF').toFixed(2), '21.00');
  assert.equal(razaoContraste('#FFFFFF', '#FFFFFF').toFixed(2), '1.00');
});

test('reprova paleta com limite de controle abaixo de 3:1', () => {
  const paleta = extrairPaleta("export const cores = {\n  fundo: '#F7F8FA',\n  tinta: '#1F2937',\n  textoSecundario: '#5B6575',\n  contorno: '#D9DEE8',\n  primaria: '#247BA0',\n  branco: '#FFFFFF'\n};");
  const problemas = avaliarContraste(paleta);
  assert.equal(problemas.length, 2);
  assert.ok(problemas.every((p) => p.includes('contorno')));
});

test('o projeto real passa na auditoria estatica de acessibilidade', async () => {
  const { arquivos, temaFonte } = await carregarProjeto();
  const resultado = avaliarProjeto(arquivos, temaFonte);
  assert.deepEqual(resultado.problemas, []);
  assert.equal(resultado.aprovado, true);
});
