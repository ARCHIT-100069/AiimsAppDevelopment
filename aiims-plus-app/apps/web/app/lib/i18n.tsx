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

  // profile / health card
  Hospital: "अस्पताल",
  "Patient Health Card": "रोगी स्वास्थ्य कार्ड",
  "ABHA verified": "आभा सत्यापित",
  UHID: "यूएचआईडी",
  "Age / Sex": "आयु / लिंग",
  "Date of birth": "जन्म तिथि",
  "Blood group": "रक्त समूह",
  "Not recorded": "दर्ज नहीं",
  "ABHA address": "आभा पता",
  "Not linked": "लिंक नहीं",
  "Issued by": "जारीकर्ता",
  "Present at every visit": "हर विज़िट पर दिखाएँ",
  "Encrypted & DPDP-protected": "एन्क्रिप्टेड और DPDP-संरक्षित",
  "Patient record": "रोगी रिकॉर्ड",
  "Full name": "पूरा नाम",
  Gender: "लिंग",
  Contact: "संपर्क",
  "Protected (encrypted)": "सुरक्षित (एन्क्रिप्टेड)",
  yrs: "वर्ष",
  "Health snapshot": "स्वास्थ्य सारांश",
  "Active conditions": "सक्रिय स्थितियाँ",
  Visits: "विज़िट",
  "Last visit": "अंतिम विज़िट",
  "Allergies & alerts": "एलर्जी और अलर्ट",
  "No known drug allergies": "कोई ज्ञात दवा एलर्जी नहीं",
  "Self-reported": "स्व-रिपोर्ट",
  Clear: "स्पष्ट",
  "Emergency contact": "आपातकालीन संपर्क",
  "Not on file": "फ़ाइल में नहीं",
  Add: "जोड़ें",
  "Contact details are encrypted at rest. To update your profile, contact the front desk.":
    "संपर्क विवरण सुरक्षित रूप से एन्क्रिप्टेड हैं। अपनी प्रोफ़ाइल अपडेट करने के लिए फ्रंट डेस्क से संपर्क करें।",

  // appointments
  "Bills & payments": "बिल और भुगतान",
  "No invoices yet.": "अभी तक कोई बिल नहीं।",
  "Upcoming visits": "आगामी विज़िट",
  "Past visits": "पिछली विज़िट",
  "No upcoming appointments.": "कोई आगामी अपॉइंटमेंट नहीं।",
  "Choose a doctor": "डॉक्टर चुनें",
  "Pick a date": "तारीख़ चुनें",
  "Pick a slot": "समय चुनें",
  "Confirm booking": "बुकिंग की पुष्टि करें",
  "Appointment booked": "अपॉइंटमेंट बुक हो गई",
  "No slots available for this day.": "इस दिन कोई समय उपलब्ध नहीं।",

  // records / meds / vitals / results
  "Medical records": "मेडिकल रिकॉर्ड",
  "No records yet.": "अभी तक कोई रिकॉर्ड नहीं।",
  "No diagnoses on record.": "रिकॉर्ड में कोई निदान नहीं।",
  "No medications prescribed.": "कोई दवा निर्धारित नहीं।",
  "No vitals recorded.": "कोई वाइटल्स दर्ज नहीं।",
  Reported: "रिपोर्ट किया गया",
  Test: "जाँच",
  Result: "परिणाम",
  Reference: "संदर्भ",
  Flag: "फ़्लैग",
  active: "सक्रिय",
  dispensed: "वितरित",
  cancelled: "रद्द",
  paid: "भुगतान किया",
  issued: "जारी",
  final: "अंतिम",
  normal: "सामान्य",

  // feedback
  "How was your experience?": "आपका अनुभव कैसा रहा?",
  "What is this about?": "यह किस बारे में है?",
  "Tell us more (optional)…": "हमें और बताएं (वैकल्पिक)…",
  "Send feedback": "प्रतिक्रिया भेजें",
  Sending: "भेजा जा रहा है",
  "Thank you — your feedback helps us improve care for everyone. 💚":
    "धन्यवाद — आपकी प्रतिक्रिया सभी के लिए देखभाल बेहतर बनाने में मदद करती है। 💚",
  Overall: "समग्र",
  Nursing: "नर्सिंग",
  Cleanliness: "स्वच्छता",
  Facilities: "सुविधाएँ",
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
