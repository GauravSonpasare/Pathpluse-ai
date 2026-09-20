// ==========================================================================
// PathPulse AI - Citizen Dashboard Controller (js/dashboard.js)
// Production Integration with Supabase Database
// ==========================================================================

let userReports = [];
let currentFilter = 'all';
let currentSearchTerm = '';
let safetyChartInstance = null;

// Helper: Escape HTML strings safely
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper: Format category slug into human-readable label
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
  return map[catKey] || (catKey ? catKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Hazard');
}

// Helper: Format status slug into label and badge class
function formatStatusMeta(statusKey) {
  const s = (statusKey || 'reported').toLowerCase().replace(/\s+/g, '_');
  switch (s) {
    case 'reported':
      return { label: 'Reported', icon: 'fa-paper-plane', badgeClass: 'badge-status-reported' };
    case 'under_review':
      return { label: 'Under Review', icon: 'fa-clock', badgeClass: 'badge-warning' };
    case 'verified':
      return { label: 'Verified', icon: 'fa-circle-check', badgeClass: 'badge-status-verified' };
    case 'assigned':
      return { label: 'Assigned', icon: 'fa-clipboard-user', badgeClass: 'badge-status-inprogress' };
    case 'in_progress':
      return { label: 'In Progress', icon: 'fa-person-digging', badgeClass: 'badge-status-inprogress' };
    case 'resolved':
      return { label: 'Resolved', icon: 'fa-circle-check', badgeClass: 'badge-status-resolved' };
    case 'rejected':
      return { label: 'Rejected', icon: 'fa-circle-xmark', badgeClass: 'badge-danger' };
    default:
      return { label: statusKey || 'Reported', icon: 'fa-clock', badgeClass: 'badge-status-reported' };
  }
}

// Helper: Format severity slug into badge
function formatSeverityMeta(sevKey) {
  const s = (sevKey || 'low').toLowerCase();
  switch (s) {
    case 'critical':
      return { label: 'Critical', badgeClass: 'badge-danger', color: '#EF4444' };
    case 'high':
      return { label: 'High', badgeClass: 'badge-warning', color: '#F59E0B' };
    case 'medium':
    case 'moderate':
      return { label: 'Medium', badgeClass: 'badge-info', color: '#06B6D4' };
    case 'low':
    default:
      return { label: 'Low', badgeClass: 'badge-success', color: '#10B981' };
  }
}

// Helper: Format ISO date string into readable short date
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

// ==============================================================================
// 1. INITIALIZE DASHBOARD & AUTH SESSION
// ==============================================================================
async function initDashboard() {
  setupMobileSidebar();
  setupNotificationToggle();
  setupFilterListeners();
  setupSearchListener();

  // Show loading indicator in stats and reports container
  setStatsLoadingState();
  setReportsLoadingState();

  // Check authenticated user
  const currentUser = await getCurrentUser();
  if (currentUser) {
    renderUserHeader(currentUser);
  }

  // Fetch live reports from Supabase
  await fetchUserReports(currentUser);

  // Load live notifications from Supabase
  await loadDashboardNotifications(currentUser);
}

// Get authenticated user from Supabase or localStorage
async function getCurrentUser() {
  if (window.PathPulseSupabase && window.PathPulseSupabase.auth) {
    try {
      const authUser = await window.PathPulseSupabase.auth.getUser();
      if (authUser && authUser.id) {
        return {
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
          role: authUser.user_metadata?.role || 'user'
        };
      }
    } catch (e) {
      console.warn('Supabase auth user check notice:', e);
    }
  }

  const storedUser = localStorage.getItem('pathpulse_user');
  if (storedUser) {
    try {
      return JSON.parse(storedUser);
    } catch (e) {}
  }

  return null;
}

// Render user name and avatar initials in header
function renderUserHeader(user) {
  const welcomeEl = document.getElementById('topbar-user-name');
  const avatarEl = document.getElementById('user-avatar-initials');

  const displayName = user.name || (user.email ? user.email.split('@')[0] : 'Citizen');
  if (welcomeEl) {
    welcomeEl.textContent = `Welcome back, ${displayName}`;
  }

  if (avatarEl) {
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    avatarEl.textContent = initials || 'AX';
  }
}

