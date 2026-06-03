import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAQY-d3E6eGCRXqIB7Gr0j91mEZ3K6gvKc",
  authDomain: "schnitzeljagd-7bae0.firebaseapp.com",
  projectId: "schnitzeljagd-7bae0",
  storageBucket: "schnitzeljagd-7bae0.appspot.com",
  messagingSenderId: "331834919450",
  appId: "1:331834919450:web:ccc59153c4da1dac705fa3",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);