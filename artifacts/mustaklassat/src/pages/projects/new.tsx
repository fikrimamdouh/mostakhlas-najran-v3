import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation, Link } from "wouter";
import { useCreateProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(2, "اسم المشروع مطلوب (حرفين على الأقل)"),
  location: z.string().optional(),
  contractValue: z.coerce.number().min(0, "يجب أن تكون قيمة العقد رقماً"),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: createProject, isPending } = useCreateProject({
    mutation: {
      onSuccess: () => {
        toast({
          title: "تم الحفظ بنجاح",
          description: "تم إنشاء المشروع الجديد.",
        });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setLocation("/projects");
      },
      onError: () => {
        toast({
          title: "حدث خطأ",
          description: "لم يتم إنشاء المشروع. يرجى المحاولة مرة أخرى.",
          variant: "destructive",
        });
      }
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      location: "",
      contractValue: 0,
      description: "",
      startDate: "",
      endDate: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createProject({ data: values });
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="outline" size="icon" className="h-9 w-9">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إضافة مشروع جديد</h1>
          <p className="text-muted-foreground">تسجيل بيانات مشروع إنشائي جديد</p>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>البيانات الأساسية للمشروع</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>اسم المشروع</FormLabel>
                      <FormControl>
                        <Input placeholder="مثال: إنشاء مجمع سكني التجمع" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الموقع</FormLabel>
                      <FormControl>
                        <Input placeholder="المدينة، المنطقة..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contractValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>قيمة العقد (ج.م)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ البدء</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ الانتهاء المتوقع</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
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
                    <FormLabel>وصف المشروع (اختياري)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="تفاصيل عن نطاق العمل..." className="resize-none h-24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4">
                <Link href="/projects">
                  <Button variant="outline" type="button">إلغاء</Button>
                </Link>
                <Button type="submit" disabled={isPending} className="min-w-[120px] font-bold">
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  حفظ المشروع
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}