// components/ui/index.tsx
"use client";

import { cn } from "@/lib/utils";
import { X, AlertCircle, CheckCircle, Info, AlertTriangle, Sun, Moon } from "lucide-react";
import { useState, useEffect, createContext, useContext, ReactNode } from "react";

// ─── BADGE ────────────────────────────────────────────────
type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "outline";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
  success: "bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800/50",
  warning: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50",
  danger: "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200/50 dark:border-red-800/50",
  info: "bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-800/30",
  outline: "border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide transition-colors",
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── STATUS BADGE ─────────────────────────────────────────
const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: "Active", variant: "success" },
  inactive: { label: "Inactive", variant: "default" },
  suspended: { label: "Suspended", variant: "warning" },
  locked: { label: "Locked", variant: "danger" },
  scheduled: { label: "Scheduled", variant: "info" },
  checked_in: { label: "Checked In", variant: "info" },
  in_consultation: { label: "In Consultation", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
  no_show: { label: "No Show", variant: "default" },
  paid: { label: "Paid", variant: "success" },
  partial: { label: "Partial", variant: "warning" },
  pending: { label: "Pending", variant: "warning" },
  overdue: { label: "Overdue", variant: "danger" },
  draft: { label: "Draft", variant: "default" },
  refunded: { label: "Refunded", variant: "info" },
  sample_collected: { label: "Sample Collected", variant: "info" },
  processing: { label: "Processing", variant: "warning" },
  delivered: { label: "Delivered", variant: "success" },
  archived: { label: "Archived", variant: "default" },
  deceased: { label: "Deceased", variant: "danger" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, variant: "default" as BadgeVariant };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ─── CARD ─────────────────────────────────────────────────
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs transition-colors", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("px-5 py-4 border-b border-gray-200 dark:border-gray-800", className)}>{children}</div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

// ─── STAT CARD ────────────────────────────────────────────
export function StatCard({
  title,
  value,
  icon: Icon,
  loading = false,
}: {
  title: string;
  value: string | number | null;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; label: string };
  loading?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide uppercase">{title}</p>
          {loading ? (
            <div className="mt-2 h-7 w-20 bg-gray-100 dark:bg-gray-800 rounded-md animate-pulse" />
          ) : (
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {value ?? "—"}
            </p>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

// ─── TABLE ────────────────────────────────────────────────
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <table className={cn("w-full text-xs text-left", className)}>{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn("px-4 py-3.5 text-xs text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-gray-800/60 transition-colors", className)}>
      {children}
    </td>
  );
}

// ─── MODAL ────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizeMap = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs cursor-pointer transition-opacity" onClick={onClose} />
      <div
        className={cn(
          "relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full flex flex-col max-h-[90vh] shadow-2xl z-10 transition-all",
          sizeMap[size]
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── FORM FIELD ───────────────────────────────────────────
export function FormField({
  label,
  error,
  required,
  children,
  hint,
}: {
  label: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1 font-medium"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</p>}
    </div>
  );
}

// ─── INPUT ────────────────────────────────────────────────
export function Input({
  className,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={cn(
        "w-full px-3.5 py-2.5 rounded-xl border text-xs text-gray-800 dark:text-gray-100 placeholder:text-gray-400 transition-all duration-200",
        "focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20",
        "disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400",
        error ? "border-red-400 bg-red-50/50 dark:bg-red-950/20 text-red-900 dark:text-red-100" : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/80",
        className
      )}
      {...props}
    />
  );
}

// ─── SELECT ───────────────────────────────────────────────
export function Select({
  className,
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select
      className={cn(
        "w-full px-3.5 py-2.5 rounded-xl border text-xs text-gray-800 dark:text-gray-100 cursor-pointer transition-all duration-200",
        "focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20",
        "disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400",
        error ? "border-red-400 bg-red-50/50 dark:bg-red-950/20 text-red-900 dark:text-red-100" : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/80",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

// ─── BUTTON ───────────────────────────────────────────────
type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";

const btnVariants: Record<ButtonVariant, string> = {
  primary: "bg-teal-600 hover:bg-teal-700 text-white cursor-pointer shadow-xs",
  secondary: "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer",
  danger: "bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-xs",
  ghost: "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer",
  outline: "border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const sizeMap = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-xs", lg: "px-5 py-3 text-xs sm:text-sm" };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98]",
        "focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100",
        btnVariants[variant],
        sizeMap[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
        <Info className="w-5 h-5 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      {description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ─── LOADING SKELETON ─────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse", className)} />;
}

// ─── ALERT ────────────────────────────────────────────────
type AlertType = "info" | "success" | "warning" | "error";
const alertConfig: Record<AlertType, { icon: ReactNode; classes: string }> = {
  info: { icon: <Info className="w-4 h-4" />, classes: "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/60 text-teal-800 dark:text-teal-200" },
  success: { icon: <CheckCircle className="w-4 h-4" />, classes: "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/60 text-teal-800 dark:text-teal-200" },
  warning: { icon: <AlertTriangle className="w-4 h-4" />, classes: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200" },
  error: { icon: <AlertCircle className="w-4 h-4" />, classes: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-200" },
};

export function Alert({ type = "info", children }: { type?: AlertType; children: ReactNode }) {
  const c = alertConfig[type];
  return (
    <div className={cn("flex items-start gap-2.5 p-3.5 rounded-xl border text-xs font-medium", c.classes)}>
      <span className="shrink-0 mt-0.5">{c.icon}</span>
      <span>{children}</span>
    </div>
  );
}

// ─── TOAST ────────────────────────────────────────────────
interface Toast { id: string; type: AlertType; message: string }

const ToastContext = createContext<{ toast: (type: AlertType, msg: string) => void } | null>(null);

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const addToast = (type: AlertType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => remove(id), 4000);
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-100 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((t) => {
          const c = alertConfig[t.type];
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-start gap-2.5 p-3.5 rounded-xl border text-xs shadow-lg transition-all duration-200",
                c.classes
              )}
            >
              <span className="shrink-0">{c.icon}</span>
              <span className="flex-1">{t.message}</span>
              <button onClick={() => remove(t.id)} className="shrink-0 opacity-60 hover:opacity-100 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx?.toast ?? (() => { });
}

// ─── PAGINATION ───────────────────────────────────────────
export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-1.5">
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer transition-colors"
      >
        Previous
      </button>
      <span className="text-xs text-gray-500 dark:text-gray-400 px-2 font-medium">
        {page} / {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer transition-colors"
      >
        Next
      </button>
    </div>
  );
}

// ─── THEME TOGGLE (NYRON SPECIFICATION) ───────────────────
export function ThemeToggle({
  isDark,
  onToggle,
  className,
}: {
  isDark: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-pressed={isDark}
      aria-label="Toggle dark mode"
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full p-0.5 border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
        className
      )}
    >
      <span className="sr-only">Toggle dark mode</span>
      <span
        className={cn(
          "pointer-events-none inline-flex h-5.5 w-5.5 transform rounded-full bg-white dark:bg-gray-900 shadow-md ring-0 transition-transform duration-300 ease-in-out items-center justify-center",
          isDark ? "translate-x-6" : "translate-x-0"
        )}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-teal-400" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        )}
      </span>
    </button>
  );
}

// ─── POWERED BY NYRON BADGE ───────────────────────────────
export function PoweredByNyron({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 font-medium select-none", className)}>
      <span>Powered By</span>
      <a
        href="https://nyron-x.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
        title="NYRON"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/NYRONDARK.svg"
          alt="NYRON"
          className="h-4.5 w-auto dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/NYRONLIGHT.svg"
          alt="NYRON"
          className="h-4.5 w-auto hidden dark:block"
        />
      </a>
    </div>
  );
}