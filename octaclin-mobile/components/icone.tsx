import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

type Props = ComponentProps<typeof Ionicons>;

/**
 * Ionicons renderiza um <Text> com glifo de area de uso privado e nao trata
 * acessibilidade. Sozinho ele vira um no focavel sem nome; dentro de um
 * controle, o glifo entra no nome acessivel anunciado. Todo icone deste app e
 * redundante com o texto ao lado, entao fica fora da arvore em ambas as
 * plataformas.
 *
 * As tres props sao necessarias: `accessibilityElementsHidden` cobre o iOS,
 * `importantForAccessibility` cobre o Android e `aria-hidden` cobre o alvo web
 * (react-native-web nao traduz as duas primeiras — verificado no DOM exportado).
 */
export function IconeDecorativo(props: Props) {
  return (
    <Ionicons
      {...props}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    />
  );
}
