// ==========================================
// PathPulse AI - Core Application JavaScript
// ==========================================

// Global Namespace for Sample Data and Configurations
window.PathPulse = window.PathPulse || {};

// Sample Data Store
PathPulse.categories = [
  { name: 'Pothole', icon: 'fas fa-exclamation-circle', color: '#D97706' },
  { name: 'Open Manhole', icon: 'fas fa-skull-crossbones', color: '#DC2626' },
  { name: 'Broken Footpath', icon: 'fas fa-road', color: '#7C3AED' },
  { name: 'Waterlogging', icon: 'fas fa-water', color: '#2563EB' },
  { name: 'Garbage Blocking Path', icon: 'fas fa-trash', color: '#52525B' },
  { name: 'Damaged Wheelchair Ramp', icon: 'fas fa-wheelchair', color: '#059669' }
];

PathPulse.cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune', 'Hyderabad', 'Kolkata'];

PathPulse.sampleReports = [
  {
    id: 'RPT-1001',
    title: 'Large pothole on MG Road',
    category: 'Pothole',
    severity: 'High',
    status: 'Pending',
    description: 'A large pothole approximately 2 feet wide, very dangerous for two-wheelers especially during night.',
    address: 'MG Road, near Café Coffee Day',
    city: 'Mumbai',
    pincode: '400001',
    lat: 18.9388,
    lng: 72.8354,
    date: '2026-09-15',
    time: '10:30 AM',
    reportedBy: 'Shubham Kumar',
    photos: [],
    aiAnalysis: {
      severity: 'High',
      category: 'Pothole',
      confidence: 87,
      similarReports: 3,
      priority: 'Urgent'
    },
    timeline: [
      { event: 'Report Submitted', date: '2026-09-15 10:30 AM', status: 'completed' },
      { event: 'Under Review', date: '2026-09-15 2:00 PM', status: 'completed' },
      { event: 'Assigned to Team', date: '2026-09-16 9:00 AM', status: 'current' }
    ]
  },
  {
    id: 'RPT-1002',
    title: 'Open Manhole near Park',
    category: 'Open Manhole',
    severity: 'Critical',
    status: 'In Progress',
    description: 'Cover is completely missing. Someone placed a tree branch in it as a warning.',
    address: 'Lodhi Gardens West Gate',
    city: 'Delhi',
    pincode: '110003',
    lat: 28.5933,
    lng: 77.2197,
    date: '2026-09-16',
    time: '08:15 AM',
    reportedBy: 'Rahul Sharma',
    photos: [],
    aiAnalysis: {
      severity: 'Critical',
      category: 'Open Manhole',
      confidence: 95,
      similarReports: 1,
      priority: 'Immediate Action Required'
    },
    timeline: [
      { event: 'Report Submitted', date: '2026-09-16 08:15 AM', status: 'completed' },
      { event: 'Assigned to Team', date: '2026-09-16 09:30 AM', status: 'completed' },
      { event: 'Work Started', date: '2026-09-16 11:00 AM', status: 'current' }
    ]
  },
  {
    id: 'RPT-1003',
    title: 'Broken Footpath outside Metro Station',
    category: 'Broken Footpath',
    severity: 'Medium',
    status: 'Resolved',
    description: 'Tiles are loose and jutting out, creating a tripping hazard.',
    address: 'Indiranagar Metro Station',
    city: 'Bangalore',
    pincode: '560038',
    lat: 12.9784,
    lng: 77.6408,
    date: '2026-09-10',
    time: '06:45 PM',
    reportedBy: 'Priya Patel',
    photos: [],
    aiAnalysis: {
      severity: 'Medium',
      category: 'Broken Footpath',
      confidence: 91,
      similarReports: 5,
      priority: 'Normal'
    },
    timeline: [
      { event: 'Report Submitted', date: '2026-09-10 06:45 PM', status: 'completed' },
      { event: 'Assigned to Team', date: '2026-09-11 10:00 AM', status: 'completed' },
      { event: 'Resolved', date: '2026-09-14 04:00 PM', status: 'completed' }
    ]
  },
  {
    id: 'RPT-1004',
    title: 'Severe Waterlogging after Rain',
    category: 'Waterlogging',
    severity: 'High',
    status: 'Pending',
    description: 'Knee-deep water making it impossible to cross the road.',
    address: 'T Nagar Main Road',
    city: 'Chennai',
    pincode: '600017',
    lat: 13.0405,
    lng: 80.2337,
    date: '2026-09-19',
    time: '04:20 PM',
    reportedBy: 'Anita Desai',
    photos: [],
    aiAnalysis: {
      severity: 'High',
      category: 'Waterlogging',
      confidence: 89,
      similarReports: 12,
      priority: 'Urgent'
    },
    timeline: [
      { event: 'Report Submitted', date: '2026-09-19 04:20 PM', status: 'completed' }
    ]
  },
  {
    id: 'RPT-1005',
    title: 'Damaged Ramp at Hospital Entrance',
    category: 'Damaged Wheelchair Ramp',
    severity: 'Medium',
    status: 'Rejected',
    description: 'The edge of the ramp is chipped.',
    address: 'Apollo Hospital',
    city: 'Hyderabad',
    pincode: '500033',
    lat: 17.4172,
    lng: 78.4068,
    date: '2026-09-12',
    time: '11:10 AM',
    reportedBy: 'Vikram Singh',
    photos: [],
    aiAnalysis: {
      severity: 'Low',
      category: 'Broken Footpath',
      confidence: 78,
      similarReports: 0,
      priority: 'Low'
    },
    timeline: [
      { event: 'Report Submitted', date: '2026-09-12 11:10 AM', status: 'completed' },
      { event: 'Rejected (Private Property)', date: '2026-09-13 10:00 AM', status: 'completed' }
    ]
  }
];

