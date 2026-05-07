import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function getStatusLabel(status: string) {
  switch (status) {
    case "current": return "جارية";
    case "completed": return "مكتملة";
    case "previous": return "سابقة";
    case "pending": return "معلقة";
    case "approved": return "مقبول";
    case "rejected": return "مرفوض";
    case "active": return "نشط";
    case "on_hold": return "متوقف";
    default: return status;
  }
}

export function getStatusColor(status: string) {
  switch (status) {
    case "current": return "text-primary border-primary/30 bg-primary/5";
    case "completed": return "text-green-600 border-green-600/30 bg-green-600/5";
    case "previous": return "text-gray-600 border-gray-600/30 bg-gray-600/5";
    default: return "text-gray-600 border-gray-600/30 bg-gray-600/5";
  }
}