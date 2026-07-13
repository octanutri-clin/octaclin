import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BotaoAcao } from '@/components/botao-acao';
import { CartaoResumo } from '@/components/cartao-resumo';
import { sincronizarPendentes } from '@/lib/api';
import { contarPendentes, enfileirarSincronizacao } from '@/lib/banco-local';
import { cores } from '@/lib/tema';

export default function DiarioRapido() {
  const [pendentes, setPendentes] = useState(0);
  const [aguaCopos, setAguaCopos] = useState(4);

  async function registrar(tipo: string, valor: Record<string, unknown>) {
    await enfileirarSincronizacao('diario_rapido', {
      pacienteId: 'paciente-local',
      tipo,
      valor
    });
    setPendentes(await contarPendentes());
  }

  async function sincronizar() {
    try {
      await sincronizarPendentes('token-local-dev');
      setPendentes(await contarPendentes());
    } catch {
      setPendentes(await contarPendentes());
    }
  }

  useEffect(() => {
    void contarPendentes().then(setPendentes);
  }, []);

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <View>
        <Text style={styles.subtitulo}>Jornada de hoje</Text>
        <Text style={styles.titulo}>Diario rapido</Text>
      </View>

      <View style={styles.resumos}>
        <CartaoResumo titulo="Agua" valor={`${aguaCopos} copos`} icone={<Ionicons name="water" size={22} color={cores.primaria} />} />
        <CartaoResumo titulo="Pendentes" valor={String(pendentes)} icone={<Ionicons name="sync" size={22} color={cores.alerta} />} />
      </View>

      <View style={styles.lista}>
        <BotaoAcao
          titulo="Registrar refeicao"
          detalhe="Foto ou texto em poucos segundos"
          cor={cores.primaria}
          icone={<Ionicons name="restaurant" size={26} color={cores.primaria} />}
          onPress={() => registrar('refeicao', { descricao: 'refeicao rapida', origem: 'widget' })}
        />
        <BotaoAcao
          titulo="Humor agora"
          detalhe="Emoji slider simplificado"
          cor={cores.alerta}
          icone={<Ionicons name="happy" size={26} color={cores.alerta} />}
          onPress={() => registrar('humor', { escala: 4, emoji: ':)' })}
        />
        <BotaoAcao
          titulo="Adicionar agua"
          detalhe="Incrementa um copo e salva offline"
          cor={cores.sucesso}
          icone={<Ionicons name="add-circle" size={26} color={cores.sucesso} />}
          onPress={() => {
            const proximo = aguaCopos + 1;
            setAguaCopos(proximo);
            void registrar('agua', { copos: proximo });
          }}
        />
        <BotaoAcao
          titulo="Sincronizar"
          detalhe="Envia pendencias quando houver conexao"
          cor={cores.primaria}
          icone={<Ionicons name="cloud-upload" size={26} color={cores.primaria} />}
          onPress={sincronizar}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: cores.fundo
  },
  conteudo: {
    padding: 16,
    gap: 16
  },
  subtitulo: {
    color: cores.textoSecundario,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  titulo: {
    marginTop: 4,
    color: cores.tinta,
    fontSize: 28,
    fontWeight: '800'
  },
  resumos: {
    flexDirection: 'row',
    gap: 10
  },
  lista: {
    gap: 10
  }
});
