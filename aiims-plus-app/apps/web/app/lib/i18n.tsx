"use client";

/**
 * Lightweight, dependency-free i18n for the patient portal. Translation is keyed
 * by the English source string, so a component wraps visible text in `t("…")`
 * and any string without a translation falls back to English gracefully. The
 * choice is client state (instant switch, no reload) persisted to localStorage.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "hi";

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "hi", label: "हिन्दी", short: "हिं" },
];

// English source → Hindi. Only the patient-facing chrome is translated; anything
// missing falls back to the English source string.
const HI: Record<string, string> = {
  // header / chrome
  Portal: "पोर्टल",
  "Log out": "लॉग आउट",
  "Need help?": "मदद चाहिए?",
  // nav groups
  Overview: "अवलोकन",
  Care: "देखभाल",
  Results: "परिणाम",
  Admin: "प्रशासन",
  More: "अन्य",
  // nav items
  "Home Dashboard": "होम डैशबोर्ड",
  "My Profile": "मेरी प्रोफ़ाइल",
  Appointments: "अपॉइंटमेंट",
  "My Doctors": "मेरे डॉक्टर",
  "Medical Records": "मेडिकल रिकॉर्ड",
  Medications: "दवाइयाँ",
  "Lab Reports": "लैब रिपोर्ट",
  Imaging: "इमेजिंग",
  Vitals: "वाइटल्स",
  Billing: "बिलिंग",
  Documents: "दस्तावेज़",
  Notifications: "सूचनाएँ",
  Emergency: "आपातकाल",
  "Privacy & Consent": "गोपनीयता और सहमति",
  Feedback: "प्रतिक्रिया",
  Settings: "सेटिंग्स",
  // dashboard
  "Your Appointment": "आपकी अपॉइंटमेंट",
  Hello: "नमस्ते",
  "No upcoming visit": "कोई आगामी विज़िट नहीं",
  Consultation: "परामर्श",
  "Book an appointment": "अपॉइंटमेंट बुक करें",
  Medicines: "दवाइयाँ",
  "My Queue": "मेरी कतार",
  Upcoming: "आगामी",
  Diagnoses: "निदान",
  "Due bills": "बकाया बिल",
  "Health Tips": "स्वास्थ्य सुझाव",
  // live token
  "You're checked in": "आप चेक-इन हैं",
  "You're next — please be ready": "आपकी बारी अगली है — कृपया तैयार रहें",
  "patient ahead of you": "मरीज़ आपसे आगे",
  "patients ahead of you": "मरीज़ आपसे आगे",
  Token: "टोकन",
  // common
  "with Dr.": "डॉ. के साथ",
  "Book appointment": "अपॉइंटमेंट बुक करें",
  Confirm: "पुष्टि करें",
  Cancel: "रद्द करें",
  Send: "भेजें",
  "Share feedback": "प्रतिक्रिया साझा करें",
  Preferences: "प्राथमिकताएँ",
  Language: "भाषा",
  Account: "खाता",
  "Appointment reminders": "अपॉइंटमेंट अनुस्मारक",
  "The portal switches language instantly across the app.":
    "पोर्टल पूरे ऐप में भाषा तुरंत बदल देता है।",
  "Lab reports": "लैब रिपोर्ट",
  "Imaging studies": "इमेजिंग अध्ययन",
  Profile: "प्रोफ़ाइल",
  Prescriptions: "नुस्खे",
  Invoices: "बिल",
};

const DICTS: Record<Lang, Record<string, string>> = { en: {}, hi: HI };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (s: string) => string;
}
const Ctx = createContext<I18nCtx>({ lang: "en", setLang: () => {}, t: (s) => s });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Hydrate the saved choice after mount (keeps SSR markup === first client render).
  useEffect(() => {
    const saved = window.localStorage.getItem("aiims_lang") as Lang | null;
    if (saved === "en" || saved === "hi") setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem("aiims_lang", l);
    } catch {
      /* ignore */
    }
  };

  const t = (s: string) => DICTS[lang][s] ?? s;

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;

/** Segmented EN / हिं switch — instant, no reload. */
export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-slate-200 text-xs">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          className={`px-2.5 py-1 font-medium transition-colors ${
            lang === l.code ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
