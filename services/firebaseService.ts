
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, updateDoc, deleteField } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBdCQLx7Inm7cLU3dnYsWpn048GEmrPYPk",
  authDomain: "video-json-eeece.firebaseapp.com",
  projectId: "video-json-eeece",
  storageBucket: "video-json-eeece.firebasestorage.app",
  messagingSenderId: "329004987",
  appId: "1:329004987:web:2cf6227fca7088532c369e",
  measurementId: "G-Y6S277GER0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// إضافة ميزة تحسين تجربة المستخدم عند حدوث خطأ في النطاق
export const signInWithGoogle = async () => {
  try {
    // محاولة تسجيل الدخول عبر النافذة المنبثقة
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Firebase Sign-In Error Details:", {
      code: error.code,
      message: error.message,
      domain: window.location.hostname
    });
    throw error;
  }
};

export const syncSessionsToFirebase = async (userId: string, sessions: any[]) => {
  if (!userId || userId === 'guest') return;
  try {
    const userSessionsRef = doc(db, "user_sessions", userId);
    const cleanSessions = JSON.parse(JSON.stringify(sessions));
    await setDoc(userSessionsRef, { 
      sessions: cleanSessions, 
      lastSync: Date.now()
    }, { merge: true });
    return true;
  } catch (e: any) {
    console.error("Cloud Sync Error:", e.message);
    return false;
  }
};

export const fetchSessionsFromFirebase = async (userId: string) => {
  if (!userId || userId === 'guest') return [];
  try {
    const userSessionsRef = doc(db, "user_sessions", userId);
    const docSnap = await getDoc(userSessionsRef);
    return docSnap.exists() ? docSnap.data().sessions || [] : [];
  } catch (e: any) {
    console.error("Fetch Error:", e.message);
    return [];
  }
};

export const saveUserMemoryToCloud = async (userId: string, memoryUpdate: string) => {
  if (!userId || userId === 'guest') return;
  try {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    let currentMemory = snap.exists() ? (snap.data().memory || "") : "";
    const updatedMemory = `${currentMemory}\n- ${new Date().toLocaleDateString()}: ${memoryUpdate}`.slice(-3000);
    await setDoc(userRef, { memory: updatedMemory }, { merge: true });
  } catch (e: any) {
    console.warn("Memory update failed:", e.message);
  }
};

export const getUserMemoryFromCloud = async (userId: string): Promise<string> => {
  if (!userId || userId === 'guest') return "طالب جديد.";
  try {
    const docSnap = await getDoc(doc(db, "users", userId));
    return docSnap.exists() ? (docSnap.data().memory || "طالب مجتهد.") : "طالب جديد.";
  } catch (e: any) {
    return "لا يمكن الوصول للذاكرة حالياً.";
  }
};

export const getUserId = () => auth.currentUser?.uid || 'guest';
