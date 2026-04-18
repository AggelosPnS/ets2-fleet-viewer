/**
 * ETS2 SII Save File Parser
 *
 * Parses a decrypted `game.sii` text file and returns a structured object with
 * garages, trucks, drivers, trailers, and the player entity.
 *
 * The input is expected to be plain text starting with `SiiNunit`. If you have
 * an encrypted or binary SII file, run it through the decryptor first.
 */

const WANTED = new Set([
  'garage',
  'vehicle',
  'vehicle_accessory',
  'driver_ai',
  'trailer',
  'trailer_def',
  'player',
]);

const BRAND_PRETTY = {
  'daf.xd': 'DAF XD',
  'daf.xf': 'DAF XF (2017)',
  'daf.xf_euro6': 'DAF XF Euro 6',
  'iveco.hiway': 'Iveco Hi-Way',
  'iveco.stralis': 'Iveco Stralis',
  'man.tgx': 'MAN TGX (2020)',
  'man.tgx_euro6': 'MAN TGX Euro 6',
  'mercedes.actros': 'Mercedes Actros (Classic)',
  'mercedes.actros2014': 'Mercedes Actros MP4',
  'renault.premium': 'Renault Premium',
  'renault.t': 'Renault T',
  'scania.r_2016': 'Scania R (2016)',
  'scania.s_2016': 'Scania S (2016)',
  'scania.streamline': 'Scania Streamline',
  'volvo.fh16': 'Volvo FH16 (Classic)',
  'volvo.fh_2021': 'Volvo FH (2021)',
  'volvo.fh_2024': 'Volvo FH (2024)',
};

const TRAILER_PRETTY = {
  'scs.box': 'Box',
  'scs.chemtank': 'Chemical Tank',
  'scs.dumper': 'Dumper',
  'scs.flatbed': 'Flatbed',
  'scs.foodtank': 'Food Tank',
  'scs.fueltank': 'Fuel Tank',
  'scs.gastank': 'Gas Tank',
  'scs.gooseneck': 'Gooseneck (Lowboy)',
  'scs.livestock': 'Livestock',
  'scs.log': 'Log',
  'scs.lowloader': 'Lowloader',
  'scs.silo': 'Silo',
};

const GARAGE_STATUS = {
  0: 'Not owned',
  1: 'Rented',
  2: 'Small (3 slots)',
  3: 'Large (5 slots)',
};

const DRIVER_STATE = {
  0: 'Idle',
  1: 'On Duty',
  2: 'Loading/Delivering',
  3: 'Returning',
  4: 'Resting',
  5: 'Waiting',
};

const RE_BLOCK_HEADER = /^(\w+)\s*:\s*(\S+)\s*\{/;
const RE_FIELD = /^\s+([\w[\]]+):\s*(.*)$/;
const RE_ARRAY_INDEX = /^(\w+)\[(\d+)\]$/;
const RE_TRUCK = /\/def\/vehicle\/truck\/([^/]+)\//;
const RE_TRAILER_OWNED = /\/def\/vehicle\/trailer_owned\/([^/]+)\//;

function assign(obj, key, val) {
  const m = key.match(RE_ARRAY_INDEX);
  if (m) {
    const name = m[1];
    const idx = Number(m[2]);
    if (!Array.isArray(obj[name])) obj[name] = [];
    while (obj[name].length <= idx) obj[name].push(null);
    obj[name][idx] = val;
  } else {
    obj[key] = val;
  }
}

export function parseSii(text) {
  const entities = {};
  for (const k of WANTED) entities[k] = {};

  let currentType = null;
  let currentId = null;
  let current = null;

  // Split once — simple, O(n). We avoid reading the file into a line array
  // upfront when possible, but split is fine for ~20MB files.
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const h = line.match(RE_BLOCK_HEADER);
    if (h) {
      const t = h[1];
      if (WANTED.has(t)) {
        currentType = t;
        currentId = h[2];
        current = {};
      } else {
        currentType = null;
      }
      continue;
    }

    if (currentType === null) continue;

    if (line.startsWith('}')) {
      entities[currentType][currentId] = current;
      currentType = null;
      current = null;
      continue;
    }

    const f = line.match(RE_FIELD);
    if (f) {
      let v = f[2].trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      assign(current, f[1], v);
    }
  }

  return buildModel(entities);
}

