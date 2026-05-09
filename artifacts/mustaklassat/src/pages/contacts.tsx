import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Plus, Search, Edit2, Trash2, Save, X,
  Phone, Mail, Building2, Briefcase, StickyNote,
  UserCheck, Download, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Contact {
  id: string;
  name: string;
  title: string;
  phone: string;
  email: string;
  organization: string;
  notes: string;
  createdAt: string;
}

const STORAGE_KEY = "contacts_registry";

function generateId() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_FORM: Omit<Contact, "id" | "createdAt"> = {
  name: "", title: "", phone: "", email: "", organization: "", notes: ""
};

function ContactCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  onEdit: (c: Contact) => void;
  onDelete: (id: string) => void;
}) {
  const initials = contact.name.trim() ? contact.name.trim().charAt(0) : "?";
  const colors = ["#1e3c72", "#2a5298", "#0077b6", "#0096c7", "#023e8a", "#d4af37"];
  const colorIdx = contact.name.charCodeAt(0) % colors.length;

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 group transition-all duration-200 hover:shadow-lg"
      style={{
        background: "#fff",
        border: "1px solid #eef0f8",
        boxShadow: "0 1px 4px rgba(30,60,114,0.06)",
      }}
    >
      {/* Header: avatar + name + actions */}
      <div className="flex items-start gap-3">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
          style={{ background: colors[colorIdx] }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 truncate">{contact.name}</p>
          {contact.title && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{contact.title}</p>
          )}
          {contact.organization && (
            <Badge variant="outline" className="text-[10px] mt-1 px-2 py-0 border-blue-200 text-blue-700 bg-blue-50">
              {contact.organization}
            </Badge>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => onEdit(contact)}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(contact.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600 transition-colors"
          >
            <Phone className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
            <span dir="ltr">{contact.phone}</span>
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600 transition-colors truncate"
          >
            <Mail className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
            <span className="truncate" dir="ltr">{contact.email}</span>
          </a>
        )}
        {contact.notes && (
          <div className="flex items-start gap-2 text-xs text-gray-400">
            <StickyNote className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
            <span className="line-clamp-2">{contact.notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ContactForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Contact;
  onSave: (data: Omit<Contact, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<Contact, "id" | "createdAt">>(
    initial ? {
      name: initial.name, title: initial.title, phone: initial.phone,
      email: initial.email, organization: initial.organization, notes: initial.notes
    } : { ...EMPTY_FORM }
  );

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const fields = [
    { key: "name" as const,         label: "الاسم الكامل",    icon: UserCheck,  type: "text",  required: true },
    { key: "title" as const,        label: "المسمى الوظيفي",  icon: Briefcase,  type: "text",  required: false },
    { key: "phone" as const,        label: "الجوال",           icon: Phone,      type: "tel",   required: false },
    { key: "email" as const,        label: "البريد الإلكتروني", icon: Mail,      type: "email", required: false },
    { key: "organization" as const, label: "الجهة",            icon: Building2,  type: "text",  required: false },
  ];

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "#fff", border: "1px solid #e8edf7", boxShadow: "0 4px 20px rgba(30,60,114,0.1)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-lg" style={{ color: "#1e3c72" }}>
          {initial ? "تعديل جهة الاتصال" : "إضافة جهة اتصال جديدة"}
        </h3>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.key} className={f.key === "name" ? "sm:col-span-2" : ""}>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
              {f.label}{f.required && <span className="text-red-500 mr-0.5">*</span>}
            </label>
            <div className="relative">
              <f.icon className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                type={f.type}
                value={form[f.key]}
                onChange={set(f.key)}
                className="pr-9 text-sm"
                placeholder={f.label}
                dir={f.key === "phone" || f.key === "email" ? "ltr" : "rtl"}
              />
            </div>
          </div>
        ))}

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
            الملاحظات
          </label>
          <div className="relative">
            <StickyNote className="absolute right-3 top-3 h-3.5 w-3.5 text-gray-400" />
            <textarea
              value={form.notes}
              onChange={set("notes")}
              rows={2}
              placeholder="ملاحظات إضافية..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
              dir="rtl"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          onClick={() => { if (form.name.trim()) onSave(form); }}
          disabled={!form.name.trim()}
          style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}
          className="gap-2 text-white text-sm"
        >
          <Save className="h-3.5 w-3.5" />
          {initial ? "حفظ التعديلات" : "إضافة جهة الاتصال"}
        </Button>
        <Button variant="outline" onClick={onCancel} className="gap-2 text-sm">
          <X className="h-3.5 w-3.5" />
          إلغاء
        </Button>
      </div>
    </div>
  );
}