PathPulse.sampleUsers = [
  { id: 'USR-001', name: 'Shubham Kumar', email: 'shubham@example.com', phone: '+91 98765 43210', city: 'Mumbai', joinDate: '2026-09-01', reportsCount: 24, role: 'admin' },
  { id: 'USR-002', name: 'Rahul Sharma', email: 'rahul@example.com', phone: '+91 98765 11111', city: 'Delhi', joinDate: '2026-08-15', reportsCount: 12, role: 'user' },
  { id: 'USR-003', name: 'Priya Patel', email: 'priya@example.com', phone: '+91 98765 22222', city: 'Bangalore', joinDate: '2026-07-20', reportsCount: 5, role: 'user' }
];

PathPulse.currentUser = PathPulse.sampleUsers[0];

// ==========================================
// Utility Functions
// ==========================================

// Display a toast notification
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  
  // Set styles based on type
  let bgColor = '#F59E0B'; // info (blue)
  let icon = 'fas fa-info-circle';
  if (type === 'success') { bgColor = '#22C55E'; icon = 'fas fa-check-circle'; }
  else if (type === 'error') { bgColor = '#EF4444'; icon = 'fas fa-exclamation-circle'; }
  else if (type === 'warning') { bgColor = '#F59E0B'; icon = 'fas fa-exclamation-triangle'; }

  toast.style.cssText = `
    background-color: ${bgColor}; 
    color: white; 
    padding: 12px 20px; 
    border-radius: 8px; 
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    display: flex; 
    align-items: center; 
    gap: 10px;
    font-family: 'Inter', sans-serif;
    transform: translateX(100%);
    opacity: 0;
    transition: all 0.3s ease;
  `;

  toast.innerHTML = `<i class="${icon}"></i> <span>${message}</span>`;
  toastContainer.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  }, 10);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Show custom confirmation modal
