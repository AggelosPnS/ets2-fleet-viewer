/**
 * Excel export using SheetJS (xlsx).
 *
 * Loaded from CDN so no npm install is needed. Produces a 5-sheet workbook
 * matching the layout of the original Python export: Overview, Garages,
 * Trucks, Drivers, Trailers.
 */

const SHEETJS_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';

let xlsxPromise = null;

function loadXlsx() {
  if (!xlsxPromise) xlsxPromise = import(SHEETJS_URL);
  return xlsxPromise;
}

function autoWidth(rows, headers) {
  return headers.map((h) => {
    let max = h.length;
    for (const r of rows) {
      const v = r[h];
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = len;
    }
    return { wch: Math.min(max + 2, 40) };
  });
}

export async function exportToExcel(model, filename = 'ets2-fleet.xlsx') {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();

  // --- Overview ---
  const overviewRows = [
    { Metric: 'HQ City', Value: model.summary.hqCity },
    { Metric: 'Owned Garages', Value: model.summary.ownedGarages },
    { Metric: '  — Small (3 slots)', Value: model.summary.smallGarages },
    { Metric: '  — Large (5 slots)', Value: model.summary.largeGarages },
    { Metric: 'Trucks (owned)', Value: model.summary.trucks },
    { Metric: '  — Your personal truck', Value: model.summary.personalTruck },
    { Metric: '  — Fleet (driven by hired)', Value: model.summary.fleetTrucks },
    { Metric: 'Drivers — Employed', Value: model.summary.employedDrivers },
    { Metric: 'Drivers — Available (candidates)', Value: model.summary.candidateDrivers },
    { Metric: 'Trailers (owned)', Value: model.summary.trailers },
    { Metric: 'Total odometer — trucks (km)', Value: model.summary.totalTruckKm },
    { Metric: 'Total odometer — trailers (km)', Value: model.summary.totalTrailerKm },
    { Metric: 'Avg XP — employed drivers', Value: model.summary.avgEmployedXP },
    {},
    { Metric: 'Trucks by brand:', Value: '' },
    ...Object.entries(model.brandBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ Metric: '  ' + k, Value: v })),
    {},
    { Metric: 'Trailers by type:', Value: '' },
    ...Object.entries(model.trailerBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ Metric: '  ' + k, Value: v })),
  ];
  const overviewSheet = XLSX.utils.json_to_sheet(overviewRows, { header: ['Metric', 'Value'] });
  overviewSheet['!cols'] = [{ wch: 36 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, overviewSheet, 'Overview');

  // --- Garages ---
  const gHeaders = ['City', 'Status', 'Trucks', 'Drivers', 'Trailers', 'Productivity', 'Garage ID'];
  const gRows = model.garages.map((g) => ({
    City: g.city,
    Status: g.statusLabel,
    Trucks: g.trucks,
    Drivers: g.drivers,
    Trailers: g.trailers,
    Productivity: g.productivity,
    'Garage ID': g.id,
  }));
  const gSheet = XLSX.utils.json_to_sheet(gRows, { header: gHeaders });
  gSheet['!cols'] = autoWidth(gRows, gHeaders);
  gSheet['!autofilter'] = { ref: `A1:${String.fromCharCode(64 + gHeaders.length)}${gRows.length + 1}` };
  XLSX.utils.book_append_sheet(wb, gSheet, 'Garages');

  // --- Trucks ---
  const tHeaders = [
    'Brand/Model', 'License Plate', 'Country', 'Odometer (km)', 'Integrity Odo (km)',
    'Engine Wear %', 'Transmission Wear %', 'Cabin Wear %', 'Chassis Wear %',
    'Assignment', 'Driver ID', 'Driver Hometown', 'Driver XP', 'Truck Internal ID',
  ];
  const tRows = model.trucks.map((t) => ({
    'Brand/Model': t.brand,
    'License Plate': t.plate,
    Country: t.country,
    'Odometer (km)': t.odometer,
    'Integrity Odo (km)': t.integrityOdometer,
    'Engine Wear %': t.engineWear,
    'Transmission Wear %': t.transmissionWear,
    'Cabin Wear %': t.cabinWear,
    'Chassis Wear %': t.chassisWear,
    Assignment: t.assignment,
    'Driver ID': t.driverId,
    'Driver Hometown': t.driverHome,
    'Driver XP': t.driverXP,
    'Truck Internal ID': t.id,
  }));
  const tSheet = XLSX.utils.json_to_sheet(tRows, { header: tHeaders });
  tSheet['!cols'] = autoWidth(tRows, tHeaders);
  tSheet['!autofilter'] = { ref: `A1:${colLetter(tHeaders.length)}${tRows.length + 1}` };
  XLSX.utils.book_append_sheet(wb, tSheet, 'Trucks');

  // --- Drivers (employed only — candidates are the recruitment pool, not your company) ---
  const dHeaders = [
    'Driver ID', 'Hometown', 'Current City', 'Garage (City)', 'State',
    'XP', 'Long Distance', 'Heavy', 'Fragile', 'Urgent', 'Mechanical',
    'ADR Classes', 'Truck', 'Truck Plate', 'Trailer',
  ];
  const dRows = model.drivers.filter((d) => d.employed).map((d) => ({
    'Driver ID': d.id,
    Hometown: d.hometown,
    'Current City': d.currentCity,
    'Garage (City)': d.garageCity,
    State: d.state,
    XP: d.xp,
    'Long Distance': d.longDist,
    Heavy: d.heavy,
    Fragile: d.fragile,
    Urgent: d.urgent,
    Mechanical: d.mechanical,
    'ADR Classes': d.adr,
    Truck: d.truck,
    'Truck Plate': d.truckPlate,
    Trailer: d.trailer,
  }));
  const dSheet = XLSX.utils.json_to_sheet(dRows, { header: dHeaders });
  dSheet['!cols'] = autoWidth(dRows, dHeaders);
  dSheet['!autofilter'] = { ref: `A1:${colLetter(dHeaders.length)}${dRows.length + 1}` };
  XLSX.utils.book_append_sheet(wb, dSheet, 'Drivers');

  // --- Trailers ---
  const trHeaders = ['Type', 'License Plate', 'Country', 'Odometer (km)', 'Garage (City)', 'Assigned Driver', 'Cargo Mass', 'Trailer Internal ID'];
  const trRows = model.trailers.map((t) => ({
    Type: t.type,
    'License Plate': t.plate,
    Country: t.country,
    'Odometer (km)': t.odometer,
    'Garage (City)': t.garageCity,
    'Assigned Driver': t.driverId,
    'Cargo Mass': t.cargoMass,
    'Trailer Internal ID': t.id,
  }));
  const trSheet = XLSX.utils.json_to_sheet(trRows, { header: trHeaders });
  trSheet['!cols'] = autoWidth(trRows, trHeaders);
  trSheet['!autofilter'] = { ref: `A1:${colLetter(trHeaders.length)}${trRows.length + 1}` };
  XLSX.utils.book_append_sheet(wb, trSheet, 'Trailers');

  XLSX.writeFile(wb, filename);
}

function colLetter(n) {
  // 1-based index to Excel column letter (A=1). Supports up to ZZ.
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