// ==============================================================================
// 2. FETCH CURRENT USER'S REPORTS FROM SUPABASE
// ==============================================================================
async function fetchUserReports(user) {
  try {
    let rawReports = [];

    // 1. Query Supabase reports table for current user
    if (window.PathPulseSupabase && window.PathPulseSupabase.client && user && user.id) {
      const _supabase = window.PathPulseSupabase.client;
      const { data, error } = await _supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase reports fetch error:', error);
        throw error;
      }

      rawReports = data || [];
      console.log(`✓ Retrieved ${rawReports.length} user reports from Supabase.`);
    } else {
      // Fallback: If unauthenticated, retrieve stored local reports
      const localReports = JSON.parse(localStorage.getItem('pathpulse_reports') || '[]');
      rawReports = localReports;
    }

    userReports = rawReports;

    // 2. Calculate and render the 5 statistics
    calculateAndRenderStatistics(userReports);

    // 3. Render reports list (or empty state)
    renderReportsList();

    // 4. Update Safety Overview Chart
    updateSafetyChart(userReports);

  } catch (err) {
    console.error('Dashboard data load error:', err);
    renderDatabaseErrorState(err);
  }
}

// ==============================================================================
// 3. CALCULATE & RENDER THE 5 DASHBOARD STATISTICS
// ==============================================================================
function calculateAndRenderStatistics(reports) {
  const list = reports || [];

  // 1. Total Reports
  const totalCount = list.length;

  // 2. Reported (Pending triage)
  const reportedCount = list.filter(r => {
    const s = (r.status || '').toLowerCase().replace(/\s+/g, '_');
    return s === 'reported';
  }).length;

  // 3. Under Review
  const underReviewCount = list.filter(r => {
    const s = (r.status || '').toLowerCase().replace(/\s+/g, '_');
    return s === 'under_review' || s === 'under review';
  }).length;

  // 4. High Risk (Severity High or Critical, or Risk Score >= 70)
  const highRiskCount = list.filter(r => {
    const sev = (r.severity || '').toLowerCase();
    const score = Number(r.risk_score || r.riskScore || 0);
    return sev === 'high' || sev === 'critical' || score >= 70;
  }).length;

  // 5. Resolved
  const resolvedCount = list.filter(r => {
    const s = (r.status || '').toLowerCase().replace(/\s+/g, '_');
    return s === 'resolved';
  }).length;

  // Update DOM elements with calculated numbers
  updateStatValue('stat-total-reports', totalCount);
  updateStatValue('stat-reported', reportedCount);
  updateStatValue('stat-under-review', underReviewCount);
  updateStatValue('stat-high-risk', highRiskCount);
  updateStatValue('stat-resolved', resolvedCount);

  // Update sidebar counter badge
  const sidebarBadge = document.getElementById('sidebar-reports-count');
  if (sidebarBadge) {
    sidebarBadge.textContent = totalCount;
  }
}

function updateStatValue(elementId, count) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = count;
  }
}

// Loading state placeholders for stat numbers
function setStatsLoadingState() {
  const statIds = ['stat-total-reports', 'stat-reported', 'stat-under-review', 'stat-high-risk', 'stat-resolved'];
  statIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size: 1.2rem; color: #F59E0B;"></i>';
    }
  });
}

// Loading state for report cards grid
function setReportsLoadingState() {
  const container = document.getElementById('recent-reports-container');
  if (container) {
    container.innerHTML = `
      <div class="reports-loading-skeleton" style="grid-column: 1 / -1; text-align: center; padding: 56px 20px;">
        <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color: #F59E0B; margin-bottom: 14px;"></i>
        <div style="font-size: 1.05rem; font-weight: 600; color: #FFFFFF;">Loading your reports from Supabase...</div>
        <div style="font-size: 0.84rem; color: #71717A; margin-top: 4px;">Retrieving verified civic safety tickets</div>
      </div>
    `;
  }
}

