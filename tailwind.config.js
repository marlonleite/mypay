/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Nubank palette
        dark: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#1a1a1a',
          950: '#111111',
        },
        // Nubank purple
        nubank: {
          50: '#f5e6ff',
          100: '#e9ccff',
          200: '#d699ff',
          300: '#c266ff',
          400: '#a933ff',
          500: '#820ad1',
          600: '#6b08a8',
          700: '#540680',
          800: '#3d0458',
          900: '#260230',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'nubank': '0 4px 14px rgba(130, 10, 209, 0.3)',
        'nubank-lg': '0 8px 24px rgba(130, 10, 209, 0.4)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      }
    },
  },
  plugins: [],
}
