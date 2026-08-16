import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_ROUTES = [
  "/login",
  "/patient/login",
  "/forgot-password",
  "/reset-password",
  "/offline",
  "/clinic-bg.jpg",
  "logo.png",
];
const PUBLIC_API_ROUTES = ["/api/auth"];
const STAFF_PASSWORD_CHANGE_ALLOWED_API_PREFIXES = ["/api/profile/"];
const PATIENT_PASSWORD_CHANGE_ALLOWED_API_PREFIXES = ["/api/portal/change-password"];

const STAFF_ONLY_ROUTE_PREFIXES = [
  "/dashboard",
  "/patients",
  "/appointments",
  "/doctors",
  "/billing",
  "/lab",
  "/labcatalog",
  "/pharmacy",
  "/supplier",
  "/inventory",
  "/staff",
  "/reports",
  "/users",
  "/roles",
  "/audit-logs",
  "/expenses",
  "/opd",
  "/settings",
  "/profile",
  "/ai-assistant",
];

function isStaffPasswordChangeAllowedApi(pathname: string) {
  return STAFF_PASSWORD_CHANGE_ALLOWED_API_PREFIXES.some((route) => pathname.startsWith(route));
}

function isPatientPasswordChangeAllowedApi(pathname: string) {
  return PATIENT_PASSWORD_CHANGE_ALLOWED_API_PREFIXES.some((route) => pathname.startsWith(route));
}

async function getSessionToken(req: NextRequest) {
  return getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
    secureCookie: process.env.NODE_ENV === "production",
  });
}

function redirectToLogin(req: NextRequest, pathname: string, error?: string) {
  const isStaffPath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/patients") ||
    pathname.startsWith("/appointments") ||
    pathname.startsWith("/doctors") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/lab") ||
    pathname.startsWith("/pharmacy") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/roles") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/expenses") ||
    pathname.startsWith("/opd") ||
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/supplier") ||
    pathname.startsWith("/audit-logs") ||
    pathname === "/login";

  const loginUrl = new URL(isStaffPath ? "/login" : "/patient/login", req.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  if (error) loginUrl.searchParams.set("error", error);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    const token = await getSessionToken(req);
    if (token) {
      const home = token.accountType === "patient" ? "/portal" : "/dashboard";
      return NextResponse.redirect(new URL(home, req.url));
    }
    return NextResponse.next();
  }

  const token = await getSessionToken(req);

  if (!token) {
    return redirectToLogin(req, pathname);
  }

  const accountType = (token.accountType as string) || "staff";

  if (token.status && token.status !== "active") {
    return redirectToLogin(req, pathname, "account_inactive");
  }

  // ─── Patient portal session ─────────────────────────────
  if (accountType === "patient") {
    if (
      pathname.startsWith("/portal") === false &&
      pathname.startsWith("/api/portal") === false &&
      !pathname.startsWith("/api/auth")
    ) {
      return NextResponse.redirect(new URL("/portal", req.url));
    }

    if (
      token.mustChangePassword &&
      !pathname.startsWith("/portal/change-password") &&
      !pathname.startsWith("/api/portal/change-password") &&
      !pathname.startsWith("/api/auth")
    ) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: "Password change required before accessing this resource" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/portal/change-password", req.url));
    }

    if (
      token.mustChangePassword &&
      pathname.startsWith("/api/") &&
      !isPatientPasswordChangeAllowedApi(pathname) &&
      !pathname.startsWith("/api/auth")
    ) {
      return NextResponse.json(
        { success: false, error: "Password change required before accessing this resource" },
        { status: 403 }
      );
    }

    return NextResponse.next();
  }

  // ─── Staff session — block patient portal ───────────────
  if (pathname.startsWith("/portal") || pathname.startsWith("/api/portal")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (
    token.mustChangePassword &&
    !pathname.startsWith("/profile") &&
    !pathname.startsWith("/api/")
  ) {
    return NextResponse.redirect(new URL("/profile", req.url));
  }

  if (
    token.mustChangePassword &&
    pathname.startsWith("/api/") &&
    !isStaffPasswordChangeAllowedApi(pathname)
  ) {
    return NextResponse.json(
      { success: false, error: "Password change required before accessing this resource" },
      { status: 403 }
    );
  }

  const isSuperAdmin = token.isSuperAdmin as boolean;
  const permissions = (token.permissions as string[]) || [];

  if (!isSuperAdmin) {
    const ROUTE_PERMISSIONS: Record<string, string> = {
      "/patients": "patients:view",
      "/appointments": "appointments:view",
      "/doctors": "doctors:view",
      "/billing": "billing:view",
      "/lab": "lab:view",
      "/labcatalog": "labcatalog:view",
      "/pharmacy": "pharmacy:view",
      "/supplier": "supplier:view",
      "/inventory": "inventory:view",
      "/staff": "staff:view",
      "/reports": "reports:view",
      "/users": "users:view",
      "/roles": "roles:view",
      "/audit-logs": "audit_logs:view",
      "/expenses": "expenses:view",
      "/opd": "emr:view",
      "/settings": "settings:view",
      "/ai-assistant": "ai_assistant:view",
    };

    for (const [route, perm] of Object.entries(ROUTE_PERMISSIONS)) {
      if (pathname.startsWith(route)) {
        if (!permissions.includes(perm)) {
          return NextResponse.redirect(new URL("/dashboard?error=forbidden", req.url));
        }
        break;
      }
    }

    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
      const API_PERMISSIONS: Record<string, string> = {
        "/api/patients": "patients:view",
        "/api/appointments": "appointments:view",
        "/api/doctors": "doctors:view",
        "/api/billing": "billing:view",
        "/api/invoice": "billing:view",
        "/api/lab": "lab:view",
        "/api/labcatalog": "labcatalog:view",
        "/api/pharmacy": "pharmacy:view",
        "/api/supplier": "supplier:view",
        "/api/inventory": "inventory:view",
        "/api/staff": "staff:view",
        "/api/users": "users:view",
        "/api/roles": "roles:view",
        "/api/audit-logs": "audit_logs:view",
        "/api/reports": "reports:view",
        "/api/expenses": "expenses:view",
        "/api/emr": "emr:view",
        "/api/opd": "emr:view",
        "/api/prescriptions": "prescriptions:view",
        "/api/settings": "settings:view",
        "/api/ai": "ai_assistant:view",
        "/api/notifications": "",
      };

      for (const [route, perm] of Object.entries(API_PERMISSIONS)) {
        if (pathname.startsWith(route)) {
          if (perm && !permissions.includes(perm)) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
          }
          break;
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.jpg|.*\\.png|.*\\.svg|.*\\.webmanifest).*)"],
};
