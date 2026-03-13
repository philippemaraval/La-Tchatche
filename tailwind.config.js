/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bitume: '#121212',
        asphalt: '#1A1A1A',
        anthracite: '#2D2D2D',
        opera: '#B22222',
        operaSoft: '#D05C5C',
        mist: '#D1D1D1',
      },
      boxShadow: {
        premium: '0 18px 45px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        glass: '0 6px 20px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Times New Roman', 'serif'],
        sans: ['Manrope', 'Avenir Next', 'Segoe UI', 'sans-serif'],
      },
      backgroundImage: {
        'opera-gradient': 'linear-gradient(90deg, #7E1313 0%, #B22222 35%, #D43D3D 55%, #B22222 85%, #7E1313 100%)',
      },
    },
  },
  plugins: [],
}
