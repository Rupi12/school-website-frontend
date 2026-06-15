const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : 'https://school-website-backend-j6pc.onrender.com/api';
const token = localStorage.getItem('adminToken');
const adminInfo = JSON.parse(localStorage.getItem('adminInfo') || '{}');

if (!token) window.location.href = 'login.html';

document.getElementById('adminName').textContent = `👤 ${adminInfo.username || 'Admin'}`;

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
};

let allApplications = [];
let allMessages = [];
let currentTab = 'applications';

loadApplications();
loadMessages();

setInterval(() => {
    loadApplications();
    loadMessages();
}, 30000);


function downloadNOC(sid) {
  fetch(`${STUDENT_ADMIN}/noc/${sid}`, { headers })
    .then(async r => {
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(d.error || 'NOC not available');
        return;
      }
      const blob = await r.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    })
    .catch(() => alert('Could not load NOC'));
}

async function loadApplications() {
    try {
        const res = await fetch(`${API_URL}/applications`, { headers });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();
        if (!data.success) return;
        allApplications = data.applications;
        document.getElementById('totalApps').textContent = allApplications.length;
        document.getElementById('pendingApps').textContent = allApplications.filter(a => a.status === 'pending').length;
        renderApplications(allApplications);
    } catch (error) {
        console.error('Error loading applications:', error);
    }
}

async function loadMessages() {
    try {
        const res = await fetch(`${API_URL}/contacts`, { headers });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();
        if (!data.success) return;
        allMessages = data.contacts;
        document.getElementById('totalMsgs').textContent = allMessages.length;
        document.getElementById('unreadMsgs').textContent = allMessages.filter(m => !m.isRead).length;
        renderMessages(allMessages);
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function renderApplications(apps) {
    const tbody = document.getElementById('applicationsTable');
    if (apps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No applications found</td></tr>';
        return;
    }
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    tbody.innerHTML = apps.map(app => `
        <tr>
            <td>
                <strong>${highlightText(app.studentName, searchTerm)}</strong>
            </td>
            <td>${escapeHtml(app.grade)}</td>
            <td>${highlightText(app.parentName, searchTerm)}</td>
            <td>${highlightText(app.phone, searchTerm)}</td>
            <td>
                <select onchange="updateStatus('${app._id}', this.value)" class="status-select status-${app.status}" ${!hasPermission('applications.edit') ? 'disabled' : ''}>
                    <option value="pending" ${app.status==='pending'?'selected':''}>Pending</option>
                    <option value="reviewing" ${app.status==='reviewing'?'selected':''}>Reviewing</option>
                    <option value="approved" ${app.status==='approved'?'selected':''}>Approved</option>
                    <option value="rejected" ${app.status==='rejected'?'selected':''}>Rejected</option>
                </select>
            </td>
            <td>${new Date(app.createdAt).toLocaleDateString()}</td>
            <td>
                <button class="action-btn btn-view" onclick='viewApp(${JSON.stringify(app)})'>View</button>
                ${hasPermission('applications.delete') ? `<button class="action-btn btn-delete" onclick="deleteApp('${app._id}')">Delete</button>` : ''}
            </td>
        </tr>
    `).join('');
}

function renderMessages(msgs) {
    const tbody = document.getElementById('messagesTable');
    if (msgs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No messages found</td></tr>';
        return;
    }
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    tbody.innerHTML = msgs.map(msg => `
        <tr style="${!msg.isRead ? 'background:#fef3c7' : ''}">
            <td><strong>${highlightText(msg.name, searchTerm)}</strong></td>
            <td>${highlightText(msg.phone || msg.email, searchTerm)}</td>
            <td>${highlightText(msg.subject, searchTerm)}</td>
            <td>${new Date(msg.createdAt).toLocaleDateString()}</td>
            <td>${msg.isRead ? '✅ Read' : '🔵 New'}</td>
            <td>
                <button class="action-btn btn-view" onclick='viewMsg(${JSON.stringify(msg)})'>View</button>
                ${hasPermission('messages.delete') ? `<button class="action-btn btn-delete" onclick="deleteMsg('${msg._id}')">Delete</button>` : ''}
            </td>
        </tr>
    `).join('');
}

function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const resultCount = document.getElementById('resultCount');
    if (currentTab === 'applications') {
        let filtered = allApplications;
        if (searchTerm) {
            filtered = filtered.filter(app =>
                app.studentName.toLowerCase().includes(searchTerm) ||
                app.parentName.toLowerCase().includes(searchTerm) ||
                app.phone.toLowerCase().includes(searchTerm) ||
                app.grade.toLowerCase().includes(searchTerm)
            );
        }
        if (statusFilter) filtered = filtered.filter(app => app.status === statusFilter);
        renderApplications(filtered);
        resultCount.textContent = (searchTerm || statusFilter) ? `Showing ${filtered.length} of ${allApplications.length} applications` : '';
    } else {
        let filtered = allMessages;
        if (searchTerm) {
            filtered = filtered.filter(msg =>
                (msg.name || '').toLowerCase().includes(searchTerm) ||
                (msg.phone || msg.email || '').toLowerCase().includes(searchTerm) ||
                (msg.subject || '').toLowerCase().includes(searchTerm) ||
                (msg.message || '').toLowerCase().includes(searchTerm)
            );
        }
        renderMessages(filtered);
        resultCount.textContent = searchTerm ? `Showing ${filtered.length} of ${allMessages.length} messages` : '';
    }
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('resultCount').textContent = '';
    handleSearch();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function highlightText(text, searchTerm) {
    if (!text) return '';
    const escaped = escapeHtml(text);
    if (!searchTerm) return escaped;
    
    try {
        const safeTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return escaped.replace(new RegExp('(' + safeTerm + ')', 'gi'), '<span class="highlight">$1</span>');
    } catch (e) {
        return escaped;
    }
}

async function updateStatus(id, status) {
    try {
        await fetch(`${API_URL}/applications/${id}`, { method: 'PUT', headers, body: JSON.stringify({ status }) });
        loadApplications();
    } catch (error) { console.error(error); }
}

async function deleteApp(id) {
    if (!confirm('Are you sure you want to delete this application?')) return;
    try {
        await fetch(`${API_URL}/applications/${id}`, { method: 'DELETE', headers });
        loadApplications();
    } catch (error) { console.error(error); }
}

async function deleteMsg(id) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
        await fetch(`${API_URL}/contacts/${id}`, { method: 'DELETE', headers });
        loadMessages();
    } catch (error) { console.error(error); }
}

function viewApp(app) {
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <h2 style="color:#2563eb;margin-top:0">📝 Application Details</h2>
        <div class="detail-row"><strong>Student Name:</strong> ${escapeHtml(app.studentName)}</div>
        <div class="detail-row"><strong>Date of Birth:</strong> ${new Date(app.dob).toLocaleDateString()}</div>
        <div class="detail-row"><strong>Grade:</strong> ${escapeHtml(app.grade)}</div>
        <div class="detail-row"><strong>Gender:</strong> ${escapeHtml(app.gender)}</div>
        <div class="detail-row"><strong>Parent Name:</strong> ${escapeHtml(app.parentName)}</div>
        <div class="detail-row"><strong>Phone:</strong> ${escapeHtml(app.phone)}</div>
        <div class="detail-row"><strong>Address:</strong> ${escapeHtml(app.address)}</div>
        <div class="detail-row"><strong>Previous School:</strong> ${escapeHtml(app.prevSchool || 'N/A')}</div>
        <div class="detail-row"><strong>Status:</strong> <span class="status-select status-${app.status}">${app.status}</span></div>
        <div class="detail-row"><strong>Submitted:</strong> ${new Date(app.createdAt).toLocaleString()}</div>
    `;
    document.getElementById('detailModal').classList.add('active');
}

async function viewMsg(msg) {
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <h2 style="color:#2563eb;margin-top:0">💬 Message Details</h2>
        <div class="detail-row"><strong>From:</strong> ${escapeHtml(msg.name)}</div>
        <div class="detail-row"><strong>Contact:</strong> ${escapeHtml(msg.phone || msg.email)}</div>
        <div class="detail-row"><strong>Subject:</strong> ${escapeHtml(msg.subject)}</div>
        <div class="detail-row"><strong>Date:</strong> ${new Date(msg.createdAt).toLocaleString()}</div>
        <div class="detail-row"><strong>Message:</strong><br><br>
            <div style="background:#f3f4f6;padding:1rem;border-radius:5px;white-space:pre-wrap">${escapeHtml(msg.message)}</div>
        </div>
    `;
    document.getElementById('detailModal').classList.add('active');
    if (!msg.isRead) {
        await fetch(`${API_URL}/contacts/${msg._id}/read`, { method: 'PUT', headers });
        loadMessages();
    }
}

function closeModal() {
    document.getElementById('detailModal').classList.remove('active');
}

function showTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    document.getElementById('applications-tab').classList.toggle('hidden', tab !== 'applications');
    document.getElementById('messages-tab').classList.toggle('hidden', tab !== 'messages');
    document.getElementById('gallery-tab').classList.toggle('hidden', tab !== 'gallery');
    document.getElementById('news-tab').classList.toggle('hidden', tab !== 'news');
    document.getElementById('documents-tab').classList.toggle('hidden', tab !== 'documents');
    document.getElementById('students-tab').classList.toggle('hidden', tab !== 'students');
    document.getElementById('admins-tab').classList.toggle('hidden', tab !== 'admins');
    document.getElementById('audit-tab')?.classList.toggle('hidden', tab !== 'audit');
    document.getElementById('report-tab')?.classList.toggle('hidden', tab !== 'report');
    document.getElementById('teacher-workspace-tab')?.classList.toggle('hidden', tab !== 'teacher-workspace');
    
    // in if-chain:
   if (tab === 'report') { loadReport(); loadPendingSummary(); loadDefaulters(); loadDefaulterClasses(); }
        
    
    if (tab === 'audit') loadAudit(1);
    if (tab === 'students') { 
        loadStudentsAdmin(); loadClasses(); 
        const firstVisibleStudentTab = [...document.querySelectorAll('.student-sub-tab-btn')].find(b => b.style.display !== 'none');
        if (firstVisibleStudentTab) firstVisibleStudentTab.click();
    }
    if (tab === 'documents') loadDocsAdmin();
    if (tab === 'gallery') loadGalleryAdmin();
    if (tab === 'news') loadNewsAdmin();
    if (tab === 'admins') {
        loadAdmins();
        if (myRole === 'superadmin' || hasPermission('staff.attendance.approve')) {
            loadPendingStaffAttendanceRequests(); 
            loadStaffAttendanceToday();
        }
        const firstVisibleStaffTab = [...document.querySelectorAll('.staff-sub-tab-btn')].find(b => b.style.display !== 'none');
        if (firstVisibleStaffTab) firstVisibleStaffTab.click();
    }
    if (tab === 'teacher-workspace') { 
        const firstVisibleWorkspaceTab = [...document.querySelectorAll('.workspace-sub-tab-btn')].find(b => b.style.display !== 'none');
        if (firstVisibleWorkspaceTab) firstVisibleWorkspaceTab.click();
    }

    // Hide forms based on granular permissions
    const gForm = document.getElementById('galleryForm');
    if (gForm) gForm.style.display = hasPermission('gallery.add') ? 'block' : 'none';
    const nForm = document.getElementById('newsForm');
    if (nForm) nForm.style.display = hasPermission('news.add') ? 'block' : 'none';
    const dForm = document.getElementById('docForm');
    if (dForm) dForm.style.display = hasPermission('documents.add') ? 'block' : 'none';
    const sForm = document.getElementById('studentForm');
    if (sForm) sForm.style.display = hasPermission('students.add') ? 'block' : 'none';
    const bUpload = document.getElementById('bulkUploadForm');
    if (bUpload) bUpload.style.display = hasPermission('students.add') ? 'block' : 'none';
    
    document.querySelectorAll('[data-perm="applications.export"]').forEach(el => el.style.display = hasPermission('applications.export') ? '' : 'none');
    document.querySelectorAll('[data-perm="students.export"]').forEach(el => el.style.display = hasPermission('students.export') ? '' : 'none');

    const searchBar = document.getElementById('globalSearchBar') || document.querySelector('.search-bar');
    if (searchBar) {
        const tabsWithSearch = ['applications', 'messages'];
        searchBar.style.display = tabsWithSearch.includes(tab) ? 'flex' : 'none';
    }

    const searchInput = document.getElementById('searchInput');
    if (tab === 'applications') {
        if (searchInput) searchInput.placeholder = 'Search by name, parent, or phone...';
        const fs = document.getElementById('filterStatus');
        if (fs) fs.style.display = '';
    } else if (tab === 'messages') {
        if (searchInput) searchInput.placeholder = 'Search by name, phone, subject...';
        const fs = document.getElementById('filterStatus');
        if (fs) fs.style.display = 'none';
    }

    if (tab !== 'gallery' && tab !== 'news') clearSearch();
}

