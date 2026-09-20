// ==========================================================================
// PathPulse AI - Hazard Report Details Script (js/report-details.js)
// Minimalist Dark Design System - Frontend Prototype
// ==========================================================================

// Complete 6 Sequential Lifecycle Stages required by specification
const STAGES = [
  { key: 'Reported', label: 'Reported', icon: 'fa-paper-plane', desc: 'Hazard logged with GPS coordinates and initial visual telemetry.' },
  { key: 'Under Review', label: 'Under Review', icon: 'fa-microchip', desc: 'Edge AI computer vision audit and risk score computation completed.' },
  { key: 'Verified', label: 'Verified', icon: 'fa-circle-check', desc: 'Cross-validated through civic telemetry and community pedestrian signals.' },
  { key: 'Assigned', label: 'Assigned', icon: 'fa-clipboard-user', desc: 'Ticket dispatched to Municipal Ward Sidewalk Maintenance Unit.' },
  { key: 'In Progress', label: 'In Progress', icon: 'fa-person-digging', desc: 'On-site engineering inspection and safety barrier deployment.' },
  { key: 'Resolved', label: 'Resolved', icon: 'fa-shield-check', desc: 'Awaiting physical remediation sign-off and pedestrian clearance.' }
];

// Sample Report Showcase Database
const SAMPLE_REPORTS = [
  {
    id: 'RPT-1002',
    hazardType: 'Open Manhole',
    category: 'Drainage & Manhole',
    riskScore: 92,
    severity: 'Critical',
    status: 'Verified',
    date: 'Sep 19, 2026',
    time: '08:15 AM',
    location: 'Lodhi Gardens West Gate, New Delhi',
    coordinates: '28.5933° N, 77.2197° E',
    lat: 28.5933,
    lng: 77.2197,
    aiConfidence: '96.4%',
    upvotes: 14,
    description: 'Completely exposed stormwater drain opening directly on the pedestrian corridor. Missing cast iron grate creates an immediate severe fall hazard, especially during low evening visibility. Pedestrians forced onto high-speed roadway.',
    image: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=1200',
    evidenceGallery: [
      'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=600',
      'https://images.unsplash.com/photo-1518206411599-232a581de943?auto=format&fit=crop&q=80&w=600',
      'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?auto=format&fit=crop&q=80&w=600'
    ],
    stageTimestamps: {
      'Reported': 'Sep 19, 08:15 AM',
      'Under Review': 'Sep 19, 08:16 AM',
      'Verified': 'Sep 19, 09:30 AM'
    }
  },
  {
    id: 'RPT-1003',
    hazardType: 'Broken Footpath',
    category: 'Pedestrian Infrastructure',
    riskScore: 78,
    severity: 'High',
    status: 'In Progress',
    date: 'Sep 18, 2026',
    time: '05:40 PM',
    location: 'Indiranagar 100ft Road, Bangalore',
    coordinates: '12.9784° N, 77.6408° E',
    lat: 12.9784,
    lng: 77.6408,
    aiConfidence: '91.8%',
    upvotes: 9,
    description: 'Shattered paver slabs with jutting metal rebar. High foot-traffic area near transit corridor creating active tripping hazard and wheelchair obstruction.',
    image: 'https://images.unsplash.com/photo-1518206411599-232a581de943?auto=format&fit=crop&q=80&w=1200',
    evidenceGallery: [
      'https://images.unsplash.com/photo-1518206411599-232a581de943?auto=format&fit=crop&q=80&w=600',
      'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=600'
    ],
    stageTimestamps: {
      'Reported': 'Sep 18, 05:40 PM',
      'Under Review': 'Sep 18, 05:41 PM',
      'Verified': 'Sep 18, 06:15 PM',
      'Assigned': 'Sep 19, 09:00 AM',
      'In Progress': 'Sep 19, 11:30 AM'
    }
  },
  {
    id: 'RPT-1004',
    hazardType: 'Waterlogging',
    category: 'Drainage Hazard',
    riskScore: 65,
    severity: 'High',
    status: 'Reported',
    date: 'Sep 16, 2026',
    time: '11:20 AM',
    location: 'SV Road & Linking Road, Mumbai',
    coordinates: '19.0596° N, 72.8295° E',
    lat: 19.0596,
    lng: 72.8295,
    aiConfidence: '88.5%',
    upvotes: 6,
    description: 'Persistent 14-inch standing stormwater submerging crosswalk and tactile paving. Pedestrians forced into vehicle lanes.',
    image: 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?auto=format&fit=crop&q=80&w=1200',
    evidenceGallery: [
      'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?auto=format&fit=crop&q=80&w=600'
    ],
    stageTimestamps: {
      'Reported': 'Sep 16, 11:20 AM'
    }
  }
];

