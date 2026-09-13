// Script de provizionare: creeaza conturile Firebase Authentication
// pentru toti studentii din students-list.json si documentele lor in Firestore.
//
// Ruleaza o singura data (sau de fiecare data cand adaugi studenti noi in
// students-list.json - studentii deja existenti sunt sariti automat).
//
// Utilizare:
//   cd scripts
//   npm install
//   node create-students.mjs

import { readFile } from "fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const EMAIL_DOMAIN = "grupa27.local";

async function main() {
  const serviceAccountRaw = await readFile(new URL("./serviceAccountKey.json", import.meta.url));
  const serviceAccount = JSON.parse(serviceAccountRaw);

  initializeApp({ credential: cert(serviceAccount) });
  const auth = getAuth();
  const db = getFirestore();

  const listRaw = await readFile(new URL("./students-list.json", import.meta.url), "utf-8");
  const students = JSON.parse(listRaw);

  console.log(`Se provizioneaza ${students.length} conturi...\n`);

  for (const student of students) {
    const email = `${student.slug}@${EMAIL_DOMAIN}`;
    let userRecord;

    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`- ${student.name}: contul exista deja (${email}), il pastrez.`);
    } catch (err) {
      if (err.code !== "auth/user-not-found") throw err;
      userRecord = await auth.createUser({
        email,
        password: student.password,
        displayName: student.name,
      });
      console.log(`+ ${student.name}: cont creat (${email})`);
    }

    await db.collection("students").doc(student.slug).set({
      name: student.name,
      email,
      uid: userRecord.uid,
    });
  }

  console.log("\nGata. Toate conturile si documentele Firestore sunt create.");
  console.log("Nu uita: trimite fiecarui student adresa lui (slug@grupa27.local) si parola, IN PRIVAT.");
  console.log("Pentru a te face pe tine admin, vezi pasul din README (colectia 'admins').");
}

main().catch((err) => {
  console.error("Eroare:", err.message);
  process.exit(1);
});
