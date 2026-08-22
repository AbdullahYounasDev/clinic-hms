import mongoose, { Schema, Document, Model } from "mongoose";
import { getNextSequenceValue } from "@/models/counter.model";

function getModel<T extends Document>(name: string, schema: Schema): Model<T> {
  return (mongoose.models[name] as Model<T>) || mongoose.model<T>(name, schema);
}

// ─── SHARED SUB-SCHEMAS ───────────────────────────────────
const AddressSchema = new Schema({
  street: String,
  city: String,
  state: String,
  country: String,
  postalCode: String,
}, { _id: false });

const AttachmentSchema = new Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, enum: ["report", "scan", "prescription", "document", "image"], default: "document" },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

// ─── DEPARTMENT MODEL ─────────────────────────────────────
export interface IDepartment extends Document {
  name: string;
  code: string;
  description?: string;
  headDoctor?: mongoose.Types.ObjectId;
  isActive: boolean;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    description: { type: String },
    headDoctor: { type: Schema.Types.ObjectId, ref: "Doctor" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ─── PATIENT MODEL ────────────────────────────────────────
export interface IPatient extends Document {
  patientId: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: Date;
  cnic?: string;
  phone?: string;
  email?: string;
  address: typeof AddressSchema;
  emergencyContact: { name: string; relationship: string; phone: string; email?: string };
  bloodGroup?: string;
  allergies: string[];
  chronicDiseases: string[];
  insuranceDetails?: {
    provider: string;
    policyNumber: string;
    expiryDate?: Date;
    coverageDetails?: string;
  };
  photo?: string;
  status: string;
  notes?: string;
  registeredBy: mongoose.Types.ObjectId;
  /** Portal login — separate from staff User model */
  password?: string;
  portalEnabled: boolean;
  mustChangePassword: boolean;
  passwordChangedAt?: Date;
  lastLogin?: Date;
  lastLoginIp?: string;
  get fullName(): string;
  dateOfDeath: Date;
  causeOfDeath?: string;
  tempId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const PatientSchema = new Schema<IPatient>(
  {
    patientId: { type: String, unique: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["male", "female", "other"], required: true },
    dateOfBirth: { type: Date, required: true },
    cnic: { type: String, trim: true },
    phone: { type: String, trim: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    address: AddressSchema,
    emergencyContact: {
      name: { type: String },
      relationship: { type: String },
      phone: { type: String },
      email: { type: String },
    },
    bloodGroup: { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""] },
    allergies: [{ type: String }],
    chronicDiseases: [{ type: String }],
    insuranceDetails: {
      provider: String,
      policyNumber: String,
      expiryDate: Date,
      coverageDetails: String,
    },
    photo: { type: String }, // Cloudinary URL
    status: { type: String, enum: ["active", "archived", "deceased"], default: "active", index: true },
    notes: { type: String },
    registeredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    password: { type: String, select: false },
    portalEnabled: { type: Boolean, default: false, index: true },
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: { type: Date },
    lastLogin: { type: Date },
    lastLoginIp: { type: String },
    dateOfDeath: { type: Date },
    causeOfDeath: { type: String },
    /** Offline temporary ID for idempotent sync deduplication */
    tempId: { type: String },
  },
  { timestamps: true }
);

PatientSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

PatientSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const dob = new Date(this.dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
});

PatientSchema.index({ firstName: "text", lastName: "text", phone: "text", patientId: "text", cnic: "text" });
PatientSchema.index({ email: 1 }, { unique: true, sparse: true });
PatientSchema.index({ cnic: 1 }, { unique: true, sparse: true });
PatientSchema.index({ tempId: 1 }, { unique: true, sparse: true });
PatientSchema.set("toJSON", { virtuals: true });
PatientSchema.set("toObject", { virtuals: true });

PatientSchema.pre("save", async function () {
  if (!this.patientId) {
    const seq = await getNextSequenceValue("patient");
    this.patientId = `PT-${String(seq).padStart(6, "0")}`;
  }
});

// ─── DOCTOR MODEL ─────────────────────────────────────────
export interface IDoctorLeave {
  _id?: mongoose.Types.ObjectId | string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  notes?: string;
  createdAt?: Date;
}

export interface IDoctorDaySchedule {
  isWorking: boolean;
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "17:00"
  breakStart?: string; // e.g. "13:00"
  breakEnd?: string;   // e.g. "14:00"
}

export interface IDoctorWeeklySchedule {
  monday?: IDoctorDaySchedule;
  tuesday?: IDoctorDaySchedule;
  wednesday?: IDoctorDaySchedule;
  thursday?: IDoctorDaySchedule;
  friday?: IDoctorDaySchedule;
  saturday?: IDoctorDaySchedule;
  sunday?: IDoctorDaySchedule;
}

export interface IDoctor extends Document {
  user: mongoose.Types.ObjectId;
  doctorId: string;
  specialization: string;
  qualifications: string[];
  experience: number;
  consultationFee: number;
  department: mongoose.Types.ObjectId;
  availability: Record<string, { isWorking: boolean; slots: { start: string; end: string }[] }>;
  weeklySchedule?: IDoctorWeeklySchedule;
  appointmentDuration: number;
  leaves: IDoctorLeave[];
  bio?: string;
  languages: string[];
  isAvailable: boolean;
  status: string;
}

const DoctorLeaveSchema = new Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, default: "" },
    notes: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const DoctorDayScheduleSchema = new Schema(
  {
    isWorking: { type: Boolean, default: true },
    startTime: { type: String, default: "09:00" },
    endTime: { type: String, default: "17:00" },
    breakStart: { type: String, default: "" },
    breakEnd: { type: String, default: "" },
  },
  { _id: false }
);

const DoctorWeeklyScheduleSchema = new Schema(
  {
    monday: { type: DoctorDayScheduleSchema },
    tuesday: { type: DoctorDayScheduleSchema },
    wednesday: { type: DoctorDayScheduleSchema },
    thursday: { type: DoctorDayScheduleSchema },
    friday: { type: DoctorDayScheduleSchema },
    saturday: { type: DoctorDayScheduleSchema },
    sunday: { type: DoctorDayScheduleSchema },
  },
  { _id: false }
);

const DoctorSchema = new Schema<IDoctor>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    doctorId: { type: String, unique: true },
    specialization: { type: String, required: true },
    qualifications: [{ type: String }],
    experience: { type: Number, default: 0 },
    consultationFee: { type: Number, default: 0 },
    department: { type: Schema.Types.ObjectId, ref: "Department" },
    availability: {
      type: Schema.Types.Mixed,
      default: {},
    },
    weeklySchedule: { type: DoctorWeeklyScheduleSchema, default: {} },
    appointmentDuration: { type: Number, default: 30 },
    leaves: [DoctorLeaveSchema],
    bio: { type: String },
    languages: [{ type: String }],
    isAvailable: { type: Boolean, default: true },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
  },
  { timestamps: true }
);

