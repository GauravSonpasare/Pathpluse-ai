// ==========================================================================
// PathPulse AI - User Profile Script (js/profile.js)
// LocalStorage Persistence & Interactive Notification Panel
// ==========================================================================

const DEFAULT_PROFILE = {
  fullName: 'Alex Morgan',
  email: 'alex.morgan@pathpulse.ai',
  phone: '+91 98765 43210',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
  reportsSubmitted: 14,
  reportsResolved: 9
};

const DEFAULT_NOTIFICATIONS = [
  {
    id: 'NOTIF-01',
    title: 'Your report has been verified.',
    hazard: 'Open Manhole (RPT-1002)',
    desc: 'Automated AI severity audit verified at 92/100. Validated by 14 community pedestrian signals.',
    time: '2 hours ago',
    type: 'verified',
    unread: true,
    reportId: 'RPT-1002'
  },
  {
    id: 'NOTIF-02',
    title: 'Your report has been assigned.',
    hazard: 'Broken Footpath (RPT-1003)',
    desc: 'Dispatched to Central Ward 42 Sidewalk Maintenance Unit for contractor inspection.',
    time: 'Yesterday, 04:30 PM',
    type: 'assigned',
    unread: true,
    reportId: 'RPT-1003'
  },
  {
    id: 'NOTIF-03',
    title: 'Your report is now in progress.',
    hazard: 'Damaged Wheelchair Ramp (RPT-1005)',
    desc: 'Rapid response engineering squad on site. Safety perimeter barrier deployed.',
    time: '2 days ago',
    type: 'inprogress',
    unread: false,
    reportId: 'RPT-1005'
  },
  {
    id: 'NOTIF-04',
    title: 'Your reported hazard has been resolved.',
    hazard: 'Deep Crosswalk Pothole (RPT-1006)',
    desc: 'Bitumen surface reconstruction completed and pedestrian crossing marks restored.',
    time: '5 days ago',
    type: 'resolved',
    unread: false,
    reportId: 'RPT-1006'
  }
];

// Helpers: HTML Sanitizer and Relative Time Formatter
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Recent';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) return 'Just now';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

// Active State
let currentProfile = {};
let notifications = [];

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initProfilePage();
});

async function initProfilePage() {
  loadProfileData();
  await loadNotifications();
  renderProfileView();
  renderNotificationsList();
  setupEventListeners();
}

// ==========================================================================
// LocalStorage Persistence & Supabase Sync
// ==========================================================================
function loadProfileData() {
  try {
    const stored = localStorage.getItem('pathpulse_user_profile');
    if (stored) {
      currentProfile = JSON.parse(stored);
    } else {
      currentProfile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
      saveProfileToStorage();
    }

    // Recalculate submitted reports if local reports exist
    const userReports = JSON.parse(localStorage.getItem('pathpulse_reports') || '[]');
    if (userReports.length > 0) {
      currentProfile.reportsSubmitted = DEFAULT_PROFILE.reportsSubmitted + userReports.length;
    }
  } catch (err) {
    console.warn('Profile storage error:', err);
    currentProfile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  }

  // Live Supabase User & Profile check
  if (window.PathPulseSupabase && window.PathPulseSupabase.auth) {
    window.PathPulseSupabase.auth.getUser().then(u => {
      if (u) {
        currentProfile.email = u.email;
        if (window.PathPulseSupabase.profiles) {
          window.PathPulseSupabase.profiles.get(u.id).then(p => {
            if (p) {
              if (p.full_name) currentProfile.fullName = p.full_name;
              if (p.phone) currentProfile.phone = p.phone;
              if (p.avatar_url) currentProfile.avatarUrl = p.avatar_url;
              saveProfileToStorage();
              renderProfileView();
            }
          }).catch(() => {});
        }
        renderProfileView();
      }
    }).catch(() => {});
  }
}

