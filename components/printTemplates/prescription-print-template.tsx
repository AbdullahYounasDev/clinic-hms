import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import {
  NEXT_PUBLIC_CLINIC_NAME,
  NEXT_PUBLIC_CLINIC_TAGLINE,
  NEXT_PUBLIC_CLINIC_ADDRESS,
  NEXT_PUBLIC_CLINIC_PHONE,
  EMR_PRINT_PDF_TEMPLATE_COLORS,
} from "@/constants/ClinicDetails";

const CLINIC = {
  name: NEXT_PUBLIC_CLINIC_NAME || "ClinicHMS",
  tagline: NEXT_PUBLIC_CLINIC_TAGLINE || "Hospital Management System",
  address: NEXT_PUBLIC_CLINIC_ADDRESS || "123 Healthcare Avenue, Medical District",
  phone: NEXT_PUBLIC_CLINIC_PHONE || "+92 300 1234567",
};

const COLORS = EMR_PRINT_PDF_TEMPLATE_COLORS || {
  primary: "#0d9488",
  text: "#1a1a1a",
  muted: "#666",
  lightText: "#888",
  border: "#e5e5e5",
  tableHeaderBg: "#f0fdfa",
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const pdfStyles = StyleSheet.create({
  page: { padding: 35, paddingBottom: 60, fontSize: 10, fontFamily: "Helvetica", color: COLORS.text },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 18, paddingBottom: 12, borderBottom: `2pt solid ${COLORS.primary}` },
  headerLeft: { flex: 1 },
  headerCenter: { flex: 0, marginHorizontal: 20, justifyContent: "center", alignItems: "center" },
  headerRight: { flex: 1, alignItems: "flex-end" },
  clinicName: { fontSize: 16, fontWeight: "bold", color: COLORS.primary, marginBottom: 2 },
  clinicSub: { fontSize: 8, color: COLORS.muted, lineHeight: 1.5 },
  logo: { width: 90, height: 90, objectFit: "contain" },
  docTitle: { fontSize: 14, fontWeight: "bold", color: "#333", marginBottom: 3 },
  docId: { fontSize: 9, color: COLORS.muted },
  section: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: `1pt solid ${COLORS.border}` },
  sectionLabel: { fontSize: 8, fontWeight: "bold", color: COLORS.lightText, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  value: { fontSize: 9, color: "#333" },
  subValue: { fontSize: 8, color: COLORS.muted, marginTop: 1 },
  tableHeader: { flexDirection: "row", backgroundColor: COLORS.tableHeaderBg, borderBottom: `1.5pt solid ${COLORS.primary}`, paddingVertical: 5, paddingHorizontal: 5 },
  tableRow: { flexDirection: "row", borderBottom: `1pt solid #f0f0f0`, paddingVertical: 4, paddingHorizontal: 5 },
  colMed: { width: "28%" },
  colDosage: { width: "14%" },
  colFreq: { width: "16%" },
  colDur: { width: "14%" },
  colRoute: { width: "12%" },
  colQty: { width: "8%", textAlign: "right" },
  colInst: { width: "8%" },
  tableHeaderText: { fontSize: 7, fontWeight: "bold", color: COLORS.primary, textTransform: "uppercase" },
  tableCell: { fontSize: 8, color: "#333" },
  genericName: { fontSize: 7, color: "#999", marginTop: 1 },
  notesSection: { marginTop: 10 },
  footer: { position: "absolute", bottom: 20, left: 35, right: 35, textAlign: "center", fontSize: 7, color: "#aaa", borderTop: `1pt solid ${COLORS.border}`, paddingTop: 6 },
});