window.showStaffSubTab = function(tab, btn) {
    document.querySelectorAll('.staff-sub-tab-btn').forEach(b => { b.style.background = 'transparent'; b.style.color = '#475569'; b.classList.remove('active'); });
    if (btn) { btn.style.background = '#2563eb'; btn.style.color = 'white'; btn.classList.add('active'); }
    ['staff-list-sec', 'staff-create-sec', 'staff-approvals-sec', 'staff-roster-sec', 'staff-history-sec', 'staff-payroll-sec'].forEach(sec => {
        const el = document.getElementById(sec); if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(tab + '-sec');
    if (target) target.classList.remove('hidden');

    // Auto-initialize and load History when the tab is clicked
    if (tab === 'staff-history') {
        const monthInput = document.getElementById('historyMonthSelect');
        if (monthInput && !monthInput.value) {
            const now = new Date();
            monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        if (document.getElementById('historyStaffSelect')?.value && typeof loadStaffHistory === 'function') loadStaffHistory();
    }

    if (tab === 'staff-payroll') {
        if (typeof loadPayrollAdmin === 'function') loadPayrollAdmin();
    }
};

window.showWorkspaceSubTab = function(tab, btn) {
    document.querySelectorAll('.workspace-sub-tab-btn').forEach(b => { b.style.background = 'transparent'; b.style.color = '#475569'; b.classList.remove('active'); });
    if (btn) { btn.style.background = '#2563eb'; btn.style.color = 'white'; btn.classList.add('active'); }
    ['workspace-attendance-sec', 'workspace-payroll-sec'].forEach(sec => {
        const el = document.getElementById(sec); if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(tab + '-sec');
    if (target) target.classList.remove('hidden');

    if (tab === 'workspace-attendance') {
        const dInput = document.getElementById('selfAttDate');
        if (dInput && !dInput.value) dInput.value = new Date().toISOString().split('T')[0];
        if (typeof loadMyStaffAttendance === 'function') loadMyStaffAttendance(); 
    }
    if (tab === 'workspace-payroll') {
        if (typeof loadMySalarySlips === 'function') loadMySalarySlips();
    }
};

window.showStudentSubTab = function(tab, btn) {
    document.querySelectorAll('.student-sub-tab-btn').forEach(b => { b.style.background = 'transparent'; b.style.color = '#475569'; b.classList.remove('active'); });
    if (btn) { btn.style.background = '#2563eb'; btn.style.color = 'white'; btn.classList.add('active'); }
    ['student-list-sec', 'student-add-sec', 'student-manage-sec'].forEach(sec => {
        const el = document.getElementById(sec); if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(tab + '-sec');
    if (target) target.classList.remove('hidden');
};

function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    window.location.href = 'login.html';
}

document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') closeModal();
});

// ============ GALLERY ============
let allGalleryPhotos = [];

async function loadGalleryAdmin() {
    try {
        const res = await fetch(`${API_URL}/gallery`);
        const data = await res.json();
        if (!data.success) return;
        allGalleryPhotos = data.photos;
        const grid = document.getElementById('adminGalleryGrid');
        if (allGalleryPhotos.length === 0) {
            grid.innerHTML = '<p style="color:#6b7280">No photos yet. Add your first photo above!</p>';
            return;
        }
        grid.innerHTML = allGalleryPhotos.map(photo => `
            <div class="gallery-admin-item">
                ${hasPermission('gallery.delete') ? `<button class="gallery-delete-btn" onclick="deletePhoto('${photo._id}')">×</button>` : ''}
                <img src="${escapeHtml(photo.imageUrl)}" onerror="this.src='https://via.placeholder.com/200x150?text=Invalid+URL'">
                <div class="gallery-admin-info">
                    <h4>${escapeHtml(photo.title)}</h4>
                    <span class="cat">${escapeHtml(photo.category)}</span>
                    ${hasPermission('gallery.edit') ? `<button class="action-btn btn-view" style="margin-top:0.5rem;width:100%" onclick='editPhoto(${JSON.stringify(photo)})'>✏️ Edit</button>` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) { console.error('Error loading gallery:', error); }
}

const imageInput = document.getElementById('imageInput');
if (imageInput) {
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const preview = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('Image must be less than 5MB');
                imageInput.value = '';
                preview.style.display = 'none';
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => { previewImg.src = e.target.result; preview.style.display = 'block'; };
            reader.readAsDataURL(file);
        }
    });
}

const galleryForm = document.getElementById('galleryForm');
if (galleryForm) {
    galleryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('galleryMsg');
        const btn = galleryForm.querySelector('button[type="submit"]');
        const formData = new FormData(galleryForm);
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Uploading...';
        try {
            const res = await fetch(`${API_URL}/gallery`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const result = await res.json();
            if (result.success) {
                msg.innerHTML = '<div style="color:#065f46;background:#d1fae5;padding:0.8rem;border-radius:5px">✅ Photo uploaded successfully!</div>';
                galleryForm.reset();
                document.getElementById('imagePreview').style.display = 'none';
                loadGalleryAdmin();
            } else {
                msg.innerHTML = `<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ ${result.message}</div>`;
            }
        } catch (error) {
            msg.innerHTML = '<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ Upload failed. Try again.</div>';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Upload Photo';
            setTimeout(() => msg.innerHTML = '', 5000);
        }
    });
}

async function deletePhoto(id) {
    if (!confirm('Delete this photo?')) return;
    try {
        await fetch(`${API_URL}/gallery/${id}`, { method: 'DELETE', headers });
        loadGalleryAdmin();
    } catch (error) { console.error(error); }
}

function editPhoto(photo) {
    const newTitle = prompt('Edit title:', photo.title);
    if (newTitle === null) return;
    const newCategory = prompt('Category (Events/Sports/Campus/Academics/Cultural/Others):', photo.category);
    if (newCategory === null) return;
    const newDesc = prompt('Edit description:', photo.description || '');
    if (newDesc === null) return;
    fetch(`${API_URL}/gallery/${photo._id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ title: newTitle, category: newCategory, description: newDesc })
    }).then(r => r.json()).then(result => {
        if (result.success) loadGalleryAdmin();
        else alert('Error: ' + result.message);
    });
}

// ============ NEWS ============
async function loadNewsAdmin() {
    try {
        const res = await fetch(`${API_URL}/news`);
        const data = await res.json();
        if (!data.success) return;
        const list = document.getElementById('adminNewsList');
        if (data.news.length === 0) {
            list.innerHTML = '<p style="color:#6b7280">No news yet. Add your first one above!</p>';
            return;
        }
        const icons = { 'News': '📰', 'Events': '🎉', 'Achievements': '🏆', 'Announcements': '📢' };
        list.innerHTML = data.news.map(item => `
            <div style="background:white;padding:1rem;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.08);display:flex;gap:1rem;align-items:center">
                ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" style="width:80px;height:80px;object-fit:cover;border-radius:8px">` : '<div style="width:80px;height:80px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:2rem">' + icons[item.category] + '</div>'}
                <div style="flex:1">
                    <span class="news-category-badge cat-${item.category}">${icons[item.category]} ${item.category}</span>
                    ${item.isPinned ? '<span style="color:#fbbf24;margin-left:0.5rem">📌 Pinned</span>' : ''}
                    <h4 style="margin:0.3rem 0">${escapeHtml(item.title)}</h4>
                    <small style="color:#6b7280">${new Date(item.createdAt).toLocaleDateString()}</small>
                </div>
                ${hasPermission('news.edit') ? `<button class="action-btn btn-view" onclick='editNews(${JSON.stringify(item)})'>✏️ Edit</button>` : ''}
                ${hasPermission('news.delete') ? `<button class="action-btn btn-delete" onclick="deleteNews('${item._id}')">Delete</button>` : ''}
            </div>
        `).join('');
    } catch (error) { console.error('Error loading news:', error); }
}

const newsForm = document.getElementById('newsForm');
if (newsForm) {
    newsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('newsMsg');
        const btn = newsForm.querySelector('button[type="submit"]');
        const formData = new FormData(newsForm);
        formData.set('isPinned', document.getElementById('isPinned').checked);
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Adding...';
        try {
            const res = await fetch(`${API_URL}/news`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const result = await res.json();
            if (result.success) {
                msg.innerHTML = '<div style="color:#065f46;background:#d1fae5;padding:0.8rem;border-radius:5px">✅ News added!</div>';
                newsForm.reset();
                loadNewsAdmin();
            } else {
                msg.innerHTML = `<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ ${result.message}</div>`;
            }
        } catch (error) {
            msg.innerHTML = '<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ Failed</div>';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Add News';
            setTimeout(() => msg.innerHTML = '', 4000);
        }
    });
}

async function deleteNews(id) {
    if (!confirm('Delete this news?')) return;
    try {
        await fetch(`${API_URL}/news/${id}`, { method: 'DELETE', headers });
        loadNewsAdmin();
    } catch (error) { console.error(error); }
}

function editNews(item) {
    const newTitle = prompt('Edit title:', item.title);
    if (newTitle === null) return;
    const newCategory = prompt('Category (News/Events/Achievements/Announcements):', item.category);
    if (newCategory === null) return;
    const newDesc = prompt('Edit description:', item.description);
    if (newDesc === null) return;
    const pin = confirm('Pin to top? OK = Yes, Cancel = No');
    fetch(`${API_URL}/news/${item._id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ title: newTitle, category: newCategory, description: newDesc, eventDate: item.eventDate, isPinned: pin })
    }).then(r => r.json()).then(result => {
        if (result.success) loadNewsAdmin();
        else alert('Error: ' + result.message);
    });
}

function exportApplications() {
    if (!hasPermission('applications.export')) return alert('Permission denied');
    if (!allApplications || allApplications.length === 0) {
        alert('No applications to export');
        return;
    }
    const cols = ['Student Name','DOB','Grade','Gender','Parent Name','Phone','Address','Previous School','Status','Submitted'];
    const rows = allApplications.map(app => [
        app.studentName, new Date(app.dob).toLocaleDateString(), app.grade, app.gender,
        app.parentName, app.phone, app.address, app.prevSchool || 'N/A',
        app.status, new Date(app.createdAt).toLocaleDateString()
    ]);
    let csv = cols.join(',') + '\n';
    rows.forEach(row => { csv += row.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',') + '\n'; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `applications_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============ DOCUMENTS ============
async function loadDocsAdmin() {
    try {
        const res = await fetch(`${API_URL}/documents`);
        const data = await res.json();
        if (!data.success) return;
        const list = document.getElementById('adminDocList');
        if (data.documents.length === 0) {
            list.innerHTML = '<p style="color:#6b7280">No documents yet.</p>';
            return;
        }
        list.innerHTML = data.documents.map(doc => `
            <div style="background:white;padding:1rem;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.08);display:flex;gap:1rem;align-items:center">
                <div style="font-size:2rem">📄</div>
                <div style="flex:1">
                    <span class="news-category-badge cat-News">${escapeHtml(doc.category)}</span>
                    <h4 style="margin:0.3rem 0">${escapeHtml(doc.title)}</h4>
                    <small style="color:#6b7280">${new Date(doc.createdAt).toLocaleDateString()}</small>
                </div>
                <a href="${doc.fileUrl}" target="_blank" class="action-btn btn-view">View</a>
                ${hasPermission('documents.delete') ? `<button class="action-btn btn-delete" onclick="deleteDoc('${doc._id}')">Delete</button>` : ''}
            </div>
        `).join('');
    } catch (error) { console.error(error); }
}

const docForm = document.getElementById('docForm');
if (docForm) {
    docForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('docMsg');
        const btn = docForm.querySelector('button[type="submit"]');
        const formData = new FormData(docForm);
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Uploading...';
        try {
            const res = await fetch(`${API_URL}/documents`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const result = await res.json();
            if (result.success) {
                msg.innerHTML = '<div style="color:#065f46;background:#d1fae5;padding:0.8rem;border-radius:5px">✅ Uploaded!</div>';
                docForm.reset();
                loadDocsAdmin();
            } else {
                msg.innerHTML = `<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ ${result.message}</div>`;
            }
        } catch (error) {
            msg.innerHTML = '<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ Failed</div>';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Upload Document';
            setTimeout(() => msg.innerHTML = '', 4000);
        }
    });
}

async function deleteDoc(id) {
    if (!confirm('Delete this document?')) return;
    try {
        await fetch(`${API_URL}/documents/${id}`, { method: 'DELETE', headers });
        loadDocsAdmin();
    } catch (error) { console.error(error); }
}

// ============ STUDENTS ============
const STUDENT_ADMIN = `${API_URL}/student-admin`;
let allStudents = [];
let listPage = 1;
const LIST_PER_PAGE = 20;

async function loadStudentsAdmin(page = 1) {
    listPage = page;
    try {
    const list = document.getElementById('adminStudentList');
        if (list) list.innerHTML = '<p>Loading...</p>';

        const classFilter = document.getElementById('listClassFilter')?.value || '';
        const search = document.getElementById('listSearch')?.value || '';
        
        const params = new URLSearchParams({ page: listPage, limit: LIST_PER_PAGE });
        if (classFilter) params.append('class', classFilter);
        if (search) params.append('search', search);
        
        const res = await fetch(`${STUDENT_ADMIN}/students?${params}`, { headers });
        const data = await res.json();
        if (!data.success) return;
        
        allStudents = data.students; 
        renderStudentListFromServer(data);
    } catch (e) { console.error(e); }
}

function renderStudentListFromServer(data) {
    const list = document.getElementById('adminStudentList');
    if (!data.students || data.students.length === 0) {
        list.innerHTML = '<p style="color:#6b7280">No students found.</p>';
        document.getElementById('listPagination').innerHTML = '';
        return;
    }

    list.innerHTML = data.students.map(s => `
        <div style="background:white;padding:1rem;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.08);display:flex;gap:1rem;align-items:center;flex-wrap:wrap;">
            <div style="font-size:2rem">🎓</div>
            <div style="flex:1;min-width:200px;">
                <h4 style="margin:0">${escapeHtml(s.name)}</h4>
                <small style="color:#6b7280">Roll: ${escapeHtml(s.rollNumber)} | Class ${escapeHtml(s.class)} ${escapeHtml(s.section || '')}</small>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                ${hasPermission('students.edit') ? `<button class="action-btn btn-view" onclick="openEditStudentModal('${s._id}', '${escapeHtml(s.name)}', '${escapeHtml(s.rollNumber)}', '${escapeHtml(s.class)}', '${escapeHtml(s.section || '')}', '${escapeHtml(s.parentName || '')}', '${escapeHtml(s.phone || '')}')">✏️ Edit</button>
                <button class="action-btn" style="background:#f59e0b; color:white;" onclick="openResetPwdModal('${s._id}', '${escapeHtml(s.name)}')">🔑 Reset Pwd</button>` : ''}
                ${hasPermission('students.delete') ? `<button class="action-btn btn-delete" onclick="deleteStudent('${s._id}')">🗑️ Delete</button>` : ''}
            </div>
        </div>
    `).join('');

    document.getElementById('listPagination').innerHTML = `
        <button class="sd-mini-btn" ${data.page===1?'disabled':''} onclick="loadStudentsAdmin(${data.page-1})">‹ Prev</button>
        <span style="padding:0.6rem">Page ${data.page} of ${data.pages} (${data.total} students)</span>
        <button class="sd-mini-btn" ${data.page===data.pages?'disabled':''} onclick="loadStudentsAdmin(${data.page+1})">Next ›</button>
    `;
}


const studentForm = document.getElementById('studentForm');
if (studentForm) {
    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(studentForm));
        const msg = document.getElementById('studentMsg');
        try {
            const res = await fetch(`${STUDENT_ADMIN}/students`, { method: 'POST', headers, body: JSON.stringify(data) });
            const result = await res.json();
            if (result.success) {
                msg.innerHTML = '<div style="color:#065f46;background:#d1fae5;padding:0.8rem;border-radius:5px">✅ Student added!</div>';
                studentForm.reset();
                loadStudentsAdmin();
                loadClasses();
                loadBulkClasses();
            } else {
                msg.innerHTML = `<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ ${result.message}</div>`;
            }
        } catch (err) {
            msg.innerHTML = '<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ Failed</div>';
        }
        setTimeout(() => msg.innerHTML = '', 4000);
    });
}

async function deleteStudent(id) {
    if (!confirm('Delete student and all their data?')) return;
    await fetch(`${STUDENT_ADMIN}/students/${id}`, { method: 'DELETE', headers });
    loadStudentsAdmin();
}

// ---- Class dropdowns + search ----
async function loadClasses() {
    try {
        const res = await fetch(`${STUDENT_ADMIN}/classes`, { headers });
        const data = await res.json();
        if (!data.success) return;
        const sel = document.getElementById('manageClass');
        if (sel) sel.innerHTML = '<option value="">Select Class...</option>' + data.classes.map(c => `<option value="${c}">Class ${c}</option>`).join('');
        
        const filterSel = document.getElementById('listClassFilter');
        if (filterSel) {
            const currentVal = filterSel.value;
            filterSel.innerHTML = '<option value="">All Classes</option>' + data.classes.map(c => `<option value="${c}" ${c === currentVal ? 'selected' : ''}>Class ${c}</option>`).join('');
        }
    } catch (e) { console.error(e); }
}

let classStudents = [];

async function loadClassStudents() {
    const cls = document.getElementById('manageClass').value;
    const search = document.getElementById('studentSearch');
    const checklist = document.getElementById('studentChecklist');
    const selectAllWrap = document.getElementById('selectAllWrap');

    if (!cls) {
        search.disabled = true;
        checklist.style.display = 'none';
        selectAllWrap.style.display = 'none';
        document.getElementById('manageActions').style.display = 'none';
        document.getElementById('manageForms').innerHTML = '';
        document.getElementById('selectionInfo').textContent = '';
        const ca = document.getElementById('classLevelActions');   // 👈 add
        if (ca) ca.style.display = 'none';                          // 👈 add
        return;
    }
    const res = await fetch(`${STUDENT_ADMIN}/students/class/${cls}`, { headers });
    const data = await res.json();
    classStudents = data.students;
    search.disabled = false;
    search.value = '';
    renderStudentChecklist(classStudents);
    checklist.style.display = 'block';
    selectAllWrap.style.display = 'block';
    // Show class-level Timetable button
    const classActions = document.getElementById('classLevelActions');
    if (classActions) {
        const selectedCls = document.getElementById('manageClass').value;
        classActions.innerHTML = hasPermission('timetable.manage') ? `
            <button class="sd-mini-btn" onclick="showTimetableForm()">🗓️ Set Timetable for Class ${escapeHtml(selectedCls)}</button>
        ` : '';
        classActions.style.display = 'block';
    }
}




function renderStudentChecklist(students) {
    const checklist = document.getElementById('studentChecklist');
    checklist.innerHTML = students.map(s => `
        <label style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;border-bottom:1px solid #f3f4f6;cursor:pointer;border-radius:6px" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='transparent'">
            <input type="checkbox" class="manage-student-cb" value="${s._id}" data-name="${escapeHtml(s.name)}" onchange="onSelectionChange()" style="width:16px;height:16px;accent-color:#2563eb">
            <strong style="color:#1f2937">${escapeHtml(s.rollNumber)}</strong> 
            <span style="color:#4b5563">- ${escapeHtml(s.name)} ${s.section ? '('+escapeHtml(s.section)+')' : ''}</span>
        </label>
    `).join('');
    onSelectionChange();
}

function filterStudentList() {
    const term = document.getElementById('studentSearch').value.toLowerCase();
    const filtered = classStudents.filter(s => s.name.toLowerCase().includes(term) || s.rollNumber.toLowerCase().includes(term));
    renderStudentChecklist(filtered);
}



function getSelectedStudent() {
    return document.getElementById('selectStudent').value;
}

function showManage(type) {
    const sid = getSelectedStudent();
    if (!sid) return alert('Select a student first');
    const container = document.getElementById('manageForms');

    if (type === 'result') {
        const cy = new Date().getFullYear();
        const years = [`${cy-1}-${String(cy).slice(2)}`, `${cy}-${String(cy+1).slice(2)}`];
        container.innerHTML = `
            <h4>Add Result</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem">
                <input id="examName" placeholder="Exam Name *" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
                <input id="examDate" type="date" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.8rem">
                <select id="examTerm" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
                    <option>Term 1</option><option>Term 2</option><option>Annual</option><option>Unit Test</option><option>Other</option>
                </select>
                <select id="academicYear" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
                    ${years.map(y => `<option>${y}</option>`).join('')}
                </select>
            </div>
            <div id="subjectRows"></div>
            <button class="sd-mini-btn" onclick="addSubjectRow()" style="margin:0.5rem 0">+ Add Subject</button><br>
            <input id="examRemark" placeholder="Teacher's Remark (optional)" style="width:100%;padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;margin:0.5rem 0">
            <button class="btn btn-primary" style="margin-top:0.5rem" onclick="saveResult('${sid}')">Save Result</button>
        `;
        addSubjectRow();
    } else if (type === 'fee') {
        const cy = new Date().getFullYear();
        const years = [`${cy-1}-${String(cy).slice(2)}`, `${cy}-${String(cy+1).slice(2)}`];
        container.innerHTML = `
            <h4>Add Fee Due</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem">
                <select id="feeAcademicYear" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
                    ${years.map(y => `<option>${y}</option>`).join('')}
                    <option>Previous Years</option>
                </select>
                <select id="feeCategory" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
                    <option>Tuition</option><option>Transport</option><option>Exam</option>
                    <option>Annual</option><option>Trip</option><option>Library</option>
                    <option>Previous Balance</option><option>Other</option>
                </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem">
                <input id="feeType" placeholder="Description (e.g. Term 1)" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
                <input id="feeAmount" type="number" placeholder="Total Amount ₹" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem">
                <input id="feeDiscount" type="number" placeholder="Discount Amount ₹ (Optional)" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
                <input id="feeDiscountReason" placeholder="Discount Reason (Optional)" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
            </div>
            <input id="feeDue" type="date" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;margin-bottom:0.8rem">
            <button class="btn btn-primary" onclick="saveFee('${sid}')">Add Due</button>
        `;
    } else if (type === 'doc') {
        container.innerHTML = `
            <h4>Upload Document (PDF)</h4>
            <input id="docTitle" placeholder="Document Title" style="width:100%;padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;margin-bottom:0.5rem">
            <input type="file" id="docFile" accept=".pdf" style="width:100%;padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
            <button class="btn btn-primary" style="margin-top:0.5rem" onclick="saveDoc('${sid}')">Upload</button>
        `;
    
    } else if (type === 'attendance') {
        const today = new Date().toISOString().split('T')[0];
        container.innerHTML = `
            <h4>📅 Mark Attendance</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.8rem">
                <input id="attDate" type="date" value="${today}" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
                <select id="attStatus" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Leave">Leave</option>
                    <option value="Half-Day">Half-Day</option>
                </select>
            </div>
            <input id="attRemarks" placeholder="Remarks (optional)" style="width:100%;padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;margin-bottom:0.8rem;font-family:inherit">
            <button class="btn btn-primary" onclick="saveAttendance('${sid}')">Save Attendance</button>
            <div id="attMsg" style="margin-top:0.5rem"></div>
        `;

    } else if (type === 'view') {
        loadStudentData(sid);
    }
}

function addSubjectRow() {
    const div = document.createElement('div');
    div.className = 'subject-row';
    div.style = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:0.5rem;margin-bottom:0.5rem';
    div.innerHTML = `
        <input class="subj-name" placeholder="Subject" style="padding:0.5rem;border:2px solid #e5e7eb;border-radius:6px">
        <input class="subj-obt" type="number" placeholder="Marks" style="padding:0.5rem;border:2px solid #e5e7eb;border-radius:6px">
        <input class="subj-total" type="number" placeholder="Total" style="padding:0.5rem;border:2px solid #e5e7eb;border-radius:6px">
        <button onclick="this.parentElement.remove()" style="background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;padding:0 0.8rem">×</button>
    `;
    document.getElementById('subjectRows').appendChild(div);
}

async function saveResult(sid) {
    const subjects = [];
    document.querySelectorAll('.subject-row').forEach(row => {
        const name = row.querySelector('.subj-name').value;
        const obt = row.querySelector('.subj-obt').value;
        const total = row.querySelector('.subj-total').value;
        if (name && obt !== '' && total !== '') subjects.push({ subject: name, marksObtained: Number(obt), totalMarks: Number(total) });
    });
    if (subjects.length === 0) return alert('Add at least one subject');
    const examName = document.getElementById('examName').value.trim();
    if (!examName) return alert('Enter exam name');
    const res = await fetch(`${STUDENT_ADMIN}/results`, {
        method: 'POST', headers,
        body: JSON.stringify({
            studentId: sid, examName,
            term: document.getElementById('examTerm').value,
            academicYear: document.getElementById('academicYear').value,
            examDate: document.getElementById('examDate').value || null,
            subjects, remark: document.getElementById('examRemark').value
        })
    });
    const r = await res.json();
    alert(r.success ? '✅ Result saved' : '❌ ' + r.message);
    if (r.success) document.getElementById('manageForms').innerHTML = '';
}


async function saveAttendance(sid) {
    const date = document.getElementById('attDate').value;
    const status = document.getElementById('attStatus').value;
    const remarks = document.getElementById('attRemarks').value;
    const msg = document.getElementById('attMsg');
    if (!date) return alert('Select a date');
    const res = await fetch(`${STUDENT_ADMIN}/attendance`, {
        method: 'POST', headers,
        body: JSON.stringify({ studentId: sid, date, status, remarks })
    });
    const r = await res.json();
    if (r.success) {
        msg.innerHTML = `<span style="color:#065f46">✅ ${r.message}</span>`;
        setTimeout(() => document.getElementById('manageForms').innerHTML = '', 1500);
    } else {
        msg.innerHTML = `<span style="color:#991b1b">❌ ${r.message}</span>`;
    }
}


async function saveFee(sid) {
    const feeType = document.getElementById('feeType').value.trim();
    const amount = document.getElementById('feeAmount').value;
    if (!feeType || !amount) return alert('Enter description and amount');

    const res = await fetch(`${STUDENT_ADMIN}/fees`, {
        method: 'POST', headers,
        body: JSON.stringify({
            studentId: sid,
            academicYear: document.getElementById('feeAcademicYear').value,
            category: document.getElementById('feeCategory').value,
            feeType,
            amount: Number(amount),
            discount: Number(document.getElementById('feeDiscount').value) || 0,
            discountReason: document.getElementById('feeDiscountReason').value || '',
            dueDate: document.getElementById('feeDue').value || null
        })
    });
    const r = await res.json();
    alert(r.success ? '✅ Fee due added' : '❌ ' + r.message);
    if (r.success) document.getElementById('manageForms').innerHTML = '';
}

async function saveDoc(sid) {
    const file = document.getElementById('docFile').files[0];
    if (!file) return alert('Select a file');
    const fd = new FormData();
    fd.append('studentId', sid);
    fd.append('title', document.getElementById('docTitle').value);
    fd.append('file', file);
    const res = await fetch(`${STUDENT_ADMIN}/documents`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    const r = await res.json();
    alert(r.success ? '✅ Uploaded' : '❌ ' + r.message);
    if (r.success) document.getElementById('manageForms').innerHTML = '';
}

async function downloadReportCard(resultId) {
    try {
        const res = await fetch(`${STUDENT_ADMIN}/results/${resultId}/pdf`, { headers });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Backend Status ${res.status}. Did you restart the server?`);
        }
        const blob = new Blob([await res.arrayBuffer()], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) {
        alert('PDF Error: ' + e.message);
    }
}