export default function ContactsRegistry() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setContacts(JSON.parse(raw));
    } catch {}
  }, []);

  const save = (list: Contact[]) => {
    setContacts(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  };

  const handleAdd = (data: Omit<Contact, "id" | "createdAt">) => {
    const newContact: Contact = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    const updated = [newContact, ...contacts];
    save(updated);
    setShowForm(false);
    toast({ title: "✅ تمت الإضافة", description: `تم إضافة ${data.name} للسجل` });
  };

  const handleEdit = (data: Omit<Contact, "id" | "createdAt">) => {
    if (!editContact) return;
    const updated = contacts.map(c => c.id === editContact.id ? { ...c, ...data } : c);
    save(updated);
    setEditContact(null);
    toast({ title: "✅ تم التعديل", description: `تم تعديل بيانات ${data.name}` });
  };

  const handleDelete = (id: string) => {
    const contact = contacts.find(c => c.id === id);
    const updated = contacts.filter(c => c.id !== id);
    save(updated);
    toast({ title: "🗑️ تم الحذف", description: `تم حذف ${contact?.name || "جهة الاتصال"}` });
  };

  const exportContacts = () => {
    const json = JSON.stringify(contacts, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importContacts = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data)) {
          const merged = [...contacts];
          for (const c of data) {
            if (!merged.find(x => x.id === c.id)) merged.push(c);
          }
          save(merged);
          toast({ title: "✅ تم الاستيراد", description: `تم استيراد ${data.length} جهة اتصال` });
        }
      } catch {
        toast({ title: "خطأ", description: "ملف غير صالح", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const filtered = contacts.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [c.name, c.title, c.phone, c.email, c.organization, c.notes]
      .some(v => v.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500" style={{ direction: "rtl" }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#1e3c72" }}>
            سجل التواقيع والبيانات
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            دليل جهات الاتصال والأشخاص المرتبطين بالمشروع
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={importContacts}
          />
          <Button
            variant="outline"
            className="gap-2 text-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            استيراد
          </Button>
          {contacts.length > 0 && (
            <Button
              variant="outline"
              className="gap-2 text-sm"
              onClick={exportContacts}
            >
              <Download className="h-3.5 w-3.5" />
              تصدير
            </Button>
          )}
          <Button
            className="gap-2 text-sm text-white"
            style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}
            onClick={() => { setShowForm(true); setEditContact(null); }}
          >
            <Plus className="h-4 w-4" />
            إضافة جهة اتصال
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div
        className="flex items-center gap-4 px-4 py-3 rounded-xl"
        style={{ background: "#fff", border: "1px solid #e8edf7" }}
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: "#1e3c72" }} />
          <span className="text-sm font-semibold" style={{ color: "#1e3c72" }}>
            {contacts.length} جهة اتصال
          </span>
        </div>
        {search && (
          <div className="text-sm text-gray-500">
            — نتائج البحث: <span className="font-semibold">{filtered.length}</span>
          </div>
        )}
      </div>

      {/* Form */}
      {(showForm || editContact) && (
        <ContactForm
          initial={editContact || undefined}
          onSave={editContact ? handleEdit : handleAdd}
          onCancel={() => { setShowForm(false); setEditContact(null); }}
        />
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="البحث في السجل (الاسم، الجوال، الجهة...)"
          className="pr-10"
          dir="rtl"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "rgba(30,60,114,0.07)" }}
          >
            <Users className="h-8 w-8" style={{ color: "#1e3c72" }} />
          </div>
          <p className="text-gray-500 font-medium">
            {search ? "لا توجد نتائج مطابقة للبحث" : "لا توجد جهات اتصال بعد"}
          </p>
          {!search && (
            <Button
              className="mt-4 gap-2 text-white text-sm"
              style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-4 w-4" />
              إضافة جهة اتصال الآن
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ContactCard
              key={c.id}
              contact={c}
              onEdit={c => { setEditContact(c); setShowForm(false); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
