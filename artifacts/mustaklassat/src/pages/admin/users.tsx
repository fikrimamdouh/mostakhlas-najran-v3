import { useListUsers, useApproveUser, useRejectUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListUsers(undefined, {
    query: { queryKey: getListUsersQueryKey() }
  });

  const { mutate: approveUser, isPending: isApproving } = useApproveUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم", description: "تمت الموافقة على المستخدم" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      }
    }
  });

  const { mutate: rejectUser, isPending: isRejecting } = useRejectUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم", description: "تم رفض المستخدم" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      }
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ShieldAlert className="h-8 w-8 text-primary" />
          إدارة المستخدمين
        </h1>
        <p className="text-muted-foreground">صلاحيات المدير: الموافقة على الحسابات الجديدة</p>
      </div>

      <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold text-right">الاسم</TableHead>
              <TableHead className="font-bold text-right">البريد الإلكتروني</TableHead>
              <TableHead className="font-bold text-right">تاريخ التسجيل</TableHead>
              <TableHead className="font-bold text-right">الحالة</TableHead>
              <TableHead className="font-bold text-center">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            ) : data?.users?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  لا يوجد مستخدمين
                </TableCell>
              </TableRow>
            ) : (
              data?.users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      user.status === "approved" ? "text-green-600 border-green-600/30" :
                      user.status === "rejected" ? "text-destructive border-destructive/30" :
                      "text-amber-600 border-amber-600/30"
                    }>
                      {user.status === "approved" ? "مقبول" :
                       user.status === "rejected" ? "مرفوض" : "معلق"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {user.status === "pending" && (
                      <div className="flex items-center justify-center gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => approveUser({ userId: user.id.toString() })}
                          disabled={isApproving || isRejecting}
                          className="bg-green-600 hover:bg-green-700 text-white h-8"
                        >
                          <Check className="ml-1 h-4 w-4" />
                          موافقة
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => rejectUser({ userId: user.id.toString() })}
                          disabled={isApproving || isRejecting}
                          className="h-8"
                        >
                          <X className="ml-1 h-4 w-4" />
                          رفض
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}