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
- **PR Merging**:
  - NEVER automate pull request merges. PR merges are strictly reserved for manual human execution.

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
