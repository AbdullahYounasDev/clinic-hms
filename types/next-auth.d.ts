import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      fullName: string;
      accountType: "staff" | "patient";
      /** Staff-only */
      role?: string;
      roleSlug?: string;
      permissions?: string[];
      isSuperAdmin?: boolean;
      /** Patient-only */
      patientDisplayId?: string;
      phone?: string;
      avatar?: string;
      status: string;
      mustChangePassword: boolean;
    };
  }
  interface JWT {
    id: string;
    fullName: string;
    accountType: "staff" | "patient";
    role?: string;
    roleSlug?: string;
    permissions?: string[];
    isSuperAdmin?: boolean;
    patientDisplayId?: string;
    phone?: string;
    avatar?: string;
    status: string;
    mustChangePassword: boolean;
  }
}
