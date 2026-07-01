import admin from 'firebase-admin';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

let db = null;
const hasEnvCredentials = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;
const hasFileCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

if (hasEnvCredentials) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    db = admin.firestore();
    console.log("Firebase Firestore initialized successfully via environment variables.");
  } catch (err) {
    console.error("Failed to initialize Firebase Firestore via environment variables:", err);
  }
} else if (hasFileCredentials) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log("Firebase Firestore initialized successfully via service account JSON file.");
  } catch (err) {
    console.error("Failed to initialize Firebase Firestore via JSON file:", err);
  }
} else {
  if (process.env.NODE_ENV === 'production') {
    console.warn("⚠️ CRITICAL SECURITY WARNING: Firebase credentials not found in production! Operating in local fallback mode but authentication will fail.");
  } else {
    console.log("Firebase credentials not found (neither Env variables nor JSON path). Operating in local fallback JSON database mode.");
  }
}

export { db, admin };
