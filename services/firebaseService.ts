
// Import initializeApp from the modular Firebase app package
// Ensure this matches the modular SDK (v9+) exports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { UserProfile } from "../types";

// Firebase configuration using environment-provided identifiers
const firebaseConfig = {
  apiKey: "AIzaSyBdCQLx7Inm7cLU3dnYsWpn048GEmrPYPk",
  authDomain: "video-json-eeece.firebaseapp.com",
  projectId: "video-json-eeece",
  storageBucket: "video-json-eeece.firebasestorage.app",
  messagingSenderId: "329004987",
  appId: "1:329004987:web:2cf6227fca7088532c369e",
  measurementId: "G-Y6S277GER0"
};

// Initialize Firebase app and services
// Explicitly calling initializeApp from the modular SDK
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
const googleProvider = new GoogleAuthProvider();

export const db = getFirestore(app);

const formatIdentifier = (id: string) => {
  if (/^\d+$/.test(id.replace(/\+/g, ''))) {
    return `${id.replace(/\s/g, '')}@dahih-app.com`;
  }
  return id;
};

/**
 * وظيفة لتطهير الكائنات من أي قيم undefined ومنع الانهيار بسبب المراجع الدائرية.
 */
const sanitizeData = (data: any): any => {
  const seen = new WeakSet();
  
  const serialize = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    
    // منع المراجع الدائرية (Circular References)
    if (seen.has(obj)) return null;
    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj.map(serialize);
    }

    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = serialize(obj[key]);
      }
    }
    return result;
  };
  
  return serialize(data);
};

export const signInWithGoogle = async () => {
  const res = await signInWithPopup(auth, googleProvider);
  const user = res.user;
  const docRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    const userProfile: UserProfile = {
      uid: user.uid,
      name: user.displayName || "دحيح جديد",
      nickname: "دكتور",
      emailOrPhone: user.email || "",
      academicYear: "3ث",
      track: "علمي علوم",
      points: 100,
      joinedAt: Date.now()
    };
    await setDoc(docRef, sanitizeData(userProfile));
  }
  return user;
};

export const signUpUser = async (data: Omit<UserProfile, 'uid' | 'points'>, pass: string) => {
  const email = formatIdentifier(data.emailOrPhone);
  const res = await createUserWithEmailAndPassword(auth, email, pass);
  const userProfile: UserProfile = {
    uid: res.user.uid,
    ...data,
    points: 100
  };
  await setDoc(doc(db, "users", res.user.uid), sanitizeData(userProfile));
  await updateProfile(res.user, { displayName: data.name });
  return res.user;
};

export const logInUser = async (id: string, pass: string) => {
  const email = formatIdentifier(id);
  const res = await signInWithEmailAndPassword(auth, email, pass);
  return res.user;
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>) => {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, sanitizeData(updates));
};

export const syncSessionsToFirebase = async (userId: string, sessions: any[]) => {
  if (!userId) return;
  const userSessionsRef = doc(db, "user_sessions", userId);
  const cleanSessions = sanitizeData(sessions || []);
  await setDoc(userSessionsRef, { 
    sessions: cleanSessions, 
    lastSync: Date.now() 
  });
};

export const fetchSessionsFromFirebase = async (userId: string) => {
  if (!userId) return [];
  const docSnap = await getDoc(doc(db, "user_sessions", userId));
  return docSnap.exists() ? (docSnap.data().sessions || []) : [];
};

export const saveUserMemoryToCloud = async (userId: string, memoryUpdate: string) => {
  if (!userId) return;
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  let currentMemory = snap.exists() ? (snap.data().memory || "") : "";
  const updatedMemory = `${currentMemory}\n- ${new Date().toLocaleDateString('en-US')}: ${memoryUpdate}`.slice(-3000);
  await updateDoc(userRef, { memory: updatedMemory });
};

export const getUserMemoryFromCloud = async (userId: string): Promise<string> => {
  if (!userId) return "طالب دحيح.";
  const docSnap = await getDoc(doc(db, "users", userId));
  if (docSnap.exists()) {
    const d = docSnap.data();
    return `الطالب: ${d.nickname} ${d.name}, سنة: ${d.academicYear}, تخصص: ${d.track}. ذاكرة: ${d.memory || ''}`;
  }
  return "طالب دحيح.";
};

export const getUserId = () => auth.currentUser?.uid || '';
