import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { enfileirarSincronizacao } from '@/lib/banco-local';
import { cores } from '@/lib/tema';

export default function ModoAcompanhante() {
  const [pin, setPin] = useState('');
  const [nome, setNome] = useState('');

  async function salvar() {
    await enfileirarSincronizacao('acompanhante', {
      pacienteId: 'paciente-local',
      nome,
      pin
    });
    Alert.alert('Acompanhante preparado', 'O acesso sera sincronizado quando houver conexao.');
    setPin('');
    setNome('');
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.subtitulo}>Suporte familiar</Text>
      <Text style={styles.titulo}>Modo acompanhante</Text>

      <View style={styles.cartao}>
        <Ionicons name="lock-closed" size={28} color={cores.primaria} />
        <Text style={styles.cartaoTitulo}>Acesso com PIN</Text>
        <Text style={styles.cartaoTexto}>O acompanhante pode visualizar lembretes e ajudar no preenchimento. Cada acao fica registrada.</Text>
      </View>

      <View style={styles.formulario}>
        <Text style={styles.rotulo}>Nome</Text>
        <TextInput value={nome} onChangeText={setNome} placeholder="Nome do acompanhante" style={styles.input} />
        <Text style={styles.rotulo}>PIN</Text>
        <TextInput value={pin} onChangeText={setPin} placeholder="4 a 6 digitos" keyboardType="number-pad" secureTextEntry style={styles.input} />
        <Pressable style={styles.botao} onPress={salvar} disabled={!nome || pin.length < 4}>
          <Text style={styles.botaoTexto}>Salvar acompanhante</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo, padding: 16, gap: 16 },
  subtitulo: { color: cores.textoSecundario, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  titulo: { color: cores.tinta, fontSize: 28, fontWeight: '800' },
  cartao: { gap: 8, borderRadius: 8, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.branco, padding: 16 },
  cartaoTitulo: { color: cores.tinta, fontSize: 18, fontWeight: '800' },
  cartaoTexto: { color: cores.textoSecundario, fontSize: 14, lineHeight: 20 },
  formulario: { gap: 8 },
  rotulo: { color: cores.textoSecundario, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  input: { height: 48, borderRadius: 8, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.branco, paddingHorizontal: 12, color: cores.tinta },
  botao: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: cores.primaria, marginTop: 8 },
  botaoTexto: { color: cores.branco, fontSize: 16, fontWeight: '800' }
});
