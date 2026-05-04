import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { ShieldAlert, Search, RefreshCw, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface AuditEntry {
  id: number;
  userId: number | null;
  userEmail: string | null;
  userName: string | null;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditResponse {
  logs: AuditEntry[];
  total: number;
  page: number;
  limit: number;
}

async function fetchAudit(token: string, page: number): Promise<AuditResponse> {
  const res = await fetch(`/api/audit?page=${page}&limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch audit log");
  return res.json();
}

function actionColor(action: string) {
  if (action.includes("موافقة") || action.includes("تفعيل")) return "text-green-700 bg-green-50 border-green-200";
  if (action.includes("رفض") || action.includes("تعطيل")) return "text-red-700 bg-red-50 border-red-200";
  if (action.includes("صلاحية") || action.includes("دور")) return "text-blue-700 bg-blue-50 border-blue-200";
  if (action.includes("تسجيل دخول")) return "text-purple-700 bg-purple-50 border-purple-200";
  return "text-gray-700 bg-gray-50 border-gray-200";
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-SA", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function AuditLog() {
  const { getToken } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery<AuditResponse>({
    queryKey: ["/api/audit", page],
    queryFn: async () => {
      const token = await getToken();
      return fetchAudit(token!, page);
    },
    refetchInterval: 30_000,
  });

  const filtered = (data?.logs || []).filter(l =>
    !search ||
    l.action.includes(search) ||
    l.userName?.includes(search) ||
    l.userEmail?.includes(search) ||
    l.details?.includes(search)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500" style={{ direction: "rtl" }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" style={{ color: "#1e3c72" }}>
            <ShieldAlert className="h-8 w-8" style={{ color: "#d4af37" }} />
            سجل المراقبة والمتابعة
          </h1>
          <p className="text-gray-500 mt-1">جميع الإجراءات المسجّلة في النظام — {data?.total ?? 0} إجراء</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="بحث بالإجراء، الاسم، البريد..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: "#e8edf7" }}>
        <table className="w-full text-sm">
          <thead style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" }}>
            <tr>
              <th className="text-right px-4 py-3 font-semibold">الإجراء</th>
              <th className="text-right px-4 py-3 font-semibold">المستخدم</th>
              <th className="text-right px-4 py-3 font-semibold">التفاصيل</th>
              <th className="text-right px-4 py-3 font-semibold">IP</th>
              <th className="text-right px-4 py-3 font-semibold">التاريخ والوقت</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">لا توجد سجلات</td></tr>
            ) : (
              filtered.map((log, i) => (
                <tr key={log.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} style={{ borderBottom: "1px solid #f0f2f8" }}>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-800">{log.userName || "—"}</div>
                        <div className="text-gray-400 text-xs">{log.userEmail || ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    <span className="truncate block">{log.details || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{log.ipAddress || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(log.createdAt)}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > 50 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            السابق
          </Button>
          <span className="text-sm text-gray-500">صفحة {page} من {Math.ceil(data.total / 50)}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(data.total / 50)}>
            التالي
          </Button>
        </div>
      )}
    </div>
  );
}
