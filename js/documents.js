const DOC_API = API_URL + '/documents';
loadDocs();

async function loadDocs() {
    const loading = document.getElementById('docLoading');
    const list = document.getElementById('docList');
    const empty = document.getElementById('docEmpty');
    loading.style.display = 'flex';

    try {
        const res = await fetch(DOC_API);
        const data = await res.json();
        loading.style.display = 'none';

        if (data.success && data.documents.length > 0) {
            list.innerHTML = data.documents.map(doc => `
                <div style="background:white;padding:1.2rem;border-radius:12px;box-shadow:0 3px 15px rgba(0,0,0,0.08);display:flex;align-items:center;gap:1rem">
                    <div style="font-size:2.5rem">📄</div>
                    <div style="flex:1">
                        <span class="news-category-badge cat-News">${escapeHtmlDoc(doc.category)}</span>
                        <h3 style="margin:0.3rem 0">${escapeHtmlDoc(doc.title)}</h3>
                        <small style="color:#6b7280">${new Date(doc.createdAt).toLocaleDateString()}</small>
                    </div>
                    <a href="${doc.fileUrl}" target="_blank" download class="btn btn-primary">⬇️ Download</a>
                </div>
            `).join('');
        } else {
            empty.classList.remove('hidden');
        }
    } catch (error) {
        loading.style.display = 'none';
        empty.classList.remove('hidden');
        console.error(error);
    }
}

function escapeHtmlDoc(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}