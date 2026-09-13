import { db, doc, getDoc, setDoc } from "./firebase-init.js";

let refreshTimer = null;

export function cleanupStudentView() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

function formatDateRO(iso) {
  const [y, m, d] = iso.split("-");
  const luni = ["ianuarie","februarie","martie","aprilie","mai","iunie","iulie",
    "august","septembrie","octombrie","noiembrie","decembrie"];
  return `${parseInt(d, 10)} ${luni[parseInt(m, 10) - 1]} ${y}`;
}
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

export async function renderStudentView(root, { uid, displayName, onLogout }) {
  root.innerHTML = `<div class="loading">Se incarca...</div>`;

  async function paint() {
    const activeSnap = await getDoc(doc(db, "meta", "activeSession"));
    let body;

    if (!activeSnap.exists()) {
      body = `<div class="card"><p class="empty-state">Nu este deschisa nicio prezenta in acest moment. Asteapta ca responsabilul de grupa sa o deschida.</p></div>`;
    } else {
      const session = activeSnap.data();
      const attSnap = await getDoc(doc(db, "sessions", session.sessionId, "attendance", uid));
      const already = attSnap.exists() && attSnap.data().present;

      body = `
        <div class="card active-lecture">
          <p class="label">Prelegerea de acum</p>
          <h2>${session.lecture}</h2>
          <p class="date">${formatDateRO(session.date)}</p>
        </div>
        <div class="card">
          ${already
            ? `<p class="empty-state">Prezenta ta a fost inregistrata la <strong>${formatTime(attSnap.data().timestamp)}</strong>. Esti la curent.</p>`
            : `<p class="empty-state">Confirma ca esti prezent la aceasta prelegere.</p>
               <button class="btn btn-primary" id="confirm-btn">Confirma prezenta</button>`
          }
        </div>
      `;
    }

    root.innerHTML = `
      <div class="masthead">
        <p class="kicker">Registru de prezenta</p>
        <h1>${displayName}</h1>
      </div>
      ${body}
      <div class="toolbar">
        <button id="refresh-btn">Reimprospateaza</button>
        <button id="logout-btn">Iesi din cont</button>
      </div>
    `;

    const confirmBtn = document.getElementById("confirm-btn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Se salveaza...";
        const session = activeSnap.data();
        await setDoc(doc(db, "sessions", session.sessionId, "attendance", uid), {
          present: true,
          timestamp: new Date().toISOString(),
          studentName: displayName,
        });
        await paint();
      });
    }
    document.getElementById("refresh-btn").addEventListener("click", paint);
    document.getElementById("logout-btn").addEventListener("click", onLogout);
  }

  await paint();
  refreshTimer = setInterval(paint, 20000);
}
