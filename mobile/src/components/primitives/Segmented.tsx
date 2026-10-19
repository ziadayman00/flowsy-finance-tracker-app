import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { hapticSelection } from '../../utils/haptics';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  selected?: T;
  selectedValue?: T;
  onSelect: (value: T) => void;
  style?: ViewStyle;
}

export function Segmented<T extends string>({
  options,
  selected,
  selectedValue,
  onSelect,
  style,
}: SegmentedProps<T>): React.ReactElement {
  const { colors, radii, spacing } = useTheme();
  const currentSelected = selectedValue ?? selected ?? options[0]?.value;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.sunken,
          borderRadius: radii.sm,
          borderColor: colors.border,
        },
        style,
      ]}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const isSelected = option.value === currentSelected;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!isSelected) {
                hapticSelection();
                onSelect(option.value);
              }
            }}
            style={[
              styles.item,
              {
                borderRadius: radii.sm - 2,
                backgroundColor: isSelected ? colors.surface : 'transparent',
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
          >
            <AppText
              variant="label"
              tone={isSelected ? 'primary' : 'secondary'}
              style={{ textAlign: 'center', fontWeight: isSelected ? '600' : '400' }}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
});
