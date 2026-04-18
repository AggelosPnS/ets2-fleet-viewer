/**
 * ETS2 Fleet Viewer — main app logic.
 *
 * Wires the file upload, parsing, and all UI components (stats, map, tables).
 */
import { parseSii } from './parser.js';
import { loadSaveFile, NeedsDecryptionError } from './decrypt.js';
import { cityCoords } from './cities.js';
import { exportToExcel } from './export.js';

// ---------- State ----------
let currentModel = null;

// ---------- DOM refs ----------
const $ = (id) => document.getElementById(id);
const landingEl = $('landing');
const loadingEl = $('loading');
const dashboardEl = $('dashboard');
const errorBoxEl = $('errorBox');
const fileInput = $('fileInput');
const uploadZone = $('uploadZone');
const loadAnotherBtn = $('loadAnotherBtn');
const exportExcelBtn = $('exportExcelBtn');

// ---------- File handling ----------

function showSection(name) {
  landingEl.style.display = name === 'landing' ? '' : 'none';
  loadingEl.style.display = name === 'loading' ? '' : 'none';
  dashboardEl.classList.toggle('active', name === 'dashboard');
}

function showError(msg, asHtml = false) {
  if (asHtml) errorBoxEl.innerHTML = msg;
  else errorBoxEl.textContent = msg;
  errorBoxEl.style.display = '';
}
function clearError() {
  errorBoxEl.style.display = 'none';
  errorBoxEl.textContent = '';
}

async function handleFile(file) {
  if (!file) return;
  clearError();
  showSection('loading');
  $('loadingStatus').textContent = 'Reading file...';

  try {
    $('loadingStatus').textContent = 'Decrypting / loading...';
    const { text, format } = await loadSaveFile(file);

    $('loadingStatus').textContent = 'Parsing save data...';
    // Yield to UI so the status updates paint before heavy parsing.
    await new Promise((r) => setTimeout(r, 10));

    const model = parseSii(text);
    if (!model.summary.trucks && !model.summary.ownedGarages) {
      throw new Error(
        'No company data found in this save. Make sure you uploaded game.sii from an active campaign save, not the intro/tutorial.'
      );
    }

    currentModel = model;
    renderDashboard(model, format);
    showSection('dashboard');
  } catch (err) {
    console.error(err);
    showSection('landing');
    if (err instanceof NeedsDecryptionError) {
      showError(
        `<strong>This save is ${err.format === 'encrypted' ? 'encrypted' : 'in binary format'}.</strong> ` +
          'To view it here, first decode it:' +
          '<ol style="margin: 10px 0 4px 20px; line-height: 1.7;">' +
          '<li>Go to <a href="https://sii-decode.github.io/" target="_blank" rel="noopener">sii-decode.github.io</a> (opens in a new tab — your file stays in your browser)</li>' +
          '<li>Drop your <code>game.sii</code> there and download the decoded version</li>' +
          '<li>Come back here and upload the decoded file</li>' +
          '</ol>' +
          '<p style="margin: 10px 0 0 0; font-size: 12px; color: var(--text-dim)">' +
          'Alternative: set <code>uset g_save_format "2"</code> in your <code>config.cfg</code>, reload & save in-game, ' +
          'and future saves will be plain text — no decoding needed.' +
          '</p>',
        true
      );
    } else {
      showError(err.message || String(err));
    }
  }
}

// Drag & drop
['dragenter', 'dragover'].forEach((ev) =>
  uploadZone.addEventListener(ev, (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  })
);
['dragleave', 'drop'].forEach((ev) =>
  uploadZone.addEventListener(ev, (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
  })
);
uploadZone.addEventListener('drop', (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (f) handleFile(f);
});

fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) handleFile(f);
});

loadAnotherBtn.addEventListener('click', () => {
  currentModel = null;
  fileInput.value = '';
  clearError();
  showSection('landing');
});

exportExcelBtn.addEventListener('click', async () => {
  if (!currentModel) return;
  exportExcelBtn.disabled = true;
  exportExcelBtn.textContent = 'Generating...';
  try {
    await exportToExcel(currentModel, 'ets2-fleet.xlsx');
  } catch (err) {
    showError('Excel export failed: ' + err.message);
  } finally {
    exportExcelBtn.disabled = false;
    exportExcelBtn.innerHTML = '📥 Download Excel';
  }
});

// ---------- Render dashboard ----------

function fmt(n) { return Number(n).toLocaleString('en-US'); }

