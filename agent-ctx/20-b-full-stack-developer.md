# Task 20-b — Export CSV ทุกโมดูลหลัก (Gap G8 บางส่วน)

**Agent:** full-stack-developer
**สถานะ:** ✅ เสร็จสมบูรณ์ (lint 0 error, curl ผ่านทั้งหมด, agent-browser ผ่าน)

## สิ่งที่ทำ

### 1. Backend — `src/lib/api.ts`
- เพิ่ม **`toCsv(rows, module): NextResponse`** (exported):
  - Flatten 1 ระดับ: `{ shelter: { name } }` → คอลัมน์ `shelter.name`; ข้าม object/array ลึก >1 ระดับ
  - คอลัมน์ = union keys เรียงตามแถวแรกก่อน; ไม่มีแถว → CSV ว่าง (เหลือ BOM)
  - Date → ISO, null/undefined → `''`, escape RFC 4180 (`, " \n \r` → ครอบ `""`, `"` → `""`), ขึ้นบรรทัด CRLF
  - BOM `\uFEFF` นำหน้า + `Content-Type: text/csv; charset=utf-8` + `Content-Disposition: attachment; filename="eden-{module}-{YYYYMMDD}.csv"` (ASCII ล้วน)
  - Refinement: ถ้า relation ถูก flatten เป็น `rel.field` แล้ว ตัด bare key ที่มาจากแถว null (เช่น `shelter`) ทิ้ง — ไฟล์ไม่มีคอลัมน์ว่างซ้ำซ้อน
- **`listHandler`**: `?format=csv` → `toCsv(items, cfg.module)` — บังคับ login เหมือนเดิม, `?q=` ใช้กับ CSV ได้ (where คำนวณก่อนแยก format) → โมดูล CRUD ทุกตัว export ได้ทันทีโดยอัตโนมัติ

### 2. Custom route — `src/app/api/inventory/movements/route.ts`
- GET เพิ่ม `?format=csv` → map เป็นคอลัมน์ไทย: **เวลา/ชนิด/สินค้า/จำนวน/จาก/ถึง/อ้างอิง/โดย**
  (flatten `item.name`, `fromWarehouse/toWarehouse.name`, TYPE_LABEL แปลงชนิดเป็นไทย — ไม่แสดง id)
- filename: `eden-inventory-movements-YYYYMMDD.csv` (แยกจาก export รายการสินค้า); ยัง take 200 ตามเดิม

### 3. UI — ปุ่ม "ส่งออก CSV" (Download icon, outline, sm)
| ไฟล์ | ตำแหน่ง | endpoint |
|---|---|---|
| incidents.tsx | ModuleHeader (หลัง RefreshButton) | `/api/incidents?format=csv&q=` |
| persons.tsx | ModuleHeader (หน้าปุ่มลงทะเบียน) | `/api/persons?format=csv&q=` |
| shelters.tsx | ModuleHeader | `/api/shelters?format=csv&q=` |
| requests.tsx | ModuleHeader (หลัง SearchInput) | `/api/requests?format=csv&q=` |
| inventory.tsx | แท็บสินค้า: filter bar คู่ Select หมวด | `/api/inventory?format=csv&q=` |
| inventory.tsx | แท็บประวัติการเคลื่อนไหว: คู่ RefreshButton | `/api/inventory/movements?format=csv` |

- ทุกปุ่ม: toast "กำลังส่งออกไฟล์ CSV..." → `window.open(url, '_blank')` — cookie ไปเอง
- ส่ง `?q=` (คำค้นปัจจุบัน) ที่ API รองรับ; ตัวกรอง client-only (แท็บสถานะ/หมวด) ไม่ส่ง — ระบุใน comment
- ไม่แตะ feature เดิมใด ๆ / ไม่แตะไฟล์นอก ownership (alerts.tsx, schema.prisma, api อื่น ๆ ยังไม่ถูกแตะ)

## ผล Verify

### curl (บัญชี admin@eden.go.th)
- `POST /api/auth/login` → 200 + cookie ✅
- `GET /api/incidents?format=csv` (มี cookie) → 200, `content-type: text/csv; charset=utf-8`, `content-disposition: attachment; filename="eden-incidents-20261007.csv"`, byte แรก `ef bb bf` (BOM) ✅
  - แถวแรก = ชื่อคอลัมน์ (`id,code,title,...,location.id,...,_count.persons,...`)
  - ข้อมูลไทยไม่เพี้ยน — พบ **INC-2569-005 "อุทกภัยรอบด้าน 27 จังหวัด + กรุงเทพฯ (ปภ. 7 ต.ค. 69)"** (description มี comma ถูก quote ถูกต้อง) ✅
- `GET /api/inventory/movements?format=csv` → 15 แถวจริง (รับเข้า/เบิกจ่าย/โอนย้าย น้ำดื่ม/ชุดบรรเทาทุกข์/เต็นท์ พร้อมชื่อคลัง/ผู้บริจาค) ✅
- ไม่มี cookie (ทั้ง 2 endpoint) → **401** ✅
- `?q=เชียงใหม่` + CSV → 1 เหตุการณ์ (filter ทำงานกับ CSV) ✅
- persons 28 / shelters 14 / requests 16 / inventory 22 แถว ✅

### agent-browser
- login (quick-fill admin → เข้าสู่ระบบ) → โมดูลเหตุการณ์: ปุ่ม "ส่งออก CSV" มีจริง → คลิก → **toast "กำลังส่งออกไฟล์ CSV..." แสดง** ✅
- ยืนยันในบริบทเบราว์เซอร์ (eval fetch พร้อม session cookie): status 200 + content-type/attachment + BOM ใน byte stream (fetch.text() ตัด BOM เองตาม spec เบราว์เซอร์) ✅
- ปุ่มครบทั้ง 4 โมดูลที่เหลือ + คลิกจริงในแท็บประวัติการเคลื่อนไหวของคลัง → toast แสดง ✅
- console / page errors ว่างสนิท; `dev.log` ไม่มี error (เฉพาะ `GET ...?format=csv 200`) ✅
- `bun run lint` → 0 error ✅

## ข้อจำกัด / เว้นไว้ต่อ
- movements CSV จำกัด 200 รายการล่าสุด (ตาม GET เดิม)
- โมดูลอื่น (sitreps/alerts/organizations/hr/warehouses ฯลฯ) API รองรับ `?format=csv` ผ่าน listHandler แล้ว — เว้นเพิ่มปุ่ม UI ใน task ถัดไป
