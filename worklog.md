# Worklog — EDEN DMS (Sahana Eden Modern Reimplementation)

## Project Context
ผู้ใช้อัปโหลด `eden-core-master.zip` (Sahana Eden — ระบบจัดการภัยพิบัติแบบโอเพนซอร์ส, Python/web2py)
พร้อมคำสั่ง: "ศึกษาและออกแบบ application ให้มีองค์ประกอบ และโมดูลครบถ้วน"

งานคือศึกษาสถาปัตยกรรมเดิม แล้วออกแบบ+พัฒนาใหม่เป็นเว็บแอปสมัยใหม่ด้วย Next.js 16 + TypeScript + Prisma + shadcn/ui (UI ภาษาไทย)

## ผลการศึกษา Source ต้นฉบับ (eden-core-master)
- ตำแหน่งแตกไฟล์: `/home/z/my-project/upload/eden-core-extracted/eden-core-master/`
- VERSION: nursix-dev-5066-g6620ed10d (2021-08-28)
- เป็น web2py application โครงสร้างหลักอยู่ที่ controllers/ (15,473 บรรทัด), languages/, cron/
- โมดูลจาก controllers: default, pr, org, hrm, gis, sit, cms, msg, admin, auth, doc, sync, xforms, setup, mobile, errors
- gis (4,084 บรรทัด) = แผนที่/เลเยอร์/ตำแหน่ง, msg (2,329) = SMS/Email/Twitter/Facebook channels+inbox/outbox
- pr = Person Registry (บุคคล/กลุ่ม/สูญหาย), org = Organisation/Office/Facility/Sector/Donor
- hrm = staff/volunteer/trainee/skill/course/certificate, cms = posts/series (sit ใช้ cms_index)
- admin = user/role/setting/audit, xforms = ODK mobile forms, sync = data synchronization

## Design Doc ฉบับย่อ (EDEN DMS ฉบับใหม่)
สถาปัตยกรรม: Single-page app ที่ `/` (ระเบียบของ sandbox: user เห็นเฉพาะ / route) — SPA state-based navigation ผ่าน Sidebar
- Frontend: Next.js 16 App Router, client components, shadcn/ui (New York), Tailwind 4, recharts, framer-motion
- Backend: Next.js API routes (`/api/*`) + Prisma (SQLite) — ไม่ใช้ server action
- DB: SQLite ผ่าน Prisma, seed ข้อมูลจำลองภาษาไทย

### โมดูลทั้งหมด 12 โมดูล (ครบถ้วนตาม eden-core)
1. **dashboard** — ภาพรวม: KPI cards, กราฟเหตุการณ์/ผู้ประสบภัย, กิจกรรมล่าสุด, สถานะโมดูล
2. **incidents** (sit) — เหตุการณ์ภัยพิบัติ: ประเภท/ระดับความรุนแรง/สถานะ, CRUD
3. **sitreps** (cms+sit) — รายงานสถานการณ์ (SITREP) ผูกกับเหตุการณ์, CRUD
4. **persons** (pr) — ทะเบียนบุคคล: ผู้ประสบภัย/บุคคลสูญหาย/พบตัว, CRUD
5. **organizations** (org) — ทะเบียนองค์กร: ประเภท/ภาคส่วน/ผู้บริจาค, CRUD
6. **hr** (hrm) — บุคลากร: อาสาสมัคร/เจ้าหน้าที่/ทักษะ/สถานะ, CRUD
7. **shelters** — ศูนย์พักพิง: ความจุ/จำนวนปัจจุบัน/สถานะ, CRUD
8. **inventory** — คลังสินค้า/มอบหมาย: สินค้า/หน่วย/ปริมาณ/คลัง, CRUD
9. **requests** — คำขอความช่วยเหลือ: ประเภท/ลำดับความสำคัญ/สถานะจับคู่, CRUD
10. **map** (gis) — แผนที่ GIS: แสดงเหตุการณ์+ศูนย์พักพิง+องค์กร (SVG map เดิมทีใช้ Leaflet — ใช้ SVG projection แทนเพื่อไม่เพิ่ม dependency)
11. **alerts** (msg) — การแจ้งเตือน: เตือนภัย/ประกาศ/ช่องทาง, CRUD
12. **admin** — ผู้ดูแลระบบ: ผู้ใช้/บทบาท/ตั้งค่า/audit log

### API Design (REST)
- GET/POST `/api/incidents`, `/api/incidents/[id]` (PUT/DELETE)
- เช่นเดียวกันสำหรับ sitreps, persons, organizations, hr, shelters, inventory, requests, alerts, users, stats (dashboard aggregate), settings

### Prisma Models (18 models)
Location, Incident, IncidentReport, Person, PersonGroup, Organization, Sector, Shelter, ShelterOccupancy, HumanResource, Skill, InventoryItem, Warehouse, Stock, AidRequest, Alert, AlertChannel, User, Role, AuditLog, Setting

---
Task ID: 1
Agent: main (Z.ai Code)
Task: ศึกษา eden-core-master.zip, ออกแบบระบบ, สร้าง design doc + worklog

Work Log:
- แตกไฟล์ zip → อ่าน README/ABOUT/VERSION/.gitmodules/INSTALL
- สำรวจ controllers ทั้ง 18 ไฟล์ (15,473 บรรทัด): จับรายการ function ของ gis, msg, org, hrm, sit, cms, default, admin, setup, mobile
- สรุปสถาปัตยกรรมเดิม (web2py MVC + s3 framework) และ map เป็น 12 โมดูลใหม่
- ออกแบบ API contract + Prisma models
- เขียน design doc ใน worklog นี้

Stage Summary:
- ได้ design doc ครบ 12 โมดูล + API contract + 18+ Prisma models
- Task ID ถัดไป: 2 (schema+seed) → 3 (API) → 4 (shell) → 5a-5e (module pages, ทำขนานได้หลัง 4) → 6 (verify)

---
Task ID: 2,3,4 (main)
Agent: main (Z.ai Code)
Task: Prisma schema + seed + API routes + frontend shell

Work Log:
- เขียน prisma/schema.prisma 14 models (Location, Incident, IncidentReport, Person, Organization, HumanResource, Shelter, Warehouse, InventoryItem, AidRequest, Alert, User, AuditLog, Setting) + db push สำเร็จ
- สร้าง prisma/seed.ts ข้อมูลจำลองไทยครบทุกโมดูล (4 เหตุการณ์, 12 บุคคล, 6 องค์กร, 8 บุคลากร, 5 ศูนย์พักพิง, 10 สินค้า, 6 คำขอ, 5 แจ้งเตือน, 5 users, 6 audit logs, 4 settings)
- สร้าง src/lib/api.ts (generic CRUD handlers + audit log) และ API routes 16 endpoints: /api/{incidents,reports,persons,organizations,hr,shelters,inventory,warehouses,requests,alerts,users,audit-logs,locations,settings,stats}
- ทดสอบ curl /api/stats /api/incidents /api/shelters ผ่านทั้งหมด
- สร้าง src/lib/constants.ts (ป้ายไทย+สี badge ครบทุก enum), src/components/eden/shared.tsx (useFetch, apiSend, ModuleHeader, StatCard, StatusBadge, SearchInput, FormDialog, Field, useConfirmDelete ฯลฯ), src/components/eden/shell.tsx (sidebar 12 โมดูล + header + sticky footer)
- src/app/page.tsx SPA navigation ทุกโมดูล + placeholder module files
- แก้ bug: lucide `Map` icon ชนกับ global Map constructor → alias MapIcon; layout.tsx metadata ไทย + lang="th"
- หน้า / render HTTP 200 สำเร็จ

Stage Summary:
- Backend ครบ 100%: 15 API groups + stats aggregate
- Frontend shell พร้อม: constants, shared components, shell, page.tsx
- โมดูลทั้ง 11 ไฟล์ยังเป็น placeholder — subagents 5-a..5-e จะเขียนทับพร้อมกัน

---
Task ID: 5-a
Agent: dashboard subagent
Task: เขียน Dashboard โมดูล (src/components/eden/dashboard.tsx) — ภาพรวมสถานการณ์จาก /api/stats

Work Log:
- อ่าน worklog.md + shared.tsx + constants.ts + api/stats/route.ts เพื่อทำความเข้าใจ contract และ shared components ที่มีอยู่
- เขียนทับ dashboard.tsx ครบ 5 ส่วนตาม spec:
  1. Emergency banner (bg-red-50 border-red-200 + Siren icon) เมื่อ activeIncidents > 0 พร้อมปุ่ม "ดูเหตุการณ์" → onNavigate('incidents')
  2. KPI 6 ใบ (grid-cols-2 → md:3 → xl:6) ใช้ StatCard: เหตุการณ์แอคทีฟ(red/AlertTriangle), ผู้ประสบภัย(amber/Users + sub บาดเจ็บ·เสียชีวิตจาก incidents), สูญหาย(red/UserX), ศูนย์พักพิง(teal/Home + sub ผู้พักพิง/ความจุ), คำขอรอพิจารณา(violet/ClipboardList), อาสาสมัคร(emerald/HeartHandshake + sub ปฏิบัติภารกิจ) — fmtNum ทั้งหมด
  3. กราฟ 2 ใบด้วย recharts: AreaChart แนวโน้ม 7 วัน (affected=amber gradient, requests=violet gradient, X-axis วันที่ th-TH, tooltip fmtNum) + PieChart โดนัท เหตุการณ์ตามประเภท (label จาก optLabel(INCIDENT_TYPES), palette 8 สีกำหนดเอง ไม่มีน้ำเงิน, custom legend + % และตัวเลขรวมกลางโดนัท)
  4. การกระจายผู้ประสบภัยตามสถานะ: Progress bar ต่อสถานะจาก personsByStatus ใช้ PERSON_STATUS เป็น label/badge, สีแถบ map ต่อสถานะ (missing=red, found=teal, safe=emerald, injured=orange, deceased=slate, evacuated=violet) ผ่าน arbitrary selector [&>div]:bg-*
  5. สองคอลัมน์ล่าง (lg:grid-cols-2): ซ้าย "เหตุการณ์ล่าสุด" เรียง startDate ล่าสุด 5 รายการ (แถวกดได้ทั้งแถว → incidents, severity+status badge, พื้นที่, ผู้ประสบภัย, วันที่, max-h-96 overflow-y-auto + custom scrollbar) / ขวา "ศูนย์พักพิง — อัตราความจุ" กรองไม่เอา closed, progress bar สี emerald<70% amber 70-89% red≥90% + SHELTER_STATUS badge + X/Y คน (%)
- Loading: DashboardSkeleton (banner+KPI+charts+lists), Error: ErrorState + ปุ่มลองใหม่ (refetch), ว่าง: EmptyState, ปุ่มรีเฟรชด้วย RefreshButton
- กฎ UI ครบ: 'use client', ภาษาไทยทั้งหมด, responsive mobile-first, การ์ด p-4/p-6 gap-4/gap-6, ไม่มีสีน้ำเงิน/indigo, aria-label บนปุ่มแถวเหตุการณ์, focus-visible ring
- Export signature ตรงตาม page.tsx: `export default function DashboardModule({ onNavigate }: { onNavigate?: (key: string) => void } = {})`
- bunx eslint src/components/eden/dashboard.tsx --fix → ผ่าน 0 errors 0 warnings
- ตรวจ dev.log: ✓ Compiled + GET / 200 + GET /api/stats 200 — ไม่มี error ใหม่ (error เก่าทั้งหมดเป็น pre-existing ก่อนแก้ไฟล์)

Stage Summary:
- Dashboard โมดูลเสร็จสมบูรณ์ ใช้งานได้: ดึง /api/stats, แสดง KPI/กราฟ/การกระจายสถานะ/เหตุการณ์ล่าสุด/อัตราความจุศูนย์พักพิง และ navigate ไป incidents/persons/shelters ได้
- ไม่แก้ไฟล์อื่นนอกจาก dashboard.tsx และ worklog.md นี้

---
Task ID: 5-c
Agent: persons subagent
Task: เขียนโมดูลทะเบียนบุคคล (src/components/eden/persons.tsx) — แทนที่ placeholder

Work Log:
- อ่าน worklog, shared.tsx, constants.ts, api.ts และ API route persons เพื่อยึดแบบแผนเดิม
- เขียน persons.tsx ครบตามสเปก: ModuleHeader + ปุ่มลงทะเบียน, StatCard 4 ใบ (ทั้งหมด/สูญหาย red/อพยพแล้ว violet/บาดเจ็บ orange)
- Tabs กรองสถานะ 6 แท็บ (ทั้งหมด/สูญหาย/พบตัวแล้ว/ปลอดภัย/บาดเจ็บ/อพยพแล้ว) พร้อมนับจำนวนต่อแท็บ, client-side filter
- SearchInput ค้นชื่อ/นามสกุล/โทรศัพท์/ตำแหน่งพบล่าสุด + RefreshButton
- ตาราง 9 คอลัมน์ห่อ overflow-x-auto, ชื่อ font-medium, เพศ (optLabel), สถานะ (StatusBadge), พบล่าสุดแสดงตำแหน่ง+เวลา (fmtDateTime-style toLocaleString th-TH), เหตุการณ์ (incident.code), ศูนย์พักพิง (shelter.name)
- Quick action "พบตัวแล้ว" (CheckCircle emerald outline) เฉพาะแถวสูญหาย → PUT {status:'found'} + toast + refetch
- ฟอร์ม FormDialog wide grid 2 คอลัมน์: ครบ 13 ฟิลด์, gender default unknown, datetime-local → ISO ตอน submit (แก้ไขแปลงกลับ toLocalInput), Select เหตุการณ์/ศูนย์พักพิง มี "— ไม่ระบุ —" (sentinel 'none' เพื่อเลี่ยง Radix SelectItem value="")
- Payload: ค่าว่าง optional ส่งเป็น undefined, age แปลง Number, lastSeenAt → toISOString
- ลบผ่าน useConfirmDelete + toast, Loading TableSkeleton / Empty EmptyState (ข้อความตาม filter) / Error ErrorState+ลองใหม่ ครบ
- ทดสอบ API จริง: GET/POST/DELETE /api/persons ผ่านทั้งหมด (ลบ record ทดสอบแล้ว), dev.log ✓ Compiled ไม่มี error

Stage Summary:
- โมดูลทะเบียนบุคคลเสร็จสมบูรณ์ 100%, eslint 0 errors, ใช้เฉพาะ palette emerald/amber/red/violet/teal/slate
- ผู้ประสานงานทะเบียนสามารถ: ลงทะเบียน/แก้ไข/ลบ/ค้นหา/กรองตามสถานะ/บันทึกพบตัวผู้สูญหายได้ในหน้าเดียว
---
Task ID: 5-d
Agent: org+hr+shelters subagent
Task: เขียนโมดูล organizations.tsx, hr.tsx, shelters.tsx (ทะเบียนองค์กร / บุคลากร / ศูนย์พักพิง)

Work Log:
- organizations.tsx: ModuleHeader + ปุ่มเพิ่ม, StatCard 4 ใบ (ทั้งหมด/ราชการ/NGO+มูลนิธิ/ระหว่างประเทศ), SearchInput (ชื่อ/ผู้ติดต่อ) + Select กรองประเภท (client-side), การ์ด grid sm:2 lg:3 แสดง type badge/sector/ผู้ติดต่อ/โทร/email/website/สถานะ active-inactive (emerald/slate inline), FormDialog wide ฟอร์มครบ 10 ช่อง, ลบผ่าน useConfirmDelete + useToast ครบ
- hr.tsx: StatCard 4 ใบ (ทั้งหมด/พร้อมปฏิบัติงาน/ปฏิบัติภารกิจ/อาสาสมัคร), SearchInput (ชื่อ/ตำแหน่ง/ทักษะ) + filter type + filter status, ตาราง overflow-x-auto: ชื่อ+โทร+email, ประเภท StatusBadge, ตำแหน่ง, องค์กร (include จาก API), ทักษะ split ',' เป็น Badge เล็ก slate, พื้นที่ปฏิบัติงาน, ปุ่มแก้/ลบ; **Quick status change** กด badge สถานะในตารางวน available→assigned→on_mission→available ผ่าน PUT + toast; ฟอร์ม organizationId Select '— ไม่สังกัด —' + orgs จาก /api/organizations, skills พร้อม placeholder และพรีวิว badge
- shelters.tsx: StatCard 4 ใบ (ทั้งหมด/เปิดรับ/ความจุรวม fmtNum/ผู้พักพิงรวม + Progress อัตราเข้าพักรวม %), SearchInput + filter status, การ์ด grid พร้อม **Occupancy progress bar** (emerald <70%, amber 70-89%, red ≥90% ผ่าน arbitrary variant [&_[data-slot=progress-indicator]]) + ข้อความ "X / Y คน", facilities split ',' เป็น Badge optLabel, ฟอร์ม: capacity/currentOccupancy Number ก่อนส่ง, **Checkbox 5 อัน SHELTER_FACILITIES** รวมเป็น comma-separated, lat/lng optional
- กฎ UI: ภาษาไทยทั้งหมด, สี emerald/amber/red/violet/teal/orange/slate เท่านั้น (ไม่มี blue/indigo/sky/cyan), การ์ด p-4 gap-4, Loading/Empty/Error states ครบทุกโมดูล
- ยืนยัน API contract จาก src/lib/api.ts (updateHandler partial + transform number ฝั่ง shelters) และ schema nullability (ส่ง null เคลียร์ค่า optional)
- bunx eslint 3 ไฟล์ --fix → 0 errors 0 warnings; curl GET / → HTTP 200 ไม่มี compile error ใน dev.log

Stage Summary:
- โมดูล org/hr/shelters เสร็จสมบูรณ์ ใช้งานได้: CRUD ครบ + filter/search + toast + confirm delete
- จุดเด่น: quick status cycle ในตาราง HR, occupancy progress bar 3 สีอัตโนมัติ, facilities checkbox group
- คงเหลือ placeholder: incidents, sitreps, persons, inventory, requests, alerts, map, admin, dashboard (subagents อื่น)

---
Task ID: 5-b
Agent: incidents+sitreps subagent
Task: เขียนโมดูลเหตุการณ์ภัยพิบัติ (incidents.tsx) และโมดูลรายงานสถานการณ์ (sitreps.tsx) ทับ placeholder

