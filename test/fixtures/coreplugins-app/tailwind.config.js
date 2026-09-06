module.exports = {
  content: ['./src/**/*.html'],
  separator: '_',
  safelist: ['bg-red-500', 'bg-green-500'],
  corePlugins: {
    preflight: false,
    container: false,
  },
  plugins: [require('tailwindcss-animate')],
};
