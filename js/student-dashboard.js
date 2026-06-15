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



async function downloadMyNOC() {
  try {
    const token = localStorage.getItem('studentToken');
    const res = await fetch(`${API_URL}/student-admin/my-noc`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'NOC not available');
      return;
    }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}


async function downloadMyReceipt(receiptNo) {
  try {
    const token = localStorage.getItem('studentToken');
    const res = await fetch(`${API_URL}/student/my-receipt/${encodeURIComponent(receiptNo)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert('Could not load receipt: ' + res.status);
      return;
    }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function downloadReportCard(resultId) {
    try {
        const token = localStorage.getItem('studentToken');
        const res = await fetch(`${API_URL}/student/results/${resultId}/pdf`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
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
            <button class="sd-mini-btn" style="background:#10b981; color:white; margin-top:1rem; border:none; padding:0.6rem 1.2rem; border-radius:8px; font-weight:600; cursor:pointer;" onclick="downloadReportCard('${r._id}')">📄 Download Report Card</button>
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
        ? filtered.map(a => `<tr><td>${new Date(a.date).toLocaleDateString()}</td><td><span class="badge ${a.status.toLowerCase()}">${a.status}</span>${a.remarks ? `<div style="color:#6b7280;font-size:0.8rem;margin-top:0.2rem">${esc(a.remarks)}</div>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="2">No records</td></tr>';
}

async function loadTimetable() {
    const panel = document.getElementById('timetable-panel');
    try {
        const res = await fetch(`${API_URL}/student/timetable`, { headers });
        const data = await res.json();
        if (!data.timetable || !data.timetable.schedule || data.timetable.schedule.length === 0) { 
            panel.innerHTML = '<p>No timetable set for your class.</p>'; 
            return; 
        }
        
        window.studentTimetable = data.timetable.schedule;
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        
        let defaultDay = data.timetable.schedule.some(d => d.day.trim() === today) ? today : data.timetable.schedule[0].day.trim();

        panel.innerHTML = `
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1.5rem; justify-content:center;">
                ${days.map(d => {
                    const hasData = data.timetable.schedule.some(s => s.day.trim() === d);
                    if (!hasData) return '';
                    return `<button class="sd-tab tt-day-btn ${d === defaultDay ? 'active' : ''}" onclick="showTimetableDay('${d}', this)" style="border-radius:20px; padding:0.5rem 1.2rem; background:${d === defaultDay ? '#2563eb' : '#f1f5f9'}; color:${d === defaultDay ? 'white' : '#475569'}; border:none; cursor:pointer; font-weight:600; transition:0.3s;">${d}</button>`;
                }).join('')}
            </div>
            <div id="tt-day-content"></div>
        `;
        
        // Auto-load the default day
        showTimetableDay(defaultDay, null);
    } catch (e) { panel.innerHTML = '<p>Error loading timetable.</p>'; }
}

window.showTimetableDay = function(day, btn) {
    if (btn) {
        document.querySelectorAll('.tt-day-btn').forEach(b => {
            b.style.background = '#f1f5f9';
            b.style.color = '#475569';
            b.classList.remove('active');
        });
        btn.style.background = '#2563eb';
        btn.style.color = 'white';
        btn.classList.add('active');
    }
        const dayData = window.studentTimetable.find(d => d.day.trim() === day.trim());
    const container = document.getElementById('tt-day-content');
    
    if (!dayData || dayData.periods.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#6b7280; padding:2rem;">No classes scheduled for this day.</p>';
        return;
    }
    
    container.innerHTML = `
        <div style="background:white; border:1px solid #e2e8f0; border-radius:15px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.03);">
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f8fafc;">
                        <th style="padding:1rem; text-align:left; color:#475569; font-weight:700; border-bottom:2px solid #e2e8f0;">Time</th>
                        <th style="padding:1rem; text-align:left; color:#475569; font-weight:700; border-bottom:2px solid #e2e8f0;">Subject</th>
                        <th style="padding:1rem; text-align:left; color:#475569; font-weight:700; border-bottom:2px solid #e2e8f0;">Teacher</th>
                    </tr>
                </thead>
                <tbody>
                    ${dayData.periods.map(p => `
                        <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                            <td style="padding:1rem; color:#1e293b; font-weight:600;">${esc(p.time)}</td>
                            <td style="padding:1rem; color:#3b82f6; font-weight:600;">${esc(p.subject)}</td>
                            <td style="padding:1rem; color:#475569;">${esc(p.teacher)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}


async function loadMyFees() {
    const container = document.getElementById('feeHistory');
    container.innerHTML = '<p>Loading...</p>';
    try {
        const res = await fetch(`${API_URL}/student/my-fees`, {
            headers: { 'Authorization': `Bearer ${studentToken}` }
        });
        const data = await res.json();
        if (!data.success) { container.innerHTML = '<p>Could not load fees.</p>'; return; }

        if (data.fees.length === 0) {
            container.innerHTML = '<p style="color:#6b7280">No fee records yet.</p>';
            return;
        }

        container.innerHTML = data.fees.map(f => {
            const isOverdue = f.dueDate && new Date(f.dueDate) < new Date() && f.status !== 'Paid';
            const history = f.payments.length ? `
                <div style="margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid #e5e7eb;font-size:0.85rem">
                    <strong style="color:#4b5563">Payment History:</strong>
                    ${f.payments.map(p => `
                        <div style="display:flex;justify-content:space-between;padding:0.3rem 0;color:#374151">
                            <span>₹${p.amount} · ${escapeHtml(p.mode)} · ${new Date(p.date).toLocaleDateString()}</span>
                            <span style="color:#6b7280">Receipt #${escapeHtml(p.receiptNo)}</span>
                        </div>
                    `).join('')}
                </div>` : '<p style="color:#9ca3af;font-size:0.85rem;margin-top:0.5rem">No payments recorded yet.</p>';

            const barColor = f.status === 'Paid' ? '#10b981' : (isOverdue ? '#ef4444' : '#fbbf24');

            return `
            <div style="background:white;padding:1rem 1.2rem;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.06);margin-bottom:0.8rem;border-left:4px solid ${barColor}">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem">
                    <div>
                        <strong>${escapeHtml(f.academicYear)}</strong> · <strong>${escapeHtml(f.category)}</strong>
                        <span style="color:#6b7280"> — ${escapeHtml(f.feeType)}</span>
                        ${isOverdue ? '<span style="color:#ef4444;font-weight:600;font-size:0.85rem"> ⚠️ Overdue</span>' : ''}
                    </div>
                    <span style="padding:2px 8px;border-radius:12px;font-size:0.78rem;font-weight:600;
                        background:${f.status==='Paid'?'#d1fae5':'#fef3c7'};color:${f.status==='Paid'?'#065f46':'#92400e'}">
                        ${f.status}
                    </span>
                </div>
                <div style="font-size:0.85rem;color:#4b5563;margin-top:0.5rem;">
                    Total Fee: ₹${f.amount} 
                    ${f.discount > 0 ? ` | <span style="color:#10b981;">Discount: -₹${f.discount} ${f.discountReason ? `(${escapeHtml(f.discountReason)})` : ''}</span> | Net Fee: ₹${f.amount - (f.discount || 0)}` : ''}
                </div>
                <div style="font-size:0.85rem;color:#4b5563;margin-top:0.2rem;">
                    Paid: ₹${f.totalPaid} | <span style="color:${f.pending > 0 ? '#92400e' : '#065f46'}">Pending: ₹${f.pending}</span>
                </div>
                ${history}
            </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p>Error loading fees.</p>';
    }
}

async function loadFees() {
    const panel = document.getElementById('fees-panel');
    try {
        const res = await fetch(`${API_URL}/student/my-fees`, { headers });
        if (res.status === 401) return logout();
        const data = await res.json();
        if (!data.success || !data.fees.length) { panel.innerHTML = '<p>No fee records yet.</p>'; return; }

        let totalDue = 0, totalPaid = 0, totalDiscount = 0;
        data.fees.forEach(f => { totalDue += f.amount; totalPaid += f.totalPaid; totalDiscount += f.discount || 0; });
        const pending = (totalDue - totalDiscount) - totalPaid;
        const allPaid = pending <= 0;

        panel.innerHTML = `
            <!-- BIG SUMMARY -->
            <div style="text-align:center;padding:1.5rem;border-radius:14px;margin-bottom:1.5rem;
                background:${allPaid ? '#ecfdf5' : '#fef2f2'};border:1px solid ${allPaid ? '#a7f3d0' : '#fecaca'}">
                <div style="font-size:0.9rem;color:#6b7280;font-weight:600">${allPaid ? 'ALL FEES CLEARED' : 'AMOUNT DUE'}</div>
                <div style="font-size:2.6rem;font-weight:800;color:${allPaid ? '#065f46' : '#991b1b'};margin:0.2rem 0">
                    ${allPaid ? '✅' : '₹' + pending}
                </div>
                <div style="color:#6b7280;font-size:0.9rem;margin-top:0.5rem">
                    Total Fees: ₹${totalDue} 
                    ${totalDiscount > 0 ? `| <span style="color:#10b981;">Discount: -₹${totalDiscount}</span> | Net: ₹${totalDue - totalDiscount}` : ''}
                    <br>Paid: ₹${totalPaid}
                </div>
                <button type="button" onclick="downloadMyNOC()"
    style="margin-top:1rem;background:#15803d;color:#fff;border:none;border-radius:8px;padding:0.6rem 1.4rem;font-weight:600;cursor:pointer;font-family:inherit">
    📜 Download Fee NOC
</button>
            </div>

            <!-- FEE CARDS -->
            ${data.fees.map((f, i) => {
                const netAmount = f.amount - (f.discount || 0);
                const isOverdue = f.dueDate && new Date(f.dueDate) < new Date() && f.status !== 'Paid';
                const paidThis = f.status === 'Paid';
                const statusColor = paidThis ? '#10b981' : (isOverdue ? '#ef4444' : '#f59e0b');
                const statusText = paidThis ? '✅ Paid' : (isOverdue ? '⚠️ Overdue' : '⏳ Pending');

                const receipts = f.payments.length ? f.payments.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0.8rem;background:#f9fafb;border-radius:8px;margin-top:0.4rem;font-size:0.85rem">
        <span>💵 ₹${p.amount} <span style="color:#9ca3af">· ${esc(p.mode)}</span></span>
        <span style="display:flex;align-items:center;gap:0.6rem">
            <span style="color:#6b7280">${new Date(p.date).toLocaleDateString()} · #${esc(p.receiptNo)}</span>
            <button type="button" onclick="downloadMyReceipt('${esc(p.receiptNo)}')"
                style="background:#1a2a4f;color:#fff;border:none;border-radius:5px;padding:3px 10px;font-size:0.75rem;cursor:pointer;font-family:inherit">
                Download
            </button>
        </span>
    </div>
`).join('') : '<p style="color:#9ca3af;font-size:0.85rem;margin:0.4rem 0">No payments recorded yet.</p>';

                return `
                <div style="border:1px solid #e5e7eb;border-radius:12px;padding:1.1rem 1.3rem;margin-bottom:1rem">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
                        <div>
                            <div style="font-weight:700;font-size:1.05rem">${esc(f.category)}</div>
                            <small style="color:#6b7280">${esc(f.feeType)} · ${esc(f.academicYear || '')}</small>
                        </div>
                        <span style="font-weight:700;font-size:0.85rem;color:${statusColor}">${statusText}</span>
                    </div>

                    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:0.8rem">
                        <span style="color:#6b7280;font-size:0.85rem">
                            Total: ₹${f.amount} 
                            ${f.discount > 0 ? `<br><span style="color:#10b981;">Discount: -₹${f.discount}</span> | Net: ₹${netAmount}` : ''}
                            <br>Paid: ₹${f.totalPaid}
                        </span>
                        <span style="font-weight:700;color:${f.pending > 0 ? '#991b1b' : '#065f46'};text-align:right">
                            ${f.pending > 0 ? '₹' + f.pending + ' due' : 'Cleared'}
                        </span>
                    </div>

                    <!-- progress bar -->
                    <div style="height:8px;background:#f3f4f6;border-radius:8px;margin-top:0.5rem;overflow:hidden">
                        <div style="height:100%;width:${Math.min(100, (f.totalPaid / netAmount) * 100)}%;background:${statusColor};border-radius:8px"></div>
                    </div>

                    ${f.payments.length ? `
                        <button onclick="document.getElementById('rcpt-${i}').style.display = document.getElementById('rcpt-${i}').style.display==='none'?'block':'none'"
                            style="margin-top:0.8rem;background:none;border:none;color:#2563eb;font-weight:600;cursor:pointer;font-size:0.85rem;padding:0;font-family:inherit">
                            🧾 View Receipts (${f.payments.length})
                        </button>
                        <div id="rcpt-${i}" style="display:none">${receipts}</div>
                    ` : ''}
                </div>`;
            }).join('')}
        `;
    } catch (e) { panel.innerHTML = '<p>Error loading fees.</p>'; }
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

// ============ CHANGE PASSWORD ============
const pwdModalHtml = `
<div id="studentPwdModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
    <div style="background:white; padding:2.5rem; border-radius:20px; max-width:400px; width:90%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);">
        <h3 style="color:#2563eb;margin-top:0">🔑 Change Password</h3>
        <input type="password" id="studentCurrentPwd" placeholder="Current Password" style="width:100%;padding:0.7rem;border:2px solid #e5e7eb;border-radius:8px;margin-bottom:0.8rem;box-sizing:border-box;font-family:inherit;">
        <input type="password" id="studentNewPwd" placeholder="New Password (min 6 chars)" style="width:100%;padding:0.7rem;border:2px solid #e5e7eb;border-radius:8px;margin-bottom:0.8rem;box-sizing:border-box;font-family:inherit;">
        <input type="password" id="studentConfirmPwd" placeholder="Confirm New Password" style="width:100%;padding:0.7rem;border:2px solid #e5e7eb;border-radius:8px;margin-bottom:1rem;box-sizing:border-box;font-family:inherit;">
        <div style="display:flex;gap:0.5rem">
            <button onclick="submitStudentChangePassword()" style="padding: 0.6rem 1.2rem; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-family:inherit;">Update</button>
            <button onclick="closeStudentChangePassword()" style="padding: 0.6rem 1.2rem; background: #6b7280; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-family:inherit;">Cancel</button>
        </div>
        <div id="studentPwdMsg" style="margin-top:1rem; font-weight: 600;"></div>
    </div>
</div>
`;
document.body.insertAdjacentHTML('beforeend', pwdModalHtml);

function openStudentChangePassword() { 
    document.getElementById('studentPwdModal').style.display = 'flex'; 
}
function closeStudentChangePassword() {
    document.getElementById('studentPwdModal').style.display = 'none';
    document.getElementById('studentCurrentPwd').value = '';
    document.getElementById('studentNewPwd').value = '';
    document.getElementById('studentConfirmPwd').value = '';
    document.getElementById('studentPwdMsg').innerHTML = '';
}

async function submitStudentChangePassword() {
    const currentPassword = document.getElementById('studentCurrentPwd').value;
    const newPassword = document.getElementById('studentNewPwd').value;
    const confirmPwd = document.getElementById('studentConfirmPwd').value;
    const msg = document.getElementById('studentPwdMsg');

    if (!currentPassword || !newPassword) return msg.innerHTML = '<span style="color:#991b1b">❌ Fill all fields</span>';
    if (newPassword !== confirmPwd) return msg.innerHTML = '<span style="color:#991b1b">❌ New passwords do not match</span>';
    if (newPassword.length < 6) return msg.innerHTML = '<span style="color:#991b1b">❌ Min 6 characters</span>';

    msg.innerHTML = '<span style="color:#2563eb">⏳ Updating...</span>';
    try {
        const res = await fetch(`${API_URL}/student/change-password`, { method: 'PUT', headers, body: JSON.stringify({ currentPassword, newPassword }) });
        const r = await res.json();
        if (r.success) { msg.innerHTML = '<span style="color:#065f46">✅ Password changed! Logging out...</span>'; setTimeout(logout, 2000); }
        else { msg.innerHTML = `<span style="color:#991b1b">❌ ${r.message}</span>`; }
    } catch (e) { msg.innerHTML = '<span style="color:#991b1b">❌ Server error</span>'; }
}