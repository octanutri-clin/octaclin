import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cores } from '@/lib/tema';

interface Props {
  titulo: string;
  valor: string;
  icone: ReactNode;
}

export function CartaoResumo({ titulo, valor, icone }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.linha}>
        <Text style={styles.titulo}>{titulo}</Text>
        {icone}
      </View>
      <Text style={styles.valor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 88,
    backgroundColor: cores.branco,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: cores.linha,
    padding: 12
  },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  titulo: {
    color: cores.textoSecundario,
    fontSize: 13,
    fontWeight: '600'
  },
  valor: {
    marginTop: 10,
    color: cores.tinta,
    fontSize: 24,
    fontWeight: '800'
  }
});
