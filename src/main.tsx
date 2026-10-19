import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { createSession } from "./application/session";
import { createPlatform } from "./platform";
import { validateContent } from "./game/save";
import { App } from "./ui/App";
import "./ui/styles.css";
validateContent();
const platform = createPlatform();
const session = createSession(platform, Date.now() >>> 0);
createRoot(document.getElementById("root")!).render(
  <MotionConfig reducedMotion="user">
    <App session={session} desktop={platform.desktop} />
  </MotionConfig>,
);
void session.load();
