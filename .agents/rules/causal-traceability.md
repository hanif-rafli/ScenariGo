# Causal Traceability & Anti-Ambiguity Rules for ScenariGo

## 1. The Zero-Ambiguity Invariant
Whenever an algorithmic stage (Stage 1, 2, 3, or 4) fails, halts, or encounters a bottleneck, the engine and UI must pinpoint:
1. Exactly **WHO** is affected (Store Name, Store ID, Location).
2. Exactly **WHAT** commodity is short (Product ID).
3. Exactly **HOW MUCH** is missing (Requested - Supplied = Deficit).
4. Exactly **WHY** it failed (Causal trace: which warehouses supplied what, which warehouses ran out of stock, or which transport corridor hit capacity).

## 2. Structured Bottleneck Schema
All network flow and routing results must structure bottlenecks via `BottleneckDetail`:
- `store_id`, `store_name`
- `product_id`
- `requested_units`, `allocated_units`, `shortfall_units`
- `bottleneck_type` (`SUPPLY_EXHAUSTION`, `CORRIDOR_SATURATION`, `UNREACHABLE_ISLAND`)
- `root_cause` description
- `contributing_warehouses` depletion list (e.g. `['KL Hub: 30/30 used', 'Kuching Dep: 15/15 used']`)

## 3. UI Presentation Standard
- When a flow deficit or bottleneck occurs, render an explicit **Root Cause & Bottleneck Traceability Panel** displaying the mathematical equation and contributing warehouse depletion list.
- In the dispatches table, display unfulfilled demand items with status `SHORTFALL` so the missing volume is immediately visible.
