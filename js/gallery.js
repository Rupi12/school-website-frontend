const GALLERY_API = API_URL + '/gallery';
let allPhotos = [];
let filteredPhotos = [];
let currentImageIndex = 0;

// Load gallery on page load
loadGallery();

async function loadGallery() {
    const loading = document.getElementById('galleryLoading');
    const grid = document.getElementById('galleryGrid');
    const empty = document.getElementById('galleryEmpty');
    
    loading.style.display = 'flex';
    grid.innerHTML = '';
    empty.classList.add('hidden');

    try {
        const res = await fetch(GALLERY_API);
        const data = await res.json();
        
        loading.style.display = 'none';
        
        if (data.success && data.photos.length > 0) {
            allPhotos = data.photos;
            filteredPhotos = allPhotos;
            renderGallery(allPhotos);
        } else {
            empty.classList.remove('hidden');
        }
    } catch (error) {
        loading.style.display = 'none';
        empty.classList.remove('hidden');
        console.error('Error loading gallery:', error);
    }
}

function renderGallery(photos) {
    const grid = document.getElementById('galleryGrid');
    const empty = document.getElementById('galleryEmpty');
    
    if (photos.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    
    empty.classList.add('hidden');
    
    grid.innerHTML = photos.map((photo, index) => `
        <div class="gallery-item" data-category="${photo.category}" onclick="openLightbox(${index})">
            <img src="${escapeHtml(photo.imageUrl)}" alt="${escapeHtml(photo.title)}" loading="lazy"
                 onerror="this.src='https://via.placeholder.com/400x300?text=Image+Not+Found'">
            <div class="gallery-overlay">
                <span class="gallery-category">${escapeHtml(photo.category)}</span>
                <h3>${escapeHtml(photo.title)}</h3>
                ${photo.description ? `<p>${escapeHtml(photo.description)}</p>` : ''}
            </div>
        </div>
    `).join('');
}

// Filter functionality
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const filter = btn.getAttribute('data-filter');
        
        if (filter === 'all') {
            filteredPhotos = allPhotos;
        } else {
            filteredPhotos = allPhotos.filter(p => p.category === filter);
        }
        
        renderGallery(filteredPhotos);
    });
});

// Lightbox functions
function openLightbox(index) {
    currentImageIndex = index;
    const photo = filteredPhotos[index];
    
    document.getElementById('lightboxImg').src = photo.imageUrl;
    document.getElementById('lightboxTitle').textContent = photo.title;
    document.getElementById('lightboxCategory').textContent = photo.category;
    document.getElementById('lightboxDesc').textContent = photo.description || '';
    document.getElementById('lightbox').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
    document.body.style.overflow = '';
}

function changeImage(direction) {
    currentImageIndex += direction;
    
    if (currentImageIndex < 0) currentImageIndex = filteredPhotos.length - 1;
    if (currentImageIndex >= filteredPhotos.length) currentImageIndex = 0;
    
    openLightbox(currentImageIndex);
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (!document.getElementById('lightbox').classList.contains('active')) return;
    
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') changeImage(-1);
    if (e.key === 'ArrowRight') changeImage(1);
});

// Close lightbox on background click
document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'lightbox') closeLightbox();
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}