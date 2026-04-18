import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

// ---- Personal (browser-local) ----

const VOTER_ID_KEY = 'voter_id';
const VOTED_KEY = 'voted_desserts';

export const getVoterId = () => {
  let vid = localStorage.getItem(VOTER_ID_KEY);
  if (!vid) {
    vid = 'v_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now();
    localStorage.setItem(VOTER_ID_KEY, vid);
  }
  return vid;
};

export const getVotedDessertIds = () => {
  try {
    const raw = localStorage.getItem(VOTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const markVotedLocal = (dessertId) => {
  const list = new Set(getVotedDessertIds());
  list.add(dessertId);
  localStorage.setItem(VOTED_KEY, JSON.stringify([...list]));
};

// ---- Shared (Firestore) ----

export const fetchDesserts = async () => {
  const snap = await getDocs(collection(db, 'desserts'));
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
};

export const fetchVotes = async () => {
  const snap = await getDocs(collection(db, 'votes'));
  return snap.docs.map((d) => d.data());
};

export const saveDessert = async (dessert) => {
  await setDoc(doc(db, 'desserts', dessert.id), dessert);
};

export const saveVote = async (vote) => {
  const id = `${vote.dessertId}_${vote.voterId}`;
  await setDoc(doc(db, 'votes', id), vote);
};

export const deleteDessertById = async (id) => {
  await deleteDoc(doc(db, 'desserts', id));
  const q = query(collection(db, 'votes'), where('dessertId', '==', id));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
};
