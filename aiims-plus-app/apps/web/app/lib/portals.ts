/**
 * Department-portal registry. Each entry is a self-contained hospital portal
 * (its own sidebar + sections), rendered generically by PortalView. Data here is
 * realistic example/demo data (no backend yet) that mirrors what each department
 * actually manages in a real hospital. Replace a section's data with a real fetch
 * as its module lands.
 */
import type { MockSectionData } from "./mock";

export interface PortalNavItem {
  key: string;
  label: string;
  group: string;
}
export interface PortalConfig {
  slug: string;
  name: string;
  tagline: string;
  nav: PortalNavItem[];
  sections: Record<string, MockSectionData>;
}

/** Build nav from section keys+labels, grouping everything under one heading. */
function nav(items: [string, string][], group = "Manage"): PortalNavItem[] {
  return items.map(([key, label], i) => ({
    key,
    label,
    group: i === 0 ? "Overview" : key === "reports" ? "Reports" : group,
  }));
}

export const PORTALS: PortalConfig[] = [
  {
    slug: "billing",
    name: "Billing & Accounts Portal",
    tagline: "Invoicing, payments, insurance claims and revenue",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["invoices", "Invoices"],
      ["payments", "Payments"],
      ["claims", "Insurance Claims"],
      ["refunds", "Refunds"],
      ["collection", "Daily Collection"],
      ["outstanding", "Outstanding Dues"],
      ["ledger", "Ledger & Heads"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Revenue today", "₹4.82L"],
          ["Collected", "₹3.91L"],
          ["Outstanding", "₹91K"],
          ["Invoices", "312"],
        ],
        items: [
          { title: "Cash counter 1", sub: "₹1.24L collected", badge: "Open", tone: "green" },
          { title: "Cash counter 2", sub: "₹0.98L collected", badge: "Open", tone: "green" },
          { title: "Insurance desk", sub: "₹1.69L billed", badge: "Open", tone: "teal" },
        ],
      },
      invoices: {
        items: [
          {
            title: "INV-000318 · Rohan Mehta",
            sub: "OPD consult ₹1,250",
            badge: "Paid",
            tone: "green",
          },
          {
            title: "INV-000320 · Abdul Rahman",
            sub: "IPD ₹18,400",
            badge: "Partly paid",
            tone: "amber",
          },
          { title: "INV-000321 · Devendra Joshi", sub: "ICU ₹42,100", badge: "Due", tone: "red" },
          {
            title: "INV-000322 · Kavya Nair",
            sub: "Day-care ₹3,600",
            badge: "Paid",
            tone: "green",
          },
        ],
      },
      payments: {
        stats: [
          ["Cash", "₹1.9L"],
          ["Card", "₹0.8L"],
          ["UPI", "₹1.1L"],
          ["Refunds", "₹12K"],
        ],
        items: [
          { title: "UPI · ₹1,250", sub: "INV-000318 · 10:24", badge: "Success", tone: "green" },
          { title: "Card · ₹8,000", sub: "INV-000320 · 10:05", badge: "Success", tone: "green" },
          { title: "Cash · ₹3,600", sub: "INV-000322 · 09:40", badge: "Success", tone: "green" },
        ],
      },
      claims: {
        items: [
          {
            title: "Star Health · Rohan Mehta",
            sub: "₹1,250 cashless",
            badge: "Approved",
            tone: "green",
          },
          {
            title: "CGHS · Devendra Joshi",
            sub: "₹42,100",
            badge: "Pre-auth pending",
            tone: "amber",
          },
          {
            title: "Ayushman Bharat · Abdul Rahman",
            sub: "₹18,400",
            badge: "Under review",
            tone: "teal",
          },
          { title: "HDFC Ergo · Sneha Iyer", sub: "₹850", badge: "Rejected", tone: "red" },
        ],
      },
      refunds: {
        items: [
          {
            title: "Refund ₹2,400 · Meena Kulkarni",
            sub: "Advance excess",
            badge: "Processed",
            tone: "green",
          },
          {
            title: "Refund ₹600 · Rahul Verma",
            sub: "Cancelled test",
            badge: "Pending",
            tone: "amber",
          },
        ],
      },
      collection: {
        stats: [
          ["Cash", "₹1.9L"],
          ["Digital", "₹1.9L"],
          ["Counters", "3"],
          ["Shift", "Day"],
        ],
        items: [
          {
            title: "Counter 1 · Priya",
            sub: "₹1.24L · 86 receipts",
            badge: "Reconciled",
            tone: "green",
          },
          {
            title: "Counter 2 · Aman",
            sub: "₹0.98L · 72 receipts",
            badge: "Pending",
            tone: "amber",
          },
        ],
      },
      outstanding: {
        items: [
          {
            title: "Devendra Joshi",
            sub: "ICU · ₹42,100 overdue 5d",
            badge: "Follow-up",
            tone: "red",
          },
          {
            title: "Abdul Rahman",
            sub: "IPD · ₹10,400 balance",
            badge: "Partly paid",
            tone: "amber",
          },
        ],
      },
      ledger: {
        items: [
          {
            title: "OPD Consultation",
            sub: "Income head · ₹3.1L MTD",
            badge: "Active",
            tone: "teal",
          },
          {
            title: "Pharmacy Sales",
            sub: "Income head · ₹8.4L MTD",
            badge: "Active",
            tone: "teal",
          },
          {
            title: "Supplier Payments",
            sub: "Expense head · ₹5.2L MTD",
            badge: "Active",
            tone: "slate",
          },
        ],
      },
      reports: {
        stats: [
          ["MTD revenue", "₹1.42Cr"],
          ["Collection rate", "94%"],
          ["Avg bill", "₹2,180"],
          ["Claim TAT", "6 days"],
        ],
        items: [
          {
            title: "Revenue by department",
            sub: "Cardiology leads at ₹22L",
            badge: "Report",
            tone: "teal",
          },
          { title: "GST summary", sub: "Filed for June", badge: "Filed", tone: "green" },
        ],
      },
    },
  },
  {
    slug: "pharmacy",
    name: "Pharmacy Portal",
    tagline: "Dispensing, drug inventory, purchase and expiry",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["queue", "Prescription Queue"],
      ["dispensing", "Dispensing"],
      ["inventory", "Drug Inventory"],
      ["expiry", "Stock & Expiry"],
      ["purchase", "Purchase Orders"],
      ["suppliers", "Suppliers"],
      ["returns", "Returns"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Prescriptions", "128"],
          ["Dispensed", "312"],
          ["Low stock", "23"],
          ["Expiring < 30d", "14"],
        ],
        items: [
          { title: "OPD dispensing", sub: "84 prescriptions", badge: "Busy", tone: "amber" },
          { title: "IPD ward supply", sub: "36 indents", badge: "Open", tone: "teal" },
        ],
      },
      queue: {
        items: [
          {
            title: "Rohan Mehta · Rx-4412",
            sub: "Paracetamol, CTM",
            badge: "Ready",
            tone: "green",
          },
          {
            title: "Sneha Iyer · Rx-4413",
            sub: "Levothyroxine",
            badge: "Preparing",
            tone: "amber",
          },
          { title: "Kavya Nair · Rx-4414", sub: "ORS, Zinc", badge: "Waiting", tone: "slate" },
        ],
      },
      dispensing: {
        items: [
          {
            title: "Rx-4410 · Abdul Rahman",
            sub: "Amoxicillin 500mg × 15",
            badge: "Dispensed",
            tone: "green",
          },
          {
            title: "Rx-4409 · Devendra Joshi",
            sub: "Atorvastatin 10mg × 30",
            badge: "Dispensed",
            tone: "green",
          },
        ],
      },
      inventory: {
        stats: [
          ["SKUs", "1,120"],
          ["In stock", "1,074"],
          ["Low", "23"],
          ["Out", "3"],
        ],
        items: [
          { title: "Paracetamol 500mg", sub: "4,200 tablets", badge: "In stock", tone: "green" },
          { title: "Amoxicillin 500mg", sub: "180 capsules", badge: "Low", tone: "amber" },
          { title: "Atorvastatin 10mg", sub: "0", badge: "Out of stock", tone: "red" },
        ],
      },
      expiry: {
        items: [
          {
            title: "Insulin (Human) 40IU",
            sub: "26 vials · exp Aug 2026",
            badge: "Expiring",
            tone: "amber",
          },
          {
            title: "Adrenaline 1mg",
            sub: "12 amp · exp Jul 2026",
            badge: "Expiring soon",
            tone: "red",
          },
          { title: "ORS Sachets", sub: "3,500 · exp 2027", badge: "OK", tone: "green" },
        ],
      },
      purchase: {
        items: [
          { title: "PO-2231 · Cipla", sub: "Antibiotics ₹1.2L", badge: "Sent", tone: "teal" },
          {
            title: "PO-2232 · Sun Pharma",
            sub: "Cardiac ₹0.9L",
            badge: "Delivered",
            tone: "green",
          },
        ],
      },
      suppliers: {
        items: [
          { title: "Cipla Ltd", sub: "Lead time 3d · 98% fill", badge: "Preferred", tone: "green" },
          { title: "Sun Pharma", sub: "Lead time 4d · 95% fill", badge: "Active", tone: "teal" },
          { title: "MedPlus Distribution", sub: "Lead time 2d", badge: "Active", tone: "teal" },
        ],
      },
      returns: {
        items: [
          {
            title: "Return · damaged strips",
            sub: "Paracetamol × 40",
            badge: "Approved",
            tone: "green",
          },
          {
            title: "Return · near expiry",
            sub: "Insulin × 6 vials",
            badge: "Pending",
            tone: "amber",
          },
        ],
      },
      reports: {
        stats: [
          ["Sales MTD", "₹8.4L"],
          ["Fill rate", "97%"],
          ["Wastage", "1.2%"],
          ["Fast movers", "42"],
        ],
        items: [
          {
            title: "Top selling",
            sub: "Paracetamol, ORS, Cetirizine",
            badge: "Report",
            tone: "teal",
          },
        ],
      },
    },
  },
  {
    slug: "laboratory",
    name: "Laboratory Portal",
    tagline: "Test orders, sample collection, results and QC",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["orders", "Test Orders"],
      ["collection", "Sample Collection"],
      ["results", "Results Entry"],
      ["pending", "Pending Reports"],
      ["qc", "Quality Control"],
      ["catalog", "Test Catalog"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Orders today", "142"],
          ["Pending", "37"],
          ["Completed", "98"],
          ["Critical", "3"],
        ],
        items: [
          { title: "Haematology", sub: "48 samples", badge: "On time", tone: "green" },
          { title: "Biochemistry", sub: "56 samples", badge: "Backlog", tone: "amber" },
          { title: "Microbiology", sub: "18 cultures", badge: "In progress", tone: "teal" },
        ],
      },
      orders: {
        items: [
          { title: "CBC · Rohan Mehta", sub: "Priority routine", badge: "Ordered", tone: "teal" },
          {
            title: "LFT · Abdul Rahman",
            sub: "Priority urgent",
            badge: "Collected",
            tone: "amber",
          },
          { title: "Dengue NS1 · Kavya Nair", sub: "STAT", badge: "Critical", tone: "red" },
        ],
      },
      collection: {
        items: [
          { title: "Phlebotomy · Bay 1", sub: "12 waiting", badge: "Queue", tone: "amber" },
          { title: "Ward rounds", sub: "IPD samples 08:00", badge: "Done", tone: "green" },
        ],
      },
      results: {
        items: [
          { title: "CBC · Rohan Mehta", sub: "WBC 11.2, Hb 13.4", badge: "Verify", tone: "amber" },
          { title: "FBS · Sneha Iyer", sub: "92 mg/dL", badge: "Approved", tone: "green" },
        ],
      },
      pending: {
        items: [
          {
            title: "Culture & sensitivity",
            sub: "Abdul Rahman · 48h",
            badge: "Incubating",
            tone: "teal",
          },
          { title: "Thyroid profile", sub: "Devendra Joshi", badge: "Pending", tone: "amber" },
        ],
      },
      qc: {
        stats: [
          ["QC runs", "6"],
          ["Pass", "6"],
          ["Westgard flags", "0"],
          ["Calibrations", "3"],
        ],
        items: [
          { title: "Level 1 control", sub: "Within 2SD", badge: "Pass", tone: "green" },
          { title: "Level 2 control", sub: "Within 2SD", badge: "Pass", tone: "green" },
        ],
      },
      catalog: {
        items: [
          { title: "Complete Blood Count", sub: "₹300 · 2h TAT", badge: "Active", tone: "teal" },
          { title: "Liver Function Test", sub: "₹650 · 4h TAT", badge: "Active", tone: "teal" },
          { title: "HbA1c", sub: "₹550 · 6h TAT", badge: "Active", tone: "teal" },
        ],
      },
      reports: {
        stats: [
          ["Avg TAT", "3.4h"],
          ["Reject rate", "0.8%"],
          ["Tests MTD", "3,120"],
          ["Auto-verify", "72%"],
        ],
        items: [
          {
            title: "TAT by section",
            sub: "Biochem slowest at 4.1h",
            badge: "Report",
            tone: "amber",
          },
        ],
      },
    },
  },
  {
    slug: "radiology",
    name: "Radiology Portal",
    tagline: "Imaging orders, modality scheduling, reporting and PACS",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["orders", "Imaging Orders"],
      ["schedule", "Modality Schedule"],
      ["worklist", "Radiologist Worklist"],
      ["studies", "PACS Studies"],
      ["equipment", "Equipment"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Studies today", "64"],
          ["Awaiting report", "19"],
          ["Reported", "45"],
          ["Modalities", "5"],
        ],
        items: [
          { title: "X-Ray", sub: "32 studies", badge: "On time", tone: "green" },
          { title: "CT", sub: "14 studies", badge: "Backlog", tone: "amber" },
          { title: "MRI", sub: "8 studies", badge: "Scheduled", tone: "teal" },
        ],
      },
      orders: {
        items: [
          {
            title: "Chest X-Ray · Abdul Rahman",
            sub: "PA view",
            badge: "Completed",
            tone: "green",
          },
          {
            title: "CT Brain · Devendra Joshi",
            sub: "Plain",
            badge: "Awaiting report",
            tone: "amber",
          },
          { title: "MRI Knee · Rohan Mehta", sub: "Right", badge: "Scheduled", tone: "teal" },
        ],
      },
      schedule: {
        items: [
          { title: "CT Scanner 1", sub: "09:00 Joshi · 09:30 Rao", badge: "Busy", tone: "amber" },
          { title: "MRI 1.5T", sub: "10:00 Mehta", badge: "Open", tone: "green" },
        ],
      },
      worklist: {
        items: [
          {
            title: "CT Brain · Devendra Joshi",
            sub: "Assigned: Dr. Rao",
            badge: "Reading",
            tone: "teal",
          },
          {
            title: "USG Abdomen · Sneha Iyer",
            sub: "Assigned: Dr. Khan",
            badge: "Reported",
            tone: "green",
          },
        ],
      },
      studies: {
        items: [
          { title: "STU-88213", sub: "Chest X-Ray · 12 images", badge: "Archived", tone: "slate" },
          { title: "STU-88214", sub: "CT Brain · 220 slices", badge: "Available", tone: "teal" },
        ],
      },
      equipment: {
        items: [
          {
            title: "CT Scanner 1",
            sub: "GE · last QA passed",
            badge: "Operational",
            tone: "green",
          },
          { title: "MRI 1.5T", sub: "Siemens", badge: "Operational", tone: "green" },
          { title: "Portable X-Ray 2", sub: "Under service", badge: "Down", tone: "red" },
        ],
      },
      reports: {
        stats: [
          ["Report TAT", "2.1h"],
          ["Studies MTD", "1,480"],
          ["Critical results", "12"],
          ["Rescans", "1.4%"],
        ],
        items: [{ title: "Modality utilisation", sub: "CT at 88%", badge: "Report", tone: "teal" }],
      },
    },
  },
  {
    slug: "er",
    name: "Emergency (ER) Portal",
    tagline: "Triage, active cases, ER beds and ambulance arrivals",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["triage", "Triage"],
      ["active", "Active Cases"],
      ["beds", "ER Beds"],
      ["arrivals", "Ambulance Arrivals"],
      ["alerts", "Critical Alerts"],
      ["handover", "Shift Handover"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Active cases", "18"],
          ["Critical (Red)", "3"],
          ["ER beds free", "4"],
          ["Inbound", "2"],
        ],
        items: [
          { title: "Resuscitation bay", sub: "2 / 3 occupied", badge: "Critical", tone: "red" },
          { title: "Observation", sub: "8 / 12 occupied", badge: "Filling", tone: "amber" },
        ],
      },
      triage: {
        items: [
          { title: "Chest pain · 58M", sub: "ESI-1", badge: "Red", tone: "red" },
          { title: "RTA · 24M", sub: "ESI-2", badge: "Orange", tone: "amber" },
          { title: "High fever · 8F", sub: "ESI-3", badge: "Yellow", tone: "amber" },
          { title: "Sprain · 33M", sub: "ESI-4", badge: "Green", tone: "green" },
        ],
      },
      active: {
        items: [
          {
            title: "Bay 1 · Chest pain 58M",
            sub: "ECG done · troponin sent",
            badge: "Critical",
            tone: "red",
          },
          { title: "Bay 3 · RTA 24M", sub: "CT trauma ordered", badge: "Urgent", tone: "amber" },
        ],
      },
      beds: {
        items: [
          { title: "Resus 1", sub: "Occupied · 58M", badge: "In use", tone: "red" },
          { title: "Resus 2", sub: "Available", badge: "Free", tone: "green" },
          { title: "Obs 1–8", sub: "6 occupied", badge: "2 free", tone: "amber" },
        ],
      },
      arrivals: {
        items: [
          {
            title: "AMB-1024 inbound",
            sub: "Cardiac · ETA 6 min",
            badge: "Inbound",
            tone: "amber",
          },
          {
            title: "AMB-2048 inbound",
            sub: "Trauma · ETA 12 min",
            badge: "Inbound",
            tone: "amber",
          },
        ],
      },
      alerts: {
        items: [
          { title: "Code Blue · Resus 1", sub: "Cardiac arrest", badge: "Active", tone: "red" },
          {
            title: "Trauma team activation",
            sub: "RTA polytrauma",
            badge: "Standby",
            tone: "amber",
          },
        ],
      },
      handover: {
        items: [
          {
            title: "Day → Night shift",
            sub: "18 active, 3 critical",
            badge: "Pending",
            tone: "amber",
          },
          { title: "Pending investigations", sub: "5 labs, 2 CT", badge: "Note", tone: "slate" },
        ],
      },
      reports: {
        stats: [
          ["Avg door-to-doc", "8 min"],
          ["LWBS", "1.2%"],
          ["Admissions", "42%"],
          ["Cases MTD", "1,860"],
        ],
        items: [
          {
            title: "Presenting complaints",
            sub: "Fever, chest pain, trauma",
            badge: "Report",
            tone: "teal",
          },
        ],
      },
    },
  },
  {
    slug: "beds",
    name: "Bed & Ward Management Portal",
    tagline: "Occupancy, admissions, transfers and discharges",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["occupancy", "Bed Occupancy"],
      ["admissions", "Admissions"],
      ["transfers", "Transfers"],
      ["discharges", "Discharges"],
      ["housekeeping", "Housekeeping"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Total beds", "240"],
          ["Occupied", "186"],
          ["Available", "54"],
          ["ICU free", "6"],
        ],
        items: [
          { title: "General Ward A", sub: "48 / 60", badge: "12 free", tone: "green" },
          { title: "General Ward B", sub: "57 / 60", badge: "3 free", tone: "amber" },
          { title: "ICU", sub: "18 / 24", badge: "6 free", tone: "green" },
          { title: "Isolation", sub: "12 / 12", badge: "Full", tone: "red" },
        ],
      },
      occupancy: {
        items: [
          { title: "Bed A-12", sub: "Abdul Rahman · Day 3", badge: "Occupied", tone: "amber" },
          { title: "Bed A-14", sub: "Cleaning", badge: "Housekeeping", tone: "slate" },
          { title: "Bed A-15", sub: "Ready", badge: "Available", tone: "green" },
        ],
      },
      admissions: {
        items: [
          {
            title: "Meena Kulkarni",
            sub: "Maternity · Bed M-09",
            badge: "Admitted",
            tone: "green",
          },
          {
            title: "Suresh Rao",
            sub: "Awaiting bed · Cardiology",
            badge: "Pending",
            tone: "amber",
          },
        ],
      },
      transfers: {
        items: [
          {
            title: "Devendra Joshi",
            sub: "ICU → General Ward B",
            badge: "Requested",
            tone: "amber",
          },
          { title: "Kavya Nair", sub: "Paeds → Day-care", badge: "Completed", tone: "green" },
        ],
      },
      discharges: {
        items: [
          {
            title: "Meena Kulkarni",
            sub: "Summary ready · billing clear",
            badge: "Discharged",
            tone: "green",
          },
          {
            title: "Rahul Verma",
            sub: "Awaiting billing clearance",
            badge: "Pending",
            tone: "amber",
          },
        ],
      },
      housekeeping: {
        items: [
          { title: "Bed A-14", sub: "Terminal cleaning", badge: "In progress", tone: "amber" },
          { title: "Bed B-22", sub: "Ready", badge: "Done", tone: "green" },
        ],
      },
      reports: {
        stats: [
          ["Occupancy", "78%"],
          ["Avg LOS", "3.6d"],
          ["Turnaround", "2.1h"],
          ["Admissions MTD", "418"],
        ],
        items: [
          { title: "Occupancy trend", sub: "Peaks on weekends", badge: "Report", tone: "teal" },
        ],
      },
    },
  },
  {
    slug: "ambulance",
    name: "Ambulance Portal",
    tagline: "Fleet, dispatch, trips and maintenance",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["fleet", "Fleet Status"],
      ["dispatch", "Dispatch"],
      ["trips", "Active Trips"],
      ["drivers", "Drivers"],
      ["maintenance", "Maintenance"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Fleet", "8"],
          ["Available", "5"],
          ["On trip", "2"],
          ["Maintenance", "1"],
        ],
        items: [
          { title: "Calls today", sub: "14 · avg response 11 min", badge: "Normal", tone: "green" },
          { title: "Zone coverage", sub: "North, East covered", badge: "OK", tone: "teal" },
        ],
      },
      fleet: {
        items: [
          {
            title: "MH-12 AB-1024 (ALS)",
            sub: "Driver: Suresh Patil",
            badge: "Available",
            tone: "green",
          },
          {
            title: "MH-12 AB-2048 (BLS)",
            sub: "Driver: Ramesh Kale",
            badge: "On trip",
            tone: "amber",
          },
          { title: "MH-12 AB-4096 (BLS)", sub: "Servicing", badge: "Maintenance", tone: "slate" },
        ],
      },
      dispatch: {
        items: [
          {
            title: "New call · chest pain",
            sub: "Andheri E · assign ALS",
            badge: "Dispatch",
            tone: "red",
          },
          { title: "Transfer · discharge", sub: "Home drop", badge: "Queued", tone: "amber" },
        ],
      },
      trips: {
        items: [
          { title: "AB-2048 → ER", sub: "Trauma · ETA 12 min", badge: "En route", tone: "amber" },
          { title: "AB-3072 → dialysis", sub: "Return trip", badge: "En route", tone: "amber" },
        ],
      },
      drivers: {
        items: [
          { title: "Suresh Patil", sub: "Shift day · 6 trips", badge: "On duty", tone: "green" },
          { title: "Ramesh Kale", sub: "Shift day · 4 trips", badge: "On trip", tone: "amber" },
        ],
      },
      maintenance: {
        items: [
          { title: "AB-4096", sub: "Brake service due", badge: "In service", tone: "amber" },
          { title: "AB-1024", sub: "Oxygen refilled", badge: "Ready", tone: "green" },
        ],
      },
      reports: {
        stats: [
          ["Avg response", "11 min"],
          ["Trips MTD", "386"],
          ["Utilisation", "64%"],
          ["Breakdowns", "2"],
        ],
        items: [{ title: "Response by zone", sub: "West slowest", badge: "Report", tone: "amber" }],
      },
    },
  },
  {
    slug: "inventory",
    name: "Inventory & Store Portal",
    tagline: "Stock, indents, goods receipt and assets",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["stock", "Stock Levels"],
      ["indents", "Indents"],
      ["grn", "Goods Receipt (GRN)"],
      ["issues", "Issues"],
      ["assets", "Assets"],
      ["expiry", "Expiry Alerts"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Line items", "3,240"],
          ["Reorder", "41"],
          ["Stockouts", "3"],
          ["POs open", "12"],
        ],
        items: [
          { title: "Central store", sub: "₹18.2L value", badge: "OK", tone: "green" },
          { title: "Ward sub-stores", sub: "6 locations", badge: "OK", tone: "teal" },
        ],
      },
      stock: {
        items: [
          { title: "Surgical Gloves (M)", sub: "12,000 pairs", badge: "OK", tone: "green" },
          { title: "N95 Masks", sub: "800", badge: "Reorder", tone: "amber" },
          { title: "Oxygen Cylinders (D)", sub: "18", badge: "Critical", tone: "red" },
        ],
      },
      indents: {
        items: [
          { title: "ICU indent #442", sub: "Consumables ₹0.4L", badge: "Approved", tone: "green" },
          { title: "OT indent #443", sub: "Sutures ₹0.6L", badge: "Pending", tone: "amber" },
        ],
      },
      grn: {
        items: [
          { title: "GRN-9921 · Cipla", sub: "12 lines matched", badge: "Received", tone: "green" },
          { title: "GRN-9922 · 3M", sub: "Qty mismatch", badge: "Hold", tone: "amber" },
        ],
      },
      issues: {
        items: [
          { title: "Issue → ICU", sub: "Gloves, cannula", badge: "Issued", tone: "green" },
          { title: "Issue → OT", sub: "Sutures", badge: "Issued", tone: "green" },
        ],
      },
      assets: {
        items: [
          { title: "Ventilator × 24", sub: "AMC active", badge: "Working", tone: "green" },
          { title: "Infusion pumps × 60", sub: "2 in repair", badge: "Partial", tone: "amber" },
        ],
      },
      expiry: {
        items: [
          { title: "IV fluids batch B2231", sub: "exp Aug 2026", badge: "Expiring", tone: "amber" },
          { title: "Sutures batch S119", sub: "exp Jul 2026", badge: "Expiring soon", tone: "red" },
        ],
      },
      reports: {
        stats: [
          ["Stock value", "₹18.2L"],
          ["Turns", "6.2/yr"],
          ["Wastage", "0.9%"],
          ["Fill rate", "96%"],
        ],
        items: [{ title: "Slow movers", sub: "42 items > 90d", badge: "Report", tone: "slate" }],
      },
    },
  },
  {
    slug: "procurement",
    name: "Procurement Portal",
    tagline: "Requisitions, purchase orders, vendors and approvals",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["requisitions", "Requisitions"],
      ["po", "Purchase Orders"],
      ["vendors", "Vendors"],
      ["quotations", "Quotations"],
      ["approvals", "Approvals"],
      ["contracts", "Contracts"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Requisitions", "24"],
          ["Open POs", "12"],
          ["Vendors", "86"],
          ["Pending approvals", "7"],
        ],
        items: [
          { title: "Spend MTD", sub: "₹52.1L", badge: "On budget", tone: "green" },
          { title: "Savings via e-tender", sub: "₹3.4L", badge: "Good", tone: "teal" },
        ],
      },
      requisitions: {
        items: [
          { title: "REQ-771 · Pharmacy", sub: "Antibiotics", badge: "Approved", tone: "green" },
          { title: "REQ-772 · Biomedical", sub: "ECG machine", badge: "Pending", tone: "amber" },
        ],
      },
      po: {
        items: [
          { title: "PO-2231 · Cipla", sub: "₹1.2L", badge: "Sent", tone: "teal" },
          {
            title: "PO-2233 · GE Healthcare",
            sub: "₹8.5L",
            badge: "Awaiting delivery",
            tone: "amber",
          },
        ],
      },
      vendors: {
        items: [
          {
            title: "Cipla Ltd",
            sub: "Rating 4.6 · on-time 98%",
            badge: "Preferred",
            tone: "green",
          },
          { title: "GE Healthcare", sub: "Rating 4.4", badge: "Approved", tone: "teal" },
          { title: "Local Surgicals", sub: "Rating 3.9", badge: "Watch", tone: "amber" },
        ],
      },
      quotations: {
        items: [
          {
            title: "RFQ-88 · ECG machine",
            sub: "3 quotes received",
            badge: "Comparing",
            tone: "amber",
          },
          { title: "RFQ-89 · Gloves", sub: "5 quotes", badge: "Awarded", tone: "green" },
        ],
      },
      approvals: {
        items: [
          {
            title: "PO-2233 ₹8.5L",
            sub: "Needs director sign-off",
            badge: "L2 pending",
            tone: "amber",
          },
          { title: "REQ-772", sub: "Needs HOD approval", badge: "L1 pending", tone: "amber" },
        ],
      },
      contracts: {
        items: [
          {
            title: "AMC · Ventilators",
            sub: "GE · renews Dec 2026",
            badge: "Active",
            tone: "green",
          },
          { title: "Rate contract · Gloves", sub: "valid FY26", badge: "Active", tone: "green" },
        ],
      },
      reports: {
        stats: [
          ["Spend MTD", "₹52.1L"],
          ["PO cycle", "4.2d"],
          ["Vendors active", "86"],
          ["Savings", "₹3.4L"],
        ],
        items: [{ title: "Spend by category", sub: "Pharma leads", badge: "Report", tone: "teal" }],
      },
    },
  },
  {
    slug: "ot",
    name: "Operation Theatre (OT) Portal",
    tagline: "OT scheduling, surgeries, teams and utilisation",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["schedule", "OT Schedule"],
      ["surgeries", "Surgery List"],
      ["teams", "Surgical Teams"],
      ["consumables", "Consumables"],
      ["preop", "Pre-op Checklist"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Surgeries today", "12"],
          ["In progress", "3"],
          ["OTs", "6"],
          ["Utilisation", "78%"],
        ],
        items: [
          { title: "OT-1 · Ortho", sub: "TKR in progress", badge: "Occupied", tone: "amber" },
          { title: "OT-3 · General", sub: "Lap chole next", badge: "Turnover", tone: "slate" },
        ],
      },
      schedule: {
        items: [
          { title: "08:00 OT-1 · TKR", sub: "Dr. Deshmukh", badge: "In progress", tone: "amber" },
          { title: "10:30 OT-2 · LSCS", sub: "Dr. Nair", badge: "Scheduled", tone: "teal" },
          { title: "12:00 OT-3 · Lap chole", sub: "Dr. Khan", badge: "Scheduled", tone: "teal" },
        ],
      },
      surgeries: {
        items: [
          {
            title: "TKR · Devendra Joshi",
            sub: "Ortho · anaesthesia GA",
            badge: "Ongoing",
            tone: "amber",
          },
          { title: "LSCS · Meena Kulkarni", sub: "Obs · spinal", badge: "Planned", tone: "teal" },
        ],
      },
      teams: {
        items: [
          {
            title: "Team A",
            sub: "Surgeon Deshmukh + 2, Anaes Rao",
            badge: "In OT-1",
            tone: "amber",
          },
          { title: "Team B", sub: "Surgeon Nair + 2", badge: "Standby", tone: "green" },
        ],
      },
      consumables: {
        items: [
          {
            title: "TKR implant set",
            sub: "Reserved · lot IMP-771",
            badge: "Issued",
            tone: "green",
          },
          { title: "Sutures & mesh", sub: "OT-3", badge: "Ready", tone: "green" },
        ],
      },
      preop: {
        items: [
          {
            title: "Consent · Joshi",
            sub: "Signed · fasting confirmed",
            badge: "Complete",
            tone: "green",
          },
          {
            title: "WHO checklist · Kulkarni",
            sub: "Sign-in pending",
            badge: "Pending",
            tone: "amber",
          },
        ],
      },
      reports: {
        stats: [
          ["Utilisation", "78%"],
          ["On-time starts", "84%"],
          ["Turnover", "28 min"],
          ["Cases MTD", "214"],
        ],
        items: [{ title: "Cases by specialty", sub: "Ortho leads", badge: "Report", tone: "teal" }],
      },
    },
  },
  {
    slug: "bloodbank",
    name: "Blood Bank Portal",
    tagline: "Blood inventory, donations, cross-match and requests",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["inventory", "Blood Inventory"],
      ["donations", "Donations"],
      ["crossmatch", "Cross-match"],
      ["requests", "Requests"],
      ["donors", "Donors"],
      ["camps", "Donation Camps"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Units in stock", "420"],
          ["O- units", "12"],
          ["Requests", "8"],
          ["Donations today", "15"],
        ],
        items: [
          { title: "Whole blood", sub: "180 units", badge: "OK", tone: "green" },
          { title: "Platelets", sub: "22 units", badge: "Low", tone: "amber" },
          { title: "O-negative", sub: "12 units", badge: "Critical", tone: "red" },
        ],
      },
      inventory: {
        items: [
          { title: "A+", sub: "96 units", badge: "OK", tone: "green" },
          { title: "B+", sub: "88 units", badge: "OK", tone: "green" },
          { title: "O+", sub: "104 units", badge: "OK", tone: "green" },
          { title: "O-", sub: "12 units", badge: "Critical", tone: "red" },
        ],
      },
      donations: {
        items: [
          { title: "Donor D-5521", sub: "O+ · screened", badge: "Accepted", tone: "green" },
          { title: "Donor D-5522", sub: "Low Hb", badge: "Deferred", tone: "amber" },
        ],
      },
      crossmatch: {
        items: [
          {
            title: "Devendra Joshi · 2 units",
            sub: "B+ · compatible",
            badge: "Ready",
            tone: "green",
          },
          { title: "Trauma 24M · 4 units", sub: "O- emergency", badge: "Urgent", tone: "red" },
        ],
      },
      requests: {
        items: [
          { title: "OT-1 · TKR", sub: "2 units B+", badge: "Issued", tone: "green" },
          { title: "ER · trauma", sub: "4 units O-", badge: "Pending", tone: "amber" },
        ],
      },
      donors: {
        items: [
          { title: "Registered donors", sub: "3,420 · 210 regular", badge: "Active", tone: "teal" },
          { title: "Eligible for recall", sub: "O- donors: 46", badge: "Recall", tone: "amber" },
        ],
      },
      camps: {
        items: [
          {
            title: "Corporate camp · Infosys",
            sub: "18 Jul · target 80 units",
            badge: "Scheduled",
            tone: "teal",
          },
          { title: "College camp", sub: "25 Jul", badge: "Planned", tone: "slate" },
        ],
      },
      reports: {
        stats: [
          ["Units MTD", "1,240"],
          ["Wastage", "1.8%"],
          ["TAT issue", "22 min"],
          ["Donors MTD", "410"],
        ],
        items: [{ title: "Group-wise demand", sub: "O+ highest", badge: "Report", tone: "teal" }],
      },
    },
  },
  {
    slug: "cssd",
    name: "CSSD (Sterilization) Portal",
    tagline: "Instrument sets, sterilization cycles and tracking",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["sets", "Instrument Sets"],
      ["cycles", "Sterilization Cycles"],
      ["autoclave", "Autoclave Logs"],
      ["tracking", "Tracking"],
      ["distribution", "Distribution"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Instrument sets", "640"],
          ["Cycles today", "22"],
          ["In process", "6"],
          ["Rejected", "2"],
        ],
        items: [
          { title: "Receiving (dirty)", sub: "14 sets", badge: "Queue", tone: "amber" },
          { title: "Sterile store", sub: "480 sets ready", badge: "OK", tone: "green" },
        ],
      },
      sets: {
        items: [
          {
            title: "Ortho major set #12",
            sub: "Assembled · packed",
            badge: "Sterile",
            tone: "green",
          },
          { title: "Laparoscopy set #4", sub: "In washer", badge: "Processing", tone: "amber" },
          { title: "Suture set #31", sub: "BI failed", badge: "Rejected", tone: "red" },
        ],
      },
      cycles: {
        items: [
          { title: "Cycle #221 · Steam 134°C", sub: "Load 8 sets", badge: "Passed", tone: "green" },
          { title: "Cycle #222 · Steam 134°C", sub: "Running", badge: "In process", tone: "amber" },
        ],
      },
      autoclave: {
        items: [
          { title: "Autoclave A", sub: "Bowie-Dick passed", badge: "Operational", tone: "green" },
          { title: "Autoclave B", sub: "BI incubating", badge: "Monitoring", tone: "amber" },
        ],
      },
      tracking: {
        items: [
          { title: "Set #12 → OT-1", sub: "Barcode scanned", badge: "Issued", tone: "green" },
          {
            title: "Set #4 → OT-3",
            sub: "Awaiting sterilisation",
            badge: "Pending",
            tone: "amber",
          },
        ],
      },
      distribution: {
        items: [
          { title: "OT complex", sub: "18 sets today", badge: "Delivered", tone: "green" },
          { title: "Labour room", sub: "6 sets", badge: "Delivered", tone: "green" },
        ],
      },
      reports: {
        stats: [
          ["Cycles MTD", "610"],
          ["BI pass", "99.7%"],
          ["Turnaround", "3.2h"],
          ["Rejections", "0.3%"],
        ],
        items: [{ title: "Load efficiency", sub: "88% average", badge: "Report", tone: "teal" }],
      },
    },
  },
  {
    slug: "mrd",
    name: "Medical Records (MRD) Portal",
    tagline: "Records, ICD coding, retrieval and retention",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["records", "Records"],
      ["coding", "Coding (ICD-10)"],
      ["retrieval", "Retrieval Requests"],
      ["digitization", "Digitisation"],
      ["release", "Release of Information"],
      ["retention", "Retention"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Records", "12,908"],
          ["Coding pending", "142"],
          ["Retrieval reqs", "18"],
          ["Digitised", "98%"],
        ],
        items: [
          { title: "Assembly & analysis", sub: "64 files", badge: "In progress", tone: "amber" },
          { title: "Deficiency tracking", sub: "22 incomplete", badge: "Follow-up", tone: "amber" },
        ],
      },
      records: {
        items: [
          {
            title: "Discharge summary · Abdul Rahman",
            sub: "MRN-000987",
            badge: "Final",
            tone: "green",
          },
          { title: "OT notes · Devendra Joshi", sub: "MRN-000934", badge: "Final", tone: "green" },
          {
            title: "Consultation · Rohan Mehta",
            sub: "MRN-001042",
            badge: "Incomplete",
            tone: "amber",
          },
        ],
      },
      coding: {
        items: [
          { title: "J06.9 · URI", sub: "Rohan Mehta", badge: "Coded", tone: "green" },
          { title: "A90 · Dengue", sub: "Kavya Nair", badge: "Coded", tone: "green" },
          {
            title: "Pending code",
            sub: "Abdul Rahman · pneumonia",
            badge: "Pending",
            tone: "amber",
          },
        ],
      },
      retrieval: {
        items: [
          {
            title: "Insurance · Star Health",
            sub: "MRN-001042 records",
            badge: "Fulfilled",
            tone: "green",
          },
          { title: "Legal request", sub: "MRN-000934", badge: "Under review", tone: "amber" },
        ],
      },
      digitization: {
        items: [
          { title: "Scan backlog", sub: "142 files", badge: "In progress", tone: "amber" },
          { title: "OCR indexing", sub: "98% complete", badge: "On track", tone: "green" },
        ],
      },
      release: {
        items: [
          {
            title: "ROI · patient copy",
            sub: "Rohan Mehta · consent ok",
            badge: "Released",
            tone: "green",
          },
          { title: "ROI · third party", sub: "Consent pending", badge: "Hold", tone: "amber" },
        ],
      },
      retention: {
        items: [
          { title: "Adult records", sub: "Retain 10 years", badge: "Policy", tone: "slate" },
          {
            title: "Due for crypto-shred",
            sub: "18 records past retention",
            badge: "Action",
            tone: "amber",
          },
        ],
      },
      reports: {
        stats: [
          ["Coding TAT", "1.8d"],
          ["Completion", "94%"],
          ["ROI TAT", "3d"],
          ["Records MTD", "1,120"],
        ],
        items: [
          { title: "Deficiency rate", sub: "6% incomplete at 15d", badge: "Report", tone: "amber" },
        ],
      },
    },
  },
  {
    slug: "management",
    name: "Management Dashboard",
    tagline: "Hospital-wide KPIs, revenue, occupancy and quality",
    nav: nav([
      ["dashboard", "Overview"],
      ["revenue", "Revenue"],
      ["occupancy", "Occupancy"],
      ["flow", "Patient Flow"],
      ["staff", "Staff"],
      ["quality", "Quality & Safety"],
      ["departments", "Departments"],
      ["reports", "Reports"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Revenue MTD", "₹1.42Cr"],
          ["Occupancy", "78%"],
          ["OPD footfall", "2,140"],
          ["NPS", "72"],
        ],
        items: [
          {
            title: "Revenue vs target",
            sub: "104% of monthly target",
            badge: "Above",
            tone: "green",
          },
          { title: "Avg length of stay", sub: "3.6 days", badge: "Stable", tone: "teal" },
          { title: "Bed occupancy", sub: "78% (target 75%)", badge: "Healthy", tone: "green" },
        ],
      },
      revenue: {
        stats: [
          ["MTD", "₹1.42Cr"],
          ["OPD", "₹31L"],
          ["IPD", "₹78L"],
          ["Pharmacy", "₹33L"],
        ],
        items: [
          { title: "Cardiology", sub: "₹22L", badge: "Top", tone: "teal" },
          { title: "Orthopaedics", sub: "₹18L", badge: "", tone: "slate" },
        ],
      },
      occupancy: {
        stats: [
          ["Overall", "78%"],
          ["ICU", "88%"],
          ["General", "72%"],
          ["Maternity", "73%"],
        ],
        items: [{ title: "ICU near capacity", sub: "6 beds free", badge: "Watch", tone: "amber" }],
      },
      flow: {
        stats: [
          ["OPD", "2,140/mo"],
          ["ER", "1,860/mo"],
          ["Admissions", "418/mo"],
          ["Wait", "22 min"],
        ],
        items: [{ title: "OPD peak", sub: "Mon & Wed mornings", badge: "Insight", tone: "teal" }],
      },
      staff: {
        stats: [
          ["Doctors", "142"],
          ["Nurses", "310"],
          ["Vacancy", "18"],
          ["Attrition", "9%"],
        ],
        items: [
          {
            title: "Nurse-to-bed ratio",
            sub: "1:4 (target 1:4)",
            badge: "On target",
            tone: "green",
          },
        ],
      },
      quality: {
        items: [
          { title: "Readmission rate", sub: "4.1%", badge: "Watch", tone: "amber" },
          { title: "Infection rate (HAI)", sub: "1.2%", badge: "Good", tone: "green" },
          { title: "Incident reports", sub: "6 this month", badge: "Reviewed", tone: "teal" },
        ],
      },
      departments: {
        items: [
          { title: "Cardiology", sub: "Revenue ₹22L · occ 82%", badge: "Strong", tone: "green" },
          { title: "Emergency", sub: "1,860 cases · door-to-doc 8m", badge: "Busy", tone: "amber" },
        ],
      },
      reports: {
        stats: [
          ["EBITDA", "18%"],
          ["Cost/bed-day", "₹6,200"],
          ["Claim TAT", "6d"],
          ["NABH", "Accredited"],
        ],
        items: [
          { title: "Board pack", sub: "June financials + quality", badge: "Ready", tone: "teal" },
        ],
      },
    },
  },
  {
    slug: "superadmin",
    name: "Super Admin Portal",
    tagline: "Multi-hospital administration and platform operations",
    nav: nav([
      ["dashboard", "Dashboard"],
      ["hospitals", "Hospitals"],
      ["tenants", "Tenants"],
      ["users", "Global Users"],
      ["licensing", "Licensing"],
      ["integrations", "Integrations"],
      ["health", "System Health"],
      ["audit", "Audit"],
    ]),
    sections: {
      dashboard: {
        stats: [
          ["Hospitals", "6"],
          ["Tenants", "6"],
          ["Users", "1,240"],
          ["Uptime", "99.9%"],
        ],
        items: [
          {
            title: "Demo Multispeciality Hospital",
            sub: "Tenant A · 512 users",
            badge: "Active",
            tone: "green",
          },
          { title: "Demo Clinic B", sub: "Tenant B · 46 users", badge: "Active", tone: "green" },
          { title: "City Care (Tenant C)", sub: "112 users", badge: "Active", tone: "green" },
        ],
      },
      hospitals: {
        items: [
          {
            title: "Demo Multispeciality Hospital",
            sub: "Mumbai · 240 beds",
            badge: "Live",
            tone: "green",
          },
          { title: "Demo Clinic B", sub: "Pune · OPD only", badge: "Live", tone: "green" },
          { title: "City Care", sub: "Nagpur · onboarding", badge: "Setup", tone: "amber" },
        ],
      },
      tenants: {
        items: [
          {
            title: "Tenant A",
            sub: "RLS isolated · own data key",
            badge: "Isolated",
            tone: "teal",
          },
          { title: "Tenant B", sub: "RLS isolated", badge: "Isolated", tone: "teal" },
          { title: "Tenant C", sub: "RLS isolated", badge: "Isolated", tone: "teal" },
        ],
      },
      users: {
        items: [
          {
            title: "1,240 users across tenants",
            sub: "142 doctors · 310 nurses",
            badge: "Active",
            tone: "green",
          },
          { title: "Role changes (24h)", sub: "8", badge: "Audited", tone: "slate" },
        ],
      },
      licensing: {
        items: [
          { title: "Enterprise plan", sub: "Seats 1,500 · used 1,240", badge: "OK", tone: "green" },
          { title: "Renewal", sub: "Due Mar 2027", badge: "Upcoming", tone: "slate" },
        ],
      },
      integrations: {
        items: [
          { title: "ABDM", sub: "Sandbox · mock adapter", badge: "Connected", tone: "green" },
          { title: "Razorpay / MSG91 / SMTP", sub: "Test mode", badge: "Connected", tone: "green" },
        ],
      },
      health: {
        stats: [
          ["Uptime", "99.9%"],
          ["API p95", "180ms"],
          ["Error rate", "0.1%"],
          ["DB", "Healthy"],
        ],
        items: [
          { title: "API", sub: "All regions green", badge: "Operational", tone: "green" },
          { title: "Outbox relay", sub: "Lag 0.4s", badge: "Healthy", tone: "green" },
        ],
      },
      audit: {
        items: [
          {
            title: "tenant.create",
            sub: "platform.admin · City Care",
            badge: "Today",
            tone: "slate",
          },
          { title: "user.role.grant", sub: "admin → doctor", badge: "Today", tone: "slate" },
          {
            title: "Hash chain",
            sub: "Verified across all tenants",
            badge: "Intact",
            tone: "green",
          },
        ],
      },
    },
  },
];

export const portalBySlug = (slug: string): PortalConfig | undefined =>
  PORTALS.find((p) => p.slug === slug);
