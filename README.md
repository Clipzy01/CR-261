# Evidența prezenței — Grupa mea

Aplicație web cu autentificare reală: fiecare student are propriul cont
(email + parolă) și poate marca prezența **doar pentru sine** — regula e
impusă de server (Firestore Security Rules), nu doar de codul din browser.

Stack: HTML/CSS/JavaScript (fără build step) + **Firebase** (Authentication
+ Firestore, gratuit la scara unei grupe) + hosting static pe **GitHub Pages**.

---

## 0. Ce ai nevoie

- Un cont Google (pentru Firebase Console — e gratuit)
- [Node.js](https://nodejs.org) instalat (pentru scriptul care creează conturile)
- VS Code (îl ai deja) cu extensia **Live Server** (recomandat, pentru testare locală)

---

## 1. Creează proiectul Firebase

1. Deschide [console.firebase.google.com](https://console.firebase.google.com) și apasă **Add project**.
2. Dă-i un nume (ex. `grupa27-prezenta`), continuă cu setările implicite (Google Analytics nu e necesar — îl poți dezactiva).

## 2. Activează Authentication

1. În meniul din stânga: **Build → Authentication → Get started**.
2. La tab-ul **Sign-in method**, activează furnizorul **Email/Password**.

## 3. Activează Firestore (baza de date)

1. **Build → Firestore Database → Create database**.
2. Alege modul **production** și o regiune apropiată de tine (ex. `europe-central2` pentru Moldova/România).

## 4. Ia configurația web și pune-o în proiect

1. Apasă pe rotița ⚙️ din stânga sus → **Project settings**.
2. La secțiunea **Your apps**, apasă pe iconița web `</>` și înregistrează o aplicație (orice nume).
3. Copiază obiectul `firebaseConfig` afișat.
4. Deschide `js/firebase-config.js` din acest proiect și înlocuiește valorile placeholder cu cele copiate.

## 5. Publică regulile de securitate

1. **Build → Firestore Database → Rules**.
2. Șterge conținutul existent și lipește tot conținutul fișierului `firestore.rules` din acest proiect.
3. Apasă **Publish**.

Aceste reguli sunt partea esențială: ele garantează, la nivel de server, că
un student conectat cu contul lui poate scrie *doar* în documentul lui de
prezență — indiferent ce ar încerca să facă din interfață sau din codul
sursă al paginii.

## 6. Descarcă cheia de administrare (pentru scriptul de creare conturi)

1. **Project settings → Service accounts**.
2. Apasă **Generate new private key** → se descarcă un fișier `.json`.
3. Redenumește-l `serviceAccountKey.json` și pune-l în folderul `scripts/`.

⚠️ Acest fișier e o cheie secretă cu acces total la proiect — **nu îl urca
niciodată pe GitHub**. E deja inclus în `.gitignore`, deci git îl va ignora
automat.

## 7. Creează conturile celor 27 de studenți

În terminalul din VS Code:

```bash
cd scripts
npm install
node create-students.mjs
```

Scriptul citește `students-list.json` (nume + parolă inițială pentru
fiecare) și creează automat toate conturile în Firebase, plus documentele
din Firestore. Poți rula scriptul din nou oricând mai adaugi studenți în
`students-list.json` — cei deja existenți sunt săriți automat.

La final, scriptul îți arată adresa de login a fiecărui student:
`slug-nume@grupa27.local`. Parola e cea din `students-list.json`.

**Trimite fiecărui student, în privat, adresa lui și parola** (de exemplu
mesaj individual pe WhatsApp/Telegram). Nu le posta în grupul comun — cine
are parola cuiva se poate loga în locul lui, exact ca la orice cont.

## 8. Fă-te pe tine administrator

1. Loghează-te o dată în aplicație (după ce o rulezi local la pasul 9) cu
   contul tău din `students-list.json`.
2. În Firebase Console: **Authentication → Users**, găsește-ți contul și
   copiază **User UID**.
3. **Firestore Database → Data**, creează manual o colecție nouă numită
   `admins`, cu un document al cărui **ID** este exact acel UID (conținutul
   documentului poate fi gol, contează doar ID-ul).

Din acel moment, contul tău va deschide automat panoul de responsabil în loc
de ecranul obișnuit de student.

## 9. Testează local

Modulele JavaScript folosite (`type="module"`) nu funcționează deschizând
direct fișierul (`file://`) — ai nevoie de un mic server local:

- În VS Code, instalează extensia **Live Server**, click dreapta pe
  `index.html` → **Open with Live Server**.

## 10. Publică pe GitHub Pages (gratuit)

1. Creează un repo nou pe GitHub și urcă tot folderul (fără
   `serviceAccountKey.json` — `.gitignore` are deja grijă de asta).
2. În repo: **Settings → Pages** → sub **Source**, alege branch-ul `main`
   și folderul `/ (root)` → **Save**.
3. După câteva minute, linkul va fi
   `https://<numele-tau-de-utilizator>.github.io/<numele-repo-ului>/` —
   acesta e linkul pe care îl trimiți grupei.

---

## Structura proiectului

```
index.html                   pagina principala (login + aplicatie)
css/styles.css                stiluri
js/firebase-config.js         cheile tale Firebase (le completezi la pasul 4)
js/firebase-init.js           initializarea Firebase SDK
js/app.js                     login si rutare intre ecranul de student/admin
js/student-view.js            ecranul studentului (confirma propria prezenta)
js/admin-view.js              panoul responsabilului (deschide/inchide prezenta, statistici)
firestore.rules               regulile de securitate (le copiezi la pasul 5)
scripts/students-list.json    lista celor 27 de studenti + parolele initiale
scripts/create-students.mjs   scriptul care creeaza automat conturile (pasul 7)
scripts/package.json          dependinta necesara scriptului (firebase-admin)
scripts/serviceAccountKey.json   cheia ta secreta (o adaugi tu, NU e in proiect, NU se urca pe git)
```

## Cum funcționează securitatea, pe scurt

- Fiecare student are un cont Firebase real (email + parolă), creat de tine
  o singură dată prin script.
- Prezența se scrie într-un document Firestore al cărui ID este exact
  UID-ul contului autentificat.
- Regula din `firestore.rules` permite scrierea acelui document *doar* dacă
  `request.auth.uid` (cine e logat acum) e identic cu ID-ul documentului —
  verificare făcută de Firebase pe server, nu în browser. Nu contează ce
  interfață se folosește; nimeni nu poate scrie prezență pentru altcineva
  fără să-i știe parola contului.
- Doar conturile care au un document în colecția `admins` pot deschide sau
  închide o prelegere — restul conturilor primesc "permission denied" de la
  server dacă ar încerca.
