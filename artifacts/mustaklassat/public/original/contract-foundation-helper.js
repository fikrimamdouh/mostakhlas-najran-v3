/**
 * ContractFoundationDB — حفظ وجلب بيانات التأسيسي (عقود الباطن + المستهلكات)
 * localStorage أولاً + مزامنة سحابية عبر API
 *
 * آلية العمل:
 * - الأدمن يرفع الإكسل → يُحفظ على السيرفر لكل مستشفى → cloud-sync يوزّعه
 * - contract_foundation_data في hospitalStorage يُحمَّل تلقائياً على كل أجهزة المستخدمين
 */
const ContractFoundationDB = (function () {
  const LOCAL_KEY_PREFIX = 'contract_foundation_v2';
  const SERVER_SYNC_KEY  = 'contract_foundation_data'; // مفتاح cloud-sync

  // ── عقود الباطن المشتركة بين المستشفيات الثلاثة ──────────────────────────
  const _SHARED_SUBCONTRACTORS = [
    { name: 'تعقيم ونظافة مجاري الهواء والدكتات',                                                            contractAmount: 100000, annualVisits: 1  },
    { name: 'صيانة أنظمة التكييف والتبريد وأنظمة التهوية',                                                    contractAmount: 7000,   annualVisits: 4  },
    { name: 'صيانة المصاعد الكهربائية',                                                                       contractAmount: 6000,   annualVisits: 12 },
    { name: 'صيانة وإصلاح نظام إطفاء الحريق',                                                                 contractAmount: 8000,   annualVisits: 4  },
    { name: 'صيانة وإصلاح نظام إنذار الحريق',                                                                 contractAmount: 7000,   annualVisits: 4  },
    { name: 'صيانة السنترالات والنداء الآلي والإذاعة الداخلية والساعة المركزية واستدعاء الممرضات',            contractAmount: 8000,   annualVisits: 2  },
    { name: 'صيانة محطات التوليد الكهربائية ولوحات التحكم والتشغيل و(ATS)',                                   contractAmount: 10000,  annualVisits: 2  },
    { name: 'صيانة شبكة الغازات الطبية وملحقاتها وخزانات الغاز',                                             contractAmount: 7000,   annualVisits: 4  },
    { name: 'صيانة الـ (UPS)',                                                                                 contractAmount: 4000,   annualVisits: 2  },
    { name: 'صيانة محولات الكهرباء والقواطع الكهربائية وكامل اللوحات الكهربائية',                             contractAmount: 5000,   annualVisits: 2  },
    { name: 'صيانة معدات المغسلة',                                                                            contractAmount: 3750,   annualVisits: 2  },
    { name: 'صيانة محطات تحلية مياه الشرب وملحقاتها',                                                         contractAmount: 6000,   annualVisits: 4  },
    { name: 'صيانة محطة معالجة مياه الصرف الصحي',                                                             contractAmount: 7000,   annualVisits: 4  },
    { name: 'مكافحة الحشرات والقوارض والآفات البيئية',                                                        contractAmount: 2250,   annualVisits: 12 },
    { name: 'صيانة ثلاجة الموتى',                                                                             contractAmount: 4000,   annualVisits: 2  },
    { name: 'صيانة نظم المراقبات الأمنية',                                                                    contractAmount: 6000,   annualVisits: 2  },
    { name: 'عمرات المولدات',                                                                                  contractAmount: 150000, annualVisits: 1  },
  ];

  // ── بيانات مدمجة لكل مستشفى (تُستخدم إذا لم يُرفع ملف تأسيسي يدوياً) ─────
  const BUILTIN_HOSPITALS = {
    'مستشفى بدر الجنوب العام': {
      subcontractors: _SHARED_SUBCONTRACTORS,
      consumables: [
        { name: 'الوقود والزيوت والمحروقات (ماعدا وقود السيارات)', monthlyCost: 5031 },
        { name: 'المستهلكات الكيميائية والفلاتر',                  monthlyCost: 5488 },
        { name: 'مستهلكات الأعمال المدنية',                        monthlyCost: 6403 },
        { name: 'مواد ومطهرات النظافة',                            monthlyCost: 12349 },
        { name: 'مستهلكات الزراعة والري',                          monthlyCost: 3665 },
        { name: 'مستهلكات مكافحة الحشرات',                        monthlyCost: 457 },
      ],
    },
    'مستشفى حبونا العام': {
      subcontractors: _SHARED_SUBCONTRACTORS,
      consumables: [
        { name: 'الوقود والزيوت والمحروقات (ماعدا وقود السيارات)', monthlyCost: 7321 },
        { name: 'المستهلكات الكيميائية والفلاتر',                  monthlyCost: 7987 },
        { name: 'مستهلكات الأعمال المدنية',                        monthlyCost: 9318 },
        { name: 'مواد ومطهرات النظافة',                            monthlyCost: 3594 },
        { name: 'مستهلكات الزراعة والري',                          monthlyCost: 5324 },
        { name: 'مستهلكات مكافحة الحشرات',                        monthlyCost: 666 },
      ],
    },
    'مستشفى يدمه العام': {
      subcontractors: _SHARED_SUBCONTRACTORS,
      consumables: [
        { name: 'الوقود والزيوت والمحروقات (ماعدا وقود السيارات)', monthlyCost: 5031 },
        { name: 'المستهلكات الكيميائية والفلاتر',                  monthlyCost: 5488 },
        { name: 'مستهلكات الأعمال المدنية',                        monthlyCost: 6403 },
        { name: 'مواد ومطهرات النظافة',                            monthlyCost: 24698 },
        { name: 'مستهلكات الزراعة والري',                          monthlyCost: 3659 },
        { name: 'مستهلكات مكافحة الحشرات',                        monthlyCost: 457 },
      ],
    },
  };

  function _builtinKey(hospitalName) {
    const hn = (hospitalName || '').trim();
    return BUILTIN_HOSPITALS[hn] ? { hospitalName: hn, ...BUILTIN_HOSPITALS[hn], savedAt: '2026-01-01T00:00:00.000Z' } : null;
  }

  function _localKey(hospitalName) {
    return LOCAL_KEY_PREFIX + '_' + (hospitalName || 'default').trim();
  }

  // ── localStorage ─────────────────────────────────────────────────────────

  function save(hospitalName, subcontractors, consumables) {
    const rec = {
      hospitalName: (hospitalName || 'default').trim(),
      subcontractors: subcontractors || [],
      consumables: consumables || [],
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(_localKey(hospitalName), JSON.stringify(rec));
    return rec;
  }

  function load(hospitalName) {
    // 1. جرّب مفتاح المستشفى المحدد
    try {
      const raw = localStorage.getItem(_localKey(hospitalName));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.subcontractors?.length || parsed.consumables?.length)) return parsed;
      }
    } catch {}

    // 2. fallback: مفتاح السحابة العام الذي يوزّعه cloud-sync
    try {
      const raw = localStorage.getItem(SERVER_SYNC_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.subcontractors?.length || parsed.consumables?.length)) {
          const hn = (hospitalName || '').trim();
          if (!hn || !parsed.hospitalName || parsed.hospitalName === hn) return parsed;
        }
      }
    } catch {}

    // 3. fallback: بيانات مدمجة في الكود (لا تحتاج رفعاً)
    return _builtinKey(hospitalName);
  }

  function loadAll() {
    const results = [];
    const seen = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LOCAL_KEY_PREFIX + '_')) {
        try {
          const d = JSON.parse(localStorage.getItem(k));
          if (d && d.hospitalName && !seen.has(d.hospitalName)) {
            seen.add(d.hospitalName);
            results.push(d);
          }
        } catch {}
      }
    }
    // أضف المفتاح السحابي إن لم يكن مدرجاً بعد
    try {
      const raw = localStorage.getItem(SERVER_SYNC_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.hospitalName && !seen.has(d.hospitalName)) {
          seen.add(d.hospitalName);
          results.push(d);
        }
      }
    } catch {}
    return results.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  }

  function remove(hospitalName) {
    localStorage.removeItem(_localKey(hospitalName));
  }

  // ── Server API ────────────────────────────────────────────────────────────

  function _getToken() {
    try {
      const s = JSON.parse(localStorage.getItem('najran_session') || '{}');
      return s.clerkToken || null;
    } catch { return null; }
  }

  /**
   * saveToServer — يرفع بيانات التأسيسي للسيرفر (أدمن فقط)
   * يُستدعى تلقائياً من صفحة الرفع بعد الحفظ المحلي
   */
  async function saveToServer(hospitalName, subcontractors, consumables) {
    const token = _getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    try {
      const resp = await fetch('/api/admin/foundation', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ hospitalName, subcontractors, consumables }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return { ok: false, error: err.error || 'خطأ من السيرفر' };
      }
      const result = await resp.json();

      // حفظ المفتاح السحابي محلياً فوراً حتى تعكسه الأجهزة بدون انتظار
      const rec = {
        hospitalName: (hospitalName || '').trim(),
        subcontractors: subcontractors || [],
        consumables: consumables || [],
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(SERVER_SYNC_KEY, JSON.stringify(rec));

      return { ok: true, ...result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * loadFromServer — يجلب بيانات التأسيسي من السيرفر مباشرة
   * (للاستخدام من صفحات الاطلاع عندما لا يوجد localStorage)
   */
  async function loadFromServer(hospitalName) {
    const token = _getToken();
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    try {
      const url = hospitalName
        ? '/api/admin/foundation?hospital=' + encodeURIComponent(hospitalName)
        : '/api/admin/foundation';
      const resp = await fetch(url, { headers, credentials: 'include' });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data && (data.subcontractors?.length || data.consumables?.length)) {
        // حفظ محلياً كـ cache
        const hn = data.hospitalName || hospitalName;
        if (hn) localStorage.setItem(_localKey(hn), JSON.stringify(data));
        localStorage.setItem(SERVER_SYNC_KEY, JSON.stringify(data));
        return data;
      }
      return null;
    } catch { return null; }
  }

  return { save, load, loadAll, remove, saveToServer, loadFromServer };
})();
