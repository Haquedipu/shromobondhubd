import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyArbHWC-cLbX38VdwJfKGAA-AQyoQ_ZqbA",
  authDomain: "shromobondhubd.firebaseapp.com",
  projectId: "shromobondhubd",
  storageBucket: "shromobondhubd.firebasestorage.app",
  messagingSenderId: "1013968756500",
  appId: "1:1013968756500:web:e3eec76bc2a87939886c01"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };
