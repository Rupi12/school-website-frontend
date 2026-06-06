const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : 'https://school-website-backend-j6pc.onrender.com/api';
const token = localStorage.getItem('adminToken');
const adminInfo = JSON.parse(localStorage.getItem('adminInfo') || '{}');

// Check authentication
if (!token) {
    window.location.href = 'login.html';
}

document.getElementById('adminName').textContent = `👤 ${adminInfo.username || 'Admin'}`;

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
};

// Store data globally for searching
let allApplications = [];
let allMessages = [];
let currentTab = 'applications';

// Load data on page load
loadApplications();
loadMessages();

// Auto-refresh every 30 seconds
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
        document.getElementById('pendingApps').textContent = 
            allApplications.filter(a => a.status === 'pending').length;
        
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
        document.getElementById('unreadMsgs').textContent = 
            allMessages.filter(m => !m.isRead).length;

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
                <select onchange="updateStatus('${app._id}', this.value)" 
                    class="status-select status-${app.status}">
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

// SEARCH FUNCTION
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const resultCount = document.getElementById('resultCount');
    
    if (currentTab === 'applications') {
        let filtered = allApplications;
        
        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(app => 
                app.studentName.toLowerCase().includes(searchTerm) ||
                app.email.toLowerCase().includes(searchTerm) ||
                app.parentName.toLowerCase().includes(searchTerm) ||
                app.phone.toLowerCase().includes(searchTerm) ||
                app.grade.toLowerCase().includes(searchTerm)
            );
        }
        
        // Filter by status
        if (statusFilter) {
            filtered = filtered.filter(app => app.status === statusFilter);
        }
        
        renderApplications(filtered);
        
        if (searchTerm || statusFilter) {
            resultCount.textContent = `Showing ${filtered.length} of ${allApplications.length} applications`;
        } else {
            resultCount.textContent = '';
        }
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
        
        if (searchTerm) {
            resultCount.textContent = `Showing ${filtered.length} of ${allMessages.length} messages`;
        } else {
            resultCount.textContent = '';
        }
    }
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('resultCount').textContent = '';
    handleSearch();
}

function highlightText(text, searchTerm) {
    if (!text) return '';
    const escaped = escapeHtml(text);
    if (!searchTerm) return escaped;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<span class="highlight">$1</span>');
}

async function updateStatus(id, status) {
    try {
        await fetch(`${API_URL}/applications/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status })
        });
        loadApplications();
    } catch (error) {
        console.error(error);
    }
}

async function deleteApp(id) {
    if (!confirm('Are you sure you want to delete this application?')) return;
    try {
        await fetch(`${API_URL}/applications/${id}`, { method: 'DELETE', headers });
        loadApplications();
    } catch (error) {
        console.error(error);
    }
}

async function deleteMsg(id) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
        await fetch(`${API_URL}/contacts/${id}`, { method: 'DELETE', headers });
        loadMessages();
    } catch (error) {
        console.error(error);
    }
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
        if (tab === 'documents') loadDocsAdmin();
    
    if (tab === 'gallery') loadGalleryAdmin();
    if (tab === 'news') loadNewsAdmin();
    
    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
        searchBar.style.display = (tab === 'gallery' || tab === 'news' || tab === 'documents') ? 'none' : 'flex';
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') closeModal();
});


// ============ GALLERY MANAGEMENT ============
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
                <img src="${escapeHtml(photo.imageUrl)}" 
                     onerror="this.src='https://via.placeholder.com/200x150?text=Invalid+URL'">
                <div class="gallery-admin-info">
                    <h4>${escapeHtml(photo.title)}</h4>
                    <span class="cat">${escapeHtml(photo.category)}</span>
                    <button class="action-btn btn-view" style="margin-top:0.5rem;width:100%" 
                        onclick='editPhoto(${JSON.stringify(photo)})'>✏️ Edit</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading gallery:', error);
    }
}

// Image preview
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
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
}

// Add photo form handler (with file upload)
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
                headers: {
                    'Authorization': `Bearer ${token}`
                    // Don't set Content-Type for FormData!
                },
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
            console.error(error);
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
    } catch (error) {
        console.error(error);
    }
}



function editPhoto(photo) {
    const newTitle = prompt('Edit title:', photo.title);
    if (newTitle === null) return;
    const newCategory = prompt('Category (Events/Sports/Campus/Academics/Cultural/Others):', photo.category);
    if (newCategory === null) return;
    const newDesc = prompt('Edit description:', photo.description || '');
    if (newDesc === null) return;

    fetch(`${API_URL}/gallery/${photo._id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ title: newTitle, category: newCategory, description: newDesc })
    })
    .then(r => r.json())
    .then(result => {
        if (result.success) loadGalleryAdmin();
        else alert('Error: ' + result.message);
    });
}

// ============ NEWS MANAGEMENT ============
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
    } catch (error) {
        console.error('Error loading news:', error);
    }
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
    } catch (error) {
        console.error(error);
    }
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
        method: 'PUT',
        headers,
        body: JSON.stringify({ 
            title: newTitle, 
            category: newCategory, 
            description: newDesc,
            eventDate: item.eventDate,
            isPinned: pin
        })
    })
    .then(r => r.json())
    .then(result => {
        if (result.success) loadNewsAdmin();
        else alert('Error: ' + result.message);
    });
}




function exportApplications() {
    if (!allApplications || allApplications.length === 0) {
        alert('No applications to export');
        return;
    }
    const headers = ['Student Name','DOB','Grade','Gender','Parent Name','Phone','Email','Address','Previous School','Status','Submitted'];
    const rows = allApplications.map(app => [
        app.studentName, new Date(app.dob).toLocaleDateString(), app.grade, app.gender,
        app.parentName, app.phone, app.email, app.address, app.prevSchool || 'N/A',
        app.status, new Date(app.createdAt).toLocaleDateString()
    ]);
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',') + '\n';
    });
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
    } catch (error) {
        console.error(error);
    }
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
    } catch (error) {
        console.error(error);
    }
}