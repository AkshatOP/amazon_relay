/** Relay HUB design tokens — ported verbatim from the Stitch exports. */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#f7faf8", surface: "#f7faf8", "surface-bright": "#f7faf8",
        "surface-container-lowest": "#ffffff", "surface-container-low": "#f1f4f2",
        "surface-container": "#ebefec", "surface-container-high": "#e6e9e7", "surface-container-highest": "#e0e3e1",
        "surface-variant": "#e0e3e1", "surface-dim": "#d7dbd9", "surface-tint": "#066a5f",
        primary: "#00544a", "primary-container": "#0f6e62", "on-primary": "#ffffff", "on-primary-container": "#9cedde",
        "primary-fixed": "#a0f2e2", "primary-fixed-dim": "#85d5c6", "on-primary-fixed": "#00201c", "on-primary-fixed-variant": "#005047",
        secondary: "#4f6070", "secondary-container": "#d0e2f4", "on-secondary": "#ffffff", "on-secondary-container": "#546474",
        "secondary-fixed": "#d3e5f7", "secondary-fixed-dim": "#b7c9db", "on-secondary-fixed": "#0b1d2b", "on-secondary-fixed-variant": "#384958",
        tertiary: "#753924", "tertiary-container": "#925039", "on-tertiary": "#ffffff", "on-tertiary-container": "#ffd5c8",
        "tertiary-fixed": "#ffdbcf", "tertiary-fixed-dim": "#ffb59c", "on-tertiary-fixed": "#390c00", "on-tertiary-fixed-variant": "#713621",
        error: "#ba1a1a", "error-container": "#ffdad6", "on-error": "#ffffff", "on-error-container": "#93000a",
        "on-surface": "#181c1b", "on-surface-variant": "#3e4946", "on-background": "#181c1b",
        outline: "#6e7976", "outline-variant": "#bec9c5",
        "inverse-surface": "#2d3130", "inverse-on-surface": "#eef1ef", "inverse-primary": "#85d5c6",
        amber: "#FFA724", "amber-action": "#FFA724", "near-black": "#131A22", success: "#27AE60",
      },
      borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },
      spacing: { "stack-sm": "4px", "stack-md": "8px", "stack-lg": "16px", "stack-xl": "24px", gutter: "12px", "container-margin": "16px" },
      fontFamily: {
        "display-lg": ["Inter"], "headline-md": ["Inter"], "headline-sm": ["Inter"],
        "body-lg": ["Inter"], "body-md": ["Inter"], "label-md": ["Inter"], "label-bold": ["Inter"], "mono-code": ["JetBrains Mono"],
      },
      fontSize: {
        "display-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-md": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "headline-sm": ["16px", { lineHeight: "24px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "label-bold": ["12px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: "700" }],
        "mono-code": ["12px", { lineHeight: "18px", fontWeight: "400" }],
      },
    },
  },
  plugins: [],
};
