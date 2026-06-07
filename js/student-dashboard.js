const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : 'https://school-website-backend-j6pc.onrender.com/api';

const token = localStorage.getItem('studentToken');
const info = JSON.parse(localStorage.getItem('studentInfo') || '{}');

if (!token) window.location.href = 'student-login.html';

document.getElementById('studentInfo').textContent = 
    `${info.name} | Roll: ${info.rollNumber} | Class ${info.class} ${info.section || ''}`;

const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

loadResults();

function esc(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

let allResults = [];

async function loadResults() {
    const panel = document.getElementById('results-panel');
    try {
        const res = await fetch(`${API_URL}/student/results`, { headers });
        if (res.status === 401) return logout();
        const data = await res.json();
        allResults = data.results;
        if (!allResults.length) { panel.innerHTML = '<p>No results published yet.</p>'; return; }

        // Year filter
        const years = [...new Set(allResults.map(r => r.academicYear).filter(Boolean))];
        panel.innerHTML = `
            <select id="resultYear" onchange="renderResults()" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;margin-bottom:1rem">
                <option value="all">All Years</option>
                ${years.map(y => `<option value="${y}">${y}</option>`).join('')}
            </select>
            <div id="resultCards"></div>
        `;
        renderResults();
    } catch (e) { panel.innerHTML = '<p>Error loading results.</p>'; }
}

function getGrade(pct) {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
}

function renderResults() {
    const year = document.getElementById('resultYear').value;
    const filtered = year === 'all' ? allResults : allResults.filter(r => r.academicYear === year);
    const container = document.getElementById('resultCards');

    container.innerHTML = filtered.map(r => {
        const totalObt = r.subjects.reduce((sum, s) => sum + s.marksObtained, 0);
        const totalMax = r.subjects.reduce((sum, s) => sum + s.totalMarks, 0);
        const pct = totalMax ? ((totalObt / totalMax) * 100).toFixed(1) : 0;
        const grade = getGrade(pct);
        const passed = pct >= 33;

        return `
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
                <div>
                    <h3 style="color:#2563eb;margin:0">${esc(r.examName)}</h3>
                    <small style="color:#6b7280">${esc(r.term)} | ${esc(r.academicYear)} ${r.examDate ? '| ' + new Date(r.examDate).toLocaleDateString() : ''}</small>
                </div>
                <span class="badge ${passed?'paid':'absent'}" style="height:fit-content">${passed ? 'PASS' : 'FAIL'}</span>
            </div>
            <table style="margin:1rem 0">
                <thead><tr><th>Subject</th><th>Marks</th><th>Total</th></tr></thead>
                <tbody>
                    ${r.subjects.map(s => `<tr><td>${esc(s.subject)}</td><td>${s.marksObtained}</td><td>${s.totalMarks}</td></tr>`).join('')}
                </tbody>
            </table>
            <div style="display:flex;gap:2rem;flex-wrap:wrap;font-weight:600">
                <span>Total: ${totalObt}/${totalMax}</span>
                <span>Percentage: ${pct}%</span>
                <span>Grade: <span style="color:#2563eb">${grade}</span></span>
            </div>
            ${r.remark ? `<p style="margin-top:0.8rem;color:#6b7280;font-style:italic">📝 ${esc(r.remark)}</p>` : ''}
        </div>
        `;
    }).join('') || '<p>No results for this year.</p>';
}





let allAttendance = [];

async function loadAttendance() {
    const panel = document.getElementById('attendance-panel');
    try {
        const res = await fetch(`${API_URL}/student/attendance`, { headers });
        const data = await res.json();
        allAttendance = data.attendance;
        const s = data.summary;

        // Get unique month-year options
        const monthYears = [...new Set(allAttendance.map(a => {
            const d = new Date(a.date);
            return `${d.getFullYear()}-${d.getMonth()}`;
        }))];

        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const options = monthYears.map(my => {
            const [year, month] = my.split('-');
            return `<option value="${my}">${monthNames[month]} ${year}</option>`;
        }).join('');

        panel.innerHTML = `
            <div style="text-align:center;margin-bottom:1.5rem">
                <div class="stat-big">${s.percentage}%</div>
                <p>Overall: Present ${s.present} / ${s.total} days</p>
            </div>
            <select id="monthFilter" onchange="filterAttendance()" style="padding:0.6rem;border:2px solid #e5e7eb;border-radius:8px;margin-bottom:1rem">
                <option value="all">All Records</option>
                ${options}
            </select>
            <table>
                <thead><tr><th>Date</th><th>Status</th></tr></thead>
                <tbody id="attBody"></tbody>
            </table>
        `;
        filterAttendance();
    } catch (e) {
        panel.innerHTML = '<p>Error loading attendance.</p>';
    }
}

function filterAttendance() {
    const filter = document.getElementById('monthFilter').value;
    let filtered = allAttendance;

    if (filter !== 'all') {
        const [year, month] = filter.split('-');
        filtered = allAttendance.filter(a => {
            const d = new Date(a.date);
            return d.getFullYear() == year && d.getMonth() == month;
        });
    }

    document.getElementById('attBody').innerHTML = filtered.length
        ? filtered.map(a => `<tr><td>${new Date(a.date).toLocaleDateString()}</td><td><span class="badge ${a.status.toLowerCase()}">${a.status}</span></td></tr>`).join('')
        : '<tr><td colspan="2">No records</td></tr>';
}

async function loadTimetable() {
    const panel = document.getElementById('timetable-panel');
    try {
        const res = await fetch(`${API_URL}/student/timetable`, { headers });
        const data = await res.json();
        if (!data.timetable) { panel.innerHTML = '<p>No timetable set.</p>'; return; }
        panel.innerHTML = data.timetable.schedule.map(day => `
            <h3 style="color:#2563eb">${esc(day.day)}</h3>
            <table style="margin-bottom:1rem">
                <thead><tr><th>Time</th><th>Subject</th><th>Teacher</th></tr></thead>
                <tbody>
                    ${day.periods.map(p => `<tr><td>${esc(p.time)}</td><td>${esc(p.subject)}</td><td>${esc(p.teacher)}</td></tr>`).join('')}
                </tbody>
            </table>
        `).join('');
    } catch (e) { panel.innerHTML = '<p>Error loading timetable.</p>'; }
}

async function loadFees() {
    const panel = document.getElementById('fees-panel');
    try {
        const res = await fetch(`${API_URL}/student/fees`, { headers });
        const data = await res.json();
        if (!data.fees.length) { panel.innerHTML = '<p>No fee records.</p>'; return; }
        panel.innerHTML = `
            <table>
                <thead><tr><th>Type</th><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
                <tbody>
                    ${data.fees.map(f => `<tr>
                        <td>${esc(f.feeType)}</td>
                        <td>₹${f.amount}</td>
                        <td>${f.dueDate ? new Date(f.dueDate).toLocaleDateString() : '-'}</td>
                        <td><span class="badge ${f.status.toLowerCase()}">${f.status}</span></td>
                    </tr>`).join('')}
                </tbody>
            </table>
        `;
    } catch (e) { panel.innerHTML = '<p>Error loading fees.</p>'; }
}

async function loadDocuments() {
    const panel = document.getElementById('documents-panel');
    try {
        const res = await fetch(`${API_URL}/student/documents`, { headers });
        const data = await res.json();
        if (!data.documents.length) { panel.innerHTML = '<p>No documents.</p>'; return; }
        panel.innerHTML = data.documents.map(d => `
            <div style="display:flex;align-items:center;gap:1rem;padding:1rem;border-bottom:1px solid #eee">
                <div style="font-size:2rem">📄</div>
                <div style="flex:1"><strong>${esc(d.title)}</strong></div>
                <a href="${d.fileUrl}" target="_blank" class="btn btn-primary">⬇️ Download</a>
            </div>
        `).join('');
    } catch (e) { panel.innerHTML = '<p>Error loading documents.</p>'; }
}

function showPanel(name, btn) {
    document.querySelectorAll('.sd-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['results','attendance','timetable','fees','documents'].forEach(p => {
        document.getElementById(p + '-panel').classList.toggle('hidden', p !== name);
    });
    if (name === 'attendance') loadAttendance();
    if (name === 'timetable') loadTimetable();
    if (name === 'fees') loadFees();
    if (name === 'documents') loadDocuments();
}

function logout() {
    localStorage.removeItem('studentToken');
    localStorage.removeItem('studentInfo');
    window.location.href = 'student-login.html';
}