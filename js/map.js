// ==========================================================================
// PathPulse AI - Interactive Safety Map Controller (js/map.js)
// Leaflet.js with Dark Mode, Supabase Reports Sync, Multi-Filter, and Safe Route
// ==========================================================================

let mapInstance = null;
let markersLayerGroup = null;
let routeShortestLayer = null;
let routeSaferLayer = null;
let currentFilter = 'All';
let routeVisible = true;
let allMapReports = [];
let markerRegistry = new Map(); // id -> L.marker

// ==========================================================================
// 1. HELPERS & DATA FORMATTERS
// ==========================================================================

// Safe HTML sanitizer
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Category slug to human-readable label
function formatCategoryLabel(catKey) {
  const map = {
    'broken_footpath': 'Broken Footpath',
    'pothole': 'Pothole',
    'open_manhole': 'Open Manhole',
    'waterlogging': 'Waterlogging',
    'garbage': 'Garbage Blocking Path',
    'blocked_footpath': 'Blocked Footpath',
    'damaged_ramp': 'Damaged Wheelchair Ramp',
    'fallen_object': 'Fallen Object',
    'other': 'Pedestrian Hazard'
  };
  return map[catKey] || (catKey ? catKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Pedestrian Hazard');
}

// Severity meta formatting
function formatSeverityMeta(sev) {
  const s = (sev || 'low').toLowerCase();
  switch (s) {
    case 'critical':
      return { label: 'Critical', cssClass: 'marker-bg-critical', badgeClass: 'badge-danger', icon: 'fa-skull-crossbones', color: '#EF4444' };
    case 'high':
      return { label: 'High', cssClass: 'marker-bg-high', badgeClass: 'badge-warning', icon: 'fa-triangle-exclamation', color: '#F59E0B' };
    case 'medium':
    case 'moderate':
      return { label: 'Medium', cssClass: 'marker-bg-medium', badgeClass: 'badge-info', icon: 'fa-circle-exclamation', color: '#06B6D4' };
    case 'low':
    default:
      return { label: 'Low', cssClass: 'marker-bg-low', badgeClass: 'badge-success', icon: 'fa-info', color: '#3B82F6' };
  }
}

// Status meta formatting
function formatStatusMeta(status) {
  const s = (status || 'reported').toLowerCase().replace(/\s+/g, '_');
  switch (s) {
    case 'reported':
      return { label: 'Reported', badgeClass: 'badge-status-reported', icon: 'fa-paper-plane' };
    case 'under_review':
      return { label: 'Under Review', badgeClass: 'badge-warning', icon: 'fa-clock' };
    case 'verified':
      return { label: 'Verified', badgeClass: 'badge-status-verified', icon: 'fa-circle-check' };
    case 'assigned':
      return { label: 'Assigned', badgeClass: 'badge-status-inprogress', icon: 'fa-clipboard-user' };
    case 'in_progress':
      return { label: 'In Progress', badgeClass: 'badge-status-inprogress', icon: 'fa-person-digging' };
    case 'resolved':
      return { label: 'Resolved', badgeClass: 'badge-status-resolved', icon: 'fa-circle-check' };
    case 'rejected':
      return { label: 'Rejected', badgeClass: 'badge-danger', icon: 'fa-circle-xmark' };
    default:
      return { label: status || 'Reported', badgeClass: 'badge-status-reported', icon: 'fa-paper-plane' };
  }
}

// Format readable date
function formatDisplayDate(dateStr) {
  if (!dateStr) return 'Recent';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

// ==========================================================================
// 2. REALISTIC SEED / ANCHOR HAZARD DATA
// Preserves city clusters and the Safe Route Demo
// ==========================================================================
const SEED_MAP_REPORTS = [
  // Delhi Cluster (Primary focus for Safe Route Prototype)
  {
    id: 'RPT-1002',
    hazardName: 'Open Manhole',
    category: 'open_manhole',
    riskScore: 92,
    severity: 'Critical',
    status: 'Verified',
    location: 'Lodhi Gardens West Gate, New Delhi',
    city: 'Delhi',
    lat: 28.5933,
    lng: 77.2197,
    date: 'Sep 19, 2026',
    isSeed: true
  },
  {
    id: 'RPT-2004',
    hazardName: 'Broken Footpath',
    category: 'broken_footpath',
    riskScore: 78,
    severity: 'High',
    status: 'In Progress',
    location: 'Max Mueller Marg, near India Habitat Centre',
    city: 'Delhi',
    lat: 28.5898,
    lng: 77.2241,
    date: 'Sep 18, 2026',
    isSeed: true
  },
  {
    id: 'RPT-2005',
    hazardName: 'Pothole',
    category: 'pothole',
    riskScore: 68,
    severity: 'Medium',
    status: 'Reported',
    location: 'Lodhi Colony Main Market Crosswalk',
    city: 'Delhi',
    lat: 28.5862,
    lng: 77.2215,
    date: 'Sep 17, 2026',
    isSeed: true
  },
  {
    id: 'RPT-2006',
    hazardName: 'Waterlogging',
    category: 'waterlogging',
    riskScore: 82,
    severity: 'High',
    status: 'Reported',
    location: 'Barapullah Subway Pedestrian Ramp',
    city: 'Delhi',
    lat: 28.5845,
    lng: 77.2289,
    date: 'Sep 16, 2026',
    isSeed: true
  },
  {
    id: 'RPT-2007',
    hazardName: 'Damaged Ramp',
    category: 'damaged_ramp',
    riskScore: 42,
    severity: 'Low',
    status: 'Reported',
    location: 'Jor Bagh Metro Station Exit 2',
    city: 'Delhi',
    lat: 28.5881,
    lng: 77.2144,
    date: 'Sep 15, 2026',
    isSeed: true
  },
  {
    id: 'RPT-2008',
    hazardName: 'Sidewalk Repaired',
    category: 'broken_footpath',
    riskScore: 12,
    severity: 'Low',
    status: 'Resolved',
    location: 'Amrita Shergill Marg Sidewalk',
    city: 'Delhi',
    lat: 28.5960,
    lng: 77.2210,
    date: 'Sep 14, 2026',
    isSeed: true
  },

  // Bangalore Cluster
  {
    id: 'RPT-1003',
    hazardName: 'Broken Footpath',
    category: 'broken_footpath',
    riskScore: 86,
    severity: 'Critical',
    status: 'In Progress',
    location: 'Indiranagar 100ft Road, Bangalore',
    city: 'Bangalore',
    lat: 12.9784,
    lng: 77.6408,
    date: 'Sep 18, 2026',
    isSeed: true
  },
  {
    id: 'RPT-3002',
    hazardName: 'Open Manhole',
    category: 'open_manhole',
    riskScore: 94,
    severity: 'Critical',
    status: 'Verified',
    location: 'Koramangala 80ft Road Junction',
    city: 'Bangalore',
    lat: 12.9352,
    lng: 77.6245,
    date: 'Sep 19, 2026',
    isSeed: true
  },
  {
    id: 'RPT-3003',
    hazardName: 'Damaged Wheelchair Ramp',
    category: 'damaged_ramp',
    riskScore: 56,
    severity: 'Medium',
    status: 'In Progress',
    location: 'MG Road Metro Station Walkway',
    city: 'Bangalore',
    lat: 12.9756,
    lng: 77.6067,
    date: 'Sep 16, 2026',
    isSeed: true
  },
  {
    id: 'RPT-3004',
    hazardName: 'Pavement Replaced',
    category: 'broken_footpath',
    riskScore: 15,
    severity: 'Low',
    status: 'Resolved',
    location: 'Church Street Pedestrian Plaza',
    city: 'Bangalore',
    lat: 12.9744,
    lng: 77.6045,
    date: 'Sep 12, 2026',
    isSeed: true
  },

  // Mumbai Cluster
  {
    id: 'RPT-1004',
    hazardName: 'Waterlogging',
    category: 'waterlogging',
    riskScore: 74,
    severity: 'High',
    status: 'Reported',
    location: 'SV Road & Linking Road, Bandra, Mumbai',
    city: 'Mumbai',
    lat: 19.0607,
    lng: 72.8362,
    date: 'Sep 16, 2026',
    isSeed: true
  },
  {
    id: 'RPT-4002',
    hazardName: 'Deep Road Pothole',
    category: 'pothole',
    riskScore: 90,
    severity: 'Critical',
    status: 'In Progress',
    location: 'Andheri West Station Approach Road',
    city: 'Mumbai',
    lat: 19.1197,
    lng: 72.8464,
    date: 'Sep 18, 2026',
    isSeed: true
  },
  {
    id: 'RPT-4003',
    hazardName: 'Drain Covered',
    category: 'open_manhole',
    riskScore: 10,
    severity: 'Low',
    status: 'Resolved',
    location: 'Marine Drive Promenade Crosswalk',
    city: 'Mumbai',
    lat: 18.9432,
    lng: 72.8234,
    date: 'Sep 10, 2026',
    isSeed: true
  },

  // Pune Cluster
  {
    id: 'RPT-1005',
    hazardName: 'Damaged Ramp',
    category: 'damaged_ramp',
    riskScore: 54,
    severity: 'Medium',
    status: 'In Progress',
    location: 'FC Road Pedestrian Zone, Pune',
    city: 'Pune',
    lat: 18.5204,
    lng: 73.8415,
    date: 'Sep 15, 2026',
    isSeed: true
  },
  {
    id: 'RPT-5002',
    hazardName: 'Broken Footpath Slabs',
    category: 'broken_footpath',
    riskScore: 80,
    severity: 'High',
    status: 'Reported',
    location: 'Kothrud Paud Road Crossing',
    city: 'Pune',
    lat: 18.5074,
    lng: 73.8077,
    date: 'Sep 17, 2026',
    isSeed: true
  },
  {
    id: 'RPT-5003',
    hazardName: 'Ramp Rebuilt & Verified',
    category: 'damaged_ramp',
    riskScore: 8,
    severity: 'Low',
    status: 'Resolved',
    location: 'JM Road Subway Entrance, Pune',
    city: 'Pune',
    lat: 18.5308,
    lng: 73.8475,
    date: 'Sep 11, 2026',
    isSeed: true
  }
];

// ==========================================================================
// 3. INITIALIZE SAFETY MAP (LEAFLET.JS)
// ==========================================================================
async function initSafetyMap() {
  const mapElement = document.getElementById('safetyMap');
  if (!mapElement || typeof L === 'undefined') return;

  // Center initially on Delhi Cluster (where the Safe Route prototype is set up)
  mapInstance = L.map('safetyMap', {
    zoomControl: false
  }).setView([28.5910, 77.2215], 14);

  // Zoom control in bottom right
  L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

  // CartoDB Dark Matter dark mode tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors, &copy; CARTO'
  }).addTo(mapInstance);

  markersLayerGroup = L.layerGroup().addTo(mapInstance);

  // Setup Safe Route prototype demonstration polyline
  setupSafeRoutePrototype();

  // Setup toolbar filters and search listeners
  setupToolbarListeners();

  // Initialize with seed data first
  allMapReports = [...SEED_MAP_REPORTS];
  renderMarkers(allMapReports);
  updateSidePanelStats(allMapReports);

  // Fetch live reports from Supabase database
  await loadSupabaseReports();

  // Check if a report ID was requested in URL query parameter (?focus=REPORT_ID)
  handleUrlFocusParameter();
}

