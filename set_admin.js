import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app);

async function setAdmin() {
  await setDoc(doc(db, 'admins', 'seanyoo97@gmail.com'), {
    createdAt: new Date(),
    role: 'superadmin'
  });
  console.log('Admin added.');
  process.exit(0);
}

setAdmin();
