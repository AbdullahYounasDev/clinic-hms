import mongoose, { Schema, Document, Model } from "mongoose";
import connectDB from "@/lib/db/mongoose";

export interface ICounter extends Document {
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