// ---------- Helpers ------------------------------------------------------

function toInt(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function toFloat(v, def = 0) {
  if (v == null) return def;
  if (typeof v === 'string' && v.startsWith('&')) return def; // hex float
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

function cleanPlate(p) {
  if (!p) return '';
  let out = p.replace(/<[^>]+>/g, '');
  if (out.includes('|')) out = out.split('|')[0];
  return out.trim();
}

function plateCountry(p) {
  if (!p) return '';
  if (p.includes('|')) {
    return p.split('|').pop().trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const m = p.match(/\/lp\/([a-z_]+)\//);
  return m ? m[1].replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
}

function titleCase(s) {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function adrClasses(adrInt) {
  if (!adrInt) return '';
  const out = [];
  for (let i = 0; i < 6; i++) if (adrInt & (1 << i)) out.push(String(i + 1));
  return out.join(',');
}

function vehicleBrand(vehicle, accMap) {
  for (const accId of vehicle.accessories || []) {
    const acc = accMap[accId];
    if (!acc) continue;
    const m = (acc.data_path || '').match(RE_TRUCK);
    if (m) return m[1];
  }
  return '';
}

function trailerType(trailer, accMap) {
  for (const accId of trailer.accessories || []) {
    const acc = accMap[accId];
    if (!acc) continue;
    const m = (acc.data_path || '').match(RE_TRAILER_OWNED);
    if (m) return m[1];
  }
  return '';
}

// ---------- Model builder -------------------------------------------------

function buildModel(entities) {
  const accMap = entities.vehicle_accessory;

  // Player entity (singleton)
  const player = Object.values(entities.player)[0] || {};
  const playerTrucks = new Set((player.trucks || []).filter(Boolean));
  const playerTrailers = new Set((player.trailers || []).filter(Boolean));
  let myTruckId = (player.my_truck || '').trim();
  if (myTruckId === 'null') myTruckId = '';
  const hqCity = titleCase(player.hq_city || '');

  // Reverse indexes from garage side
  const vehicleToGarage = {};
  const driverToGarage = {};
  const trailerToGarage = {};
  for (const [gid, g] of Object.entries(entities.garage)) {
    const city = gid.includes('.') ? gid.split('.').slice(1).join('.') : gid;
    for (const vid of g.vehicles || []) if (vid) vehicleToGarage[vid] = city;
    for (const did of g.drivers || []) if (did) driverToGarage[did] = city;
    for (const tid of g.trailers || []) if (tid) trailerToGarage[tid] = city;
  }

  // Driver -> assigned truck/trailer (explicit from driver side; often null)
  const driverToTruck = {};
  const driverToTrailer = {};
  for (const [did, d] of Object.entries(entities.driver_ai)) {
    const tr = d.assigned_truck || d.adopted_truck;
    if (tr && tr !== 'null') driverToTruck[did] = tr;
    const tl = d.assigned_trailer || d.adopted_trailer;
    if (tl && tl !== 'null') driverToTrailer[did] = tl;
  }

  // Slot-based pairing from garage: vehicles[i] <-> drivers[i]
  for (const g of Object.values(entities.garage)) {
    const vs = Array.isArray(g.vehicles) ? g.vehicles : [];
    const ds = Array.isArray(g.drivers) ? g.drivers : [];
    const n = Math.min(vs.length, ds.length);
    for (let i = 0; i < n; i++) {
      const v = vs[i];
      const d = ds[i];
      if (v && d && !(d in driverToTruck)) driverToTruck[d] = v;
    }
  }

  const truckToDriver = {};
  for (const [did, vid] of Object.entries(driverToTruck)) truckToDriver[vid] = did;
  const trailerToDriver = {};
  for (const [did, tid] of Object.entries(driverToTrailer)) trailerToDriver[tid] = did;

  // ---------- Garages ----------
  const garages = [];
  for (const [gid, g] of Object.entries(entities.garage)) {
    const status = toInt(g.status, 0);
    const cityRaw = gid.includes('.') ? gid.split('.').slice(1).join('.') : gid;
    const city = titleCase(cityRaw);
    const vehicles = (Array.isArray(g.vehicles) ? g.vehicles : []).filter(Boolean);
    const drivers = (Array.isArray(g.drivers) ? g.drivers : []).filter(Boolean);
    const trailers = (Array.isArray(g.trailers) ? g.trailers : []).filter(Boolean);
    if (status === 0 && vehicles.length === 0 && drivers.length === 0) continue;
    garages.push({
      id: gid,
      city,
      cityRaw,
      status,
      statusLabel: GARAGE_STATUS[status] || `Unknown (${status})`,
      trucks: vehicles.length,
      drivers: drivers.length,
      trailers: trailers.length,
      productivity: toInt(g.productivity, 0),
      vehicleIds: vehicles,
      driverIds: drivers,
      trailerIds: trailers,
    });
  }
  garages.sort((a, b) => b.trucks - a.trucks || a.city.localeCompare(b.city));

  // ---------- Trucks ----------
  const trucks = [];
  for (const [vid, v] of Object.entries(entities.vehicle)) {
    if (!playerTrucks.has(vid)) continue;
    const brandRaw = vehicleBrand(v, accMap);
    if (!brandRaw) continue;
    const garageCityRaw = vehicleToGarage[vid] || '';
    const garageCity = titleCase(garageCityRaw);
    const driverId = truckToDriver[vid] || '';
    let driverHome = '';
    let driverXP = null;
    if (driverId) {
      const dd = entities.driver_ai[driverId] || {};
      driverHome = titleCase(dd.hometown || '');
      driverXP = toInt(dd.experience_points, 0) || null;
    }
    const isPersonal = vid === myTruckId;
    trucks.push({
      id: vid,
      brand: BRAND_PRETTY[brandRaw] || brandRaw,
      brandRaw,
      plate: cleanPlate(v.license_plate),
      country: plateCountry(v.license_plate),
      odometer: toInt(v.odometer, 0),
      integrityOdometer: toInt(v.integrity_odometer, 0),
      engineWear: Math.round(toFloat(v.engine_wear) * 1000) / 10,
      transmissionWear: Math.round(toFloat(v.transmission_wear) * 1000) / 10,
      cabinWear: Math.round(toFloat(v.cabin_wear) * 1000) / 10,
      chassisWear: Math.round(toFloat(v.chassis_wear) * 1000) / 10,
      assignment: isPersonal ? 'Personal (you)' : (garageCity || '(unassigned)'),
      garageCity,
      garageCityRaw,
      driverId,
      driverHome,
      driverXP,
      isPersonal,
    });
  }
  trucks.sort((a, b) => {
    if (a.isPersonal !== b.isPersonal) return a.isPersonal ? -1 : 1;
    return a.assignment.localeCompare(b.assignment) || a.brand.localeCompare(b.brand);
  });

  // ---------- Drivers ----------
  const drivers = [];
  for (const [did, d] of Object.entries(entities.driver_ai)) {
    const trId = driverToTruck[did] || '';
    const tlId = driverToTrailer[did] || '';
    let truckBrand = '';
    let truckPlate = '';
    if (trId) {
      const tv = entities.vehicle[trId] || {};
      const br = vehicleBrand(tv, accMap);
      truckBrand = BRAND_PRETTY[br] || br;
      truckPlate = cleanPlate(tv.license_plate);
    }
    let trailerTypeLabel = '';
    if (tlId) {
      const tlv = entities.trailer[tlId] || {};
      const tt = trailerType(tlv, accMap);
      trailerTypeLabel = TRAILER_PRETTY[tt] || tt;
    }
    const garageCityRaw = driverToGarage[did] || '';
    const garageCity = titleCase(garageCityRaw);
    const state = toInt(d.state, 0);
    const employed = !!garageCity;
    drivers.push({
      id: did,
      employed,
      hometown: titleCase(d.hometown || ''),
      currentCity: titleCase(d.current_city || ''),
      garageCity: garageCity || '—',
      garageCityRaw,
      state: employed ? (DRIVER_STATE[state] || `Unknown (${state})`) : '—',
      xp: toInt(d.experience_points, 0),
      longDist: toInt(d.long_dist, 0),
      heavy: toInt(d.heavy, 0),
      fragile: toInt(d.fragile, 0),
      urgent: toInt(d.urgent, 0),
      mechanical: toInt(d.mechanical, 0),
      adr: adrClasses(toInt(d.adr, 0)),
      truck: truckBrand,
      truckPlate,
      trailer: trailerTypeLabel,
    });
  }
  drivers.sort((a, b) => {
    if (a.employed !== b.employed) return a.employed ? -1 : 1;
    return a.garageCity.localeCompare(b.garageCity) || b.xp - a.xp || a.id.localeCompare(b.id);
  });

  // ---------- Trailers ----------
  const trailers = [];
  for (const [tid, t] of Object.entries(entities.trailer)) {
    if (!playerTrailers.has(tid)) continue;
    const typeRaw = trailerType(t, accMap);
    if (!typeRaw) continue;
    const garageCityRaw = trailerToGarage[tid] || '';
    const garageCity = titleCase(garageCityRaw);
    const driverId = trailerToDriver[tid] || '';
    trailers.push({
      id: tid,
      type: TRAILER_PRETTY[typeRaw] || typeRaw,
      typeRaw,
      plate: cleanPlate(t.license_plate),
      country: plateCountry(t.license_plate),
      odometer: toInt(t.odometer, 0),
      garageCity: garageCity || '(unassigned / in pool)',
      garageCityRaw,
      driverId,
      cargoMass: toInt(t.cargo_mass, 0),
    });
  }
  trailers.sort((a, b) => a.garageCity.localeCompare(b.garageCity) || a.type.localeCompare(b.type));

  // ---------- Summary ----------
  const employedDrivers = drivers.filter((d) => d.employed);
  const ownedGarages = garages.filter((g) => g.status > 0);
  const summary = {
    hqCity: hqCity || '—',
    ownedGarages: ownedGarages.length,
    smallGarages: ownedGarages.filter((g) => g.status === 2).length,
    largeGarages: ownedGarages.filter((g) => g.status === 3).length,
    trucks: trucks.length,
    personalTruck: trucks.filter((t) => t.isPersonal).length,
    fleetTrucks: trucks.filter((t) => !t.isPersonal).length,
    employedDrivers: employedDrivers.length,
    candidateDrivers: drivers.length - employedDrivers.length,
    trailers: trailers.length,
    totalTruckKm: trucks.reduce((s, t) => s + t.odometer, 0),
    totalTrailerKm: trailers.reduce((s, t) => s + t.odometer, 0),
    avgEmployedXP: employedDrivers.length
      ? Math.round(employedDrivers.reduce((s, d) => s + d.xp, 0) / employedDrivers.length)
      : 0,
  };

  // Brand & trailer type breakdowns
  const brandBreakdown = {};
  for (const t of trucks) brandBreakdown[t.brand] = (brandBreakdown[t.brand] || 0) + 1;
  const trailerBreakdown = {};
  for (const t of trailers) trailerBreakdown[t.type] = (trailerBreakdown[t.type] || 0) + 1;

  return {
    summary,
    garages,
    trucks,
    drivers,
    trailers,
    brandBreakdown,
    trailerBreakdown,
  };
}