async function loadStudentData(sid) {
    const container = document.getElementById('manageForms');
    container.innerHTML = '<p>Loading...</p>';
    try {
        const res = await fetch(`${STUDENT_ADMIN}/student-data/${sid}`, { headers });
        const data = await res.json();
        if (!data.success) {
            container.innerHTML = '<p style="color:#991b1b">Failed to load.</p>';
            return;
        }
        container.innerHTML = `
            <h4>📊 Results</h4>
            ${data.results.length ? data.results.map(r => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem;background:#f9fafb;border-radius:8px;margin-bottom:0.4rem">
                    <span>${escapeHtml(r.examName)} - ${escapeHtml(r.term || '')} ${escapeHtml(r.academicYear || '')}</span>
                    <span style="display:flex;gap:0.3rem">
                        <button class="action-btn" style="background:#10b981;color:white" onclick="downloadReportCard('${r._id}')">📄 PDF</button>
                        ${hasPermission('results.manage') ? `<button class="action-btn btn-view" onclick="editResult('${r._id}','${sid}')">✏️ Edit</button>
                        <button class="action-btn btn-delete" onclick="deleteResult('${r._id}','${sid}')">Delete</button>` : ''}
                    </span>
                </div>
            `).join('') : '<p style="color:#6b7280">No results</p>'}

            <h4 style="margin-top:1rem">💰 Fees</h4>
            ${(() => {
                const totalFee = data.fees.reduce((s, f) => s + f.amount, 0);
                const totalDiscount = data.fees.reduce((s, f) => s + (f.discount || 0), 0);
                const totalPaidAll = data.fees.reduce((s, f) => s + f.payments.reduce((a, p) => a + p.amount, 0), 0);
                const pendingAll = (totalFee - totalDiscount) - totalPaidAll;
                const allPaid = data.fees.length > 0 && pendingAll <= 0;
                return `
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;
                    padding:0.8rem 1rem;border-radius:10px;margin-bottom:0.8rem;
                    background:${allPaid ? '#ecfdf5' : '#fef2f2'};border:1px solid ${allPaid ? '#a7f3d0' : '#fecaca'}">
                    <div>
                        <div style="font-size:0.8rem;color:#6b7280;font-weight:600">${allPaid ? 'ALL FEES CLEARED' : 'TOTAL DUE'}</div>
                        <div style="font-size:1.3rem;font-weight:800;color:${allPaid ? '#065f46' : '#991b1b'}">
                            ${allPaid ? '₹0' : '₹' + pendingAll}
                        </div>
                        <div style="color:#6b7280;font-size:0.85rem;margin-top:0.3rem">
                            Total Fees: ₹${totalFee} ${totalDiscount > 0 ? `| Discount: -₹${totalDiscount} | Net: ₹${totalFee - totalDiscount}` : ''}<br>
                            Paid: ₹${totalPaidAll}
                        </div>
                    </div>
                    <button type="button" onclick="downloadNOC('${sid}')"
                        style="background:#15803d;color:#fff;border:none;border-radius:8px;padding:0.55rem 1.2rem;font-weight:600;cursor:pointer;font-size:0.88rem">
                        📜 Download Fee NOC
                    </button>
                </div>`;
            })()}
            ${data.fees.length ? data.fees.map(f => {
                const totalPaid = f.payments.reduce((s, p) => s + p.amount, 0);
                const netAmount = f.amount - (f.discount || 0);
                const isOverdue = f.dueDate && new Date(f.dueDate) < new Date() && f.status !== 'Paid';
                const historyHtml = f.payments.length ? `
                    <div style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #e5e7eb;font-size:0.82rem">
                        <strong style="color:#4b5563">Payments:</strong>
                        ${f.payments.map(p => `
                            <div style="display:flex;justify-content:space-between;padding:0.2rem 0;color:#374151">
                                <span>₹${p.amount} | ${escapeHtml(p.mode)} | ${new Date(p.date).toLocaleDateString()} | Rec#${escapeHtml(p.receiptNo)} | by ${escapeHtml(p.collectedBy)}</span>
                                ${hasPermission('fees.manage') ? `<button onclick="deletePayment('${f._id}','${p._id}','${sid}')" style="background:none;border:none;color:#ef4444;cursor:pointer" title="Delete">✖</button>` : ''}
                                <button type="button" onclick="downloadReceipt('${escapeHtml(p.receiptNo)}')" style="background:#1a2a4f;color:#fff;border:none;border-radius:4px;padding:2px 8px;font-size:0.75rem;cursor:pointer;margin-right:6px" title="Download Receipt">Receipt</button>
                            </div>
                        `).join('')}
                    </div>` : '';
                return `
                <div style="padding:0.6rem;background:#f9fafb;border-radius:8px;margin-bottom:0.4rem;border-left:4px solid ${f.status==='Paid'?'#10b981':(isOverdue?'#ef4444':'#fbbf24')}">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem">
                        <div style="display:flex;flex-direction:column;gap:0.3rem">
                            <div>
                                <strong>${escapeHtml(f.academicYear)}</strong> | <strong>${escapeHtml(f.category)}</strong> - ${escapeHtml(f.feeType)}
                                <span class="badge ${f.status==='Paid'?'paid':'pending'}" style="margin-left:0.3rem">${f.status}</span>
                                ${isOverdue ? '<span style="color:#ef4444;font-weight:600;font-size:0.85rem"> ⚠️ Overdue</span>' : ''}
                            </div>
                            <div style="font-size:0.85rem;color:#4b5563;">
                                Total Fee: ₹${f.amount} 
                                ${f.discount ? ` | <span style="color:#10b981;">Discount: -₹${f.discount}</span> | Net Fee: ₹${netAmount}` : ''}
                                <br>Paid: ₹${totalPaid} | Pending: ₹${netAmount - totalPaid}
                            </div>
                        </div>
                        <span style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center">
                            ${hasPermission('fees.manage') ? `<button class="action-btn btn-view" onclick="editFee('${f._id}','${escapeHtml(f.feeType)}',${f.amount},${f.discount || 0},'${escapeHtml(f.discountReason || '')}','${escapeHtml(f.category)}','${escapeHtml(f.academicYear)}','${sid}')">✏️ Edit</button>` : ''}
                            ${f.status !== 'Paid' && hasPermission('fees.manage') ? `<button class="action-btn btn-view" onclick="recordPayment('${f._id}',${netAmount},${totalPaid},'${sid}')">💵 Pay</button>` : ''}
                            ${hasPermission('fees.manage') ? `<button class="action-btn btn-delete" onclick="deleteFee('${f._id}','${sid}')">Delete</button>` : ''}
                        </span>
                    </div>
                    ${historyHtml}
                </div>`;
            }).join('') : '<p style="color:#6b7280">No fees</p>'}

            <h4 style="margin-top:1rem">📄 Documents</h4>
            ${data.documents.length ? data.documents.map(d => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem;background:#f9fafb;border-radius:8px;margin-bottom:0.4rem">
                    <span>${escapeHtml(d.title)}</span>
                    <span style="display:flex;gap:0.3rem;align-items:center">
                        ${hasPermission('studentdocs.manage') ? `<button class="action-btn btn-view" onclick="editDoc('${d._id}','${sid}')">✏️ Edit</button>` : ''}
                        <a href="${d.fileUrl}" target="_blank" class="action-btn btn-view" style="padding:0.4rem 0.8rem;font-size:0.85rem;text-decoration:none">View</a>
                        ${hasPermission('studentdocs.manage') ? `<button class="action-btn btn-delete" onclick="deleteStudentDoc('${d._id}','${sid}')">Delete</button>` : ''}
                    </span>
                </div>
            `).join('') : '<p style="color:#6b7280">No documents</p>'}
        `;
    } catch (e) {
        console.error('loadStudentData error:', e);
        container.innerHTML = '<p>Error loading data.</p>';
    }
}

async function deleteResult(id, sid) {
    if (!confirm('Delete this result?')) return;
    await fetch(`${STUDENT_ADMIN}/results/${id}`, { method: 'DELETE', headers });
    loadStudentData(sid);
}

async function deleteFee(id, sid) {
    if (!confirm('Delete this fee?')) return;
    await fetch(`${STUDENT_ADMIN}/fees/${id}`, { method: 'DELETE', headers });
    loadStudentData(sid);
}

async function deleteStudentDoc(id, sid) {
    if (!confirm('Delete this document?')) return;
    await fetch(`${STUDENT_ADMIN}/documents/${id}`, { method: 'DELETE', headers });
    loadStudentData(sid);
}

// ---- Timetable ----
let timetableSchedule = [];


function showTimetableForm() {
    const cls = document.getElementById('manageClass').value;
    if (!cls) return alert('Select a class first');

    timetableSchedule = [];   // reset
    const container = document.getElementById('manageForms');
    container.innerHTML = `
        <h4 style="color:#2563eb">🗓️ Set Timetable — Class ${escapeHtml(cls)}</h4>
        <div style="margin-bottom:0.8rem">
            <input type="text" id="ttSection" placeholder="Section (optional)" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;font-family:inherit">
        </div>
        <select id="ttDay" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;margin-bottom:0.8rem;font-family:inherit">
            <option value="">Select Day...</option>
            <option>Monday</option><option>Tuesday</option><option>Wednesday</option>
            <option>Thursday</option><option>Friday</option><option>Saturday</option>
        </select>
        <div id="periodRows"></div>
        <button class="sd-mini-btn" onclick="addPeriodRow()" style="margin:0.5rem 0">+ Add Period</button><br>
        <button class="sd-mini-btn" onclick="addDayToTimetable()" style="background:#10b981">✓ Add This Day</button>
        <div id="ttPreview" style="margin-top:1rem"></div>
        <button onclick="saveTimetableNew('${escapeHtml(cls)}')" class="btn btn-primary" style="margin-top:1rem">Save Full Timetable</button>
        <div id="ttMsg" style="margin-top:1rem"></div>
    `;
    renderTimetablePreview();
}

// New save — uses selected class (no separate ttClass input needed)
async function saveTimetableNew(cls) {
    if (timetableSchedule.length === 0) return alert('Add at least one day');
    const section = document.getElementById('ttSection').value;
    const res = await fetch(`${STUDENT_ADMIN}/timetable`, {
        method: 'POST', headers,
        body: JSON.stringify({ class: cls, section, schedule: timetableSchedule })
    });
    const r = await res.json();
    const msg = document.getElementById('ttMsg');
    if (r.success) {
        msg.innerHTML = '<div style="color:#065f46;background:#d1fae5;padding:0.8rem;border-radius:5px">✅ Timetable saved</div>';
        timetableSchedule = [];
        setTimeout(() => document.getElementById('manageForms').innerHTML = '', 1800);
    } else {
        msg.innerHTML = `<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ ${r.message}</div>`;
    }
}

function addPeriodRow() {
    const div = document.createElement('div');
    div.className = 'period-row';
    div.style = 'display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:0.5rem;margin-bottom:0.5rem';
    div.innerHTML = `
        <input class="pd-time" placeholder="9:00-10:00" style="padding:0.5rem;border:2px solid #e5e7eb;border-radius:6px">
        <input class="pd-subject" placeholder="Subject" style="padding:0.5rem;border:2px solid #e5e7eb;border-radius:6px">
        <input class="pd-teacher" placeholder="Teacher" style="padding:0.5rem;border:2px solid #e5e7eb;border-radius:6px">
        <button onclick="this.parentElement.remove()" style="background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;padding:0 0.8rem">×</button>
    `;
    document.getElementById('periodRows').appendChild(div);
}

function addDayToTimetable() {
    const day = document.getElementById('ttDay').value;
    if (!day) return alert('Select a day');
    const periods = [];
    document.querySelectorAll('.period-row').forEach(row => {
        const time = row.querySelector('.pd-time').value;
        const subject = row.querySelector('.pd-subject').value;
        const teacher = row.querySelector('.pd-teacher').value;
        if (time && subject) periods.push({ time, subject, teacher });
    });
    if (periods.length === 0) return alert('Add at least one period');
    timetableSchedule = timetableSchedule.filter(d => d.day !== day);
    timetableSchedule.push({ day, periods });
    document.getElementById('periodRows').innerHTML = '';
    document.getElementById('ttDay').value = '';
    renderTimetablePreview();
}

function renderTimetablePreview() {
    const preview = document.getElementById('ttPreview');
    if (timetableSchedule.length === 0) { preview.innerHTML = ''; return; }
    preview.innerHTML = '<strong>Added days:</strong> ' + timetableSchedule.map(d => `<span class="news-category-badge cat-News" style="margin:0.2rem">${d.day} (${d.periods.length} periods)</span>`).join('');
}

async function saveTimetable() {
    if (timetableSchedule.length === 0) return alert('Add at least one day');
    const res = await fetch(`${STUDENT_ADMIN}/timetable`, {
        method: 'POST', headers,
        body: JSON.stringify({ class: document.getElementById('ttClass').value, section: document.getElementById('ttSection').value, schedule: timetableSchedule })
    });
    const r = await res.json();
    if (r.success) {
        document.getElementById('ttMsg').innerHTML = '<div style="color:#065f46;background:#d1fae5;padding:0.8rem;border-radius:5px">✅ Timetable saved</div>';
        timetableSchedule = [];
        renderTimetablePreview();
        document.getElementById('ttClass').value = '';
        document.getElementById('ttSection').value = '';
    } else {
        document.getElementById('ttMsg').innerHTML = `<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ ${r.message}</div>`;
    }
}





