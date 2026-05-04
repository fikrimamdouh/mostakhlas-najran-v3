import { 
  useGetDashboardStats, 
  useGetRecentActivity, 
  useGetExtractsByStatus,
  getGetDashboardStatsQueryKey,
  getGetRecentActivityQueryKey,
  getGetExtractsByStatusQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, FileText, CheckCircle2, Clock, Building, Users } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() }
  });

  const { data: recentActivity, isLoading: activityLoading } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() }
  });

  const { data: statusData, isLoading: statusLoading } = useGetExtractsByStatus({
    query: { queryKey: getGetExtractsByStatusQueryKey() }
  });

  if (statsLoading || activityLoading || statusLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">جاري تحميل البيانات...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">لوحة القيادة</h1>
        <p className="text-muted-foreground">ملخص الأداء المالي والعمليات الجارية</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المستخلصات</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalAmount || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              عدد المستخلصات: {stats?.totalExtracts || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المستخلصات الجارية</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(stats?.currentAmount || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              عدد المستخلصات: {stats?.currentExtracts || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المشاريع النشطة</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeProjects || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              من إجمالي {stats?.totalProjects || 0} مشاريع
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المستخلصات المكتملة</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.completedExtracts || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              مستخلص معتمد
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1 border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              أحدث العمليات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-start justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        مستخلص #{activity.extractNumber} <span className="text-muted-foreground">({activity.action})</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {activity.projectName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(activity.timestamp)}
                      </p>
                    </div>
                    <div className="font-medium text-sm">
                      {formatCurrency(activity.amount)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">لا توجد نشاطات حديثة</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-border shadow-sm">
          <CardHeader>
            <CardTitle>توزيع المستخلصات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {statusData?.map((stat) => (
                <div key={stat.status} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium">
                      {stat.status === 'current' ? 'جارية' : 
                       stat.status === 'completed' ? 'مكتملة' : 'سابقة'}
                    </div>
                    <div className="font-bold">{formatCurrency(stat.amount)}</div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div>{stat.count} مستخلص</div>
                    <div>
                      {stats?.totalAmount ? 
                        Math.round((stat.amount / stats.totalAmount) * 100) : 0}%
                    </div>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        stat.status === 'current' ? 'bg-primary' : 
                        stat.status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground'
                      }`}
                      style={{ 
                        width: `${stats?.totalAmount ? (stat.amount / stats.totalAmount) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}