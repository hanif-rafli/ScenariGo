# ScenariGo UI Design System & Map Styling Rules

## 1. Palette Invariants
- **Background**: `#000000` (Pitch Black).
- **Panels & Cards**: `#0a0a0a` / `#111111` with `border border-neutral-800`.
- **Text**: Pure white `#ffffff` for headings and values, `#a3a3a3` for secondary labels, `#737373` for metadata.
- **Typography**: Monospace (`font-mono`) for numerical data, audit tokens, and metrics.

## 2. Map Elements
- **Basemap**: OpenStreetMap raster tiles with dark monochrome CSS filter:
  `filter: grayscale(100%) invert(100%) contrast(140%) brightness(75%)`
  Zero API keys, zero watermarks.
- **Edges / Polylines**:
  - Land Highway: Solid Amber `#f59e0b` (weight 2.5).
  - Maritime Sea Lane: Dashed Light Blue `#38bdf8` (weight 3.5, dashArray `8, 8`).
  - Air Corridor: Solid Purple `#c084fc` (weight 2.5).
  - Deficit / Infeasible: Solid Red `#ef4444` (weight 3.0).
  - NEVER use white for map polyline edges.

## 3. Value Density & Fluff Prohibition
- **Zero Cosmetic Fluff**: Omit decorative logo containers, static version numbers, and generic online badges.
- **High Signal-to-Noise**: Header and navigation must be lean and minimal: Project Name, Subtitle, Active Scenario Context, and direct functional links (e.g. Docs) only.
- **Actionable Telemetry First**: Prioritize data tables, GIS paths, and quantitative audit tokens over visual decoration.