// ============ PERMISSIONS ============
const ALL_PERMISSIONS = [
    { key: 'applications.view', label: 'View Applications', category: 'Applications' },
    { key: 'applications.edit', label: 'Edit App Status', category: 'Applications' },
    { key: 'applications.delete', label: 'Delete Applications', category: 'Applications' },
    { key: 'applications.export', label: 'Export Applications', category: 'Applications' },
    { key: 'messages.view', label: 'View Messages', category: 'Messages' },
    { key: 'messages.delete', label: 'Delete Messages', category: 'Messages' },
    { key: 'gallery.add', label: 'Add Photos', category: 'Gallery' },
    { key: 'gallery.edit', label: 'Edit Photos', category: 'Gallery' },
    { key: 'gallery.delete', label: 'Delete Photos', category: 'Gallery' },
    { key: 'news.add', label: 'Add News', category: 'News & Events' },
    { key: 'news.edit', label: 'Edit News', category: 'News & Events' },
    { key: 'news.delete', label: 'Delete News', category: 'News & Events' },
    { key: 'documents.add', label: 'Upload Public Docs', category: 'Public Documents' },
    { key: 'documents.delete', label: 'Delete Public Docs', category: 'Public Documents' },
    { key: 'students.view', label: 'View Students', category: 'Student Management' },
    { key: 'students.add', label: 'Add Students', category: 'Student Management' },
    { key: 'students.edit', label: 'Edit/Promote Students', category: 'Student Management' },
    { key: 'students.delete', label: 'Delete Students', category: 'Student Management' },
    { key: 'students.export', label: 'Export Students', category: 'Student Management' },
    { key: 'results.manage', label: 'Manage Results', category: 'Student Management' },
    { key: 'fees.manage', label: 'Manage Fees', category: 'Student Management' },
    { key: 'attendance.manage', label: 'Manage Attendance', category: 'Student Management' },
    { key: 'timetable.manage', label: 'Manage Timetable', category: 'Student Management' },
    { key: 'studentdocs.manage', label: 'Manage Student Docs', category: 'Student Management' },
    { key: 'reports.view', label: 'View Finance Reports', category: 'Reports & Logs' },
    { key: 'audit.view', label: 'View Audit Logs', category: 'Reports & Logs' },
    { key: 'staff.view', label: 'View Staff Directory', category: 'Staff Management' },
    { key: 'staff.create', label: 'Create Staff', category: 'Staff Management' },
    { key: 'staff.edit.profile', label: 'Edit Staff Profile', category: 'Staff Management' },
    { key: 'staff.edit.permissions', label: 'Edit Staff Permissions', category: 'Staff Management' },
    { key: 'staff.reset.password', label: 'Reset Staff Password', category: 'Staff Management' },
    { key: 'staff.delete', label: 'Delete Staff', category: 'Staff Management' },
    { key: 'staff.payroll.manage', label: 'Manage Staff Payroll', category: 'Staff Management' },
    { key: 'staff.attendance.approve', label: 'Approve Staff Attendance', category: 'Staff Management' }
];

const myRole = adminInfo.role || 'admin';
const myPermissions = adminInfo.permissions || [];

function hasPermission(perm) {
    if (myRole === 'superadmin') return true;
    return myPermissions.includes(perm);
}

function applyTabPermissions() {
    const tabMap = {
        'applications': ['applications.view', 'applications.edit', 'applications.delete', 'applications.export'],
        'messages': ['messages.view', 'messages.delete'],
        'gallery': ['gallery.add', 'gallery.edit', 'gallery.delete'],
        'news': ['news.add', 'news.edit', 'news.delete'],
        'documents': ['documents.add', 'documents.delete'],
        'students': ['students.view', 'students.add', 'students.edit', 'students.delete', 'students.export', 'results.manage', 'fees.manage', 'attendance.manage', 'timetable.manage', 'studentdocs.manage'],
        'admins': ['staff.view', 'staff.create', 'staff.edit.profile', 'staff.edit.permissions', 'staff.reset.password', 'staff.delete', 'staff.attendance.approve', 'staff.payroll.manage']
    };

    document.querySelectorAll('.tab-btn').forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        const match = onclick.match(/showTab\('([\w-]+)'/);
        if (!match) return;
        const tab = match[1];
        
        
        if (tab === 'audit') {
            btn.style.display = hasPermission('audit.view') ? '' : 'none';
            return;
        }
        if (tab === 'report') {
            btn.style.display = hasPermission('reports.view') ? '' : 'none';
            return;
        }
        if (tab === 'teacher-workspace') {
            btn.style.display = (myRole !== 'superadmin') ? '' : 'none'; // Hide from Superadmins
            return;
        }
        const req = tabMap[tab];
        if (!req) return;
        const allowed = Array.isArray(req) ? req.some(p => hasPermission(p)) : hasPermission(req);
        btn.style.display = allowed ? '' : 'none';
    });

    

    // Auto-open first visible tab
    const firstVisible = [...document.querySelectorAll('.tab-btn')].find(b => b.style.display !== 'none');
    if (firstVisible) firstVisible.click();
}

function applyStudentSectionPermissions() {
    const permMap = {
        'applications': ['applications.view', 'applications.edit', 'applications.delete', 'applications.export'],
        'messages': ['messages.view', 'messages.delete'],
        'gallery': ['gallery.add', 'gallery.edit', 'gallery.delete'],
        'news': ['news.add', 'news.edit', 'news.delete'],
        'documents': ['documents.add', 'documents.delete'],
        'students.list': ['students.view', 'students.add', 'students.edit', 'students.delete', 'students.export', 'results.manage', 'fees.manage', 'attendance.manage', 'timetable.manage', 'studentdocs.manage'],
        'students.manage': ['students.add', 'students.edit', 'students.delete', 'results.manage', 'fees.manage', 'attendance.manage', 'timetable.manage', 'studentdocs.manage'],
        'students.bulk': ['attendance.manage', 'fees.manage', 'students.edit'],
        'students.timetable': ['timetable.manage']
    };

    document.querySelectorAll('[data-perm]').forEach(el => {
        const perm = el.getAttribute('data-perm');
        
        // Automatically translate old HTML tags to our new granular logic
        if (permMap[perm]) {
            const allowed = permMap[perm].some(p => hasPermission(p));
            el.style.display = allowed ? '' : 'none';
            return;
        }
        
        el.style.display = hasPermission(perm) ? '' : 'none';
    });
}

function applyStatsPermissions() {
    const appStats = document.getElementById('totalApps')?.closest('.stat-card');
    const pendStats = document.getElementById('pendingApps')?.closest('.stat-card');
    const msgStats = document.getElementById('totalMsgs')?.closest('.stat-card');
    const unreadStats = document.getElementById('unreadMsgs')?.closest('.stat-card');
    if (appStats) appStats.style.display = hasPermission('applications.view') ? '' : 'none';
    if (pendStats) pendStats.style.display = hasPermission('applications.view') ? '' : 'none';
    if (msgStats) msgStats.style.display = hasPermission('messages.view') ? '' : 'none';
    if (unreadStats) unreadStats.style.display = hasPermission('messages.view') ? '' : 'none';
}


async function loadAdmins() {
    try {
        const res = await fetch(`${API_URL}/auth/admins`, { headers });
        const data = await res.json();
        if (!data.success) return;
        const list = document.getElementById('adminsList');
        
        list.innerHTML = data.admins.map(a => `
            <div style="background:white;padding:1.5rem;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.08); display:flex; flex-direction:column; gap:0.8rem;">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <h4 style="margin:0; font-size:1.1rem;">${escapeHtml(a.realName || a.username)} <small style="color:#6b7280; font-size:0.85rem;">(${escapeHtml(a.employeeId || 'No ID')})</small> ${a.role==='superadmin' ? '<span style="color:#fbbf24; font-size:0.8rem; background:#fef3c7; padding:2px 6px; border-radius:4px; margin-left:5px;">★ Superadmin</span>' : ''}</h4>
                        <div style="font-size:0.85rem; color:#4b5563; margin-top:0.3rem;">
                            <div><strong>Username:</strong> ${escapeHtml(a.username)} | <strong>Email:</strong> ${escapeHtml(a.email)}</div>
                            <div><strong>Phone:</strong> ${escapeHtml(a.phone || '-')} | <strong>Joined:</strong> ${a.joiningDate ? new Date(a.joiningDate).toLocaleDateString() : '-'}</div>
                            <div><strong>Qual:</strong> ${escapeHtml(a.qualifications || '-')} | <strong>Salary:</strong> ₹${a.basicSalary || 0}</div>
                        </div>
                    </div>
                    ${a.role !== 'superadmin' ? `
                        <div>
                            <button class="action-btn btn-view" onclick='openEditAdminModal(${JSON.stringify(a).replace(/'/g, "&#39;")})'>⚙️ Edit</button>
                            <button class="action-btn btn-delete" onclick="deleteAdmin('${a._id}')">Delete</button>
                        </div>
                    ` : ''}
                </div>
                ${a.role !== 'superadmin' ? `
                    <div style="border-top: 1px solid #f3f4f6; padding-top:0.5rem;">
                        <span style="font-size:0.85rem; color:#4b5563; font-weight:600;">Permissions:</span>
                        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
                            ${a.permissions.length 
                                ? a.permissions.map(p => `<span class="news-category-badge cat-News" style="margin:0; font-size:0.75rem;">${p}</span>`).join('') 
                                : '<span style="color:#9ca3af; font-size:0.85rem; font-style:italic;">No permissions assigned</span>'
                            }
                        </div>
                    </div>
                ` : ''}
            </div>
        `).join('');

        const historyStaffSelect = document.getElementById('historyStaffSelect');
        if (historyStaffSelect) {
            historyStaffSelect.innerHTML = '<option value="">Select Staff Member...</option>' + 
                data.admins.filter(a => a.role !== 'superadmin').map(a => `<option value="${a._id}">${escapeHtml(a.realName || a.username)} (${escapeHtml(a.employeeId || 'No ID')})</option>`).join('');
        }
        const monthInput = document.getElementById('historyMonthSelect');
        if (monthInput && !monthInput.value) {
            const now = new Date();
            monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
    } catch (e) { console.error(e); }
}

function renderPermCheckboxes() {
    const el = document.getElementById('permCheckboxes');
    if (!el) return;
    
    const grouped = ALL_PERMISSIONS.reduce((acc, p) => {
        acc[p.category] = acc[p.category] || [];
        acc[p.category].push(p);
        return acc;
    }, {});
    el.innerHTML = Object.entries(grouped).map(([category, perms]) => `
        <div>
            <div class="perm-category" onclick="this.nextElementSibling.classList.toggle('active'); this.querySelector('span').textContent = this.querySelector('span').textContent === '▼' ? '▶' : '▼';">
                ${category}<span>▶</span>
            </div>
            <div class="perm-category-content">
                ${perms.map(p => `
                    <label style="display:flex;align-items:center;gap:0.4rem;padding:0.4rem;background:#f9fafb;border-radius:6px; margin-top: 0.5rem;">
                        <input type="checkbox" value="${p.key}" class="perm-cb"> ${p.label}
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
}

const adminForm = document.getElementById('adminForm');
if (adminForm) {
    adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const permissions = [...document.querySelectorAll('.perm-cb:checked')].map(cb => cb.value);
        const data = Object.fromEntries(new FormData(adminForm));
        data.permissions = permissions;
        const msg = document.getElementById('adminMsg');
        try {
            const res = await fetch(`${API_URL}/auth/admins`, { method: 'POST', headers, body: JSON.stringify(data) });
            const r = await res.json();
            if (r.success) {
                msg.innerHTML = '<div style="color:#065f46;background:#d1fae5;padding:0.8rem;border-radius:5px">✅ Sub-admin created!</div>';
                adminForm.reset();
                loadAdmins();
            } else {
                msg.innerHTML = `<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ ${r.message}</div>`;
            }
        } catch (err) {
            msg.innerHTML = '<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ Failed</div>';
        }
        setTimeout(() => msg.innerHTML = '', 4000);
    });
}

async function deleteAdmin(id) {
    if (!confirm('Delete this sub-admin?')) return;
    await fetch(`${API_URL}/auth/admins/${id}`, { method: 'DELETE', headers });
    loadAdmins();
}


// ---- EDIT SUB-ADMIN MODAL LOGIC ----

function openEditAdminModal(admin) {
    document.getElementById('editAdminId').value = admin._id;
    document.getElementById('editAdminUsername').textContent = admin.username;
    document.getElementById('editAdminPassword').value = ''; 
    document.getElementById('editAdminMsg').innerHTML = '';

    const profileFields = ['editAdminRealName', 'editAdminEmployeeId', 'editAdminPhone', 'editAdminQualifications', 'editAdminJoiningDate', 'editAdminBasicSalary'];
    const canEditProfile = hasPermission('staff.edit.profile');
    profileFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const key = id.replace('editAdmin', '').charAt(0).toLowerCase() + id.replace('editAdmin', '').slice(1);
            el.value = admin[key] ? (el.type === 'date' ? admin[key].split('T')[0] : admin[key]) : '';
            el.disabled = !canEditProfile;
        }
    });
    
    const el = document.getElementById('editPermCheckboxes');
    const grouped = ALL_PERMISSIONS.reduce((acc, p) => { acc[p.category] = acc[p.category] || []; acc[p.category].push(p); return acc; }, {});
    el.innerHTML = Object.entries(grouped).map(([category, perms]) => `
        <div>
            <div class="perm-category" onclick="this.nextElementSibling.classList.toggle('active'); this.querySelector('span').textContent = this.querySelector('span').textContent === '▼' ? '▶' : '▼';">
                ${category}<span>▶</span>
            </div>
            <div class="perm-category-content">
                ${perms.map(p => `
                    <label style="display:flex;align-items:center;gap:0.4rem;padding:0.4rem;background:#f9fafb;border-radius:6px; margin-top: 0.5rem; cursor:pointer;">
                        <input type="checkbox" value="${p.key}" class="edit-perm-cb" ${admin.permissions.includes(p.key) ? 'checked' : ''}> ${p.label}
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    const canEditPerms = hasPermission('staff.edit.permissions');
    el.querySelectorAll('input').forEach(cb => cb.disabled = !canEditPerms);

    const pwdInput = document.getElementById('editAdminPassword');
    if (pwdInput) pwdInput.disabled = !hasPermission('staff.reset.password');

    document.getElementById('editAdminForm').querySelector('button[type="submit"]').style.display = (canEditProfile || canEditPerms || hasPermission('staff.reset.password')) ? '' : 'none';

    document.getElementById('editAdminModal').classList.add('active');
}

function closeEditAdminModal() {
    document.getElementById('editAdminModal').classList.remove('active');
}

const editAdminForm = document.getElementById('editAdminForm');
if (editAdminForm) {
    editAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const adminId = document.getElementById('editAdminId').value;
        const newPassword = document.getElementById('editAdminPassword').value.trim();
        const permissions = [...document.querySelectorAll('.edit-perm-cb:checked')].map(cb => cb.value);
        
        const payload = {};
        if (hasPermission('staff.edit.permissions')) payload.permissions = permissions;
        if (hasPermission('staff.edit.profile')) {
            payload.realName = document.getElementById('editAdminRealName').value;
            payload.employeeId = document.getElementById('editAdminEmployeeId').value;
            payload.phone = document.getElementById('editAdminPhone').value;
            payload.qualifications = document.getElementById('editAdminQualifications').value;
            payload.joiningDate = document.getElementById('editAdminJoiningDate').value;
            payload.basicSalary = document.getElementById('editAdminBasicSalary').value;
        }

        const msg = document.getElementById('editAdminMsg');
        
        const btn = editAdminForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        
        try {
            if (Object.keys(payload).length > 0) {
                const permRes = await fetch(`${API_URL}/auth/admins/${adminId}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
                const permResult = await permRes.json();
                if (!permResult.success) throw new Error(permResult.message);
            }

            if (newPassword && hasPermission('staff.reset.password')) {
                const pwdRes = await fetch(`${API_URL}/auth/admins/${adminId}/reset-password`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ newPassword })
                });
                const pwdResult = await pwdRes.json();
                if (!pwdResult.success) {
                    throw new Error(pwdResult.message);
                }
            }

            msg.innerHTML = '<div style="color:#065f46;background:#d1fae5;padding:0.8rem;border-radius:5px">✅ Sub-admin updated successfully!</div>';
            loadAdmins(); 
            
            setTimeout(() => {
                closeEditAdminModal();
            }, 1500);

        } catch (err) {
            msg.innerHTML = `<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ ${err.message || 'Failed to update admin'}</div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save All Changes';
        }
    });
}

document.getElementById('editAdminModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'editAdminModal') closeEditAdminModal();
});


// ============ CHANGE PASSWORD (all users can change their own) ============
const cpBtn = document.getElementById('changePwdBtn');
if (cpBtn) cpBtn.style.display = '';

function openChangePassword() {
    document.getElementById('pwdModal').classList.add('active');
}

function closeChangePassword() {
    document.getElementById('pwdModal').classList.remove('active');
    document.getElementById('currentPwd').value = '';
    document.getElementById('newPwd').value = '';
    document.getElementById('confirmPwd').value = '';
    document.getElementById('pwdMsg').innerHTML = '';
}