// ==========================================================================
// 4. RETRIEVE APPROPRIATE REPORT RECORDS FROM SUPABASE
// Strictly public safety map data (NO private user information exposed)
// ==========================================================================
async function loadSupabaseReports() {
  try {
    let dbReports = [];

    // Query Supabase using public API method
    if (window.PathPulseSupabase && window.PathPulseSupabase.reports && window.PathPulseSupabase.reports.getPublicSafetyMapReports) {
      dbReports = await window.PathPulseSupabase.reports.getPublicSafetyMapReports();
    } else if (window.PathPulseSupabase && window.PathPulseSupabase.client) {
      // Direct query with safe explicit column projection: NO user_id, NO private user profile
      const _supabase = window.PathPulseSupabase.client;
      const { data, error } = await _supabase
        .from('reports')
        .select('id, title, category, severity, risk_score, latitude, longitude, address, status, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      dbReports = data || [];
    }

    // Also merge any local session reports from localStorage (for immediate testing feedback)
    let localReports = [];
    try {
      localReports = JSON.parse(localStorage.getItem('pathpulse_reports') || '[]');
    } catch (e) {}

    // Transform and sanitize database records
    const sanitizedDbReports = [];

    // Process Supabase reports
    (dbReports || []).forEach(r => {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (isNaN(lat) || isNaN(lng)) return; // Exclude invalid coordinates

      const sevMeta = formatSeverityMeta(r.severity);
      const statusMeta = formatStatusMeta(r.status);
      const hazardName = r.title || formatCategoryLabel(r.category);

      sanitizedDbReports.push({
        id: r.id,
        hazardName: hazardName,
        category: r.category || 'other',
        riskScore: parseInt(r.risk_score !== undefined ? r.risk_score : 75, 10),
        severity: sevMeta.label,
        status: statusMeta.label,
        location: r.address || 'Pedestrian Walking Pathway',
        city: 'Local Ward',
        lat: lat,
        lng: lng,
        date: formatDisplayDate(r.created_at),
        isSeed: false
      });
    });

    // Process locally cached reports (if not already in database)
    (localReports || []).forEach(lr => {
      const lat = parseFloat(lr.latitude || lr.lat);
      const lng = parseFloat(lr.longitude || lr.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      if (!sanitizedDbReports.some(r => r.id === lr.id)) {
        const sevMeta = formatSeverityMeta(lr.severity);
        const statusMeta = formatStatusMeta(lr.status);
        const hazardName = lr.title || lr.hazardType || formatCategoryLabel(lr.category);

        sanitizedDbReports.push({
          id: lr.id,
          hazardName: hazardName,
          category: lr.category || 'other',
          riskScore: parseInt(lr.risk_score || lr.riskScore || 75, 10),
          severity: sevMeta.label,
          status: statusMeta.label,
          location: lr.address || lr.location || 'Reported Location',
          city: 'Local Ward',
          lat: lat,
          lng: lng,
          date: formatDisplayDate(lr.created_at || lr.date),
          isSeed: false
        });
      }
    });

    // Merge database reports on top of anchor seed reports (deduped by ID)
    if (sanitizedDbReports.length > 0) {
      const merged = [...sanitizedDbReports];
      SEED_MAP_REPORTS.forEach(seed => {
        if (!merged.some(m => m.id === seed.id)) {
          merged.push(seed);
        }
      });
      allMapReports = merged;
      console.log(`✓ PathPulse Safety Map: ${sanitizedDbReports.length} Supabase report(s) loaded into map view.`);
    } else {
      allMapReports = [...SEED_MAP_REPORTS];
    }

    // Re-render markers with updated data
    renderMarkers(allMapReports);
    updateSidePanelStats(allMapReports);

  } catch (err) {
    console.info('Supabase map synchronization notice (using cached/anchor reports):', err.message);
    // Keep seed data active so the map is never blank
    allMapReports = [...SEED_MAP_REPORTS];
    renderMarkers(allMapReports);
    updateSidePanelStats(allMapReports);
  }
}

// ==========================================================================
// 5. RENDER MARKERS ON MAP & DISPLAY MARKER POPUP
// ==========================================================================
function renderMarkers(reports) {
  if (!markersLayerGroup) return;
  markersLayerGroup.clearLayers();
  markerRegistry.clear();

  // Apply active toolbar filter: All, Critical, High, Medium, Low, Resolved
  const filtered = filterReports(reports, currentFilter);

  filtered.forEach(report => {
    const lat = report.lat;
    const lng = report.lng;
    if (isNaN(lat) || isNaN(lng)) return;

    const isResolved = (report.status || '').toLowerCase() === 'resolved';
    const sevMeta = formatSeverityMeta(report.severity);
    const statusMeta = formatStatusMeta(report.status);

    // Marker styling (Resolved markers take green resolved state)
    let markerClass = isResolved ? 'marker-bg-resolved' : sevMeta.cssClass;
    let markerIcon = isResolved ? 'fa-circle-check' : sevMeta.icon;

    // Custom pulse dot marker
    const customIcon = L.divIcon({
      className: `pulse-map-marker ${markerClass}`,
      html: `<i class="fa-solid ${markerIcon}"></i>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14]
    });

    const marker = L.marker([lat, lng], { icon: customIcon });

    // Short display ID for ticket chip
    const shortId = (typeof report.id === 'string' && report.id.length > 12)
      ? ('RPT-' + report.id.slice(0, 4).toUpperCase())
      : report.id;

    // Dark-styled popup containing:
    // Hazard name, Risk score, Severity, Status, Date, and "View Report" button
    const popupHtml = `
      <div class="popup-inner-card">
        <div class="popup-header-row">
          <h4 class="popup-hazard-type">${escapeHtml(report.hazardName)}</h4>
          <span class="popup-score-pill" style="background: rgba(255,255,255,0.06); color: ${sevMeta.color};">
            Score: ${report.riskScore}/100
          </span>
        </div>

        <div class="popup-badges-row">
          <span class="badge ${sevMeta.badgeClass}" style="font-size: 0.7rem;">
            ${sevMeta.label}
          </span>
          <span class="badge ${statusMeta.badgeClass}" style="font-size: 0.7rem;">
            <i class="fa-solid ${statusMeta.icon}" style="font-size: 0.65rem; margin-right: 3px;"></i>
            ${statusMeta.label}
          </span>
        </div>

        <div class="popup-location-row" title="${escapeHtml(report.location)}">
          <i class="fa-solid fa-location-dot" style="color: ${sevMeta.color}; font-size: 0.85rem;"></i>
          <span>${escapeHtml(report.location)}</span>
        </div>

        <div class="popup-date-row" style="display: flex; align-items: center; gap: 6px; font-size: 0.76rem; color: #71717A; margin-bottom: 12px;">
          <i class="fa-regular fa-calendar"></i>
          <span>${escapeHtml(report.date)}</span>
          <span style="color: rgba(255,255,255,0.2);">•</span>
          <span style="font-family: var(--font-mono); font-size: 0.72rem;">${escapeHtml(shortId)}</span>
        </div>

        <a 
          href="report-details.html?id=${encodeURIComponent(report.id)}" 
          class="popup-view-btn"
          title="Open full hazard audit for ${escapeHtml(report.hazardName)}"
        >
          <span>View Report</span>
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    `;

    marker.bindPopup(popupHtml);
    markersLayerGroup.addLayer(marker);
    markerRegistry.set(String(report.id), marker);
  });
}

// ==========================================================================
// 6. FILTERS LOGIC: All, Critical, High, Medium, Low, Resolved
// ==========================================================================
function filterReports(reports, filter) {
  const f = (filter || 'All').toLowerCase();

  if (f === 'all') {
    return reports;
  }

  if (f === 'resolved') {
    return reports.filter(r => {
      const status = (r.status || '').toLowerCase().replace(/\s+/g, '_');
      return status === 'resolved';
    });
  }

  // Active severity filters (Critical, High, Medium, Low)
  return reports.filter(r => {
    const sev = (r.severity || '').toLowerCase();
    const status = (r.status || '').toLowerCase().replace(/\s+/g, '_');
    
    // Resolved hazards are grouped under 'Resolved' filter
    if (status === 'resolved') return false;

    if (f === 'medium') {
      return sev === 'medium' || sev === 'moderate';
    }

    return sev === f;
  });
}

// ==========================================================================
// 7. SIDE PANEL STATS UPDATE
// ==========================================================================
function updateSidePanelStats(reports) {
  const totalEl = document.getElementById('panel-stat-total');
  const highRiskEl = document.getElementById('panel-stat-highrisk');
  const resolvedEl = document.getElementById('panel-stat-resolved');

  const total = reports.length;
  const highRisk = reports.filter(r => {
    const sev = (r.severity || '').toLowerCase();
    const stat = (r.status || '').toLowerCase().replace(/\s+/g, '_');
    const score = Number(r.riskScore || 0);
    return (sev === 'critical' || sev === 'high' || score >= 70) && stat !== 'resolved';
  }).length;

  const resolved = reports.filter(r => {
    const stat = (r.status || '').toLowerCase().replace(/\s+/g, '_');
    return stat === 'resolved';
  }).length;

  if (totalEl) totalEl.textContent = total;
  if (highRiskEl) highRiskEl.textContent = highRisk;
  if (resolvedEl) resolvedEl.textContent = resolved;
}

// ==========================================================================
// 8. SAFE ROUTE PROTOTYPE VISUALIZATION (DELHI DEMO CLUSTER)
// ==========================================================================
function setupSafeRoutePrototype() {
  if (!mapInstance) return;

  // Shortest Route coordinates (Traverses right past Open Manhole & Broken Footpath)
  const shortestCoords = [
    [28.5960, 77.2185], // Origin (Metro / Residential)
    [28.5933, 77.2197], // Directly past Open Manhole (Dangerous!)
    [28.5898, 77.2241], // Past Broken Footpath
    [28.5875, 77.2260]  // Destination (Habitat Centre)
  ];

  // Safer Route coordinates (Intelligently rerouted along verified, well-lit sidewalks)
  const saferCoords = [
    [28.5960, 77.2185], // Origin
    [28.5960, 77.2210], // East onto Amrita Shergill Marg (Verified Safe)
    [28.5930, 77.2235], // South along protected walking boulevard
    [28.5890, 77.2255], // Clear of construction & drains
    [28.5875, 77.2260]  // Destination
  ];

  // Shortest Polyline (Dashed Amber/Red)
  routeShortestLayer = L.polyline(shortestCoords, {
    color: '#EF4444',
    weight: 3.5,
    dashArray: '6, 6',
    opacity: 0.7
  }).bindTooltip('⚠️ Shortest Route (3 High Hazards)', { permanent: false, direction: 'top' });

  // Safer Polyline (Glowing Neon Emerald with shadow)
  routeSaferLayer = L.polyline(saferCoords, {
    color: '#10B981',
    weight: 4.5,
    opacity: 0.95
  }).bindTooltip('🛡️ Safe Route (+40% Safer Walking Index)', { permanent: false, direction: 'top' });

  // Add to map by default
  routeShortestLayer.addTo(mapInstance);
  routeSaferLayer.addTo(mapInstance);
}

// Toggle Route Visualization
function toggleSafeRouteVisualization() {
  if (!mapInstance || !routeShortestLayer || !routeSaferLayer) return;

  const btn = document.getElementById('btn-toggle-route');

  if (routeVisible) {
    mapInstance.removeLayer(routeShortestLayer);
    mapInstance.removeLayer(routeSaferLayer);
    routeVisible = false;
    if (btn) btn.innerHTML = '<i class="fa-solid fa-route"></i> Show Route Prototype on Map';
  } else {
    routeShortestLayer.addTo(mapInstance);
    routeSaferLayer.addTo(mapInstance);
    routeVisible = true;
    mapInstance.setView([28.5910, 77.2215], 15);
    if (btn) btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hide Route Prototype from Map';
  }
}

// ==========================================================================
// 9. TOOLBAR FILTER & SEARCH LISTENERS
// ==========================================================================
function setupToolbarListeners() {
  // Severity / Status Filters
  const filterBtns = document.querySelectorAll('.toolbar-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter') || 'All';
      renderMarkers(allMapReports);
    });
  });

  // Location / Keyword search
  const searchInput = document.getElementById('map-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderMarkers(allMapReports);
        return;
      }

      const matching = allMapReports.filter(r => 
        (r.city && r.city.toLowerCase().includes(q)) ||
        (r.location && r.location.toLowerCase().includes(q)) ||
        (r.hazardName && r.hazardName.toLowerCase().includes(q)) ||
        (r.category && r.category.toLowerCase().includes(q))
      );

      renderMarkers(matching);

      if (matching.length > 0 && q.length > 2) {
        mapInstance.setView([matching[0].lat, matching[0].lng], 14);
      }
    });
  }
}

// ==========================================================================
// 10. URL QUERY PARAMETER FOCUS HANDLER (?focus=REPORT_ID)
// ==========================================================================
function handleUrlFocusParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  const focusId = urlParams.get('focus') || urlParams.get('id');
  if (!focusId) return;

  const targetReport = allMapReports.find(r => String(r.id) === String(focusId));
  if (targetReport && mapInstance) {
    mapInstance.setView([targetReport.lat, targetReport.lng], 16);
    
    // Open popup after brief animation delay
    setTimeout(() => {
      if (markerRegistry.has(String(focusId))) {
        markerRegistry.get(String(focusId)).openPopup();
      }
    }, 450);
  }
}

// Pan to Specific City Cluster
function panToCity(cityName) {
  const reports = allMapReports.filter(r => (r.city || '').toLowerCase() === cityName.toLowerCase());
  if (reports.length > 0 && mapInstance) {
    mapInstance.setView([reports[0].lat, reports[0].lng], 14);
  } else if (mapInstance) {
    // Coordinate fallbacks for cities
    const cityCoords = {
      'delhi': [28.5910, 77.2215],
      'bangalore': [12.9716, 77.5946],
      'mumbai': [19.0760, 72.8777],
      'pune': [18.5204, 73.8567]
    };
    const c = cityCoords[cityName.toLowerCase()];
    if (c) mapInstance.setView(c, 13);
  }
}

// Side Panel Toggle
function toggleSidePanel() {
  const panel = document.getElementById('map-side-panel');
  const openBtn = document.getElementById('floating-panel-open-btn');
  if (panel && openBtn) {
    panel.classList.toggle('collapsed');
    openBtn.classList.toggle('visible');
  }
}

// Global exports for inline HTML events
window.panToCity = panToCity;
window.toggleSidePanel = toggleSidePanel;
window.toggleSafeRouteVisualization = toggleSafeRouteVisualization;
window.initSafetyMap = initSafetyMap;

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initSafetyMap();
});
