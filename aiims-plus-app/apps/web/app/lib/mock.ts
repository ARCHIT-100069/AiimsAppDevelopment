/**
 * Example ("fake") data used to populate portal sections that don't yet have a
 * backend module, so every screen shows something realistic for demos. Purely
 * presentational — never sent to the API. Replace a section's entry here with a
 * real fetch when its module lands.
 */
export interface MockItem {
  title: string;
  sub?: string;
  badge?: string;
  tone?: "teal" | "green" | "amber" | "red" | "slate";
}
export interface MockSectionData {
  stats?: [string, string][];
  items?: MockItem[];
}

/* --------------------------------- admin ---------------------------------- */
export const adminMock: Record<string, MockSectionData> = {
  patients: {
    stats: [
      ["Total patients", "1,284"],
      ["OPD today", "76"],
      ["Admitted", "38"],
      ["New this week", "112"],
    ],
    items: [
      { title: "Rohan Mehta", sub: "MRN-001042 · 34y · Male", badge: "OPD", tone: "teal" },
      { title: "Sneha Iyer", sub: "MRN-001043 · 28y · Female", badge: "OPD", tone: "teal" },
      { title: "Abdul Rahman", sub: "MRN-000987 · 61y · Male", badge: "Admitted", tone: "amber" },
      { title: "Kavya Nair", sub: "MRN-001051 · 8y · Female", badge: "OPD", tone: "teal" },
      { title: "Devendra Joshi", sub: "MRN-000934 · 72y · Male", badge: "ICU", tone: "red" },
    ],
  },
  beds: {
    stats: [
      ["Total beds", "240"],
      ["Occupied", "186"],
      ["Available", "54"],
      ["ICU free", "6"],
    ],
    items: [
      { title: "General Ward A", sub: "48 / 60 occupied", badge: "12 free", tone: "green" },
      { title: "General Ward B", sub: "57 / 60 occupied", badge: "3 free", tone: "amber" },
      { title: "ICU", sub: "18 / 24 occupied", badge: "6 free", tone: "green" },
      { title: "Maternity", sub: "22 / 30 occupied", badge: "8 free", tone: "green" },
      { title: "Isolation", sub: "12 / 12 occupied", badge: "Full", tone: "red" },
    ],
  },
  pharmacy: {
    stats: [
      ["SKUs", "1,120"],
      ["Low stock", "23"],
      ["Expiring < 30d", "14"],
      ["Dispensed today", "312"],
    ],
    items: [
      { title: "Paracetamol 500mg", sub: "Stock: 4,200 tablets", badge: "In stock", tone: "green" },
      { title: "Amoxicillin 500mg", sub: "Stock: 180 capsules", badge: "Low", tone: "amber" },
      { title: "Insulin (Human) 40IU", sub: "Stock: 26 vials", badge: "Low", tone: "amber" },
      { title: "ORS Sachets", sub: "Stock: 3,500", badge: "In stock", tone: "green" },
      { title: "Atorvastatin 10mg", sub: "Stock: 0", badge: "Out of stock", tone: "red" },
    ],
  },
  lab: {
    stats: [
      ["Orders today", "142"],
      ["Pending", "37"],
      ["Completed", "98"],
      ["Critical", "3"],
    ],
    items: [
      {
        title: "Complete Blood Count",
        sub: "Rohan Mehta · MRN-001042",
        badge: "Completed",
        tone: "green",
      },
      {
        title: "Blood Glucose (Fasting)",
        sub: "Sneha Iyer · MRN-001043",
        badge: "Pending",
        tone: "amber",
      },
      {
        title: "Liver Function Test",
        sub: "Abdul Rahman · MRN-000987",
        badge: "In progress",
        tone: "teal",
      },
      {
        title: "Dengue NS1 Antigen",
        sub: "Kavya Nair · MRN-001051",
        badge: "Critical",
        tone: "red",
      },
      {
        title: "Thyroid Profile",
        sub: "Devendra Joshi · MRN-000934",
        badge: "Completed",
        tone: "green",
      },
    ],
  },
  radiology: {
    stats: [
      ["Studies today", "64"],
      ["Awaiting report", "19"],
      ["Reported", "45"],
    ],
    items: [
      {
        title: "Chest X-Ray (PA)",
        sub: "Abdul Rahman · MRN-000987",
        badge: "Reported",
        tone: "green",
      },
      {
        title: "CT Brain (Plain)",
        sub: "Devendra Joshi · MRN-000934",
        badge: "Awaiting report",
        tone: "amber",
      },
      { title: "USG Abdomen", sub: "Sneha Iyer · MRN-001043", badge: "Reported", tone: "green" },
      { title: "MRI Knee", sub: "Rohan Mehta · MRN-001042", badge: "Scheduled", tone: "teal" },
    ],
  },
  billing: {
    stats: [
      ["Revenue today", "₹4.82L"],
      ["Collected", "₹3.91L"],
      ["Outstanding", "₹0.91L"],
      ["Invoices", "312"],
    ],
    items: [
      { title: "INV-000318", sub: "Rohan Mehta · ₹1,250", badge: "Paid", tone: "green" },
      { title: "INV-000319", sub: "Sneha Iyer · ₹850", badge: "Paid", tone: "green" },
      { title: "INV-000320", sub: "Abdul Rahman · ₹18,400", badge: "Partly paid", tone: "amber" },
      { title: "INV-000321", sub: "Devendra Joshi · ₹42,100", badge: "Due", tone: "red" },
    ],
  },
  insurance: {
    stats: [
      ["Active policies", "512"],
      ["Claims pending", "28"],
      ["Approved", "196"],
      ["Rejected", "9"],
    ],
    items: [
      {
        title: "Star Health · Rohan Mehta",
        sub: "Claim ₹1,250 · cashless",
        badge: "Approved",
        tone: "green",
      },
      {
        title: "CGHS · Devendra Joshi",
        sub: "Claim ₹42,100",
        badge: "Pre-auth pending",
        tone: "amber",
      },
      {
        title: "Ayushman Bharat · Abdul Rahman",
        sub: "Claim ₹18,400",
        badge: "Under review",
        tone: "teal",
      },
      { title: "HDFC Ergo · Sneha Iyer", sub: "Claim ₹850", badge: "Rejected", tone: "red" },
    ],
  },
  inventory: {
    stats: [
      ["Line items", "3,240"],
      ["Reorder needed", "41"],
      ["POs open", "12"],
    ],
    items: [
      { title: "Surgical Gloves (M)", sub: "Qty: 12,000 pairs", badge: "OK", tone: "green" },
      { title: "N95 Masks", sub: "Qty: 800", badge: "Reorder", tone: "amber" },
      { title: "IV Cannula 20G", sub: "Qty: 3,500", badge: "OK", tone: "green" },
      { title: "Syringes 5ml", sub: "Qty: 250", badge: "Reorder", tone: "amber" },
      { title: "Oxygen Cylinders (D-type)", sub: "Qty: 18", badge: "Critical", tone: "red" },
    ],
  },
  ambulance: {
    stats: [
      ["Fleet", "8"],
      ["Available", "5"],
      ["On trip", "2"],
      ["Maintenance", "1"],
    ],
    items: [
      {
        title: "MH-12 AB-1024 (ALS)",
        sub: "Driver: Suresh Patil",
        badge: "Available",
        tone: "green",
      },
      { title: "MH-12 AB-2048 (BLS)", sub: "Driver: Ramesh Kale", badge: "On trip", tone: "amber" },
      { title: "MH-12 AB-3072 (ALS)", sub: "Driver: Anil More", badge: "Available", tone: "green" },
      { title: "MH-12 AB-4096 (BLS)", sub: "Under service", badge: "Maintenance", tone: "slate" },
    ],
  },
  reports: {
    stats: [
      ["OPD footfall (mo)", "2,140"],
      ["IPD admissions", "418"],
      ["Avg LOS", "3.6 days"],
      ["Bed occupancy", "78%"],
    ],
    items: [
      { title: "OPD vs last month", sub: "+8.4% footfall", badge: "Up", tone: "green" },
      { title: "Revenue (month-to-date)", sub: "₹1.42 Cr", badge: "On target", tone: "teal" },
      { title: "Average waiting time", sub: "22 min (OPD)", badge: "-5 min", tone: "green" },
      { title: "Readmission rate", sub: "4.1%", badge: "Watch", tone: "amber" },
    ],
  },
  notifications: {
    items: [
      {
        title: "Monsoon fever advisory issued to all OPDs",
        sub: "Today, 09:10",
        badge: "Announcement",
        tone: "teal",
      },
      {
        title: "Blood bank: O-negative stock low",
        sub: "Today, 08:02",
        badge: "Alert",
        tone: "amber",
      },
      {
        title: "Fire drill scheduled for Block C",
        sub: "Yesterday, 16:30",
        badge: "Notice",
        tone: "slate",
      },
      {
        title: "New teleconsultation module enabled",
        sub: "2 days ago",
        badge: "Update",
        tone: "green",
      },
    ],
  },
  audit: {
    items: [
      { title: "patient.read", sub: "Dr. Asha Demo · MRN-001042", badge: "10:24", tone: "slate" },
      {
        title: "appointment.book",
        sub: "Frontdesk Demo · APT-5521",
        badge: "10:18",
        tone: "slate",
      },
      { title: "invoice.pay", sub: "Frontdesk Demo · INV-000318", badge: "10:05", tone: "slate" },
      { title: "encounter.sign", sub: "Dr. Asha Demo · ENC-3390", badge: "09:52", tone: "slate" },
      {
        title: "user.role.grant",
        sub: "Admin Demo · doctor → Dr. Meera",
        badge: "09:30",
        tone: "slate",
      },
    ],
  },
  integrations: {
    items: [
      {
        title: "ABDM (Ayushman Bharat Digital Mission)",
        sub: "Sandbox · mock adapter",
        badge: "Connected",
        tone: "green",
      },
      { title: "Razorpay — Payment Gateway", sub: "Test mode", badge: "Connected", tone: "green" },
      { title: "MSG91 — SMS", sub: "Sender: AIIMSP", badge: "Connected", tone: "green" },
      { title: "SMTP — Email", sub: "no-reply@hospital.in", badge: "Connected", tone: "green" },
      { title: "WhatsApp Business API", sub: "Not configured", badge: "Disabled", tone: "slate" },
    ],
  },
  settings: {
    items: [
      { title: "Hospital name", sub: "Demo Multispeciality Hospital" },
      { title: "Timezone", sub: "Asia/Kolkata (IST)" },
      { title: "Currency", sub: "INR (₹)" },
      { title: "OPD hours", sub: "08:00 – 20:00" },
      { title: "Default language", sub: "English" },
      { title: "Data residency", sub: "India (DPDP aligned)" },
    ],
  },
  records: {
    stats: [
      ["Records", "12,908"],
      ["Digitised", "98%"],
      ["Pending scan", "142"],
    ],
    items: [
      {
        title: "Discharge Summary — Abdul Rahman",
        sub: "MRN-000987 · 08 Jul 2026",
        badge: "Final",
        tone: "green",
      },
      {
        title: "OT Notes — Devendra Joshi",
        sub: "MRN-000934 · 07 Jul 2026",
        badge: "Final",
        tone: "green",
      },
      {
        title: "Consultation — Rohan Mehta",
        sub: "MRN-001042 · 10 Jul 2026",
        badge: "Draft",
        tone: "amber",
      },
    ],
  },
};