async function submitChangePassword() {
    const currentPassword = document.getElementById('currentPwd').value;
    const newPassword = document.getElementById('newPwd').value;
    const confirmPwd = document.getElementById('confirmPwd').value;
    const msg = document.getElementById('pwdMsg');

    if (!currentPassword || !newPassword) {
        msg.innerHTML = '<div style="color:#991b1b">❌ Fill all fields</div>';
        return;
    }
    if (newPassword !== confirmPwd) {
        msg.innerHTML = '<div style="color:#991b1b">❌ New passwords do not match</div>';
        return;
    }
    if (newPassword.length < 6) {
        msg.innerHTML = '<div style="color:#991b1b">❌ Min 6 characters</div>';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/change-password`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const r = await res.json();
        if (r.success) {
            msg.innerHTML = '<div style="color:#065f46">✅ Password changed! Logging out...</div>';
            setTimeout(() => logout(), 2000);
        } else {
            msg.innerHTML = `<div style="color:#991b1b">❌ ${r.message}</div>`;
        }
    } catch (e) {
        msg.innerHTML = '<div style="color:#991b1b">❌ Server error</div>';
    }
}

// ==========================================
// NEW FEATURES: BULK UPLOAD, EDIT, RESET PWD
// ==========================================

// 1. Bulk Upload
document.getElementById('bulkUploadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('bulkStudentFile');
    if (!fileInput.files.length) return alert('Please select a file first.');

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    const msg = document.getElementById('bulkUploadMsg');
    msg.style.color = '#2563eb';
    msg.innerHTML = '⏳ Uploading and processing... please wait.';

    try {
        const res = await fetch(`${API_URL}/student/bulk`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const result = await res.json();
        
        if (result.success) {
            msg.innerHTML = `<span style="color:#10b981">✅ ${result.message}</span>`;
            fileInput.value = ''; 
            loadStudentsAdmin(); 
        } else {
            msg.innerHTML = `<span style="color:#ef4444">❌ ${result.message}</span>`;
        }
    } catch (error) {
        msg.innerHTML = '<span style="color:#ef4444">❌ Server error during upload.</span>';
    }
});

// 2. Edit Student
window.openEditStudentModal = function(id, name, roll, studentClass, section, parent, phone) {
    document.getElementById('editStudentId').value = id;
    document.getElementById('editStudentName').value = name || '';
    document.getElementById('editStudentRoll').value = roll || '';
    document.getElementById('editStudentClass').value = studentClass || '';
    document.getElementById('editStudentSection').value = section || '';
    document.getElementById('editStudentParent').value = parent || '';
    document.getElementById('editStudentPhone').value = phone || '';
    document.getElementById('editStudentModal').classList.add('active');
};

document.getElementById('editStudentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editStudentId').value;
    const msg = document.getElementById('editStudentMsg');
    
    const data = {
        name: document.getElementById('editStudentName').value,
        rollNumber: document.getElementById('editStudentRoll').value,
        studentClass: document.getElementById('editStudentClass').value,
        section: document.getElementById('editStudentSection').value,
        parentName: document.getElementById('editStudentParent').value,
        phone: document.getElementById('editStudentPhone').value,
    };

    msg.innerHTML = '⏳ Saving...';
    try {
        const res = await fetch(`${API_URL}/student/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data)
        });
        const result = await res.json();
        
        if (result.success) {
            msg.innerHTML = '<span style="color:#10b981">✅ Updated successfully!</span>';
            setTimeout(() => {
                document.getElementById('editStudentModal').classList.remove('active');
                msg.innerHTML = '';
                loadStudentsAdmin();
            }, 1000);
        } else {
            msg.innerHTML = `<span style="color:#ef4444">❌ ${result.message}</span>`;
        }
    } catch (error) {
        msg.innerHTML = '<span style="color:#ef4444">❌ Error saving student.</span>';
    }
});

// 3. Reset Password
window.openResetPwdModal = function(id, name) {
    document.getElementById('resetPwdStudentId').value = id;
    document.getElementById('resetPwdStudentName').innerText = name;
    document.getElementById('newStudentPassword').value = ''; 
    document.getElementById('resetStudentPwdModal').classList.add('active');
};

document.getElementById('resetStudentPwdForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('resetPwdStudentId').value;
    const password = document.getElementById('newStudentPassword').value;
    const msg = document.getElementById('resetStudentPwdMsg');

    if (password.length < 6) return msg.innerHTML = '<span style="color:#ef4444">❌ Min 6 characters.</span>';

    msg.innerHTML = '<span style="color:#2563eb">⏳ Resetting...</span>';

    try {
        const res = await fetch(`${API_URL}/student/${id}/reset-password`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ password })
        });
        const result = await res.json();
        
        if (result.success) {
            msg.innerHTML = '<span style="color:#10b981">✅ Password reset!</span>';
            setTimeout(() => {
                document.getElementById('resetStudentPwdModal').classList.remove('active');
                msg.innerHTML = '';
            }, 1000);
        } else {
            msg.innerHTML = `<span style="color:#ef4444">❌ ${result.message}</span>`;
        }
    } catch (error) {
        msg.innerHTML = '<span style="color:#ef4444">❌ Server error.</span>';
    }
});


