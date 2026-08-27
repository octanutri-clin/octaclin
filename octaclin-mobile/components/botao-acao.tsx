import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cores } from '@/lib/tema';

interface Props {
  titulo: string;
  detalhe: string;
  icone: ReactNode;
  cor?: string;
  onPress: () => void;
}

export function BotaoAcao({ titulo, detalhe, icone, cor = cores.primaria, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={detalhe}
      style={({ pressed }) => [styles.container, pressed && styles.pressionado]}
      onPress={onPress}
    >
      <View style={[styles.icone, { backgroundColor: `${cor}22` }]}>{icone}</View>
      <View style={styles.textos}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.detalhe}>{detalhe}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: cores.contorno,
    borderRadius: 8,
    backgroundColor: cores.branco,
    padding: 12
  },
  pressionado: {
    opacity: 0.82
  },
  icone: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textos: {
    flex: 1
  },
  titulo: {
    color: cores.tinta,
    fontSize: 16,
    fontWeight: '700'
  },
  detalhe: {
    marginTop: 2,
    color: cores.textoSecundario,
    fontSize: 13
  }
});
