import React from 'react';
import { StyleSheet, View, ViewStyle, Pressable } from 'react-native';
import { useTheme } from '../../theme';

interface BlotterProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  deficit?: boolean;
}

/** A restrained slate surface used for focused, high-importance content. */
export const Blotter: React.FC<BlotterProps> = ({
  children,
  onPress,
  style,
  deficit = false,
}) => {
  const { colors, radii } = useTheme();
  const panel = (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: deficit ? colors.negativeSubtle : colors.stampFrom,
          borderColor: deficit ? colors.negative : colors.stampTo,
          borderRadius: radii.stamp,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {panel}
      </Pressable>
    );
  }
  return panel;
};

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: 22,
    paddingVertical: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
