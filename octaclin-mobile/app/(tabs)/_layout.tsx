import { Tabs } from 'expo-router';
import { IconeDecorativo } from '@/components/icone';

export default function LayoutTabs() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#247BA0',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 8 },
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: { color: '#1F2937', fontWeight: '700' }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Diario',
          tabBarIcon: ({ color, size }) => <IconeDecorativo name="flash" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="captura"
        options={{
          title: 'Captura',
          tabBarIcon: ({ color, size }) => <IconeDecorativo name="camera" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="acompanhante"
        options={{
          title: 'Acompanhante',
          tabBarIcon: ({ color, size }) => <IconeDecorativo name="people" color={color} size={size} />
        }}
      />
    </Tabs>
  );
}
