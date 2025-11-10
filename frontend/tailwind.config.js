/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark theme colors
        dark: {
          primary: '#1a1a1a',
          secondary: '#2d2d2d',
          tertiary: '#404040',
          border: '#404040',
          text: {
            primary: '#ffffff',
            secondary: '#b0b0b0',
            muted: '#808080',
          },
          // Custom blue for dark theme
          blue: {
            primary: '#1976d2',
            secondary: '#42a5f5',
            light: '#64b5f6',
            dark: '#1565c0',
          },
          // Chat colors
          chat: {
            own: '#2d2d2d',
            other: '#404040',
          },
        },
        // Light theme colors
        light: {
          primary: '#ffffff',
          secondary: '#f5f5f5',
          tertiary: '#e0e0e0',
          border: '#e0e0e0',
          text: {
            primary: '#333333',
            secondary: '#666666',
            muted: '#999999',
          },
          // Custom blue for light theme
          blue: {
            primary: '#1976d2',
            secondary: '#42a5f5',
            light: '#90caf9',
            dark: '#0d47a1',
          },
          // Chat colors
          chat: {
            own: '#e3f2fd',
            other: '#f5f5f5',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'bounce-in': 'bounceIn 0.6s ease-out',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'dark-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
        'dark-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'inherit',
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    // Custom plugin for theme-aware colors
    function({ addUtilities, theme }) {
      const newUtilities = {
        '.theme-bg-primary': {
          backgroundColor: 'var(--theme-bg-primary)',
        },
        '.theme-bg-secondary': {
          backgroundColor: 'var(--theme-bg-secondary)',
        },
        '.theme-bg-tertiary': {
          backgroundColor: 'var(--theme-bg-tertiary)',
        },
        '.theme-text-primary': {
          color: 'var(--theme-text-primary)',
        },
        '.theme-text-secondary': {
          color: 'var(--theme-text-secondary)',
        },
        '.theme-text-muted': {
          color: 'var(--theme-text-muted)',
        },
        '.theme-border': {
          borderColor: 'var(--theme-border)',
        },
        '.theme-blue-primary': {
          backgroundColor: 'var(--theme-blue-primary)',
        },
        '.theme-blue-secondary': {
          backgroundColor: 'var(--theme-blue-secondary)',
        },
      };
      addUtilities(newUtilities);
    },
  ],
};