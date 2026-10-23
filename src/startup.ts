import { createStartupSplash } from "./ui/startup/splash";

const splash = createStartupSplash();
void import("./main").then(({ mountGame }) => mountGame(splash));