function saveProfileToStorage() {
  try {
    localStorage.setItem('pathpulse_user_profile', JSON.stringify(currentProfile));
  } catch (err) {
    console.warn('Unable to write profile to localStorage:', err);
  }

  // Also sync to Supabase if authenticated
  if (window.PathPulseSupabase && window.PathPulseSupabase.auth && window.PathPulseSupabase.profiles) {
    window.PathPulseSupabase.auth.getUser().then(u => {
      if (u) {
        window.PathPulseSupabase.profiles.update(u.id, currentProfile)
          .then(() => console.log('✓ Profile synced to Supabase.'))
          .catch(e => console.info('Supabase profile sync note:', e.message));
      }
    }).catch(() => {});
  }
}

// Load notifications strictly for the authenticated user from Supabase
async function loadNotifications() {
  // 1. Initial fast local cache load
  try {
    const storedNotifs = localStorage.getItem('pathpulse_user_notifications');
    if (storedNotifs) {
      notifications = JSON.parse(storedNotifs);
    } else {
      notifications = JSON.parse(JSON.stringify(DEFAULT_NOTIFICATIONS));
    }
  } catch (err) {
    notifications = JSON.parse(JSON.stringify(DEFAULT_NOTIFICATIONS));
  }

  // 2. Fetch real notifications from Supabase for authenticated user
  if (window.PathPulseSupabase && window.PathPulseSupabase.auth && window.PathPulseSupabase.notifications) {
    try {
      const authUser = await window.PathPulseSupabase.auth.getUser();
      if (authUser && authUser.id) {
        console.log(`✓ Fetching notifications for authenticated user: ${authUser.id}`);
        const dbNotifs = await window.PathPulseSupabase.notifications.getAll(authUser.id);

        if (dbNotifs && dbNotifs.length > 0) {
          notifications = dbNotifs.map(dbN => {
            const msg = dbN.message || 'Notification';
            let type = 'verified';
            if (msg.toLowerCase().includes('verified')) type = 'verified';
            else if (msg.toLowerCase().includes('assigned')) type = 'assigned';
            else if (msg.toLowerCase().includes('progress')) type = 'inprogress';
            else if (msg.toLowerCase().includes('resolved')) type = 'resolved';
            else if (msg.toLowerCase().includes('rejected')) type = 'rejected';

            const shortReportId = dbN.report_id ? `Incident #${String(dbN.report_id).slice(0, 8)}` : 'Hazard Report';

            return {
              id: dbN.id,
              title: msg,
              hazard: shortReportId,
              desc: msg,
              time: formatRelativeTime(dbN.created_at),
              type: type,
              unread: !dbN.is_read,
              is_read: !!dbN.is_read,
              reportId: dbN.report_id || null,
              created_at: dbN.created_at
            };
          });

          saveNotificationsToStorage();
          renderNotificationsList();
        } else {
          // If the authenticated user has no notifications in Supabase yet, preserve example notifications
          // so the user can interact with all 4 example states specified in the design
          if (!localStorage.getItem('pathpulse_user_notifications')) {
            notifications = JSON.parse(JSON.stringify(DEFAULT_NOTIFICATIONS));
            saveNotificationsToStorage();
            renderNotificationsList();
          }
        }
      }
    } catch (err) {
      console.info('Supabase notification sync note:', err.message);
    }
  }
}

function saveNotificationsToStorage() {
  try {
    localStorage.setItem('pathpulse_user_notifications', JSON.stringify(notifications));
  } catch (err) {}
}

