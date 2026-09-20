// admin.js - Handles Admin Panel functionality

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Tabs Logic ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`tab-${tabId}`).classList.add('active');

            // Render charts if analytics tab is opened (and if they haven't been rendered yet)
            if (tabId === 'analytics') {
                initCharts();
            }
        });
    });

    // --- Sample Data ---
    const reportsData = [
        { id: 'RPT-1001', title: 'Deep Pothole on MG Road', reporter: 'John Doe', category: 'Pothole', severity: 'Critical', status: 'Pending', date: '2026-09-18' },
        { id: 'RPT-1002', title: 'Open Manhole', reporter: 'Jane Smith', category: 'Open Manhole', severity: 'High', status: 'In Progress', date: '2026-09-19' },
        { id: 'RPT-1003', title: 'Severe Waterlogging', reporter: 'Mike Johnson', category: 'Waterlogging', severity: 'Medium', status: 'Resolved', date: '2026-09-15' },
        { id: 'RPT-2001', title: 'Shattered Pavement', reporter: 'Alice Brown', category: 'Broken Footpath', severity: 'Medium', status: 'Pending', date: '2026-09-20' },
        { id: 'RPT-2002', title: 'Overflowing Dumpster', reporter: 'Charlie Davis', category: 'Garbage', severity: 'Low', status: 'Pending', date: '2026-09-17' },
        { id: 'RPT-2003', title: 'Road Cave-in', reporter: 'Eve Wilson', category: 'Pothole', severity: 'Critical', status: 'In Progress', date: '2026-09-19' },
        { id: 'RPT-3001', title: 'Broken Wheelchair Ramp', reporter: 'Sam Taylor', category: 'Damaged Ramp', severity: 'High', status: 'Pending', date: '2026-09-20' },
        { id: 'RPT-4001', title: 'Flooded Street', reporter: 'Lisa Anderson', category: 'Waterlogging', severity: 'High', status: 'In Progress', date: '2026-09-19' }
    ];

    const usersData = [
        { id: 'USR-001', name: 'John Doe', email: 'john@example.com', city: 'Mumbai', reports: 12, role: 'Admin' },
        { id: 'USR-002', name: 'Jane Smith', email: 'jane@example.com', city: 'Delhi', reports: 5, role: 'User' },
        { id: 'USR-003', name: 'Mike Johnson', email: 'mike@example.com', city: 'Bangalore', reports: 8, role: 'User' },
        { id: 'USR-004', name: 'Alice Brown', email: 'alice@example.com', city: 'Chennai', reports: 3, role: 'User' },
        { id: 'USR-005', name: 'Charlie Davis', email: 'charlie@example.com', city: 'Pune', reports: 15, role: 'User' },
        { id: 'USR-006', name: 'Eve Wilson', email: 'eve@example.com', city: 'Hyderabad', reports: 2, role: 'User' }
    ];

    // --- Helper Functions ---
    function getSeverityBadge(severity) {
        return `<span class="badge badge-${severity.toLowerCase()}">${severity}</span>`;
    }

    function getStatusDropdown(currentStatus, reportId) {
        const statuses = ['Pending', 'In Progress', 'Resolved'];
        let options = '';
        statuses.forEach(st => {
            const selected = st === currentStatus ? 'selected' : '';
            options += `<option value="${st}" ${selected}>${st}</option>`;
        });
        return `<select class="status-select" onchange="window.handleStatusChange(this, '${reportId}')">${options}</select>`;
    }
    
    // Attach to window so inline onclick can access it
    window.handleStatusChange = function(selectElement, id) {
        alert(`Status for ${id} changed to: ${selectElement.value}`);
    };

    window.deleteReport = function(id) {
        if(confirm(`Are you sure you want to delete report ${id}?`)) {
            alert(`Report ${id} deleted.`);
            // In real app, remove from array and re-render
        }
    };
    
    window.suspendUser = function(id) {
        alert(`User ${id} has been suspended.`);
    };

    window.makeAdmin = function(id) {
        alert(`User ${id} is now an Admin.`);
    };

    // --- Render Tables ---
    const reportsTbody = document.getElementById('reportsTableBody');
    if (reportsTbody) {
        let html = '';
        reportsData.forEach(rep => {
            html += `
                <tr>
                    <td>${rep.id}</td>
                    <td><strong>${rep.title}</strong></td>
                    <td>${rep.reporter}</td>
                    <td>${rep.category}</td>
                    <td>${getSeverityBadge(rep.severity)}</td>
                    <td>${getStatusDropdown(rep.status, rep.id)}</td>
                    <td>${rep.date}</td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn" title="View"><i class="fas fa-eye"></i></button>
                            <button class="action-btn delete" title="Delete" onclick="deleteReport('${rep.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
        reportsTbody.innerHTML = html;
    }

    const usersTbody = document.getElementById('usersTableBody');
    if (usersTbody) {
        let html = '';
        usersData.forEach(usr => {
            const roleBadge = usr.role === 'Admin' ? '<span class="badge badge-admin">Admin</span>' : '<span class="badge badge-user">User</span>';
            html += `
                <tr>
                    <td>${usr.id}</td>
                    <td><strong>${usr.name}</strong></td>
                    <td>${usr.email}</td>
                    <td>${usr.city}</td>
                    <td>${usr.reports}</td>
                    <td>${roleBadge}</td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn" title="View Profile"><i class="fas fa-user-circle"></i></button>
                            ${usr.role !== 'Admin' ? `<button class="action-btn" title="Make Admin" onclick="makeAdmin('${usr.id}')"><i class="fas fa-arrow-up"></i></button>` : ''}
                            <button class="action-btn delete" title="Suspend" onclick="suspendUser('${usr.id}')"><i class="fas fa-ban"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
        usersTbody.innerHTML = html;
    }

    // --- Chart.js ---
    let chartsInitialized = false;
    
    function initCharts() {
        if (chartsInitialized) return;
        
        // Common defaults for dark theme
        Chart.defaults.color = '#71717A';
        Chart.defaults.borderColor = 'rgba(255,255,255,0.1)';

        // 1. City Chart (Bar)
        const ctxCity = document.getElementById('cityChart');
        if (ctxCity) {
            new Chart(ctxCity, {
                type: 'bar',
                data: {
                    labels: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune', 'Hyderabad'],
                    datasets: [{
                        label: 'Reports Filed',
                        data: [450, 380, 320, 290, 210, 180],
                        backgroundColor: '#F59E0B',
                        borderRadius: 4
                    }]
                },
                options: { maintainAspectRatio: false }
            });
        }

        // 2. Category Chart (Pie)
        const ctxCat = document.getElementById('categoryChart');
        if (ctxCat) {
            new Chart(ctxCat, {
                type: 'pie',
                data: {
                    labels: ['Pothole', 'Waterlogging', 'Garbage', 'Broken Footpath', 'Open Manhole', 'Other'],
                    datasets: [{
                        data: [35, 20, 15, 12, 10, 8],
                        backgroundColor: ['#DC2626', '#2563EB', '#D97706', '#F59E0B', '#7C3AED', '#52525B'],
                        borderWidth: 0
                    }]
                },
                options: { maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
            });
        }

        // 3. Timeline Chart (Line)
        const ctxTime = document.getElementById('timelineChart');
        if (ctxTime) {
            new Chart(ctxTime, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Reported',
                        data: [45, 52, 38, 65, 48, 25, 20],
                        borderColor: '#F59E0B',
                        tension: 0.4,
                        fill: false
                    }, {
                        label: 'Resolved',
                        data: [20, 35, 40, 45, 55, 30, 25],
                        borderColor: '#22C55E',
                        tension: 0.4,
                        fill: false
                    }]
                },
                options: { maintainAspectRatio: false }
            });
        }

        // 4. Severity Chart (Doughnut)
        const ctxSev = document.getElementById('severityChart');
        if (ctxSev) {
            new Chart(ctxSev, {
                type: 'doughnut',
                data: {
                    labels: ['Critical', 'High', 'Medium', 'Low'],
                    datasets: [{
                        data: [15, 30, 40, 15],
                        backgroundColor: ['#EF4444', '#F59E0B', '#D97706', '#22C55E'],
                        borderWidth: 0
                    }]
                },
                options: { maintainAspectRatio: false, plugins: { legend: { position: 'right' } }, cutout: '70%' }
            });
        }
        
        chartsInitialized = true;
    }
});
