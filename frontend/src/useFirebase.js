import { useState, useEffect } from "react";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, collection, getDocs, addDoc,
  updateDoc, query, where, orderBy, serverTimestamp, deleteDoc,
} from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

// ─── Admin emails allowlist ─────────────────────────────────────────────────
const ADMIN_EMAILS = ["gouravchat@gmail.com"];

// ─── Auth Hook ──────────────────────────────────────────────────────────────
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const profile = await getUserProfile(fbUser.uid);
        setUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName || profile?.displayName || "",
          email: fbUser.email || "",
          phone: profile?.phone || "",
          photoURL: fbUser.photoURL || "",
          provider: fbUser.providerData[0]?.providerId || "unknown",
          isAdmin: ADMIN_EMAILS.includes(fbUser.email?.toLowerCase()),
          ...profile,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserProfile(result.user);
    return result.user;
  };

  const loginWithEmail = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  };

  const signupWithEmail = async (email, password, displayName) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    await ensureUserProfile(result.user, displayName);
    return result.user;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return { user, loading, loginWithGoogle, loginWithEmail, signupWithEmail, logout };
}

// ─── User Profile (Firestore) ───────────────────────────────────────────────
async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

async function ensureUserProfile(fbUser, displayName) {
  try {
    const ref = doc(db, "users", fbUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: fbUser.uid,
        displayName: displayName || fbUser.displayName || "",
        email: fbUser.email || "",
        phone: "",
        photoURL: fbUser.photoURL || "",
        createdAt: serverTimestamp(),
      });
    }
  } catch (e) { console.error("Profile save error:", e); }
}

export async function updateUserPhone(uid, phone) {
  try {
    await updateDoc(doc(db, "users", uid), { phone });
  } catch (e) { console.error("Phone update error:", e); }
}

export async function updateUserPreferences(uid, preferences) {
  try {
    await updateDoc(doc(db, "users", uid), { preferences, preferencesUpdatedAt: serverTimestamp() });
  } catch (e) { console.error("Preferences save error:", e); }
}

export async function updateUserProfile(uid, profileData) {
  try {
    await updateDoc(doc(db, "users", uid), { ...profileData, updatedAt: serverTimestamp() });
  } catch (e) { console.error("Profile update error:", e); }
}

// ─── Partners (Caterers) — Firestore ────────────────────────────────────────
export async function getPartners() {
  try {
    const snap = await getDocs(query(collection(db, "partners"), where("active", "==", true)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function getAllPartners() {
  try {
    const snap = await getDocs(collection(db, "partners"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function addPartner(data) {
  const ref = await addDoc(collection(db, "partners"), {
    ...data,
    active: true,
    rating: 4.0,
    registeredAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePartner(id, data) {
  await updateDoc(doc(db, "partners", id), data);
}

export async function deletePartner(id) {
  await updateDoc(doc(db, "partners", id), { active: false });
}

// ─── Orders — Firestore ────────────────────────────────────────────────────
export async function createOrder(orderData) {
  const ref = await addDoc(collection(db, "orders"), {
    ...orderData,
    status: "Confirmed",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getUserOrders(uid) {
  try {
    const snap = await getDocs(
      query(collection(db, "orders"), where("customerId", "==", uid), orderBy("createdAt", "desc"))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function getAllOrders() {
  try {
    const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function updateOrderStatus(id, status) {
  await updateDoc(doc(db, "orders", id), { status });
}

// ─── Payments — Firestore ──────────────────────────────────────────────────
export async function savePayment(paymentData) {
  const ref = await addDoc(collection(db, "payments"), {
    ...paymentData,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getPayments(uid) {
  try {
    const snap = await getDocs(
      query(collection(db, "payments"), where("customerId", "==", uid))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}
