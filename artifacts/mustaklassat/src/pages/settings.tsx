import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { User, Mail, Phone, Building, Calendar, ShieldCheck } from "lucide-react";

export default function Settings() {
  const { data: user, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey() }
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">جاري التحميل...</div>;
  }

  if (!user) {
    return <div>خطأ في تحميل البيانات</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">إعدادات الحساب</h1>
        <p className="text-muted-foreground">إدارة معلومات حسابك الشخصي</p>
      </div>

      <Card className="border-border shadow-sm overflow-hidden">
        <div className="bg-primary/5 h-24 w-full"></div>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-10 mb-6">
            <Avatar className="h-24 w-24 border-4 border-card shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1 mb-2">
              <h2 className="text-2xl font-bold">{user.name}</h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-medium">
                  {user.role === "admin" ? "مدير نظام" : "مستخدم"}
                </Badge>
                <Badge variant="outline" className="text-green-600 border-green-600/30">
                  حساب معتمد
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-md text-muted-foreground">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">الاسم الكامل</p>
                  <p className="text-sm text-muted-foreground mt-1">{user.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-md text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">البريد الإلكتروني</p>
                  <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-md text-muted-foreground">
                  <Building className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">الشركة</p>
                  <p className="text-sm text-muted-foreground mt-1">{user.company || "غير محدد"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-md text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">تاريخ الانضمام</p>
                  <p className="text-sm text-muted-foreground mt-1">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm bg-primary/5">
        <CardContent className="pt-6 flex gap-4">
          <ShieldCheck className="h-8 w-8 text-primary shrink-0" />
          <div>
            <h3 className="font-semibold mb-1 text-primary">حماية البيانات والموثوقية</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              هذا الحساب مرتبط بهويتك كمستخدم في النظام. جميع التعديلات والإضافات على المستخلصات والمشاريع مسجلة في النظام لضمان الموثوقية وشفافية المراجعة المالية.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}