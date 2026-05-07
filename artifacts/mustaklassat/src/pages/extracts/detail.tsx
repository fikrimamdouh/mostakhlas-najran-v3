import { useParams, Link, useLocation } from "wouter";
import { useGetExtract, useUpdateExtract, useDeleteExtract, getGetExtractQueryKey, getListExtractsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Trash2, Edit, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

export default function ExtractDetail() {
  const params = useParams();
  const extractId = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: extract, isLoading } = useGetExtract(extractId, {
    query: { queryKey: getGetExtractQueryKey(extractId), enabled: !!extractId }
  });

  const { mutate: updateExtract, isPending: isUpdating } = useUpdateExtract({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم التحديث", description: "تم تحديث حالة المستخلص بنجاح" });
        queryClient.invalidateQueries({ queryKey: getGetExtractQueryKey(extractId) });
        queryClient.invalidateQueries({ queryKey: getListExtractsQueryKey() });
      }
    }
  });

  const { mutate: deleteExtract, isPending: isDeleting } = useDeleteExtract({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم الحذف", description: "تم حذف المستخلص بنجاح" });
        queryClient.invalidateQueries({ queryKey: getListExtractsQueryKey() });
        setLocation("/extracts");
      }
    }
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">جاري تحميل التفاصيل...</div>;
  }

  if (!extract) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">لم يتم العثور على المستخلص</div>;
  }

  const markAsCompleted = () => {
    updateExtract({ 
      extractId, 
      data: { status: "completed", approvedAt: new Date().toISOString() } 
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/extracts">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">مستخلص #{extract.extractNumber}</h1>
              <Badge variant="outline" className={`font-medium ${getStatusColor(extract.status)}`}>
                {getStatusLabel(extract.status)}
              </Badge>
            </div>
            <p className="text-muted-foreground">{extract.projectName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {extract.status === "current" && (
            <Button 
              onClick={markAsCompleted} 
              disabled={isUpdating}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              اعتماد المستخلص
            </Button>
          )}
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                <AlertDialogDescription>
                  هذا الإجراء لا يمكن التراجع عنه. سيتم حذف المستخلص نهائياً من النظام.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => deleteExtract({ extractId })}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>التفاصيل المالية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted-foreground">قيمة المستخلص</span>
                <span className="text-4xl font-extrabold text-primary">{formatCurrency(extract.amount)}</span>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">المشروع</span>
                  <span className="font-medium">{extract.projectName || "غير محدد"}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">تاريخ الإنشاء</span>
                  <span className="font-medium">{formatDate(extract.createdAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>الوصف والملاحظات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-sm font-semibold block mb-2">الوصف:</span>
                <p className="text-sm text-foreground/80 leading-relaxed bg-muted/30 p-4 rounded-md border border-border/50">
                  {extract.description || "لا يوجد وصف"}
                </p>
              </div>
              <div>
                <span className="text-sm font-semibold block mb-2">ملاحظات داخلية:</span>
                <p className="text-sm text-foreground/80 leading-relaxed bg-muted/30 p-4 rounded-md border border-border/50">
                  {extract.notes || "لا توجد ملاحظات"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>سجل الاعتمادات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="mt-0.5 relative">
                    <div className="h-3 w-3 rounded-full bg-primary z-10 relative"></div>
                    <div className="absolute top-3 left-1.5 w-px h-full bg-border -ml-px"></div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">تم الإنشاء</p>
                    <p className="text-xs text-muted-foreground">{formatDate(extract.createdAt)}</p>
                  </div>
                </div>
                
                {extract.status === "completed" && (
                  <div className="flex gap-3">
                    <div className="mt-0.5 relative">
                      <div className="h-3 w-3 rounded-full bg-green-500 z-10 relative"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-700">تم الاعتماد</p>
                      <p className="text-xs text-muted-foreground">{extract.approvedAt ? formatDate(extract.approvedAt) : "تاريخ غير معروف"}</p>
                    </div>
                  </div>
                )}

                {extract.status === "current" && (
                  <div className="flex gap-3">
                    <div className="mt-0.5 relative">
                      <div className="h-3 w-3 rounded-full border-2 border-muted bg-background z-10 relative"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">بانتظار الاعتماد</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}