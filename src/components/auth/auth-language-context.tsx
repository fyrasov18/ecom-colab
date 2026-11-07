"use client";

import React, { createContext, useContext, useCallback, useSyncExternalStore } from "react";
import { AUTH_DICTIONARY, type AuthDictionary, type AuthLang } from "./auth-i18n";

interface AuthLanguageContextType {
  lang: AuthLang;
  setLang: (lang: AuthLang) => void;
  t: AuthDictionary;
  isRtl: boolean;
  mounted: boolean;
}

const AuthLanguageContext = createContext<AuthLanguageContextType>({
  lang: "fr",
  setLang: () => {},
  t: AUTH_DICTIONARY.fr,
  isRtl: false,
  mounted: false,
});

const subscribe = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("ep-lang-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("ep-lang-change", callback);
  };
};

const getSnapshot = (): AuthLang => {
  try {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("lang");
      if (q === "ar" || q === "en" || q === "fr") return q;
    }
    const val = localStorage.getItem("ep_auth_lang");
    if (val === "ar" || val === "en" || val === "fr") return val;
  } catch {
    // LocalStorage quota or access error
  }
  return "fr";
};

const getServerSnapshot = (): AuthLang => "fr";

export function AuthLanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLang = useCallback((newLang: AuthLang) => {
    try {
      localStorage.setItem("ep_auth_lang", newLang);
      window.dispatchEvent(new Event("ep-lang-change"));
    } catch {
      // LocalStorage access restricted
    }
  }, []);

  const currentDict = AUTH_DICTIONARY[lang] ?? AUTH_DICTIONARY.fr;
  const isRtl = currentDict.dir === "rtl";

  return (
    <AuthLanguageContext.Provider
      value={{
        lang,
        setLang,
        t: currentDict,
        isRtl,
        mounted: true,
      }}
    >
      {children}
    </AuthLanguageContext.Provider>
  );
}

export function useAuthLanguage(): AuthLanguageContextType {
  return useContext(AuthLanguageContext);
}