/* --------------------------------- doctor --------------------------------- */
export const doctorMock: Record<string, MockSectionData> = {
  encounters: {
    items: [
      {
        title: "Rohan Mehta — Fever, 3 days",
        sub: "Today, 10:15 · OPD",
        badge: "In progress",
        tone: "teal",
      },
      {
        title: "Sneha Iyer — Follow-up (thyroid)",
        sub: "Today, 09:40 · OPD",
        badge: "Signed",
        tone: "green",
      },
      {
        title: "Abdul Rahman — Chest pain",
        sub: "Yesterday · IPD round",
        badge: "Signed",
        tone: "green",
      },
    ],
  },
  records: {
    items: [
      {
        title: "Rohan Mehta",
        sub: "MRN-001042 · 4 visits · last 10 Jul",
        badge: "Active",
        tone: "teal",
      },
      {
        title: "Sneha Iyer",
        sub: "MRN-001043 · 9 visits · last 10 Jul",
        badge: "Active",
        tone: "teal",
      },
      {
        title: "Kavya Nair",
        sub: "MRN-001051 · 2 visits · last 09 Jul",
        badge: "Active",
        tone: "teal",
      },
    ],
  },
  notes: {
    items: [
      {
        title: "SOAP — Rohan Mehta",
        sub: "Viral fever, advised rest + fluids",
        badge: "Today",
        tone: "slate",
      },
      {
        title: "Progress note — Abdul Rahman",
        sub: "Stable, continue antibiotics",
        badge: "Today",
        tone: "slate",
      },
      {
        title: "SOAP — Sneha Iyer",
        sub: "Euthyroid on 50mcg, review 6 wks",
        badge: "Today",
        tone: "slate",
      },
    ],
  },
  prescriptions: {
    items: [
      {
        title: "Paracetamol 500mg",
        sub: "Rohan Mehta · 1 tab TDS × 3d",
        badge: "Active",
        tone: "green",
      },
      {
        title: "Amoxicillin 500mg",
        sub: "Abdul Rahman · 1 cap BD × 5d",
        badge: "Active",
        tone: "green",
      },
      {
        title: "Levothyroxine 50mcg",
        sub: "Sneha Iyer · 1 tab OD",
        badge: "Active",
        tone: "green",
      },
      { title: "ORS + Zinc", sub: "Kavya Nair · as directed", badge: "Completed", tone: "slate" },
    ],
  },
  lab: {
    items: [
      {
        title: "CBC — Rohan Mehta",
        sub: "WBC 11.2, Hb 13.4",
        badge: "Result ready",
        tone: "green",
      },
      { title: "FBS — Sneha Iyer", sub: "Awaiting sample", badge: "Pending", tone: "amber" },
      { title: "Dengue NS1 — Kavya Nair", sub: "Positive", badge: "Critical", tone: "red" },
    ],
  },
  radiology: {
    items: [
      {
        title: "Chest X-Ray — Abdul Rahman",
        sub: "Mild infiltrates, RLL",
        badge: "Reported",
        tone: "green",
      },
      {
        title: "CT Brain — Devendra Joshi",
        sub: "Awaiting radiologist",
        badge: "Pending",
        tone: "amber",
      },
    ],
  },
  vitals: {
    items: [
      {
        title: "Rohan Mehta",
        sub: "BP 122/80 · HR 88 · Temp 38.4°C · SpO2 98%",
        badge: "Today",
        tone: "teal",
      },
      {
        title: "Abdul Rahman",
        sub: "BP 138/86 · HR 92 · Temp 37.1°C · SpO2 95%",
        badge: "Today",
        tone: "teal",
      },
      {
        title: "Kavya Nair",
        sub: "BP 100/70 · HR 110 · Temp 39.1°C · SpO2 97%",
        badge: "Today",
        tone: "amber",
      },
    ],
  },
  diagnoses: {
    items: [
      {
        title: "J06.9 — Acute upper respiratory infection",
        sub: "Rohan Mehta",
        badge: "Active",
        tone: "amber",
      },
      {
        title: "E03.9 — Hypothyroidism, unspecified",
        sub: "Sneha Iyer",
        badge: "Chronic",
        tone: "slate",
      },
      { title: "A90 — Dengue fever", sub: "Kavya Nair", badge: "Active", tone: "red" },
    ],
  },
  certificates: {
    items: [
      {
        title: "Medical fitness certificate",
        sub: "Rohan Mehta · issued today",
        badge: "Issued",
        tone: "green",
      },
      {
        title: "Sick leave certificate (3 days)",
        sub: "Sneha Iyer · issued today",
        badge: "Issued",
        tone: "green",
      },
    ],
  },
  admissions: {
    items: [
      {
        title: "Abdul Rahman",
        sub: "General Ward B · Bed 14 · admitted 08 Jul",
        badge: "Admitted",
        tone: "amber",
      },
      {
        title: "Devendra Joshi",
        sub: "ICU · Bed 3 · admitted 07 Jul",
        badge: "Critical",
        tone: "red",
      },
      {
        title: "Meena Kulkarni",
        sub: "Maternity · Bed 9 · discharged today",
        badge: "Discharged",
        tone: "green",
      },
    ],
  },
  referrals: {
    items: [
      { title: "Devendra Joshi → Neurology", sub: "For CT review", badge: "Sent", tone: "teal" },
      {
        title: "Kavya Nair → Paediatrics",
        sub: "Dengue monitoring",
        badge: "Accepted",
        tone: "green",
      },
      {
        title: "Incoming: Cardiology → you",
        sub: "Abdul Rahman, chest pain",
        badge: "New",
        tone: "amber",
      },
    ],
  },
  billing: {
    items: [
      {
        title: "INV-000318 — Rohan Mehta",
        sub: "Consultation ₹1,250",
        badge: "Paid",
        tone: "green",
      },
      {
        title: "INV-000320 — Abdul Rahman",
        sub: "IPD ₹18,400",
        badge: "Partly paid",
        tone: "amber",
      },
    ],
  },
  notifications: {
    items: [
      {
        title: "Lab critical: Dengue NS1 positive (Kavya Nair)",
        sub: "10 min ago",
        badge: "Critical",
        tone: "red",
      },
      {
        title: "New referral from Cardiology",
        sub: "25 min ago",
        badge: "Referral",
        tone: "amber",
      },
      {
        title: "Your 11:00 appointment checked in",
        sub: "1 hour ago",
        badge: "Queue",
        tone: "teal",
      },
    ],
  },
  schedule: {
    stats: [
      ["This week", "38 slots"],
      ["Booked", "29"],
      ["Free", "9"],
    ],
    items: [
      { title: "Monday", sub: "OPD 09:00–13:00 · 16 slots", badge: "Open", tone: "green" },
      { title: "Wednesday", sub: "OPD 09:00–13:00 · 16 slots", badge: "Open", tone: "green" },
      { title: "Friday", sub: "OPD 14:00–17:00 · 12 slots", badge: "Almost full", tone: "amber" },
      { title: "Saturday", sub: "On leave", badge: "Blocked", tone: "slate" },
    ],
  },
  analytics: {
    stats: [
      ["Consults (mo)", "486"],
      ["Avg time", "14 min"],
      ["Follow-up rate", "31%"],
      ["Satisfaction", "4.7/5"],
    ],
    items: [
      {
        title: "Top diagnosis",
        sub: "Viral fever (J06.9) — 84 cases",
        badge: "This month",
        tone: "teal",
      },
      { title: "Busiest day", sub: "Wednesday — 62 consults", badge: "", tone: "slate" },
      { title: "No-show rate", sub: "6.2%", badge: "Good", tone: "green" },
    ],
  },
  settings: {
    items: [
      { title: "Consultation duration", sub: "15 minutes" },
      { title: "Notification: lab criticals", sub: "On" },
      { title: "Preferred language", sub: "English" },
      { title: "Digital signature", sub: "Configured" },
    ],
  },
};

