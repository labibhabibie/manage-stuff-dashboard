/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        primary: '#2e6fd8',
        'primary-black': '#1f2937',
        secondary: '#013784',
        accent: '#f47c20',
        'light-gray': '#f5f7fa',
        'normal-gray': '#9ca3af',
        'dark-gray': '#4b5563',
        subtle: '#d1d5db',

        success: '#16a34a',
        warning: '#f59e0b',
        error: '#dc2626',
        brand: {
          50:  '#eef4ff',
          100: '#d9e7ff',
          200: '#b7d2ff',
          300: '#8bb5ff',
          400: '#5f93ff',
          500: '#2f6fed',
          600: '#0B4DB3',
          700: '#083D91',
          800: '#062F6F',
          900: '#041F4D',
          950: '#02122E',
        },
        surface: {
          50:  '#1F2937',
          100: '#374151',
          200: '#4B5563',
          300: '#6B7280',
          400: '#9CA3AF',
          500: '#BFC7D1',
          600: '#D5DBE3',
          700: '#E5E7EB',
          800: '#FFFFFF',
          900: '#FFFFFF',
          950: '#F2F2F2',
        }
      }
    }
  },
  plugins: []
}
