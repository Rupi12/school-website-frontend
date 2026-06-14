const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : 'https://school-website-backend-j6pc.onrender.com/api';

// Success Animation Function
function showSuccessAnimation(message = 'Success!') {
    // Create success modal
    const modal = document.createElement('div');
    modal.className = 'success-animation active';
    modal.innerHTML = `
        <div class="success-card">
            <div class="success-icon"></div>
            <h3>${message}</h3>
            <p>Thank you for your submission!</p>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Create confetti
    createConfetti();
    
    // Click to dismiss
    modal.addEventListener('click', () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
    });
    
    // Auto dismiss after 3 seconds
    setTimeout(() => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
    }, 3000);
}

function createConfetti() {
    const colors = ['#2563eb', '#7c3aed', '#fbbf24', '#10b981', '#ef4444', '#ec4899'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = '-10px';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.animationDuration = (Math.random() * 1 + 2) + 's';
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        
        if (Math.random() > 0.5) {
            confetti.style.borderRadius = '50%';
        }
        
        document.body.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 3500);
    }
}




// Mobile Menu Toggle
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
if (hamburger) {
    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });
}

// Counter Animation
const counters = document.querySelectorAll('.counter');
const animateCounter = (counter) => {
    const target = +counter.getAttribute('data-target');
    const increment = target / 100;
    let current = 0;
    const update = () => {
        current += increment;
        if (current < target) {
            counter.innerText = Math.ceil(current);
            setTimeout(update, 20);
        } else {
            counter.innerText = target;
        }
    };
    update();
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

counters.forEach(counter => observer.observe(counter));

// Admission Form - Now connects to backend!
const admissionForm = document.getElementById('admissionForm');
if (admissionForm) {
    admissionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(admissionForm);
        const data = Object.fromEntries(formData);
        const msg = document.getElementById('formMessage');
        
        // Show loading
        const submitBtn = admissionForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const response = await fetch(`${API_URL}/applications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (result.success) {
                msg.className = 'form-message success';
                msg.style.display = 'block';
                msg.textContent = '✅ Application submitted successfully! We will contact you soon.';
                admissionForm.reset();
            } else {
                msg.className = 'form-message error';
                msg.style.display = 'block';
                msg.textContent = '❌ ' + (result.message || 'Submission failed');
            }
        } catch (error) {
            msg.className = 'form-message error';
            msg.style.display = 'block';
            msg.textContent = '❌ Server error. Please ensure backend is running.';
            console.error(error);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
        
        setTimeout(() => msg.style.display = 'none', 5000);
    });
}

// Popup Admission Form Logic
document.addEventListener('DOMContentLoaded', () => {
    const popup = document.getElementById('admissionPopup');
    if (popup) {
        const currentDate = new Date();
        // Show for the next 2 months (Expires Aug 14, 2026)
        const expiryDate = new Date('2026-08-14'); 
        const hasSeenPopup = sessionStorage.getItem('admissionPopupSeen');

        if (currentDate <= expiryDate && !hasSeenPopup) {
            setTimeout(() => {
                popup.style.display = 'flex';
                sessionStorage.setItem('admissionPopupSeen', 'true');
            }, 2000); // Wait 2 seconds after page load
        }
        
        // Close on background click
        popup.addEventListener('click', (e) => {
            if (e.target.id === 'admissionPopup') popup.style.display = 'none';
        });
    }
});

const popupAdmissionForm = document.getElementById('popupAdmissionForm');
if (popupAdmissionForm) {
    popupAdmissionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(popupAdmissionForm);
        const data = Object.fromEntries(formData);
        const msg = document.getElementById('popupFormMessage');
        
        const submitBtn = popupAdmissionForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const response = await fetch(`${API_URL}/applications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            msg.style.display = 'block';
            if (result.success) {
                msg.style.background = '#d1fae5'; msg.style.color = '#065f46';
                msg.textContent = '✅ Application submitted successfully!';
                popupAdmissionForm.reset();
                setTimeout(() => document.getElementById('admissionPopup').style.display = 'none', 3000);
            } else {
                msg.style.background = '#fee2e2'; msg.style.color = '#991b1b';
                msg.textContent = '❌ ' + (result.message || 'Submission failed');
            }
        } catch (error) {
            msg.style.display = 'block';
            msg.style.background = '#fee2e2'; msg.style.color = '#991b1b';
            msg.textContent = '❌ Server error.';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

// Contact Form - Now connects to backend!
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData);
        const msg = document.getElementById('contactMessage');
        
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
            const response = await fetch(`${API_URL}/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (result.success) {
                msg.className = 'form-message success';
                msg.style.display = 'block';
                msg.textContent = '✅ Message sent successfully! We will reply soon.';
                contactForm.reset();
            } else {
                msg.className = 'form-message error';
                msg.style.display = 'block';
                msg.textContent = '❌ ' + (result.message || 'Failed to send');
            }
        } catch (error) {
            msg.className = 'form-message error';
            msg.style.display = 'block';
            msg.textContent = '❌ Server error. Please ensure backend is running.';
            console.error(error);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
        
        setTimeout(() => msg.style.display = 'none', 5000);
    });
}

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});

// ============ HOMEPAGE NEWS ============
async function loadHomeNews() {
    const grid = document.getElementById('homeNewsGrid');
    if (!grid) return;
    try {
        const res = await fetch(`${API_URL}/news/latest`);
        const data = await res.json();
        if (data.success && data.news.length > 0) {
            const icons = { 'News': '📰', 'Events': '🎉', 'Achievements': '🏆', 'Announcements': '📢' };
            grid.innerHTML = data.news.map(item => `
                <div class="news-card" onclick="window.location.href='news.html'">
                    ${item.imageUrl ? `<div class="news-card-image"><img src="${item.imageUrl}" alt="${item.title}" onerror="this.parentElement.style.display='none'"></div>` : ''}
                    <div class="news-card-content">
                        <span class="news-category-badge cat-${item.category}">${icons[item.category]} ${item.category}</span>
                        <h3>${escapeHtmlHome(item.title)}</h3>
                        <div class="news-date">📅 ${new Date(item.createdAt).toLocaleDateString()}</div>
                        <p>${escapeHtmlHome(item.description.substring(0, 100))}...</p>
                    </div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<p style="text-align:center;color:#6b7280">No news yet. Check back soon!</p>';
        }
    } catch (error) {
        console.error('Error loading home news:', error);
    }
}

async function loadAnnouncements() {
    const banner = document.getElementById('announcementBanner');
    if (!banner) return;
    if (sessionStorage.getItem('bannerClosed')) return;
    try {
        const res = await fetch(`${API_URL}/news/announcements`);
        const data = await res.json();
        if (data.success && data.announcements.length > 0) {
            const content = document.getElementById('announcementContent');
            content.innerHTML = data.announcements.map(a => `<span>📢 ${escapeHtmlHome(a.title)}</span>`).join('');
            banner.classList.add('active');
        }
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

function closeBanner() {
    document.getElementById('announcementBanner').classList.remove('active');
    sessionStorage.setItem('bannerClosed', 'true');
}

function escapeHtmlHome(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

loadHomeNews();
loadAnnouncements();