// ==========================================================================
// Render Profile UI
// ==========================================================================
function renderProfileView() {
  // Full Name
  const nameDisplay = document.getElementById('profile-display-name');
  const nameInput = document.getElementById('input-full-name');
  const topbarName = document.getElementById('topbar-user-name');
  if (nameDisplay) nameDisplay.textContent = currentProfile.fullName || 'Alex Morgan';
  if (nameInput) nameInput.value = currentProfile.fullName || 'Alex Morgan';
  if (topbarName) topbarName.textContent = currentProfile.fullName || 'Alex Morgan';

  // Email
  const emailDisplay = document.getElementById('profile-display-email');
  const emailInput = document.getElementById('input-email');
  if (emailDisplay) emailDisplay.textContent = currentProfile.email || 'alex.morgan@pathpulse.ai';
  if (emailInput) emailInput.value = currentProfile.email || 'alex.morgan@pathpulse.ai';

  // Phone Number
  const phoneDisplay = document.getElementById('profile-display-phone');
  const phoneInput = document.getElementById('input-phone');
  if (phoneDisplay) phoneDisplay.textContent = currentProfile.phone || '+91 98765 43210';
  if (phoneInput) phoneInput.value = currentProfile.phone || '+91 98765 43210';

  // Reports Counters
  const submittedEl = document.getElementById('stat-reports-submitted');
  const resolvedEl = document.getElementById('stat-reports-resolved');
  if (submittedEl) submittedEl.textContent = currentProfile.reportsSubmitted || 14;
  if (resolvedEl) resolvedEl.textContent = currentProfile.reportsResolved || 9;

  // Profile Picture
  updateAvatarDisplays(currentProfile.avatarUrl);
}

function updateAvatarDisplays(url) {
  const avatarImg = document.getElementById('profile-avatar-img');
  const topbarAvatar = document.getElementById('topbar-avatar-img');
  const fallback = document.getElementById('profile-avatar-fallback');

  if (url) {
    if (avatarImg) {
      avatarImg.src = url;
      avatarImg.style.display = 'block';
    }
    if (fallback) fallback.style.display = 'none';

    if (topbarAvatar) {
      topbarAvatar.src = url;
      topbarAvatar.style.display = 'block';
    }
  } else {
    // Show initials fallback
    const initials = (currentProfile.fullName || 'AM')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    if (avatarImg) avatarImg.style.display = 'none';
    if (fallback) {
      fallback.textContent = initials;
      fallback.style.display = 'flex';
    }
  }
}

