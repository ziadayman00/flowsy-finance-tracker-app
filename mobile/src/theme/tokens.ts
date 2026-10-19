/**
 * Flowsy Cool Gray — quiet neutral surfaces, ink-first typography,
 * and a single slate accent supported by semantic financial colors.
 */

import { Platform, TextStyle } from 'react-native';

export interface ColorTokens {
  paper: string;
  forest: string;
  forestDeep: string;
  ink: string;
  mutedInk: string;
  line: string;
  gold: string;
  calmRed: string;
  softGreen: string;
  white: string;

  bg: string;
  background: string;
  surface: string;
  sunken: string;
  surfaceSubtle: string;
  border: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  textInverse: string;

  action: string;
  brand: string;
  onAction: string;
  actionPressed: string;
  actionDisabled: string;
  onActionDisabled: string;

  positive: string;
  positiveSubtle: string;
  positiveMuted: string;
  negative: string;
  negativeSubtle: string;
  negativeMuted: string;
  warning: string;
  warningText: string;
  warningSubtle: string;

  info: string;
  infoSubtle: string;
  selection: string;
  focus: string;
  scrim: string;

  splitAvailable: string;
  splitCommitted: string;
  splitOverflow: string;
  splitTrack: string;

  stampFrom: string;
  stampTo: string;
  stampOn: string;
  stampMuted: string;
  stampTrack: string;
}

export const lightTokens: ColorTokens = {
  paper: '#F4F5F7',
  forest: '#52657D',
  forestDeep: '#394C63',
  ink: '#202631',
  mutedInk: '#687180',
  line: '#DCE1E7',
  gold: '#B98236',
  calmRed: '#C65B61',
  softGreen: '#E4F0EA',
  white: '#FFFFFF',

  bg: '#F4F5F7',
  background: '#F4F5F7',
  surface: '#FFFFFF',
  sunken: '#ECEFF3',
  surfaceSubtle: '#F8F9FB',
  border: '#DCE1E7',

  textPrimary: '#202631',
  textSecondary: '#687180',
  textTertiary: '#8992A0',
  textDisabled: '#AAB2BD',
  textInverse: '#FFFFFF',

  action: '#394C63',
  brand: '#52657D',
  onAction: '#FFFFFF',
  actionPressed: '#2E4055',
  actionDisabled: '#E1E5EA',
  onActionDisabled: '#8992A0',

  positive: '#38856A',
  positiveSubtle: '#E4F0EA',
  positiveMuted: '#E4F0EA',
  negative: '#C65B61',
  negativeSubtle: '#F7E9EA',
  negativeMuted: '#F7E9EA',
  warning: '#B98236',
  warningText: '#8C612B',
  warningSubtle: '#F5EEDF',

  info: '#52657D',
  infoSubtle: '#E5EAF0',
  selection: '#E5EAF0',
  focus: '#52657D',
  scrim: 'rgba(24, 31, 42, 0.48)',

  splitAvailable: '#52657D',
  splitCommitted: '#B98236',
  splitOverflow: '#C65B61',
  splitTrack: '#E5E9EE',

  stampFrom: '#394C63',
  stampTo: '#52657D',
  stampOn: '#FFFFFF',
  stampMuted: 'rgba(255, 255, 255, 0.76)',
  stampTrack: 'rgba(255, 255, 255, 0.18)',
};

export const darkTokens: ColorTokens = {
  paper: '#11161D',
  forest: '#A9B9CC',
  forestDeep: '#8195AE',
  ink: '#F0F3F6',
  mutedInk: '#AEB8C5',
  line: '#303B49',
  gold: '#E1B15E',
  calmRed: '#E5838A',
  softGreen: '#1D332C',
  white: '#1A212B',

  bg: '#11161D',
  background: '#11161D',
  surface: '#1A212B',
  sunken: '#222C38',
  surfaceSubtle: '#171E27',
  border: '#303B49',

  textPrimary: '#F0F3F6',
  textSecondary: '#AFB8C4',
  textTertiary: '#8995A4',
  textDisabled: '#687484',
  textInverse: '#11161D',

  action: '#D7E1EC',
  brand: '#A9B9CC',
  onAction: '#1A212B',
  actionPressed: '#BFCBD9',
  actionDisabled: '#303B49',
  onActionDisabled: '#8995A4',

  positive: '#65B994',
  positiveSubtle: '#1D332C',
  positiveMuted: '#1D332C',
  negative: '#E5838A',
  negativeSubtle: '#3A242A',
  negativeMuted: '#3A242A',
  warning: '#E1B15E',
  warningText: '#E8C77E',
  warningSubtle: '#342B1D',

  info: '#A9B9CC',
  infoSubtle: '#242E3A',
  selection: '#273443',
  focus: '#D7E1EC',
  scrim: 'rgba(0, 0, 0, 0.68)',

  splitAvailable: '#A9B9CC',
  splitCommitted: '#E1B15E',
  splitOverflow: '#E5838A',
  splitTrack: 'rgba(240, 243, 246, 0.12)',

  stampFrom: '#283647',
  stampTo: '#394C63',
  stampOn: '#F0F3F6',
  stampMuted: 'rgba(240, 243, 246, 0.72)',
  stampTrack: 'rgba(240, 243, 246, 0.12)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
  hero: 52,
} as const;

export const radii = {
  xs: 5,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  stamp: 20,
} as const;

export const borders = {
  thin: 1,
  medium: 1.5,
  thick: 2,
} as const;

export const motion = {
  duration: {
    fast: 140,
    normal: 240,
    slow: 380,
  },
  scale: {
    pressed: 0.98,
  },
} as const;

export const shadows = {
  stamp: {
    shadowColor: '#263447',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 3,
  },
  sheet: {
    shadowColor: '#1D2632',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 10,
  },
  toast: {
    shadowColor: '#1D2632',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'system-ui',
});

export const typography = {
  display: {
    fontFamily: systemFont,
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '700' as const,
    letterSpacing: -1.1,
  },
  amountHero: {
    fontFamily: systemFont,
    fontSize: 42,
    lineHeight: 50,
    fontWeight: '700' as const,
    letterSpacing: -0.8,
  },
  amountLg: {
    fontFamily: systemFont,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600' as const,
    letterSpacing: -0.4,
  },
  amountMd: {
    fontFamily: systemFont,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  amountSm: {
    fontFamily: systemFont,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  title1: {
    fontFamily: systemFont,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  title2: {
    fontFamily: systemFont,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as const,
  },
  title3: {
    fontFamily: systemFont,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  heading: {
    fontFamily: systemFont,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  sectionHeading: {
    fontFamily: systemFont,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  bodyStrong: {
    fontFamily: systemFont,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600' as const,
  },
  body: {
    fontFamily: systemFont,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400' as const,
  },
  label: {
    fontFamily: systemFont,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  caption: {
    fontFamily: systemFont,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  micro: {
    fontFamily: systemFont,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  nav: {
    fontFamily: systemFont,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500' as const,
  },
} as const satisfies Record<string, TextStyle>;
