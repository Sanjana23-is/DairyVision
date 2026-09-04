import { createContext, useContext, useEffect, useState } from "react";
import {
  SupportedLanguage,
  translations,
} from "@/i18n/translations";
import api from "@/services/api";
import { useAuth } from "@/context/AuthContext";

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem("dairyvision_lang") as SupportedLanguage;
    if (saved && translations[saved]) return saved;
    return "en";
  });

  const setLanguage = (newLang: SupportedLanguage) => {
    if (!translations[newLang]) return;
    setLanguageState(newLang);
    localStorage.setItem("dairyvision_lang", newLang);

    // Sync with backend UserPreference if authenticated
    if (isAuthenticated) {
      api.put("/api/v1/user-preferences", { preferred_language: newLang }).catch(() => {
        // Soft fallback if user preference API fails
      });
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("dairyvision_lang") as SupportedLanguage;
    if (saved && translations[saved] && saved !== language) {
      setLanguageState(saved);
    }
  }, []);

  const t = (key: string, fallback?: string): string => {
    const langDict = translations[language] || translations["en"];
    return langDict[key] || translations["en"][key] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
