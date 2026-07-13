import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { enfileirarSincronizacao } from '@/lib/banco-local';
import { cores } from '@/lib/tema';

export default function CapturaMultimodal() {
  const [cameraPermissao, solicitarCamera] = useCameraPermissions();
  const [microfonePermissao, solicitarMicrofone] = useMicrophonePermissions();
  const [gravandoAudio, setGravandoAudio] = useState<Audio.Recording | null>(null);
  const [modoVideo, setModoVideo] = useState(false);

  async function gravarAudio() {
    if (!microfonePermissao?.granted) {
      await solicitarMicrofone();
      return;
    }

    if (gravandoAudio) {
      await gravandoAudio.stopAndUnloadAsync();
      const uri = gravandoAudio.getURI();
      setGravandoAudio(null);
      await enfileirarSincronizacao('midia_audio', { uri, tipo: 'audio', duracaoLimiteSegundos: 120 });
      Alert.alert('Audio salvo', 'Resposta por audio adicionada a fila offline.');
      return;
    }

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    setGravandoAudio(recording);
  }

  async function registrarCaptura(tipo: 'imagem' | 'video') {
    if (!cameraPermissao?.granted) {
      await solicitarCamera();
      return;
    }
    await enfileirarSincronizacao('midia_captura', { tipo, duracaoLimiteSegundos: tipo === 'video' ? 30 : undefined });
    Alert.alert('Captura preparada', tipo === 'video' ? 'Video limitado a 30 segundos.' : 'Imagem pronta para upload.');
  }

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <View>
        <Text style={styles.subtitulo}>Check-in multimodal</Text>
        <Text style={styles.titulo}>Captura</Text>
      </View>

      <View style={styles.preview}>
        {cameraPermissao?.granted ? (
          <CameraView style={styles.camera} facing="back" mode={modoVideo ? 'video' : 'picture'} />
        ) : (
          <View style={styles.semPermissao}>
            <Ionicons name="camera" size={38} color={cores.textoSecundario} />
            <Text style={styles.textoPermissao}>Permita a camera para registrar refeicoes e videos curtos.</Text>
          </View>
        )}
      </View>

      <View style={styles.grade}>
        <Pressable style={styles.botao} onPress={() => registrarCaptura('imagem')}>
          <Ionicons name="image" size={24} color={cores.primaria} />
          <Text style={styles.botaoTexto}>Foto refeicao</Text>
        </Pressable>
        <Pressable
          style={styles.botao}
          onPress={() => {
            setModoVideo(true);
            void registrarCaptura('video');
          }}
        >
          <Ionicons name="videocam" size={24} color={cores.alerta} />
          <Text style={styles.botaoTexto}>Video 30s</Text>
        </Pressable>
        <Pressable style={[styles.botao, gravandoAudio && styles.botaoAtivo]} onPress={gravarAudio}>
          <Ionicons name={gravandoAudio ? 'stop-circle' : 'mic'} size={24} color={gravandoAudio ? cores.perigo : cores.sucesso} />
          <Text style={styles.botaoTexto}>{gravandoAudio ? 'Parar audio' : 'Audio 2min'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 16, gap: 16 },
  subtitulo: { color: cores.textoSecundario, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  titulo: { marginTop: 4, color: cores.tinta, fontSize: 28, fontWeight: '800' },
  preview: { height: 320, overflow: 'hidden', borderRadius: 8, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.branco },
  camera: { flex: 1 },
  semPermissao: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  textoPermissao: { marginTop: 12, textAlign: 'center', color: cores.textoSecundario, fontSize: 14 },
  grade: { gap: 10 },
  botao: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: cores.branco, borderRadius: 8, borderWidth: 1, borderColor: cores.linha },
  botaoAtivo: { borderColor: cores.perigo, backgroundColor: '#fff4f2' },
  botaoTexto: { color: cores.tinta, fontSize: 16, fontWeight: '700' }
});
