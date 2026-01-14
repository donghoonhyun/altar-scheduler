import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    } catch (e) {
      // Fallback if localStorage is disabled/unavailable
      return defaultTheme;
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    // Function to update meta theme-color
    const updateMetaThemeColor = (isDark: boolean) => {
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#111827' : '#ffffff');
      }
    };

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const systemTheme = isDark ? "dark" : "light";

      root.classList.add(systemTheme);
      root.style.colorScheme = systemTheme;
      updateMetaThemeColor(isDark);
      return;
    }

    const isDark = theme === "dark";
    root.classList.add(theme);
    root.style.colorScheme = theme;
    updateMetaThemeColor(isDark);
  }, [theme]);

  // Listen for system changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    
    const listener = (e: MediaQueryListEvent) => {
      const root = window.document.documentElement;
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      
      if (e.matches) {
        root.classList.add('dark');
        root.classList.remove('light');
        root.style.colorScheme = 'dark';
        if (metaThemeColor) metaThemeColor.setAttribute('content', '#111827');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
        if (metaThemeColor) metaThemeColor.setAttribute('content', '#ffffff');
      }
    };

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [theme]);


  const value = {
    theme,
    setTheme: (theme: Theme) => {
      setTheme(theme);
      try {
        localStorage.setItem(storageKey, theme);
      } catch (e) {
        console.warn("Failed to persist theme preference:", e);
      }
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
}