function renderDashboard(model, format) {
  // HQ banner
  $('hqCity').textContent = model.summary.hqCity;
  $('hqSub').textContent = `${model.summary.ownedGarages} garages · ${model.summary.trucks} trucks · ${model.summary.employedDrivers} drivers on payroll`;

  // Stat cards
  $('statGarages').textContent = fmt(model.summary.ownedGarages);
  $('statGaragesSub').textContent = `${model.summary.smallGarages} small, ${model.summary.largeGarages} large`;
  $('statTrucks').textContent = fmt(model.summary.trucks);
  $('statTrucksSub').textContent = `${model.summary.personalTruck} personal + ${model.summary.fleetTrucks} fleet`;
  $('statDrivers').textContent = fmt(model.summary.employedDrivers);
  $('statDriversSub').textContent = `${fmt(model.summary.candidateDrivers)} candidates available`;
  $('statTrailers').textContent = fmt(model.summary.trailers);
  $('statTrailersSub').textContent = 'owned trailers';
  $('statKm').textContent = fmt(model.summary.totalTruckKm);
  $('statKmSub').textContent = 'total truck odometer';
  $('statXp').textContent = fmt(model.summary.avgEmployedXP);
  $('statXpSub').textContent = 'avg XP (employed)';

  renderMap(model);
  renderTables(model);
}

// ---------- Map (Leaflet) ----------

let mapInstance = null;
let markerLayer = null;

function renderMap(model) {
  if (!mapInstance) {
    mapInstance = L.map('map', {
      center: [50, 15],
      zoom: 5,
      minZoom: 3,
      maxZoom: 10,
      zoomControl: true,
      worldCopyJump: false,
      maxBounds: [[30, -30], [72, 50]],
      maxBoundsViscosity: 1.0,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(mapInstance);
  }

  if (markerLayer) markerLayer.remove();
  markerLayer = L.layerGroup().addTo(mapInstance);

  const hqKey = (model.summary.hqCity || '').toLowerCase().replace(/\s+/g, '_');
  const bounds = [];
  const missing = [];
  let hqCoords = null;

  for (const g of model.garages) {
    if (g.status === 0) continue;
    const coords = cityCoords(g.cityRaw);
    if (!coords) { missing.push(g.cityRaw); continue; }

    const isHq = g.cityRaw.toLowerCase() === hqKey;
    if (isHq) hqCoords = coords;

    const icon = L.divIcon({
      className: 'garage-marker' + (isHq ? ' hq' : ''),
      html: String(g.trucks),
      iconSize: [28, 28],
    });

    const topDriver = (model.drivers
      .filter((d) => d.employed && d.garageCityRaw === g.cityRaw)
      .sort((a, b) => b.xp - a.xp)[0]) || null;

    const popup = `
      <h4>${g.city}${isHq ? ' 🏠 (HQ)' : ''}</h4>
      <div class="popup-row"><span>Size</span><span>${g.statusLabel}</span></div>
      <div class="popup-row"><span>Trucks</span><span>${g.trucks}</span></div>
      <div class="popup-row"><span>Drivers</span><span>${g.drivers}</span></div>
      <div class="popup-row"><span>Trailers</span><span>${g.trailers}</span></div>
      ${topDriver ? `<div class="popup-row"><span>Top driver</span><span>${topDriver.id} (${fmt(topDriver.xp)} XP)</span></div>` : ''}
    `;

    L.marker([coords.lat, coords.lng], { icon })
      .bindPopup(popup)
      .addTo(markerLayer);
    bounds.push([coords.lat, coords.lng]);
  }

  // Prefer centering on HQ — shows the surrounding area with good zoom.
  if (hqCoords) {
    mapInstance.setView([hqCoords.lat, hqCoords.lng], 5);
  } else if (bounds.length) {
    mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
  }

  // When the dashboard section just became visible, Leaflet may have measured
  // the container before layout finished. Force a resize recalc on the next
  // frame so all tiles render correctly on the first view.
  setTimeout(() => mapInstance.invalidateSize(), 0);
  setTimeout(() => mapInstance.invalidateSize(), 150);

  if (missing.length) {
    console.warn('Cities without coordinates (add to cities.js):', [...new Set(missing)]);
  }
}

// ---------- Tables ----------

function renderTables(model) {
  renderTrucksTable(model.trucks);
  renderDriversTable(model.drivers);
  renderTrailersTable(model.trailers);
  renderGaragesTable(model.garages);
}

function makeSortable(thead, tbody, data, render) {
  let sortKey = null;
  let sortDir = 1; // 1 = asc, -1 = desc
  thead.querySelectorAll('th[data-key]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (sortKey === key) sortDir = -sortDir;
      else { sortKey = key; sortDir = 1; }
      const sorted = [...data].sort((a, b) => {
        const av = a[key] ?? '';
        const bv = b[key] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
        return String(av).localeCompare(String(bv)) * sortDir;
      });
      thead.querySelectorAll('th').forEach((h) => h.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add(sortDir > 0 ? 'sorted-asc' : 'sorted-desc');
      render(sorted);
    });
  });
}

function wireSearch(input, data, render, fields) {
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q) return render(data);
    const filtered = data.filter((row) =>
      fields.some((f) => String(row[f] ?? '').toLowerCase().includes(q))
    );
    render(filtered);
    const count = input.closest('.table-toolbar').querySelector('.count');
    if (count) count.textContent = `${filtered.length} / ${data.length}`;
  });
}