Work Log:
- อ่าน worklog.md, shared.tsx, constants.ts, select/textarea/table/tabs/dialog/toast components และ API routes (incidents/reports + lib/api.ts) เพื่อยึดแบบแผนเดิมทั้งหมด
- src/components/eden/incidents.tsx: ModuleHeader + ปุ่มรายงานเหตุการณ์ใหม่, StatCard 4 ใบ (ทั้งหมด/กำลังดำเนินการ/ผู้ประสบภัยรวม/เสียชีวิตรวม), SearchInput ค้น title/locationName/code client-side, ตาราง shadcn ห่อ overflow-x-auto (คอลัมน์ครบ 9 ตาม spec + ปุ่ม Eye/Pencil/Trash2 ขนาด sm), FormDialog wide ฟอร์มสร้าง/แก้ไข (code readonly เฉพาะตอนแก้, Select 3 ตัว, number→Number(), date→ISO, Textarea) กรอกค่าเดิมครบ, Dialog ดูรายละเอียดเต็ม + CountChip persons/reports/aidRequests + ปุ่มแก้ไขจากหน้า detail, ลบผ่าน useConfirmDelete + apiSend DELETE + refetch, toast สำเร็จ/ล้มเหลว (variant destructive) ครบทุก action
- src/components/eden/sitreps.tsx: ModuleHeader + ปุ่มเขียนรายงาน, Tabs ฟิลเตอร์สถานะ (ทั้งหมด/เผยแพร่/ฉบับร่าง พร้อมจำนวน) + SearchInput (title/author), รายการแบบการ์ด grid md:2 xl:3 — title, badge สถานะ inline (draft slate / published emerald), chip เหตุการณ์ที่โยง (code — title), author, fmtDateTime, เนื้อหาตัด 160 ตัวอักษร, ปุ่มอ่านเพิ่ม/แก้ไข/ลบ, FormDialog wide (title*, incidentId Select จาก /api/incidents แสดง "code — title" มีตัวเลือกไม่ผูกเหตุการณ์, content* Textarea rows 8, status Select, author default ผู้ปฏิบัติงาน), Dialog อ่านเนื้อหาเต็ม + ปุ่มแก้ไข, ลบ+confirm+toast, Loading/Empty/Error states ครบ
- ใช้เฉพาะ shared components/สีที่กำหนด (emerald/amber/red/violet/teal/orange/slate) ไม่มี blue/indigo/sky/cyan, responsive ทุกส่วน
- bunx eslint ทั้ง 2 ไฟล์ --fix → ผ่าน 0 errors, curl / ได้ HTTP 200, ตรวจ dev.log ไม่มี compile error (✓ Compiled, GET / 200)

Stage Summary:
- โมดูล incidents + sitreps สมบูรณ์ ใช้งานได้จริง: CRUD ครบ, ค้นหา/ฟิลเตอร์ client-side, stats, detail views, ยืนยันลบ, toast feedback, responsive
- ยึดสัญญา API เดิมทุกจุด (รวม behavior: PUT อัปเดตเฉพาะ field ที่ส่ง, POST ข้ามค่าว่าง) — ไม่แตะไฟล์อื่นนอกจาก 2 ไฟล์ที่ได้รับมอบหมาย

---
Task ID: 5-e
Agent: inventory+requests+alerts+map+admin subagent
Task: เขียนโมดูล inventory, requests, alerts, map (GIS), admin ทับ placeholder

Work Log:
- inventory.tsx: ModuleHeader + StatCard 4 ใบ (รายการ/ปริมาณรวม/สต๊อกต่ำ tone red/คลัง) + Tabs "สินค้า|คลังสินค้า" + ตาราง (badge หมวด, แถวสต๊อกต่ำเน้นแดง + Badge "ต้องเติม") + Quick adjust ปุ่ม +/- ปรับ ±10 (PUT partial) + ฟอร์มเต็ม (หมวด/หน่วย/ปริมาณ/จุดต่ำ/คลัง/วันหมดอายุ date→ISO) + การ์ดคลัง (name/manager/_count.items) + ลบ confirm + toast ทุกจุด
- requests.tsx: StatCard 4 (ทั้งหมด/รอพิจารณา/กำลังดำเนินการ/สำเร็จ) + ค้นหา (code/ผู้ขอ/รายละเอียด) + filter priority+status + ตาราง 9 คอลัมน์ (รหัส font-mono) + Workflow: pending→อนุมัติ(Check emerald)/ปฏิเสธ(X slate), approved→เริ่มดำเนินการ(Play violet), in_progress→สำเร็จ(CheckCircle emerald) ทุกปุ่ม PUT+toast + ฟอร์ม wide (status เฉพาะตอนแก้ไข, quantity เป็นข้อความตาม schema String, Select เหตุการณ์จาก /api/incidents)
- alerts.tsx: StatCard 4 (ทั้งหมด/ร่าง/กำหนดส่ง/ส่งแล้ว) + การ์ด grid sm:grid-cols-2 พร้อม icon ตาม severity (Info teal/TriangleAlert amber/Siren red) + badges severity/channel/audience/status + เหตุการณ์ที่โยง + fmtDateTime sentAt/scheduledAt + ปุ่ม "ส่งเดี๋ยวนี้" (status≠sent → PUT status=sent) + ฟอร์ม (scheduledAt datetime-local แสดงเมื่อ status=scheduled, ISO แปลง 2 ทาง)
- map.tsx: SVG viewBox 800x600 วาดด้วย projection lat 18.0–19.2 / lng 98.5–101.0 → x=(lng-98.5)/2.5*800, y=(19.2-lat)/1.2*600 + pattern กริดจาง + แม่น้ำปิง path โค้งเหนือ→ใต้ (teal stroke 14) + ภูเขามุมบนซ้าย/ขวา (เขียวจาง) + Legend 4 สี severity + shelter violet + marker เหตุการณ์ circle r=10 + รหัสด้านบน + ศูนย์พักพิง rect 14x14 violet + จุดไร้พิกัดกระจาย deterministic พร้อม dashed circle "ตำแหน่งโดยประมาณ" + คลิก marker/แถวตาราง → แผงรายละเอียด (ขวาบน desktop, ล่างบนมือถือ) พร้อม Progress occupancy + ตารางสรุปเหตุการณ์คลิกได้
- admin.tsx: Tabs 4 — ผู้ใช้ (ตาราง+CRUD+ฟอร์ม role/status), บันทึกกิจกรรม (timeline max-h-96 overflow-y-auto + action badge), ตั้งค่า (การ์ด key/value อ่านอย่างเดียว, key แปลงขีด→วรรค), เกี่ยวกับระบบ (อธิบายที่มาจาก Sahana Eden eden-core/web2py + grid 12 โมดูลสถานะ "ใช้งานได้" + tech stack Next.js 16/Prisma/SQLite/shadcn/ui)
- ตรวจสอบ: bunx eslint --fix ทั้ง 5 ไฟล์ → 0 errors, tsc --noEmit → 0 errors เฉพาะ src/components/eden, dev.log ไม่มี compile error, GET / 200, ทดสอบ PUT partial quantity สำเร็จ (850→860→850)

Stage Summary:
- โมดูลทั้ง 5 เสร็จสมบูรณ์ตามสเปค: CRUD ครบ + toast + confirm delete + Loading/Empty/Error ทุกมุมมอง + workflow คำขอ + ส่งแจ้งเตือน + แผนที่ SVG interactive ไม่เพิ่ม dependency
- คงเหลือ: โมดูล dashboard/incidents/sitreps/persons/organizations/hr/shelters (subagent 5-a..5-d ทำขนาน) และงานตรวจรวม (task 6)

---
Task ID: 6
Agent: main (Z.ai Code)
Task: ตรวจสอบ end-to-end ด้วย Agent Browser

Work Log:
- bun run lint ผ่าน 0 errors ทั้งโปรเจกต์
- Agent Browser เปิด / → render สำเร็จ ไม่มี error boundary / hydration crash
- ทดสอบเส้นทางหลักครบทุกโมดูล (12 โมดูล):
  * Dashboard: emergency banner, KPI 6 ใบ, AreaChart+PieChart (recharts), การกระจายผู้ประสบภัย, shelter occupancy
  * Incidents: ตรวจตาราง → สร้างเหตุการณ์ใหม่ผ่านฟอร์ม → พบ bug (code required) → แก้ API สร้าง code อัตโนมัติ (INC-2569-005) → ลบสำเร็จผ่าน confirm dialog
  * Sitreps: tabs filter, การ์ดรายการ, ปุ่มอ่านเต็ม
  * Map GIS: SVG แม่น้ำปิง+ภูเขา, marker สีตาม severity, คลิก marker → แผงรายละเอียดแสดงข้อมูลถูกต้อง
  * Requests: workflow จริง — กดอนุมัติ REQ-2568-003 → สถานะเปลี่ยน ปุ่มเปลี่ยนเป็น "เริ่มดำเนินการ"
  * Alerts: การ์ด severity icons, ปุ่มส่งเดี๋ยวนี้, badges ครบ
  * Persons: tabs สถานะ, ปุ่ม "พบตัวแล้ว" quick action, ตาราง 12 รายการ
  * Organizations: การ์ด 6 องค์กร + จำนวนบุคลากรโยง
  * HR: ทักษะเป็น badges, สถานะปฏิบัติงาน
  * Shelters: occupancy bar emerald/amber/red ถูกต้อง (80%/77%/76%/48%)
  * Inventory: สต๊อกต่ำเน้นแดง (ชุดยา 96/100, เต็นท์ 45/50), ปุ่ม ±
  * Admin: users CRUD UI, audit log 17 รายการ (รวม actions จากการทดสอบจริง), settings, about
- Responsive: iPhone 15 viewport — hamburger menu เปิดได้, ตาราง scroll แนวนอน, layout ไม่พัง
- Sticky footer ยืนยัน: หน้าสั้น footer ติดล่าง, หน้ายาวถูก push ลง (เห็นใน screenshot ทุกโมดูล)
- dev.log: error เก่าทั้งหมดอยู่ก่อน fix (line 8784-8810 / 9428); API ทุกตัว 200 หลังแก้

Stage Summary:
- ✅ ระบบ EDEN DMS สมบูรณ์ 12 โมดูล — browser-verified ทุกโมดูล
- แก้ bug ระหว่างทดสอบ 1 จุด: POST /api/incidents สร้าง code อัตโนมัติเมื่อฟอร์มไม่ส่ง
- ผ่าน lint 0 errors, ไม่มี runtime error ใหม่ใน dev.log

---
Task ID: 7 (hotfix)
Agent: main (Z.ai Code)
Task: แก้ hydration error — "Hydration failed because the server rendered text didn't match the client"

Work Log:
- วิเคราะห์สาเหตุ: ผู้ใช้แจ้ง hydration mismatch ตอนโหลดหน้า / — ตรวจ SSR render path (page.tsx → Shell + DashboardModule)
- พบต้นตอที่ src/components/eden/dashboard.tsx:559 — ModuleHeader เรียก `fmtDateTime(new Date())` ระหว่าง render ตอน SSR ทำให้เวลาที่ server (UTC) กับ client (Asia/Bangkok +7) ต่างกัน 7 ชม. → text mismatch ตอน hydrate
- แก้ dashboard.tsx: ย้ายการคำนวณ timestamp "อัปเดตล่าสุด" ไปทำใน useEffect หลัง mount (พร้อม re-run เมื่อ data เปลี่ยนจาก refetch) — SSR กับ client render ครั้งแรกตรงกัน 100%
- Harden src/lib/constants.ts: เพิ่ม `timeZone: 'Asia/Bangkok'` ให้ fmtDate/fmtDateTime เพื่อให้ format deterministic เหมือนกันทั้ง server และ client
- Harden จุด format วันที่ inline: dashboard.tsx (fmtTrendDate), persons.tsx (lastSeenAt toLocaleString)
- ตรวจ grep ทั้ง src/ ยืนยันไม่มี Math.random()/Date.now() ใน initial render path อื่น (sidebar Skeleton ไม่ถูก render)
- bun run lint ผ่าน, browser verify ด้วย agent-browser: reload หน้า / ไม่มี hydration error ใน console, สลับโมดูล incidents/persons/shelters โหลดข้อมูลจริงครบ, ทดสอบ viewport iPhone 14 render ถูกต้อง

Stage Summary:
- สาเหตุ: เรียก new Date() + toLocaleString('th-TH') ระหว่าง SSR render — server TZ (UTC) ≠ client TZ (Bangkok)
- แก้แล้ว 3 ไฟล์: dashboard.tsx (root cause + fmtTrendDate), constants.ts (fmtDate/fmtDateTime), persons.tsx (inline formatter)
- Browser-verified: console สะอาด ไม่มี hydration warning, golden path ทุกโมดูลทำงานปกติ, mobile responsive ปกติ

---
Task ID: 8 (verification)
Agent: main (Z.ai Code)
Task: ตรวจสอบว่าทุกโมดูลทำงานและแสดงผลครบ (ผู้ใช้ถาม "ทุกโมดูล ทำงาน และแสดงผล?")

Work Log:
- agent-browser คลิกไล่ทั้ง 12 โมดูลผ่าน sidebar บน viewport 1280x800
- dashboard: KPI + timestamp หลัง mount + กราฟ + ศูนย์พักพิง ✅
- incidents: ตาราง INC-2568-001..004 + ปุ่มดูรายละเอียด/แก้ไข/ลบ ✅
- sitreps: การ์ด SITREP 5 ฉบับ ✅
- map: SVG map marker 4 เหตุการณ์ + ศูนย์พักพิง + ตำนานสี + พิกัด ✅ (screenshot ยืนยัน)
- requests: ตาราง REQ-2568-001 ครบ priority/status/ผู้ขอ/ผู้รับผิดชอบ ✅
- alerts: การ์ดแจ้งเตือน 5 รายการ ✅
- persons: 12 คน + tab filter ทดสอบคลิก tab "สูญหาย (3)" กรองได้จริง ✅
- organizations: การ์ด 6 องค์กร ✅
- hr: ตารางบุคลากร + ทักษะ + หน่วยงาน + ปุ่มเปลี่ยนสถานะ ✅
- shelters: การ์ด 5 แห่ง (recheck นับได้ 5) ✅
- inventory: KPI 10 รายการ/4,743 หน่วย/สต๊อกต่ำ 2 + ตารางสินค้า + tablist ✅
- admin: tab ผู้ใช้ (ตาราง 5 users) + tab บันทึกกิจกรรม (17 records) + ตั้งค่า/เกี่ยวกับระบบ ✅
- errors/console ตรวจสุดท้าย: สะอาด ไม่มี hydration/error/warning

Stage Summary:
- ทั้ง 12 โมดูล render สำเร็จ ข้อมูลจริงจาก API แสดงครบ interaction (tab filter) ทำงาน
- ไม่มี page error / console error / hydration error

---
Task ID: 9 (bugfix)
Agent: main (Z.ai Code)
Task: แก้ "หาคลัง ไม่พบ" — ช่องค้นหาในโมดูลคลังสินค้าค้นเจอคลังไม่ได้

Work Log:
- Reproduce ใน browser: พิมพ์ "คลัง" ในช่องค้นหาโมดูลคลังสินค้า → "พบ 0 รายการ / ไม่พบรายการสินค้า" ทั้งที่คอลัมน์ "คลัง" แสดงชื่อคลังอยู่
- สาเหตุ: inventory.tsx filtered() กรองเฉพาะ it.name (ชื่อสินค้า) — เป็นโมดูลเดียวที่ search แคบ (grep ตรวจทุกโมดูล: incidents/admin/organizations/hr/alerts/sitreps/shelters/persons ครอบคลุมหลาย field อยู่แล้ว)
- แก้ inventory.tsx: ค้นหาจาก ชื่อสินค้า + ชื่อคลัง (it.warehouse?.name) + ชื่อหมวด (ITEM_CATEGORIES label) และเปลี่ยน placeholder เป็น "ค้นหาสินค้า หมวด หรือคลัง..."
- bun run lint ผ่าน
- Browser verify: ค้นหา "คลัง" → พบ 10, "เชียงใหม่" → พบ 4, "ยา" → 2 รายการ, "น้ำดื่ม" → พบ 1
- Tab "คลังสินค้า" แสดงการ์ด 3 คลังครบ (ภาคเหนือตอนบน/น่าน/เชียงใหม่) — screenshot ยืนยัน
- console สะอาด ไม่มี error

Stage Summary:
- ค้นหาใน inventory ตอนนี้ตรงกับคอลัมน์ที่แสดงในตารางทั้งหมด (ชื่อสินค้า/หมวด/คลัง)
- ไม่กระทบโมดูลอื่น

---
Task ID: 10 (ui-fix)
Agent: main (Z.ai Code)
Task: ปรับแถบเมนูด้านซ้าย (sidebar) ให้เลื่อนขึ้นลงได้

Work Log:
- วิเคราะห์ shell.tsx: เมนูใช้ ScrollArea (Radix) แบบ flex-1 แต่ไม่มี min-h-0 → flex child มี min-height:auto เป็นค่า default ทำให้พื้นที่เมนูขยายตามเนื้อหา เนื้อหาล้นขอบล่างแบบเลื่อนไม่ได้ (flexbox classic bug)
- แก้ shell.tsx: เปลี่ยน ScrollArea เป็น <nav> แบบ native overflow-y-auto + min-h-0 + overscroll-contain พร้อม custom scrollbar (w-1.5, thumb slate-700, thin/Firefox) — รองรับ wheel/touch/keyboard ทุกอุปกรณ์ และเอา import ScrollArea ที่ไม่ใช้แล้วออก
- bun run lint ผ่าน
- Browser verify desktop 1280x600 (บังคับ overflow): nav scrollHeight 687 / clientHeight 462 → canScroll true; scrollTop ถึง max 225; ปุ่ม "ผู้ดูแลระบบ" มองเห็นเต็มที่ล่างสุด (gapFromNavBottom 16px = padding); scrollIntoView เลื่อน container ได้จริง; screenshot ยืนยัน logo ปักบน + ข้อมูลเวอร์ชันปักล่าง ระหว่างนั้นเมนูเลื่อนเฉพาะกลาง
- Browser verify mobile drawer 390x700: navCount 2 (desktop hidden + drawer) — ตัว visible scrollHeight 687 / clientHeight 562 → canScroll true; scrollIntoView ถึง "ผู้ดูแลระบบ" ได้ (เดิมถูกตัดที่ "คลังสินค้า"); screenshot ยืนยัน

Stage Summary:
- สาเหตุ: flex-1 ขาด min-h-0 → พื้นที่ scroll ไม่ถูกจำกัดความสูง เนื้อหาล้นแบบเลื่อนไม่ได้
- แก้ shell.tsx เดียว (nav เลื่อนได้ทั้ง desktop sidebar และ mobile drawer — ใช้ component เดียวกัน)
- ไม่กระทบ layout อื่น, lint ผ่าน

---
Task ID: 11 (feature)
Agent: main (Z.ai Code)
Task: ยกระดับโมดูลคลัง — รองรับเครื่องมือ/เวชภัณฑ์/อาหาร/เชื้อเพลิง/สิ่งของบรรเทาทุกข์ + หมวดหมู่/ประเภท/ขนาด/จำนวน/expire date

Work Log:
- Prisma: เพิ่ม InventoryItem.type (ประเภท) + .size (ขนาด), Warehouse.purpose (ประเภทคลัง) → db push สำเร็จ
- constants.ts: ITEM_CATEGORIES เพิ่ม fuel(เชื้อเพลิง), relief(สิ่งของบรรเทาทุกข์), relabel tools เป็น เครื่องมือ/อุปกรณ์, เปลี่ยนสี badge ให้ต่างกันครบ 10 หมวด
- API: เพิ่ม type/size ใน fields ทั้ง /api/inventory และ /api/inventory/[id] (พบ bug ระหว่าง verify: PUT ใช้ cfg ของไฟล์ [id] ที่ยังเป็น fields เก่า → type บันทึกไม่ได้ แก้แล้ว), searchFields เพิ่ม type/size
- seed: คลัง 3 แห่งมี purpose, สินค้า 14 รายการมี type/size/expiryDate + เพิ่มแก๊ส LPG, น้ำมันเบนซิน, ชุดบรรเทาทุกข์, จอบเสียมเลื่อย → re-seed สำเร็จ
- UI inventory.tsx: ฟอร์มเพิ่ม field ประเภท+ขนาด (grid 2 col), ตารางเพิ่มคอลัมน์ ประเภท/ขนาด, search ครอบ ชื่อ+ประเภท+ขนาด+คลัง+หมวด, การ์ดคลังแสดง badge purpose, tabs เปลี่ยนเป็น รายการสิ่งของ/คลังทั้งหมด, ป้ายทั้งหมดจาก คลังสินค้า → คลังสิ่งของ (shell/page/admin/layout)
- Bug ระหว่างทาง: dev server ค้าง Prisma client เก่าหลัง db push → restart แก้; UI edit ยิง PUT แต่ [id] route กรอง type ทิ้ง → เพิ่ม fields แล้ว
- Verify browser: ตารางแสดง type/size ✅, filter เชื้อเพลิง = 2 รายการ ✅, สร้างรายการใหม่ผ่านฟอร์ม (เตาแก๊สฯ + แก้ไขประเภทผ่าน dialog) ✅, ค้นหา "600ml" เจอจากขนาด ✅, การ์ดคลังมี badge ประเภทคลัง ✅, lint ผ่าน, console สะอาด

