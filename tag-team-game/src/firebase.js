import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";

/** iOS WebKit: Fetch Streams can delay onSnapshot delivery (firebase-js-sdk #9789). */
function isIPhone() {
  if (typeof navigator === "undefined") return false;
  return /iPhone/i.test(navigator.userAgent);
}

const firebaseConfig = {
  apiKey: "AIzaSyAQY-d3E6eGCRXqIB7Gr0j91mEZ3K6gvKc",
  authDomain: "schnitzeljagd-7bae0.firebaseapp.com",
  projectId: "schnitzeljagd-7bae0",
  storageBucket: "schnitzeljagd-7bae0.appspot.com",
  messagingSenderId: "331834919450",
  appId: "1:331834919450:web:ccc59153c4da1dac705fa3",
};

const app = initializeApp(firebaseConfig);

export const db = isIPhone()
  ? initializeFirestore(app, { useFetchStreams: false })
  : getFirestore(app);