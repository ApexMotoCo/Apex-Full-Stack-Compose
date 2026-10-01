/**
 * APEX BRANDING SYSTEM
 * Color Palette & Components
 * ============================================================
 */

const APEX_BRAND = {
  colors: {
    primary: '#ff6b35',      // Vibrant Orange
    secondary: '#004e89',    // Deep Blue
    accent: '#f7931e',       // Golden
    dark: '#0a0e27',         // Dark Navy
    light: '#f5f7fa',        // Light Background
    border: '#e0e6ed',       // Border Gray
    white: '#ffffff',
    
    // Status Colors
    online: '#10b981',       // Green
    offline: '#ef4444',      // Red
    degraded: '#f59e0b',     // Amber
    unknown: '#6b7280',      // Gray
  },
  
  logo: '⚡ APEX',
  tagline: 'In Good Company',
  company: 'Apex',
  
  gradients: {
    primary: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
    secondary: 'linear-gradient(135deg, #0a0e27 0%, #1a2a4e 100%)',
    overlay: 'linear-gradient(135deg, #ffffff 0%, #e0e6ed 100%)',
  },
  
  fonts: {
    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }
};

module.exports = APEX_BRAND;