function showModal(title, content, onConfirm, onCancel) {
  const modalHTML = `
    <div id="custom-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; font-family: 'Inter', sans-serif;">
      <div style="background: #1f2937; padding: 24px; border-radius: 12px; width: 90%; max-width: 400px; color: #f3f4f6; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <h3 style="margin-top: 0; font-size: 1.25rem; font-weight: 600;">${title}</h3>
        <p style="margin: 16px 0; color: #d1d5db; line-height: 1.5;">${content}</p>
        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
          <button id="modal-btn-cancel" style="padding: 8px 16px; background: transparent; border: 1px solid #4b5563; color: #d1d5db; border-radius: 6px; cursor: pointer;">Cancel</button>
          <button id="modal-btn-confirm" style="padding: 8px 16px; background: #F59E0B; border: none; color: #0A0A0F; border-radius: 6px; cursor: pointer;">Confirm</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  const modalElement = document.getElementById('custom-modal');

  document.getElementById('modal-btn-cancel').addEventListener('click', () => {
    modalElement.remove();
    if (onCancel) onCancel();
  });

  document.getElementById('modal-btn-confirm').addEventListener('click', () => {
    modalElement.remove();
    if (onConfirm) onConfirm();
  });
}

// Format Date
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-IN', options);
}

// Time Ago
function timeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval >= 1 && interval < 2) return "Yesterday";
  if (interval >= 2) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return "Just now";
}

// Generate ID
function generateId() {
  return 'RPT-' + Math.floor(1000 + Math.random() * 9000);
}

// Data Management
function getReports() {
  const stored = localStorage.getItem('pathpulse_reports');
  if (stored) {
    return JSON.parse(stored);
  }
  // Initialize with sample data if empty
  localStorage.setItem('pathpulse_reports', JSON.stringify(PathPulse.sampleReports));
  return PathPulse.sampleReports;
}

function saveReport(report) {
  const reports = getReports();
  reports.unshift(report); // Add to beginning
  localStorage.setItem('pathpulse_reports', JSON.stringify(reports));
  return true;
}

function deleteReport(id) {
  let reports = getReports();
  reports = reports.filter(r => r.id !== id);
  localStorage.setItem('pathpulse_reports', JSON.stringify(reports));
  return true;
}

function getReportById(id) {
  const reports = getReports();
  return reports.find(r => r.id === id) || null;
}

// Auth Management
function isLoggedIn() {
  return localStorage.getItem('pathpulse_logged_in') === 'true';
}

function getCurrentUser() {
  const userStr = localStorage.getItem('pathpulse_user');
  if (userStr) return JSON.parse(userStr);
  return PathPulse.currentUser; // Fallback to demo user
}

async function logout() {
  if (window.PathPulseSupabase && window.PathPulseSupabase.auth) {
    try {
      await window.PathPulseSupabase.auth.signOut();
    } catch (e) {
      console.warn('Signout note:', e);
    }
  }
  localStorage.removeItem('pathpulse_logged_in');
  localStorage.removeItem('pathpulse_user');
  localStorage.removeItem('pathpulse_user_profile');
  window.location.href = 'login.html';
}

// ==========================================
// Initialization & Event Listeners
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  
  // Mobile Menu Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // Sidebar Toggle (for dashboards)
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active'); // Assume CSS handles active state translation
    });
    
    // Close sidebar on outside click on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth < 768 && sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== sidebarToggle) {
        sidebar.classList.remove('active');
      }
    });
  }

  // Logout Buttons
  const logoutBtns = document.querySelectorAll('.logout-btn');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  });

  // Highlight Active Nav Link
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('nav a, .sidebar a');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && currentPath.includes(href)) {
      link.classList.add('active'); // Assume CSS handles active style
    }
  });

  // Auth State UI Update
  const authRequiredElements = document.querySelectorAll('.auth-required');
  const guestOnlyElements = document.querySelectorAll('.guest-only');
  
  if (isLoggedIn()) {
    authRequiredElements.forEach(el => el.style.display = '');
    guestOnlyElements.forEach(el => el.style.display = 'none');
    
    // Update user info display if elements exist
    const userNameDisplays = document.querySelectorAll('.user-name-display');
    const user = getCurrentUser();
    userNameDisplays.forEach(el => el.textContent = user.name);
  } else {
    authRequiredElements.forEach(el => el.style.display = 'none');
    guestOnlyElements.forEach(el => el.style.display = '');
  }

});