// ==============================================================================
// 4. RENDER RECENT REPORTS LIST & EMPTY STATES
// ==============================================================================
function renderReportsList() {
  const container = document.getElementById('recent-reports-container');
  if (!container) return;

  // --------------------------------------------------------------------------
  // EMPTY STATE: User hasn't reported any hazards yet
  // --------------------------------------------------------------------------
  if (!userReports || userReports.length === 0) {
    container.innerHTML = `
      <div class="reports-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 56px 24px; background: rgba(18, 18, 28, 0.65); border: 1px dashed rgba(255, 255, 255, 0.12); border-radius: 16px; backdrop-filter: blur(10px);">
        <div style="width: 58px; height: 58px; border-radius: 14px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 1.5rem; color: #F59E0B;">
          <i class="fa-solid fa-clipboard-list"></i>
        </div>
        <h4 style="font-family: var(--font-heading); font-size: 1.35rem; font-weight: 700; color: #FFFFFF; margin-bottom: 8px;">
          You haven't reported any hazards yet.
        </h4>
        <p style="color: #A1A1AA; font-size: 0.92rem; max-width: 440px; margin: 0 auto 24px auto; line-height: 1.5;">
          Notice broken pavements, potholes, or open stormwater drains? Submit your first report to protect pedestrians and notify maintenance crews.
        </p>
        <a href="report.html" class="btn btn-primary btn-lg" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>Report a Hazard</span>
        </a>
      </div>
    `;
    return;
  }

  // --------------------------------------------------------------------------
  // FILTERING & SEARCH
  // --------------------------------------------------------------------------
  const filtered = userReports.filter(r => {
    const statusNorm = (r.status || '').toLowerCase().replace(/\s+/g, '_');
    const sevNorm = (r.severity || '').toLowerCase();
    const score = Number(r.risk_score || r.riskScore || 0);

    // Tab filter
    if (currentFilter === 'critical') {
      if (!(sevNorm === 'critical' || sevNorm === 'high' || score >= 70)) return false;
    } else if (currentFilter === 'inprogress') {
      if (!(statusNorm === 'in_progress' || statusNorm === 'assigned' || statusNorm === 'reported' || statusNorm === 'under_review')) return false;
    } else if (currentFilter === 'resolved') {
      if (statusNorm !== 'resolved') return false;
    }

    // Search query filter
    if (currentSearchTerm) {
      const term = currentSearchTerm.toLowerCase();
      const title = (r.title || r.hazardType || '').toLowerCase();
      const addr = (r.address || r.location || '').toLowerCase();
      const cat = (r.category || '').toLowerCase();
      const id = (r.id || '').toLowerCase();
      if (!title.includes(term) && !addr.includes(term) && !cat.includes(term) && !id.includes(term)) {
        return false;
      }
    }

    return true;
  });

  // Filter returned no matches
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 48px 20px;">
        <div class="empty-state-icon" style="font-size: 2rem; color: #71717A; margin-bottom: 12px;">
          <i class="fa-solid fa-filter-circle-xmark"></i>
        </div>
        <h4 class="empty-state-title" style="color: #FFFFFF; font-size: 1.15rem; margin-bottom: 6px;">No matching hazard reports</h4>
        <p class="empty-state-desc" style="color: #71717A; font-size: 0.88rem; max-width: 400px; margin: 0 auto 18px auto;">
          No reports match your active filter "${escapeHtml(currentFilter)}" or search keyword.
        </p>
        <button type="button" class="btn btn-outline btn-sm" onclick="resetDashboardFilters()">
          <i class="fa-solid fa-rotate-left"></i>
          <span>Reset Filters</span>
        </button>
      </div>
    `;
    return;
  }

  // --------------------------------------------------------------------------
  // RENDER REPORT CARDS
  // Clicking a report opens report-details.html?id=REPORT_ID
  // --------------------------------------------------------------------------
  container.innerHTML = filtered.map(report => {
    const reportId = report.id;
    const hazardTitle = report.title || formatCategoryLabel(report.category);
    const riskScore = report.risk_score !== undefined ? report.risk_score : (report.riskScore || 70);
    const sevMeta = formatSeverityMeta(report.severity);
    const statusMeta = formatStatusMeta(report.status);
    const displayDate = formatDisplayDate(report.created_at || report.date);
    const locationAddress = report.address || report.location || report.location_address || 'Pedestrian Walking Pathway';
    
    // Choose hazard icon
    let hazardIcon = 'fa-triangle-exclamation';
    const catLower = (report.category || '').toLowerCase();
    if (catLower.includes('manhole')) hazardIcon = 'fa-circle-exclamation';
    else if (catLower.includes('footpath') || catLower.includes('pavement')) hazardIcon = 'fa-road-barrier';
    else if (catLower.includes('water')) hazardIcon = 'fa-water';
    else if (catLower.includes('ramp')) hazardIcon = 'fa-wheelchair';
    else if (catLower.includes('garbage')) hazardIcon = 'fa-trash';

    // Short display ID for ticket chip
    const shortId = (typeof reportId === 'string' && reportId.length > 12) 
      ? ('RPT-' + reportId.slice(0, 4).toUpperCase()) 
      : reportId;

    return `
      <div 
        class="hazard-report-card" 
        onclick="window.location.href='report-details.html?id=${encodeURIComponent(reportId)}'"
        style="cursor: pointer;"
        title="Click to view full details for ${escapeHtml(hazardTitle)}"
      >
        <div class="card-top-status">
          <span class="badge ${sevMeta.badgeClass}">
            <i class="fa-solid fa-triangle-exclamation"></i>
            ${sevMeta.label}
          </span>
          <span class="badge ${statusMeta.badgeClass}">
            <i class="fa-solid ${statusMeta.icon}"></i>
            ${statusMeta.label}
          </span>
        </div>

        <h3 class="card-hazard-type">
          <i class="fa-solid ${hazardIcon}" style="color: ${sevMeta.color}; font-size: 1.1rem;"></i>
          <span>${escapeHtml(hazardTitle)}</span>
        </h3>

        <div class="card-location-row" title="${escapeHtml(locationAddress)}">
          <i class="fa-solid fa-location-dot" style="color: #F87171;"></i>
          <span>${escapeHtml(locationAddress)}</span>
        </div>

        <div class="card-score-gauge-row">
          <div>
            <div class="score-title-text">Risk Score</div>
            <div style="font-size: 0.72rem; color: #71717A;">AI evaluated</div>
          </div>
          <div class="score-value-bold" style="color: ${sevMeta.color};">
            ${riskScore}<span style="font-size: 0.85rem; color: #71717A;">/100</span>
          </div>
        </div>

        <div class="card-date-meta">
          <i class="fa-regular fa-calendar"></i>
          <span>${escapeHtml(displayDate)}</span>
          <span style="color: rgba(255,255,255,0.15);">·</span>
          <span>${escapeHtml(shortId)}</span>
        </div>

        <div class="card-footer-action">
          <a 
            href="report-details.html?id=${encodeURIComponent(reportId)}" 
            class="btn-view-details"
            onclick="event.stopPropagation();"
            style="text-decoration: none;"
          >
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
            <span>View Details</span>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// ==============================================================================
// 5. DATABASE ERROR HANDLING
// ==============================================================================
function renderDatabaseErrorState(error) {
  const container = document.getElementById('recent-reports-container');
  if (!container) return;

  container.innerHTML = `
    <div class="reports-error-state" style="grid-column: 1 / -1; text-align: center; padding: 48px 24px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 16px;">
      <i class="fa-solid fa-triangle-exclamation fa-2x" style="color: #EF4444; margin-bottom: 12px;"></i>
      <h4 style="color: #FFFFFF; font-size: 1.15rem; margin-bottom: 6px;">Unable to load reports from database</h4>
      <p style="color: #F87171; font-size: 0.88rem; max-width: 480px; margin: 0 auto 18px auto;">
        ${escapeHtml(error.message || 'A network error occurred while connecting to Supabase.')}
      </p>
      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
        <button type="button" class="btn btn-outline btn-sm" onclick="initDashboard()" style="display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-arrows-rotate"></i>
          <span>Retry Connection</span>
        </button>
        <a href="report.html" class="btn btn-primary btn-sm" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-plus"></i>
          <span>Report a Hazard</span>
        </a>
      </div>
    </div>
  `;

  // Set default 0 stats on error
  updateStatValue('stat-total-reports', 0);
  updateStatValue('stat-reported', 0);
  updateStatValue('stat-under-review', 0);
  updateStatValue('stat-high-risk', 0);
  updateStatValue('stat-resolved', 0);
}

// ==============================================================================
// 6. FILTER & SEARCH HANDLERS
// ==============================================================================
function setupFilterListeners() {
  const filterBtns = document.querySelectorAll('.filter-pill-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter') || 'all';
      renderReportsList();
    });
  });
}

