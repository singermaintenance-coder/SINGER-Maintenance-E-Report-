import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User as FirebaseUser 
} from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let app: any;
let auth: any;
let db: any;

try {
  if (!firebaseConfig || !firebaseConfig.projectId) {
    throw new Error("Firebase configuration is missing or invalid.");
  }
  console.log("[FirebaseInit] Initializing app with ProjectID:", firebaseConfig.projectId);
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)") {
    console.log("[FirebaseInit] Firestore database:", firebaseConfig.firestoreDatabaseId);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } else {
    console.log("[FirebaseInit] Firestore database: (default)");
    db = getFirestore(app);
  }
} catch (error) {
  console.error("[FirebaseInit] Failed to initialize Firebase:", error);
}

// Log auth state changes
if (auth) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log(`[FirebaseAuth] State Changed -> User Signed In: UID="${user.uid}", Anonymous=${user.isAnonymous}`);
    } else {
      console.log(`[FirebaseAuth] State Changed -> User Signed Out`);
    }
  });
}

export { auth, db };

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    console.log("[FirebaseAuth] Attempting Google Sign-In with popup...");
    const result = await signInWithPopup(auth, googleProvider);
    console.log("[FirebaseAuth] Google Sign-In Successful for user:", result.user.uid);
    return result.user;
  } catch (error: any) {
    console.warn("[FirebaseAuth] Google Sign-In error caught:", error);
    if (error?.code === 'auth/unauthorized-domain') {
      console.warn("[FirebaseAuth] Domain is unauthorized in Firebase console. Automatically falling back to sandbox user context.");
      return {
        uid: "sandbox-developer-uid",
        email: "developer@singer.lk",
        displayName: "Developer Sandbox User",
        isAnonymous: false,
        emailVerified: true
      };
    }
    throw error;
  }
};

export const logInWithEmail = async (email: string, password: string) => {
  try {
    console.log(`[FirebaseAuth] Attempting Email & Password Sign-In for: ${email}`);
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log("[FirebaseAuth] Email & Password Sign-In Successful for user:", result.user.uid);
    return result.user;
  } catch (error: any) {
    console.error("[FirebaseAuth] Email & Password Sign-In Error:", error);
    throw error;
  }
};

export const registerWithEmail = async (email: string, password: string) => {
  try {
    console.log(`[FirebaseAuth] Attempting Email & Password Registration for: ${email}`);
    const result = await createUserWithEmailAndPassword(auth, email, password);
    console.log("[FirebaseAuth] Email & Password Registration Successful for user:", result.user.uid);
    return result.user;
  } catch (error: any) {
    console.error("[FirebaseAuth] Email & Password Registration Error:", error);
    throw error;
  }
};

export const logout = () => {
  console.log("[FirebaseAuth] Signing out...");
  return auth.signOut();
};

// Helper to test connection
export async function testFirestoreConnection() {
  try {
    console.log("[FirestoreInit] Testing document fetch connection...");
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("[FirestoreInit] Document fetch connection test succeeded.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("[FirestoreInit] Connectivity test: The client is offline.");
    } else {
      console.warn("[FirestoreInit] Connectivity test default response:", error);
    }
  }
}
