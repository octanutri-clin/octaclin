import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { IconeDecorativo } from '@/components/icone';
import { enfileirarSincronizacao } from '@/lib/banco-local';
import { cores } from '@/lib/tema';

export default function ModoAcompanhante() {
  const [pin, setPin] = useState('');
  const [nome, setNome] = useState('');
  const incompleto = !nome || pin.length < 4;

  async function salvar() {
    try {
      await enfileirarSincronizacao('acompanhante', {
        pacienteId: 'paciente-local',
        nome,
        pin
      });
      Alert.alert('Acompanhante preparado', 'O acesso sera sincronizado quando houver conexao.');
      setPin('');
      setNome('');
    } catch {
      Alert.alert('Falha ao salvar', 'Nao foi possivel salvar o acompanhante no aparelho. Tente novamente.');
    }
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.subtitulo}>Suporte familiar</Text>
      <Text accessibilityRole="header" style={styles.titulo}>
        Modo acompanhante
      </Text>

      <View
        accessible
        accessibilityLabel="Acesso com PIN. O acompanhante pode visualizar lembretes e ajudar no preenchimento. Cada acao fica registrada."
        style={styles.cartao}
      >
        <IconeDecorativo name="lock-closed" size={28} color={cores.primaria} />
        <Text style={styles.cartaoTitulo}>Acesso com PIN</Text>
        <Text style={styles.cartaoTexto}>O acompanhante pode visualizar lembretes e ajudar no preenchimento. Cada acao fica registrada.</Text>
      </View>

      <View style={styles.formulario}>
        <Text style={styles.rotulo}>Nome</Text>
        <TextInput
          accessibilityLabel="Nome do acompanhante"
          value={nome}
          onChangeText={setNome}
          placeholder="Nome do acompanhante"
          style={styles.input}
        />
        <Text style={styles.rotulo}>PIN</Text>
        <TextInput
          accessibilityLabel="PIN de acesso do acompanhante"
          accessibilityHint="Use de 4 a 6 digitos"
          value={pin}
          onChangeText={setPin}
          placeholder="4 a 6 digitos"
          keyboardType="number-pad"
          secureTextEntry
          style={styles.input}
        />
        {/* A restricao tambem aparece como texto: o estado do botao nao pode ser
            comunicado so pela cor nem so pelo bloqueio do toque. */}
        <Text accessibilityLiveRegion="polite" style={styles.ajuda}>
          {incompleto
            ? 'Preencha o nome e um PIN de 4 a 6 digitos para liberar o botao.'
            : 'Dados completos. O botao esta liberado.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvar acompanhante"
          accessibilityState={{ disabled: incompleto }}
          style={[styles.botao, incompleto && styles.botaoIndisponivel]}
          onPress={salvar}
          disabled={incompleto}
        >
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
  input: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: cores.contorno, backgroundColor: cores.branco, paddingHorizontal: 12, paddingVertical: 10, color: cores.tinta },
  ajuda: { color: cores.tinta, fontSize: 13, lineHeight: 18 },
  botao: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: cores.primaria, paddingVertical: 12, paddingHorizontal: 16, marginTop: 8 },
  botaoIndisponivel: { backgroundColor: cores.textoSecundario },
  botaoTexto: { color: cores.branco, fontSize: 16, fontWeight: '800' }
});