function setupSearchListener() {
  const searchInput = document.getElementById('report-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value.trim();
      renderReportsList();
    });
  }
}

function resetDashboardFilters() {
  currentFilter = 'all';
  currentSearchTerm = '';
  
  const searchInput = document.getElementById('report-search-input');
  if (searchInput) searchInput.value = '';

  const filterBtns = document.querySelectorAll('.filter-pill-btn');
  filterBtns.forEach(btn => {
    if (btn.getAttribute('data-filter') === 'all') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderReportsList();
}

// ==============================================================================
// 7. SAFETY OVERVIEW CHART (Chart.js)
// ==============================================================================
function initSafetyOverviewChart() {
  const canvas = document.getElementById('safetyOverviewChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const ctx = canvas.getContext('2d');
  
  safetyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Walking Safety Index',
          data: [78, 81, 79, 83, 82, 85, 84],
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointBackgroundColor: '#10B981',
          pointRadius: 3
        },
        {
          label: 'Active Risk Threshold',
          data: [45, 42, 40, 38, 35, 34, 32],
          borderColor: '#F59E0B',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(14, 14, 24, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10,
          titleColor: '#FFFFFF',
          bodyColor: '#A1A1AA'
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#71717A', font: { size: 11 } }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#71717A', font: { size: 11 } }
        }
      }
    }
  });
}