DoctorSchema.pre("save", async function () {
  if (!this.doctorId) {
    const { getNextDoctorId } = await import("./counter.model");
    this.doctorId = await getNextDoctorId();
  }
});

// ─── APPOINTMENT MODEL ────────────────────────────────────
export interface IAppointment extends Document {
  appointmentId: string;
  patient: mongoose.Types.ObjectId;
  doctor: mongoose.Types.ObjectId;
  department?: mongoose.Types.ObjectId;
  type: string;
  status: string;
  scheduledDate: Date;
  scheduledTime: string;
  duration: number;
  chiefComplaint?: string;
  notes?: string;
  cancellationReason?: string;
  checkedInAt?: Date;
  completedAt?: Date;
  consultationFee: number;
  isPaid: boolean;
  /** Queue token for live OPD/waiting-room displays */
  queueNumber?: number;
  queueDate?: Date;
  createdBy: mongoose.Types.ObjectId;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    appointmentId: { type: String, unique: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    department: { type: Schema.Types.ObjectId, ref: "Department" },
    type: { type: String, enum: ["opd", "follow_up", "emergency", "teleconsultation"], default: "opd" },
    status: {
      type: String,
      enum: ["scheduled", "checked_in", "in_consultation", "completed", "cancelled", "no_show", "archived"],
      default: "scheduled",
      index: true,
    },
    scheduledDate: { type: Date, required: true, index: true },
    scheduledTime: { type: String, required: true },
    duration: { type: Number, default: 30 },
    chiefComplaint: { type: String },
    notes: { type: String },
    cancellationReason: { type: String },
    checkedInAt: { type: Date },
    completedAt: { type: Date },
    consultationFee: { type: Number, default: 0 },
    isPaid: { type: Boolean, default: false },
    queueNumber: { type: Number, index: true },
    queueDate: { type: Date, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

AppointmentSchema.pre("save", async function () {
  if (!this.appointmentId) {
    const count = await mongoose.models.Appointment.countDocuments();
    this.appointmentId = `APT-${String(count + 1).padStart(6, "0")}`;
  }
});

// Compound index for fast per-doctor, per-day queue queries
AppointmentSchema.index({ doctor: 1, queueDate: 1, status: 1 });

// Database-level unique partial index to prevent double bookings & race conditions
AppointmentSchema.index(
  { doctor: 1, scheduledDate: 1, scheduledTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["scheduled", "checked_in", "in_consultation", "completed"] },
    },
  }
);

// ─── EMR MODEL ────────────────────────────────────────────
export interface IEMR extends Document {
  patient: mongoose.Types.ObjectId;
  appointment?: mongoose.Types.ObjectId;
  doctor: mongoose.Types.ObjectId;
  visitDate: Date;
  status: string;
  chiefComplaint: string;
  symptoms?: string[];
  vitals?: {
    temperature?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weight?: number;
    height?: number;
    bmi?: number;
    bloodSugar?: number;
  };
  diagnosis: {
    icdCode?: string;
    description: string;
    type: "primary" | "secondary";
  }[];
  treatmentPlan?: string;
  notes?: string;
  followUpDate?: Date;
  attachments?: Array<{ name?: string; url?: string; publicId?: string; fileType?: string }>;
  createdBy: mongoose.Types.ObjectId; // ← ADD THIS
}

const EMRSchema = new Schema<IEMR>(
  {
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    appointment: { type: Schema.Types.ObjectId, ref: "Appointment" },
    doctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true },
    visitDate: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    chiefComplaint: { type: String, required: true },
    symptoms: [{ type: String }],
    vitals: {
      temperature: Number,
      bloodPressureSystolic: Number,
      bloodPressureDiastolic: Number,
      heartRate: Number,
      respiratoryRate: Number,
      oxygenSaturation: Number,
      weight: Number,
      height: Number,
      bmi: Number,
      bloodSugar: Number,
    },
    diagnosis: [
      {
        icdCode: String,
        description: { type: String },
        type: { type: String, enum: ["primary", "secondary"], default: "primary" },
      },
    ],
    treatmentPlan: { type: String },
    notes: { type: String },
    followUpDate: { type: Date },
    attachments: [AttachmentSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, // ← ADD THIS
  },
  { timestamps: true }
);

EMRSchema.index({ patient: 1, visitDate: -1 });

// ─── PRESCRIPTION MODEL ───────────────────────────────────
export interface IPrescription extends Document {
  prescriptionId: string;
  patient: mongoose.Types.ObjectId;
  doctor: mongoose.Types.ObjectId;
  emr?: mongoose.Types.ObjectId;
  appointment?: mongoose.Types.ObjectId;
  medicines: {
    medicineName: string;
    genericName?: string;
    strength: string; // e.g., 500mg, 10mg
    dosage: string; // e.g., 1 tablet, 5ml
    frequency: string; // e.g., Twice daily, Once daily
    duration: string; // e.g., 5 days, 2 weeks
    durationDays?: number; // Numeric duration for calculations
    route: "oral" | "iv" | "im" | "topical" | "inhalation" | "sublingual" | "rectal" | "other";
    instructions?: string;
    quantity?: number; // Total quantity to dispense
    isRefillable?: boolean;
    refillsRemaining?: number;
  }[];
  notes?: string;
  status: "draft" | "active" | "dispensed" | "partially_dispensed" | "expired" | "cancelled" | "completed" | "archived";
  type: "new" | "refill" | "renewal";
  duration: {
    value: number;
    unit: "days" | "weeks" | "months";
  };
  allergies: string[]; // Track patient allergies for safety
  safetyChecks: {
    allergenChecked: boolean;
    interactionsChecked: boolean;
    checkedBy: mongoose.Types.ObjectId;
    checkedAt: Date;
  };
  dispensedBy?: mongoose.Types.ObjectId;
  dispensedAt?: Date;
  dispensedItems?: {
    medicine: string;
    quantity: number;
    batchNo?: string;
    expiryDate?: Date;
  }[];
  prescribedDate: Date;
  validUntil: Date;
  createdBy: mongoose.Types.ObjectId;
}

const PrescriptionSchema = new Schema<IPrescription>(
  {
    prescriptionId: { type: String, unique: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    emr: { type: Schema.Types.ObjectId, ref: "EMR" },
    appointment: { type: Schema.Types.ObjectId, ref: "Appointment" },
    medicines: [
      {
        medicineName: { type: String, required: true },
        genericName: String,
        strength: String,
        dosage: { type: String, required: true },
        frequency: { type: String, required: true },
        duration: String,
        durationDays: Number,
        route: { type: String, enum: ["oral", "iv", "im", "topical", "inhalation", "sublingual", "rectal", "other"], default: "oral" },
        instructions: String,
        quantity: Number,
        isRefillable: { type: Boolean, default: false },
        refillsRemaining: { type: Number, default: 0 },
      },
    ],
    notes: String,
    status: { type: String, enum: ["draft", "active", "dispensed", "partially_dispensed", "expired", "cancelled", "completed", "archived"], default: "active", index: true },
    type: { type: String, enum: ["new", "refill", "renewal"], default: "new" },
    duration: {
      value: { type: Number, required: true },
      unit: { type: String, enum: ["days", "weeks", "months"], required: true },
    },
    allergies: [{ type: String }],
    safetyChecks: {
      allergenChecked: { type: Boolean, default: false },
      interactionsChecked: { type: Boolean, default: false },
      checkedBy: { type: Schema.Types.ObjectId, ref: "User" },
      checkedAt: Date,
    },
    dispensedBy: { type: Schema.Types.ObjectId, ref: "User" },
    dispensedAt: Date,
    dispensedItems: [
      {
        medicine: String,
        quantity: Number,
        batchNo: String,
        expiryDate: Date,
      },
    ],
    prescribedDate: { type: Date, default: Date.now },
    validUntil: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

PrescriptionSchema.pre("save", async function () {
  if (!this.prescriptionId) {
    const count = await mongoose.models.Prescription.countDocuments();
    this.prescriptionId = `RX-${String(count + 1).padStart(6, "0")}`;
  }
});



// ─── EXPORT MODELS ────────────────────────────────────────
export const Department = getModel<IDepartment>("Department", DepartmentSchema);
export const Patient = getModel<IPatient>("Patient", PatientSchema);
export const Doctor = getModel<IDoctor>("Doctor", DoctorSchema);
export const Appointment = getModel<IAppointment>("Appointment", AppointmentSchema);
export const EMR = getModel<IEMR>("EMR", EMRSchema);
export const Prescription = getModel<IPrescription>("Prescription", PrescriptionSchema);