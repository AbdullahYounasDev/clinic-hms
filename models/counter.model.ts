import mongoose, { Schema, Document, Model } from "mongoose";
import connectDB from "@/lib/db/mongoose";

export interface ICounter extends Document<string> {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

function getCounterModel(): Model<ICounter> {
  return (mongoose.models.Counter as Model<ICounter>) || mongoose.model<ICounter>("Counter", CounterSchema);
}

/**
 * Generates an atomic sequential number for a given named sequence (e.g. "patient").
 * If the sequence does not exist yet for "patient", initializes it based on existing DB max ID.
 */
export async function getNextSequenceValue(sequenceName: string): Promise<number> {
  await connectDB();
  const Counter = getCounterModel();

  // Check if counter document already exists
  let counter = await Counter.findById(sequenceName);

  if (!counter) {
    let initialSeq = 0;

    if (sequenceName === "patient") {
      // Find the highest numerical Patient ID currently in the system (e.g. PT-000042)
      const Patient = mongoose.models.Patient;
      if (Patient) {
        const highestPatient = await Patient.findOne({ patientId: /^PT-\d+$/ })
          .sort({ patientId: -1 })
          .select("patientId")
          .lean() as { patientId?: string } | null;

        if (highestPatient?.patientId) {
          const match = highestPatient.patientId.match(/^PT-(\d+)$/);
          if (match && match[1]) {
            initialSeq = parseInt(match[1], 10);
          }
        }
      }
    }

    if (sequenceName === "doctor") {
      const Doctor = mongoose.models.Doctor;
      if (Doctor) {
        const highestDoctor = await Doctor.findOne({ doctorId: /^DR-\d+$/ })
          .sort({ doctorId: -1 })
          .select("doctorId")
          .lean() as { doctorId?: string } | null;

        if (highestDoctor?.doctorId) {
          const match = highestDoctor.doctorId.match(/^DR-(\d+)$/);
          if (match && match[1]) {
            initialSeq = parseInt(match[1], 10);
          }
        }
      }
    }

    if (sequenceName === "lab_test") {
      const LabTest = mongoose.models.LabTest;
      if (LabTest) {
        const highestLab = await LabTest.findOne({ labTestId: /^LAB-\d+$/ })
          .sort({ labTestId: -1 })
          .select("labTestId")
          .lean() as { labTestId?: string } | null;

        if (highestLab?.labTestId) {
          const match = highestLab.labTestId.match(/^LAB-(\d+)$/);
          if (match && match[1]) {
            initialSeq = parseInt(match[1], 10);
          }
        }
      }
    }

    if (sequenceName === "report") {
      const Report = mongoose.models.Report;
      if (Report) {
        const highestReport = await Report.findOne({ reportId: /^RPT-\d+$/ })
          .sort({ reportId: -1 })
          .select("reportId")
          .lean() as { reportId?: string } | null;

        if (highestReport?.reportId) {
          const match = highestReport.reportId.match(/^RPT-(\d+)$/);
          if (match && match[1]) {
            initialSeq = parseInt(match[1], 10);
          }
        }
      }
    }

    if (sequenceName === "employee") {
      const User = mongoose.models.User;
      if (User) {
        const highestEmp = await User.findOne({ employeeId: /^EMP-\d+$/ })
          .sort({ employeeId: -1 })
          .select("employeeId")
          .lean() as { employeeId?: string } | null;

        if (highestEmp?.employeeId) {
          const match = highestEmp.employeeId.match(/^EMP-(\d+)$/);
          if (match && match[1]) {
            initialSeq = parseInt(match[1], 10);
          }
        }
      }
    }

    if (sequenceName.startsWith("invoice_")) {
      const type = sequenceName.replace("invoice_", "");
      const Invoice = mongoose.models.Invoice;
      if (Invoice) {
        initialSeq = await Invoice.countDocuments({ invoiceType: type });
      }
    }

    try {
      counter = await Counter.create({ _id: sequenceName, seq: initialSeq });
    } catch {
      // If concurrent request created counter document, proceed to findOneAndUpdate
    }
  }

  const updated = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return updated.seq;
}

export async function getNextDoctorId(): Promise<string> {
  const seq = await getNextSequenceValue("doctor");
  return `DR-${String(seq).padStart(4, "0")}`;
}

export async function getNextLabTestId(): Promise<string> {
  const seq = await getNextSequenceValue("lab_test");
  return `LAB-${String(seq).padStart(6, "0")}`;
}

export async function getNextReportId(): Promise<string> {
  const seq = await getNextSequenceValue("report");
  return `RPT-${String(seq).padStart(6, "0")}`;
}

export async function getNextEmployeeId(): Promise<string> {
  const seq = await getNextSequenceValue("employee");
  return `EMP-${String(seq).padStart(5, "0")}`;
}

export async function getNextInvoiceNumber(invoiceType: string): Promise<string> {
  const sequenceKey = `invoice_${invoiceType}`;
  const seq = await getNextSequenceValue(sequenceKey);
  const prefixes: Record<string, string> = {
    opd: "INV-OPD",
    pharmacy_sale: "INV-PHARM-SALE",
    lab: "INV-LAB",
    procedure: "INV-PROC",
    other: "INV-OTHER",
  };
  const prefix = prefixes[invoiceType] || "INV";
  return `${prefix}-${String(seq).padStart(6, "0")}`;
}