function updateSafetyChart(reports) {
  if (!safetyChartInstance) {
    initSafetyOverviewChart();
  }
}

// ==============================================================================
// 8. SIDEBAR & NAVIGATION CONTROLS
// ==============================================================================
function setupMobileSidebar() {
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebar = document.getElementById('dash-sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (toggleBtn && sidebar && overlay) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('active');
    });
  }
}

function setupNotificationToggle() {
  const notifBtn = document.getElementById('notif-btn');
  const notifMenu = document.getElementById('notif-dropdown-menu');

  if (notifBtn && notifMenu) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      notifMenu.classList.remove('show');
    });
  }
}

// Sign out from Supabase & clear storage
async function handleDashboardLogout() {
  if (window.PathPulseSupabase && window.PathPulseSupabase.auth) {
    try {
      await window.PathPulseSupabase.auth.signOut();
    } catch (e) {
      console.warn('Dashboard signout note:', e);
    }
  }
  localStorage.removeItem('pathpulse_logged_in');
  localStorage.removeItem('pathpulse_user');
  localStorage.removeItem('pathpulse_user_profile');
  window.location.href = 'login.html';
}

// ==============================================================================
// 10. DASHBOARD NOTIFICATIONS (Supabase Integration)
// ==============================================================================
let dashboardNotifications = [];