// Active State
let currentReport = null;
let initialStatus = 'Verified';
let miniMap = null;
let currentMarker = null;

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initReportPage();
});

function initReportPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const requestedId = urlParams.get('id') || 'RPT-1002';

  // 1. Check localStorage first
  let foundReport = null;
  try {
    const userReports = JSON.parse(localStorage.getItem('pathpulse_reports') || '[]');
    foundReport = userReports.find(r => r.id === requestedId);
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }

  // 2. Fallback to SAMPLE_REPORTS
  if (!foundReport) {
    foundReport = SAMPLE_REPORTS.find(r => r.id === requestedId);
  }

  // 3. Fallback to default showcase (Open Manhole RPT-1002)
  if (!foundReport) {
    foundReport = SAMPLE_REPORTS[0];
  }

  // Deep clone to allow runtime status changes without corrupting source data
  currentReport = JSON.parse(JSON.stringify(foundReport));
  initialStatus = currentReport.status || 'Verified';

  // Render content
  renderReportDetails();
  renderTimeline(currentReport.status);
  renderSimulatorButtons();
  initMiniMap();
  setupEventListeners();

  // Async query to Supabase if client is available
  if (window.PathPulseSupabase && window.PathPulseSupabase.reports && requestedId) {
    window.PathPulseSupabase.reports.getById(requestedId)
      .then(dbReport => {
        if (dbReport) {
          currentReport = {
            id: dbReport.id,
            hazardType: dbReport.title || dbReport.hazard_type || 'Pedestrian Hazard',
            category: (dbReport.category || 'broken_footpath').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            severity: (dbReport.severity || 'High').charAt(0).toUpperCase() + (dbReport.severity || 'High').slice(1),
            riskScore: dbReport.risk_score || 75,
            status: (dbReport.status || 'Reported').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            date: new Date(dbReport.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: new Date(dbReport.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            location: dbReport.address || dbReport.location_address || 'Indiranagar 100ft Road, Bangalore',
            coordinates: `${(dbReport.latitude || 12.9784).toFixed(4)}° N, ${(dbReport.longitude || 77.6408).toFixed(4)}° E`,
            lat: dbReport.latitude,
            lng: dbReport.longitude,
            image: dbReport.image_url || currentReport.image,
            aiConfidence: dbReport.ai_confidence ? (typeof dbReport.ai_confidence === 'number' ? dbReport.ai_confidence + '%' : dbReport.ai_confidence) : '91%',
            description: dbReport.description,
            assignedTo: dbReport.assigned_to || 'Municipal Response Unit',
            timeline: currentReport.timeline
          };
          renderReportDetails();
          renderTimeline(currentReport.status);
          renderSimulatorButtons();
          initMiniMap();

          const badgeText = document.getElementById('rd-connection-text');
          if (badgeText) {
            badgeText.textContent = 'Live Report \u2022 Supabase Verified';
          }
        }
      })
      .catch(e => console.info('Supabase report lookup note (using local cache):', e.message));
  }
}

// ==========================================================================
// Render Report Details
// ==========================================================================
function renderReportDetails() {
  const report = currentReport;

  // Title, Category, ID
  const titleEl = document.getElementById('rd-hazard-title');
  if (titleEl) titleEl.textContent = report.hazardType || 'Open Manhole';

  const idEl = document.getElementById('rd-report-id');
  if (idEl) idEl.textContent = report.id || 'RPT-1002';

  const idPillEl = document.getElementById('rd-report-id-pill');
  if (idPillEl) idPillEl.textContent = report.id || 'RPT-1002';

  const categoryEl = document.getElementById('rd-category-text');
  if (categoryEl) categoryEl.textContent = report.category || 'Drainage & Manhole';

  const dateEl = document.getElementById('rd-report-date');
  if (dateEl) dateEl.textContent = `Reported: ${report.date || 'Sep 19, 2026'} • ${report.time || '08:15 AM'}`;

  // Metrics: Risk Score, Severity, Status
  const riskValEl = document.getElementById('rd-risk-score');
  if (riskValEl) riskValEl.textContent = `${report.riskScore || 92}/100`;

  const sevEl = document.getElementById('rd-severity-badge');
  if (sevEl) {
    const sev = report.severity || 'Critical';
    sevEl.textContent = sev;
    sevEl.className = `severity-pill ${sev.toLowerCase()}`;
  }

  updateStatusPill(report.status);

  const confEl = document.getElementById('rd-ai-confidence');
  if (confEl) confEl.textContent = report.aiConfidence || '96.4%';

  // Description
  const descEl = document.getElementById('rd-description');
  if (descEl) descEl.textContent = report.description || 'No detailed description provided.';

  // Location
  const addrEl = document.getElementById('rd-address');
  if (addrEl) addrEl.textContent = report.location || 'Lodhi Gardens West Gate, New Delhi';

  const coordsEl = document.getElementById('rd-coords');
  if (coordsEl) {
    const lat = (report.lat || 28.5933).toFixed(4);
    const lng = (report.lng || 77.2197).toFixed(4);
    coordsEl.textContent = `${lat}° N, ${lng}° E`;
  }

  // Upvotes
  const upvotesEl = document.getElementById('rd-upvotes-count');
  if (upvotesEl) upvotesEl.textContent = report.upvotes || 14;

  // Image Showcase
  const mainImg = document.getElementById('rd-main-image');
  if (mainImg) {
    const imgSrc = report.image || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=1200';
    mainImg.src = imgSrc;
    mainImg.alt = `${report.hazardType || 'Hazard'} photo evidence`;
    mainImg.onerror = () => {
      mainImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" fill="%2312121e"/><path d="M 0,250 L 800,250" stroke="%232b2b40" stroke-width="4"/><circle cx="400" cy="250" r="90" fill="%2308080d" stroke="%23ef4444" stroke-width="6" stroke-dasharray="10 5"/><circle cx="400" cy="250" r="75" fill="%23050508"/><text x="400" y="245" font-family="sans-serif" font-size="20" fill="%23ef4444" font-weight="bold" text-anchor="middle">OPEN MANHOLE</text><text x="400" y="275" font-family="monospace" font-size="14" fill="%23f59e0b" text-anchor="middle">CRITICAL FALL RISK • 92/100</text></svg>';
    };
  }

  // Update "View Safety Map" button target
  const mapBtn = document.getElementById('btn-view-safety-map');
  if (mapBtn) {
    mapBtn.href = `map.html?focus=${report.id}`;
  }
}

// ==========================================================================
// Status Badges
// ==========================================================================
function updateStatusPill(status) {
  const statusEl = document.getElementById('rd-status-badge');
  if (!statusEl) return;

  statusEl.textContent = status;
  statusEl.className = 'status-pill';

  const s = status.toLowerCase();
  if (s.includes('verified')) {
    statusEl.classList.add('verified');
  } else if (s.includes('reported')) {
    statusEl.classList.add('reported');
  } else if (s.includes('review')) {
    statusEl.classList.add('review');
  } else if (s.includes('assigned')) {
    statusEl.classList.add('assigned');
  } else if (s.includes('progress')) {
    statusEl.classList.add('inprogress');
  } else if (s.includes('resolved')) {
    statusEl.classList.add('resolved');
  } else {
    statusEl.classList.add('reported');
  }
}

// ==========================================================================
// 6-Stage Report Timeline Rendering
// Rule: Only show completed stages as completed. Future stages must appear pending.
// ==========================================================================
function renderTimeline(currentStatus) {
  const container = document.getElementById('rd-timeline-container');
  if (!container) return;

  const currentIdx = STAGES.findIndex(s => s.key.toLowerCase() === (currentStatus || '').toLowerCase());
  // If not found, default to stage 2 (Verified, index 2)
  const activeIdx = currentIdx >= 0 ? currentIdx : 2;

  let html = '';

  STAGES.forEach((stage, idx) => {
    const isPast = idx < activeIdx;
    const isCurrent = idx === activeIdx;
    const isFuture = idx > activeIdx;

    let stateClass = 'pending';
    let iconClass = 'fa-regular fa-circle-dot';
    let timeText = 'Pending';
    let statusPillText = '<span style="color:#71717A; font-size:0.75rem;">(Pending)</span>';

    if (isPast) {
      stateClass = 'completed';
      iconClass = 'fa-solid fa-check';
      timeText = getStageTimestamp(stage.key) || 'Completed';
      statusPillText = '<span style="color:#10B981; font-size:0.75rem; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Completed</span>';
    } else if (isCurrent) {
      if (stage.key === 'In Progress') {
        stateClass = 'current in-progress';
        iconClass = 'fa-solid fa-person-digging';
        timeText = getStageTimestamp(stage.key) || 'Active / On-Site';
        statusPillText = '<span style="color:#22D3EE; font-size:0.75rem; font-weight:600;"><i class="fa-solid fa-spinner fa-spin"></i> In Progress</span>';
      } else {
        stateClass = 'completed current';
        iconClass = 'fa-solid fa-check';
        timeText = getStageTimestamp(stage.key) || 'Completed';
        statusPillText = '<span style="color:#10B981; font-size:0.75rem; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Completed (Current)</span>';
      }
    } else {
      stateClass = 'pending';
      iconClass = 'fa-regular fa-clock';
      timeText = 'Awaiting preceding steps';
      statusPillText = '<span style="color:#71717A; font-size:0.75rem;">(Pending)</span>';
    }

    // Notice for Resolved stage: Prompt constraint "Do not claim a report is actually resolved."
    let extraNotice = '';
    if (stage.key === 'Resolved' && (isCurrent || isPast)) {
      extraNotice = '<div class="rd-demo-disclaimer" style="margin-top:6px; font-size:0.75rem;"><strong>Demo Notice:</strong> Simulated UI transition only. Real physical hazard resolution requires on-site municipal sign-off.</div>';
    }

    html += `
      <div class="rd-timeline-item ${stateClass}" id="timeline-stage-${idx}">
        ${idx < STAGES.length - 1 ? '<div class="rd-timeline-line"></div>' : ''}
        <div class="rd-timeline-node">
          <i class="${iconClass}"></i>
        </div>
        <div class="rd-timeline-content">
          <div class="rd-timeline-title-row">
            <h4 class="rd-timeline-title">${stage.label} ${statusPillText}</h4>
            <span class="rd-timeline-time">${timeText}</span>
          </div>
          <p class="rd-timeline-desc">${stage.desc}</p>
          ${extraNotice}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function getStageTimestamp(stageKey) {
  if (currentReport && currentReport.stageTimestamps && currentReport.stageTimestamps[stageKey]) {
    return currentReport.stageTimestamps[stageKey];
  }

  // Generate plausible timestamps based on current date
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  if (stageKey === 'Reported') return 'Sep 19, 08:15 AM';
  if (stageKey === 'Under Review') return 'Sep 19, 08:16 AM';
  if (stageKey === 'Verified') return 'Sep 19, 09:30 AM';
  if (stageKey === 'Assigned') return `Today, ${timeStr}`;
  if (stageKey === 'In Progress') return `Today, ${timeStr}`;
  if (stageKey === 'Resolved') return `Simulated, ${timeStr}`;
  return 'Logged';
}

// ==========================================================================
// Interactive Demo Status Simulator
// Allows evaluator to cycle or select any stage (Reported -> Resolved)
// With clear disclaimer that real-world resolution is not claimed
// ==========================================================================
function renderSimulatorButtons() {
  const container = document.getElementById('rd-stage-buttons-grid');
  if (!container) return;

  const currentIdx = STAGES.findIndex(s => s.key.toLowerCase() === (currentReport.status || '').toLowerCase());
  const activeIdx = currentIdx >= 0 ? currentIdx : 2;

  let buttonsHtml = '';
  STAGES.forEach((stage, idx) => {
    const isActive = idx === activeIdx;
    buttonsHtml += `
      <button type="button" class="rd-stage-btn ${isActive ? 'active' : ''}" onclick="setDemoStatus('${stage.key}')">
        <span class="step-idx">Stage 0${idx + 1}</span>
        <span>${stage.label}</span>
      </button>
    `;
  });

  container.innerHTML = buttonsHtml;
}

// Set stage directly
window.setDemoStatus = function(newStatus) {
  currentReport.status = newStatus;

  // Add simulated timestamp if not present
  if (!currentReport.stageTimestamps) currentReport.stageTimestamps = {};
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  currentReport.stageTimestamps[newStatus] = `Today, ${timeStr}`;

  // Update DOM components
  updateStatusPill(newStatus);
  renderTimeline(newStatus);
  renderSimulatorButtons();

  // Toast feedback with explicit disclaimer
  if (newStatus === 'Resolved') {
    showToast(`⚡ Demo Simulation: Status set to 'Resolved'.<br><small style="color:#FBBF24;">Notice: Physical hazard repairs require verified civic municipal action.</small>`);
  } else {
    showToast(`⚡ Demo Simulation: Status advanced to <strong>${newStatus}</strong>.<br><small style="color:#A1A1AA;">Timeline updated. Future stages marked as pending.</small>`);
  }
};

// Advance to next stage sequentially
window.advanceDemoStatus = function() {
  const currentIdx = STAGES.findIndex(s => s.key.toLowerCase() === (currentReport.status || '').toLowerCase());
  const nextIdx = (currentIdx + 1) % STAGES.length;
  const nextStage = STAGES[nextIdx].key;
  setDemoStatus(nextStage);
};

// Reset to Default (Verified)
window.resetDemoStatus = function() {
  setDemoStatus(initialStatus || 'Verified');
  showToast(`↺ Restored to standard record status: <strong>${initialStatus || 'Verified'}</strong>.`);
};

// ==========================================================================
// Embedded Leaflet Dark Mini Map
// ==========================================================================
function initMiniMap() {
  const mapEl = document.getElementById('rd-mini-map');
  if (!mapEl || typeof L === 'undefined') return;

  const lat = currentReport.lat || 28.5933;
  const lng = currentReport.lng || 77.2197;

  try {
    if (miniMap) {
      miniMap.remove();
    }

    miniMap = L.map('rd-mini-map', {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false
    }).setView([lat, lng], 16);

    // Dark CartoDB Tiles matching PathPulse theme
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(miniMap);

    // Pulsing custom marker
    const markerIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div class="rd-map-marker critical">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    currentMarker = L.marker([lat, lng], { icon: markerIcon }).addTo(miniMap);
    
    currentMarker.bindPopup(`
      <div style="font-family: 'Inter', sans-serif; font-size: 0.85rem; color: #FFFFFF; background: #12121A; padding: 4px;">
        <strong style="color: #F87171;">${currentReport.hazardType}</strong><br>
        <span style="font-size: 0.75rem; color: #A1A1AA;">${currentReport.location}</span><br>
        <span style="font-size: 0.75rem; font-family: 'JetBrains Mono', monospace; color: #F59E0B;">Risk Score: ${currentReport.riskScore}/100</span>
      </div>
    `);
  } catch (err) {
    console.warn('MiniMap initialization notice:', err);
  }
}

// ==========================================================================
// Event Listeners & Interactive Utilities
// ==========================================================================
function setupEventListeners() {
  // Toggle AI Bounding Box Overlay
  const toggleOverlayBtn = document.getElementById('btn-toggle-ai-overlay');
  const overlayBox = document.getElementById('rd-ai-overlay');
  if (toggleOverlayBtn && overlayBox) {
    toggleOverlayBtn.addEventListener('click', () => {
      overlayBox.classList.toggle('hidden');
      const isHidden = overlayBox.classList.contains('hidden');
      toggleOverlayBtn.innerHTML = isHidden 
        ? '<i class="fa-solid fa-eye"></i> Show AI Detection'
        : '<i class="fa-solid fa-eye-slash"></i> Hide AI Detection';
    });
  }

  // Lightbox modal toggle
  const imgContainer = document.getElementById('rd-image-container');
  const modal = document.getElementById('rd-lightbox-modal');
  const modalImg = document.getElementById('rd-lightbox-img');
  const modalCaption = document.getElementById('rd-lightbox-caption');

  if (imgContainer && modal && modalImg) {
    imgContainer.addEventListener('click', () => {
      modalImg.src = currentReport.image || '';
      if (modalCaption) {
        modalCaption.textContent = `${currentReport.hazardType} • ${currentReport.location} (${currentReport.coordinates || ''})`;
      }
      modal.classList.add('active');
    });
  }

  // Copy Report ID
  const copyBtn = document.getElementById('btn-copy-id');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(currentReport.id || 'RPT-1002');
      showToast(`<i class="fa-solid fa-clipboard-check"></i> Report ID <strong>${currentReport.id}</strong> copied to clipboard!`);
    });
  }

  // Community Upvote
  const upvoteBtn = document.getElementById('btn-upvote-hazard');
  if (upvoteBtn) {
    let hasUpvoted = false;
    upvoteBtn.addEventListener('click', () => {
      const upvotesEl = document.getElementById('rd-upvotes-count');
      if (!hasUpvoted) {
        hasUpvoted = true;
        currentReport.upvotes = (currentReport.upvotes || 14) + 1;
        if (upvotesEl) upvotesEl.textContent = currentReport.upvotes;
        upvoteBtn.innerHTML = '<i class="fa-solid fa-check"></i> Hazard Verified by You';
        upvoteBtn.style.background = 'rgba(16, 185, 129, 0.25)';
        showToast('<i class="fa-solid fa-circle-check"></i> Verification added! Your signal assists municipal prioritisation.');
      } else {
        showToast('You have already verified this hazard in this demo session.');
      }
    });
  }
}

// Switch main photo from thumbnail strip
window.selectThumbnail = function(thumbUrl, thumbEl) {
  const mainImg = document.getElementById('rd-main-image');
  if (mainImg) {
    mainImg.src = thumbUrl;
  }
  document.querySelectorAll('.rd-thumb').forEach(t => t.classList.remove('active'));
  if (thumbEl) thumbEl.classList.add('active');
};

// Close Lightbox
window.closeLightbox = function() {
  const modal = document.getElementById('rd-lightbox-modal');
  if (modal) modal.classList.remove('active');
};

// Share Report Link
window.shareReportDetails = function() {
  const url = window.location.href;
  navigator.clipboard.writeText(url);
  showToast('<i class="fa-solid fa-share-nodes"></i> Report link copied! Shareable hazard telemetry URL ready.');
};

// Toast Notification Engine
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('rd-toast');
  const toastMsg = document.getElementById('rd-toast-msg');
  if (!toast || !toastMsg) return;

  clearTimeout(toastTimer);
  toastMsg.innerHTML = message;
  toast.classList.add('show');

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3400);
}
