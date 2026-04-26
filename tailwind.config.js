/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'app-bg': 'var(--color-app-bg)',
        'surface': 'var(--color-surface)',
        'surface-el': 'var(--color-surface-el)',
        'surface-elevated': 'var(--color-surface-el)',
        'toolbar': 'var(--color-toolbar)',
        'border': 'var(--color-border)',
        'muted': 'var(--color-muted)',
        'text': 'var(--color-text)',
        'navy': 'var(--color-navy)',
        'slate-accent': 'var(--color-slate-accent)',
        'red-core': 'var(--color-red-core)',
        'red-bright': 'var(--color-red-bright)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'card': '12px',
        'btn': '8px',
      },
    },
  },
  plugins: [],
}
