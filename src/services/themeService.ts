import {
  useEffect,
  useState,
} from "react";

export type AppTheme =
  | "dark"
  | "light";

const STORAGE_KEY =
  "step-up-match-theme";
const THEME_EVENT =
  "step-up-match-theme-change";

function readStoredTheme(): AppTheme {
  if (
    typeof window === "undefined"
  ) {
    return "dark";
  }

  return window.localStorage.getItem(
    STORAGE_KEY
  ) === "light"
    ? "light"
    : "dark";
}

export function applyTheme(
  theme: AppTheme
) {
  if (
    typeof document === "undefined"
  ) {
    return;
  }

  document.documentElement.classList.toggle(
    "light",
    theme === "light"
  );
  document.documentElement.classList.toggle(
    "dark",
    theme === "dark"
  );
  document.documentElement.dataset.theme =
    theme;
  document.documentElement.style.colorScheme =
    theme;
}

export function setAppTheme(
  theme: AppTheme
) {
  window.localStorage.setItem(
    STORAGE_KEY,
    theme
  );
  applyTheme(theme);
  window.dispatchEvent(
    new CustomEvent(THEME_EVENT, {
      detail: theme,
    })
  );
}

export function toggleAppTheme() {
  const nextTheme =
    readStoredTheme() === "dark"
      ? "light"
      : "dark";
  setAppTheme(nextTheme);

  return nextTheme;
}

export function useAppTheme() {
  const [theme, setTheme] =
    useState<AppTheme>(() =>
      readStoredTheme()
    );

  useEffect(() => {
    applyTheme(theme);

    function handleThemeChange() {
      setTheme(readStoredTheme());
    }

    window.addEventListener(
      THEME_EVENT,
      handleThemeChange
    );
    window.addEventListener(
      "storage",
      handleThemeChange
    );

    return () => {
      window.removeEventListener(
        THEME_EVENT,
        handleThemeChange
      );
      window.removeEventListener(
        "storage",
        handleThemeChange
      );
    };
  }, [theme]);

  return {
    theme,
    setTheme: setAppTheme,
    toggleTheme:
      toggleAppTheme,
  };
}
