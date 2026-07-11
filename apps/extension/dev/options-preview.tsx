import "./chrome-stub";
import {createRoot} from "react-dom/client";
import {Options} from "../src/options";

/* Dev harness: mounts the real Options BYOK form against the in-memory chrome stub. */
createRoot(document.getElementById("root")!).render(<Options/>);
