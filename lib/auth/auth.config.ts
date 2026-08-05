import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db/mongoose";
import { User } from "@/models/user.model";
import { Patient } from "@/models/clinical.model";
import { auditLog } from "@/lib/auth/audit";
import { findPortalPatientByLogin } from "@/lib/auth/patient-portal";

function extractPermissions(role: unknown): string[] {
  const roleRecord = role as Record<string, unknown> | null | undefined;
  if (!Array.isArray(roleRecord?.permissions)) return [];
  return (roleRecord.permissions as Record<string, string>[]).map(
    (permission) => `${permission.module}:${permission.action}`
  );
}

async function syncStaffTokenFromDb(token: Record<string, unknown>) {
  token.accountType = "staff";
  await connectDB();
  const dbUser = await User.findById(token.id)
    .populate({ path: "role", populate: { path: "permissions" } })
    .lean();

  if (!dbUser) {
    token.status = "inactive";
    token.permissions = [];
    token.isSuperAdmin = false;
    return token;
  }

  const role = dbUser.role as Record<string, unknown> | null | undefined;

  token.status = dbUser.status;
  token.mustChangePassword = dbUser.mustChangePassword;
  token.isSuperAdmin = dbUser.isSuperAdmin;
  token.role = role ? (role as { name: string }).name : undefined;
  token.roleSlug = role ? (role as { slug: string }).slug : undefined;
  token.permissions = extractPermissions(role);
  token.fullName = `${dbUser.firstName} ${dbUser.lastName}`;

  return token;
}

async function syncPatientTokenFromDb(token: Record<string, unknown>) {
  token.accountType = "patient";
  await connectDB();
  const patient = await Patient.findById(token.id).lean();

  if (!patient || patient.status !== "active" || !patient.portalEnabled) {
    token.status = "inactive";
    return token;
  }

  token.status = "active";
  token.mustChangePassword = patient.mustChangePassword;
  token.fullName = `${patient.firstName} ${patient.lastName}`;
  token.patientDisplayId = patient.patientId;
  token.phone = patient.phone;
  token.email = patient.email;

  return token;
}

async function syncTokenFromDb(token: Record<string, unknown>) {
  if (token.accountType === "patient") {
    return syncPatientTokenFromDb(token);
  }
  return syncStaffTokenFromDb(token);
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Staff",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        await connectDB();
        const user = await User.findOne({ email: credentials.email })
          .select("+password")
          .populate({ path: "role", populate: { path: "permissions" } })
          .lean();

        if (!user) {
          throw new Error("No account found with this email");
        }

        if (user.status === "inactive" || user.status === "suspended" || user.status === "archived") {
          throw new Error("Your account is not active. Contact admin.");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password as string);

        if (!isValid) {
          throw new Error("Invalid password");
        }

        const role = user.role as Record<string, unknown>;
        const permissions = extractPermissions(role);

        return {
          id: user._id.toString(),
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          fullName: `${user.firstName} ${user.lastName}`,
          accountType: "staff",
          role: (role as { name: string }).name,
          roleSlug: (role as { slug: string }).slug,
          permissions,
          isSuperAdmin: user.isSuperAdmin,
          status: user.status,
          mustChangePassword: user.mustChangePassword,
        } as Record<string, unknown>;
      },
    }),
    CredentialsProvider({
      id: "patient-credentials",
      name: "Patient Portal",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || (credentials as Record<string, string>)?.login || "").trim();
        if (!email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const patient = await findPortalPatientByLogin(email);

        if (!patient || !patient.password) {
          throw new Error("No portal account found. Contact the clinic.");
        }

        if (patient.status === "archived" || patient.status === "deceased") {
          throw new Error("Your portal access is not active. Contact the clinic.");
        }

        const isValid = await bcrypt.compare(credentials.password, patient.password as string);
        if (!isValid) {
          throw new Error("Invalid password");
        }

        await Patient.findByIdAndUpdate(patient._id, { lastLogin: new Date() });

        return {
          id: patient._id.toString(),
          email: patient.email || patient.phone,
          name: `${patient.firstName} ${patient.lastName}`,
          fullName: `${patient.firstName} ${patient.lastName}`,
          accountType: "patient",
          patientDisplayId: patient.patientId,
          phone: patient.phone,
          permissions: [],
          isSuperAdmin: false,
          role: "Patient",
          roleSlug: "patient",
          status: "active",
          mustChangePassword: patient.mustChangePassword,
        } as Record<string, unknown>;
      },
    }),
  ],
  events: {
    async signIn({ user }: { user: Record<string, unknown> & { id?: string; email?: string | null } }) {
      if (!user.id) return;
      const isPatient = user.accountType === "patient";
      await auditLog({
        userId: isPatient ? undefined : user.id,
        action: "login",
        module: isPatient ? "patient_portal" : "auth",
        description: isPatient
          ? `Patient logged in: ${user.patientDisplayId || user.email || user.id}`
          : `User logged in${user.email ? `: ${user.email}` : ""}`,
        resourceId: isPatient ? user.id : undefined,
        resourceType: isPatient ? "Patient" : undefined,
        status: "success",
      });
    },
    async signOut({ token }: { token?: Record<string, unknown> }) {
      const userId = token?.id as string | undefined;
      if (!userId) return;
      const isPatient = token?.accountType === "patient";
      await auditLog({
        userId: isPatient ? undefined : userId,
        action: "logout",
        module: isPatient ? "patient_portal" : "auth",
        description: isPatient ? `Patient logged out: ${token?.patientDisplayId || userId}` : "User logged out",
        resourceId: isPatient ? userId : undefined,
        resourceType: isPatient ? "Patient" : undefined,
        status: "success",
      });
    },
  },
  callbacks: {
    async jwt({ token, user }: { token: Record<string, unknown>; user?: Record<string, unknown> }) {
      if (user) {
        token.id = user.id;
        token.fullName = user.fullName;
        token.accountType = user.accountType || "staff";
        token.role = user.role;
        token.roleSlug = user.roleSlug;
        token.permissions = user.permissions;
        token.isSuperAdmin = user.isSuperAdmin;
        token.status = user.status;
        token.mustChangePassword = user.mustChangePassword;
        token.patientDisplayId = user.patientDisplayId;
        token.phone = user.phone;
      } else if (token.id) {
        await syncTokenFromDb(token);
      }

      return token;
    },
    async session({ session, token }: { session: Record<string, unknown>; token: Record<string, unknown> }) {
      const user = session.user as Record<string, unknown>;
      user.id = token.id;
      user.fullName = token.fullName;
      user.accountType = token.accountType || "staff";
      user.role = token.role;
      user.roleSlug = token.roleSlug;
      user.permissions = token.permissions;
      user.isSuperAdmin = token.isSuperAdmin;
      user.status = token.status;
      user.mustChangePassword = token.mustChangePassword;
      user.patientDisplayId = token.patientDisplayId;
      user.phone = token.phone;
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" as const, maxAge: 8 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};

export const auth = () => {
  return getServerSession(authOptions);
};
