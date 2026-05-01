// =============================================================================
// Fichier  : tailwind.config.js
// Auteur   : KREMER Regis
// Desc.    : Configuration Tailwind - couleurs via CSS vars pour theming correct
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Regis | Creation du fichier
//   2026-04-28 | KREMER Regis | Phase 7 - tokens premium dark finance
//   2026-04-28 | KREMER Regis | Fix critique - text-ink via CSS vars, pas valeurs fixes
// =============================================================================

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces — via CSS variables pour adaptation thème
        base:      "var(--bg-base)",
        surface:   "var(--bg-surface)",
        surface2:  "var(--bg-surface-2)",

        // Brand — couleurs fixes (identiques clair/sombre)
        brand: {
          start:   "#0ea5e9",
          mid:     "#06d6a0",
          end:     "#84cc16",
          DEFAULT: "#06d6a0",
          50:      "#f0fdf9",
          100:     "#ccfbef",
          400:     "#2dd4bf",
          500:     "#06d6a0",
          600:     "#059669",
        },

        // ── CORRECTION CRITIQUE ──────────────────────────────────────────────
        // Les couleurs "ink" DOIVENT passer par CSS variables
        // pour s'adapter au thème clair/sombre automatiquement.
        // Tailwind va générer text-ink-primary → color: var(--text-primary)
        ink: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted:     "var(--text-muted)",
        },

        // États financiers — également via vars pour adaptation
        fin: {
          green: "var(--fin-green)",
          amber: "var(--fin-amber)",
          red:   "var(--fin-red)",
          blue:  "var(--fin-blue)",
        },

        // Bordures via vars
        "border-default": "var(--border)",
        "border-brand":   "var(--border-brand)",

        // Card background via vars
        card: "var(--card-bg)",
      },

      fontFamily: {
        sans:    ["DM Sans", "system-ui", "sans-serif"],
        mono:    ["DM Mono", "monospace"],
        display: ["Syne", "sans-serif"],
      },

      fontSize: {
        "2xs": ["0.68rem",  { lineHeight: "1rem" }],
        xs:    ["0.75rem",  { lineHeight: "1.125rem" }],
        sm:    ["0.875rem", { lineHeight: "1.375rem" }],
        base:  ["1rem",     { lineHeight: "1.6rem" }],
        lg:    ["1.125rem", { lineHeight: "1.75rem" }],
        xl:    ["1.25rem",  { lineHeight: "1.875rem" }],
        "2xl": ["1.5rem",   { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.375rem" }],
        "4xl": ["2.25rem",  { lineHeight: "2.75rem" }],
      },

      borderRadius: {
        sm:   "6px",
        md:   "10px",
        lg:   "14px",
        xl:   "20px",
        "2xl":"28px",
      },

      boxShadow: {
        card:     "var(--shadow-card)",
        glow:     "0 0 40px rgba(6,214,160,.15)",
        "glow-sm":"0 0 20px rgba(6,214,160,.12)",
      },

      backgroundImage: {
        "brand-gradient":  "linear-gradient(135deg, #0ea5e9, #06d6a0, #84cc16)",
        "brand-gradient-h":"linear-gradient(90deg, #0ea5e9, #06d6a0)",
      },

      screens: {
        "2xl": "1536px",
        "3xl": "1920px",
        "4xl": "2560px",
      },
    },
  },
  plugins: [],
};