// 4. Export Students to CSV
window.exportStudents = async function() {
    if (!hasPermission('students.export')) return alert('Permission denied');
    
    try {
        const btn = document.querySelector('[onclick="exportStudents()"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Preparing CSV...';
        btn.disabled = true;

        const res = await fetch(`${STUDENT_ADMIN}/students-export`, { headers });
        const data = await res.json();
        
        if (!data.success || data.students.length === 0) {
            alert('No students to export.');
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }
        
        const cols = ['Name', 'Roll Number', 'Class', 'Section', 'Parent Name', 'Phone'];
        const rows = data.students.map(s => [
            s.name || '', s.rollNumber || '', s.class || '', 
            s.section || '', s.parentName || '', s.phone || ''
        ]);
        
        let csv = cols.join(',') + '\n';
        rows.forEach(row => { 
            csv += row.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',') + '\n'; 
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AJS_Students_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        btn.innerHTML = originalText;
        btn.disabled = false;
    } catch (e) {
        console.error(e);
        alert('Export failed');
    }
};




function recordPayment(feeId, amount, paidSoFar, sid) {
    const pending = amount - paidSoFar;
    const payAmount = prompt(`Amount paying now (Pending: ₹${pending}):`, pending);
    if (payAmount === null || !payAmount.trim()) return;
    const mode = prompt('Mode (Cash/Online/Cheque/Bank Transfer):', 'Cash');
    if (mode === null) return;
    const receiptNo = prompt('Receipt Number (required):', '');
    if (!receiptNo) return alert('Receipt number required');
    const collectedBy = prompt('Collected By (name):', adminInfo.username);
    if (collectedBy === null) return;
    const date = prompt('Payment Date (YYYY-MM-DD) or empty for today:', new Date().toISOString().split('T')[0]);
    if (date === null) return;

    fetch(`${STUDENT_ADMIN}/fees/${feeId}/pay`, {
        method: 'POST', headers,
        body: JSON.stringify({ amount: payAmount, mode, receiptNo, collectedBy, date: date || null })
    })
    .then(r => r.json())
    .then(result => {
        if (result.success) loadStudentData(sid);
        else alert('❌ ' + result.message);
    });
}

function editFee(feeId, feeType, amount, discount, discountReason, category, academicYear, sid) {
    const newYear = prompt('Academic Year:', academicYear);
    if (newYear === null) return;
    const newType = prompt('Description:', feeType);
    if (newType === null) return;
    const newAmount = prompt('Total Amount ₹:', amount);
    if (newAmount === null) return;
    const newDiscount = prompt('Discount Amount ₹ (Optional):', discount);
    if (newDiscount === null) return;
    const newDiscountReason = prompt('Discount Reason:', discountReason);
    if (newDiscountReason === null) return;
    const newCategory = prompt('Category:', category);
    if (newCategory === null) return;

    fetch(`${STUDENT_ADMIN}/fees/${feeId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ academicYear: newYear, feeType: newType, amount: Number(newAmount), discount: Number(newDiscount) || 0, discountReason: newDiscountReason, category: newCategory })
    })
    .then(r => r.json())
    .then(result => {
        if (result.success) loadStudentData(sid);
        else alert('❌ ' + result.message);
    });
}

async function deletePayment(feeId, paymentId, sid) {
    if (!confirm('Delete this payment? Fee status will revert.')) return;
    await fetch(`${STUDENT_ADMIN}/fees/${feeId}/pay/${paymentId}`, { method: 'DELETE', headers });
    loadStudentData(sid);
}


async function editResult(resultId, sid) {
    const container = document.getElementById('manageForms');
    container.innerHTML = '<p>Loading result...</p>';
    
    // Fetch current result
    const res = await fetch(`${STUDENT_ADMIN}/results/${resultId}`, { headers });
    const data = await res.json();
    const r = data.result;
    
    const cy = new Date().getFullYear();
    const years = [`${cy-1}-${String(cy).slice(2)}`, `${cy}-${String(cy+1).slice(2)}`];
    
    container.innerHTML = `
        <h4>✏️ Edit Result</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem">
            <input id="editExamName" placeholder="Exam Name *" value="${escapeHtml(r.examName)}" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
            <input id="editExamDate" type="date" value="${r.examDate ? r.examDate.split('T')[0] : ''}" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.8rem">
            <select id="editExamTerm" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
                ${['Term 1','Term 2','Annual','Unit Test','Other'].map(t => `<option ${r.term===t?'selected':''}>${t}</option>`).join('')}
            </select>
            <select id="editAcademicYear" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
                ${years.map(y => `<option ${r.academicYear===y?'selected':''}>${y}</option>`).join('')}
            </select>
        </div>
        <div id="editSubjectRows">
            ${r.subjects.map(s => `
                <div class="subject-row" style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:0.5rem;margin-bottom:0.5rem">
                    <input class="subj-name" value="${escapeHtml(s.subject)}" placeholder="Subject" style="padding:0.5rem;border:2px solid #e5e7eb;border-radius:6px">
                    <input class="subj-obt" type="number" value="${s.marksObtained}" placeholder="Marks" style="padding:0.5rem;border:2px solid #e5e7eb;border-radius:6px">
                    <input class="subj-total" type="number" value="${s.totalMarks}" placeholder="Total" style="padding:0.5rem;border:2px solid #e5e7eb;border-radius:6px">
                    <button onclick="this.parentElement.remove()" style="background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;padding:0 0.8rem">×</button>
                </div>
            `).join('')}
        </div>
        <button class="sd-mini-btn" onclick="addSubjectRow()" style="margin:0.5rem 0">+ Add Subject</button><br>
        <input id="editExamRemark" placeholder="Teacher's Remark" value="${escapeHtml(r.remark || '')}" style="width:100%;padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;margin:0.5rem 0">
        <div style="display:flex;gap:0.5rem;margin-top:0.5rem">
            <button class="btn btn-primary" onclick="saveEditResult('${resultId}','${sid}')">Save Changes</button>
            <button class="btn" style="background:#6b7280;color:white" onclick="loadStudentData('${sid}')">Cancel</button>
        </div>
        <div id="editResultMsg" style="margin-top:0.5rem"></div>
    `;
}

async function saveEditResult(resultId, sid) {
    const subjects = [];
    document.querySelectorAll('.subject-row').forEach(row => {
        const name = row.querySelector('.subj-name').value;
        const obt = row.querySelector('.subj-obt').value;
        const total = row.querySelector('.subj-total').value;
        if (name && obt !== '' && total !== '') {
            subjects.push({ subject: name, marksObtained: Number(obt), totalMarks: Number(total) });
        }
    });
    if (subjects.length === 0) return alert('Add at least one subject');
    const examName = document.getElementById('editExamName').value.trim();
    if (!examName) return alert('Enter exam name');

    const msg = document.getElementById('editResultMsg');
    const res = await fetch(`${STUDENT_ADMIN}/results/${resultId}`, {
        method: 'PUT', headers,
        body: JSON.stringify({
            examName,
            term: document.getElementById('editExamTerm').value,
            academicYear: document.getElementById('editAcademicYear').value,
            examDate: document.getElementById('editExamDate').value || null,
            subjects,
            remark: document.getElementById('editExamRemark').value
        })
    });
    const r = await res.json();
    if (r.success) {
        msg.innerHTML = '<span style="color:#065f46">✅ Result updated!</span>';
        setTimeout(() => loadStudentData(sid), 1000);
    } else {
        msg.innerHTML = `<span style="color:#991b1b">❌ ${r.message}</span>`;
    }
}


async function editDoc(docId, sid) {
    const container = document.getElementById('manageForms');
    container.innerHTML = '<p>Loading document...</p>';

    const res = await fetch(`${STUDENT_ADMIN}/documents/${docId}`, { headers });
    const data = await res.json();
    const d = data.document;

    container.innerHTML = `
        <h4>✏️ Edit Document</h4>
        <div style="margin-bottom:0.8rem">
            <label style="font-weight:600;display:block;margin-bottom:0.3rem">Title *</label>
            <input id="editDocTitle" value="${escapeHtml(d.title)}" style="width:100%;padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
        </div>
        <div style="margin-bottom:0.8rem">
            <label style="font-weight:600;display:block;margin-bottom:0.3rem">Replace File (optional)</label>
            <input type="file" id="editDocFile" accept=".pdf" style="width:100%;padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;background:white">
            <small style="color:#6b7280">Leave empty to keep existing file</small>
        </div>
        <div style="display:flex;gap:0.5rem">
            <button class="btn btn-primary" onclick="saveEditDoc('${docId}','${sid}')">Save Changes</button>
            <button class="btn" style="background:#6b7280;color:white" onclick="loadStudentData('${sid}')">Cancel</button>
        </div>
        <div id="editDocMsg" style="margin-top:0.5rem"></div>
    `;
}

async function saveEditDoc(docId, sid) {
    const msg = document.getElementById('editDocMsg');
    const title = document.getElementById('editDocTitle').value.trim();
    if (!title) return alert('Enter title');

    const file = document.getElementById('editDocFile').files[0];

    if (file) {
        // Replace file
        const fd = new FormData();
        fd.append('title', title);
        fd.append('file', file);
        const res = await fetch(`${STUDENT_ADMIN}/documents/${docId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd
        });
        const r = await res.json();
        if (r.success) {
            msg.innerHTML = '<span style="color:#065f46">✅ Updated!</span>';
            setTimeout(() => loadStudentData(sid), 1000);
        } else {
            msg.innerHTML = `<span style="color:#991b1b">❌ ${r.message}</span>`;
        }
    } else {
        // Title only
        const res = await fetch(`${STUDENT_ADMIN}/documents/${docId}`, {
            method: 'PUT', headers,
            body: JSON.stringify({ title })
        });
        const r = await res.json();
        if (r.success) {
            msg.innerHTML = '<span style="color:#065f46">✅ Updated!</span>';
            setTimeout(() => loadStudentData(sid), 1000);
        } else {
            msg.innerHTML = `<span style="color:#991b1b">❌ ${r.message}</span>`;
        }
    }
}


function showBulkAttendanceForm() {
    const selectedIds = [...document.querySelectorAll('.manage-student-cb:checked')].map(cb => cb.value);
    if (selectedIds.length === 0) return alert('Select students first');
    const today = new Date().toISOString().split('T')[0];
    const container = document.getElementById('manageForms');
    container.innerHTML = `
        <h4 style="color:#2563eb">📅 Bulk Attendance (${selectedIds.length} students)</h4>
        <div style="margin-bottom:0.8rem">
            <input id="bulkAttDate" type="date" value="${today}" onchange="loadBulkAttRows()" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
        </div>
        <div id="bulkAttRows"></div>
        <button class="btn btn-primary" style="margin-top:0.8rem" onclick="submitBulkAttendanceNew()">Submit Attendance</button>
        <div id="bulkAttMsg" style="margin-top:0.5rem"></div>
    `;
    loadBulkAttRows();
}

async function loadBulkAttRows() {
    const selected = [...document.querySelectorAll('.manage-student-cb:checked')];
    const date = document.getElementById('bulkAttDate').value;
    const rows = document.getElementById('bulkAttRows');

    // build students array from selected checkboxes (using classStudents)
    const students = selected.map(cb => classStudents.find(s => s._id === cb.value)).filter(Boolean);

    // fetch existing attendance for the selected class+date (reuse existing endpoint via class)
    let existing = {};
    if (date && students.length) {
        const cls = students[0].class;
        try {
            const res = await fetch(`${STUDENT_ADMIN}/attendance/check?class=${cls}&date=${date}`, { headers });
            const data = await res.json();
            existing = data.existing || {};
        } catch (e) { console.error(e); }
    }
    const alreadyMarked = Object.keys(existing).length > 0;

    rows.innerHTML = `
        ${alreadyMarked ? '<p style="color:#92400e;background:#fef3c7;padding:0.6rem;border-radius:6px;font-size:0.85rem">⚠️ Some already marked for this date. Submitting will update.</p>' : ''}
        <p style="color:#6b7280;font-size:0.85rem">All Present by default. Change as needed.</p>
        <div style="display:grid;gap:0.4rem;max-height:300px;overflow-y:auto">
            ${students.map(s => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.7rem;background:#f9fafb;border-radius:8px;flex-wrap:wrap;gap:0.5rem">
                    <span style="flex:1;min-width:150px"><strong>${escapeHtml(s.rollNumber)}</strong> - ${escapeHtml(s.name)}</span>
                    <div style="display:flex;gap:0.5rem">
                        <input id="batt-rem-${s._id}" placeholder="Remarks" value="${escapeHtml(existing[s._id]?.remarks || '')}" style="padding:0.4rem;border:2px solid #e5e7eb;border-radius:6px;width:120px">
                        <select id="batt-${s._id}" style="padding:0.4rem;border:2px solid #e5e7eb;border-radius:6px">
                            <option value="Present" ${(existing[s._id]?.status||'Present')==='Present'?'selected':''}>Present</option>
                            <option value="Absent" ${existing[s._id]?.status==='Absent'?'selected':''}>Absent</option>
                            <option value="Leave" ${existing[s._id]?.status==='Leave'?'selected':''}>Leave</option>
                            <option value="Half-Day" ${existing[s._id]?.status==='Half-Day'?'selected':''}>Half-Day</option>
                        </select>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function submitBulkAttendanceNew() {
    const date = document.getElementById('bulkAttDate').value;
    const msg = document.getElementById('bulkAttMsg');
    if (!date) return alert('Select a date');
    const selected = [...document.querySelectorAll('.manage-student-cb:checked')];
    const students = selected.map(cb => classStudents.find(s => s._id === cb.value)).filter(Boolean);
    const records = students.map(s => ({
        studentId: s._id,
        status: document.getElementById(`batt-${s._id}`).value,
        remarks: document.getElementById(`batt-rem-${s._id}`).value
    }));

    msg.innerHTML = '<span style="color:#2563eb">⏳ Saving...</span>';
    const res = await fetch(`${STUDENT_ADMIN}/attendance/bulk`, {
        method: 'POST', headers, body: JSON.stringify({ date, records })
    });
    const r = await res.json();
    if (r.success) {
        msg.innerHTML = `<span style="color:#065f46">✅ ${r.message}</span>`;
        setTimeout(() => document.getElementById('manageForms').innerHTML = '', 1800);
    } else {
        msg.innerHTML = `<span style="color:#991b1b">❌ ${r.message}</span>`;
    }
}


function showBulkFeeForm() {
    if (classStudents.length === 0) return alert('No students in this class');
    const container = document.getElementById('manageForms');
    const cy = new Date().getFullYear();
    const years = [`${cy-1}-${String(cy).slice(2)}`, `${cy}-${String(cy+1).slice(2)}`, 'Previous Years'];

    container.innerHTML = `
        <h4 style="color:#2563eb">💰 Bulk Assign Fee to Class</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem">
            <select id="bfYear" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;font-family:inherit">
                ${years.map(y => `<option>${y}</option>`).join('')}
            </select>
            <select id="bfCategory" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;font-family:inherit">
                <option>Tuition</option><option>Transport</option><option>Exam</option>
                <option>Annual</option><option>Trip</option><option>Library</option><option>Other</option>
            </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem">
            <input id="bfType" placeholder="Description (e.g. Annual Fee)" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;font-family:inherit">
            <input id="bfAmount" type="number" placeholder="Amount ₹" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;font-family:inherit">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem">
            <input id="bfDiscount" type="number" placeholder="Discount ₹ (Optional)" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;font-family:inherit">
            <input id="bfDiscountReason" placeholder="Discount Reason (Optional)" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;font-family:inherit">
        </div>
        
        
        
<input id="bfDue" type="date" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;margin-bottom:0.8rem;font-family:inherit">

        <p style="color:#6b7280;font-size:0.9rem;margin-bottom:0.8rem">This will be assigned to all <strong>${classStudents.length}</strong> students selected above.</p>

        <button class="btn btn-primary" onclick="submitBulkFee()">Assign to Selected Students</button>
        <div id="bfMsg" style="margin-top:0.8rem"></div>
    `;
}


async function submitBulkFee() {
    const feeType = document.getElementById('bfType').value.trim();
    const amount = document.getElementById('bfAmount').value;
    const discount = document.getElementById('bfDiscount').value;
    const discountReason = document.getElementById('bfDiscountReason').value;
    const msg = document.getElementById('bfMsg');

    if (!feeType || !amount) {
        msg.innerHTML = '<span style="color:#991b1b">❌ Enter description and amount</span>';
        return;
    }

    const selectedIds = [...document.querySelectorAll('.manage-student-cb:checked')].map(cb => cb.value);
    if (selectedIds.length === 0) {
        msg.innerHTML = '<span style="color:#991b1b">❌ Select at least one student</span>';
        return;
    }

    if (!confirm(`Assign "${feeType}" ₹${amount} to ${selectedIds.length} students?`)) return;

    const feeData = {
        academicYear: document.getElementById('bfYear').value,
        category: document.getElementById('bfCategory').value,
        feeType,
        amount: Number(amount),
        discount: Number(discount) || 0,
        discountReason: discountReason || '',
        dueDate: document.getElementById('bfDue').value || null
    };

    msg.innerHTML = '<span style="color:#2563eb">⏳ Assigning...</span>';

    try {
        const res = await fetch(`${STUDENT_ADMIN}/fees/bulk-selected`, {
            method: 'POST', headers,
            body: JSON.stringify({ studentIds: selectedIds, ...feeData })
        });
        const r = await res.json();
        if (r.success) {
            msg.innerHTML = `<span style="color:#065f46">✅ ${r.message}</span>`;
            setTimeout(() => document.getElementById('manageForms').innerHTML = '', 2000);
        } else {
            msg.innerHTML = `<span style="color:#991b1b">❌ ${r.message}</span>`;
        }
    } catch (e) {
        msg.innerHTML = '<span style="color:#991b1b">❌ Server error</span>';
    }
}


function toggleAllManage(checked) {
    document.querySelectorAll('.manage-student-cb').forEach(cb => cb.checked = checked);
    onSelectionChange();
}

function onSelectionChange() {
    const selected = [...document.querySelectorAll('.manage-student-cb:checked')];
    const count = selected.length;
    const actions = document.getElementById('manageActions');
    const info = document.getElementById('selectionInfo');
    const forms = document.getElementById('manageForms');

    if (count === 0) {
        actions.style.display = 'none';
        info.textContent = '';
        forms.innerHTML = '';
        return;
    }

    info.textContent = `${count} student(s) selected`;
    actions.style.display = 'flex';

    if (count === 1) {
        // Individual actions
        actions.innerHTML = `
            ${hasPermission('results.manage') ? `<button class="sd-mini-btn" onclick="showManage('result')">📊 Add Result</button>` : ''}
            ${hasPermission('attendance.manage') ? `<button class="sd-mini-btn" onclick="showManage('attendance')">📅 Attendance</button>` : ''}
            ${hasPermission('fees.manage') ? `<button class="sd-mini-btn" onclick="showManage('fee')">💰 Add Fee</button>` : ''}
            ${hasPermission('studentdocs.manage') ? `<button class="sd-mini-btn" onclick="showManage('doc')">📄 Upload Doc</button>` : ''}
            <button class="sd-mini-btn" onclick="showManage('view')">👁️ View/Delete Data</button>
        `;
    } else {
        // Bulk actions only
        actions.innerHTML = `
            ${hasPermission('results.manage') ? `<button class="sd-mini-btn" onclick="showBulkResultConfig()">📊 Bulk Results</button>` : ''}
            ${hasPermission('fees.manage') ? `<button class="sd-mini-btn" onclick="showBulkFeeForm()">💰 Bulk Assign Fee</button>` : ''}
            ${hasPermission('students.edit') ? `<button class="sd-mini-btn" onclick="showBulkPromoteForm()">🎓 Bulk Promote</button>` : ''}
            ${hasPermission('attendance.manage') ? `<button class="sd-mini-btn" onclick="showBulkAttendanceForm()">📅 Bulk Attendance</button>` : ''}
            ${hasPermission('studentdocs.manage') ? `<button class="sd-mini-btn" onclick="showBulkDocForm()">📄 Bulk Upload Doc</button>` : ''}
        `;
        forms.innerHTML = '';
    }
    
    if (hasPermission('timetable.manage')) {
        actions.innerHTML += `<button class="sd-mini-btn" onclick="showTimetableForm()">🗓️ Set Timetable</button>`;
    }

    // Globally append bulk delete if superadmin (works for both single and multiple selections)
    if (adminInfo.role === 'superadmin') {
        actions.innerHTML += `<button class="sd-mini-btn" style="background:#ef4444; margin-left:auto;" onclick="openBulkDeleteModal()">🗑️ Delete Selected</button>`;
    }
}

function getSelectedStudent() {
    const checked = document.querySelector('.manage-student-cb:checked');
    return checked ? checked.value : '';
}

function getSelectedStudents() {
    return [...document.querySelectorAll('.manage-student-cb:checked')].map(cb => cb.value);
}



let auditPage = 1;
async function loadAudit(page = 1) {
    auditPage = page;
    const search = document.getElementById('auditSearch').value;
    const category = document.getElementById('auditCategory').value;
    const params = new URLSearchParams({ page, ...(search && { search }), ...(category && { category }) });
    try {
        const res = await fetch(`${API_URL}/audit?${params}`, { headers });
        const data = await res.json();
        if (!data.success) return;
        const tbody = document.getElementById('auditTable');
        const icons = { FEE: '💰', STUDENT: '🎓', ADMIN: '🔐', AUTH: '🔑' };
        tbody.innerHTML = data.logs.length ? data.logs.map(l => `
            <tr>
                <td><small>${new Date(l.createdAt).toLocaleString()}</small></td>
                <td><strong>${escapeHtml(l.actorName)}</strong>${l.actorRole==='superadmin'?' ⭐':''}</td>
                <td>${escapeHtml(l.action)}</td>
                <td>${escapeHtml(l.targetName || '-')}</td>
                <td>${icons[l.category]||''} ${escapeHtml(l.category)}</td>
            </tr>
        `).join('') : '<tr><td colspan="5" class="empty-state">No logs found</td></tr>';

        document.getElementById('auditPagination').innerHTML = data.pages > 1 ? `
            <button class="sd-mini-btn" ${page===1?'disabled':''} onclick="loadAudit(${page-1})">‹ Prev</button>
            <span style="padding:0.6rem">Page ${page} of ${data.pages}</span>
            <button class="sd-mini-btn" ${page===data.pages?'disabled':''} onclick="loadAudit(${page+1})">Next ›</button>
        ` : '';
    } catch (e) { console.error(e); }
}



async function loadTodayCollection() {
    if (!hasPermission('reports.view')) return;
    try {
        const res = await fetch(`${STUDENT_ADMIN}/today-collection`, { headers });
        const data = await res.json();
        if (data.success) {
            document.getElementById('todayCollection').textContent = `₹${data.total}`;
            document.getElementById('todayCollectionCard').style.display = '';
        }
    } catch (e) { console.error(e); }
}

let lastReportData = null;

// 👇 ADD THESE HERE
let allReportPayments = [];
let reportPayPage = 1;
const PAY_PER_PAGE = 25;

let allDefaulters = [];
let defaulterPage = 1;
const DEF_PER_PAGE = 20;

function getRange() {
    const range = document.getElementById('reportRange').value;
    const today = new Date();
    let from = new Date(), to = new Date();
    if (range === 'today') { /* from=to=today */ }
    else if (range === 'week') { from.setDate(today.getDate() - today.getDay()); }
    else if (range === 'month') { from = new Date(today.getFullYear(), today.getMonth(), 1); }
    else { // custom
        from = new Date(document.getElementById('reportFrom').value);
        to = new Date(document.getElementById('reportTo').value);
    }
    return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
}

function onRangeChange() {
    const custom = document.getElementById('reportRange').value === 'custom';
    document.getElementById('reportFrom').style.display = custom ? '' : 'none';
    document.getElementById('reportTo').style.display = custom ? '' : 'none';
    if (!custom) loadReport();
}

async function downloadReceipt(receiptNo) {
  try {
    const token = localStorage.getItem('adminToken');
const res = await fetch(`${API_URL}/student-admin/receipt/${encodeURIComponent(receiptNo)}`, {
  headers: { Authorization: `Bearer ${token}` },
});
    console.log('Receipt response status:', res.status);
    if (!res.ok) {
      const txt = await res.text();
      console.error('Receipt error body:', txt);
      alert('Could not load receipt: ' + res.status);
      return;
    }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  } catch (err) {
    console.error('downloadReceipt error:', err);
    alert('Error: ' + err.message);
  }
}

async function loadReport() {
    const { from, to } = getRange();
    if (!from || !to || from === 'Invalid Date') return alert('Select valid dates');
    try {
        const res = await fetch(`${STUDENT_ADMIN}/collection-report?from=${from}&to=${to}`, { headers });
        const data = await res.json();
        if (!data.success) return;
        lastReportData = data;
        // after lastReportData = data; add:
            allReportPayments = data.payments;
            reportPayPage = 1;
            renderReportPayments();

        

        const breakdown = (title, obj) => `
            <div class="stat-card">
                <h4 style="color:#2563eb;margin:0 0 0.5rem">${title}</h4>
                ${Object.keys(obj).length ? Object.entries(obj).map(([k,v]) =>
                    `<div style="display:flex;justify-content:space-between;padding:0.2rem 0"><span>${escapeHtml(k)}</span><strong>₹${v}</strong></div>`
                ).join('') : '<small style="color:#9ca3af">No data</small>'}
            </div>`;
        document.getElementById('reportBreakdowns').innerHTML =
            breakdown('By Mode', data.byMode) +
            breakdown('By Category', data.byCategory) +
            breakdown('By Staff', data.byStaff);

        document.getElementById('reportPayments').innerHTML = data.payments.length ? data.payments.map(p => `
            <tr>
                <td>${new Date(p.date).toLocaleDateString()}</td>
                <td>${escapeHtml(p.studentName || '-')} <small style="color:#6b7280">(${escapeHtml(p.rollNumber || '')})</small></td>
                <td>${escapeHtml(p.class || '-')}</td>
                <td>₹${p.amount}</td>
                <td>${escapeHtml(p.mode)}</td>
                <td>${escapeHtml(p.receiptNo)}</td>
                <td>${escapeHtml(p.collectedBy)}</td>
            </tr>
        `).join('') : '<tr><td colspan="7" class="empty-state">No payments in this range</td></tr>';
    } catch (e) { console.error(e); }
}



function renderReportPayments() {
    const total = allReportPayments.length;
    const totalPages = Math.ceil(total / PAY_PER_PAGE) || 1;
    if (reportPayPage > totalPages) reportPayPage = 1;
    const start = (reportPayPage - 1) * PAY_PER_PAGE;
    const items = allReportPayments.slice(start, start + PAY_PER_PAGE);

    document.getElementById('reportPayments').innerHTML = items.length ? items.map(p => `
        <tr>
            <td>${new Date(p.date).toLocaleDateString()}</td>
            <td>${escapeHtml(p.studentName || '-')} <small style="color:#6b7280">(${escapeHtml(p.rollNumber || '')})</small></td>
            <td>${escapeHtml(p.class || '-')}</td>
            <td>₹${p.amount}</td>
            <td>${escapeHtml(p.mode)}</td>
            <td>${escapeHtml(p.receiptNo)}</td>
            <td>${escapeHtml(p.collectedBy)}</td>
        </tr>
    `).join('') : '<tr><td colspan="7" class="empty-state">No payments in this range</td></tr>';

    const pag = document.getElementById('reportPaymentsPagination');
    if (pag) pag.innerHTML = totalPages > 1 ? `
        <button class="sd-mini-btn" ${reportPayPage===1?'disabled':''} onclick="changeReportPayPage(-1)">‹ Prev</button>
        <span style="padding:0.6rem">Page ${reportPayPage} of ${totalPages} (${total} payments)</span>
        <button class="sd-mini-btn" ${reportPayPage===totalPages?'disabled':''} onclick="changeReportPayPage(1)">Next ›</button>
    ` : '';
}
function changeReportPayPage(dir) { reportPayPage += dir; renderReportPayments(); }


async function loadPendingSummary() {
    try {
        const res = await fetch(`${STUDENT_ADMIN}/pending-summary`, { headers });
        const data = await res.json();
        if (!data.success) return;

        // Full-width pending card (label left, amount right)
        document.getElementById('pendingSummary').innerHTML = `
            <div style="background:white;padding:1.3rem 1.6rem;border-radius:10px;
                        box-shadow:0 2px 10px rgba(0,0,0,0.08);border-left:4px solid #ef4444;
                        display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
                <span style="color:#6b7280;font-weight:600;font-size:1.05rem">Total Pending (Overall)</span>
                <h3 style="color:#ef4444;margin:0;font-size:2.2rem">₹${data.totalPending}</h3>
            </div>
        `;

        // Year-wise breakup cards
        const yr = data.byYear;
        if (yr) {
            document.getElementById('pendingByYear').innerHTML = `
                <div style="background:white;padding:1rem 1.2rem;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.06);border-top:3px solid #2563eb">
                    <small style="color:#6b7280">Current FY (${escapeHtml(yr.currentFY)})</small>
                    <h3 style="margin:0.3rem 0 0;color:#991b1b">₹${yr.current}</h3>
                </div>
                <div style="background:white;padding:1rem 1.2rem;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.06);border-top:3px solid #f59e0b">
                    <small style="color:#6b7280">Last FY (${escapeHtml(yr.lastFY)})</small>
                    <h3 style="margin:0.3rem 0 0;color:#991b1b">₹${yr.last}</h3>
                </div>
                <div style="background:white;padding:1rem 1.2rem;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.06);border-top:3px solid #6b7280">
                    <small style="color:#6b7280">Previous Years (Old)</small>
                    <h3 style="margin:0.3rem 0 0;color:#991b1b">₹${yr.older}</h3>
                </div>
            `;
        }
        // Class-wise table
        const tableHtml = data.byClass.length ? `
            <table class="data-table">
                <thead><tr><th>Class</th><th>Pending Amount</th></tr></thead>
                <tbody>
                    ${data.byClass.map(c => `
                        <tr>
                            <td>Class ${escapeHtml(c.class)}</td>
                            <td style="color:#991b1b;font-weight:700">₹${c.pending}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>` : '<p style="color:#6b7280;padding:1rem">No pending dues 🎉</p>';

        const wrap = document.getElementById('pendingByClass');
        if (wrap) wrap.innerHTML = tableHtml;
    } catch (e) { console.error(e); }
}

async function loadDefaulterClasses() {
    try {
        const res = await fetch(`${STUDENT_ADMIN}/classes`, { headers });
        const data = await res.json();
        const sel = document.getElementById('defaulterClass');
        if (sel) sel.innerHTML = '<option value="">All Classes</option>' + data.classes.map(c => `<option value="${c}">Class ${c}</option>`).join('');
    } catch (e) { console.error(e); }
}


async function loadDefaulters() {
    const cls = document.getElementById('defaulterClass')?.value || '';
    try {
        const res = await fetch(`${STUDENT_ADMIN}/defaulters${cls ? '?class=' + cls : ''}`, { headers });
        const data = await res.json();
        if (!data.success) return;
        allDefaulters = data.defaulters;
        defaulterPage = 1;
        renderDefaulters();
    } catch (e) { console.error(e); }
}

function renderDefaulters() {
    const total = allDefaulters.length;
    const totalPages = Math.ceil(total / DEF_PER_PAGE) || 1;
    if (defaulterPage > totalPages) defaulterPage = 1;
    const start = (defaulterPage - 1) * DEF_PER_PAGE;
    const pageItems = allDefaulters.slice(start, start + DEF_PER_PAGE);

    document.getElementById('defaultersTable').innerHTML = pageItems.length ? pageItems.map((d, i) => `
        <tr>
            <td>${start + i + 1}</td>
            <td><strong>${escapeHtml(d.name)}</strong> <small style="color:#6b7280">(${escapeHtml(d.rollNumber)})</small></td>
            <td>${escapeHtml(d.class)} ${escapeHtml(d.section || '')}</td>
            <td>${escapeHtml(d.parentName || '-')}</td>
            <td>${escapeHtml(d.phone || '-')}</td>
            <td style="color:#991b1b;font-weight:700">₹${d.totalPending}</td>
        </tr>
    `).join('') : '<tr><td colspan="6" class="empty-state">No defaulters 🎉</td></tr>';

    const pag = document.getElementById('defaultersPagination');
    if (pag) pag.innerHTML = totalPages > 1 ? `
        <button class="sd-mini-btn" ${defaulterPage===1?'disabled':''} onclick="changeDefaulterPage(-1)">‹ Prev</button>
        <span style="padding:0.6rem">Page ${defaulterPage} of ${totalPages} (${total} defaulters)</span>
        <button class="sd-mini-btn" ${defaulterPage===totalPages?'disabled':''} onclick="changeDefaulterPage(1)">Next ›</button>
    ` : '';
}

function changeDefaulterPage(dir) { defaulterPage += dir; renderDefaulters(); }

function exportReport() {
    if (!lastReportData || !lastReportData.payments.length) return alert('Load a report with data first');
    const cols = ['Date','Student','Roll','Class','Amount','Mode','Receipt','Collected By'];
    const rows = lastReportData.payments.map(p => [
        new Date(p.date).toLocaleDateString(), p.studentName, p.rollNumber, p.class,
        p.amount, p.mode, p.receiptNo, p.collectedBy
    ]);
    let csv = cols.join(',') + '\n';
    rows.forEach(r => { csv += r.map(f => `"${String(f ?? '').replace(/"/g,'""')}"`).join(',') + '\n'; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `collection_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}




function exportDefaulters() {
    if (!allDefaulters || allDefaulters.length === 0) return alert('No defaulters to export.');
    const cols = ['#', 'Student Name', 'Roll Number', 'Class', 'Section', 'Parent Name', 'Phone', 'Total Pending'];
    const rows = allDefaulters.map((d, i) => [
        i + 1, d.name, d.rollNumber, d.class, d.section || '', d.parentName || '', d.phone || '', d.totalPending
    ]);
    let csv = cols.join(',') + '\n';
    rows.forEach(row => { csv += row.map(f => `"${String(f ?? '').replace(/"/g, '""')}"`).join(',') + '\n'; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `defaulters_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}


function showBulkPromoteForm() {
    const selectedIds = [...document.querySelectorAll('.manage-student-cb:checked')].map(cb => cb.value);
    if (selectedIds.length === 0) return alert('Select students first');

    // Auto-suggest next class if all selected are from the same class
    const selectedClasses = [...new Set(
        [...document.querySelectorAll('.manage-student-cb:checked')]
            .map(cb => {
                const s = classStudents.find(st => st._id === cb.value);
                return s ? s.class : null;
            })
    )];
    let suggested = '';
    if (selectedClasses.length === 1 && selectedClasses[0]) {
        const num = parseInt(selectedClasses[0]);
        if (!isNaN(num)) suggested = String(num + 1);
    }

    
    
    const container = document.getElementById('manageForms');
    container.innerHTML = `
        <h4 style="color:#2563eb">🎓 Bulk Promote Students</h4>
        <p style="color:#6b7280;font-size:0.9rem;margin-bottom:0.8rem">
            Promoting <strong>${selectedIds.length}</strong> selected student(s).
            Section will be cleared (reassign later if needed).
        </p>
        <div style="display:grid;grid-template-columns:1fr auto;gap:0.5rem;align-items:center;margin-bottom:0.8rem">
            <input id="promoteClass" placeholder="Promote To Class (e.g. 6, or 'Graduated')" value="${suggested}"
                   style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;font-family:inherit">
            <button class="btn btn-primary" onclick="submitBulkPromote()">Promote</button>
        </div>
        <div id="promoteMsg"></div>
    `;
}

async function submitBulkPromote() {
    const selectedIds = [...document.querySelectorAll('.manage-student-cb:checked')].map(cb => cb.value);
    const newClass = document.getElementById('promoteClass').value.trim();
    const msg = document.getElementById('promoteMsg');

    if (!newClass) {
        msg.innerHTML = '<span style="color:#991b1b">❌ Enter target class</span>';
        return;
    }
    if (!confirm(`Promote ${selectedIds.length} student(s) to Class ${newClass}? Their section will be cleared.`)) return;

    msg.innerHTML = '<span style="color:#2563eb">⏳ Promoting...</span>';
    try {
        const res = await fetch(`${STUDENT_ADMIN}/students/bulk-promote`, {
            method: 'POST', headers,
            body: JSON.stringify({ studentIds: selectedIds, newClass })
        });
        const r = await res.json();
        if (r.success) {
            msg.innerHTML = `<span style="color:#065f46">✅ ${r.message}</span>`;
            setTimeout(() => {
                document.getElementById('manageForms').innerHTML = '';
                loadStudentsAdmin();      // refresh full list
                loadClasses();            // refresh class dropdown
                loadClassStudents();      // refresh current class view
            }, 1500);
        } else {
            msg.innerHTML = `<span style="color:#991b1b">❌ ${r.message}</span>`;
        }
    } catch (e) {
        msg.innerHTML = '<span style="color:#991b1b">❌ Server error</span>';
    }
}

// ============ SUPERADMIN BULK DELETE ============

function openBulkDeleteModal() {
    const selectedIds = [...document.querySelectorAll('.manage-student-cb:checked')].map(cb => cb.value);
    if (selectedIds.length === 0) return alert('Select students first');
    
    document.getElementById('bulkDeleteCount').textContent = selectedIds.length;
    document.getElementById('bulkDeletePwd').value = '';
    document.getElementById('bulkDeleteMsg').innerHTML = '';
    document.getElementById('bulkDeleteModal').classList.add('active');
}

document.getElementById('bulkDeleteForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('bulkDeletePwd').value;
    const selectedIds = [...document.querySelectorAll('.manage-student-cb:checked')].map(cb => cb.value);
    const msg = document.getElementById('bulkDeleteMsg');
    const btn = document.getElementById('bulkDeleteForm').querySelector('button[type="submit"]');

    if (!password) return msg.innerHTML = '<span style="color:#ef4444">❌ Enter password.</span>';

    msg.innerHTML = '<span style="color:#2563eb">⏳ Deleting...</span>';
    btn.disabled = true;

    try {
        const res = await fetch(`${STUDENT_ADMIN}/students/bulk-delete`, {
            method: 'POST', headers,
            body: JSON.stringify({ studentIds: selectedIds, password })
        });
        const result = await res.json();
        
        if (result.success) {
            msg.innerHTML = `<span style="color:#10b981">✅ ${result.message}</span>`;
            setTimeout(() => {
                document.getElementById('bulkDeleteModal').classList.remove('active');
                document.getElementById('manageForms').innerHTML = '';
                loadStudentsAdmin(); 
                loadClassStudents(); 
            }, 1500);
        } else { msg.innerHTML = `<span style="color:#ef4444">❌ ${result.message}</span>`; }
    } catch (error) { msg.innerHTML = '<span style="color:#ef4444">❌ Server error.</span>'; } 
    finally { btn.disabled = false; }
});

// ============ BULK RESULTS ENTRY ============

function showBulkResultConfig() {
    const selectedIds = [...document.querySelectorAll('.manage-student-cb:checked')].map(cb => cb.value);
    if (selectedIds.length === 0) return alert('Select students first');
    const cy = new Date().getFullYear();
    const years = [`${cy-1}-${String(cy).slice(2)}`, `${cy}-${String(cy+1).slice(2)}`];
    
    const container = document.getElementById('manageForms');
    container.innerHTML = `
        <h4 style="color:#2563eb">📊 Bulk Results Entry (${selectedIds.length} students)</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem">
            <input id="brExamName" placeholder="Exam Name (e.g. Term 1) *" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
            <input id="brExamDate" type="date" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.8rem">
            <select id="brExamTerm" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
                <option>Term 1</option><option>Term 2</option><option>Annual</option><option>Unit Test</option><option>Other</option>
            </select>
            <select id="brAcademicYear" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
                ${years.map(y => `<option>${y}</option>`).join('')}
            </select>
        </div>
        
        <h5 style="margin-top:1rem;color:#374151;margin-bottom:0.5rem;">Define Subjects & Max Marks</h5>
        <div id="brSubjectConfigs"></div>
        <button class="sd-mini-btn" onclick="addBrSubjectConfig()" style="margin:0.5rem 0;background:#64748b;">+ Add Subject Column</button>
        
        <div style="margin-top:1rem">
            <button class="btn btn-primary" style="width:100%" onclick="generateBulkResultGrid()">Generate Entry Grid ➔</button>
        </div>
    `;
    addBrSubjectConfig(); // Start with one row
}

function addBrSubjectConfig() {
    const div = document.createElement('div');
    div.className = 'br-subj-config';
    div.style = 'display:grid;grid-template-columns:2fr 1fr auto;gap:0.5rem;margin-bottom:0.5rem';
    div.innerHTML = `
        <input class="br-subj-name" placeholder="Subject Name (e.g. Math)" style="padding:0.5rem;border:2px solid #e5e7eb;border-radius:6px">
        <input class="br-subj-max" type="number" placeholder="Max Marks" style="padding:0.5rem;border:2px solid #e5e7eb;border-radius:6px">
        <button onclick="this.parentElement.remove()" style="background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;padding:0 0.8rem">×</button>
    `;
    document.getElementById('brSubjectConfigs').appendChild(div);
}

let brSubjects = [];
function generateBulkResultGrid() {
    const examName = document.getElementById('brExamName').value.trim();
    if (!examName) return alert('Enter Exam Name');
    
    brSubjects = [];
    document.querySelectorAll('.br-subj-config').forEach(row => {
        const name = row.querySelector('.br-subj-name').value.trim();
        const max = row.querySelector('.br-subj-max').value;
        if (name && max) brSubjects.push({ name, max: Number(max) });
    });
    
    if (brSubjects.length === 0) return alert('Define at least one subject with max marks');
    
    const selectedIds = [...document.querySelectorAll('.manage-student-cb:checked')].map(cb => cb.value);
    const students = selectedIds.map(id => classStudents.find(s => s._id === id)).filter(Boolean);
    const container = document.getElementById('manageForms');
    
    window.brMetaData = {
        examName, term: document.getElementById('brExamTerm').value,
        academicYear: document.getElementById('brAcademicYear').value,
        examDate: document.getElementById('brExamDate').value || null
    };
    
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h4 style="color:#2563eb; margin:0;">📝 Enter Marks: ${escapeHtml(examName)}</h4>
            <button class="sd-mini-btn" style="background:#6b7280" onclick="showBulkResultConfig()">← Back</button>
        </div>
        <div style="overflow-x:auto; margin-top:1rem; border:1px solid #e5e7eb; border-radius:8px;">
            <table style="width:100%; border-collapse:collapse; min-width:600px;">
                <thead style="background:#f8fafc;">
                    <tr>
                        <th style="padding:0.8rem; text-align:left; border-bottom:2px solid #e2e8f0; position:sticky; left:0; background:#f8fafc; z-index:1;">Student</th>
                        ${brSubjects.map(s => `<th style="padding:0.8rem; text-align:center; border-bottom:2px solid #e2e8f0;">${escapeHtml(s.name)}<br><small style="color:#6b7280">Max: ${s.max}</small></th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${students.map(s => `
                        <tr class="br-student-row" data-sid="${s._id}" style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:0.8rem; font-weight:600; position:sticky; left:0; background:white; z-index:1; border-right:1px solid #f1f5f9; min-width:150px;">${escapeHtml(s.rollNumber)} - ${escapeHtml(s.name.substring(0, 15))}</td>
                            ${brSubjects.map((sub, i) => `
                                <td style="padding:0.5rem; text-align:center;">
                                    <input type="number" class="br-marks-input" data-sub-idx="${i}" max="${sub.max}" style="width:70px; padding:0.4rem; border:2px solid #e2e8f0; border-radius:6px; text-align:center;">
                                </td>
                            `).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <button class="btn btn-primary" style="margin-top:1rem; width:100%" onclick="submitBulkResults()">💾 Save All Results</button>
        <div id="brMsg" style="margin-top:0.5rem"></div>
    `;
}

async function submitBulkResults() {
    const records = [];
    let hasErrors = false;
    document.querySelectorAll('.br-student-row').forEach(row => {
        const studentId = row.getAttribute('data-sid');
        const subjects = [];
        row.querySelectorAll('.br-marks-input').forEach(input => {
            const idx = input.getAttribute('data-sub-idx');
            const max = brSubjects[idx].max;
            const obt = input.value;
            if (obt !== '') {
                const numObt = Number(obt);
                if (numObt > max || numObt < 0) hasErrors = true;
                subjects.push({ subject: brSubjects[idx].name, totalMarks: max, marksObtained: numObt });
            }
        });
        if (subjects.length > 0) records.push({ studentId, subjects });
    });
    
    if (hasErrors) return alert('Some marks entered exceed the maximum marks defined!');
    if (records.length === 0) return alert('No marks entered!');
    
    const msg = document.getElementById('brMsg');
    msg.innerHTML = '<span style="color:#2563eb">⏳ Saving all results...</span>';
    
    try {
        const res = await fetch(`${STUDENT_ADMIN}/results/bulk`, {
            method: 'POST', headers,
            body: JSON.stringify({ ...window.brMetaData, records })
        });
        const result = await res.json();
        if (result.success) {
            msg.innerHTML = `<span style="color:#065f46">✅ ${result.message}</span>`;
            setTimeout(() => document.getElementById('manageForms').innerHTML = '', 1500);
        } else {
            msg.innerHTML = `<span style="color:#991b1b">❌ ${result.message}</span>`;
        }
    } catch (e) { msg.innerHTML = '<span style="color:#991b1b">❌ Server error</span>'; }
}

// ============ BULK DOC UPLOAD ============

function showBulkDocForm() {
    const selectedIds = [...document.querySelectorAll('.manage-student-cb:checked')].map(cb => cb.value);
    if (selectedIds.length === 0) return alert('Select students first');

    const container = document.getElementById('manageForms');
    container.innerHTML = `
        <h4 style="color:#2563eb">📄 Bulk Upload Document (${selectedIds.length} students)</h4>
        <p style="color:#6b7280;font-size:0.9rem;margin-bottom:0.8rem">This document will be distributed to all selected students instantly.</p>
        <form id="bulkDocForm" style="display:grid;gap:1rem">
            <input id="bulkDocTitle" placeholder="Document Title (e.g. Syllabus) *" required style="width:100%;padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;font-family:inherit;">
            <input type="file" id="bulkDocFile" accept=".pdf,.doc,.docx,.xls,.xlsx" required style="width:100%;padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;background:white;font-family:inherit;">
            <button type="submit" class="btn btn-primary" style="justify-self:start">Upload to Selected Students</button>
        </form>
        <div id="bulkDocMsg" style="margin-top:0.5rem"></div>
    `;

    document.getElementById('bulkDocForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('bulkDocTitle').value.trim();
        const file = document.getElementById('bulkDocFile').files[0];
        const msg = document.getElementById('bulkDocMsg');
        const btn = document.getElementById('bulkDocForm').querySelector('button');

        if (!title || !file) return;
        btn.disabled = true;
        msg.innerHTML = '<span style="color:#2563eb">⏳ Uploading and assigning...</span>';

        const fd = new FormData();
        fd.append('title', title);
        fd.append('file', file);
        fd.append('studentIds', JSON.stringify(selectedIds));

        try {
            const res = await fetch(`${STUDENT_ADMIN}/documents/bulk`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
            const r = await res.json();
            if (r.success) { msg.innerHTML = `<span style="color:#065f46">✅ ${r.message}</span>`; setTimeout(() => document.getElementById('manageForms').innerHTML = '', 1500); } 
            else { msg.innerHTML = `<span style="color:#991b1b">❌ ${r.message}</span>`; }
        } catch (err) { msg.innerHTML = '<span style="color:#991b1b">❌ Server error</span>'; } finally { btn.disabled = false; }
    });
}

// ============ STAFF ATTENDANCE ============

document.getElementById('markSelfAttendanceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('selfAttDate').value;
    const status = document.getElementById('selfAttStatus').value;
    const remarks = document.getElementById('selfAttRemarks').value;
    const entryTime = document.getElementById('selfAttEntryTime')?.value || '';
    const exitTime = document.getElementById('selfAttExitTime')?.value || '';
    const msg = document.getElementById('selfAttMsg');
    
    const selectedDate = new Date(date);
    if (selectedDate.getDay() === 0) {
        msg.innerHTML = '<span style="color:#991b1b">❌ Cannot mark attendance for Sundays.</span>';
        setTimeout(() => msg.innerHTML = '', 4000);
        return;
    }

    try {
        const res = await fetch(`${STUDENT_ADMIN}/staff-attendance/mark`, {
            method: 'POST', headers,
            body: JSON.stringify({ date, status, remarks, entryTime, exitTime })
        });
        const result = await res.json();
        if (result.success) {
            msg.innerHTML = '<span style="color:#065f46">✅ Attendance submitted for approval!</span>';
            document.getElementById('selfAttRemarks').value = '';
            loadMyStaffAttendance();
        } else {
            msg.innerHTML = `<span style="color:#991b1b">❌ ${result.message}</span>`;
        }
    } catch (err) {
        msg.innerHTML = '<span style="color:#991b1b">❌ Server error</span>';
    }
    setTimeout(() => msg.innerHTML = '', 4000);
});

window.toggleAllStaff = window.toggleAllStaffRoster = function(checked) {
    document.querySelectorAll('.staff-roster-cb').forEach(cb => cb.checked = checked);
};

async function loadStaffAttendanceToday() {
    const dateInput = document.getElementById('staffBulkAttDate');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    try {
        const res = await fetch(`${API_URL}/student-admin/staff-attendance/today?date=${date}`, { headers });
        const data = await res.json();
        if (!data.success) return;
        
        const container = document.getElementById('staffBulkAttRows');
        if (!container) return; // skip if HTML missing
        
        if (data.staffList.length === 0) {
            container.innerHTML = '<p class="empty-state">No staff members found.</p>';
            return;
        }

        container.innerHTML = data.staffList.map(s => `
            <div style="display:flex;flex-direction:column;padding:0.7rem;background:#f9fafb;border-radius:8px;margin-bottom:0.5rem;border:1px solid #e5e7eb;">
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem;">
                    <span style="flex:1; display:flex; align-items:center; gap:0.5rem;">
                        <input type="checkbox" class="staff-roster-cb" value="${s.adminId}" checked style="width:16px;height:16px;accent-color:#2563eb;">
                        <span><strong>${escapeHtml(s.realName || s.username)}</strong> (${escapeHtml(s.employeeId || '-')})</span>
                    </span>
                    <div style="display:flex;gap:0.5rem">
                        <select id="satt-status-${s.adminId}" style="padding:0.4rem;border:2px solid #e5e7eb;border-radius:6px">
                            <option value="Present" ${s.status === 'Present' ? 'selected' : ''}>Present</option>
                            <option value="Absent" ${s.status === 'Absent' ? 'selected' : ''}>Absent</option>
                            <option value="Leave" ${s.status === 'Leave' ? 'selected' : ''}>Leave</option>
                            <option value="Half-Day" ${s.status === 'Half-Day' ? 'selected' : ''}>Half-Day</option>
                            <option value="Holiday" ${s.status === 'Holiday' ? 'selected' : ''}>Holiday</option>
                        </select>
                    </div>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <input type="time" id="satt-entry-${s.adminId}" title="Entry Time" value="${s.entryTime || ''}" style="padding:0.4rem;border:2px solid #e5e7eb;border-radius:6px;width:110px">
                    <input type="time" id="satt-exit-${s.adminId}" title="Exit Time" value="${s.exitTime || ''}" style="padding:0.4rem;border:2px solid #e5e7eb;border-radius:6px;width:110px">
                    <input type="text" id="satt-rem-${s.adminId}" placeholder="Remarks" value="${escapeHtml(s.remarks || '')}" style="flex:1;padding:0.4rem;border:2px solid #e5e7eb;border-radius:6px;min-width:120px">
                </div>
            </div>
        `).join('');
        window.currentStaffList = data.staffList;

        // Automatically bind the existing "Select All" checkbox in your HTML file
        const rosterSec = document.getElementById('staff-roster-sec');
        if (rosterSec) {
            const existingSelectAll = rosterSec.querySelector('input[type="checkbox"]:not(.staff-roster-cb)');
            if (existingSelectAll) {
                existingSelectAll.checked = true;
                existingSelectAll.onchange = function(e) {
                    document.querySelectorAll('.staff-roster-cb').forEach(cb => cb.checked = e.target.checked);
                };
            }
        }
    } catch(e) { console.error(e); }
}

window.submitStaffAttendanceBulk = async function() {
    const dateInput = document.getElementById('staffBulkAttDate');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    if (!window.currentStaffList) return;
    
    const selectedIds = [...document.querySelectorAll('.staff-roster-cb:checked')].map(cb => cb.value);
    if (selectedIds.length === 0) return alert('Select at least one staff member');

    const records = selectedIds.map(adminId => ({
        adminId: adminId,
        status: document.getElementById(`satt-status-${adminId}`).value,
        remarks: document.getElementById(`satt-rem-${adminId}`).value,
        entryTime: document.getElementById(`satt-entry-${adminId}`).value,
        exitTime: document.getElementById(`satt-exit-${adminId}`).value
    }));
    
    const btn = document.getElementById('saveStaffAttBtn');
    if (btn) btn.textContent = 'Saving...';
    try {
        const res = await fetch(`${API_URL}/student-admin/staff-attendance/bulk`, {
            method: 'POST', headers, body: JSON.stringify({ date, records })
        });
        const data = await res.json();
        alert(data.success ? '✅ ' + data.message : '❌ ' + data.message);
        if (data.success) {
            loadStaffAttendanceToday();
            if (typeof loadStaffHistory === 'function') loadStaffHistory();
        }
    } catch(e) { alert('❌ Error saving staff attendance'); }
    if (btn) btn.textContent = 'Save Attendance';
};

let teacherAttRecords = [];
let currentCalDate = new Date();

async function loadMyStaffAttendance() {
    try {
        const res = await fetch(`${API_URL}/student-admin/staff-attendance/my`, { headers });
        const data = await res.json();
        if (!data.success) return;
        
        teacherAttRecords = data.records;
        renderTeacherCalendar();
    } catch(e) { console.error(e); }
}

window.changeTeacherCalendarMonth = function(dir) {
    currentCalDate.setMonth(currentCalDate.getMonth() + dir);
    renderTeacherCalendar();
};

function renderTeacherCalendar() {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const monthLabel = document.getElementById('teacherCalendarMonth');
    if (monthLabel) monthLabel.innerText = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = document.getElementById('teacherCalendarGrid');
    if (!grid) return;

    let html = `
        <div style="font-weight:bold; padding:8px; background:#f8fafc; font-size:0.85rem; border-radius:4px;">Sun</div>
        <div style="font-weight:bold; padding:8px; background:#f8fafc; font-size:0.85rem; border-radius:4px;">Mon</div>
        <div style="font-weight:bold; padding:8px; background:#f8fafc; font-size:0.85rem; border-radius:4px;">Tue</div>
        <div style="font-weight:bold; padding:8px; background:#f8fafc; font-size:0.85rem; border-radius:4px;">Wed</div>
        <div style="font-weight:bold; padding:8px; background:#f8fafc; font-size:0.85rem; border-radius:4px;">Thu</div>
        <div style="font-weight:bold; padding:8px; background:#f8fafc; font-size:0.85rem; border-radius:4px;">Fri</div>
        <div style="font-weight:bold; padding:8px; background:#f8fafc; font-size:0.85rem; border-radius:4px;">Sat</div>
    `;
    
    for (let i = 0; i < firstDay; i++) {
        html += `<div style="padding:10px; background:#f8fafc; border-radius:6px; opacity:0.3;"></div>`;
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        const record = teacherAttRecords.find(r => r.date.startsWith(dateStr));
        let bgColor = '#ffffff';
        let tooltip = '';
        let indicator = '';
        let borderColor = '#e5e7eb';
        const dateObj = new Date(year, month, d);
        const isSunday = dateObj.getDay() === 0;
        
        if (record) {
            let timeStr = (record.entryTime || record.exitTime) ? `\nEntry: ${record.entryTime || '-'} | Exit: ${record.exitTime || '-'}` : '';
            if (record.approvalStatus === 'Pending') {
                bgColor = '#e0e7ff'; borderColor = '#6366f1'; indicator = '⏳'; tooltip = 'Pending Approval' + timeStr;
            } else if (record.approvalStatus === 'Rejected') {
                bgColor = '#f3f4f6'; borderColor = '#9ca3af'; indicator = '❌'; tooltip = 'Rejected' + timeStr;
            } else {
                if (record.status === 'Present') { bgColor = '#d1fae5'; borderColor = '#10b981'; tooltip = 'Present' + timeStr; }
                else if (record.status === 'Absent') { bgColor = '#fee2e2'; borderColor = '#ef4444'; tooltip = 'Absent' + timeStr; }
                else if (record.status === 'Holiday') { bgColor = '#eff6ff'; borderColor = '#6366f1'; tooltip = 'Holiday' + timeStr; }
                else { bgColor = '#fef3c7'; borderColor = '#f59e0b'; tooltip = record.status + timeStr; }
            }
        } else if (isSunday) {
            bgColor = '#f8fafc'; borderColor = '#cbd5e1'; indicator = 'Sun'; tooltip = 'Sunday (Holiday)';
        } else if (dateObj > new Date()) {
            bgColor = '#f9fafb';
        }
        
        const isToday = new Date().toDateString() === dateObj.toDateString();
        if (isToday) borderColor = '#2563eb';
        const borderW = isToday ? '2px' : '1px';
        
        html += `
            <div title="${tooltip}" style="padding:10px; background:${bgColor}; border: ${borderW} solid ${borderColor}; border-radius:6px; cursor:default; min-height:65px; display:flex; flex-direction:column; align-items:center; justify-content:center; transition: transform 0.2s;">
                <span style="font-weight:${isToday?'bold':'600'}; color:#334155;">${d}</span>
                <span style="font-size:0.75rem; margin-top:4px; color:#4b5563; font-weight:600;">${record ? (indicator || record.status.substring(0,3)) : (isSunday ? indicator : '-')}</span>
            </div>
        `;
    }
    grid.innerHTML = html;
}

async function loadPendingStaffAttendanceRequests() {
    if (!hasPermission('staff.attendance.approve')) return;
    try {
        const res = await fetch(`${STUDENT_ADMIN}/staff-attendance/pending`, { headers });
        const data = await res.json();
        if (data.success) {
            const tbody = document.getElementById('pendingStaffAttendanceTable');
            tbody.innerHTML = data.pending.length ? data.pending.map(r => `
                <tr>
                    <td><strong>${escapeHtml(r.teacherName)}</strong></td>
                    <td>${new Date(r.date).toLocaleDateString()}</td>
                    <td><span class="status-select status-${r.status}">${r.status}</span></td>
                    <td>
                        <div style="font-size:0.85rem;color:#4b5563;">
                            ${r.entryTime || r.exitTime ? `<strong>Time:</strong> ${escapeHtml(r.entryTime || '-')} to ${escapeHtml(r.exitTime || '-')}<br>` : ''}
                            <strong>Note:</strong> ${escapeHtml(r.remarks || '-')}
                        </div>
                    </td>
                    <td>
                        <button class="action-btn" style="background:#10b981;color:white" onclick="updateStaffAttendanceStatus('${r._id}', 'Approved')">Approve</button>
                        <button class="action-btn" style="background:#ef4444;color:white" onclick="updateStaffAttendanceStatus('${r._id}', 'Rejected')">Reject</button>
                    </td>
                </tr>
            `).join('') : '<tr><td colspan="5" class="empty-state">No pending attendance requests</td></tr>';
        }
    } catch (e) { console.error(e); }
}

async function updateStaffAttendanceStatus(id, approvalStatus) {
    if (!confirm(`Are you sure you want to ${approvalStatus.toLowerCase()} this attendance?`)) return;
    try {
        const res = await fetch(`${STUDENT_ADMIN}/staff-attendance/approve/${id}`, {
            method: 'PUT', headers,
            body: JSON.stringify({ approvalStatus })
        });
        const result = await res.json();
        if (result.success) {
            loadPendingStaffAttendanceRequests();
            loadMyStaffAttendance(); 
        } else {
            alert('Error: ' + result.message);
        }
    } catch (e) {
        alert('Server error while updating request');
    }
}

window.loadStaffHistory = async function() {
    const adminId = document.getElementById('historyStaffSelect')?.value;
    const monthVal = document.getElementById('historyMonthSelect')?.value;
    const tbody = document.getElementById('staffHistoryTable');
    const summaryGrid = document.getElementById('staffHistorySummaryGrid');
    
    if (!tbody || !summaryGrid) return;
    
    if (!adminId || !monthVal) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Select a staff member and month</td></tr>';
        summaryGrid.innerHTML = '';
        return;
    }
    
    const [year, month] = monthVal.split('-');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Loading...</td></tr>';
    
    try {
        const res = await fetch(`${API_URL}/student-admin/staff-attendance/history/${adminId}?year=${year}&month=${month}`, { headers });
        const data = await res.json();
        
        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Error: ${data.message}</td></tr>`;
            return;
        }
        
        const summary = { 'Present': 0, 'Absent': 0, 'Leave': 0, 'Half-Day': 0, 'Holiday': 0 };
        data.records.forEach(r => {
            if (r.approvalStatus === 'Approved' && summary.hasOwnProperty(r.status)) summary[r.status]++;
        });
        
        summaryGrid.innerHTML = `
            <div style="background:#ecfdf5; border:1px solid #a7f3d0; padding:0.5rem; text-align:center; border-radius:8px;"><div style="font-size:1.2rem;font-weight:bold;color:#065f46">${summary['Present']}</div><small>Present</small></div>
            <div style="background:#fef2f2; border:1px solid #fecaca; padding:0.5rem; text-align:center; border-radius:8px;"><div style="font-size:1.2rem;font-weight:bold;color:#991b1b">${summary['Absent']}</div><small>Absent</small></div>
            <div style="background:#fefce8; border:1px solid #fde68a; padding:0.5rem; text-align:center; border-radius:8px;"><div style="font-size:1.2rem;font-weight:bold;color:#854d0e">${summary['Leave']}</div><small>Leave</small></div>
            <div style="background:#fffbeb; border:1px solid #fde68a; padding:0.5rem; text-align:center; border-radius:8px;"><div style="font-size:1.2rem;font-weight:bold;color:#854d0e">${summary['Half-Day']}</div><small>Half-Day</small></div>
            <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:0.5rem; text-align:center; border-radius:8px;"><div style="font-size:1.2rem;font-weight:bold;color:#1e40af">${summary['Holiday']}</div><small>Holiday</small></div>
        `;
        
        if (data.records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No records found for this month.</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.records.map(r => `
            <tr>
                <td>${new Date(r.date).toLocaleDateString()}</td>
                <td><span class="status-select status-${r.status === 'Approved' ? 'approved' : r.status === 'Pending' ? 'pending' : r.status.toLowerCase()}">${r.status}</span> <br><small style="color:#6b7280">${r.approvalStatus}</small></td>
                <td>${r.entryTime || r.exitTime ? `In: ${escapeHtml(r.entryTime||'-')}<br>Out: ${escapeHtml(r.exitTime||'-')}` : '-'}</td>
                <td>${escapeHtml(r.remarks || '-')}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("Staff History Error:", e);
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Server error: ${e.message}</td></tr>`;
    }
};

// ============ PHASE 3: PAYROLL & SALARY SLIPS ============

window.loadPayrollAdmin = async function() {
    const monthInput = document.getElementById('payrollMonthSelect');
    if (!monthInput.value) {
        const now = new Date();
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const month = monthInput.value;
    const tbody = document.getElementById('payrollAdminTable');
    if (!tbody) return;
    
    try {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Loading...</td></tr>';
        const res = await fetch(`${API_URL}/student-admin/payroll/list?month=${month}`, { headers });
        const data = await res.json();
        
        if (!data.success) return tbody.innerHTML = `<tr><td colspan="5" class="empty-state">${data.message}</td></tr>`;
        if (data.data.length === 0) return tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No staff found</td></tr>`;
        
        tbody.innerHTML = data.data.map(d => `
            <tr>
                <td><strong>${escapeHtml(d.name)}</strong> <br><small style="color:#6b7280">${d.employeeId || '-'}</small></td>
                <td>₹${d.basicSalary || 0}</td>
                <td><strong>${d.payroll ? '₹' + d.payroll.netSalary : '-'}</strong></td>
                <td>${d.payroll ? `<span class="badge paid">Generated</span>` : `<span class="badge pending">Pending</span>`}</td>
                <td>
                    <button class="action-btn btn-view" onclick="openPayrollModal('${d.staffId}', '${escapeHtml(d.name)}', ${d.basicSalary || 0}, ${d.payroll ? d.payroll.allowances : 0}, ${d.payroll ? d.payroll.arrears : 0}, ${d.payroll ? d.payroll.deductions : 0})">${d.payroll ? '✏️ Edit' : '➕ Generate'}</button>
                    ${d.payroll ? `<button class="action-btn" style="background:#2563eb; color:white;" onclick="downloadSalarySlip('${d.payroll._id}')">📄 PDF</button>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (e) { tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Server error</td></tr>`; }
};

window.openPayrollModal = function(adminId, name, basic, allowance, arrears, deduction) {
    document.getElementById('prAdminId').value = adminId;
    document.getElementById('prStaffName').innerText = name + ' - ' + document.getElementById('payrollMonthSelect').value;
    document.getElementById('prBasic').value = basic;
    document.getElementById('prAllowance').value = allowance;
    document.getElementById('prArrears').value = arrears;
    document.getElementById('prDeduction').value = deduction;
    window.calcNetSalary();
    document.getElementById('payrollModal').classList.add('active');
};

window.calcNetSalary = function() {
    const b = Number(document.getElementById('prBasic').value) || 0;
    const a = Number(document.getElementById('prAllowance').value) || 0;
    const arr = Number(document.getElementById('prArrears').value) || 0;
    const d = Number(document.getElementById('prDeduction').value) || 0;
    document.getElementById('prNet').value = (b + a + arr) - d;
};

document.getElementById('payrollForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Saving...'; btn.disabled = true;
    try {
        await fetch(`${API_URL}/student-admin/payroll/generate`, {
            method: 'POST', headers, body: JSON.stringify({
                adminId: document.getElementById('prAdminId').value, month: document.getElementById('payrollMonthSelect').value,
                basicSalary: document.getElementById('prBasic').value, allowances: document.getElementById('prAllowance').value,
                arrears: document.getElementById('prArrears').value,
                deductions: document.getElementById('prDeduction').value, netSalary: document.getElementById('prNet').value
            })
        });
        document.getElementById('payrollModal').classList.remove('active');
        loadPayrollAdmin();
    } catch(err) { alert('Error generating slip'); } finally { btn.textContent = 'Save & Generate'; btn.disabled = false; }
});

window.loadMySalarySlips = async function() {
    try {
        const res = await fetch(`${API_URL}/student-admin/payroll/my`, { headers });
        const data = await res.json();
        const tbody = document.getElementById('mySalarySlipsTable');
        if (!tbody) return;
        tbody.innerHTML = data.slips.length ? data.slips.map(s => `<tr><td><strong>${s.month}</strong></td><td>₹${s.netSalary}</td><td><span class="badge paid">${s.status}</span></td><td><button class="sd-mini-btn" style="background:#2563eb; border:none" onclick="downloadSalarySlip('${s._id}')">📄 Download PDF</button></td></tr>`).join('') : `<tr><td colspan="4" class="empty-state">No salary slips generated yet.</td></tr>`;
    } catch (e) { console.error(e); }
};

window.downloadSalarySlip = async function(id) {
    try { 
        const res = await fetch(`${API_URL}/student-admin/payroll/${id}/pdf`, { headers });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return alert(`Cannot generate PDF: ${errData.error || errData.message || res.statusText}`);
        }
        const arrayBuffer = await res.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank'); 
    } catch (e) { alert('Download error: ' + e.message); }
};

// call it once on load — add near your other initial calls at the bottom:
loadTodayCollection();

// Run on load
renderPermCheckboxes();
applyStudentSectionPermissions();
applyStatsPermissions();
applyTabPermissions();
