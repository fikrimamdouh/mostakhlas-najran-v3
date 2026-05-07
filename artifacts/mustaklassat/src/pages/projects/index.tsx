import { Link } from "wouter";
import { useListProjects, getListProjectsQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, MapPin, Calendar, CheckCircle2, Clock, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ProjectsList() {
  const { data, isLoading } = useListProjects({
    query: { queryKey: getListProjectsQueryKey() }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">المشاريع</h1>
          <p className="text-muted-foreground">إدارة المشاريع الإنشائية وعقودها</p>
        </div>
        <Link href="/projects/new">
          <Button className="font-bold">
            <Plus className="ml-2 h-4 w-4" />
            إضافة مشروع
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="بحث باسم المشروع..." 
            className="pr-9 max-w-md bg-background"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          جاري التحميل...
        </div>
      ) : data?.projects?.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed rounded-lg bg-card/50">
          <p className="text-muted-foreground mb-4">لا توجد مشاريع مسجلة حالياً</p>
          <Link href="/projects/new">
            <Button variant="outline">إضافة أول مشروع</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.projects?.map((project) => (
            <Card key={project.id} className="border-border shadow-sm hover:shadow-md transition-all flex flex-col group">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className={
                    project.status === "active" ? "text-primary border-primary/30 bg-primary/5" :
                    project.status === "completed" ? "text-green-600 border-green-600/30 bg-green-600/5" :
                    "text-amber-600 border-amber-600/30 bg-amber-600/5"
                  }>
                    {project.status === "active" ? "نشط" :
                     project.status === "completed" ? "مكتمل" : "متوقف"}
                  </Badge>
                </div>
                <CardTitle className="text-xl line-clamp-1 group-hover:text-primary transition-colors">
                  {project.name}
                </CardTitle>
                <div className="flex items-center text-sm text-muted-foreground mt-2">
                  <MapPin className="ml-1.5 h-3.5 w-3.5" />
                  <span className="line-clamp-1">{project.location || "موقع غير محدد"}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <div className="bg-muted/30 p-3 rounded-lg border border-border/50 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">قيمة العقد</span>
                    <span className="font-bold text-foreground">{formatCurrency(project.contractValue || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">تاريخ البدء</span>
                    <span className="font-medium text-foreground">
                      {project.startDate ? formatDate(project.startDate) : "غير محدد"}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button variant="outline" className="w-full justify-between group-hover:border-primary/30 transition-colors">
                  <span>عرض التفاصيل</span>
                  <ArrowLeft className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
