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
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          light: 'hsl(var(--primary-light))',
        },
        secondary: '#3B82F6',
        accent: {
          DEFAULT: '#EA580C',
          hover: '#C2410C',
        },
        destructive: '#DC2626',
        ring: '#2563EB',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 10px rgba(0,0,0,0.04)',
        medium: '0 4px 20px rgba(0,0,0,0.08)',
        glass: '0 8px 32px rgba(37, 99, 235, 0.12)',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}
