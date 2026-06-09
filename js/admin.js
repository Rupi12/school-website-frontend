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
                <strong>${highlightText(app.studentName, searchTerm)}</strong><br>
                <small style="color:#6b7280">${highlightText(app.email, searchTerm)}</small>
            </td>
            <td>${escapeHtml(app.grade)}</td>
            <td>${highlightText(app.parentName, searchTerm)}</td>
            <td>${highlightText(app.phone, searchTerm)}</td>
            <td>
                <select onchange="updateStatus('${app._id}', this.value)" class="status-select status-${app.status}">
                    <option value="pending" ${app.status==='pending'?'selected':''}>Pending</option>
                    <option value="reviewing" ${app.status==='reviewing'?'selected':''}>Reviewing</option>
                    <option value="approved" ${app.status==='approved'?'selected':''}>Approved</option>
                    <option value="rejected" ${app.status==='rejected'?'selected':''}>Rejected</option>
                </select>
            </td>
            <td>${new Date(app.createdAt).toLocaleDateString()}</td>
            <td>
                <button class="action-btn btn-view" onclick='viewApp(${JSON.stringify(app)})'>View</button>
                <button class="action-btn btn-delete" onclick="deleteApp('${app._id}')">Delete</button>
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
            <td>${highlightText(msg.email, searchTerm)}</td>
            <td>${highlightText(msg.subject, searchTerm)}</td>
            <td>${new Date(msg.createdAt).toLocaleDateString()}</td>
            <td>${msg.isRead ? '✅ Read' : '🔵 New'}</td>
            <td>
                <button class="action-btn btn-view" onclick='viewMsg(${JSON.stringify(msg)})'>View</button>
                <button class="action-btn btn-delete" onclick="deleteMsg('${msg._id}')">Delete</button>
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
                app.email.toLowerCase().includes(searchTerm) ||
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
                msg.name.toLowerCase().includes(searchTerm) ||
                msg.email.toLowerCase().includes(searchTerm) ||
                msg.subject.toLowerCase().includes(searchTerm) ||
                msg.message.toLowerCase().includes(searchTerm)
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
        <div class="detail-row"><strong>Email:</strong> ${escapeHtml(app.email)}</div>
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
        <div class="detail-row"><strong>Email:</strong> ${escapeHtml(msg.email)}</div>
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
    btn.classList.add('active');

    document.getElementById('applications-tab').classList.toggle('hidden', tab !== 'applications');
    document.getElementById('messages-tab').classList.toggle('hidden', tab !== 'messages');
    document.getElementById('gallery-tab').classList.toggle('hidden', tab !== 'gallery');
    document.getElementById('news-tab').classList.toggle('hidden', tab !== 'news');
    document.getElementById('documents-tab').classList.toggle('hidden', tab !== 'documents');
    document.getElementById('students-tab').classList.toggle('hidden', tab !== 'students');
    document.getElementById('admins-tab').classList.toggle('hidden', tab !== 'admins');

    if (tab === 'students') { loadStudentsAdmin(); loadClasses(); loadBulkClasses(); }
    if (tab === 'documents') loadDocsAdmin();
    if (tab === 'gallery') loadGalleryAdmin();
    if (tab === 'news') loadNewsAdmin();
    if (tab === 'admins') loadAdmins();

    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
        searchBar.style.display = (tab === 'gallery' || tab === 'news' || tab === 'documents' || tab === 'students') ? 'none' : 'flex';
    }

    const searchInput = document.getElementById('searchInput');
    if (tab === 'applications') {
        if (searchInput) searchInput.placeholder = 'Search by name, email, parent, or phone...';
        const fs = document.getElementById('filterStatus');
        if (fs) fs.style.display = '';
    } else if (tab === 'messages') {
        if (searchInput) searchInput.placeholder = 'Search by name, email, subject...';
        const fs = document.getElementById('filterStatus');
        if (fs) fs.style.display = 'none';
    }

    if (tab !== 'gallery' && tab !== 'news') clearSearch();
}

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
                <button class="gallery-delete-btn" onclick="deletePhoto('${photo._id}')">×</button>
                <img src="${escapeHtml(photo.imageUrl)}" onerror="this.src='https://via.placeholder.com/200x150?text=Invalid+URL'">
                <div class="gallery-admin-info">
                    <h4>${escapeHtml(photo.title)}</h4>
                    <span class="cat">${escapeHtml(photo.category)}</span>
                    <button class="action-btn btn-view" style="margin-top:0.5rem;width:100%" onclick='editPhoto(${JSON.stringify(photo)})'>✏️ Edit</button>
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
                <button class="action-btn btn-view" onclick='editNews(${JSON.stringify(item)})'>✏️ Edit</button>
                <button class="action-btn btn-delete" onclick="deleteNews('${item._id}')">Delete</button>
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
    if (!allApplications || allApplications.length === 0) {
        alert('No applications to export');
        return;
    }
    const cols = ['Student Name','DOB','Grade','Gender','Parent Name','Phone','Email','Address','Previous School','Status','Submitted'];
    const rows = allApplications.map(app => [
        app.studentName, new Date(app.dob).toLocaleDateString(), app.grade, app.gender,
        app.parentName, app.phone, app.email, app.address, app.prevSchool || 'N/A',
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
                <button class="action-btn btn-delete" onclick="deleteDoc('${doc._id}')">Delete</button>
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

async function loadStudentsAdmin() {
    try {
        const res = await fetch(`${STUDENT_ADMIN}/students`, { headers });
        const data = await res.json();
        if (!data.success) return;
        allStudents = data.students;
        const classes = [...new Set(allStudents.map(s => s.class))].sort();
        const filterSel = document.getElementById('listClassFilter');
        if (filterSel) {
            filterSel.innerHTML = '<option value="">All Classes</option>' + classes.map(c => `<option value="${c}">Class ${c}</option>`).join('');
        }
        listPage = 1;
        renderStudentList();
    } catch (e) { console.error(e); }
}

function renderStudentList() {
    const search = (document.getElementById('listSearch')?.value || '').toLowerCase();
    const classFilter = document.getElementById('listClassFilter')?.value || '';
    let filtered = allStudents;
    if (classFilter) filtered = filtered.filter(s => s.class === classFilter);
    if (search) filtered = filtered.filter(s => s.name.toLowerCase().includes(search) || s.rollNumber.toLowerCase().includes(search));

    const list = document.getElementById('adminStudentList');
    if (filtered.length === 0) {
        list.innerHTML = '<p style="color:#6b7280">No students found.</p>';
        document.getElementById('listPagination').innerHTML = '';
        return;
    }
    const totalPages = Math.ceil(filtered.length / LIST_PER_PAGE);
    if (listPage > totalPages) listPage = 1;
    const start = (listPage - 1) * LIST_PER_PAGE;
    const pageItems = filtered.slice(start, start + LIST_PER_PAGE);

    list.innerHTML = pageItems.map(s => `
        <div style="background:white;padding:1rem;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.08);display:flex;gap:1rem;align-items:center;flex-wrap:wrap;">
            <div style="font-size:2rem">🎓</div>
            <div style="flex:1;min-width:200px;">
                <h4 style="margin:0">${escapeHtml(s.name)}</h4>
                <small style="color:#6b7280">Roll: ${escapeHtml(s.rollNumber)} | Class ${escapeHtml(s.class)} ${escapeHtml(s.section || '')}</small>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <button class="action-btn btn-view" onclick="openEditStudentModal('${s._id}', '${escapeHtml(s.name)}', '${escapeHtml(s.rollNumber)}', '${escapeHtml(s.class)}', '${escapeHtml(s.section || '')}', '${escapeHtml(s.parentName || '')}', '${escapeHtml(s.phone || '')}')">✏️ Edit</button>
                <button class="action-btn" style="background:#f59e0b; color:white;" onclick="openResetPwdModal('${s._id}', '${escapeHtml(s.name)}')">🔑 Reset Pwd</button>
                <button class="action-btn btn-delete" onclick="deleteStudent('${s._id}')">🗑️ Delete</button>
            </div>
        </div>
    `).join('');

    document.getElementById('listPagination').innerHTML = `
        <button class="sd-mini-btn" ${listPage===1?'disabled':''} onclick="changePage(-1)">‹ Prev</button>
        <span style="padding:0.6rem">Page ${listPage} of ${totalPages} (${filtered.length} students)</span>
        <button class="sd-mini-btn" ${listPage===totalPages?'disabled':''} onclick="changePage(1)">Next ›</button>
    `;
}

function changePage(dir) { listPage += dir; renderStudentList(); }

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
    } catch (e) { console.error(e); }
}

