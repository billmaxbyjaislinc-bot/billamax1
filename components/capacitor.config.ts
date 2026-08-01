const config = {
  appId: 'com.jaislinc.billmax',
  appName: 'Billmax',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
