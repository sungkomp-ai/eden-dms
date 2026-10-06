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
