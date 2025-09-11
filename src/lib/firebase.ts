// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "../config/firebaseConfig";

// Firebase App 초기화 (한 번만)
export const app = initializeApp(firebaseConfig);
