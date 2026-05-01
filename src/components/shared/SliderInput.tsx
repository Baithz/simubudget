// =============================================================================
// Fichier  : src/components/shared/SliderInput.tsx
// Auteur   : KREMER Régis
// Desc.    : Slider premium — thumb brand, track gradient, labels Geist.
// -----------------------------------------------------------------------------
// Changelog :
//   2026-04-26 | KREMER Régis | Création du fichier
//   2026-04-28 | KREMER Régis | Redesign Phase 7 — CSS vars
//   2026-04-30 | KREMER Régis | Phase 10 — thumb animé, Geist Mono valeur
// =============================================================================

interface Props {
  label:    string;
  value:    number;
  min:      number;
  max:      number;
  step?:    number;
  unit?:    string;
  format?:  (v: number) => string;
  onChange: (v: number) => void;
}

export default function SliderInput({
  label, value, min, max, step = 1, unit = "EUR", format, onChange,
}: Props) {
  const display = format
    ? format(value)
    : `${value.toLocaleString("fr-FR")} ${unit}`;

  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div>
      {/* Label + valeur */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: "6px",
      }}>
        <label style={{
          fontSize: ".78rem",
          fontWeight: 600,
          color: "var(--text-secondary)",
          fontFamily: "'Geist', system-ui, sans-serif",
        }}>
          {label}
        </label>
        <span style={{
          fontFamily: "'Geist Mono', ui-monospace, monospace",
          fontWeight: 700,
          fontSize: ".875rem",
          color: "var(--text-primary)",
        }}>
          {display}
        </span>
      </div>

      {/* Track + thumb */}
      <div style={{ position: "relative", height: 22, display: "flex", alignItems: "center" }}>
        {/* Track fond */}
        <div style={{
          position: "absolute", left: 0, right: 0, height: 5,
          background: "var(--bg-surface-2)",
          borderRadius: 999,
          border: "1px solid var(--border)",
        }}>
          {/* Fill */}
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: "linear-gradient(90deg, var(--brand-2), var(--brand-1))",
            borderRadius: 999,
            transition: "width .08s",
          }} />
        </div>

        {/* Input range */}
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: "relative",
            width: "100%",
            appearance: "none",
            background: "transparent",
            cursor: "pointer",
            height: 22,
            margin: 0,
          }}
          className="slider-thumb"
        />
      </div>

      {/* Bornes */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: ".68rem",
        fontWeight: 600,
        color: "var(--text-placeholder)",
        marginTop: 5,
      }}>
        <span>{min.toLocaleString("fr-FR")} {unit}</span>
        <span>{max.toLocaleString("fr-FR")} {unit}</span>
      </div>
    </div>
  );
}
