import "./chrome-stub";
import {createRoot} from "react-dom/client";
import {Popup} from "../src/popup";

/* Dev harness: mounts the real Popup against the in-memory chrome stub (session active
 * so the Pair row expands to a fake code + local QR; no provider so the Demo key chip shows). */
createRoot(document.getElementById("root")!).render(<Popup/>);
