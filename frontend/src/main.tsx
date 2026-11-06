// Entry point: mounts the React app inside the theme provider.
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./firebase"
import App from "./App"
import { ThemeProvider } from "./context/ThemeContext"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
)
