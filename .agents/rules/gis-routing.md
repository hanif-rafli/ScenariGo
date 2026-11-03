# GIS Transport Routing & Network Topology Rules for ScenariGo

## 1. Physical Layer Grounding
- All spatial edges in ScenariGo represent real physical transportation corridors:
  - Land: Major freight expressways (AH2 / E1, Federal Route 1 & 2, Pan-Borneo).
  - Maritime: International nautical fairways (Strait of Malacca TSS, Singapore Strait TSS, South China Sea).
- Direct straight chords cutting across mountain ranges or country borders are strictly forbidden.

## 2. Navigational Fairway Constraints
- **Deepwater Clearance**: Ships cannot navigate over land, shoals, or shallow headlands.
- **Tanjung Datu & Sambas Clearance**: Routes between Peninsular Malaysia and Kuching/East Malaysia must transit north of latitude 2.40N across longitude 108.8E to 110.2E before entering the Muara Tebas estuary channel at Tanjung Po (lat 1.75N, lon 110.50E).
- **Trunk-to-Port Snapping**: Follow the trunk shipping fairway until the outer pilot waypoint nearest the destination port, then connect via harbor approach channel.

## 3. Edge Matching Implementation
- Never check Python set membership on compound station names (e.g. `"Penang" in {"Penang Logistics Dep", "Ipoh Supermarket"}`).
- Use normalized, case-insensitive substring token matching or spatial proximity lookups.
