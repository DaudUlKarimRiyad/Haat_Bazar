// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBEyUiRu_gaP9JcPHknjVG8hDAN7UtfWbo",
  authDomain: "haat-bazar-bd129.firebaseapp.com",
  projectId: "haat-bazar-bd129",
  storageBucket: "haat-bazar-bd129.firebasestorage.app",
  messagingSenderId: "1086208803479",
  appId: "1:1086208803479:web:62a632c569d45b8e051fd2",
  measurementId: "G-KWDRNVD8B8",
}

// Initialize Firebase (safeguard against duplicate initialization during HMR)
export const app: FirebaseApp = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp()

// Initialize Analytics safely across environments
export let analytics: Analytics | null = null
if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app)
      }
    })
    .catch(() => {
      // Analytics not supported or disabled in this environment
    })
}

export default app
