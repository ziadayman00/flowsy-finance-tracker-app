import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { calculateSplitGeometry, SplitLineGeometry } from '../../utils/splitLine';
import { formatMoney } from '../../utils/format';

interface SplitLineProps {
  totalLiquidFunds?: string | number;
  totalPendingCommitments?: string | number;
  availableRatio?: number;
  committedRatio?: number;
  isDeficit?: boolean;
  height?: number;
  currency?: string;
  showLegend?: boolean;
  ink?: boolean;
  style?: ViewStyle;
}

export const SplitLine: React.FC<SplitLineProps> = ({
  totalLiquidFunds = 0,
  totalPendingCommitments = 0,
  availableRatio,
  committedRatio = 0,
  isDeficit,
  height,
  currency = 'EGP',
  showLegend = true,
  ink = false,
  style,
}) => {
  const { colors, radii, spacing } = useTheme();

  const geo: SplitLineGeometry =
    availableRatio !== undefined
      ? {
          availableRatio,
          committedRatio,
          isDeficit: isDeficit ?? false,
          deficitAmount: '0.00',
          isZeroOrNegativeLiquid: false,
        }
      : calculateSplitGeometry(totalLiquidFunds, totalPendingCommitments);

  // Normal mode: available% (forest) + committed% (gold)
  const availablePct = Math.round(geo.availableRatio * 100);
  const committedPct = Math.round(geo.committedRatio * 100);

  return (
    <View style={[styles.container, style]}>
      {/* Visual Bar Track */}
      <View
        style={[
          styles.track,
          height ? { height } : null,
          {
            backgroundColor: ink ? colors.stampTrack : colors.splitTrack,
            borderRadius: radii.xs,
          },
        ]}
      >
        {geo.isDeficit ? (
          // Deficit State: entire track in committed tone with overflow end-cap
          <View style={styles.deficitBar}>
            <View
              style={[
                styles.segment,
                {
                  flex: 1,
                  backgroundColor: colors.splitCommitted,
                  borderRadius: radii.xs,
                },
              ]}
            />
            <View
              style={[
                styles.overflowCap,
                {
                  backgroundColor: colors.splitOverflow,
                  borderRadius: radii.xs,
                },
              ]}
            />
          </View>
        ) : (
          // Normal State: Available (forest) inline-start, then Committed (gold)
          <View style={styles.normalBar}>
            {geo.availableRatio > 0 && (
              <View
                style={[
                  styles.segment,
                  {
                    flex: geo.availableRatio,
                    backgroundColor: colors.splitAvailable,
                    borderRadius: radii.xs,
                  },
                ]}
              />
            )}
            {geo.availableRatio > 0 && geo.committedRatio > 0 && (
              <View style={styles.segmentGap} />
            )}
            {geo.committedRatio > 0 && (
              <View
                style={[
                  styles.segment,
                  {
                    flex: geo.committedRatio,
                    backgroundColor: colors.splitCommitted,
                    borderRadius: radii.xs,
                  },
                ]}
              />
            )}
          </View>
        )}
      </View>

      {/* Legend under the Split Line */}
      {showLegend && (
        <View style={styles.legendRow}>
          {geo.isDeficit ? (
            <View style={styles.legendItem}>
              <Icon name="warning-outline" size={14} color={colors.negative} />
              <AppText
                variant="caption"
                tone={ink ? 'inverse' : 'negative'}
                style={ink ? { color: colors.stampOn } : undefined}
              >
                عجز {formatMoney(geo.deficitAmount, currency)}
              </AppText>
            </View>
          ) : (
            <>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.splitAvailable },
                  ]}
                />
                <AppText
                  variant="caption"
                  tone={ink ? 'inverse' : 'secondary'}
                  style={ink ? { color: colors.stampMuted } : undefined}
                >
                  متاح ({availablePct}%)
                </AppText>
              </View>

              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.splitCommitted },
                  ]}
                />
                <AppText
                  variant="caption"
                  tone={ink ? 'inverse' : 'secondary'}
                  style={ink ? { color: colors.stampMuted } : undefined}
                >
                  التزامات الشهر ({committedPct}%)
                </AppText>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 8,
  },
  track: {
    height: 6,
    width: '100%',
    overflow: 'hidden',
  },
  normalBar: {
    flex: 1,
    flexDirection: 'row',
  },
  deficitBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  segment: {
    height: '100%',
  },
  segmentGap: {
    width: 2,
  },
  overflowCap: {
    width: 8,
    height: '100%',
    marginStart: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 16,
    marginTop: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
