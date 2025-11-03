// src/themeConfig.js
export const theme = {
  colors: {
    // Minimal, modern palette
    primary: '#2563EB', // Blue 600
    secondary: '#7C3AED', // Violet 600 (accent / hover)
    background: '#F8FAFC', // Slate 50
    surface: '#FFFFFF', // Card/Form surface
    textPrimary: '#0F172A', // Slate 900
    textSecondary: '#64748B', // Slate 500
    error: '#EF4444', // Red 500
    success: '#10B981', // Emerald 500
  },
  font: {
    family: `'Inter', sans-serif`,
  },
  radius: {
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
  },
  transition: {
    base: 'transition-all duration-200 ease-in-out',
  },
};
