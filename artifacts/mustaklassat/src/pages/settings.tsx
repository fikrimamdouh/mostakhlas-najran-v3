import { useState } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth, useClerk, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import {
  User, Mail, Phone, Building2, Calendar,
  ShieldCheck, Edit2, Save, X, Key, LogOut, Lock, MapPin, Hash, Briefcase
} from "lucide-react";

const COMPANY_LABELS: Record<string, string> = {
  "بيت_العرب": "شركة مجموعة بيت العرب الحديثة المحدودة",
  "سراكو": "شركة سراكو",
};

function roleLabel(role: string) {
  if (role === "admin") return "🔑 مدير النظام";
  if (role === "supervisor") return "🔍 مدير مستخلصات";
  if (role === "contract_supervisor") return "📋 مشرف عقد";
  return "👤 مستخدم";
}

export default function Settings() {
  const { data: user, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { getToken } = useAuth();
  const { openUserProfile, signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", jobTitle: "" });

  const startEdit = () => {
    setForm({
      name: user?.name || "",
      phone: (user as any)?.phone || "",
      jobTitle: (user as any)?.jobTitle || "",
    });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "✅ تم الحفظ", description: "تم تحديث بياناتك بنجاح" });
        setEditing(false);
      } else {
        toast({ title: "خطأ", description: "فشل في حفظ البيانات", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ", description: "تعذّر الاتصال بالخادم", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">جاري التحميل...</div>
      </div>
    );
  }

  if (!user) return <div>خطأ في تحميل البيانات</div>;

  const companyKey = (user as any)?.company as string | undefined;
  const companyLabel = companyKey ? (COMPANY_LABELS[companyKey] || companyKey) : null;
  const hospital = (user as any)?.hospital as string | undefined;
  const jobTitle = (user as any)?.jobTitle as string | undefined;
  const contractNumber = (user as any)?.contractNumber as string | undefined;
  const phone = (user as any)?.phone as string | undefined;

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-500" style={{ direction: "rtl" }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#1e3c72" }}>إعدادات الحساب</h1>
          <p className="text-gray-500">إدارة معلومات ملفك الشخصي</p>
        </div>
        {!editing && (
          <Button onClick={startEdit} className="gap-2" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
            <Edit2 className="h-4 w-4" />
            تعديل البيانات
          </Button>
        )}
      </div>

      {/* Profile card */}
      <Card className="overflow-hidden border" style={{ borderColor: "#e8edf7" }}>
        <div className="h-28" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }} />
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-10 mb-6">
            <div className="relative">
              {clerkUser?.imageUrl ? (
                <img
                  src={clerkUser.imageUrl ?? undefined}
                  alt={user.name ?? undefined}
                  className="h-20 w-20 rounded-full object-cover shadow-lg border-4 border-white"
                />
              ) : (
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full text-white text-3xl font-bold shadow-lg border-4 border-white"
                  style={{ background: "linear-gradient(135deg,#d4af37,#b8962e)" }}
                >
                  {(user?.name || "م").charAt(0)}
                </div>
              )}
              <button
                onClick={() => openUserProfile()}
                className="absolute bottom-0 left-0 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-md"
                style={{ background: "#1e3c72" }}
                title="تغيير الصورة"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-1 mb-2">
              <h2 className="text-2xl font-bold" style={{ color: "#1e3c72" }}>{user.name}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={user.role === "admin" ? "bg-[#1e3c72] text-white" : "bg-gray-100 text-gray-700"}>
                  {roleLabel(user.role)}
                </Badge>
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                  ✓ حساب معتمد
                </Badge>
              </div>
            </div>
          </div>

          {!editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
              {/* Editable fields */}
              {[
                { icon: User, label: "الاسم الكامل", value: user.name },
                { icon: Mail, label: "البريد الإلكتروني", value: user.email },
                { icon: Phone, label: "رقم الهاتف", value: phone || "غير محدد" },
                { icon: Briefcase, label: "المسمى الوظيفي", value: jobTitle || "غير محدد" },
                { icon: Calendar, label: "تاريخ الانضمام", value: formatDate(user.createdAt) },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="p-2 rounded-lg" style={{ background: "#f0f2f8" }}>
                    <item.icon className="h-4 w-4" style={{ color: "#1e3c72" }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{item.label}</p>
                    <p className="text-sm mt-0.5 font-semibold text-gray-800">{item.value}</p>
                  </div>
                </div>
              ))}

              {/* Locked contract fields */}
              {(companyLabel || hospital || contractNumber) && (
                <div className="md:col-span-2 mt-2">
                  <div className="rounded-xl p-4 space-y-4" style={{ background: "#f8f9fe", border: "1px solid #e8edf7" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Lock className="h-4 w-4" style={{ color: "#1e3c72" }} />
                      <span className="text-sm font-bold" style={{ color: "#1e3c72" }}>بيانات العقد — (محمية / لا يمكن تعديلها)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {companyLabel && (
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg" style={{ background: "#e8edf7" }}>
                            <Building2 className="h-4 w-4" style={{ color: "#2a5298" }} />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500">الشركة المقاولة</p>
                            <p className="text-sm mt-0.5 font-bold" style={{ color: "#1e3c72" }}>{companyLabel}</p>
                          </div>
                        </div>
                      )}
                      {hospital && (
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg" style={{ background: "#e8edf7" }}>
                            <MapPin className="h-4 w-4" style={{ color: "#2a5298" }} />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500">المستشفى / الموقع</p>
                            <p className="text-sm mt-0.5 font-bold" style={{ color: "#1e3c72" }}>{hospital}</p>
                          </div>
                        </div>
                      )}
                      {contractNumber && (
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg" style={{ background: "#e8edf7" }}>
                            <Hash className="h-4 w-4" style={{ color: "#2a5298" }} />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500">رقم العقد</p>
                            <p className="text-sm mt-0.5 font-bold" style={{ color: "#1e3c72" }}>{contractNumber}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      لتغيير بيانات العقد، تواصل مع مدير النظام.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">الاسم الكامل</Label>
                  <Input id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input id="email" value={user.email} disabled className="bg-gray-50 text-gray-400" />
                  <p className="text-xs text-gray-400">لتغيير البريد استخدم إدارة الحساب</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input id="phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05XXXXXXXX" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">المسمى الوظيفي</Label>
                  <Input id="jobTitle" value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} placeholder="مهندس صيانة / محاسب / مشرف" />
                </div>
              </div>

              {/* Show locked fields as read-only during edit too */}
              {(companyLabel || hospital) && (
                <div className="rounded-xl p-4" style={{ background: "#f8f9fe", border: "1px dashed #c7d2e8" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500 font-medium">بيانات العقد — مقفلة (غير قابلة للتعديل)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {companyLabel && (
                      <div className="space-y-1">
                        <Label className="text-gray-400 text-xs">الشركة المقاولة</Label>
                        <Input value={companyLabel} disabled className="bg-gray-100 text-gray-500 text-sm" />
                      </div>
                    )}
                    {hospital && (
                      <div className="space-y-1">
                        <Label className="text-gray-400 text-xs">المستشفى / الموقع</Label>
                        <Input value={hospital} disabled className="bg-gray-100 text-gray-500 text-sm" />
                      </div>
                    )}
                    {contractNumber && (
                      <div className="space-y-1">
                        <Label className="text-gray-400 text-xs">رقم العقد</Label>
                        <Input value={contractNumber} disabled className="bg-gray-100 text-gray-500 text-sm" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button onClick={saveProfile} disabled={saving} style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }} className="gap-2 text-white">
                  <Save className="h-4 w-4" />
                  {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
                </Button>
                <Button variant="outline" onClick={cancelEdit} disabled={saving} className="gap-2">
                  <X className="h-4 w-4" />
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account actions */}
      <Card className="border" style={{ borderColor: "#e8edf7" }}>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-bold text-lg" style={{ color: "#1e3c72" }}>إجراءات الحساب</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={() => openUserProfile()}>
              <Key className="h-4 w-4" />
              تغيير كلمة السر وإعدادات الأمان
            </Button>
            <Button
              variant="outline"
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => { localStorage.removeItem("najran_session"); signOut(); }}
            >
              <LogOut className="h-4 w-4" />
              تسجيل الخروج
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security notice */}
      <Card className="border" style={{ borderColor: "#e8edf7", background: "#f8f9fe" }}>
        <CardContent className="pt-6 flex gap-4">
          <ShieldCheck className="h-8 w-8 shrink-0" style={{ color: "#1e3c72" }} />
          <div>
            <h3 className="font-semibold mb-1" style={{ color: "#1e3c72" }}>حماية البيانات والخصوصية</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              بياناتك مشفّرة ومحمية. بيانات العقد (الشركة والمستشفى) مقفلة ولا يمكن تعديلها إلا من مدير النظام لضمان دقة المستخلصات.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