Stage Summary:
- โมดูลคลังรองรับของหลากหลายประเภท: 10 หมวดหมู่ (อาหาร/น้ำดื่ม/เวชภัณฑ์/เครื่องมือ/เชื้อเพลิง/บรรเทาทุกข์/เครื่องนุ่งห่ม/ที่พักพิง/สุขอนามัย/อื่นๆ)
- ข้อมูลรายการครบ: ชื่อ+หมวด+ประเภท+ขนาด+จำนวน+จุดต่ำ+คลัง+วันหมดอายุ
- คลังมีประเภท (purpose) แสดงบนการ์ด

---
Task ID: 12 (feature)
Agent: main (Z.ai Code)
Task: คลังต้องระบุหน่วยงานเจ้าของ + เมนูหน่วยงานเห็น "คน และ สิ่งของ" — ทุกอย่างสัมพันธ์กัน (Org ↔ Warehouse ↔ Item ↔ HR)

Work Log:
- Prisma: Warehouse เพิ่ม organizationId + organization relation, Organization เพิ่ม warehouses[] → db push สำเร็จ (FK optional, ลบ org แล้วคลัง SetNull, ลบคลังแล้วสินค้า SetNull)
- API: /api/warehouses เพิ่ม fields organizationId + include organization + เพิ่ม POST; สร้าง /api/warehouses/[id] (GET/PUT/DELETE) ใหม่ (เดิมมีแค่ GET list — สร้าง/แก้/ลบคลังไม่ได้เลย); /api/inventory + [id] include warehouse.organization; /api/organizations _count เพิ่ม warehouses; /api/organizations/[id] include resources + warehouses{items}
- seed: คลัง 3 แห่งผูกหน่วยงานตามภารกิจ — กลางเชียงใหม่(อาหาร/น้ำ)→IFRC, ภาคเหนือตอนบน(เวชภัณฑ์)→สภากาชาดไทย, น่าน(เครื่องมือ/พักพิง/เชื้อเพลิง)→กรมป้องกันฯ → re-seed สำเร็จ
- inventory.tsx: คอลัมน์ใหม่ "คลัง / หน่วยงานเจ้าของ" (ชื่อคลัง + Building2 icon + ชื่อ org), การ์ดคลังแสดงกล่อง "หน่วยงานเจ้าของ" + ความจุ + ปุ่มแก้ไข/ลบ + ปุ่ม "เพิ่มคลังใหม่", ฟอร์มคลังใหม่ (ชื่อ*, หน่วยงานเจ้าของ Select, ประเภท, ความจุ, ผู้ดูแล, โทร, ที่อยู่), ฟอร์มสินค้า Select คลังแสดง "ชื่อคลัง — ชื่อหน่วยงาน", ค้นหาครอบชื่อหน่วยงานด้วย
- organizations.tsx: การ์ดแสดง "บุคลากร X คน · คลัง Y แห่ง" + ปุ่ม Eye "ดูคนและสิ่งของ" → Dialog รายละเอียด 3 section: บุคลากรในสังกัด (max-h-56 scroll, badge ประเภท+สถานะ), คลังของหน่วยงาน, สิ่งของในความรับผิดชอบ (ตารางรวมทุกคลัง: ชื่อ/หมวด/ประเภทขนาด/ปริมาณ/คลัง/หมดอายุ, max-h-72 scroll) + empty state ครบ
- Bug ระหว่างทาง: (1) หลัง db push dev server ถือ Prisma client เก่า → ทุก API 500 "Unknown field warehouses" → restart dev server แก้; (2) Dialog รายละเอียด render null ตอน loading ทำให้ Radix warning "DialogContent requires DialogTitle / Missing Description" → ย้าย DialogHeader ออกนอกเงื่อนไข (แสดง "ข้อมูลหน่วยงาน + กำลังโหลด..." ระหว่างรอ) → console สะอาด
- Verify (agent-browser): ตารางสินค้าแสดงคลัง+หน่วยงาน ✅, ค้นหา "กาชาดนานาชาติ" เจอ 5 รายการ ✅, tab คลังแสดงการ์ดหน่วยงานเจ้าของ 3 คลัง ✅, สร้างคลังใหม่ผ่านฟอร์มเลือก org สภากาชาดไทย ✅, ลบคลังผ่าน confirm ✅, org detail สภากาชาดไทย = คน 3 + คลัง 1 + สิ่งของ 4 ✅, org ว่าง = empty state ✅, iPhone 14 dialog 358px พอดีจอ scroll ได้ ✅, dashboard regression ปกติ ✅, lint ผ่าน, console 0 warning/error

Stage Summary:
- สายความสัมพันธ์ครบ: Organization → HumanResource (คน), Organization → Warehouse → InventoryItem (คลัง+สิ่งของ) — เห็นได้ทั้งจากฝั่งคลัง (เจ้าของคลังบนตาราง/การ์ด/ค้นหา) และฝั่งหน่วยงาน (ปุ่มดูคน+สิ่งของใน dialog)
- คลังจัดการได้เต็มรูปแบบ (CRUD ครบครั้งแรก) พร้อมหน่วยงานเจ้าของ
- console สะอาด ไม่มี warning, ผ่าน lint, browser-verified ทั้ง desktop + mobile

---
Task ID: 13 (data)
Agent: main (Z.ai Code)
Task: เพิ่มข้อมูลสถานการณ์และเหตุการณ์น้ำท่วม รวมถึงการจัดการต่างๆ ของไทย ช่วง ก.ย.–ต.ค. 2569 (อ้างอิงเหตุการณ์จริง)

Work Log:
- วิจัยข้อมูลจริงด้วย web_search + page_reader (AP News, Wikipedia "2026 Bangkok floods", Thai PBS, ปภ./NBT): อุทกภัยทั่วประเทศตั้งแต่ 16 ก.ย. 69 (42 จังหวัด 2.6 ล้านคน เสียชีวิต 19→31→40 ราย), น้ำท่วมใหญ่ กทม. 24–30 ก.ย. 69 (พายุดีเปรสชัน, ประกาศภาวะฉุกเฉิน 26 ก.ย. 10:16 น., ฝน 300+ มม., จุดท่วม 37 จุด, 50 เขตเป็นพื้นที่ภัยพิบัติ, ผู้ประสบภัย 700,000 คน, วันหยุดพิเศษ 28–29 ก.ย.), ครม. อนุมัติ 4,100 ล้านบาท (29 ก.ย.), เยียวยา 9,000 บาท/ครัวเรือน (ครม. 2 ก.ย.), ลงทะเบียนผ่านแอป 65 จังหวัด+50 เขต (กว่า 1 ล้านครัวเรือน ณ 5 ต.ค.), สุวรรณภูมิกระเป๋าตกค้าง+กองทัพอากาศช่วย, เขื่อนภูมิพล 35 / สิริกิติ์ 93 ลบ.ม./วิ, ความเสียหาย 11,000+ ล้านบาท
- prisma/seed.ts: เปลี่ยนรหัสเหตุการณ์เดิมเป็น INC-2569-001..004 + ใช้วันที่ absolute (ISO +07:00) และเพิ่ม 4 เหตุการณ์ใหม่ INC-2569-005 อุทกภัยรอบด้าน 42 จังหวัด (critical/active, 2.6M คน, เสียชีวิต 40), INC-2569-006 น้ำท่วมใหญ่ กทม. (critical/monitoring, 700K, เสียชีวิต 4), INC-2569-007 ลุ่มเจ้าพระยาตอนล่าง (high/monitoring, 318K), INC-2569-008 ภาคใต้ฝั่งอ่าวไทย (medium/monitoring, 176K)
- Locations เพิ่ม: กทม., นนทบุรี, ปทุมธานี, อยุธยา + เขตบางกะปิ/บึงกุ่ม/ลาดสี
- SITREP ใหม่ 10 ฉบับ (รวม 14): ไทม์ไลน์จริง 18 ก.ย. (12 จังหวัด+เฝ้าระวัง 70), 26 ก.ย. (ประกาศภาวะฉุกเฉิน), 28 ก.ย. (1.8M+วันหยุดพิเศษ), 29 ก.ย. (4,100 ล้านบาท + สุวรรณภูมิ), 30 ก.ย. (น้ำลด), 1 ต.ค. (ลงทะเบียนเยียวยา), 5 ต.ค. (เสียชีวิต 31), 6 ต.ค. (สรุป 40 ราย/11,000 ล้านบาท/เขื่อนไม่ท่วมภาคกลาง) + ร่างแผนฟื้นฟู กทม.
- Organizations +3: สำนักการระบายน้ำ กทม., กรมชลประทาน, กองทัพอากาศไทย (รวม 9 องค์กร); HR +4: วิศวระบายน้ำ กทม., โลจิสติกส์ ทอ., นักวิชาการชลประทาน, อาสาปั๊มน้ำ ปภ. (รวม 12)
- Shelters +6 (รวม 11): รร.บางกะปิ, วัดบึงกุ่ม, สนามกีฬาลาดสี, ศูนย์ราชการปากเกร็ด, รร.อยุธยา, ศาลากลางปทุมธานี; Persons +12 (รวม 24) รวมผู้เสียชีวิต 3 รายจริงจากเขตบึงกุ่ม (ไฟดูด/จมน้ำ/ผู้ป่วยติดเตียง)
- Warehouse +1 คลังบรรเทาทุกข์ ปภ. บางเขน (เจ้าของ = ปภ.) + สินค้าใหม่ 8 รายการ: ถุงทราย 5,200, ปั๊มน้ำ 68, เรือยาง 22, เสื้อชูชีพ 1,800, ชุดยังชีพ 1,500, ยาฆ่าเชื้อ, น้ำดื่ม 1.5L, บูทยาง (รวม 22 รายการ)
- AidRequests +6 (REQ-2569-001..006): น้ำดื่ม 50 เขต, เรืออพยพซอยลึก, หน่วยแพทย์ผู้ป่วยติดเตียง, กำลังคนสุวรรณภูมิ, ปั๊มน้ำบึงกุ่ม–ลาดพร้าว, เยียวยา 9,000 บาท (fulfilled); Alerts +6 (รวม 11): ภาวะฉุกเฉิน 26 ก.ย. (critical/SMS/ส่งแล้ว), เฝ้าระวัง 70 จังหวัด, วันหยุดพิเศษ, ลงทะเบียนเยียวยา, ฝนตกหนัก 5 ต.ค., ร่างเรียกอาสา
- MapLayers +4 (รวม 7): เขตภัยพิบัติ 50 เขต กทม. (polygon สีแดง), พื้นที่น้ำท่วมลุ่มเจ้าพระยา (polygon สีส้ม), จุดช่วยเหลือ/ปั๊มน้ำ 6 จุด (violet), เส้นทางน้ำเหนือเจ้าพระยา (url_geojson สาธิตชั้นแบบ API); Settings เพิ่ม active_operation
- UI fix: dashboard KPI "ผู้ประสบภัย" 3,807,450 ล้นการ์ด → แสดง "3.81 ล้าน" (≥1M ใช้ toFixed(2) ล้าน) + sub แสดงตัวเลขเต็ม
- ตรวจสอบ: seed สำเร็จ (incidents 8, reports 14, persons 24, orgs 9, hr 12, shelters 11, items 22, requests 12, alerts 11, mapLayers 7), agent-browser ครบ: dashboard KPI/banner/กราฟ ✅, incidents ตาราง 8 เหตุการณ์ ✅, sitreps การ์ด SITREP #8/#9 ✅, map ซูมไป กทม. เห็น 4 เลเยอร์ใหม่ซ้อนกัน + สลับภาพดาวเทียม Esri ทำงาน ✅, shelters 11 ✅, persons 24 + tab เสียชีวิต ✅, requests/alerts โยง INC-2569-005/006 ✅, inventory คลังใหม่+สินค้า ✅, orgs 9 ✅, hr 12 ✅, iPhone 14 responsive ✅, console 0 error, lint ผ่าน

Stage Summary:
- ระบบมีข้อมูลเหตุการณ์จริงอุทกภัยไทย ก.ย.–ต.ค. 2569 ครบวงจร: เหตุการณ์ 8 → SITREP 14 → ผู้ประสบภัย 24 → ศูนย์พักพิง 11 → คำขอ 12 → แจ้งเตือน 11 → คลัง 4 → องค์กร 9 → ชั้นแผนที่ 7 โยงความสัมพันธ์ถึงกันทั้งหมด (incidentId บน reports/persons/requests/alerts + layers แผนที่รองรับพื้นที่จริง)
- มาตรการจัดการของรัฐถูกบันทึกครบในระบบ: ประกาศภาวะฉุกเฉิน 26 ก.ย., วันหยุดพิเศษ 28–29 ก.ย., เงินฉุกเฉิน 4,100 ล้านบาท, เยียวยา 9,000 บาท/ครัวเรือน + ลงทะเบียนผ่านแอป, มาตรการ ปภ. 14 ข้อ/7 ข้อ, กองทัพอากาศช่วยสุวรรณภูมิ, การบริหารเขื่อน
- Dashboard KPI รองรับตัวเลขระดับล้านแล้ว (ไม่ล้นการ์ด)

---
Task ID: 14 (feature)
Agent: main (Z.ai Code)
Task: เพิ่ม AI Assistance — bot ผู้เชี่ยวชาญการจัดการภัยพิบัติ รับคำถาม → วิเคราะห์ → ตอบ + คำแนะนำที่จำเป็น ค้นข้อมูลใน Platform และภายนอกได้

Work Log:
- โหลด skill LLM + web-search (z-ai-web-dev-sdk ฝั่ง backend เท่านั้น)
- สร้าง API `src/app/api/ai-assistant/route.ts` (POST): รับ { question, history (≤8 ข้อความ), usePlatform, useWeb } → รวบรวมบริบทแบบขนาน:
  - usePlatform: query Prisma 9 ชุด (เหตุการณ์/SITREP 6 ล่าสุด/ศูนย์พักพิง+occupancy/คลัง+low-stock/คำขอ/แจ้งเตือน/บุคคล+สูญหาย/องค์กร/บุคลากร) แปลงเป็นข้อความภาษาไทย "[ข้อมูลจากระบบ EDEN DMS]" (ป้ายสถานะแปลไทยครบ, เวลา Asia/Bangkok)
  - useWeb: web_search num 6 (เพิ่ม recency_days 45 ถ้าคำถามมีคำ "ล่าสุด/ตอนนี้/ปัจจุบัน/ข่าว...") → "[ผลค้นหาจากภายนอก]" + sources [{name,url,host,snippet}]
  - System prompt: "EDEN AI" ผู้เชี่ยวชาญภัยพิบัติ (ICS/แผนรับมือภัยพิบัติแห่งชาติ ปภ./Sendai/OCHA) — ตอบไทย markdown, ใช้ตัวเลขระบบเป็นหลัก ห้ามแต่งตัวเลข, อ้าง [1][2] ตามแหล่งภายนอก, ปิดท้าย "### คำแนะนำที่จำเป็น", เหตุฉุกเฉินเริ่มด้วย ⚠️ โทร 1669/1784
  - SDK instance singleton reuse, คืน { answer, sources, usedPlatform, usedWeb }, error handling ครบ (platform/web ล้มเหลวรายตัวไม่ทำคำตอบล้มทั้งหมด)
- สร้าง UI `src/components/eden/ai-assistant.tsx`: hero การ์ด + 4 badge ความสามารถ; การ์ดแชท (ข้อความ h-[58vh] เลื่อนได้ custom scrollbar, ฟอง user สีเขียว/assistant ขาว, welcome message markdown, typing dots animation); คำตอบ render ReactMarkdown + กล่อง "แหล่งข้อมูลภายนอกที่อ้างอิง" ลิงก์ target=_blank + ป้าย "ใช้ข้อมูลในระบบ"/"ค้นหาจากภายนอก"; แถบ Switch 2 ตัว (ใช้ข้อมูลในระบบ default ON / ค้นหาภายนอก default OFF) + Textarea Enter ส่ง Shift+Enter ขึ้นบรรทัด + ปุ่มล้างแชท; แถบข้าง: KPI สด 8 ค่าจาก /api/stats, ตัวอย่างคำถาม 5 (คลิกส่งทันที, บางข้อ auto เปิด web), การ์ดสายด่วน 1669/1784/199
- เชื่อมเมนู: shell.tsx เพิ่ม ModuleKey 'assistant' + กลุ่ม "ผู้ช่วยอัจฉริยะ" (ไอคอน Bot ไว้ใต้ ภาพรวม), page.tsx เพิ่ม TITLES + render
- Bug ระหว่างทาง: MultiEdit ทำ `from 'lucide-react'` หาย → parsing error ตรวจพบด้วย lint แก้แล้ว; ระหว่าง verify ใช้ wait condition "คำแนะนำที่จำเป็น" ไป match ข้อความ welcome เอง → เปลี่ยนเป็นรอ typing indicator หายแทน
- Verify (agent-browser): เมนูมี "ผู้ช่วย AI" ✅; พิมพ์ถาม "คลังสิ่งของที่ต่ำกว่าจุดต่ำ..." → AI ตอบด้วยข้อมูลจริง (ชุดยาปฐมพยาบาล 96/100 คลังภาคเหนือตอนบน, เต็นท์ 45/50 คลังน่าน, โยง REQ-2569-102/103 ของกาชาดไทย/อบต.เวียงสา) + หัวข้อคำแนะนำที่จำเป็น + ป้าย "ใช้ข้อมูลในระบบ" ✅; เปิดสวิตช์เว็บถามข่าวน้ำท่วม → ตอบพร้อมกล่องแหล่งอ้างอิง 6 แห่ง (floodboard.org/onwr/tmd/thairath/thaipbs) คลิกได้ + ป้าย "ค้นหาจากภายนอก" ✅; quick prompt บนจอเล็ก auto เว็บ → ตอบข้อมูลระบบ+ภายนอก [1]-[6] (gistda/tmd/dmh) ✅; curl API ทั้ง 2 โหมด 200 ✅; มือถือไม่มี horizontal overflow แชทเลื่อนได้ ✅; regression dashboard+footer sticky ปกติ ✅; console 0 error, lint ผ่าน, POST /api/ai-assistant 200 (~40-47 วิ/คำถาม)

Stage Summary:
- โมดูลที่ 13 "ผู้ช่วย AI" พร้อมใช้งาน: ผู้เชี่ยวชาญภัยพิบัติที่รับคำถาม วิเคราะห์ ตอบพร้อมคำแนะนำเชิงปฏิบัติการปิดท้ายทุกคำตอบ
- ค้นข้อมูลคู่ขนานได้: ในแพลตฟอร์ม (ข้อมูลจริงจาก Prisma ทุกโมดูล — เหตุการณ์/SITREP/คลัง/ศูนย์พักพิง/คำขอ/แจ้งเตือน/บุคคล) + ภายนอก (web search พร้อมแหล่งอ้างอิงคลิกได้)
- ผู้ใช้คุมแหล่งข้อมูลด้วยสวิตช์ 2 ตัว + quick prompts, คำตอบอ้างรหัสเหตุการณ์/คำขอจริงได้ (RAG pattern ด้วยข้อมูล platform ณ เวลาถาม)

