module.exports = {
  Platform: {
    OS: 'web',
    select: (obj) => obj.default || obj.web || obj.ios || obj.android,
  },
  NativeModules: {},
  StyleSheet: {
    create: (styles) => styles,
    hairlineWidth: 1,
  },
};
