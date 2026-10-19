import React from 'react';
import { View, StyleSheet, ScrollView, ViewStyle, StyleProp, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  scrollable?: boolean;
  hasTabBar?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  withTopInset?: boolean;
  withBottomInset?: boolean;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  scroll = false,
  scrollable,
  hasTabBar,
  style,
  contentContainerStyle,
  withTopInset = true,
  withBottomInset = true,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shouldScroll = scrollable ?? scroll;

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: withTopInset ? insets.top : 0,
    paddingBottom: withBottomInset ? insets.bottom : 0,
  };

  const innerStyle: ViewStyle = {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  };

  return (
    <View style={[containerStyle, style]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      {shouldScroll ? (
        <ScrollView
          style={innerStyle}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[innerStyle, contentContainerStyle]}>{children}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
});