---
Task ID: 15 (bugfix)
Agent: main (Z.ai Code)
Task: ปรับให้เลื่อนหน้าขึ้นลงในพื้นที่ chat ของโมดูลผู้ช่วย AI ได้

Work Log:
- วิเคราะห์ screenshot + วัด DOM: div ข้อความแชทใช้ `flex-1` ใน Card (flex column) ที่ความสูง auto → flex-basis 0% กับ container สูงไม่แน่นอน resolve เป็นขนาดเนื้อหา (min-height:auto ของ flex item) → พื้นที่แชทขยายตามคำตอบยาว ไม่เคย overflow ภายใน → เลื่อน "ในแชท" ไม่ได้ หน้าเว็บเลื่อนทั้งหน้าแทน (อาการเดียวกับ sidebar Task 10)
- แก้ ai-assistant.tsx 2 จุด: (1) div ข้อความ เอา flex-1 ออก → กำหนดความสูงแน่นอน `h-[56dvh] min-h-[420px]` (dvh กัน toolbar มือถือ) คง overflow-y-auto + overscroll-contain + custom scrollbar; (2) Card แชทเพิ่ม `self-start` ไม่ยืดตามความสูง column ขวา กันช่องว่างใต้ช่องพิมพ์
- bun run lint ผ่าน
- Verify (agent-browser, 1280x800 คำตอบยาว 2277px): ความสูงพื้นที่แชท fix ที่ 448px, scrollHeight 2277 → เลื่อนภายในได้; scrollTop ถึง 0 (ขึ้นสุด) และ max 1829 (ล่างสุด) ได้จริง; auto-scroll ยังติดล่างเมื่อคำตอบมาใหม่; Card จบที่ช่องพิมพ์ (840px) ไม่มีช่องว่างแปลก; iPhone 14 (390px): clientH 473 (min-h ทำงาน), scrollH 3587 เลื่อนขึ้น/ลงได้ ไม่มี horizontal overflow; console สะอาด

Stage Summary:
- พื้นที่ chat เลื่อนขึ้นลงภายในได้จริงทั้ง desktop และมือถือ — หน้าเว็บไม่ถูกดันยาวตามคำตอบ AI อีกต่อไป
- สาเหตุเดียวกับ Task 10: flex item ใน container สูง auto → ใช้ความสูงแน่นอนแทน flex-1 (บทเรียนซ้ำ: พื้นที่ scroll ต้องมีความสูง definite เสมอ)