export function PrescriptionPdfTemplate({ prescription, logoUrl }: { prescription: any; logoUrl?: string }) {
  const doctor = prescription.doctor?.user || prescription.doctor;
  const patient = prescription.patient;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View style={pdfStyles.headerLeft}>
            <Text style={pdfStyles.clinicName}>{CLINIC.name}</Text>
            <Text style={pdfStyles.clinicSub}>{CLINIC.tagline}</Text>
            <Text style={pdfStyles.clinicSub}>{CLINIC.address}</Text>
            <Text style={pdfStyles.clinicSub}>{CLINIC.phone}</Text>
          </View>
          {logoUrl ? (
            <View style={pdfStyles.headerCenter}><Image src={logoUrl} style={pdfStyles.logo} /></View>
          ) : (
            <View style={{ width: 20 }} />
          )}
          <View style={pdfStyles.headerRight}>
            <Text style={pdfStyles.docTitle}>PRESCRIPTION</Text>
            <Text style={pdfStyles.docId}>{prescription.prescriptionId}</Text>
            <Text style={pdfStyles.docId}>{formatDate(prescription.createdAt)}</Text>
          </View>
        </View>

        <View style={pdfStyles.section}>
          <View>
            <Text style={pdfStyles.sectionLabel}>Patient</Text>
            <Text style={pdfStyles.value}>{patient?.firstName} {patient?.lastName}</Text>
            <Text style={pdfStyles.subValue}>{patient?.patientId}</Text>
            {patient?.phone && <Text style={pdfStyles.subValue}>{patient.phone}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={pdfStyles.sectionLabel}>Prescribed By</Text>
            <Text style={pdfStyles.value}>Dr. {doctor?.firstName} {doctor?.lastName}</Text>
            {prescription.status && <Text style={pdfStyles.subValue}>Status: {prescription.status.replace(/_/g, " ")}</Text>}
          </View>
        </View>

        <View style={pdfStyles.tableHeader}>
          <Text style={[pdfStyles.tableHeaderText, pdfStyles.colMed]}>Medicine</Text>
          <Text style={[pdfStyles.tableHeaderText, pdfStyles.colDosage]}>Dosage</Text>
          <Text style={[pdfStyles.tableHeaderText, pdfStyles.colFreq]}>Frequency</Text>
          <Text style={[pdfStyles.tableHeaderText, pdfStyles.colDur]}>Duration</Text>
          <Text style={[pdfStyles.tableHeaderText, pdfStyles.colRoute]}>Route</Text>
          <Text style={[pdfStyles.tableHeaderText, pdfStyles.colQty]}>Qty</Text>
        </View>

        {(prescription.medicines || []).map((med: any, i: number) => (
          <View key={i} style={pdfStyles.tableRow}>
            <View style={pdfStyles.colMed}>
              <Text style={pdfStyles.tableCell}>{med.medicineName}{med.strength ? ` (${med.strength})` : ""}</Text>
              {med.genericName && <Text style={pdfStyles.genericName}>{med.genericName}</Text>}
            </View>
            <Text style={[pdfStyles.tableCell, pdfStyles.colDosage]}>{med.dosage || "—"}</Text>
            <Text style={[pdfStyles.tableCell, pdfStyles.colFreq]}>{med.frequency || "—"}</Text>
            <Text style={[pdfStyles.tableCell, pdfStyles.colDur]}>{med.duration || "—"}</Text>
            <Text style={[pdfStyles.tableCell, pdfStyles.colRoute]}>{med.route || "—"}</Text>
            <Text style={[pdfStyles.tableCell, pdfStyles.colQty]}>{med.quantity ?? "—"}</Text>
          </View>
        ))}

        {prescription.medicines?.some((m: any) => m.instructions) && (
          <View style={pdfStyles.notesSection}>
            <Text style={pdfStyles.sectionLabel}>Instructions</Text>
            {prescription.medicines.filter((m: any) => m.instructions).map((med: any, i: number) => (
              <Text key={i} style={pdfStyles.subValue}>• {med.medicineName}: {med.instructions}</Text>
            ))}
          </View>
        )}

        {prescription.notes && (
          <View style={pdfStyles.notesSection}>
            <Text style={pdfStyles.sectionLabel}>Notes</Text>
            <Text style={pdfStyles.subValue}>{prescription.notes}</Text>
          </View>
        )}

        <Text style={pdfStyles.footer} fixed>
          {CLINIC.name} • This is a computer-generated prescription • Please follow your doctor&apos;s advice
        </Text>
      </Page>
    </Document>
  );
}

