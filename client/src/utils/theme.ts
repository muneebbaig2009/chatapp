import { useState, useCallback } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "chatapp-theme";

export function getStoredTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

// Adds/removes the .light class on <html> and persists the choice. Dark is
// the default look, expressed as the absence of the class (matches :root
// in index.css), so an unset/invalid stored value just falls through to it.
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  localStorage.setItem(STORAGE_KEY, theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