async function loadDashboardNotifications(user) {
  const dot = document.getElementById('dashboard-notif-dot');
  const titleEl = document.getElementById('dashboard-notif-title');
  const listEl = document.getElementById('dashboard-notif-list');
  if (!listEl) return;

  if (user && user.id && window.PathPulseSupabase && window.PathPulseSupabase.notifications) {
    try {
      const dbNotifs = await window.PathPulseSupabase.notifications.getAll(user.id);
      if (dbNotifs && dbNotifs.length > 0) {
        dashboardNotifications = dbNotifs.map(n => ({
          id: n.id,
          message: n.message || 'Hazard alert',
          is_read: !!n.is_read,
          reportId: n.report_id,
          time: formatDisplayDate(n.created_at)
        }));
      }
    } catch (e) {
      console.info('Dashboard notifications load notice:', e.message);
    }
  }

  const unreadCount = dashboardNotifications.filter(n => !n.is_read).length;

  if (dot) {
    dot.style.display = unreadCount > 0 ? 'block' : 'none';
  }
  if (titleEl) {
    titleEl.textContent = unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications';
  }

  if (dashboardNotifications.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 16px 8px; color: #71717A; font-size: 0.8rem;">
        <i class="fa-regular fa-bell-slash" style="font-size: 1.2rem; margin-bottom: 6px; display: block; color: #F59E0B;"></i>
        You are all caught up! No notifications.
      </div>
    `;
    return;
  }

  listEl.innerHTML = dashboardNotifications.slice(0, 5).map(n => {
    let icon = 'fa-solid fa-triangle-exclamation';
    let iconColor = '#F59E0B';
    const msgLower = (n.message || '').toLowerCase();
    if (msgLower.includes('verified')) {
      icon = 'fa-solid fa-circle-check';
      iconColor = '#10B981';
    } else if (msgLower.includes('assigned')) {
      icon = 'fa-solid fa-clipboard-user';
      iconColor = '#38BDF8';
    } else if (msgLower.includes('progress')) {
      icon = 'fa-solid fa-person-digging';
      iconColor = '#F59E0B';
    } else if (msgLower.includes('resolved')) {
      icon = 'fa-solid fa-shield-check';
      iconColor = '#34D399';
    } else if (msgLower.includes('rejected')) {
      icon = 'fa-solid fa-ban';
      iconColor = '#EF4444';
    }

    return `
      <div class="notif-item" style="cursor: pointer; ${!n.is_read ? 'background: rgba(245, 158, 11, 0.08); border-left: 2px solid #F59E0B;' : ''}" onclick="handleDashboardNotifClick('${n.id}', '${n.reportId || ''}')">
        <i class="${icon}" style="color: ${iconColor};"></i>
        <div style="flex: 1;">
          <div style="color: #FFF; font-weight: ${!n.is_read ? '600' : '400'}; font-size: 0.82rem;">${escapeHtml(n.message)}</div>
          <div style="font-size: 0.72rem; color: #71717A; font-family: 'JetBrains Mono', monospace; margin-top: 2px;">${n.time}</div>
        </div>
      </div>
    `;
  }).join('');
}

async function handleDashboardNotifClick(id, reportId) {
  const notif = dashboardNotifications.find(n => String(n.id) === String(id));
  if (notif && !notif.is_read) {
    notif.is_read = true;
    if (window.PathPulseSupabase && window.PathPulseSupabase.notifications) {
      try {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          await window.PathPulseSupabase.notifications.markAsRead(id);
        }
      } catch (e) {}
    }
    const currentUser = await getCurrentUser();
    loadDashboardNotifications(currentUser);
  }
  if (reportId) {
    window.location.href = `report-details.html?id=${encodeURIComponent(reportId)}`;
  } else {
    window.location.href = 'profile.html#notification-panel-section';
  }
}

async function markAllDashboardNotificationsRead() {
  const currentUser = await getCurrentUser();
  dashboardNotifications.forEach(n => { n.is_read = true; });
  const dot = document.getElementById('dashboard-notif-dot');
  const titleEl = document.getElementById('dashboard-notif-title');
  if (dot) dot.style.display = 'none';
  if (titleEl) titleEl.textContent = 'Notifications';

  if (currentUser && currentUser.id && window.PathPulseSupabase && window.PathPulseSupabase.notifications) {
    try {
      await window.PathPulseSupabase.notifications.markAllAsRead(currentUser.id);
      console.log('✓ All notifications marked as read.');
    } catch (e) {}
  }
  loadDashboardNotifications(currentUser);
}

// Global exports for inline HTML handlers
window.handleDashboardLogout = handleDashboardLogout;
window.resetDashboardFilters = resetDashboardFilters;
window.initDashboard = initDashboard;
window.handleDashboardNotifClick = handleDashboardNotifClick;
window.markAllDashboardNotificationsRead = markAllDashboardNotificationsRead;

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});