export function generatePrescriptionPrintHtml(prescription: any, logoUrl?: string): string {
  const doctor = prescription.doctor?.user || prescription.doctor;
  const patient = prescription.patient;
  const logoHtml = logoUrl ? `<div class="header-center"><img src="${logoUrl}" class="logo" /></div>` : "";
  const medicinesHtml = (prescription.medicines || []).map((med: any) =>
    `<tr>
      <td><strong>${med.medicineName}</strong>${med.strength ? ` (${med.strength})` : ""}${med.genericName ? `<br/><span class="sub">${med.genericName}</span>` : ""}</td>
      <td>${med.dosage || "—"}</td>
      <td>${med.frequency || "—"}</td>
      <td>${med.duration || "—"}</td>
      <td class="capitalize">${med.route || "—"}</td>
      <td class="right">${med.quantity ?? "—"}</td>
    </tr>`
  ).join("");
  const instructionsHtml = prescription.medicines?.filter((m: any) => m.instructions).map((med: any) =>
    `<div class="sub">• ${med.medicineName}: ${med.instructions}</div>`
  ).join("") || "";

  return `<!DOCTYPE html><html><head><title>${prescription.prescriptionId} - ${CLINIC.name}</title><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;font-size:12px;color:${COLORS.text};background:#fff;padding:30px;padding-bottom:60px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid ${COLORS.primary}}
    .header-left{flex:1}.header-center{flex:0;margin:0 20px;display:flex;justify-content:center;align-items:center}.header-right{flex:1;text-align:right}
    .clinic-name{font-size:18px;font-weight:700;color:${COLORS.primary}}.clinic-sub{font-size:9px;color:${COLORS.muted};line-height:1.5}
    .logo{width:90px;height:90px;object-fit:contain}.doc-title{font-size:16px;font-weight:700;color:#333;text-align:right}.doc-id{font-size:11px;color:${COLORS.muted};text-align:right}
    .section{display:flex;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid ${COLORS.border}}
    .label{font-size:9px;font-weight:600;color:${COLORS.lightText};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}.value{font-size:11px;color:#333;font-weight:500}.sub{font-size:10px;color:${COLORS.muted}}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th{text-align:left;font-size:9px;font-weight:600;color:${COLORS.lightText};text-transform:uppercase;letter-spacing:1px;padding:8px 6px;border-bottom:2px solid ${COLORS.border};background:${COLORS.tableHeaderBg}}
    th.right,td.right{text-align:right}
    td{padding:6px 6px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#333}
    .capitalize{text-transform:capitalize}
    .notes{margin-top:16px;padding-top:12px;border-top:1px solid #f0f0f0}
    .footer{position:fixed;bottom:0;left:30px;right:30px;text-align:center;font-size:9px;color:#aaa;border-top:1px solid ${COLORS.border};padding-top:10px;padding-bottom:10px;background:#fff}
    @media print{body{padding:20px;padding-bottom:60px}@page{margin:15mm}}
  </style></head><body>
  <div class="header"><div class="header-left"><div class="clinic-name">${CLINIC.name}</div><div class="clinic-sub">${CLINIC.tagline}</div><div class="clinic-sub">${CLINIC.address}<br/>${CLINIC.phone}</div></div>${logoHtml}<div class="header-right"><div class="doc-title">PRESCRIPTION</div><div class="doc-id">${prescription.prescriptionId}</div><div class="doc-id">${formatDate(prescription.createdAt)}</div></div></div>
  <div class="section"><div><div class="label">Patient</div><div class="value">${patient?.firstName} ${patient?.lastName}</div><div class="sub">${patient?.patientId || ""}</div>${patient?.phone ? `<div class="sub">${patient.phone}</div>` : ""}</div><div style="text-align:right;"><div class="label">Prescribed By</div><div class="value">Dr. ${doctor?.firstName || ""} ${doctor?.lastName || ""}</div></div></div>
  <table><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Route</th><th class="right">Qty</th></tr></thead><tbody>${medicinesHtml}</tbody></table>
  ${instructionsHtml ? `<div class="notes"><div class="label">Instructions</div>${instructionsHtml}</div>` : ""}
  ${prescription.notes ? `<div class="notes"><div class="label">Notes</div><div class="sub">${prescription.notes}</div></div>` : ""}
  <div class="footer">${CLINIC.name} • This is a computer-generated prescription • Please follow your doctor's advice</div>
  </body></html>`;
}
