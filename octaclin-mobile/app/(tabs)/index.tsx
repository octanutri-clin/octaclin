import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotaoAcao } from '@/components/botao-acao';
import { CartaoResumo } from '@/components/cartao-resumo';
import { IconeDecorativo } from '@/components/icone';
import { sincronizarPendentes } from '@/lib/api';
import { contarPendentes, enfileirarSincronizacao } from '@/lib/banco-local';
import { cores } from '@/lib/tema';

export default function DiarioRapido() {
  const [pendentes, setPendentes] = useState(0);
  const [aguaCopos, setAguaCopos] = useState(4);
  const [status, setStatus] = useState('');

  // accessibilityLiveRegion cobre o TalkBack; o VoiceOver so anuncia mudanca de
  // texto fora de foco com announceForAccessibility.
  function anunciar(mensagem: string) {
    setStatus(mensagem);
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(mensagem);
  }

  async function registrar(tipo: string, valor: Record<string, unknown>, confirmacao: string) {
    try {
      await enfileirarSincronizacao('diario_rapido', {
        pacienteId: 'paciente-local',
        tipo,
        valor
      });
      const total = await contarPendentes();
      setPendentes(total);
      anunciar(`${confirmacao} ${total} registro(s) aguardando sincronizacao.`);
    } catch {
      // Sem esta mensagem a falha de gravacao local fica invisivel: o toque
      // "funciona", nada muda na tela e nada e anunciado.
      anunciar('Nao foi possivel salvar o registro no aparelho. Tente novamente.');
    }
  }

  async function sincronizar() {
    anunciar('Sincronizando registros pendentes.');
    try {
      const resultado = await sincronizarPendentes('token-local-dev');
      setPendentes(await contarPendentes());
      anunciar(
        resultado.erros.length > 0
          ? `Sincronizacao parcial. ${resultado.total} enviado(s) e ${resultado.erros.length} com erro.`
          : `Sincronizacao concluida. ${resultado.total} registro(s) enviado(s).`
      );
    } catch {
      setPendentes(await contarPendentes());
      anunciar('Nao foi possivel sincronizar agora. Os registros continuam salvos no aparelho.');
    }
  }

  useEffect(() => {
    void contarPendentes().then(setPendentes);
  }, []);

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <View>
        <Text style={styles.subtitulo}>Jornada de hoje</Text>
        <Text accessibilityRole="header" style={styles.titulo}>
          Diario rapido
        </Text>
      </View>

      <View style={styles.resumos}>
        <CartaoResumo
          titulo="Agua"
          valor={`${aguaCopos} copos`}
          icone={<IconeDecorativo name="water" size={22} color={cores.primaria} />}
        />
        <CartaoResumo
          titulo="Pendentes"
          valor={String(pendentes)}
          icone={<IconeDecorativo name="sync" size={22} color={cores.alerta} />}
        />
      </View>

      {/* Permanece montado mesmo vazio: uma regiao live so anuncia se o no ja existia. */}
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.status}>
        {status}
      </Text>

      <View style={styles.lista}>
        <BotaoAcao
          titulo="Registrar refeicao"
          detalhe="Foto ou texto em poucos segundos"
          cor={cores.primaria}
          icone={<IconeDecorativo name="restaurant" size={26} color={cores.primaria} />}
          onPress={() => registrar('refeicao', { descricao: 'refeicao rapida', origem: 'widget' }, 'Refeicao registrada.')}
        />
        <BotaoAcao
          titulo="Humor agora"
          detalhe="Emoji slider simplificado"
          cor={cores.alerta}
          icone={<IconeDecorativo name="happy" size={26} color={cores.alerta} />}
          onPress={() => registrar('humor', { escala: 4, emoji: ':)' }, 'Humor registrado.')}
        />
        <BotaoAcao
          titulo="Adicionar agua"
          detalhe="Incrementa um copo e salva offline"
          cor={cores.sucesso}
          icone={<IconeDecorativo name="add-circle" size={26} color={cores.sucesso} />}
          onPress={() => {
            const proximo = aguaCopos + 1;
            setAguaCopos(proximo);
            void registrar('agua', { copos: proximo }, `Agua registrada, ${proximo} copos hoje.`);
          }}
        />
        <BotaoAcao
          titulo="Sincronizar"
          detalhe="Envia pendencias quando houver conexao"
          cor={cores.primaria}
          icone={<IconeDecorativo name="cloud-upload" size={26} color={cores.primaria} />}
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
  status: {
    color: cores.tinta,
    fontSize: 14,
    lineHeight: 20
  },
  lista: {
    gap: 10
  }
});
