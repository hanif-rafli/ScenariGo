import Papa from 'papaparse';
import { Warehouse, Store } from '../types/simulation';

interface RawWarehouseRow {
  warehouse_id: string;
  name: string;
  latitude: string;
  longitude: string;
  is_port: string;
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

    if (!warehouseMap.has(wid)) {
      warehouseMap.set(wid, {
        warehouse_id: wid,
        name: row.name || `Warehouse ${wid}`,
        latitude: parseFloat(row.latitude) || 0,
        longitude: parseFloat(row.longitude) || 0,
        is_port: String(row.is_port).toLowerCase() === 'true',
        inventory: {},
      });
    }

    const wh = warehouseMap.get(wid)!;
    const pid = String(row.product_id).trim();
    const qty = parseInt(row.quantity, 10) || 0;
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

    if (!storeMap.has(sid)) {
      storeMap.set(sid, {
        store_id: sid,
        name: row.name || `Store ${sid}`,
        latitude: parseFloat(row.latitude) || 0,
        longitude: parseFloat(row.longitude) || 0,
        requests: {},
      });
    }

    const st = storeMap.get(sid)!;
    const pid = String(row.product_id).trim();
    const qty = parseInt(row.requested_qty, 10) || 0;
    st.requests[pid] = (st.requests[pid] || 0) + qty;
  }

  return Array.from(storeMap.values());
}
