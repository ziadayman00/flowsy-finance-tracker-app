import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { AppText } from '../../components/primitives/AppText';
import { Icon } from '../../components/primitives/Icon';
import { SplitLine } from '../../components/primitives/SplitLine';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';

interface WelcomeScreenProps {
  onStartRegister: () => void;
  onGoToLogin: () => void;
}

/* Illustrative numbers for the hero cards, not user data */
const DEMO_SAFE = 12480;
const DEMO_RENT = 8500;
const DEMO_NEXT = 1450;

const fmt = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const IVORY = '#F5F3EB';
const IVORY_DIM = 'rgba(245,243,235,0.68)';
const IVORY_GHOST = 'rgba(245,243,235,0.10)';

/** Card rises from below with a spring: the one orchestrated moment. */
const useRise = (delay: number, from = 260) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, {
      toValue: 1,
      delay,
      damping: 16,
      stiffness: 110,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [v, delay]);
  return {
    opacity: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
    translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }),
  };
};

const useFade = (delay: number) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 500,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, delay]);
  return { opacity: v };
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartRegister,
  onGoToLogin,
}) => {
  const { colors, radii } = useTheme();
  const insets = useSafeAreaInsets();

  /* Count-up for the front card number */
  const counter = useRef(new Animated.Value(0)).current;
  const [amount, setAmount] = useState(0);
  useEffect(() => {
    const id = counter.addListener(({ value }) => setAmount(value));
    Animated.timing(counter, {
      toValue: DEMO_SAFE,
      duration: 1400,
      delay: 750,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => counter.removeListener(id);
  }, [counter]);

  const headerFade = useFade(0);
  const copyFade = useFade(120);
  const actionsFade = useFade(900);

  const backRise = useRise(250);
  const midRise = useRise(380);
  const frontRise = useRise(520);

  return (
    <View style={[styles.root, { backgroundColor: colors.forest }]}>
      <StatusBar barStyle="light-content" />

      {/* ---------- Brand ---------- */}
      <Animated.View
        style={[styles.brandRow, { paddingTop: insets.top + 12 }, headerFade]}
      >
        <View style={[styles.logoWrap, { backgroundColor: IVORY, borderRadius: radii.md }]}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <AppText variant="title2" style={{ color: IVORY, fontWeight: '700' }}>
          {strings.appName}
        </AppText>
      </Animated.View>

      {/* ---------- Headline ---------- */}
      <Animated.View style={[styles.copy, copyFade]}>
        <AppText variant="display" style={styles.headline}>
          {strings.auth.welcomeHeadline}
        </AppText>
        <AppText variant="body" style={styles.tagline}>
          {strings.auth.welcomeTagline}
        </AppText>
      </Animated.View>

      {/* ---------- Fanned card stack ---------- */}
      <View style={styles.stage}>
        {/* Back card: quiet ghost surface */}
        <Animated.View
          style={[
            styles.card,
            styles.cardBack,
            {
              backgroundColor: IVORY_GHOST,
              borderRadius: 32,
              opacity: backRise.opacity,
              transform: [{ translateY: backRise.translateY }, { rotate: '7deg' }],
            },
          ]}
        />

        {/* Middle card: upcoming rent (gold) */}
        <Animated.View
          style={[
            styles.card,
            styles.cardMid,
            {
              backgroundColor: colors.gold,
              borderRadius: 32,
              opacity: midRise.opacity,
              transform: [{ translateY: midRise.translateY }, { rotate: '-5deg' }],
            },
          ]}
        >
          <View style={styles.midRow}>
            <View style={styles.midIcon}>
              <Icon name="home-outline" size={18} color="#202923" />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <AppText variant="bodyStrong" style={{ color: '#202923' }}>
                إيجار الشقة
              </AppText>
              <AppText variant="caption" style={{ color: 'rgba(32,41,35,0.7)' }}>
                بعد ٣ أيام
              </AppText>
            </View>
            <AppText variant="bodyStrong" style={{ color: '#202923' }}>
              −{fmt(DEMO_RENT)}
            </AppText>
          </View>
        </Animated.View>

        {/* Front card: Safe to Spend */}
        <Animated.View
          style={[
            styles.card,
            styles.cardFront,
            {
              backgroundColor: IVORY,
              borderRadius: 32,
              opacity: frontRise.opacity,
              transform: [{ translateY: frontRise.translateY }],
            },
          ]}
        >
          <View style={styles.frontTop}>
            <AppText variant="bodyStrong" style={{ color: '#202923' }}>
              تقدر تصرف كام النهارده؟
            </AppText>
            <View style={[styles.liveDot, { backgroundColor: colors.positive }]} />
          </View>

          <View style={styles.amountRow}>
            <AppText style={styles.amount}>{fmt(amount)}</AppText>
            <AppText style={styles.currency}>ج.م</AppText>
          </View>

          <View style={{ marginTop: 18 }}>
            <SplitLine
              availableRatio={0.65}
              committedRatio={0.35}
              isDeficit={false}
              height={10}
            />
          </View>

          <View style={styles.frontFoot}>
            <AppText variant="caption" style={{ color: '#68736B' }}>
              بعد التزامات الشهر
            </AppText>
            <AppText variant="caption" style={{ color: '#68736B' }}>
              الدفعة الجاية {fmt(DEMO_NEXT)}
            </AppText>
          </View>
        </Animated.View>
      </View>

      {/* ---------- Actions ---------- */}
      <Animated.View
        style={[
          styles.actions,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          actionsFade,
        ]}
      >
        <View style={styles.privacyRow}>
          <Icon name="shield-checkmark-outline" size={16} color={IVORY_DIM} />
          <AppText variant="caption" style={{ color: IVORY_DIM }}>
            {strings.auth.privacyPillar}
          </AppText>
        </View>

        <Pressable
          onPress={() => {
            haptics.impactLight();
            onStartRegister();
          }}
          style={({ pressed }) => [
            styles.primaryBtn,
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <AppText variant="bodyStrong" style={styles.primaryText}>
            {strings.auth.getStarted}
          </AppText>
        </Pressable>

        <Pressable
          onPress={() => {
            haptics.impactLight();
            onGoToLogin();
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.linkBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <AppText variant="body" style={{ color: IVORY, fontWeight: '600' }}>
            {strings.auth.haveAccount}
          </AppText>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  logoWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 30, height: 30 },

  copy: {
    paddingHorizontal: 24,
    marginTop: 28,
    gap: 10,
  },
  headline: {
    color: IVORY,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontSize: 40,
    lineHeight: 54,
    fontWeight: '800',
  },
  tagline: {
    color: IVORY_DIM,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontSize: 16,
    lineHeight: 25,
  },

  /* Card stack, cropped at the bottom edge on purpose */
  stage: {
    flex: 1,
    marginTop: 20,
    overflow: 'hidden',
  },
  card: {
    position: 'absolute',
    alignSelf: 'center',
    width: '84%',
  },
  cardBack: {
    top: 14,
    height: 260,
  },
  cardMid: {
    top: 34,
    height: 260,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  midRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  midIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(32,41,35,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFront: {
    top: 92,
    height: 300,
    padding: 22,
  },
  frontTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  amount: {
    fontSize: 54,
    lineHeight: 62,
    fontWeight: '800',
    color: '#173F35',
    fontVariant: ['tabular-nums'],
  },
  currency: {
    fontSize: 20,
    fontWeight: '700',
    color: '#68736B',
    marginBottom: 10,
  },
  frontFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },

  /* Actions sit directly on the green: no sheet */
  actions: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 12,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtn: {
    height: 58,
    borderRadius: 29,
    backgroundColor: IVORY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#173F35',
    fontSize: 17,
    fontWeight: '800',
  },
  linkBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});