let classStudents = [];

async function loadClassStudents() {
    const cls = document.getElementById('manageClass').value;
    const search = document.getElementById('studentSearch');
    const sel = document.getElementById('selectStudent');
    if (!cls) {
        search.disabled = true;
        sel.style.display = 'none';
        document.getElementById('manageActions').style.display = 'none';
        return;
    }
    const res = await fetch(`${STUDENT_ADMIN}/students/class/${cls}`, { headers });
    const data = await res.json();
    classStudents = data.students;
    search.disabled = false;
    search.value = '';
    renderStudentOptions(classStudents);
    sel.style.display = 'block';
}

function renderStudentOptions(students) {
    const sel = document.getElementById('selectStudent');
    sel.innerHTML = students.map(s =>
        `<option value="${s._id}">${escapeHtml(s.rollNumber)} - ${escapeHtml(s.name)} ${s.section ? '('+s.section+')' : ''}</option>`
    ).join('');
}

function filterStudentList() {
    const term = document.getElementById('studentSearch').value.toLowerCase();
    const filtered = classStudents.filter(s => s.name.toLowerCase().includes(term) || s.rollNumber.toLowerCase().includes(term));
    renderStudentOptions(filtered);
}

function onStudentSelect() {
    const val = document.getElementById('selectStudent').value;
    document.getElementById('manageActions').style.display = val ? 'flex' : 'none';
    document.getElementById('manageForms').innerHTML = '';
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
        container.innerHTML = `
            <h4>Add Fee</h4>
            <input id="feeType" placeholder="Fee Type" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;margin-right:0.5rem">
            <input id="feeAmount" type="number" placeholder="Amount" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;margin-right:0.5rem">
            <input id="feeDue" type="date" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
            <button class="btn btn-primary" style="margin-left:0.5rem" onclick="saveFee('${sid}')">Add</button>
        `;
    } else if (type === 'doc') {
        container.innerHTML = `
            <h4>Upload Document (PDF)</h4>
            <input id="docTitle" placeholder="Document Title" style="width:100%;padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;margin-bottom:0.5rem">
            <input type="file" id="docFile" accept=".pdf" style="width:100%;padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px">
            <button class="btn btn-primary" style="margin-top:0.5rem" onclick="saveDoc('${sid}')">Upload</button>
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

async function saveFee(sid) {
    const res = await fetch(`${STUDENT_ADMIN}/fees`, {
        method: 'POST', headers,
        body: JSON.stringify({
            studentId: sid,
            feeType: document.getElementById('feeType').value,
            amount: document.getElementById('feeAmount').value,
            dueDate: document.getElementById('feeDue').value
        })
    });
    const r = await res.json();
    alert(r.success ? '✅ Fee added' : '❌ ' + r.message);
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

async function loadStudentData(sid) {
    const container = document.getElementById('manageForms');
    container.innerHTML = '<p>Loading...</p>';
    try {
        const res = await fetch(`${STUDENT_ADMIN}/student-data/${sid}`, { headers });
        const data = await res.json();
        container.innerHTML = `
            <h4>📊 Results</h4>
            ${data.results.length ? data.results.map(r => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem;background:#f9fafb;border-radius:8px;margin-bottom:0.4rem">
                    <span>${escapeHtml(r.examName)} - ${escapeHtml(r.term || '')} ${escapeHtml(r.academicYear || '')}</span>
                    <button class="action-btn btn-delete" onclick="deleteResult('${r._id}','${sid}')">Delete</button>
                </div>
            `).join('') : '<p style="color:#6b7280">No results</p>'}
            <h4 style="margin-top:1rem">💰 Fees</h4>
            ${data.fees.length ? data.fees.map(f => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem;background:#f9fafb;border-radius:8px;margin-bottom:0.4rem">
                    <span>${escapeHtml(f.feeType)} - ₹${f.amount} (${f.status})</span>
                    <button class="action-btn btn-delete" onclick="deleteFee('${f._id}','${sid}')">Delete</button>
                </div>
            `).join('') : '<p style="color:#6b7280">No fees</p>'}
            <h4 style="margin-top:1rem">📄 Documents</h4>
            ${data.documents.length ? data.documents.map(d => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem;background:#f9fafb;border-radius:8px;margin-bottom:0.4rem">
                    <span>${escapeHtml(d.title)}</span>
                    <button class="action-btn btn-delete" onclick="deleteStudentDoc('${d._id}','${sid}')">Delete</button>
                </div>
            `).join('') : '<p style="color:#6b7280">No documents</p>'}
        `;
    } catch (e) { container.innerHTML = '<p>Error loading data.</p>'; }
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

// ---- Bulk Attendance ----
async function loadBulkClasses() {
    try {
        const res = await fetch(`${STUDENT_ADMIN}/classes`, { headers });
        const data = await res.json();
        const sel = document.getElementById('bulkClass');
        if (sel) sel.innerHTML = '<option value="">Select Class...</option>' + data.classes.map(c => `<option value="${c}">Class ${c}</option>`).join('');
    } catch (e) { console.error(e); }
}

let bulkStudents = [];

async function loadBulkAttendance() {
    const cls = document.getElementById('bulkClass').value;
    const date = document.getElementById('bulkDate').value;
    if (!cls || !date) return alert('Select class and date');
    const res = await fetch(`${STUDENT_ADMIN}/students/class/${cls}`, { headers });
    const data = await res.json();
    bulkStudents = data.students;
    if (bulkStudents.length === 0) {
        document.getElementById('bulkList').innerHTML = '<p>No students in this class.</p>';
        return;
    }
    const checkRes = await fetch(`${STUDENT_ADMIN}/attendance/check?class=${cls}&date=${date}`, { headers });
    const checkData = await checkRes.json();
    const existing = checkData.existing || {};
    const alreadyMarked = Object.keys(existing).length > 0;

    document.getElementById('bulkList').innerHTML = `
        ${alreadyMarked ? '<p style="color:#92400e;background:#fef3c7;padding:0.6rem;border-radius:6px">⚠️ Attendance already marked for this date. Submitting will update it.</p>' : ''}
        <p style="color:#6b7280">All Present by default. Change absentees below.</p>
        <div style="display:grid;gap:0.5rem">
            ${bulkStudents.map(s => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:0.7rem;background:#f9fafb;border-radius:8px">
                    <span><strong>${escapeHtml(s.rollNumber)}</strong> - ${escapeHtml(s.name)}</span>
                    <select id="bulk-${s._id}" style="padding:0.4rem;border:2px solid #e5e7eb;border-radius:6px">
                        <option value="Present" ${(existing[s._id]||'Present')==='Present'?'selected':''}>Present</option>
                        <option value="Absent" ${existing[s._id]==='Absent'?'selected':''}>Absent</option>
                        <option value="Leave" ${existing[s._id]==='Leave'?'selected':''}>Leave</option>
                    </select>
                </div>
            `).join('')}
        </div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="submitBulkAttendance('${date}')">Submit Attendance</button>
    `;
}

async function submitBulkAttendance(date) {
    const records = bulkStudents.map(s => ({ studentId: s._id, status: document.getElementById(`bulk-${s._id}`).value }));
    const res = await fetch(`${STUDENT_ADMIN}/attendance/bulk`, { method: 'POST', headers, body: JSON.stringify({ date, records }) });
    const r = await res.json();
    const msg = document.getElementById('bulkMsg');
    if (r.success) {
        msg.innerHTML = `<div style="color:#065f46;background:#d1fae5;padding:0.8rem;border-radius:5px">✅ ${r.message}</div>`;
        document.getElementById('bulkList').innerHTML = '';
    } else {
        msg.innerHTML = `<div style="color:#991b1b;background:#fee2e2;padding:0.8rem;border-radius:5px">❌ ${r.message}</div>`;
    }
    setTimeout(() => msg.innerHTML = '', 4000);
}


// ============ PERMISSIONS ============
const ALL_PERMISSIONS = [
    { key: 'applications', label: '📝 Applications' },
    { key: 'messages', label: '💬 Messages' },
    { key: 'gallery', label: '📸 Gallery' },
    { key: 'news', label: '📰 News' },
    { key: 'documents', label: '📄 Documents' },
    { key: 'students.list', label: '🎓 Student List' },
    { key: 'students.manage', label: '⚙️ Manage Student Data' },
    { key: 'students.bulk', label: '📅 Bulk Attendance' },
    { key: 'students.timetable', label: '🗓️ Timetable' }
];

const myRole = adminInfo.role || 'admin';
const myPermissions = adminInfo.permissions || [];

function hasPermission(perm) {
    if (myRole === 'superadmin') return true;
    return myPermissions.includes(perm);
}

function applyTabPermissions() {
    const tabMap = {
        'applications': 'applications',
        'messages': 'messages',
        'gallery': 'gallery',
        'news': 'news',
        'documents': 'documents',
        'students': ['students.list','students.manage','students.bulk','students.timetable']
    };

    document.querySelectorAll('.tab-btn').forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        const match = onclick.match(/showTab\('(\w+)'/);
        if (!match) return;
        const tab = match[1];

        if (tab === 'admins') {
            btn.style.display = myRole === 'superadmin' ? '' : 'none';
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
    document.querySelectorAll('[data-perm]').forEach(el => {
        const perm = el.getAttribute('data-perm');
        el.style.display = hasPermission(perm) ? '' : 'none';
    });
}

function applyStatsPermissions() {
    const appStats = document.getElementById('totalApps')?.closest('.stat-card');
    const pendStats = document.getElementById('pendingApps')?.closest('.stat-card');
    const msgStats = document.getElementById('totalMsgs')?.closest('.stat-card');
    const unreadStats = document.getElementById('unreadMsgs')?.closest('.stat-card');
    if (appStats) appStats.style.display = hasPermission('applications') ? '' : 'none';
    if (pendStats) pendStats.style.display = hasPermission('applications') ? '' : 'none';
    if (msgStats) msgStats.style.display = hasPermission('messages') ? '' : 'none';
    if (unreadStats) unreadStats.style.display = hasPermission('messages') ? '' : 'none';
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
                        <h4 style="margin:0; font-size:1.1rem;">${escapeHtml(a.username)} ${a.role==='superadmin' ? '<span style="color:#fbbf24; font-size:0.8rem; background:#fef3c7; padding:2px 6px; border-radius:4px; margin-left:5px;">★ Superadmin</span>' : ''}</h4>
                        <small style="color:#6b7280">${escapeHtml(a.email)}</small>
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
    } catch (e) { console.error(e); }
}

function renderPermCheckboxes() {
    const el = document.getElementById('permCheckboxes');
    if (!el) return;
    el.innerHTML = ALL_PERMISSIONS.map(p => `
        <label style="display:flex;align-items:center;gap:0.4rem;padding:0.4rem;background:#f9fafb;border-radius:6px">
            <input type="checkbox" value="${p.key}" class="perm-cb"> ${p.label}
        </label>
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
    
    const el = document.getElementById('editPermCheckboxes');
    el.innerHTML = ALL_PERMISSIONS.map(p => `
        <label style="display:flex;align-items:center;gap:0.4rem;padding:0.4rem;background:#f9fafb;border-radius:6px;cursor:pointer;">
            <input type="checkbox" value="${p.key}" class="edit-perm-cb" ${admin.permissions.includes(p.key) ? 'checked' : ''}> 
            ${p.label}
        </label>
    `).join('');

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
        const msg = document.getElementById('editAdminMsg');
        
        const btn = editAdminForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        
        try {
            const permRes = await fetch(`${API_URL}/auth/admins/${adminId}`, { 
                method: 'PUT', 
                headers, 
                body: JSON.stringify({ permissions }) 
            });
            const permResult = await permRes.json();
            
            if (!permResult.success) {
                throw new Error(permResult.message);
            }

            if (newPassword) {
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


// ============ CHANGE PASSWORD (superadmin) ============
if (myRole === 'superadmin') {
    const cpBtn = document.getElementById('changePwdBtn');
    if (cpBtn) cpBtn.style.display = '';
}

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
window.exportStudents = function() {
    if (!allStudents || allStudents.length === 0) {
        return alert('No students to export.');
    }
    
    const cols = ['Name', 'Roll Number', 'Class', 'Section', 'Parent Name', 'Phone'];
    
    const rows = allStudents.map(s => [
        s.name || '', 
        s.rollNumber || '', 
        s.class || '', 
        s.section || '', 
        s.parentName || '', 
        s.phone || ''
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
};


// Run on load
renderPermCheckboxes();
applyStudentSectionPermissions();
applyStatsPermissions();
applyTabPermissions();