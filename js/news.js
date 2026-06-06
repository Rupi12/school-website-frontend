const NEWS_API = API_URL + '/news';
let allNews = [];
let filteredNews = [];

loadNews();

async function loadNews() {
    const loading = document.getElementById('newsLoading');
    const list = document.getElementById('newsList');
    const empty = document.getElementById('newsEmpty');
    
    loading.style.display = 'flex';
    list.innerHTML = '';
    empty.classList.add('hidden');

    try {
        const res = await fetch(NEWS_API);
        const data = await res.json();
        loading.style.display = 'none';
        
        if (data.success && data.news.length > 0) {
            allNews = data.news;
            filteredNews = allNews;
            renderNews(allNews);
        } else {
            empty.classList.remove('hidden');
        }
    } catch (error) {
        loading.style.display = 'none';
        empty.classList.remove('hidden');
        console.error('Error loading news:', error);
    }
}

function renderNews(news) {
    const list = document.getElementById('newsList');
    const empty = document.getElementById('newsEmpty');
    
    if (news.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    
    const icons = { 'News': '📰', 'Events': '🎉', 'Achievements': '🏆', 'Announcements': '📢' };
    
    list.innerHTML = news.map((item, index) => `
        <div class="news-card" onclick="openNewsModal(${index})">
            ${item.isPinned ? '<span class="pinned-badge">📌 Pinned</span>' : ''}
            ${item.imageUrl ? `<div class="news-card-image"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.parentElement.style.display='none'"></div>` : ''}
            <div class="news-card-content">
                <span class="news-category-badge cat-${item.category}">${icons[item.category]} ${item.category}</span>
                <h3>${escapeHtml(item.title)}</h3>
                <div class="news-date">📅 ${item.eventDate ? new Date(item.eventDate).toLocaleDateString() : new Date(item.createdAt).toLocaleDateString()}</div>
                <p>${escapeHtml(item.description.substring(0, 120))}${item.description.length > 120 ? '...' : ''}</p>
                <span class="read-more">Read More →</span>
            </div>
        </div>
    `).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter');
        filteredNews = filter === 'all' ? allNews : allNews.filter(n => n.category === filter);
        renderNews(filteredNews);
    });
});

function openNewsModal(index) {
    const item = filteredNews[index];
    const modalImg = document.getElementById('modalImg');
    if (item.imageUrl) {
        modalImg.src = item.imageUrl;
        modalImg.style.display = 'block';
    } else {
        modalImg.style.display = 'none';
    }
    const icons = { 'News': '📰', 'Events': '🎉', 'Achievements': '🏆', 'Announcements': '📢' };
    document.getElementById('modalCategory').textContent = `${icons[item.category]} ${item.category}`;
    document.getElementById('modalCategory').className = `news-category-badge cat-${item.category}`;
    document.getElementById('modalTitle').textContent = item.title;
    document.getElementById('modalDate').textContent = '📅 ' + (item.eventDate ? new Date(item.eventDate).toLocaleDateString() : new Date(item.createdAt).toLocaleDateString());
    document.getElementById('modalDesc').innerHTML = linkify(item.description);
    document.getElementById('newsModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeNewsModal() {
    document.getElementById('newsModal').classList.remove('active');
    document.body.style.overflow = '';
}

document.getElementById('newsModal').addEventListener('click', (e) => {
    if (e.target.id === 'newsModal') closeNewsModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNewsModal();
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}



function linkify(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    let safe = div.innerHTML;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return safe.replace(urlRegex, '<a href="$1" target="_blank" style="color:#2563eb">$1</a>');
}