// ==========================================================================
// Render Notification Panel
// ==========================================================================
function renderNotificationsList() {
  const container = document.getElementById('notifications-list-container');
  const unreadCountEl = document.getElementById('notif-unread-count');
  const topbarBadge = document.getElementById('topbar-notif-badge');
  if (!container) return;

  const unreadCount = notifications.filter(n => n.unread).length;
  if (unreadCountEl) unreadCountEl.textContent = `${unreadCount} unread`;
  if (topbarBadge) {
    topbarBadge.textContent = unreadCount;
    topbarBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
  }

  if (notifications.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="margin: 0; padding: 2.5rem 1rem;">
        <div class="empty-state-icon" style="width: 48px; height: 48px; font-size: 1.5rem; margin-bottom: 0.75rem;">
          <i class="fa-regular fa-bell-slash"></i>
        </div>
        <h4 class="empty-state-title" style="font-size: 1rem;">No notifications right now</h4>
        <p class="empty-state-desc" style="font-size: 0.85rem; margin-bottom: 0;">You are fully caught up! New incident triage updates and resolution notices will appear here.</p>
      </div>
    `;
    return;
  }

  let html = '';
  notifications.forEach(n => {
    let iconClass = 'fa-solid fa-bell';
    let typeClass = 'notif-verified';

    const t = (n.type || '').toLowerCase();
    const title = n.title || n.message || 'Notification';
    const desc = n.desc || n.message || '';

    if (t === 'verified' || title.toLowerCase().includes('verified')) {
      iconClass = 'fa-solid fa-circle-check';
      typeClass = 'notif-verified';
    } else if (t === 'assigned' || title.toLowerCase().includes('assigned')) {
      iconClass = 'fa-solid fa-clipboard-user';
      typeClass = 'notif-assigned';
    } else if (t === 'inprogress' || title.toLowerCase().includes('progress')) {
      iconClass = 'fa-solid fa-person-digging';
      typeClass = 'notif-inprogress';
    } else if (t === 'resolved' || title.toLowerCase().includes('resolved')) {
      iconClass = 'fa-solid fa-shield-check';
      typeClass = 'notif-resolved';
    } else if (t === 'rejected' || title.toLowerCase().includes('rejected')) {
      iconClass = 'fa-solid fa-ban';
      typeClass = 'notif-rejected';
    }

    const isUnread = n.unread !== undefined ? n.unread : !n.is_read;

    html += `
      <div class="notification-item ${isUnread ? 'unread' : ''} ${typeClass}" onclick="toggleNotificationRead('${n.id}')">
        <div class="notification-icon-wrap">
          <i class="${iconClass}"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">
            <span>${escapeHtml(title)}</span>
            <span class="notification-time">${escapeHtml(n.time || 'Recent')}</span>
          </div>
          <p class="notification-desc">${escapeHtml(desc)}</p>
          <div class="notification-meta" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <span class="notif-pill">${escapeHtml(n.hazard || 'Hazard Update')}</span>
            <div style="display: flex; gap: 8px; align-items: center;">
              ${n.reportId ? `
                <a href="report-details.html?id=${encodeURIComponent(n.reportId)}" style="color:#60A5FA; text-decoration:none; font-weight:500; font-size:0.75rem;" onclick="event.stopPropagation()">
                  View Incident <i class="fa-solid fa-arrow-right" style="font-size:0.65rem;"></i>
                </a>
              ` : ''}
              ${isUnread ? `
                <button type="button" class="btn-prof btn-prof-secondary" style="font-size:0.7rem; padding:2px 8px; border-radius:4px;" onclick="event.stopPropagation(); markNotificationAsRead('${n.id}')" title="Mark as read">
                  <i class="fa-solid fa-check"></i> Mark read
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Mark single notification as read & update is_read in Supabase
window.markNotificationAsRead = async function(id) {
  const notif = notifications.find(n => String(n.id) === String(id));
  if (!notif) return;

  notif.unread = false;
  notif.is_read = true;
  saveNotificationsToStorage();
  renderNotificationsList();

  // Persist to Supabase if valid UUID
  if (window.PathPulseSupabase && window.PathPulseSupabase.notifications) {
    try {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        await window.PathPulseSupabase.notifications.markAsRead(id);
        console.log(`✓ Notification ${id} marked as read in Supabase.`);
      }
    } catch (e) {
      console.info('Supabase markAsRead notice:', e.message);
    }
  }

  showToast('Notification marked as read.');
};

// Toggle read state for notification & update is_read in Supabase
window.toggleNotificationRead = async function(id) {
  const notif = notifications.find(n => String(n.id) === String(id));
  if (!notif) return;

  const currentRead = notif.is_read !== undefined ? notif.is_read : !notif.unread;
  const targetRead = !currentRead;

  notif.is_read = targetRead;
  notif.unread = !targetRead;
  saveNotificationsToStorage();
  renderNotificationsList();

  // Persist to Supabase if valid UUID
  if (window.PathPulseSupabase && window.PathPulseSupabase.notifications) {
    try {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        if (targetRead) {
          await window.PathPulseSupabase.notifications.markAsRead(id);
        } else {
          await window.PathPulseSupabase.notifications.toggleRead(id, true);
        }
      }
    } catch (e) {
      console.info('Supabase toggleRead notice:', e.message);
    }
  }
};

// Mark all notifications as read for current user in Supabase
window.markAllNotificationsRead = async function() {
  notifications.forEach(n => {
    n.unread = false;
    n.is_read = true;
  });
  saveNotificationsToStorage();
  renderNotificationsList();

  // Persist to Supabase
  if (window.PathPulseSupabase && window.PathPulseSupabase.notifications && window.PathPulseSupabase.auth) {
    try {
      const user = await window.PathPulseSupabase.auth.getUser();
      if (user && user.id) {
        await window.PathPulseSupabase.notifications.markAllAsRead(user.id);
        console.log(`✓ All notifications marked as read in Supabase for user ${user.id}.`);
      }
    } catch (e) {
      console.info('Supabase markAllAsRead notice:', e.message);
    }
  }

  showToast('All notifications marked as read.');
};

// ==========================================================================
// Event Listeners: Form Submission & Avatar Management
// ==========================================================================
function setupEventListeners() {
  // Profile Edit Form Submit
  const form = document.getElementById('profile-edit-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('input-full-name');
      const phoneInput = document.getElementById('input-phone');

      const newName = nameInput ? nameInput.value.trim() : '';
      const newPhone = phoneInput ? phoneInput.value.trim() : '';

      if (!newName) {
        if (nameInput) {
          nameInput.classList.add('is-invalid');
          nameInput.focus();
          nameInput.addEventListener('input', () => nameInput.classList.remove('is-invalid'), { once: true });
        }
        showToast('Please enter your full name.');
        return;
      }
      if (nameInput) nameInput.classList.remove('is-invalid');

      if (!newPhone) {
        if (phoneInput) {
          phoneInput.classList.add('is-invalid');
          phoneInput.focus();
          phoneInput.addEventListener('input', () => phoneInput.classList.remove('is-invalid'), { once: true });
        }
        showToast('Please provide a valid contact phone number.');
        return;
      }
      if (phoneInput) phoneInput.classList.remove('is-invalid');

      // Update State
      currentProfile.fullName = newName;
      currentProfile.phone = newPhone;

      // Save to localStorage
      saveProfileToStorage();

      // Re-render UI
      renderProfileView();

      showToast('<i class="fa-solid fa-circle-check" style="color:#10B981;"></i> Profile changes saved to local storage!');
    });
  }

  // Open Avatar Modal
  const avatarChangeBtns = document.querySelectorAll('.btn-trigger-avatar-modal');
  const avatarModal = document.getElementById('avatar-modal');
  avatarChangeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (avatarModal) avatarModal.classList.add('active');
    });
  });

  // Close Avatar Modal
  const closeAvatarBtn = document.getElementById('btn-close-avatar-modal');
  if (closeAvatarBtn && avatarModal) {
    closeAvatarBtn.addEventListener('click', () => {
      avatarModal.classList.remove('active');
    });
  }

  // Avatar Presets Click
  const presetButtons = document.querySelectorAll('.avatar-preset-btn');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedUrl = btn.getAttribute('data-url');
      if (selectedUrl) {
        currentProfile.avatarUrl = selectedUrl;
        saveProfileToStorage();
        updateAvatarDisplays(selectedUrl);
        if (avatarModal) avatarModal.classList.remove('active');
        showToast('Profile picture updated successfully!');
      }
    });
  });

  // Custom File Upload Trigger
  const fileInput = document.getElementById('avatar-file-input');
  const uploadZone = document.getElementById('avatar-upload-zone');
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];

        // 1. Read preview immediately
        const reader = new FileReader();
        reader.onload = function(event) {
          const dataUrl = event.target.result;
          currentProfile.avatarUrl = dataUrl;
          saveProfileToStorage();
          updateAvatarDisplays(dataUrl);
          if (avatarModal) avatarModal.classList.remove('active');
          showToast('Custom photo uploaded and saved to profile!');
        };
        reader.readAsDataURL(file);

        // 2. Upload to Supabase Storage avatars bucket
        if (window.PathPulseSupabase && window.PathPulseSupabase.storage) {
          try {
            const publicUrl = await window.PathPulseSupabase.storage.uploadAvatar(file);
            if (publicUrl) {
              currentProfile.avatarUrl = publicUrl;
              saveProfileToStorage();
              updateAvatarDisplays(publicUrl);
            }
          } catch (err) {
            console.info('Supabase avatar storage notice:', err.message);
          }
        }
      }
    });
  }

  // Mobile menu toggle
  const mobileToggleBtn = document.getElementById('btn-profile-mobile-toggle');
  const sidebar = document.getElementById('profile-sidebar');
  if (mobileToggleBtn && sidebar) {
    mobileToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

// ==========================================================================
// Toast Helper
// ==========================================================================
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('profile-toast');
  const msgEl = document.getElementById('profile-toast-msg');
  if (!toast || !msgEl) return;

  clearTimeout(toastTimer);
  msgEl.innerHTML = message;
  toast.classList.add('show');

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}
