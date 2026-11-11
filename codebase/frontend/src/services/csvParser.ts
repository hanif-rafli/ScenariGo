import Papa from 'papaparse';
import { Warehouse, Store } from '../types/simulation';

interface RawWarehouseRow {
  warehouse_id: string;
  name: string;
  latitude: string;
  longitude: string;
  is_port: string;
  is_airport?: string;
  product_id: string;
  quantity: string;
}

interface RawStoreRow {
  store_id: string;
  name: string;
  latitude: string;
  longitude: string;
  product_id: string;
  requested_qty: string;
}

export function parseWarehousesCSV(csvString: string): Warehouse[] {
  const parsed = Papa.parse<RawWarehouseRow>(csvString.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  const warehouseMap = new Map<number, Warehouse>();

  for (const row of parsed.data) {
    const wid = parseInt(row.warehouse_id, 10);
    if (isNaN(wid)) continue;

    const lat = parseFloat(row.latitude);
    const lon = parseFloat(row.longitude);

    if (isNaN(lat) || isNaN(lon) || lat < 0.5 || lat > 8.5 || lon < 99.0 || lon > 120.0) {
      throw new Error(
        `[FAIL: INVALID_COORDINATES] Warehouse '${row.name || wid}' has invalid coordinates (${row.latitude}, ${row.longitude}). Expected latitude in [0.5, 8.5] and longitude in [99.0, 120.0].`
      );
    }

    if (!warehouseMap.has(wid)) {
      warehouseMap.set(wid, {
        warehouse_id: wid,
        name: row.name || `Warehouse ${wid}`,
        latitude: lat,
        longitude: lon,
        is_port: String(row.is_port).toLowerCase() === 'true',
        is_airport: row.is_airport !== undefined ? String(row.is_airport).toLowerCase() === 'true' : false,
        inventory: {},
      });
    }

    const wh = warehouseMap.get(wid)!;
    const pid = String(row.product_id).trim();
    const qty = parseInt(row.quantity, 10);
    if (isNaN(qty) || qty < 0) {
      throw new Error(
        `[FAIL: NEGATIVE_QUANTITY] Warehouse '${wh.name}' has invalid or negative quantity (${row.quantity}) for product '${pid}'.`
      );
    }
    wh.inventory[pid] = (wh.inventory[pid] || 0) + qty;
  }

  return Array.from(warehouseMap.values());
}

export function parseStoresCSV(csvString: string): Store[] {
  const parsed = Papa.parse<RawStoreRow>(csvString.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  const storeMap = new Map<number, Store>();

  for (const row of parsed.data) {
    const sid = parseInt(row.store_id, 10);
    if (isNaN(sid)) continue;

    const lat = parseFloat(row.latitude);
    const lon = parseFloat(row.longitude);

    if (isNaN(lat) || isNaN(lon) || lat < 0.5 || lat > 8.5 || lon < 99.0 || lon > 120.0) {
      throw new Error(
        `[FAIL: INVALID_COORDINATES] Store '${row.name || sid}' has invalid coordinates (${row.latitude}, ${row.longitude}). Expected latitude in [0.5, 8.5] and longitude in [99.0, 120.0].`
      );
    }

    if (!storeMap.has(sid)) {
      storeMap.set(sid, {
        store_id: sid,
        name: row.name || `Store ${sid}`,
        latitude: lat,
        longitude: lon,
        requests: {},
      });
    }

    const st = storeMap.get(sid)!;
    const pid = String(row.product_id).trim();
    const qty = parseInt(row.requested_qty, 10);
    if (isNaN(qty) || qty < 0) {
      throw new Error(
        `[FAIL: NEGATIVE_QUANTITY] Store '${st.name}' has invalid or negative requested quantity (${row.requested_qty}) for product '${pid}'.`
      );
    }
    st.requests[pid] = (st.requests[pid] || 0) + qty;
  }

  return Array.from(storeMap.values());
}
