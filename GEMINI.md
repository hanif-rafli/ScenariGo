# ScenariGo - Project Rules & Workspace Context

## 1. Project Overview & Deliverables
- **Project Title**: ScenariGo — Interactive Multi-Modal Logistics Scenario Simulation & Discrete Optimization Engine
- **Lead Developer**: Muhammad Hanif Rafli (Hanif)
- **Primary Tech Stack**:
  - **Backend API & Optimization Core**: Python 3.12, FastAPI, Pydantic, Custom Discrete Optimization Algorithms (Ford-Fulkerson circulation with lower bounds, Multi-Source Dijkstra, Topological partitioning).
  - **Frontend UI & Visualization**: Vite, React, TypeScript, Tailwind CSS, React-Leaflet (OpenStreetMap), Papaparse (CSV Ingestion).
- **Core Mission**: Solve the "What-If" Feasibility & Network Flow Problem for multi-echelon inventory replenishment across Peninsular and East Malaysia, modeling warehouse stock, store requests, intermodal sea/air transshipment, vehicle fuel/range limits, and transport budget caps.

---

## 2. Workspace Modification Boundaries
- **STRICT BOUNDARY ENFORCEMENT**:
  - ONLY the `ScenariGo` directory (`c:\Users\Hanif Rafli\Desktop\Ad astra\ScenariGo`) is mutable.
  - ALL other sibling project directories in the workspace are **STRICTLY READ-ONLY**:
    - `c:\Users\Hanif Rafli\Desktop\Job Search\TXA` (Read-only reference: Malaysian logistics intelligence, port workflows, trade jargon)
    - `c:\Users\Hanif Rafli\Desktop\MONASH\FIT2004 s2 2025\Assignment 1` (Read-only reference: Ford-Fulkerson with lower bounds & circulation algorithms)
    - `c:\Users\Hanif Rafli\Desktop\MONASH\Hackathon Averis` (Read-only reference: Top 10 finalist architecture, Sergio's advice, resilience patterns)
    - `c:\Users\Hanif Rafli\Desktop\MONASH\Final Year Project` (Read-only reference: AIMail academic codebase)
- NEVER run write, delete, git, build, or modifying commands in any directory outside `ScenariGo/`.

---

## 3. Working Directory & Command Execution
- **Active Codebase**: `codebase/` (`c:\Users\Hanif Rafli\Desktop\Ad astra\ScenariGo\codebase`).
  - Backend tasks: Always set `cwd` to `c:\Users\Hanif Rafli\Desktop\Ad astra\ScenariGo\codebase\backend`.
  - Frontend tasks: Always set `cwd` to `c:\Users\Hanif Rafli\Desktop\Ad astra\ScenariGo\codebase\frontend`.
- Non-code assets:
  - Technical specifications reside in `specs/` (`specs/specs-overall.md`).
  - System diagrams and historical specs reside in `docs/`.
  - Initial prototypes and exploratory scripts reside in `research/`.

---

## 4. GitHub MCP Server Policy & Credential Enforcement
- **STRICTLY PERSONAL IDENTITY**:
  - Exclusively use `github-personal` MCP server tools (account: `hanif-rafli`, email: `hanifrafli0503@gmail.com`).
  - **STRICTLY PROHIBITED**: NEVER invoke `github-academic` or academic credentials (`HanifRafli`, `mraf0008@student.monash.edu`) for this repository under any circumstances.
- **Git Push Operations**:
  - Pushes to remote personal repositories must use the personal credentials configured in `github-personal` (retrieved from `~/.gemini/config/mcp_config.json` under `mcpServers.github-personal.env.GITHUB_PERSONAL_ACCESS_TOKEN`).
- **Pull Request Creation & Approval Protocol**:
  - The assistant is authorized and encouraged to draft Pull Requests (title, multi-line summary, architectural notes, and verification checklist).
  - With Hanif's explicit confirmation, the assistant creates the Pull Request on GitHub using personal credentials.
  - **Mandatory CI Verification Check**: Immediately upon PR creation, the assistant MUST query GitHub Actions CI status (via `/commits/{head_sha}/check-runs` or `/actions/runs`) to verify if tests pass `[OK]` or fail `[FAIL]`, and report the CI outcome directly to Hanif.
- **PR Merging**:
  - NEVER automate pull request merges. PR merges are strictly reserved for manual human execution by Hanif.

---

## 5. Engineering Standards & Architecture Rules

### 5.1 Strict No-Emoji Policy
- **NO EMOJIS**: Never use emojis in code, comments, commit messages, PR descriptions, documentation, UI components, terminal output, or chat responses.
- Use clean, professional text badges (e.g. `[OK]`, `[FAIL]`, `[VERIFIED]`, `[INFEASIBLE]`, `[DEFICIT]`) or standard SVG vector icons.

### 5.2 Decoupled Algorithmic Pipeline
Follow the 4-stage sequential optimization architecture defined in `specs/specs-overall.md`:
1. **Stage 1 (O(N) Early Cutoff)**: Global inventory feasibility check. Halts immediately with audit tokens if aggregate warehouse supply is insufficient for any product.
2. **Stage 2 (Topological Reachability)**: Subgraph partitioning via BFS/Dijkstra into land-reachable components vs intermodal maritime/air gateways.
3. **Stage 3 (Network Flow with Bounds)**: Multi-commodity residual flow via Ford-Fulkerson circulation with lower bounds to establish the allocation matrix.
4. **Stage 4 (Vehicle Tour & Budget Pacing)**: Multi-source Dijkstra for road routing, fuel range checks, refueling station insertions, and transport budget summation.

### 5.3 Actionable UX Feedback Tokens
- Avoid generic failure statuses. Always output concrete, human-readable audit tokens:
  - `[FAIL: INVENTORY DEFICIT] Product P1 short by 10 units at Store S2 (Kuching).`
  - `[FAIL: RANGE EXCEEDED] Truck T1 requires 32L fuel to reach Store S4 from Warehouse W0, exceeding 26L tank limit.`
  - `[FAIL: OVERBUDGET] Total transport cost MYR 7,850 exceeds budget cap of MYR 7,000 (+MYR 850 overage).`

### 5.4 Type Safety & Contracts
- **Python Backend**: Strict Pydantic models for all API request/response payloads (`Warehouse`, `Store`, `FleetConfig`, `SimulationResult`). Strict type hints on every function.
- **TypeScript Frontend**: Strict TypeScript interfaces matching backend Pydantic schemas. Zero `any` types outside external library parsing boundaries.

### 5.5 Realistic GIS Transport Routing & Anti-Naive-Chord Rule
- **STRICT PROHIBITION**: NEVER generate or render transportation network edges as naive direct Euclidean chords connecting POIs across country terrain, mountains, or landmasses.
- **Road Highway Layer**:
  - All land edges must snap to and traverse actual highway/road network geometry (e.g. OpenStreetMap / OSRM highway coordinates for E1/AH2, Federal Route 2, Pan-Borneo Highway).
  - Use high-resolution polyline coordinates (baked offline via Ramer-Douglas-Peucker simplification or queried dynamically via `fetch_dynamic_road_path`).
- **Maritime Shipping Fairway Layer**:
  - Maritime shipping routes must navigate strictly within designated oceanic fairways (Malacca Strait TSS, Singapore Strait TSS south of Singapore, South China Sea deepwater corridor).
  - **Zero Land Intersection**: Sea lanes must safely circumvent landmasses, peninsulas, and capes in deep international water (e.g. vessels transiting to Kuching must round Tanjung Datu to the north at latitude >= 2.40°N, at least 35 km offshore, before entering the Muara Tebas deepwater channel).
  - **Port Snapping ("Fairway Jumping")**: Vessels must remain on the trunk fairway until reaching the waypoint closest to the harbor entrance, traversing only the designated port approach channel into the berth.

### 5.6 Design System: Pitch-Black Monochrome & Chromatic Map Styling
- **Pitch-Black Foundation**: UI background must be pure pitch-black (`#000000`), panels in deep dark neutral (`#0a0a0a` / `#111111`), text in crisp white (`#ffffff` / `#f5f5f5`), and borders in subtle gray (`border-neutral-800`).
- **No Generic "Vibe-Coded" Pastels**: Avoid soft pastel gradients, rounded pill cards with glowing drop-shadows, or low-contrast gray backgrounds.
- **Zero API-Key Basemaps**: Use standard public OpenStreetMap raster tiles with CSS dark monochrome inversion filter (`filter: grayscale(100%) invert(100%) contrast(140%) brightness(75%)`) on `.leaflet-tile-pane`. Never introduce tile layers that display watermarks or require API keys.
- **Chromatic High-Contrast Network Arcs**: Map polyline edges must be chromatic and never white:
  - Highway Freight Roads: Solid Amber (`#f59e0b`, 2.5px).
  - Maritime Sea Fairways: Dashed Light Blue (`#38bdf8`, 3.5px, dashArray `8, 8`).
  - Air Freight Corridors: Solid Purple (`#c084fc`, 2.5px).
  - Infeasible / Deficit Flow: Solid Red (`#ef4444`, 3.0px).

### 5.7 Normalized Substring Pair Matching
- Never check Python set membership on compound station names (e.g. `"Penang" in {"Penang Logistics Dep", "Ipoh Supermarket"}`).
- Always use normalized, case-insensitive substring token matching or spatial proximity lookups for corridor resolvers.

### 5.8 Complete Causal Traceability & Anti-Ambiguity Standard
- **STRICT PROHIBITION**: NEVER output an ambiguous aggregate metric or deficit summary (e.g. "Flow deficit of 15 units detected") without itemizing its complete causal chain.
- **The 4-Part Causal Attribution Invariant**: Every shortfall or bottleneck MUST explicitly disclose:
  1. **Specific Target Node**: Exact Store ID and Name (e.g. `Store S2 (Kuching Central Mall)`).
  2. **Specific Commodity**: Exact Product ID (e.g. `Product P1`).
  3. **Exact Mathematical Equation**: $\text{Requested} - \text{Delivered} = \text{Shortfall}$ (e.g. `50 requested - 35 delivered = 15 units shortfall`).
  4. **Underlying Constraint Violated**: Itemized stock depletion per warehouse (e.g. `KL Hub (W0): 30/30 used, Kuching Dep (W2): 15/15 used -> 45 units total supply exhausted`) or physical transport throughput cap saturated.

### 5.9 Radical Value-Density & Zero-Fluff UI Invariant
- **STRICT PROHIBITION**: NEVER introduce decorative, cosmetic, or vanity UI widgets that do not convey actionable, decision-critical logistics information.
- **Prohibited UI Artifacts**:
  - No decorative pseudo-terminal icons (e.g. `>_` boxes, generic logo placeholders).
  - No static version/build tags in primary views (e.g. `Engine v0.1`, `Build 102`).
  - No redundant connectivity pills (e.g. `[API: ONLINE]`) when the application is already functioning normally.
  - No filler metrics or non-actionable status cards.
- **Mandatory Signal Standard**: Every component must directly represent physical supply chain state: exact inventory numbers, retail shortfall quantities, fuel tank limits, highway route geometry, or circulation bottleneck tokens. If an element does not carry operational value, eliminate it.
