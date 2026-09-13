import {
  db, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, orderBy,
} from "./firebase-init.js";

let refreshTimer = null;
export function cleanupAdminView() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function formatDateRO(iso) {
  const [y, m, d] = iso.split("-");
  const luni = ["ianuarie","februarie","martie","aprilie","mai","iunie","iulie",
    "august","septembrie","octombrie","noiembrie","decembrie"];
  return `${parseInt(d, 10)} ${luni[parseInt(m, 10) - 1]} ${y}`;
}

export async function renderAdminView(root, { uid, displayName, onLogout }) {
  root.innerHTML = `<div class="loading">Se incarca panoul...</div>`;

  let view = "main"; // main | stats

  async function loadHistory() {
    const snap = await getDocs(query(collection(db, "sessions"), orderBy("date", "desc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async function loadStudentDirectory() {
    const snap = await getDocs(collection(db, "students"));
    return snap.docs.map((d) => d.data()).sort((a, b) => a.name.localeCompare(b.name, "ro"));
  }

  async function paintMain() {
    const activeSnap = await getDoc(doc(db, "meta", "activeSession"));
    const history = await loadHistory();

    let activeCount = 0, activeTotal = 0;
    let activeBlock;
    let ownAttendanceBlock = "";
    if (activeSnap.exists()) {
      const session = activeSnap.data();
      const attSnap = await getDocs(collection(db, "sessions", session.sessionId, "attendance"));
      activeCount = attSnap.docs.filter((d) => d.data().present).length;
      const dir = await loadStudentDirectory();
      activeTotal = dir.length;

      activeBlock = `
        <div class="card active-lecture">
          <p class="label">Prelegerea activa</p>
          <h2>${session.lecture}</h2>
          <p class="date">${formatDateRO(session.date)} &middot; ${activeCount}/${activeTotal} prezenti</p>
        </div>
        <div class="card">
          <button class="btn btn-secondary" id="close-session-btn">Inchide prezenta</button>
        </div>
      `;

      const ownAttDoc = attSnap.docs.find((d) => d.id === uid);
      const ownAlready = ownAttDoc && ownAttDoc.data().present;
      ownAttendanceBlock = `
        <div class="card">
          <h3 class="section-title">Prezenta ta</h3>
          ${ownAlready
            ? `<p class="empty-state">Prezenta ta a fost inregistrata azi la aceasta prelegere.</p>`
            : `<p class="empty-state">Ca membru al grupei, poti confirma si prezenta ta.</p>
               <button class="btn btn-primary" id="own-attendance-btn">Confirma prezenta mea</button>`
          }
        </div>
      `;
    } else {
      activeBlock = `
        <div class="card">
          <h3 class="section-title">Deschide o prezenta noua</h3>
          <div class="field"><label>Data prelegerii</label><input type="date" id="new-date" value="${todayISO()}"></div>
          <div class="field"><label>Denumirea prelegerii</label><input type="text" id="new-lecture" placeholder="ex: Algoritmi si structuri de date"></div>
          <button class="btn btn-primary" id="open-session-btn">Deschide prezenta</button>
        </div>
      `;
    }

    const historyRows = history.length
      ? history.map((s) => `<div class="history-row"><span>${formatDateRO(s.date)} - ${s.lecture}</span></div>`).join("")
      : `<p class="empty-state" style="margin:0;">Niciun istoric inca.</p>`;

    root.innerHTML = `
      <div class="masthead">
        <p class="kicker">Registru de prezenta &middot; responsabil</p>
        <h1>${displayName}</h1>
      </div>
      ${activeBlock}
      ${ownAttendanceBlock}
      <div class="card">
        <h3 class="section-title">Istoric prelegeri</h3>
        ${historyRows}
        ${history.length ? `<button class="btn btn-secondary" style="margin-top:8px;" id="stats-btn">Vezi statistici pe student</button>` : ""}
      </div>
      <div class="toolbar">
        <span></span>
        <button id="logout-btn">Iesi din cont</button>
      </div>
    `;

    const openBtn = document.getElementById("open-session-btn");
    if (openBtn) openBtn.addEventListener("click", async () => {
      const date = document.getElementById("new-date").value;
      const lecture = document.getElementById("new-lecture").value.trim();
      if (!date || !lecture) return;
      const sessionId = Date.now().toString();
      await setDoc(doc(db, "sessions", sessionId), { date, lecture, createdAt: new Date().toISOString() });
      await setDoc(doc(db, "meta", "activeSession"), { sessionId, date, lecture });
      await paintMain();
    });

    const closeBtn = document.getElementById("close-session-btn");
    if (closeBtn) closeBtn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "meta", "activeSession"));
      await paintMain();
    });

    const statsBtn = document.getElementById("stats-btn");
    if (statsBtn) statsBtn.addEventListener("click", paintStats);

    const ownBtn = document.getElementById("own-attendance-btn");
    if (ownBtn) ownBtn.addEventListener("click", async () => {
      ownBtn.disabled = true;
      ownBtn.textContent = "Se salveaza...";
      const session = activeSnap.data();
      await setDoc(doc(db, "sessions", session.sessionId, "attendance", uid), {
        present: true,
        timestamp: new Date().toISOString(),
        studentName: displayName,
      });
      await paintMain();
    });

    document.getElementById("logout-btn").addEventListener("click", onLogout);
  }

  async function paintStats() {
    root.innerHTML = `<div class="loading">Se calculeaza statisticile...</div>`;

    const history = await loadHistory();
    const dir = await loadStudentDirectory();
    const counts = {};
    dir.forEach((s) => counts[s.name] = 0);

    for (const s of history) {
      const attSnap = await getDocs(collection(db, "sessions", s.id, "attendance"));
      attSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.present && counts.hasOwnProperty(data.studentName)) counts[data.studentName]++;
      });
    }

    const rows = dir.map((s) => {
      const c = counts[s.name] || 0;
      const pct = history.length ? Math.round((c / history.length) * 100) : 0;
      return `<tr><td>${s.name}</td><td>${c}/${history.length}</td><td>${pct}%</td></tr>`;
    }).join("");

    root.innerHTML = `
      <div class="masthead">
        <p class="kicker">Registru de prezenta &middot; responsabil</p>
        <h1>Statistici</h1>
      </div>
      <div class="card">
        <table class="stats-table">
          <thead><tr><th>Student</th><th>Prezente</th><th>%</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <button class="btn btn-secondary" style="margin-top:10px;" id="back-btn">Inapoi</button>
      </div>
    `;
    document.getElementById("back-btn").addEventListener("click", paintMain);
  }

  await paintMain();
  refreshTimer = setInterval(() => { if (view === "main") paintMain(); }, 20000);
}
