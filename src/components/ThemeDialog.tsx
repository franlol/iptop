import { theme, themes } from "../theme"

interface ThemeDialogProps {
  selectedIndex: number
}

// the swatch colors previewed for each theme row, in order
const SWATCH_KEYS = ["download", "upload", "accent", "magenta", "yellow", "cyan"] as const

// Centered modal overlay listing the themes. Selection is applied live as the
// user moves, so the whole UI behind the dialog recolors in real time; this
// panel only needs to highlight the current row and show a swatch preview.
export function ThemeDialog({ selectedIndex }: ThemeDialogProps) {
  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <box
        title=" Theme "
        style={{
          border: true,
          borderStyle: "rounded",
          borderColor: theme.accent,
          backgroundColor: theme.panel,
          flexDirection: "column",
          paddingTop: 1,
          paddingBottom: 1,
          paddingLeft: 2,
          paddingRight: 2,
          minWidth: 34,
        }}
      >
        {themes.map((t, i) => {
          const selected = i === selectedIndex
          return (
            <box key={t.name} style={{ flexDirection: "row", height: 1 }}>
              <text wrapMode="none">
                <span fg={selected ? theme.accent : theme.dim}>{selected ? "› " : "  "}</span>
                <span fg={selected ? theme.text : theme.dim}>
                  {selected ? <b>{t.name}</b> : t.name}
                </span>
              </text>
              <box style={{ flexGrow: 1 }} />
              <text wrapMode="none">
                {SWATCH_KEYS.map((k) => (
                  <span key={k} fg={t.palette[k]}>
                    █
                  </span>
                ))}
              </text>
            </box>
          )
        })}
        <box style={{ height: 1 }} />
        <text fg={theme.dim} wrapMode="none">
          j/k move · ⏎ apply · esc cancel
        </text>
      </box>
    </box>
  )
}
