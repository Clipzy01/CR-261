import {
  auth, db,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  doc, getDoc, collection, getDocs,
} from "./firebase-init.js";
import { renderStudentView, cleanupStudentView } from "./student-view.js";
import { renderAdminView, cleanupAdminView } from "./admin-view.js";

const root = document.getElementById("root");
let studentsDirectory = []; // [{slug, name, email}]
let loginError = null;
let loggingIn = false;

async function loadDirectory() {
  const snap = await getDocs(collection(db, "students"));
  studentsDirectory = snap.docs
    .map((d) => d.data())
    .sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

function renderLoading(message) {
  root.innerHTML = `<div class="loading">${message}</div>`;
}

function renderLogin() {
  const options = studentsDirectory
    .map((s) => `<option value="${s.email}">${s.name}</option>`)
    .join("");

  root.innerHTML = `
    <div class="masthead">
      <p class="kicker">Registru de prezenta</p>
      <h1>Grupa mea</h1>
    </div>
    <div class="card">
      <h3 class="section-title">Autentificare</h3>
      <div class="field">
        <label>Numele tau</label>
        <select id="login-name">
          <option value="">Alege din lista...</option>
          ${options}
        </select>
      </div>
      <div class="field">
        <label>Parola</label>
        <input type="password" id="login-password" placeholder="Parola primita de la responsabil">
      </div>
      ${loginError ? `<p class="error-text">${loginError}</p>` : ""}
      <button class="btn btn-primary" id="login-btn" ${loggingIn ? "disabled" : ""}>
        ${loggingIn ? "Se autentifica..." : "Intra in cont"}
      </button>
      <p class="empty-state" style="margin-top:10px;">
        Nu ai primit parola? Cere-o responsabilului de grupa, in privat.
      </p>
    </div>
  `;

  document.getElementById("login-btn").addEventListener("click", handleLogin);
}

async function handleLogin() {
  const email = document.getElementById("login-name").value;
  const password = document.getElementById("login-password").value;

  if (!email) { loginError = "Alege-ti numele din lista."; renderLogin(); return; }
  if (!password) { loginError = "Introdu parola."; renderLogin(); return; }

  loginError = null;
  loggingIn = true;
  renderLogin();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged preia de aici incolo
  } catch (err) {
    loggingIn = false;
    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
      loginError = "Parola este gresita.";
    } else if (err.code === "auth/too-many-requests") {
      loginError = "Prea multe incercari gresite. Asteapta putin si reincearca.";
    } else {
      loginError = "Nu s-a putut face autentificarea. Incearca din nou.";
    }
    renderLogin();
  }
}

export async function handleLogout() {
  cleanupStudentView();
  cleanupAdminView();
  await signOut(auth);
}

async function boot() {
  renderLoading("Se incarca registrul...");
  await loadDirectory();

  onAuthStateChanged(auth, async (user) => {
    cleanupStudentView();
    cleanupAdminView();

    if (!user) {
      loggingIn = false;
      renderLogin();
      return;
    }

    renderLoading("Se verifica contul...");
    const adminSnap = await getDoc(doc(db, "admins", user.uid));
    const directoryEntry = studentsDirectory.find((s) => s.email === user.email);
    const displayName = directoryEntry ? directoryEntry.name : (user.displayName || user.email);

    if (adminSnap.exists()) {
      renderAdminView(root, { uid: user.uid, displayName, onLogout: handleLogout });
    } else {
      renderStudentView(root, { uid: user.uid, displayName, onLogout: handleLogout });
    }
  });
}

boot();
