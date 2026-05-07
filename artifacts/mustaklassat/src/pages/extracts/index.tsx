import { Link } from "wouter";
import { useListExtracts, getListExtractsQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function ExtractsList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { data, isLoading } = useListExtracts(
    { status: statusFilter !== "all" ? statusFilter as any : undefined },
    { query: { queryKey: getListExtractsQueryKey({ status: statusFilter !== "all" ? statusFilter as any : undefined }) } }
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">المستخلصات</h1>
          <p className="text-muted-foreground">إدارة وتتبع المستخلصات المالية للمشاريع</p>
        </div>
        <Link href="/extracts/new">
          <Button className="font-bold">
            <Plus className="ml-2 h-4 w-4" />
            إضافة مستخلص
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="بحث برقم المستخلص..." 
            className="pr-9 w-full bg-background"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-background">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="حالة المستخلص" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="current">جارية</SelectItem>
              <SelectItem value="completed">مكتملة</SelectItem>
              <SelectItem value="previous">سابقة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold text-right">رقم المستخلص</TableHead>
              <TableHead className="font-bold text-right">المشروع</TableHead>
              <TableHead className="font-bold text-right">المبلغ</TableHead>
              <TableHead className="font-bold text-right">الحالة</TableHead>
              <TableHead className="font-bold text-right">التاريخ</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            ) : data?.extracts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  لا توجد مستخلصات
                </TableCell>
              </TableRow>
            ) : (
              data?.extracts?.map((extract) => (
                <TableRow key={extract.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">{extract.extractNumber}</TableCell>
                  <TableCell>{extract.projectName || "بدون مشروع"}</TableCell>
                  <TableCell className="font-bold">{formatCurrency(extract.amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`font-medium ${getStatusColor(extract.status)}`}>
                      {getStatusLabel(extract.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(extract.createdAt)}
                  </TableCell>
                  <TableCell className="text-left">
                    <Link href={`/extracts/${extract.id}`}>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        عرض التفاصيل
                      </Button>
                    </Link>
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