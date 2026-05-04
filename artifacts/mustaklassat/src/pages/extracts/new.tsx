import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useCreateExtract, useListProjects, getListProjectsQueryKey, getListExtractsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Loader2, Save } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  extractNumber: z.string().min(1, "رقم المستخلص مطلوب"),
  projectId: z.coerce.number().min(1, "يجب اختيار مشروع"),
  amount: z.coerce.number().min(0, "المبلغ يجب أن يكون رقماً إيجابياً"),
  status: z.enum(["current", "completed", "previous"]),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export default function NewExtract() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: projectsData, isLoading: projectsLoading } = useListProjects({
    query: { queryKey: getListProjectsQueryKey() }
  });

  const { mutate: createExtract, isPending } = useCreateExtract({
    mutation: {
      onSuccess: () => {
        toast({
          title: "تم الحفظ بنجاح",
          description: "تم إنشاء المستخلص الجديد.",
        });
        queryClient.invalidateQueries({ queryKey: getListExtractsQueryKey() });
        setLocation("/extracts");
      },
      onError: (error) => {
        toast({
          title: "حدث خطأ",
          description: "لم يتم إنشاء المستخلص. يرجى المحاولة مرة أخرى.",
          variant: "destructive",
        });
      }
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      extractNumber: "",
      projectId: 0,
      amount: 0,
      status: "current",
      description: "",
      notes: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createExtract({ data: values });
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/extracts">
          <Button variant="outline" size="icon" className="h-9 w-9">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إضافة مستخلص جديد</h1>
          <p className="text-muted-foreground">تسجيل بيانات مستخلص مالي جديد</p>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>بيانات المستخلص الأساسية</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المشروع</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange(Number(val))} 
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر المشروع..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projectsData?.projects?.map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="extractNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>رقم المستخلص</FormLabel>
                      <FormControl>
                        <Input placeholder="مثال: EXP-2023-01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>القيمة (ج.م)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الحالة</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر الحالة" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="current">جارية</SelectItem>
                          <SelectItem value="completed">مكتملة</SelectItem>
                          <SelectItem value="previous">سابقة</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الوصف (اختياري)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="وصف موجز للمستخلص..." className="resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ملاحظات داخلية (اختياري)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="ملاحظات للمراجعة..." className="resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4">
                <Link href="/extracts">
                  <Button variant="outline" type="button">إلغاء</Button>
                </Link>
                <Button type="submit" disabled={isPending || projectsLoading} className="min-w-[120px] font-bold">
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  حفظ المستخلص
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}