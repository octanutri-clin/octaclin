import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { inicializarBancoLocal } from '@/lib/banco-local';

export default function LayoutRaiz() {
  useEffect(() => {
    void inicializarBancoLocal();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </>
  );
}