/* --------------------------------- patient -------------------------------- */
export const patientMock: Record<string, MockSectionData> = {
  medications: {
    items: [
      {
        title: "Paracetamol 500mg",
        sub: "1 tablet three times a day · 3 days",
        badge: "Active",
        tone: "green",
      },
      {
        title: "Cetirizine 10mg",
        sub: "1 tablet at night · 5 days",
        badge: "Active",
        tone: "green",
      },
      {
        title: "Vitamin D3 60k IU",
        sub: "1 sachet weekly · 8 weeks",
        badge: "Ongoing",
        tone: "teal",
      },
      {
        title: "Azithromycin 500mg",
        sub: "1 tablet daily · 3 days",
        badge: "Completed",
        tone: "slate",
      },
    ],
  },
  imaging: {
    items: [
      {
        title: "Chest X-Ray (PA view)",
        sub: "03 Jul 2026 · Dr. Meera Rao",
        badge: "Normal",
        tone: "green",
      },
      { title: "USG Whole Abdomen", sub: "21 May 2026", badge: "Normal", tone: "green" },
      { title: "X-Ray Right Knee", sub: "12 Feb 2026", badge: "Mild wear", tone: "amber" },
    ],
  },
  documents: {
    items: [
      {
        title: "Discharge Summary",
        sub: "Day-care visit · 03 Jul 2026",
        badge: "PDF",
        tone: "slate",
      },
      { title: "Prescription", sub: "03 Jul 2026", badge: "PDF", tone: "slate" },
      { title: "Lab Report — CBC", sub: "03 Jul 2026", badge: "PDF", tone: "slate" },
      {
        title: "Insurance Card",
        sub: "Star Health · valid to 2027",
        badge: "Image",
        tone: "slate",
      },
    ],
  },
  labs: {
    items: [
      {
        title: "Complete Blood Count",
        sub: "03 Jul 2026 · within normal limits",
        badge: "Final",
        tone: "green",
      },
      {
        title: "Blood Glucose (Fasting)",
        sub: "03 Jul 2026 · 92 mg/dL",
        badge: "Final",
        tone: "green",
      },
      { title: "Vitamin D", sub: "21 May 2026 · 18 ng/mL (low)", badge: "Final", tone: "amber" },
    ],
  },
};