// ---- Trucks ----
function renderTrucksTable(trucks) {
  const tbody = $('trucksTbody');
  const countEl = $('trucksCount');
  const render = (rows) => {
    countEl.textContent = `${rows.length} / ${trucks.length}`;
    tbody.innerHTML = rows.map((t) => `
      <tr class="${t.isPersonal ? 'personal-row' : ''}">
        <td>${t.isPersonal ? '<span class="tag tag-personal">YOU</span> ' : ''}${escapeHtml(t.brand)}</td>
        <td>${escapeHtml(t.plate)}</td>
        <td>${escapeHtml(t.country)}</td>
        <td class="num">${fmt(t.odometer)}</td>
        <td class="num">${t.engineWear.toFixed(1)}%</td>
        <td class="num">${t.chassisWear.toFixed(1)}%</td>
        <td>${escapeHtml(t.assignment)}</td>
        <td>${escapeHtml(t.driverId || '')}</td>
        <td class="num">${t.driverXP != null ? fmt(t.driverXP) : ''}</td>
      </tr>
    `).join('');
  };
  render(trucks);
  makeSortable($('trucksThead'), tbody, trucks, render);
  wireSearch($('trucksSearch'), trucks, render, ['brand', 'plate', 'country', 'assignment', 'driverId']);
}

// ---- Drivers (employed only — candidates are noise) ----
function renderDriversTable(drivers) {
  const employed = drivers.filter((d) => d.employed);
  const tbody = $('driversTbody');
  const countEl = $('driversCount');
  const skillBar = (n) => `<span class="skill-bar"><span class="fill" style="width:${(n / 6) * 100}%"></span></span>${n}`;
  const render = (rows) => {
    countEl.textContent = `${rows.length} / ${employed.length}`;
    tbody.innerHTML = rows.map((d) => `
      <tr>
        <td>${escapeHtml(d.id)}</td>
        <td>${escapeHtml(d.hometown)}</td>
        <td>${escapeHtml(d.garageCity)}</td>
        <td>${escapeHtml(d.state)}</td>
        <td class="num">${fmt(d.xp)}</td>
        <td>${skillBar(d.longDist)}</td>
        <td>${skillBar(d.heavy)}</td>
        <td>${skillBar(d.fragile)}</td>
        <td>${skillBar(d.urgent)}</td>
        <td>${skillBar(d.mechanical)}</td>
        <td>${escapeHtml(d.adr)}</td>
        <td>${escapeHtml(d.truck)}</td>
      </tr>
    `).join('');
  };
  render(employed);
  makeSortable($('driversThead'), tbody, employed, render);
  wireSearch($('driversSearch'), employed, render, ['id', 'hometown', 'garageCity', 'truck']);
}

// ---- Trailers ----
function renderTrailersTable(trailers) {
  const tbody = $('trailersTbody');
  const countEl = $('trailersCount');
  const render = (rows) => {
    countEl.textContent = `${rows.length} / ${trailers.length}`;
    tbody.innerHTML = rows.map((t) => `
      <tr>
        <td>${escapeHtml(t.type)}</td>
        <td>${escapeHtml(t.plate)}</td>
        <td>${escapeHtml(t.country)}</td>
        <td class="num">${fmt(t.odometer)}</td>
        <td>${escapeHtml(t.garageCity)}</td>
        <td>${escapeHtml(t.driverId)}</td>
      </tr>
    `).join('');
  };
  render(trailers);
  makeSortable($('trailersThead'), tbody, trailers, render);
  wireSearch($('trailersSearch'), trailers, render, ['type', 'plate', 'country', 'garageCity']);
}

// ---- Garages ----
function renderGaragesTable(garages) {
  const tbody = $('garagesTbody');
  const countEl = $('garagesCount');
  const owned = garages.filter((g) => g.status > 0);
  const render = (rows) => {
    countEl.textContent = `${rows.length} / ${owned.length}`;
    tbody.innerHTML = rows.map((g) => `
      <tr>
        <td>${escapeHtml(g.city)}</td>
        <td>${escapeHtml(g.statusLabel)}</td>
        <td class="num">${g.trucks}</td>
        <td class="num">${g.drivers}</td>
        <td class="num">${g.trailers}</td>
        <td class="num">${g.productivity}</td>
      </tr>
    `).join('');
  };
  render(owned);
  makeSortable($('garagesThead'), tbody, owned, render);
  wireSearch($('garagesSearch'), owned, render, ['city', 'statusLabel']);
}

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(target).classList.add('active');
    // Leaflet needs a size recalculation when the map tab becomes visible.
    if (mapInstance && target === 'tabMap') setTimeout(() => mapInstance.invalidateSize(), 10);
  });
});

// ---------- Utils ----------
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Initialize
showSection('landing');