---
Task ID: 16
Agent: main (Z.ai Code)
Task: Push แพลตฟอร์มขึ้น GitHub (https://github.com/sungkomp-ai/) โดยสร้าง repo ใหม่

Work Log:
- ตรวจ token (บัญชี sungkomp-ai ถูกต้อง) + ตรวจสถานะ git: มี history เดิมเป็น commit UUID ไร้ความหมาย และ track ไฟล์ sandbox จำนวนมาก (upload/eden-core-master.zip 25MB + extracted, tool-results/ screenshots, .env, .zscripts, tests, download, examples, Caddyfile, task14/15*.png)
- สแกน secret ใน src/prisma/db (ghp_/sk-/Bearer/AKIA) — ไม่พบ; .env มีเพียง DATABASE_URL path ของ sandbox (ไม่ลับแต่ไม่ควร push เพราะ absolute path เฉพาะเครื่อง)
- เขียน README.md ใหม่ (ภาษาไทย): ภาพรวมระบบ, ตาราง 13 โมดูลพร้อม mapping โมดูล eden-core เดิม, tech stack, ขั้นตอนติดตั้ง (bun install / cp .env.example .env / db:generate / dev), โครงสร้างโปรเจกต์, ตาราง REST API, ส่วนอธิบายผู้ช่วย AI, หมายเหตุ mock data
- สร้าง .env.example (DATABASE_URL=file:../db/custom.db — relative path พกพาได้)
- อัปเดต .gitignore: แยกไฟล์ sandbox (upload/, tool-results/, .zscripts/, tests/, download/, examples/, mini-services/, Caddyfile, /task*.png) + เพิ่ม !.env.example (pattern .env* กลืนไฟล์ตัวอย่างไปก่อน — แก้แล้ว)
- สร้าง clean history ด้วย orphan branch: git checkout --orphan → git rm --cached . → git add -A (เหลือ 15 root items ~1.3MB: src 103 ไฟล์, prisma schema+seed, db/custom.db ข้อมูล seed พร้อมรัน, configs, bun.lock, README, worklog) → commit เดียว "EDEN DMS — Disaster Management System (initial release)" (d494b71) → rename เป็น main
  - เหตุผล: history เดิ่มมี zip 25MB + .env ฝังอยู่ใน commit เก่า — push แบบ full history จะเปียก 31MB และเสี่ยง leak; commit เดียวสะอาดและเบา
- สร้าง repo ใหม่ผ่าน API: POST /user/repos { name: "eden-dms", private: false } → https://github.com/sungkomp-ai/eden-dms
- เพิ่ม remote (token ฝังใน URL เฉพาะ .git/config ในเครื่อง) + git push -u origin main สำเร็จ (new branch main)
- เพิ่ม topics 10 ตัว: disaster-management, nextjs, typescript, prisma, shadcn-ui, tailwindcss, sahana-eden, thailand, gis, ai-assistant
- Verify: git ls-remote origin → HEAD = d494b71 ตรงกับ commit ล่าสุด; GET /contents แบบ authenticated → ไฟล์ครบ 16 root items (.env.example, README.md, db, prisma, src, worklog.md ฯลฯ); default_branch=main, visibility=public (หมายเหตุ: API แบบไม่ใส่ token เจอ rate limit + "size":0 เป็นแค่ lazy counter ของ GitHub — เนื้อหาจริงครบ)

Stage Summary:
- แพลตฟอร์ม EDEN DMS อยู่บน GitHub แล้ว: https://github.com/sungkomp-ai/eden-dms (public, branch main, commit เดียวสะอาด ~1.3MB)
- Repo พร้อมให้คนอื่น clone และรันได้ทันที: มี README ภาษาไทยครบ, .env.example, db/custom.db ข้อมูลตัวอย่าง seed ไว้แล้ว + seed script (bun prisma/seed.ts)
- ไม่มีไฟล์ sandbox/secret หลุดขึ้น repo (ตัด upload/ zip 25MB, .env, screenshots, tool-results ทั้งหมด); local main เปลี่ยนเป็น clean orphan history และ track origin/main แล้ว — commit ถัด ๆ ไป push ต่อได้ปกติ

---
Task ID: 17-a
Agent: Explore (controllers inventory)
Task: สำรวจ controllers/functions ของ eden-core (FUNCTION/FEATURE INVENTORY ฝั่งต้นฉบับ)
Work Log:
- อ่าน worklog.md ทั้งไฟล์ (บริบท: EDEN DMS reimplementation ผ่านมาแล้ว 16 tasks, 13 โมดูล, อยู่บน GitHub แล้ว)
- อ่าน metadata: ABOUT, README.md, INSTALL, VERSION (nursix-dev-5066-g6620ed10d, 2021-08-28), Dockerfile (web2py R-2.9.11 + Ubuntu 18.04), .travis.yml (Python 3.7, ทดสอบ mysql/sqlite/postgres-11/postgis), .gitmodules (private/eden_deploy), docs/VM.txt + epydoc.conf
- เขียน Python script parse controllers ทั้ง 18 ไฟล์ (15,473 บรรทัด): ดึง top-level def ครบ 373 functions + docstring + decorator @auth.s3_requires_membership + จำแนก REST (เรียก s3_rest_controller/s3_request) vs page/helper
- ยืนยันว่าไม่มี s3.restful ใน controllers เลย — REST ทั้งหมดผ่าน s3_rest_controller()/s3db.*_controller(); มี @auth.s3_requires_membership 23 จุด (admin 12, msg 9, xforms 2)
- อ่านเชิงลึก code สำคัญ: default.index (homepage menu boxes: Situation Awareness/4W/Manage Resources/Manage Aid + org list + inline login/register + RSS), default.user (login/register/verify_email/profile), default.person (profile user+person+HR+map), gis.index/config, msg.compose/message, sync.sync (negotiate resource), setup.index/deployment (wizard + ดึง templates.json จาก remote repo), sit.py, auth.py, errors.py, mobile.py, cron/sms_handler_modem.py
- สำรวจ cron/ (crontab 0 bytes ว่าง, scheduler.py 44 bytes = worker_loop เท่านั้น), languages/ 8 ไฟล์ (รูปแบบ web2py T() dict), docs/ 2 ไฟล์
- ยืนยันข้อจำกัด: ไม่มี models/ modules/ views/ static/ tests/ ใน extract นี้ (มีแค่ __init__.py เปล่า + controllers/cron/docs/languages); default.index อ้าง modules ที่ไม่มี controller ใน extract (event, cap, survey, project, req, inv, asset, vol, hms, cr)
Stage Summary:
- Inventory ครบ 373 top-level functions / 18 controllers: gis 63 (viewer+21 layer types+location+geocode+POI+GPS+proxy), hrm 48 (staff/skill/course/training/shift ฯลฯ), msg 52 (11 channel types + inbox/outbox + twitter search + facebook/twitter post), default 31 (home/auth OAuth/profile/audit/dynamic tables), org 38, pr 29, admin 21 (user/role/audit/translate/portable/scheduler), appadmin 18, cms 15, xforms 14 (ODK), setup 12 (deployment wizard), doc 11, sync 8 (repository/dataset), auth 7 (redirect→admin), mobile 2, sit 2, errors 1, custom 1
- cron ว่างจริง: มีแค่ scheduler worker_loop + GSM modem polling thread (process_outbox + receive_msg ทุก 5 วิ)
- i18n: web2py T() dict 8 ภาษา (bs 8,966 / de 6,546 / ar 4,328 / el 1,151 / dv 42 / dz 8 / crs 5 / en-gb 0) รวม 21,046 บรรทัด
- ไม่สามารถรัน eden-core จาก extract นี้ได้ (ขาด models/modules/views) — ใช้เป็น URL surface + feature map สำหรับออกแบบ API ใหม่เท่านั้น

---
Task ID: 17-b
Agent: Explore (s3db data model inventory)
Task: สำรวจตาราง+field จริงจาก modules/s3db
Work Log:
- Parse define_table/tablename ทั้ง modules/s3db (13 ไฟล์, 52,674 LOC) แบบ segment-based (ตัด comment ทิ้ง) → ตาราง active จริง 299 ตาราง: pr 49, org 51, hrm 53, gis 42, setup 21, msg 37, cms 14, sync 9, auth 8, doc 6, s3 4, sit 3, translate 2 (+ auth_user/auth_group/auth_membership เป็น web2py tables ใน s3aaa.py ไม่ได้อยู่ s3db)
- อ่าน TIER 1 ครบ field: pr_person, pr_pentity, pr_contact, pr_address, pr_group, pr_image, pr_identity, pr_person_details, pr_presence, pr_person_user; org_organisation, org_site(super), org_office, org_facility, org_sector, org_site_status/details; hrm_human_resource, hrm_job_title, hrm_skill, hrm_course, hrm_training, hrm_certification (hrm_skill_provision ถูก comment-out); sit.py ทั้งไฟล์ (sit_situation/sit_trackable/sit_presence); cms_post/series; msg_message(super)/outbox/email/sms/twitter; gis_location(L0-L5), gis_layer_entity, gis_config, gis_style, gis_projection, gis_marker; doc_entity/document; sync_dataset/repository
- สกัด metadata กลางจาก s3fields.py S3MetaFields.all_meta_fields() = 13 fields ทุกตาราง: uuid, mci, deleted, deleted_fk, deleted_rb, created_on/by, modified_on/by, approved_by, owned_by_user, owned_by_group, realm_entity; super_entity() สร้าง key + deleted + instance_type + uuid
- วิเคราะห์ patterns: pr_pentity super-entity (pe_id) รวม person/org/group/site/office/facility/forum/realm; org_site super-entity (site_id) รวม office/facility/basestation (+shelter/warehouse/hospital ใน template เต็ม); doc_entity (doc_id) สำหรับไฟล์แนบ; sit_trackable/sit_situation สำหรับ presence tracking; components ผ่าน add_components (ใคร component ของใครระบุได้ครบ); gis_location hierarchy L0-L5 + parent self-ref + path
- ทำ mapping ไป Prisma 14 models ใหม่ (อ่าน schema.prisma): ครอบคลุม ~8% ของตาราง Eden; ช่องว่างสำคัญ = ไม่มี pentity/pe_id, contact/address/identity แยกตาราง, msg_channel+outbox จริง, doc uploads, sync, meta fields (deleted soft-delete, uuid, owned_by_user/group, realm_entity)
Stage Summary:
- Inventory ครบ 299 ตาราง + TIER 1 field ครบทุก field อยู่ในรายงาน task 17-b (บันทึก JSON สำรองที่ tool-results/s3db_inventory_final.json)
- EDEN DMS ใหม่ (14 models) ยังเป็น "subset เชิงหน้าที่" ของ Eden โครงชัด: ทุก entity จริงใน Eden ผูกผ่าน pe_id/site_id/doc_id แต่ใหม่ใช้ FK ตรงแบบ relational ธรรมดา (อ่านง่ายกว่า แต่เสีย flexibility ของ super-entity + real-entities-as-components)
- ช่องว่างที่ควรพิจารณาเสริมรอบหน้า: soft-delete flag + uuid ทุกตาราง, pr_contact/pr_identity เป็นตารางลูก, org_site แบบ polymorphic (shelter/warehouse = site), msg outbox/ช่องทาง, cms_series สำหรับ SITREP, doc_document แนบไฟล์

---
Task ID: 17-a (full extract)
Agent: Explore (controllers/framework inventory — eden-core-full)
Task: สำรวจ controllers/framework/templates/cron/views/languages ของ eden-core เต็ม (eden-core-full/eden-core-master/)
Work Log:
- ยืนยัน extract นี้มีครบ: models/ (00_settings,00_db,00_tables,tasks.py), modules/s3 (46 ไฟล์ 111,195 LOC), modules/s3db (14 ไฟล์ data models), views (173 ไฟล์), static/, languages 48 ไฟล์ 121,678 LOC (th.py 6,603 บรรทัด!) — ต่างจาก extract เดิมที่มีแค่ controllers
- Parse AST controllers ทั้ง 18 ไฟล์ครบ 373 top-level functions (206 เป็น REST ผ่าน s3_rest_controller): gis 63/38, msg 52/37, default 31/8, admin 21/11, hrm 48/30, org 38/28, pr 29/26, cms 15/8, xforms 14/0 (ODK), setup 12/11, appadmin 18/0, doc 11/3, sync 8/5, auth 7/0 (redirect→admin), mobile 2, sit 2, errors 1, custom 1
- sit.py: guard settings.has_module(c) else 404; index → s3db.cms_index(c) (หน้าแรกขับเคลื่อนด้วย CMS content); index_alt → redirect ไป report
- default.index: ลอง custom page/หน้าแรกจาก template ก่อน → CMS post ผูกกับ default/index → 4 menu boxes (Situation Awareness: Map/Incidents/Alerts/Assessments; 4W: Organizations/Facilities/Activities/Projects; Manage Resources: Staff/Volunteers/Relief Goods/Assets; Manage Aid: Requests/Commitments/Sent&Received Shipments) → org list (aadata) + quick access เข้า site/facility + inline login/register + Google RSS feed
- สำรวจ modules/s3 ครบทุกไฟล์ (class หลัก): s3rest S3Request (REST หลาย representation), s3resource/s3model/s3query (DAL abstraction), s3aaa 8,726 LOC (Auth/Permission/Audit), s3widgets 48 classes, s3forms, s3importer 5,236 LOC, s3pdf (reportlab), s3report (pivot), s3dashboard, s3msg (send email/sms via api-modem-smtp-tropo + gcm_push), s3sync, s3roles (Role Manager), s3track, s3xforms, s3gis 10,345 LOC (map client), s3layouts/s3menus/s3theme (ที่ modules/ level), s3oauth, s3migration, s3cfg 4,159 LOC (deployment settings)
- templates: default (config.py 950 บรรทัด + seed CSVs auth_roles/gis_config/skill lists; เปิดโมดูล default,admin,appadmin,errors,setup,sync,translate,gis,pr,org,hrm,cms,doc,msg — event/cap/survey/project/req/inv/asset/vol ปิดอยู่), locations (L0 101 ประเทศ รวม TH), mobile, setup, skeleton, skeletontheme, templates.json {"default": "Default: HR"}
- cron: crontab ว่าง, scheduler.py = worker_loop(heartbeat=20), sms_handler_modem.py = ModemThread ของ pygsm poll process_outbox+receive_msg ตลอด; models/tasks.py มี task functions (dummy, s3db_task, settings_task, maintenance, gis_download_kml, gis_update_location_tree, org_site_check) สำหรับ web2py scheduler
- Deployment: Dockerfile Ubuntu 18.04 + web2py R-2.9.11 (apt: matplotlib,lxml,numpy,gdal,shapely,reportlab,tweepy,serial,xlwt,boto,ansible + pip selenium/sunburnt/TwitterSearch/requests; CMD web2py port 8000 /a eden); requirements.txt = python-dateutil + lxml; optional_requirements.txt = xlwt/Shapely/Pillow/GDAL/geopy/reportlab/pyserial/tweepy/xlrd/openpyxl/feedparser/numpy/selenium/sunburnt; .travis.yml Python 3.7 ทดสอบ 4 DB (mysql/sqlite3/postgres-11/postgres-11+postgis)
Stage Summary:
- Feature inventory ครบ 373 endpoints: แกนหลัก = default(auth/home) + gis(map 21 layer types) + msg(11 channels) + pr/org/hrm (registries) + cms/doc + admin(+appadmin) + sync/xforms/odk + setup wizard
- s3 framework = "meta-framework" ให้ทุกโมดูล: REST CRUD หลาย format (html/json/xml/csv/xls/pdf/geojson/svg/shp), ACL/audit/roles, import/export/merge, pivot/dashboards/timeplot, notifications, sync, mobile forms — คือสิ่งที่ต้องออกแบบเทียบเมื่อเขียนเอกสารสถาปัตยกรรม
- ภาษาไทยรองรับเต็มรูปแบบในต้นฉบับ (th.py 6,603 คำแปล) — อ้างอิงสำหรับ EDEN DMS ที่เป็นภาษาไทยแท้ได้

---
Task ID: 17 (main)
Agent: main (Z.ai Code)
Task: จัดทำเอกสารเปรียบเทียบสถาปัตยกรรม eden-core ต้นฉบับ vs EDEN DMS แบบละเอียด เพื่อตรวจความครบถ้วนโมดูล + ความละเอียดข้อมูล

Work Log:
- ผู้ใช้ส่ง eden-core-master.zip (เวอร์ชันเต็ม 8,022 ไฟล์) เพิ่ม → แตกที่ upload/eden-core-full/ (unzip ทั้งก้อน timeout เพราะ static/ จึงแตกแบบเลือกโฟลเดอร์ — ได้ครบ: modules/s3db 13 ไฟล์ 52,674 LOC = นิยามตารางจริงทั้งหมด, controllers 18 ไฟล์, views, templates)
- Task 17-a (Explore agent): feature inventory — controllers 373 functions (206 REST), S3 framework 111,195 LOC (REST multi-format html/json/xml/csv/xls/pdf/geojson/shp/xform, AAA 8,726 LOC, 48 widgets, import/export/pivot/dashboards, S3Msg 11 channels, S3Sync, S3GIS, ODK/XForms), templates default เปิด gis/pr/org/hrm/cms/doc/msg + ปิด event/cap/survey/project/req/inv/asset/vol, cron scheduler + GSM modem thread, languages 48 ไฟล์ (th 6,603 บรรทัด)
- Task 17-b (Explore agent): data model inventory — **299 ตารางจริง** (pr 49/org 51/hrm 53/gis 42/msg 37/setup 21/cms 14/sync 9/auth 8/doc 6/s3 4/sit 3/translate 2) + meta fields กลาง 13 ตัวทุกตาราง (uuid/mci/deleted/deleted_fk/deleted_rb/created_on-by/modified_on-by/approved_by/owned_by_user-group/realm_entity) + super-entities 6 ตระกูล (pr_pentity/org_site/doc_entity/msg_channel-message/sit_trackable-situation/gis_layer_entity) + component pattern + gis_location L0-L5 hierarchy + field-level Tier-1 ครบ
- เขียน docs/ARCHITECTURE-COMPARISON.md (~350 บรรทัด): exec summary, แผนภาพ mermaid 2 ฝั่ง, layer-by-layer 16 ชั้น, module completeness matrix 18 domains (ครบ 5 / บางส่วน 8 / ไม่มี 4 / ไม่จำเป็น 1 — ใหม่ทำเพิ่ม 3 อย่าง: inventory/requests/AI), data granularity audit (299 vs 15 tables, meta 13 vs 2), field-level เทียบ 9 entity หลัก, gap analysis G1-G10, action plan P1/P2/P3 + สิ่งที่ไม่ควรทำตาม, scorecard
- ข้อค้นพบเชิงกลยุทธ์: (1) SITREP ของ Eden แท้จริงคือ cms_post — ใหม่แยกตาราง IncidentReport ตรงงานกว่า; (2) eden-core ไม่มี inv/req/asset (อยู่ใน Eden เต็ม) — ใหม่ทำ inventory/requests ถือว่าเพิ่มเหนือ eden-core; (3) 4 กลไกสำคัญที่ใหม่ยังไม่มี: accountability (login+audit ครบ), soft-delete/uuid/ownership, presence trail ของผู้สูญหาย, stock/occupancy movement ledger
- อัปเดต README (ลิงก์เอกสาร) → commit + push ขึ้น github.com/sungkomp-ai/eden-dms

Stage Summary:
- เอกสารตรวจสอบฉบับสมบูรณ์อยู่ที่ docs/ARCHITECTURE-COMPARISON.md (อ้างอิง source จริงทั้งสองฝั่ง + แผนภาพ + matrix + field-level + action plan ลำดับคุ้มค่า)
- ให้ทิศทางยกระดับชัดเจน: P1 = meta fields กลาง + login + audit ครบ + Person DOB/contacts + OccupancyLog/StockMovement; P2 = Alert pipeline จริง + ไฟล์แนบ + GIS polygon + export; P3 = กลุ่มคน/training/i18n/ODK/sync — พร้อมสิ่งที่แนะนำ "ไม่ต้องทำตามต้นฉบับ" (super-entity polymorphic, 21 layer types, 11 channels, setup wizard)

---
Task ID: 17.1 (เสริมความลึกเอกสารเปรียบเทียบ)
Agent: main (Z.ai Code)
Task: ปรับเพิ่มรายละเอียดเอกสารเปรียบเทียบ — ความสัมพันธ์ระหว่าง Entity หลัก 9 ตัว (Person/Org/HR/Shelter/Inventory/Incident/Alert/Location/Auth), Gap Analysis G1–G10 แบบรายช่องว่าง, Action Plan พร้อมประมาณความพยายาม (person-day), และ Scorecard สรุป

Work Log:
- อ่าน worklog.md (กู้คืนผล subagent 17-a/17-b) + อ่าน prisma/schema.prisma ครบ 15 models เพื่อระบุเส้นเชื่อมจริงฝั่งใหม่
- ยืนยัน field ความสัมพันธ์จริงจาก source Eden ด้วย grep เชิงเป้าหมาย: hrm_human_resource.person_id/organisation_id + super_link("site_id","org_site") 4 จุดใน hrm.py, auth_user.pe_id/organisation_id/site_id ใน s3aaa.py, super_link("pe_id","pr_pentity") ใน msg.py, series_id/gis_location_id/priority ใน cms.py, trackable_table/trackable_id/direction/speed/accuracy ใน sit.py, super_entity/instance_type ใน pr.py
- แทรก §6.4 "แผนที่ความสัมพันธ์ระหว่าง Entity หลัก" ลงเอกสาร: mermaid erDiagram 2 ฝั่ง (Eden: 3 hub = pr_pentity/org_site/gis_location, 21 เส้น; DMS: 11 เส้น FK) + ตารางเทียบเส้นเชื่อมรายคู่ 14 เส้น (R1–R14) ระบุ field จริงทั้งสองระบบ + ข้อสังเคราะห์ 3 ข้อ (เส้นที่ขาดและกระทบ workflow = R4/R5/R8/R10/R12/R14 → เป็นต้นทาง G1–G4; เส้นที่ใหม่ทำดีกว่า = หลักฐานไม่ต้องถอยไป super-entity)
- ขยาย §7 Gap Analysis G1–G10 จากตารางสรุปเป็นรายช่องว่าง 10 บล็อก แต่ละบล็อกมี: สถานการณ์จริง / ต้นตอเชิงสถาปัตยกรรม / เส้นเชื่อมเกี่ยวข้อง (R1–R14) / ปิดด้วยงานไหนใน §8 / เกณฑ์ปิด
- สร้าง §8 Action Plan ฉบับประมาณการ: หน่วย PD นิยามชัด (dev full-stack คุ้น Next.js/Prisma, รวม schema+API+UI+ทดสอบ) — P1 5 งานพร้อมงานย่อยรายชิ้น (รวม 17.5–22 PD), P2 5 งาน (19–27 PD), P3 8 กลุ่ม (42–50 PD) + ตาราง dependency (1.1→1.2→1.3, 1.4 ∥ 1.5) + รวม P1+P2 ≈ 37–49 PD (~2 เดือน 1 dev / 3–4 สัปดาห์ 2 dev)
- สร้าง §9 Scorecard 2 ชั้น: 9.1 ต่อ Entity 9 โดเมน (eden-core / DMS ปัจจุบัน / หลัง P1 / หลัง P1+P2 / ช่องว่างหลัก) + 9.2 ต่อมิติ 6 มิติพร้อมเฉลี่ยรวม (Eden 3.92 / DMS 3.50 / หลัง P1 4.25 / หลัง P1+P2 4.58) + การอ่านเชิงกลยุทธ์: ลงทุน P1 ~20 PD พอเกินต้นฉบับเฉลี่ย, ทำ P2 ต่อชนะทุกมิติยกเว้นขยาย/บูรณาการ
- อัปเดตหัวเอกสาร (บรรทัด ฉบับ 1.1) + ภาคผนวก (แหล่งยืนยันความสัมพันธ์ + หลักคิดประมาณการ PD) + README คำอธิบายลิงก์เอกสาร
- เอกสารโต 382 → 559 บรรทัด

Stage Summary:
- docs/ARCHITECTURE-COMPARISON.md ครบ 4 ส่วนที่ผู้ใช้ขอ: (1) ความสัมพันธ์ 9 entity แบบ ER + R1–R14 อ้าง field จริงจาก source ทั้งสองฝั่ง (2) G1–G10 รายช่องว่างพร้อมเกณฑ์ปิด (3) Action Plan พร้อม PD รายงานย่อย (4) Scorecard ต่อโดเมน + ต่อมิติพร้อม projection
- ข้อค้นพบใหม่จากมุมความสัมพันธ์: HR ไม่ผูก Person (R4), User ไม่ผูกอะไรเลย (R5/R14), Org ผูก Warehouse แต่ไม่ผูก Shelter (R8 ไม่สม่ำเสมอ), Person/AidRequest/HR ไม่มี FK กับ Location — ทั้งหมดถูกแปลงเป็นงาน P1 แล้ว

---
Task ID: 17.2-e
Agent: full-stack-developer
Task: จัดการผู้ใช้ + รหัสผ่าน (admin-only)

Work Log:
- src/app/api/users/route.ts — เลิกใช้ createHandler เขียน POST custom: requireUser + role 'admin' เท่านั้น (ไม่ใช่ → 403 {error:'เฉพาะผู้ดูแลระบบ'}); รับ {email,name,role,password,status?} → ตรวจ email format (regex คร่าว ๆ) + ตรวจซ้ำด้วย db.user.findUnique + password >= 8 → create พร้อม passwordHash: hashPassword(password), lastLoginAt: null → audit('create','admin',`เพิ่มผู้ใช้ใหม่: ${name} (${role})`) → 201 คืน user ไม่รวม passwordHash; GET คง listHandler (requireUser ในตัว) แต่ครอบด้วย sanitizeUser ตัด passwordHash ออกจากผลลัพธ์ (listHandler ใช้ findMany ไม่มี select — ถ้าปล่อยจะ leak แฮชให้ user ทุก role); cfg meta:false คงเดิมไม่ถอด
- src/app/api/users/[id]/route.ts — GET คง getHandler + sanitize passwordHash เช่นกัน; PUT custom: requireUser + admin-only (403) → รับ {name?,role?,status?,password?} → validate role/status ตาม whitelist, password >= 8 (ถ้าส่งมา → hashPassword) → ไม่ส่ง field ใด field หนึ่ง = คงค่าเดิม → update ด้วย db.user → audit 'update' module 'admin' ระบุชัด "รีเซ็ตรหัสผ่านผู้ใช้" หรือ "แก้ไขข้อมูลผู้ใช้" → 200 คืน user ไม่รวม passwordHash; DELETE custom: requireUser + admin-only, id === auth.id → 400 'ไม่สามารถลบบัญชีตัวเองได้', ไม่พบ → 404, ลบจริงด้วย db.user.delete (User ไม่มี soft-delete) + audit 'delete' → {success:true}; ไม่ใช้ generic updateHandler/deleteHandler แล้ว
- src/components/eden/admin.tsx — (1) ฟอร์ม "เพิ่มผู้ใช้" เพิ่มช่องรหัสผ่าน (type password, autoComplete=new-password, minLength 8, ตรวจ >= 8 ตัวก่อนส่ง, มีคำอธิบายภาษาไทย) — โหมดแก้ไขไม่แสดงช่องรหัสผ่านและล็อกอีเมล (อีเมลใช้เข้าสู่ระบบ แก้ไม่ได้ตาม API contract); (2) ตารางผู้ใช้เพิ่มปุ่ม "รีเซ็ตรหัสผ่าน" (KeyRound) เปิด FormDialog ใหม่ → PUT {password} → toast แจ้งผล + refetch; lastLoginAt แสดงอยู่แล้วด้วย fmtDateTime (คงเดิม); (3) บังคับสิทธิ์ระดับ UI: ดึง /api/auth/me → ถ้าไม่ใช่ admin ซ่อนปุ่ม เพิ่มผู้ใช้/รีเซ็ตรหัสผ่าน/แก้ไข/ลบ + แสดงแถบ "เฉพาะผู้ดูแลระบบ — คุณสามารถดูรายชื่อผู้ใช้ได้เท่านั้น..." (amber); ปุ่มลบ disable เมื่อเป็นบัญชีตัวเอง (isSelf) ตามกติกา API; ทุก action สำเร็จ → toast + users.refetch(); ภาษาไทยทั้งหมด, shadcn/ui เท่านั้น, responsive

Stage Summary:
- API ผู้ใช้ปลอดภัยครบวงจร: POST/PUT/DELETE /api/users บังคับ login + role admin จริง (403 ที่ API ไม่ใช่แค่ UI), รหัสผ่าน hash scrypt ผ่าน hashPassword และไม่มีเส้นทางใดคืน passwordHash ออกนอกระบบอีก (sanitize ทั้ง list/get/create/update), ห้ามลบตัวเอง, ลบแบบ hard-delete ตาม schema, ทุก mutation เขียน audit log ระบุผู้ทำ + รายละเอียดภาษาไทย
- UI ผู้ดูแลระบบรองรับวงจรบัญชีเต็มรูปแบบ: เพิ่มผู้ใช้พร้อมตั้งรหัสผ่าน, รีเซ็ตรหัสผ่านรายคน, แก้ชื่อ/บทบาท/สถานะ, ลบบัญชี, แสดงเข้าสู่ระบบล่าสุด — non-admin เห็นเฉพาะรายชื่อ (view-only) พร้อมข้อความแจ้งสิทธิ์
- ตรวจรับ: lint ผ่าน, curl ครบ 4 ข้อตามแผน + ทดสอบเสริม (login ด้วยรหัสใหม่ได้/รหัสเก่า 401, email ซ้ำ 400, รหัสสั้น 400, self-delete 400, volunteer PUT/DELETE 403, no-auth 401) — DB คงสถานะ seed 6 users เหมือนเดิม (test user ถูกลบแล้ว)
- หมายเหตุ "ต้องแก้เพิ่ม": ไม่มี — ทำครบใน 3 ไฟล์ที่กำหนด (สิ่งที่แตะเพิ่มจากสเปค: sanitize passwordHash ใน GET เพราะ listHandler/getHandler คืนทุก field — ทำในไฟล์ users เอง ไม่แก้ src/lib/api.ts)

---
Task ID: 17.2-c
Agent: full-stack-developer
Task: Person เชิงลึก — PersonContact + PersonEvent API/UI + DOB

Work Log:
- สร้าง src/app/api/persons/[id]/contacts/route.ts — GET (list ของ person, filter deleted:false, orderBy priority asc → createdAt desc, ตรวจ person มีตัวจริงไม่ soft-delete ก่อน) + POST (create {type,value,priority,isEmergency,note} — validate CONTACT_TYPES/value บังคับ, clamp priority 1–3, createdBy/updatedBy=auth.name, audit 'create' module 'persons' รายละเอียดชื่อบุคคล+ช่องทาง)
- สร้าง src/app/api/persons/[id]/contacts/[contactId]/route.ts — PUT (update type/value/priority/isEmergency/note + updatedBy + audit 'update') + DELETE (soft-delete: update deleted:true+updatedBy — ห้ามลบจริง + audit 'delete'); ทั้งคู่ findFirst เช็ค id+personId+deleted:false ก่อนทุกครั้ง ไม่ตรง → 404
- สร้าง src/app/api/persons/[id]/events/route.ts — GET (list PersonEvent, filter deleted:false, orderBy occurredAt desc) + POST (validate EVENT_STATUSES 9 ค่า, parse occurredAt optional → ใน db.$transaction เดียว: (1) personEvent.create createdBy=auth.name (2) person.update status ตาม mapping sighted|missing→missing, found→found, safe→safe, injured|hospitalized→injured, deceased→deceased, evacuated|transferred→evacuated + updatedBy; audit ครบ 2 รายการ: 'create' บันทึกเหตุการณ์ + 'update' "อัปเดตสถานะจาก presence trail: X → Y"); หมายเหตุ: PersonEvent ไม่มี updatedBy/updatedAt ตาม schema จึงใส่เฉพาะ createdBy
- แก้ src/app/api/persons/route.ts + src/app/api/persons/[id]/route.ts เฉพาะ 2 จุด: (1) เพิ่ม 'dateOfBirth','emergencyContact' ใน fields array ของ cfg ทั้งสองไฟล์ (2) เพิ่ม transform แปลง dateOfBirth ISO string → Date (list: `else delete`, [id]: `else if ('dateOfBirth' in d) delete` ตาม pattern lastSeenAt เดิม) — บรรทัด transform ใน [id] จำเป็นเพราะ updateHandler ใช้ transform ตัวเดียวกันตอน PUT ไม่งั้น Prisma จะ 500 (ส่วน emergencyContact เป็น String? ไม่ต้องแปลง)
- แก้ src/components/eden/persons.tsx (~640 บรรทัด): (1) ฟอร์มเพิ่ม/แก้ไขเพิ่มช่อง "วันเกิด" (input type=date, toDateInput() แปลงคืนตอน edit, buildPayload ส่ง ISO) และ "ผู้ติดต่อฉุกเฉิน" (text) (2) เพิ่ม Dialog รายละเอียดจากปุ่ม Eye ในแถวตาราง: การ์ดข้อมูลพื้นฐาน (วันเกิด/อายุ·เพศ/โทรศัพท์/ผู้ติดต่อฉุกเฉิน/พบล่าสุด/เหตุการณ์/พักพิง) + section ช่องทางติดต่อ (list PersonContact เรียง priority: Badge ชนิดจาก optBadge, ป้าย "หลัก" priority=1, ป้าย "ฉุกเฉิน" isEmergency, ปุ่มลบผ่าน useConfirmDelete → API soft-delete + ฟอร์มเพิ่ม Select ชนิด/Input ค่า/Switch เบอร์ฉุกเฉิน) + section Timeline การพบตัว (list PersonEvent ใหม่→เก่า แบบ timeline เส้นซ้าย, Badge สถานะ: missing=แดง sighted=เหลือง found/safe=เขียว injured/hospitalized=ส้ม deceased=เทาเข้ม evacuated/transferred=teal, fmtDateTime + สถานที่(MapPin) + ผู้สังเกต + หมายเหตุ + ผู้บันทึก + ฟอร์มเพิ่ม Select สถานะ/Input สถานที่/Input ผู้สังเกต/Textarea หมายเหตุ) (3) ทั้งสอง section ใช้ max-h-72 overflow-y-auto + scrollbar styling ตาม pattern shell.tsx (webkit-scrollbar + scrollbar-width:thin ธีมสว่าง) (4) ใช้ useFetch(url|null) ยิง /api/persons/{id}/contacts กับ /events เมื่อเปิด dialog, หลังเพิ่ม/ลบ contact → refetchContacts, หลังบันทึก event → refetchEvents + refetch persons (สถานะเปลี่ยน) และแสดงสถานะล่าสุดของบุคคลจาก list (detailPerson = persons.find) (5) UI ไทยทั้งหมด, aria-label ครบปุ่มไอคอน, responsive mobile-first
- ทดสอบ curl ครบ: login → GET persons (JSON ได้ dateOfBirth/emergencyContact ใน list) → POST/GET/PUT/DELETE contact (ลบซ้ำ 404, ไม่ login 401) → POST event 3 รูปแบบ (transferred→evacuated, sighted→missing เปลี่ยนสถานะจริง, transferred คืนค่าเดิม) → PUT dateOfBirth+emergencyContact (ISO ถูกแปลงเป็น Date ถูกต้อง 1980-05-10T00:00:00.000Z) → ตรวจ audit-logs ครบทุก action → เก็บกวาด: soft-delete contact ผ่าน API DELETE + soft-delete event 3 แถวด้วย updateMany ตาม id ที่จับไว้เท่านั้น + คืน dateOfBirth/emergencyContact ของแถว seed ที่ใช้ทดสอบเป็น null ด้วย prisma ตรงจุด (บุคคล seed ครบ 24 คน สถานะเท่าเดิม)

Stage Summary:
- Person เชิงลึกครบตามแผน P1 (G3): ทะเบียนบุคคลมี DOB/ผู้ติดต่อฉุกเฉิน, ช่องทางติดต่อหลายช่องทางต่อคน (priority+ฉุกเฉิน) และ presence trail ที่อัปเดตสถานะบุคคลอัตโนมัติแบบ atomic ($transaction) เทียบ pr_contact/pr_presence ของ Eden
- ทุก route ใหม่บังคับ login (401 เมื่อไม่มี session), meta fields ครบ (deleted/uuid/createdBy/updatedBy) และ audit รายละเอียดชัดเจนทุก mutation — ตรวจสอบได้จาก /api/audit-logs
- การตัดสินใจสำคัญ: (1) เพิ่ม dateOfBirth ใน transform ของ [id]/route.ts อีก 2 บรรทัดนอกจากที่สั่ง เพราะ updateHandler รัน transform ตัวเดียวกันตอน PUT — ไม่งั้นแก้วันเกิดจะ 500 (อยู่ในไฟล์ที่อนุญาตอยู่แล้ว แก้เฉพาะจุดเดียวกัน) (2) ทดสอบการเปลี่ยนสถานะใช้ event ที่ mapping กลับมาสู่สถานะเดิมของแถว seed (evacuated) จึงไม่บิดเบือนข้อมูล seed (3) เก็บกวาดข้อมูลทดสอบแบบ id-specific เท่านั้น — ข้อมูล seed ครบ 24 คน/6 contacts/8 events เหมือนเดิม (แถวทดสอบทั้งหมด soft-deleted)
- ต้องแก้เพิ่ม: ไม่มี (พบ error ชั่วคราวใน dev.log "Identifier 'isAuthApi' has already been declared" จาก src/middleware.ts — เป็นของ agent งานคู่ขนานแก้อยู่ ไม่เกี่ยวกับไฟล์ชุดนี้ และ dev server กลับมาปกติเอง)
---
Task ID: 17.2-d
Agent: full-stack-developer
Task: Movement ledger — ShelterOccupancy + StockMovement API/UI (ปิด Gap G4 ตาม docs/ARCHITECTURE-COMPARISON.md)

Work Log:
- สร้าง src/app/api/shelters/[id]/occupancy/route.ts (ใหม่):
  - GET: ShelterOccupancy ของ shelter (createdAt desc, take 100) + requireUser (401 ถ้าไม่ล็อกอิน)
  - POST {delta, note?}: db.$transaction — (1) findFirst shelter deleted:false → 404 ถ้าไม่เจอ (2) newCount = currentOccupancy + delta, < 0 → 400 "จำนวนไม่ถูกต้อง" (delta 0/ไม่ใช่จำนวนเต็มก็ 400) (3) create log {delta, count:newCount, note, createdBy:auth.name} (4) update currentOccupancy + status อัตโนมัติ: capacity>0 && newCount>=capacity → 'full', เดิม 'full' && newCount<capacity → 'open' (5) audit 'update' module 'shelters' รูปแบบ `บันทึกเข้า-ออกพักพิง {name}: +5 → 215 คน` — response 201 {log, shelter}
- สร้าง src/app/api/inventory/movements/route.ts (ใหม่):
  - GET: filters itemId / warehouseId (OR from|to) / type (ตรวจค่า → 400 ถ้าไม่ใน 4 ชนิด), include item{name,unit} + fromWarehouse/toWarehouse{name}, orderBy createdAt desc take 200
  - POST {itemId, type, quantity, toWarehouseId?, reference?, note?}: ตรวจ type ∈ receive|issue|transfer|adjust, quantity เป็นจำนวนเต็ม ≠ 0, item มีและ deleted:false (404 ถ้าไม่เจอ) → $transaction ราย type:
    * receive: qty>0; to = toWarehouseId ?? item.warehouseId (ตรวจคลัง deleted:false → 400 ถ้าไม่พบ); item.quantity += qty; อัปเดต warehouseId = to ถ้ามี
    * issue: qty>0; from = item.warehouseId; newQty < 0 → 400 "สต๊อกไม่พอ (คงเหลือ X)"; item.quantity -= qty
    * transfer: qty>0; toWarehouseId บังคับ + != item.warehouseId (400 ทั้งสองกรณี); ตรวจคลังปลายทาง; เปลี่ยน item.warehouseId (จำนวนคงเดิม)
    * adjust: signed delta; newQty < 0 → 400 "จำนวนไม่ถูกต้อง"
    * create StockMovement: quantity เก็บ signed เฉพาะ adjust / absolute สำหรับชนิดอื่น + from/to warehouse + reference/note + createdBy:auth.name
    * low-stock alert: ก่อน > minQuantity && หลัง <= minQuantity → create Alert ใน tx เดียวกัน (title `⚠️ สต๊อกใกล้หมด: {name}`, message คงเหลือ/จุดขั้นต่ำ/คลัง/ที่มา, channel broadcast, severity warning, audience all, status draft) + audit 'create' module 'alerts'; response มี flag lowStockAlert ให้ UI แจ้ง toast
    * audit 'create' module 'inventory' ทุกครั้ง ด้วยชื่อคลัง (ไม่ใช่ id) เช่น `เบิกจ่าย เรือยางเคลื่อนที่เร็ว -1 ลำ (คลัง คลังบรรเทาทุกข์ ปภ. บางเขน)`
- แก้ src/components/eden/shelters.tsx (436 → 675 บรรทัด):
  - ปุ่ม "เข้า-ออก" (History icon) ต่อ card → FormDialog "บันทึกผู้อพยพเข้า-ออก" (wide): Progress currentOccupancy/capacity (สีตาม occupancyTone เดิม) + ปุ่ม รับเข้า (UserPlus, เขียว) / ย้ายออก (UserMinus, ส้ม, disable เมื่อ occ=0)
  - Dialog กรอก: Input number + Textarea หมายเหตุ → POST /api/shelters/{id}/occupancy → toast ยอดใหม่ + refresh รายการ + refresh ledger (ใช้ shelter จาก response อัปเดต ledgerFor ทันที)
  - ประวัติล่าสุด: list max-h-56 overflow-y-auto + scrollbar styling ตาม shell.tsx (webkit w-1.5 + scrollbar-width thin, สี slate-300 บนพื้นสว่าง) — badge delta เขียว(+)/แดง(-) font-mono, รวม count คน, note, fmtDateTime + createdBy
  - Loading skeleton ใน list, empty state "ยังไม่มีบันทึกเข้า-ออก", ไม่แตะฟีเจอร์เดิม (เพิ่ม/แก้ไข/ลบ/filters ครบ)
- แก้ src/components/eden/inventory.tsx (612 → 904 บรรทัด):
  - DropdownMenu "เคลื่อนไหว" ต่อ item (ในช่องปรับสต๊อก/จัดการ หลังเส้นคั่น) 4 รายการพร้อม icon สี: รับเข้า PackagePlus เขียว / เบิกจ่าย PackageMinus ส้ม / โอนย้าย ArrowLeftRight เทา / ปรับยอด SlidersHorizontal เหลือง → เปิด Dialog เดียว (type เลือกเปลี่ยนได้ผ่าน Select)
  - Dialog เคลื่อนไหวสต๊อก: Select ประเภท + Input จำนวน (adjust ติดลบได้, ชนิดอื่น min=1) + Select คลังปลายทาง (แสดงเฉพาะ transfer — ใช้ warehouses จาก useFetch /api/warehouses ที่โหลดอยู่แล้ว, กรองคลังปัจจุบันออก + เตือนถ้าไม่มีคลังอื่น) + Input เอกสารอ้างอิง/ผู้เบิก + Textarea หมายเหตุ + กล่อง preview "คงเหลือ X → หลังรายการ Y" (แดงถ้าติดลบ) → POST /api/inventory/movements → toast + toast เตือนแยกเมื่อ lowStockAlert + items.refetch() + movements.refetch()
  - Tab ใหม่ "ประวัติการเคลื่อนไหว" (History icon): GET /api/inventory/movements (useFetch) แสดง 50 ล่าสุด (slice จาก 200) — ตาราง เวลา / ชนิด badge (receive เขียว, issue ส้ม, transfer เทา, adjust เหลือง — MOVEMENT_TYPES กำหนดในไฟล์เพราะห้ามแก้ constants.ts) / สินค้า / จำนวน± (สีตามชนิด, adjust แสดง signed) / จาก → ถึง (ArrowRight, — เมื่อว่าง) / อ้างอิง (truncate+title) / โดย — scroll container max-h-72 overflow-auto + scrollbar styling เดียวกับ shelters; RefreshButton + EmptyState + ErrorState + TableSkeleton
  - ฟีเจอร์เดิมไม่ถูกแตะ: quick ±10, low-stock badge "ต้องเติม", ฟอร์มสินค้า/คลัง, ค้นหา/กรองหมวด (หมายเหตุ: quick ±10 ยังเป็น PUT ตรง — ไม่ผ่าน ledger เพราะเป็นพฤติกรรมเดิม ไม่แก้)
- ตรวจ: bun run lint ผ่าน (0 error), dev.log ไม่มี error, GET /api/inventory/movements จากหน้า UI → 200
- ทดสอบ curl (บัญชี admin@eden.go.th) + ล้างข้อมูลทดสอบคืน seed ครบ (สคริปต์ชั่วคราวใน project root รันแล้วลบทันที — ไม่ทิ้งไฟล์): shelter 210 คน/open เท่าเดิม, item เรือยาง qty=22/คลังเดิม, stock_movements=9, shelter_occupancy_logs=7, alerts=11 (เหลือแต่ seed), ทิ้ง audit_logs จากการทดสอบไว้ตามหลัก audit trail

Stage Summary:
- ปิด Gap G4 (movement ledger) ครบทั้ง 2 entity: ShelterOccupancy (log +/− ผู้อพยพ + auto status full/open) และ StockMovement (รับ/จ่าย/โอน/ปรับ + low-stock draft alert) — ทุก mutation เป็น $transaction เดียวกับการอัปเดตยอด ไม่มีทางยอดเพี้ยนจาก race
- Accountability ครบ: ทุก handler requireUser (401), createdBy จาก session จริง, audit ทุก action ด้วยข้อความไทยอ่านรู้เรื่อง
- ผล curl ทดสอบผ่านทั้งหมด: occupancy +5 → count 215/occ 215 → -5 คืน 210; เข้าถึงไม่ล็อกอิน → 401; movement issue 1 (22→21), issue 9999 → 400 "สต๊อกไม่พอ (คงเหลือ 21)", receive คืน 22, transfer ไป-กลับ (คลังเปลี่ยนจริง, qty คงเดิม, โอนซ้ำคลังเดิม → 400), adjust -12 → 10 + lowStockAlert=true (สร้าง Alert draft ถูกต้อง) + adjust -20 ติดลบ → 400 + adjust +12 คืน 22; GET filters type/itemId ทำงาน
- ข้อจำกัดที่ตั้งใจไว้: GET movements take 200 ตาม spec (UI slice 50); delta=0 ปฏิเสธเพื่อกัน log ขยะ; ปรับ status เป็น 'full' เฉพาะ capacity > 0
- "ต้องแก้เพิ่ม": ไม่มี — ทำงานครบในไฟล์ที่อนุญาต (2 API ใหม่ + shelters.tsx + inventory.tsx), ไม่แตะ prisma/schema.prisma, src/lib/*, หรือไฟล์โมดูลอื่น

---
Task ID: 17.2 (main)
Agent: main (Z.ai Code)
Task: ปรับปรุง platform ตามแผน P1 (ปิด Gap G1–G4) — Login จริง + meta fields + audit ครบ + Person เชิงลึก + Movement ledger

Work Log:
- Phase 1 (main): อ่านโครงสร้างปัจจุบัน (31 API routes / 15 module components / lib/api.ts generic CRUD) → ออกแบบให้ retrofit อยู่ใน lib กลางแทนแก้ 30 ไฟล์
- schema.prisma รีไรต์ใหม่: meta fields กลาง (deleted/uuid/createdBy/updatedBy) 12 data models, User.passwordHash, Person.dateOfBirth + emergencyContact, โมเดลใหม่ 4 ตัว (PersonContact, PersonEvent, ShelterOccupancy, StockMovement) → db push --force-reset + seed ใหม่ (users 6 บัญชีพร้อม scrypt hash, contacts 6, events 8, occupancy 7, movements 9)
- สร้าง src/lib/auth.ts: scrypt hash + session HMAC-SHA256 httpOnly cookie 12 ชม. + requireUser/isResponse + audit(); ย้าย ROLE_LABELS ไป lib/constants.ts (client-safe)
- src/middleware.ts: gate หน้า page → redirect /login, API → 401 JSON (แก้ duplicate ประกาศ isAuthApi จาก edit ค้าง)
- lib/api.ts อัปเกรด: ทุก handler บังคับ login, list กรอง deleted=false, create ใส่ createdBy/updatedBy, update ตรวจไม่แตะแถวที่ลบแล้ว, DELETE → soft-delete + audit ระบุชื่อผู้ใช้จริง; cfg.meta=false ยกเว้น user/auditLog; แก้ getHandler signature (req, cfg, id) ทั้ง 11 ไฟล์ [id]/route.ts
- Custom routes ใส่ guard มือ: locations/settings/stats/ai-assistant/map-layers(4 ไฟล์, DELETE เปลี่ยนเป็น soft-delete) + users มี sanitize passwordHash
- API auth ใหม่: /api/auth/login (ตรวจ scrypt + lastLoginAt + audit) /logout /me
- UI: หน้า /login (ธีม slate-900 + บัญชีทดสอบคลิกกรอกอัตโนมัติ), page.tsx ตรวจ /api/auth/me + gate, shell.tsx แสดง user จริง + ปุ่ม logout, seed demo accounts ตรงอีเมล @eden.go.th
- แก้ bug: login route import audit ผิดที่ (ย้าย audit ไป auth.ts + api.ts re-export), eslint ไม่ ignore upload/ (เพิ่ม ignores)
- Phase 2 (subagents ขนาน 3 ตัว — บันทึกแยกข้างบน): 17.2-c Person ลึก (contacts+events API+UI timeline), 17.2-d Movement ledger (occupancy+stock API+UI 2 โมดูล + low-stock Alert อัตโนมัติ), 17.2-e Users admin-only + รีเซ็ตรหัสผ่าน — ทุกตัว lint ผ่าน + curl ผ่าน + เก็บกวาดข้อมูลทดสอบแล้ว
- Phase 3 (main): lint รวมผ่าน (exit 0) → agent-browser verify golden path ครบ: login page render/redirect ✓, login admin ✓, header user จริง+logout ✓, persons dialog ช่องทางติดต่อ (0→1) + presence trail บันทึกพบเห็นพร้อม toast อัปเดตสถานะ ✓, shelters occupancy รอบ +5/-5 (1,350→1,355→1,350) ✓, inventory เบิกจ่าย 10 (5,200→5,190) แล้วรับเข้าคืน ✓ + แท็บประวัติการเคลื่อนไหว 9 รายการ ✓, admin ตารางผู้ใช้ + lastLoginAt จริง ✓, มือถือ 390px + footer sticky ✓, logout → /login ✓, console/dev.log ไม่มี error ✓
- README: เพิ่มส่วนการเข้าสู่ระบบ + ความสามารถใหม่ + endpoint ใหม่ 5 กลุ่ม

Stage Summary:
- P1 ปิดครบ G1–G4 ตามแผนใน docs/ARCHITECTURE-COMPARISON.md §8.1: G1 accountability (login+audit+createdBy), G2 soft-delete/uuid, G3 Person ลึก (DOB/contacts/presence trail), G4 movement ledger (occupancy+stock+low-stock alert)
- สถาปัตยกรรมที่ตัดสินใจ: session แบบ HMAC cookie ไม่ใช้ NextAuth (ลด dependency/ตรวจสอบง่าย — เทียบเท่าตามเป้าหมาย 1.2), soft-delete ผ่าน lib กลางจึงครบทุก route โดยอัตโนมัติ, ledger อัปเดตตัวเลขใน $transaction เดียวกับการบันทึก
- Scorecard คาดหวังจากเอกสารฉบับ 1.1: ความน่าเชื่อถือเชิงระบบ 2 → 4, Person 2.5 → 4, Shelter/Inventory 3 → 4.5

---
Task ID: 18
Agent: Z.ai Code (main)
Task: สรุป "update สถานการณ์และการช่วยเหลือน้ำท่วมของไทย" ด้วย web-search

Work Log:
- ค้น 8 ชุดคำสั่ง (web_search CLI) ครอบคลุม: สถานการณ์ล่าสุด, การเยียวยา, ข้อมูล ปภ., เขื่อนเจ้าพระยา-ป่าสัก, ภาคใต้
- ตรวจวันที่ระบบ: 7 ต.ค. 2026 (กทม. เวลา 20:13) เพื่อกรองข่าวให้เป็นเหตุการณ์ 2569 เท่านั้น (แยกจากเหตุการณ์ปลายปี 2568)
- สรุปตัวเลขจาก ปภ./ThaiPBS/PRD/ประชาไท/Thansettakij ประกอบเป็น briefing ภาษาไทย

Stage Summary:
- สถานการณ์ 7 ต.ค. 69: น้ำท่วม 27 จังหวัด + กทม. (123 อำเภอ), กระทบ ~1.1 ล้านครัวเรือน / 3.1 ล้านคน, เสียชีวิต 52 ราย; กทม. 329,000 ครัวเรือน น้ำลดลง
- เยียวยา 9,000 บาท/ครัวเรือน ลงทะเบียนผ่านแอป "ทางรัฐ" / flood68.disaster.go.th
- ยังไม่แตะโค้ด/DB ของแพลตฟอร์ม — เสนอทางเลือกต่อผู้ใช้: นำเข้าเหตุการณ์นี้เป็น Incident จริงใน EDEN DMS

---
Task ID: 20-b
Agent: full-stack-developer
Task: ปิด Gap G8 บางส่วน — Export CSV ทุกโมดูลหลัก (UTF-8 BOM เปิดใน Excel ได้) + ปุ่มส่งออก CSV ใน UI 5 โมดูล

Work Log:
- src/lib/api.ts — เพิ่ม helper `toCsv(rows, module)` (export ให้ route อื่น import ได้): (1) flatten 1 ระดับสำหรับ relation include เช่น { shelter: { name } } → คอลัมน์ "shelter.name", ข้าม object/array ลึก >1 ระดับ (2) คอลัมน์ = union keys เรียงตามลำดับที่พบในแถวแรกก่อน แล้วต่อด้วย key ที่พบเพิ่มจากแถวถัง ๆ — ถ้าไม่มีแถว → ตอบ CSV ว่าง (เหลือแค่ BOM) (3) ค่า Date → ISO string, null/undefined → '', escape ตาม RFC 4180 (ค่าที่มี , " \n \r ครอบ "" และ " → "") (4) ขึ้นท้ายเส้น CRLF ตามมาตรฐาน CSV (5) เพิ่ม BOM \uFEFF นำหน้า + headers Content-Type: text/csv; charset=utf-8 และ Content-Disposition: attachment; filename="eden-{module}-{YYYYMMDD}.csv" (วันที่จากเครื่องเซิร์ฟเวอร์, ASCII ล้วน) — พร้อม refinement: ถ้า relation ถูก flatten เป็น "rel.field" แล้ว จะตัดคอลัมน์ต้นทาง (bare key จากแถวที่ค่า null เช่น "shelter"/"location") ทิ้ง ไม่ให้มีคอลัมน์ว่างซ้ำซ้อนในไฟล์
- listHandler — หลัง query เสร็จ ถ้า `url.searchParams.get('format') === 'csv'` → return toCsv(items, cfg.module); ยังบังคับ login ผ่าน authOrResponse ตามเดิม และ filter ?q= ใช้ได้กับ CSV ด้วย (เพราะ where คำนวณก่อนแยก format) — ครอบคลุมอัตโนมัติทุกโมดูลที่ใช้ listHandler (incidents/persons/shelters/requests/inventory ฯลฯ)
- src/app/api/inventory/movements/route.ts — เพิ่ม `?format=csv` ใน GET ด้วย toCsv เดียวกัน (import จาก @/lib/api) โดย map แถวเป็นคอลัมน์ภาษาไทย เวลา/ชนิด/สินค้า/จำนวน/จาก/ถึง/อ้างอิง/โดย — flatten ชื่อ relation (item.name, fromWarehouse.name, toWarehouse.name, TYPE_LABEL แปลง receive/issue/transfer/adjust → รับเข้า/เบิกจ่าย/โอนย้าย/ปรับยอด) ไม่แสดง id เปล่า ๆ, module ใน filename = "inventory-movements" กันชนกับ export รายการสินค้า (ยังจำกัด 200 รายการล่าสุดตาม take เดิม)
- UI 5 ไฟล์ (incidents/persons/shelters/requests/inventory.tsx): เพิ่มปุ่ม `<Button variant="outline" size="sm">` ไอคอน Download ป้าย "ส่งออก CSV" — ทุกโมดูลแทรกใน ModuleHeader actions (incidents หลัง RefreshButton, persons/shelters หน้าปุ่มสร้าง, requests หลัง SearchInput) ยกเว้น inventory วางรายแท็บ: แท็บสินค้า ใน filter bar คู่กับ Select หมวดสินค้า (ครอบ div flex), แท็บประวัติการเคลื่อนไหว คู่กับ RefreshButton ชี้ /api/inventory/movements?format=csv — ทุกปุ่ม: toast แจ้ง "กำลังส่งออกไฟล์ CSV..." ก่อนแล้ว window.open('/api/{endpoint}?format=csv&q={คำค้น}') (รองรับ filter คำค้นปัจจุบัน q ที่ API รองรับ — incidents/persons/shelters/requests/inventory; ตัวกรองแท็บสถานะ/หมวดที่เป็นฝั่ง UI อย่างเดียวไม่ส่ง และระบุไว้ใน comment ในโค้ด), session cookie ไปกับ request เอง, ไม่แตะฟีเจอร์เดิมใด ๆ
- Verify: bun run lint 0 error; curl login admin@eden.go.th → curl -i /api/incidents?format=csv → 200 + content-type text/csv; charset=utf-8 + content-disposition attachment; filename="eden-incidents-20261007.csv" + BOM (od: ef bb bf) + แถวแรกเป็นชื่อคอลัมน์ + ข้อมูลไทยครบไม่เพี้ยน พบ INC-2569-005 "อุทกภัยรอบด้าน 27 จังหวัด + กรุงเทพฯ (ปภ. 7 ต.ค. 69)" (description มี comma ถูก quote ถูกต้อง); /api/inventory/movements?format=csv → 15 แถวข้อมูลจริง (รับเข้า/เบิกจ่าย/โอนย้าย น้ำดื่ม/ชุดบรรเทาทุกข์/เต็นท์ พร้อมชื่อคลัง+ผู้บริจาค); เรียกไม่มี cookie ทั้ง 2 endpoint → 401; ?q= กับ CSV ทำงาน (q=เชียงใหม่ → 1 เหตุการณ์); persons 28 แถว / shelters 14 / requests 16 / inventory 22 — คอลัมน์ flattened (incident.code, incident.title, shelter.name, location.* , _count.*) ครบ
- Verify UI (agent-browser): login → โมดูลเหตุการณ์ → ปุ่ม "ส่งออก CSV" มีจริง → คลิก → toast "กำลังส่งออกไฟล์ CSV..." แสดง + window.open ยิง request (ยืนยันในบริบทเบราว์เซอร์ด้วย eval fetch: status 200, content-type/attachment ถูกต้อง, BOM อยู่ใน byte stream — fetch.text() ตัด BOM เองตาม spec ของเบราว์เซอร์); ตรวจปุ่มครบทั้ง 4 โมดูลที่เหลือ + แท็บสินค้า/แท็บประวัติการเคลื่อนไหวของคลัง (คลิกจริงที่แท็บ movements → toast แสดง); console และ page errors ว่างสนิท; dev.log ไม่มี error ใหม่ (เฉพาะ GET ...?format=csv 200)

Stage Summary:
- ปิด Gap G8 บางส่วน: export รายงาน CSV ได้ทุกโมดูลหลัก (เหตุการณ์/บุคคล/ศูนย์พักพิง/คำขอ/คลังสิ่งของ/ประวัติการเคลื่อนไหว) — ไฟล์ UTF-8 BOM เปิดใน Excel ภาษาไทยไม่เพี้ยน, escape ตาม RFC 4180, filename ASCII พร้อมวันที่
- สถาปัตยกรรม: helper เดียว (toCsv) ใน src/lib/api.ts ใช้ร่วมทั้ง generic listHandler (?format=csv ใช้ได้กับทุกโมดูล CRUD โดยอัตโนมัติ รวม ?q=) และ custom route (movements map คอลัมน์ไทยเอง) — โมดูลอื่นที่ต้องการ custom columns ในอนาคต import toCsv ได้ทันที
- การตัดสินใจ: (1) columns จาก union keys ลดคอลัมน์ bare relation ที่มาจากแถว null ออกเมื่อมีการ flatten แล้ว เพื่อไฟล์สะอาด (2) export ผ่าน window.open ให้เบราว์เซอร์จัดการดาวน์โหลดเอง (Content-Disposition attachment) ไม่ต้องจัดการ blob ฝั่ง UI (3) ส่ง ?q= ปัจจุบันให้ server-side ที่รองรับ, ตัวกรองที่เป็น client-only (แท็บสถานะ/หมวด/priority) ไม่ส่ง — จำกัดขอบเขตชัดเจนใน comment
- ข้อจำกัด: movements CSV จำกัด 200 รายการล่าสุดตาม GET เดิม; โมดูลอื่น (sitreps/alerts/organizations/hr ฯลฯ) ยังไม่มีปุ่มใน UI แต่ API รองรับ ?format=csv แล้วผ่าน listHandler — เว้นให้ task ถัดไปเพิ่มปุ่มตามต้องการ

---
Task ID: 20-a
Agent: full-stack-developer
Task: ปิด Gap G5 (Alert ไม่ส่งถึงผู้รับจริง) — Delivery Pipeline + Outbox รายผู้รับแบบจำลองการส่ง (เทียบ msg module ของ Sahana Eden)

Work Log:
- อ่าน worklog.md (Task 17.2: session auth + generic CRUD + audit + soft-delete; Task 19.1: DRAFT alert "⛈️ เตือนภัยฝนตกหนักภาคใต้ 4–14 ต.ค. 69 — เตรียมรับมืออุทกภัย" id cmuy5ig70000opvfziffuhnam, audience=all) + อ่าน schema.prisma / lib/auth.ts / alerts.tsx / shelters.tsx (scrollbar pattern) / shared.tsx (FormDialog, useFetch, apiSend) / seed.ts (บัญชี admin@eden.go.th)
- prisma/schema.prisma: เพิ่ม model AlertOutbox (alertId FK → Alert Cascade, channel app|email|sms|broadcast, target, status queued|sent|failed, retries, error, sentAt, createdBy, @@map("alert_outbox") — ไม่มี deleted/uuid ตามสเปค) + relation `outbox AlertOutbox[]` บน Alert → db:push สำเร็จ (additive) + Prisma Client regenerate ยืนยันแล้ว
- สร้าง src/app/api/alerts/[id]/send/route.ts (POST): requireUser (401) → ตรวจ alert deleted:false (404) → resolve ผู้รับจาก audience (all=active ทุก role / officers|area=admin+coordinator+officer / volunteers=volunteer) → รายผู้รับ 2 ช่องทาง (app "แอปในระบบ: {email}" + email) + 1 broadcast "ประกาศสาธารณะ (เว็บไซต์/สื่อ/แอป)" เมื่อ audience=all → deleteMany({alertId}) แล้ว regenerate (ส่งซ้ำ = ชุดใหม่) → จำลองส่ง: app=sent ทันที, email/broadcast สำเร็จ ~85% ไม่สำเร็จ→failed + error "จำลอง: relay ไม่ตอบสนอง (ผู้รับอาจไม่มีอยู่)", สำเร็จ→sentAt → ถ้า total>0 && failed=0 → alert status='sent'+sentAt (ยังมี failed → คงสถานะเดิม) → audit('send','alerts',`ส่งการแจ้งเตือน "{title}" ถึง {total} ผู้รับ (สำเร็จ {sent}, ล้มเหลว {failed})`) → คืน { alert, summary {total,sent,failed,queued}, outbox }
- สร้าง src/app/api/alerts/[id]/outbox/route.ts: GET = requireUser + ตรวจ alert (404) + rows orderBy createdAt asc + summary → { alert, outbox, summary }; POST = retry failed row(s) (body {outboxId?} เลือกเดี่ยวได้, ไม่มี failed → 400 ข้อความไทย) → retries+1 + re-simulate 85% → ทุกแถว sent → alert status='sent'+sentAt → audit `ลองส่งซ้ำ {n} รายการ ของการแจ้งเตือน "{title}" (สำเร็จเพิ่ม {ok}, ยังล้มเหลว {x})` → คืน shape เดียวกับ GET
- แก้ src/components/eden/alerts.tsx (370 → 596 บรรทัด): ปุ่ม "ส่ง & สถานะ" (Send icon, outline, sm) ต่อการ์ด → Dialog "ส่งการแจ้งเตือน & สถานะการส่งรายผู้รับ" (FormDialog wide) แสดง meta badges (ช่องทาง/กลุ่มผู้รับ/ความรุนแรง/สถานะ) + summary chips (ทั้งหมด slate/สำเร็จ เขียว/ล้มเหลว แดง/คิว เหลือง) + ปุ่ม "ส่งการแจ้งเตือน" (→"ส่งซ้ำ" เมื่อ sent) + "ลองส่งใหม่ (เฉพาะที่ล้มเหลว)" (disabled เมื่อ failed=0) + Loader2 spinner ขณะส่ง + ตารางคิว (ช่องทาง badge สี/ผู้รับ truncate/สถานะ badge สี + "ลองใหม่ n"/เวลาส่ง/error truncate) ใน max-h-72 overflow-y-auto + scrollbar styling ตาม shelters.tsx, skeleton loading + empty state; หลัง send/retry → setData จาก response + setSendFor(alert ใหม่) + alerts.refetch() (badge การ์ด draft→sent ตามจริง) + toast สรุปผล (ครบทุกรายการ = toast เขียว "ส่งถึงผู้รับครบ {total} รายการ" / บางส่วน = destructive ชวนกด retry); ฟีเจอร์เดิมครบ (ส่งเดี๋ยวนี้/แก้ไข/ลบ/ค้นหา/สถิติ); toast ใช้ useToast เดิมของโปรเจกต์แทน sonner เพราะ layout ติดตั้ง Toaster ของ shadcn ไว้แล้วและทั้งโมดูลใช้ pattern นี้
- ปัญหาสิ่งแวดล้อม: curl ครั้งแรก POST send → 500 "db.alertOutbox is undefined" — dev server singleton globalThis.prisma (lib/db.ts) cache PrismaClient เก่าก่อน regenerate, HMR ฟื้นไม่ได้ → รีสตาร์ต dev server หนึ่งครั้งด้วยคำสั่ง/port/dev.log เดิม (background detached) → ✓ Ready + ทุก route ปกติ (คำเตือน deprecation "middleware file convention" เป็นของเดิม ไม่ใช่ error)
- ทดสอบ curl ครบ: login admin 200 → POST send บน draft alert → 200 ครั้งแรก 11/11 sent (5 users × 2 + broadcast) → alert sent+sentAt → ไม่ login send/outbox → 401 ทั้งคู่ → retry เมื่อ failed=0 → 400 → send ซ้ำจน failed=1 → alert คงสถานะเดิม + GET outbox {alert, outbox, summary} เรียง asc → POST retry → retries 0→1 กลายเป็น sent, 11/11, alert sent+sentAt ใหม่ → retry ด้วย {outboxId} เดี่ยว → +1 เฉพาะแถวนั้น → 404 เมื่อ id ไม่มีทั้ง 2 endpoint → audit logs ครบทุก action (userName จริง, detail ไทย)
- ทดสอบ UI (agent-browser): / → redirect /login ✓ → login admin → โมดูล "แจ้งเตือนภัย" → การ์ด alert ขึ้น badge "ส่งแล้ว" ตามจริง → ปุ่ม "ส่ง & สถานะ" → dialog ครบ (chips 11/11/0/0, ปุ่มส่งซ้ำ, retry disabled, ตาราง 11 แถว) → "ส่งซ้ำ" → chips 10/1 + retry เปิดใช้งาน + แถว failed แสดง error ✓ → "ลองส่งใหม่" (ครั้งแรกยัง failed แสดง "ล้มเหลว ลองใหม่ 1") → กดซ้ำ → toast เขียว "ส่งถึงผู้รับครบ 11 รายการ" + chips 11/11/0/0 + retry disabled กลับ ✓ (screenshot: tool-results/task20a-dialog.png); dev.log ไม่มี error/hydration ใหม่; lint exit 0; เขียน agent-ctx/20-a-full-stack-developer.md

Stage Summary:
- ปิด Gap G5 ครบ: outbox รายช่องทางรายผู้รับ + batch semantics "ส่งซ้ำ = ชุดใหม่" + จำลองส่ง (app 100%, email/broadcast 85%) + retry เฉพาะ failed พร้อมนับ retries + alert → sent เมื่อครบทุกแถว (ยังมี failed → คงสถานะเดิมให้ UI ชี้ retry) — ทุก endpoint บังคับ login (401) ตรวจ soft-delete (404) และ audit ภาษาไทยระบุผู้ทำ
- API ใหม่: POST /api/alerts/[id]/send, GET/POST /api/alerts/[id]/outbox — response shape { alert, outbox, summary } ร่วมกันทั้ง GET/POST ให้ UI อัปเดตครั้งเดียวจบ
- ข้อจำกัด: การส่งเป็นแบบจำลองตามขอบเขต (พร้อมต่อยอด relay จริงโดยแทน simulate()); toast ใช้ useToast เดิม; ต้องรีสตาร์ต dev server 1 ครั้งเพื่อโหลด Prisma Client ใหม่; สถานะสุดท้ายใน DB: alert "ฝนตกหนักภาคใต้ 4–14" เป็น sent พร้อม outbox 11 แถวส่งครบ (คงไว้เป็นตัวอย่างผลการส่ง); ไม่แตะไฟล์ที่ห้าม (lib/api.ts, lib/auth.ts, โมดูล UI อื่น)
- ต้องแก้เพิ่ม: ไม่มีในขอบเขต (ถ้าต้องการส่งจริง: provider adapter ต่อจาก simulate() + cron สำหรับ queued/scheduled เป็นงานถัดไป)

---
Task ID: 19.1 / 20-a / 20-b / 21 (main)
Agent: main (Z.ai Code)
Task: นำเหตุการณ์ "อุทกภัย ปี 2569" เข้าสู่ระบบ (ข้อมูลจริง ปภ. 7 ต.ค. 69) + ปรับปรุง platform ระลอก P2 (Alert pipeline ปิด G5 + Export CSV ปิด G8 บางส่วน) + verify + push

Work Log:
- 19.0: ตรวจสุขภาพ platform ก่อนเริ่ม — พบว่า Task 17.2 ปิด P1 (G1–G4) สมบูรณ์แล้วตาม worklog, dev server ปกติ, DB มี seed 2569 ฉบับประมาณการ (42 จังหวัด/2.6M/40 ราย — ยังไม่ตรงข่าวจริงล่าสุด)
- 19.1: เขียน prisma/import-flood2569.ts (idempotent — ตรวจ unique code/name ก่อน create ทุกแถว) แล้วรันสำเร็จ: อัปเดต 4 incidents ด้วยตัวเลขจริง (INC-2569-005 → 27 จังหวัด + กทม. / 3.1 ล้านคน / 52 ราย; กทม. 329,000 ครัวเรือน 4 ราย น้ำลดลง; ปทุมธานี 7 อำเภอ 510 หมู่บ้าน; C.2 ผ่าน peak; เยียวยา 9,000 บาท flood68+แอปทางรัฐ) + Location +15 จังหวัด + SITREP #10–13 + Alert +2 (1 draft "ฝนตกหนักภาคใต้ 4–14 ต.ค." เก็บไว้ทดสอบ pipeline / 1 sent กทม.) + Shelter +3 (ม.นเรศวร/คลองหลวง/ราชภัฏสวนสุนันทา) พร้อม ShelterOccupancy 11 รายการ + Person +4 (อภิชาติ missing, สายฝน 3-event trail, ประเวศ, กฤษณะ) + contacts +4 + AidRequest +4 (REQ-2569-201..204) + StockMovement +4 (รับบริจาค CP/ไทยน้ำใส → จ่ายศูนย์พักพิง ใน $transaction คงเหลือตรงจริง) + HR +3 (มทบ.42 สร้าง org ใหม่) + audit trail — แก้ bug destructuring person payload 1 จุด แล้วรันซ้ำยืนยัน idempotency (0 ซ้ำ)
- 20-a (subagent full-stack-developer): AlertOutbox model + db push, POST /api/alerts/[id]/send (resolve ผู้รับจาก audience → 5 users × (app+email) + broadcast = 11 แถว, จำลองส่ง 85%, ครบ → alert sent), GET/POST /api/alerts/[id]/outbox (retry เฉพาะ failed, retries+1) + UI dialogs "ส่งและดูสถานะการส่งรายผู้รับ" — agent verify: curl ทั้ง flow + 401 ทั้งคู่ + agent-browser กดส่ง/retry จริง (ต้อง restart dev server 1 ครั้งเพราะ prisma singleton cache หลังเพิ่ม model)
- 20-b (subagent full-stack-developer): toCsv() ใน lib/api.ts (flatten relation 1 ชั้น, RFC 4180, BOM, filename ASCII) + ?format=csv ใน listHandler ทุกโมดูล + /api/inventory/movements (คอลัมน์ไทย) + ปุ่ม "ส่งออก CSV" 5 โมดูล (incidents/persons/shelters/requests/inventory×2 tabs) — agent verify: curl BOM/header/ไทยไม่เพี้ยน/9 แถว, ?q= ใช้กับ CSV ได้, 401 ไม่ล็อกอิน, agent-browser คลิกปุ่มจริง
- 21 (main): bun run lint รวม exit 0 → agent-browser E2E: login admin → เหตุการณ์แสดง "อุทกภัยรอบด้าน 27 จังหวัด + กรุงเทพฯ (ปภ. 7 ต.ค. 69)" 3,100,000 ✓ → SITREP #10–13 ✓ → แจ้งเตือน: กดส่งซ้ำ alert ภาคใต้ → summary "ทั้งหมด 11 / สำเร็จ 11 / ล้มเหลว 0" ✓ → ปุ่มส่งออก CSV + fetch ในเบราว์เซอร์ 200 attachment ✓ → ทะเบียนบุคคล: จีรนันท์ → "พบตัว", สายฝน timeline 3 เหตุการณ์ + ศูนย์พักพิงคลองหลวง ✓ → ศูนย์พักพิง 3 แห่งใหม่ + ledger (+45 → 530) ✓ → console/error ว่าง → มือถือ 390px: พบ horizontal overflow จาก grid shelters (ชื่อศูนย์ใหม่ยาวบังคับ min-content) → แก้ min-w-0 ที่ grid + card ใน shelters.tsx → overflow หาย (docW=390) ✓ → desktop 1440px ปกติ, footer push-down ถูกต้อง ✓

Stage Summary:
- ระบบมีเหตุการณ์ "อุทกภัย ปี 2569" ฉบับข้อมูลจริงล่าสุด (ปภ. 7 ต.ค. 69) ครบสายงาน: incidents 4 / SITREP 18 / alerts 13 / shelters 14 (+ledger 20) / persons 28 (+contacts 13, trail 23) / requests 16 / movements 15 / HR 15 / locations 29 — import script idempotent เก็บไว้ที่ prisma/import-flood2569.ts
- ปิด Gap G5 เชิง pipeline (ตามแผน P2.1 lite): alert มี outbox รายผู้รับ ส่ง/retry/audit ครบ — การส่งจริงผ่าน SMTP/LINE รอตั้งค่า API key (จำลองอยู่)
- ปิด Gap G8 บางส่วน (ตามแผน P2.4): Export CSV ทุกโมดูล CRUD + movements, ปุ่มใน UI 5 โมดูล — PDF export ยังไม่ทำ
- แก้ responsive bug สะสม: shelter card grid min-w-0 (ชื่อไทยยาวไม่ยอมตัดบน headless font stack)
- ทั้งหมดผ่าน lint + agent-browser golden path — พร้อม push ขึ้น GitHub

---
Task ID: 22
Agent: main (Z.ai Code)
Task: เพิ่มความสามารถให้ผู้ช่วย AI — ค้นหาภายนอก (ยกระดับ) + รับไฟล์ข้อมูลจากภายนอก (CSV/TSV/JSON/XLSX + URL) + นำข้อมูลเข้าสู่ระบบตามโมดูลที่เกี่ยวข้อง (11 โมดูล)

Work Log:
- อ่าน worklog (กู้ context ถึง Task 21) + สำรวจ ai-assistant route/UI เดิม (มี web_search toggle + platform context อยู่แล้ว) + schema + auth/api pattern + SKILL.md ของ web-reader/web-search/LLM (ยืนยัน function ชื่อ page_reader, LLM ไม่รองรับ response_format จึงใช้ prompt+JSON.parse)
- ติดตั้ง xlsx@0.18.5 (bun add)
- สร้าง src/lib/data-import.ts (หัวใจระบบ): parser CSV/TSV (RFC4180 + sniff delimiter + BOM + quote ข้ามบรรทัด), JSON (array / data|rows|items|records), XLSX (ชีตแรกที่มีตาราง), MAX_PARSE_ROWS 1000 / MAX_IMPORT_ROWS 500 / 5MB; แคตตาล็อก 11 โมดูล (incidents/locations/shelters/persons/organizations/humanResources/warehouses/inventoryItems/aidRequests/alerts/incidentReports) พร้อมฟิลด์+enum ฉลากไทย→canonical (น้ำท่วม→flood, สูญหาย→missing, เปิดรับ→open ฯลฯ); parseFlexibleDate รองรับ ISO/dd-mm-yyyy/พ.ศ.(−543); normalizeRecord (coerce int/float/date/enum + required + defaults); relation resolver (location/shelter/incident/warehouse/organization — สร้างใหม่อัตโนมัติเมื่อ createIfMissing); import engine รายแถว try/catch + กันซ้ำชื่อ (locations/shelters/warehouses/organizations → skipped) + สร้างรหัสอัตโนมัติ INC/REQ-2569-xxx + ShelterOccupancy ledger ยอดเริ่มต้น + **alerts บังคับ status=draft เสมอ** (นโยบายปลอดภัย ห้ามส่งจริงผ่าน import) + audit('import',...) ทุกครั้ง; staging job in-memory (globalThis Map, TTL 30 นาที, one-shot takeJob, cap 20)
- สร้าง POST /api/ai-assistant/extract — รับ 3 แหล่ง: multipart file / JSON {url} (fetch ≤5MB, timeout 20s) / {text} วางตาราง; parse → LLM mapping (แคตตาล็อกโมดูล+3 แถวตัวอย่าง → JSON {kind,module,columnMapping,constants,warnings} หรือ {kind:document,summary}); เซฟตี้ 3 ชั้น: (1) filter คอลัมน์/ฟิลด์ที่ไม่มีจริง (2) constants ที่ชนกับคอลัมน์ที่ map แล้วถูกตัดทิ้ง (กัน LLM ใส่ enum แปลงเองทั้งตาราง) (3) self-heal: ค่าที่ LLM ยัดใส่ constants แต่มีคอลัมน์ตรงชื่อ → ดึงกลับเป็น column mapping และฟิลด์ required ที่ LLM ลืม map → จับคู่คอลัมน์ด้วยชื่ออัตโนมัติ; ถ้าไม่ใช่ตาราง → LLM สรุปเป็นเอกสาร (kind=document)
- สร้าง POST /api/ai-assistant/import — รับ {jobId} (one-shot กันนำเข้าซ้ำ/หมดอายุ 404) → importRecords → สรุป {created, skipped, failed[20], createdNames}
- เสริม POST /api/ai-assistant — ตรวจจับ URL ในคำถาม (เว้นไฟล์ข้อมูล .csv/.json/.xlsx ให้ flow นำเข้า) → อ่านเนื้อหาด้วย page_reader (fallback fetch+strip HTML) แนบเป็นบล็อก [เนื้อหาจากลิงก์ที่แนบ] + ปรับ system prompt (กฎ 3.1)
- UI ai-assistant.tsx: ปุ่ม 📎 แนบไฟล์ (ตรวจ ext/5MB ฝั่ง client) + typing indicator "กำลังอ่านไฟล์ ตรวจจับโมดูล..." + การ์ดพรีวิวนำเข้า (moduleLabel + จับคู่คอลัมน์→ฟิลด์เป็น chips + ตารางตัวอย่าง 5 แถว scroll + warnings เหลือง + ปุ่ม "นำเข้าสู่ระบบ (n รายการ)" → ผลสรุป สำเร็จ/ข้าม/ล้มเหลว + error รายแถว + toast) + flow วางลิงก์ไฟล์ข้อมูลในแชท (regex จับ URL นามสกุลข้อมูล → extract) + เอกสาร → สรุป markdown พร้อมป้ายชื่อไฟล์ + WELCOME/QUICK_PROMPTS/hero badge ใหม่ ("รับไฟล์ & นำเข้าข้อมูล")
- middleware: ยกเว้น /public-data/* (โฟลเดอร์ไฟล์ข้อมูลสาธารณะ ใช้แชร์/ทดสอบลิงก์ CSV ให้ผู้ช่วยดึงได้) + เก็บ sample public/public-data/shelters-sample.csv
- ทดสอบ curl E2E ครบ: persons.csv (Thai enum+quote+comma) → persons 3/3 (บาดเจ็บ→injured, relation ศูนย์พักพิง resolve ตรงชื่อจริง); JSON วางในแชท → aidRequests 3/3; XLSX → inventoryItems 3/3 (น้ำดื่ม→water); URL → shelters 2/2 (ศูนย์ชุมชน→community_center, เปิดรับ→open, occ 120/300 + ledger); .txt → kind=document สรุปไทย; ไม่ล็อกอิน → 401 ทั้ง 2 endpoint; import ซ้ำ jobId → 404; นำเข้าซ้ำชื่อเดิม → skipped 2; audit log ครบทุก import (ผู้ใช้จริง + สรุปตัวเลข)
- แก้บั๊กที่เจอระหว่างทดสอบ: (1) LLM ใส่ enum ลง constants ทำค่าทับทุกแถว → prompt กติกา 2/3 ใหม่ + เซฟตี้ตัด constants ที่ชนกับ colMap + self-heal (2) LLM ลืม map คอลัมน์ชื่อศูนย์ → self-heal required fields (3) middleware กลืนไฟล์ static → ยกเว้น /public-data
- Drive-by แก้ pre-existing bug ที่ tsc เจอ: map-layers/fetch-url ขาด import requireUser/isResponse (runtime ReferenceError!) + type updatedBy ใน map-layers/[id] + ai-assistant route เดิม: Shelter.locationName (ไม่มีจริง), WebSource.date, pageCtx narrowing (holder box)
- เก็บกวาดข้อมูลทดสอบครบ (persons 34→28, requests 19→16, items 25→22, shelters 16→14, occ 21→20; คง audit log ตามหลัก) — สคริปต์ชั่วคราวรันแล้วลบทันที
- Verify: bun run lint exit 0; bunx tsc --noEmit ไฟล์งาน Task 22 ศูนย์ error (เหลือ error เดิมนอก scope: prisma/import-flood2569.ts, map-layers/route.ts features quirk, skills/*); agent-browser E2E: login → โมดูลผู้ช่วย AI → upload ไฟล์จริง → การ์ดพรีวิว (chips+warning+ปุ่ม) → กดนำเข้า → "สำเร็จ 3 · ข้าม 0 · ล้มเหลว 0" + toast → โมดูลทะเบียนบุคคล ค้นเจอ "วิชัย ใจดี, ผู้ป่วยติดเตียง" badge สูญหายถูกต้อง → console/page errors ว่าง → dev.log ไม่มี error; renormalize file mode 644 (รวมไฟล์ค้างจาก session ก่อน)

Stage Summary:
- ผู้ช่วย AI ของ EDEN DMS มีวงจรข้อมูลภายนอกครบ: ค้นหา (web_search) → อ่านลิงก์ (page_reader อัตโนมัติเมื่อมี URL ในคำถาม) → รับไฟล์ (📎 CSV/TSV/JSON/XLSX หรือลิงก์ไฟล์) → ตรวจจับโมดูล+จับคู่คอลัมน์ด้วย LLM พร้อมเซฟตี้/self-heal 3 ชั้น → พรีวิวยืนยันก่อนบันทึก → นำเข้าจริง 11 โมดูล พร้อม relation resolution, enum ไทย, พ.ศ./ค.ศ., รหัสอัตโนมัติ, ledger, กันซ้ำ, audit trail และนโยบาย "แจ้งเตือนที่นำเข้าเป็นฉบับร่างเสมอ"
- API ใหม่ 2 ตัว + lib ใหม่ 1 ตัว + middleware exemption 1 บรรทัด + UI อัปเกรด — ไม่เปลี่ยน schema.prisma (staging อยู่ใน memory) จึงไม่กระทบ seed
- ตัวอย่างใช้งาน: กด 📎 เลือก CSV ภาษาไทย → การ์ดพรีวิว → นำเข้า; หรือพิมพ์ "https://.../file.csv" ในแชท; หรือถามพร้อมวางลิงก์ข่าว (AI อ่านเนื้อหาลิงก์มาตอบ)
- ข้อจำกัด: ≤500 แถว/5MB ต่อการนำเข้า; mapping 1 ไฟล์→1 โมดูล (ไฟล์หลายโมดูลให้แยกไฟล์); การ map อาศัย LLM (มี self-heal แต่คอลัมน์ไม่บอกความหมายก็อาจ map ผิด — ผู้ใช้ตรวจพรีวิวได้ก่อนยืนยัน); staging อยู่ใน process memory (รีสตาร์ตเซิร์ฟเวอร์ = job หาย ต้องแนบใหม่)
---
Task ID: 23
Agent: main (Z.ai Code)
Task: แก้บั๊ก "Unexpected token '<', \"<html> <h\"... is not valid JSON" เมื่อสั่งผู้ช่วย AI "ค้นหาข้อมูลน้ำท่วม ห้วง 6-7 ต.ค.69 แล้วนำเข้าระบบ" + ยืนยันวงจร ค้นหา→นำเข้าทำงานจริง

Work Log:
- สำรวจ ai-assistant.tsx + 3 API routes + lib/auth + dev.log → root cause: ฝั่ง client เรียก res.json() ตรง ๆ ทั้ง 3 จุด (chat line 249 / extract 157 / import 616) — คำขอแบบ sync ที่ยาว 22–90s (web_search + LLM) ถูก proxy ตัดกลางทางแล้วตอบ HTML error page (502/504) จน JSON.parse พังและโชว์ raw error ดิบ; วัดจริงด้วย curl: ปกติ 22–23s แต่บางครั้งถึง ~70s → เกิน timeout proxy
- สร้าง src/lib/ai-tasks.ts (ใหม่): in-memory async task store (Map + TTL 15 นาที + cap 120 + cleanup), createAiTask/taskPhase/taskDone/taskFail, withTimeout(promise, ms, msgThai), handleTaskStatus() = GET handler ร่วม (auth + คืน {status,phase} / done+result / error / 404 message ไทย)
- รีแฟก 3 routes เป็นแบบ async task: POST อ่าน/ตรวจ input ส่วนที่เร็วแล้วคืน {taskId} ทันที (<1s) — งานนาน (web_search timeout 12s, LLM timeout 110s/90s, fetchExternal 20s) รันเบื้องหลังใน runChat/runExtract/runImport พร้อม taskPhase ภาษาไทยทุก stage (รวบรวมข้อมูล → วิเคราะห์ → เตรียมพรีวิว/บันทึก); GET ?taskId= ติดตามสถานะ — ทุก HTTP request สั้นเสมอ จึงไม่มีทางโดน proxy timeout; extract ย้าย fetchExternal+LLM เข้า background ครบ (work = table|doc|urlfetch), import ย้าย takeJob+importRecords เข้า background
- client ai-assistant.tsx: safeJson() ตรวจ content-type ก่อน parse (ถ้าได้ HTML → throw "เซิร์ฟเวอร์ตอบสนองผิดปกติ (การเชื่อมต่ออาจถูกตัดกลางคัน) — กรุณาลองอีกครั้งครับ" แทน raw "Unexpected token '<'"), runTask() = POST เริ่มงาน → poll GET ทุก 1.8s (ทน network glitch ≤4 ครั้งติด, deadline 4 นาที) → phase callback; ใช้กับ send/runExtract/doImport; state phase แสดงใน typing bubble ("กำลังรวบรวมข้อมูลจากระบบและแหล่งภายนอก…" ฯลฯ); ChatMsg.retryQuestion + ปุ่ม "ส่งใหม่" ใต้ error bubble (ส่งคำถามเดิมซ้ำด้วยคลิกเดียว)
- drive-by แก้ pre-existing bug จาก dev.log: PUT /api/alerts/[id] อ่าน req.json() เองแล้วส่ง req ไป updateHandler ที่อ่านซ้ำ → "Body has already been read" 500 ทุกครั้งที่แก้/ส่งการแจ้งเตือน — แก้โดย updateHandler รับ optional preReadBody (lib/api.ts) + alerts route อ่านครั้งเดียวส่งต่อ + audit 'send' เฉพาะเมื่อ PUT สำเร็จ (ตรวจ res.status) + import NextResponse
- แก้บั๊กตัวเองระหว่างทำ: (1) edit เปิด backtick uid ไม่ปิด → ปิดทันที (2) extract route ตก import moduleCatalogPrompt → ReferenceError ตอน runtime เห็นใน task status แล้วแก้ (3) เพิ่ม console.error raw LLM output ตอน mapping parse fail (debug ภายหลัง)
- เว้นแต่ /test-import ที่เพิ่มซ้ำใน middleware แล้วลบโฟลเดอร์ทิ้ง (Task 22 มี /public-data exemption + sample ไว้ให้แล้ว — ใช้ตัวเดิม)
- ทดสอบ curl ครบ: chat POST→taskId→poll→done คำตอบจริง (~70s โดยไม่พัง); extract text CSV ไทย → shelters แมป 4 คอลัมน์ถูก; import jobId → created 2 + สร้าง Location อัตโนมัติ; edge cases: taskId ไม่มี → 404 ไทย, jobId ซ้ำ → "งานนำเข้าหมดอายุ/ถูกใช้แล้ว", ไม่ login → 401 JSON
- agent-browser E2E: login admin → โมดูลผู้ช่วย AI → เปิดสวิตช์ "ค้นหาข้อมูลภายนอก" → พิมพ์คำสั่งเดิมของผู้ใช้ → เห็น phase "กำลังรวบรวมข้อมูลจากระบบและแหล่งภายนอก…" ระหว่างรอ → ~25s ได้คำตอบ Markdown ครบ (เหตุการณ์/ศูนย์พักพิง/คลัง/คำขอ/คำแนะนำ) + การ์ดแหล่งข้อมูลภายนอก (3) + ป้าย "ใช้ข้อมูลในระบบ·ค้นหาจากภายนอก" + switch คง state + console สะอาด; ทดสอบ import ผ่าน UI: วางลิงก์ CSV (serve จาก /public-data ตรวจ 200) → การ์ดพรีวิว chips แมปครบ → กด "นำเข้าสู่ระบบ (2 รายการ)" → "นำเข้าเสร็จสิ้น: สำเร็จ 2 · ข้าม 0 · ล้มเหลว 0" + toast + ยืนยันข้อมูลเข้า /api/shelters จริง (180/64, 260/150); mobile 390px แสดงผลครบ; PUT alert ทดสอบหลังแก้ → 200
- Verify: bun run lint exit 0; commit 0bd19a0 (8 files, +511/−182) push origin/main สำเร็จ (aa7eb23..0bd19a0)

Stage Summary:
- ผู้ช่วย AI ทนทานขึ้นทั้งสถาปัตยกรรม: งาน AI ทุกประเภท (แชท/วิเคราะห์ไฟล์/นำเข้า) เป็น async task + poll — ไม่มี HTTP request ยาวอีกต่อไป จึงตัดโจทย์ proxy timeout ที่ต้นเหตุ; แม้ proxy ยังตัดบาง request ฝั่ง client ก็แสดงข้อความไทยเข้าใจง่าย + ปุ่มส่งใหม่ ไม่ใช่ "Unexpected token '<'" อีก
- ได้ UX เสริม: phase indicator แบบ realtime (เห็นว่า AI กำลังค้น/กำลังคิด/กำลังบันทึก), ส่งใหม่ด้วยคลิกเดียว, poll ทน network ขัดข้องชั่วคราว, timeout จำกัดทุก stage backend (web 12s / LLM 110s / ดาวน์โหลด 20s) กันงานค้างไม่มีวันจบ
- แก้ bug แจ้งเตือน (alert PUT) ที่พังหมดทุกครั้งที่บันทึก/ส่ง โดยไม่รู้ตัว
- ไฟล์แก้: src/lib/ai-tasks.ts (ใหม่), api/ai-assistant/route.ts, api/ai-assistant/extract/route.ts, api/ai-assistant/import/route.ts, components/eden/ai-assistant.tsx, lib/api.ts, api/alerts/[id]/route.ts; middleware.ts เปลี่ยนกลับเป็นของเดิม (สุทธิไม่แตะ)
- ข้อจำกัด: task store อยู่ใน process memory (dev HMR/รีสตาร์ต = task หาย → client โชว์ message ไทย + ส่งใหม่); production ควรใช้ Redis/DB ถ้า scale หลาย instance
