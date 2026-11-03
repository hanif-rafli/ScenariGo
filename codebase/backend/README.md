# ScenariGo - Backend API & Optimization Core

FastAPI backend service and discrete optimization engine.

## Subsystems
- `app/api/`: REST API endpoints (`/simulate`, `/feasibility`, `/nodes`)
- `app/core/`: Mathematical optimization algorithms (Ford-Fulkerson circulation with lower bounds, Multi-Source Dijkstra, topological reachability)
- `app/models/`: Pydantic data schemas (`Warehouse`, `Store`, `FleetConfig`, `SimulationResult`)
- `tests/`: Pytest test suite for optimization algorithms
