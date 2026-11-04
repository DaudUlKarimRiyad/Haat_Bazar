// Shares dark mode with any component through useContext, so it is not passed down as props.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type ThemeContextValue = {
  darkMode: boolean
  toggleDark: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("haat_bazar_dark_mode") === "true"
  })

  useEffect(() => {
    localStorage.setItem("haat_bazar_dark_mode", String(darkMode))
    if (darkMode) {
      document.documentElement.setAttribute("data-theme", "dark")
    } else {
      document.documentElement.removeAttribute("data-theme")
    }
  }, [darkMode])

  const toggleDark = () => setDarkMode((prev) => !prev)

  return <ThemeContext.Provider value={{ darkMode, toggleDark }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider")
  return ctx
}
