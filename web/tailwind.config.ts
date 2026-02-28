import type { Config } from 'tailwindcss';
import neobrutalism from '@01sadra/tailwind-neobrutalism';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1280px',
      },
    },
    extend: {
      colors: {
        neo: {
          ink: 'hsl(var(--fg))',
          paper: 'hsl(var(--card))',
          muted: 'hsl(var(--muted))',
          yellow: 'hsl(var(--accent))',
          teamA: 'hsl(var(--team-a))',
          teamB: 'hsl(var(--team-b))',
          success: 'hsl(var(--success))',
          danger: 'hsl(var(--danger))',
        },
        bg: 'hsl(var(--bg))',
        fg: 'hsl(var(--fg))',
        card: 'hsl(var(--card))',
        border: 'hsl(var(--border))',
        muted: 'hsl(var(--muted))',
        success: 'hsl(var(--success))',
        danger: 'hsl(var(--danger))',
        teamA: 'hsl(var(--team-a))',
        teamB: 'hsl(var(--team-b))',
        accent: 'hsl(var(--accent))',
      },
      borderRadius: {
        neo: 'var(--radius)',
      },
      boxShadow: {
        neo: 'var(--shadow-neo)',
        'neo-sm': 'var(--shadow-neo-sm)',
        'neo-pressed': 'var(--shadow-neo-pressed)',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'sans-serif'],
        body: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.01)' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [neobrutalism as any],
} satisfies Config;
