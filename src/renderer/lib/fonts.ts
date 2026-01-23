// Central font configuration — Single source of truth
// To change fonts: update values here, CSS variables in globals.css, and the Google Fonts link in index.html

export const FONT_SANS_NAME = "Inter";
export const FONT_MONO_NAME = "Source Code Pro";

// Full font stacks as CSS strings (for inline styles)
export const FONT_SANS = `"${FONT_SANS_NAME}", system-ui, sans-serif`;
export const FONT_MONO = `"${FONT_MONO_NAME}", ui-monospace, monospace`;

// Terminal-specific font stack (includes Nerd Font fallbacks for powerline symbols)
export const FONT_TERMINAL = [
  `"${FONT_MONO_NAME}"`,
  "MesloLGM Nerd Font",
  "MesloLGM NF",
  "MesloLGS NF",
  "MesloLGS Nerd Font",
  "ui-monospace",
  "monospace",
].join(", ");
