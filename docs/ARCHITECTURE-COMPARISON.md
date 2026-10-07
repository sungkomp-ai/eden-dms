# เอกสารเปรียบเทียบสถาปัตยกรรม — Sahana Eden (eden-core) vs EDEN DMS (ฉบับใหม่)

> วัตถุประสงค์: ตรวจสอบ**ความครบถ้วนของโมดูล**และ**ความละเอียดของข้อมูล (data granularity)** ระหว่างระบบต้นฉบับกับระบบที่พัฒนาใหม่ เพื่อใช้ประกอบการตัดสินใจยกระดับการออกแบบให้มีประสิทธิภาพสูงสุด
>
> เอกสารนี้อ้างอิง **source จริงทั้งสองฝั่ง**: eden-core `VERSION nursix-dev-5066-g6620ed10d` (2021-08-28) จากไฟล์ที่อัปโหลด (แตกไฟล์ที่ `upload/eden-core-full/eden-core-master/`) และโค้ด EDEN DMS ใน repo นี้ (`prisma/schema.prisma`, `src/`)
> บันทึกการสำรวจอยู่ใน `worklog.md` Task 17-a / 17-b
>
> **ฉบับ 1.1 (เสริมความลึก):** เพิ่ม §6.4 แผนที่ความสัมพันธ์ระหว่าง Entity หลัก 9 ตัว (Person/Org/HR/Shelter/Inventory/Incident/Alert/Location/Auth), ขยาย Gap Analysis G1–G10 เป็นรายช่องว่างพร้อมเกณฑ์ปิด, เพิ่มประมาณความพยายาม (person-day) ใน Action Plan §8, และ Scorecard §9 แยกต่อโดเมนพร้อม projection หลัง P1 / P1+P2

---

## 1. บทสรุปผู้บริหาร (Executive Summary)

| มิติ | eden-core (ต้นฉบับ) | EDEN DMS (ใหม่) | ประเมิน |
|---|---|---|---|
| กรอบงาน | web2py + S3 framework (Python 2/3) รวม 111,195 LOC เฉพาะ framework | Next.js 16 App Router + TypeScript + Prisma | ใหม่ = stack สมัยใหม่ ดูแลง่ายกว่ามาก |
| โมดูล (controller) | 17 controllers, **373 endpoints** (206 เป็น REST) | 13 โมดูล UI, **17 กลุ่ม API** + AI Assistant | ใหม่ครอบคลุม "เส้นทางหลัก" ของงาน DMS |
| ตารางข้อมูล | **299 ตาราง** ใน modules/s3db + 13 meta fields ทุกตาราง | **15 models** แบบ flat | ใหม่เบากว่าราว 20 เท่า — ครอบคลุมเฉพาะ core workflow |
| กลไกสถาปัตยกรรม | super-entity, component tables, soft-delete+uuid+ownership, realm ACL | ไม่มีกลไกเหล่านี้ | **ช่องว่างเชิงโครงสร้างที่ต้องตัดสินใจ** (ดู §7–8) |
| สิ่งที่ใหม่มีแล้วต้นฉบับไม่มี | — | Dashboard data-viz, AI Assistant (RAG+web search), Shelter/Inventory/Requests ในตัว | จุดแข็งของฉบับใหม่ |
| ภาษาไทย | th.py 6,603 คำแปล (ใหญ่อันดับ 3 ของโปรเจกต์) | ทั้งระบบเป็นภาษาไทยแท้ (hardcoded) | ใหม่เหมาะกับผู้ใช้ไทย แต่ lock-in ภาษาเดียว |

**ข้อสรุปสั้น:** EDEN DMS ฉบับใหม่ครอบคลุม workflow หลักของงานจัดการภัยพิบัติ (เหตุการณ์ → ผู้ประสบภัย → ศูนย์พักพิง → คลัง/คำขอ → แจ้งเตือน → รายงาน → AI) ได้ครบและใช้ง่ายกว่าต้นฉบับอย่างชัดเจน แต่**ความละเอียดของข้อมูลยังตื้นกว่าอย่างมีนัยสำคัญ** — โดยเฉพาะด้าน (1) metadata กลาง (soft-delete/uuid/ownership), (2) ข้อมูลบุคคลแบบตารางลูก (contact/identity/presence trail), (3) ระบบแจ้งเตือนที่ส่งได้จริง, (4) accountability (login จริง + audit ครบทุก mutation) รายละเอียดและลำดับความสำคัญอยู่ใน §8–9

---

## 2. สถาปัตยกรรม eden-core (ต้นฉบับ)

### 2.1 แผนภาพ

```mermaid
flowchart TB
    subgraph CLIENT["ฝั่งผู้ใช้"]
        WEB["เบราว์เซอร์<br/>(HTML + jQuery + DataTables + OpenLayers)"]
        ODK["ODK Collect / มือถือ<br/>(XForms / OpenRosa)"]
        PEER["Eden instance อื่น / ระบบภายนอก<br/>(REST XML/JSON, Sync)"]
    end

    subgraph W2P["web2py R-2.9.11 + S3 Framework (modules/s3 — 111,195 LOC)"]
        CTRL["controllers/*.py<br/>17 ไฟล์ / 373 functions / 206 REST"]
        REST["S3Request (s3rest)<br/>CRUD 1 resource = หลาย representation<br/>html, json, xml, csv, xls, pdf, geojson, svg, shp, xform"]
        RES["S3Resource + S3Model + S3Query<br/>(query/filter/join เชิงทรัพยากร + import 5,236 LOC)"]
        AAA["S3 AAA (s3aaa 8,726 LOC)<br/>Auth + Roles + Realm/Entity ACL + S3Audit"]
        UI["Generic Views + 48 Widgets + Filter<br/>(CRUD UI สร้างอัตโนมัติจาก schema)"]
        BI["s3report (pivot) / s3dashboard / s3timeplot<br/>s3pdf / s3export (XLS/CSV/PDF/shp)"]
        MSG["S3Msg<br/>ส่ง Email / SMS (API, GSM modem, SMTP, Twilio, Tropo) / GCM push / parser pipeline"]
        SYNC["S3Sync<br/>repository / dataset / job ระหว่าง deployment"]
        GIS["S3GIS (s3gis 10,345 LOC)<br/>map client + 17 layer types + hierarchy + geocode"]
        XF["S3XForms<br/>สร้าง/รับ ODK form จากตารางใดก็ได้"]
    end

    subgraph S3DB["modules/s3db — นิยามข้อมูล 299 ตาราง (52,674 LOC)"]
        PR["pr_* 49 ตาราง<br/>ทะเบียนบุคคล"]
        ORGD["org_* 51 ตาราง<br/>องค์กร/สถานที่/site"]
        HRM["hrm_* 53 ตาราง<br/>บุคลากร/ทักษะ/อบรม"]
        GISD["gis_* 42 ตาราง<br/>แผนที่"]
        MSGD["msg_* 37 ตาราง<br/>ข้อความ/ช่องทาง"]
        CMSD["cms_* 14 ตาราง<br/>เนื้อหา/SITREP"]
        OTHER["setup 21 / sync 9 / auth 8 /<br/>doc 6 / s3 4 / sit 3 / translate 2"]
    end

    DB[("ฐานข้อมูล<br/>MySQL / PostgreSQL (+PostGIS) / SQLite")]
    SCHED["scheduler worker<br/>ส่ง outbox, gis_update_location_tree,<br/>maintenance, org_site_check"]
    MODEM["GSM Modem thread<br/>(pygsm — ส่ง/รับ SMS จริง)"]

    WEB --> CTRL
    ODK --> XF
    PEER --> REST
    CTRL --> REST --> RES
    RES --> S3DB --> DB
    AAA --> RES
    UI --> WEB
    BI --> RES
    MSG --> SCHED
    MSG --> MODEM
    SYNC --> PEER
    GIS --> S3DB
```

### 2.2 จุดสำคัญเชิงสถาปัตยกรรม

1. **"ประกาศ schema แล้วได้ทุกอย่าง"** — นิยามตารางใน `modules/s3db` หนึ่งครั้ง จะได้ REST API หลาย format + CRUD UI + ฟอร์ม + import/export + pivot report + ODK form อัตโนมัติผ่าน S3Request — นี่คือเหตุผลที่ 299 ตารางมี controller เพียง 373 functions
2. **Super-entity + Components** — ดูรายละเอียดใน §6.2 (pr_pentity, org_site, doc_entity, msg_channel/message, sit_trackable, gis_layer_entity)
3. **Metadata กลาง 13 fields ทุกตาราง** — uuid, mci, **deleted (soft-delete)**, deleted_fk, deleted_rb, created_on/by, modified_on/by, approved_by, owned_by_user, owned_by_group, realm_entity
4. **Deployment template** — `modules/templates/` เลือกเปิดโมดูลตามบริบท (default template เปิด gis/pr/org/hrm/cms/doc/msg และ **ปิด event/cap/survey/project/req/inv/asset/vol ไว้**)
5. **Auth** — web2py Auth + OAuth 4 เจ้า (Facebook/Google/Humanitarian.ID/OpenID Connect) + Master Key + GDPR consent tables
6. **i18n** — web2py `T()` + ไฟล์ภาษา 48 ภาษา (121,678 บรรทัด, ไทย 6,603)
7. **เงื่อนไขสำคัญที่มักเข้าใจผิด:** SITREP ใน Eden **ไม่ใช่ตารางเฉพาะ** — เป็น `cms_post` ใน series ของโมดูล sit (sit.py controller แค่ 26 บรรทัด ที่ delegate ไป `s3db.cms_index`) และ dashboard หน้าแรกของ Eden ไม่มีกราฟสถิติในตัว (ทำผ่าน S3Dashboard framework แยก)

---

## 3. สถาปัตยกรรม EDEN DMS (ฉบับใหม่)

### 3.1 แผนภาพ

```mermaid
flowchart TB
    subgraph CLIENT2["ฝั่งผู้ใช้"]
        BROWSER["เบราว์เซอร์ (Responsive SPA — มือถือ/เดสก์ท็อป)"]
    end

    subgraph NEXT["Next.js 16 (App Router) — ภาษาไทยทั้งระบบ"]
        SPA["src/app/page.tsx<br/>SPA state-based navigation — 13 โมดูล"]
        UI2["components/eden/* — 13 module components<br/>shadcn/ui + Tailwind 4 + recharts + framer-motion"]
        API2["API Routes /api/*<br/>17 กลุ่ม resource (GET/POST/PUT/DELETE)<br/>+ /api/stats (aggregate dashboard)"]
        AIAPI["/api/ai-assistant<br/>RAG บริบทจาก Prisma 9 ชุด<br/>+ web_search + ผู้เชี่ยวชาญภัยพิบัติ (LLM)"]
        LIB["lib/db (PrismaClient), lib/constants, hooks"]
    end

    subgraph DATA2["ชั้นข้อมูล"]
        PRISMA2["Prisma ORM — 15 models แบบ flat"]
        SQLITE2[("SQLite — db/custom.db<br/>seed ข้อมูลจำลองภาษาไทย")]
    end

    BROWSER --> SPA --> UI2 --> API2 --> PRISMA2 --> SQLITE2
    AIAPI --> PRISMA2
    AIAPI --> LLM["Z-AI SDK: LLM + Web Search<br/>(backend เท่านั้น)"]
    API2 --> AUDIT["AuditLog<br/>(บันทึกบาง action)"]
```

### 3.2 โมดูลทั้ง 13 โมดูลและ API

| โมดูล UI | API route | หลักการ (mapping เดิม) |
|---|---|---|
| dashboard | /api/stats | aggregate KPI + กราฟ (recharts) |
| incidents | /api/incidents | เหตุการณ์ (แรงบันดาลใจ event/irs ของ Eden เต็ม) |
| sitreps | /api/reports | SITREP — ตารางแยก IncidentReport (Eden ใช้ cms_post) |
| persons | /api/persons | ทะเบียนบุคคล/สูญหาย (pr) |
| organizations | /api/organizations | ทะเบียนองค์กร (org) |
| hr | /api/hr | บุคลากร (hrm) |
| shelters | /api/shelters | ศูนย์พักพิง (cr_shelter ของ Eden เต็ม) |
| inventory | /api/inventory + /api/warehouses | คลังสินค้า (inv ของ Eden เต็ม) |
| requests | /api/requests | คำขอความช่วยเหลือ (req ของ Eden เต็ม) |
| map | /api/map-layers + /api/locations | GIS — SVG map + KML/GeoJSON layers (gis) |
| alerts | /api/alerts | การแจ้งเตือน (msg) |
| admin | /api/users + /api/settings + /api/audit-logs | ผู้ดูแลระบบ (admin) |
| **assistant** | /api/ai-assistant | **ใหม่ล้วน — ไม่มีใน eden-core** |

---

## 4. ตารางเทียบชั้นสถาปัตยกรรม (Layer-by-Layer)

| ชั้น | eden-core | EDEN DMS ใหม่ | ผลเทียบ |
|---|---|---|---|
| **Presentation** | generic views 173 ไฟล์ สร้างอัตโนมัติ + 48 widgets + DataTables + jQuery (เก่า, UX สม่ำเสมอแต่ทั่วไป) | React SPA ออกแบบเฉพาะงาน 13 โมดูล, shadcn/ui, responsive, dark mode, ภาษาไทยแท้ | **ใหม่ดีกว่า** เชิง UX/ความเหมาะกับผู้ใช้ไทย; ต้นฉบับได้เปรียบเรื่อง generic CRUD ที่แทบไม่ต้องเขียน |
| **Application/API** | S3Request REST เดียว — 1 resource = html/json/xml/csv/xls/pdf/geojson/shp/xform ทันที | Next.js API routes ต่อ resource — JSON เท่านั้น | ต้นฉบับได้เปรียบเรื่อง **multi-format export**; ใหม่เรียบง่าย/ปลอดภัยกว่า เขียนตรง type-safe |
| **Data access** | DAL + S3Resource (query/filter/selector parser) | Prisma ORM (type-safe, migration tooling) | **ใหม่ดีกว่า** เชิง DX/type safety; ต้นฉบับได้เปรียบ import/export/matching ในตัว |
| **Data model** | 299 ตาราง + super-entity + components + 13 meta fields | 15 models แบบ flat + relation ตรง | ดู §6–7 — ใหม่ตื้นกว่ามากแต่อ่านง่าย/สอนง่ายกว่า |
| **Authentication** | login จริง + OAuth 4 เจ้า + master key + verify email | ไม่มีระบบ login (ตาราง User เก็บ role ไว้เท่านั้น) | **ช่องว่าง P1** — ระบบ DMS ต้องมี accountability |
| **Authorization** | role-based + **realm/entity ACL** + approval workflow | role เป็น string ในตาราง User (ไม่ enforce) | **ช่องว่าง P1–P2** |
| **Audit** | S3Audit บันทึก**ทุก** mutation อัตโนมัติ + viewer + anonymize + merge/dedupe | AuditLog เฉพาะ action ที่ API บันทึกเอง | **ช่องว่าง P1** (ทำ middleware ให้ครบ) |
| **Messaging** | inbox/outbox จริง + 11 ชนิด channel + ส่งจริง (GSM modem/SMTP/Twilio/Tropo) + parser/keyword + retry | ตาราง Alert เก็บข้อความ/สถานะ draft→sent (ไม่มีการส่งจริง, ไม่มี inbox) | **ช่องว่าง P2** — ทำ outbox + 2 ชนิด channel (email/Line) พอสำหรับบริบทไทย |
| **GIS** | 21 ชนิด layer (WMS/WFS/XYZ/KML/Shapefile/...), geocode+reverse, GPS waypoint/track, hierarchy L0–L5, map config ต่อผู้ใช้, พิมพ์แผนที่ | SVG projection map + จุด event/shelter/org + KML/GeoJSON upload (MapLayer GeoJSON string) | ใหม่พอสำหรับสาธิต/ใช้งานพื้นฐาน; ต้องเพิ่ม polygon/area + geocode หากใช้จริง (P2) |
| **Reporting/BI** | pivot report + timeplot + dashboard framework + XLS/PDF export ทุก resource | dashboard กราฟสวยตามโมดูล + AI summary; ไม่มี pivot/export ไฟล์ | เท่ากันโดยภาพรวม — ใหม่ได้เปรียบเชิงภาพ, ต้นฉบับได้เปรียบเชิงเอกสาร export |
| **Mobile data collection** | ODK Collect/OpenRosa (สร้าง XForm จากตารางใดก็ได้ + รับ submission) | ไม่มี (มี responsive web แทน) | ช่องว่างตามบริบท — ถ้าเจ้าหน้าที่ภาคสนามใช้ ODK อยู่แล้วค่อยพิจารณา (P3) |
| **Sync ระหว่างหน่วยงาน** | S3Sync peer-to-peer + dataset/uuid | ไม่มี | P3 — เตรียม uuid ไว้ก่อนจะถูก |
| **Documents/Files** | doc module (upload/attach/bulk photo/CKEditor) | ไม่มีการแนบไฟล์ | **ช่องว่าง P2** (แนบรูปเหตุการณ์/เอกสารคำขอ) |
| **i18n** | framework T() + 48 ภาษา | ไทย hardcoded | พอสำหรับเป้าหมายผู้ใช้ไทย; ถ้าจะขยายต้องทำ i18n (P3) |
| **Cron/Background** | web2py scheduler + task queue + GSM modem thread | ไม่มี background worker | ผูกกับข้อเสนอ messaging/export (P2) |
| **Deployment/DevOps** | setup wizard + cloud provisioning (AWS/OpenStack) + monitoring + Docker/ansible + CI 4 databases | bun + Next.js standalone; ไม่มี wizard (ไม่จำเป็นในบริบทใหม่) | ต่างบริบท — ใหม่ deploy ง่ายกว่ามาก |

---

## 5. ความครบถ้วนของโมดูล (Module Completeness Matrix)

สัญลักษณ์: ✅ ครบตามวัตถุประสงค์ใหม่ | ⚠️ มีบางส่วน | ❌ ไม่มี | ➖ ไม่จำเป็นในบริบทใหม่

| Feature domain ของ eden-core | ขนาดในต้นฉบับ | โมดูลใหม่ที่รองรับ | สถานะ | หมายเหตุ |
|---|---|---|---|---|
| Auth & Identity (login/OAuth/consent) | user+group+membership, OAuth 4 เจ้า, GDPR consent | ตาราง User เก็บ role/status/lastLogin เท่านั้น | ❌ | ไม่มี login จริง — P1 |
| Authorization (role + realm ACL) | S3Permission + Role Manager + approval | role string (admin/coordinator/officer/volunteer) | ❌ | P1–P2 |
| Audit & Governance | S3Audit ทุก mutation + anonymize + merge | AuditLog (บาง action) + หน้า admin | ⚠️ | ควรทำให้ครบทุก mutation — P1 |
| GIS/Mapping | 63 functions, 21 layer types, geocode, GPS | โมดูล map + MapLayer (KML/GeoJSON) + จุด 3 ชนิด | ⚠️ | ขาด polygon/area, geocode, GPS — P2 |
| Messaging/Alerting | 52 functions, 11 channels, inbox/outbox/parser | โมดูล alerts (Alert CRUD + schedule/sent fields) | ⚠️ | ไม่มีการส่งจริง/inbox — P2 |
| Person Registry | 49 ตาราง (contact/identity/address/presence/group/...) | Person (flat 16 fields) + ผูก incident/shelter | ⚠️ | ดู §6.3 (1) — P1 |
| Organization Registry | 51 ตาราง (office/facility/service/capacity/...) | Organization (flat 12 fields) | ⚠️ | พอสำหรับ registry พื้นฐาน — P2 |
| Human Resources | 53 ตาราง (course/training/cert/shift/salary/...) | HumanResource (flat 12 fields) | ⚠️ | ขาด training/cert chain — P3 |
| CMS / SITREP | cms_post + series + comments + module binding | IncidentReport แยกตาราง (title/content/status/author) | ✅ | ตรงงาน SITREP มากกว่าต้นฉบับ (อ่านง่าย) — เสริม priority/expired ได้ (P3) |
| Situation (sit) | sit.py delegate ไป cms + sit_presence/sit_trackable | รวมใน incidents + persons (lastSeen) | ⚠️ | concept presence กระจัดใน Person.status |
| Documents | doc_entity/document/image + bulk upload | ไม่มี | ❌ | P2 |
| Synchronization | sync 9 ตาราง + repository/dataset | ไม่มี | ❌ | P3 (เตรียม uuid) |
| ODK/Mobile forms | xforms 14 functions + OpenRosa | ไม่มี (responsive web แทน) | ❌ | P3 ตามบริบทภาคสนาม |
| Administration | user/group/role/audit/error tickets/scheduler tasks/dashboard config/translate | admin module (users/settings/audit viewer) | ⚠️ | ขาด role manager + translation workflow |
| Setup/DevOps wizard | setup.py + 21 ตาราง provisioning | ไม่มี | ➖ | ไม่จำเป็น — deploy model ใหม่ต่างกัน |
| Reporting/BI | pivot + timeplot + dashboard + export XLS/PDF | dashboard กราฟต่อโมดูล + AI สรุป | ⚠️ | ขาด export ไฟล์ — P2 |
| **Inventory (inv)** | **ไม่มีใน eden-core** (อยู่ใน Eden เต็ม เป็นโมดูลที่ template ปิด) | Warehouse + InventoryItem + low-stock alert | ✅ | **ใหม่ทำเพิ่มจาก eden-core** |
| **Requests (req)** | **ไม่มีใน eden-core** | AidRequest + จับคู่ผู้รับผิดชอบ | ✅ | **ใหม่ทำเพิ่มจาก eden-core** |
| **AI Assistant** | ไม่มี | RAG จากทุกโมดูล + web search + คำแนะนำ | ✅ | **ใหม่ล้วน — จุดขายของระบบใหม่** |

**สรุปสัดส่วน:** จาก 18 feature domains — ครบ 5, บางส่วน 8, ไม่มี 4, ไม่จำเป็น 1 (ในจำนวน "ครบ" มี 3 รายการที่**ใหม่ทำเพิ่มเหนือ eden-core**: Inventory, Requests, AI Assistant)

---

## 6. ความละเอียดของข้อมูล (Data Granularity Audit)

### 6.1 ภาพรวมเชิงตัวเลข

| | eden-core | EDEN DMS | สัดส่วน |
|---|---|---|---|
| ตารางข้อมูล | **299** (pr 49, org 51, hrm 53, gis 42, msg 37, setup 21, cms 14, sync 9, auth 8, doc 6, s3 4, sit 3, translate 2) | **15 models** | 5% |
| Meta fields อัตโนมัติต่อตาราง | 13 (uuid, mci, deleted, deleted_fk, deleted_rb, created_on/by, modified_on/by, approved_by, owned_by_user/group, realm_entity) | 2 (createdAt, updatedAt) | 15% |
| กลไก polymorphic | 6 super-entities (pentity, site, doc, channel/message, trackable/situation, layer) | ไม่มี | — |
| Component/link tables | มากกว่า 100 (pr_contact, pr_address, org_organisation_organisation_type, ...) | ไม่มี (ใช้ string field แทน) | — |

> หมายเหตุ: สัดส่วน 5% **ไม่ได้แปลว่าครอบคลุม 5% ของภารกิจ** — 299 ตารางของ Eden จำนวนมากเป็นโครงสร้างรองรับ framework (setup/sync/consent/availability/shift) ที่ไม่เกี่ยวกับ workflow DMS โดยตรง ตารางที่เกี่ยวกับ workflow หลักจริง ๆ ประมาณ 60–80 ตาราง และใหม่ครอบคลุมแกนของกลุ่มนั้นราวครึ่งหนึ่ง ในรูปแบบแบน

### 6.2 กลไกสถาปัตยกรรมข้อมูลของ Eden ที่ควรรู้ก่อนตัดสินใจ

1. **Super-entity `pr_pentity` (pe_id)** — ทุก "entity ที่ติดต่อได้" (person/organisation/group/facility/office/forum) มีแถวร่วมในตารางกลาง + `instance_type` → component กลางอย่าง `pr_contact`, `pr_address`, `pr_image`, `pr_note`, `pr_presence` ผูกกับ entity ใดก็ได้ผ่าน FK เดียว — ใหม่ไม่มีมโนทัศน์นี้ (phone/address เป็น string ใน Person)
2. **Site entity `org_site` (site_id)** — office/facility/(shelter/warehouse เมื่อเปิดโมดูล) เป็น instance ของตารางเดียว → FK `site_id` ใช้ร่วมทั้งระบบ (hrm_human_resource.site_id, auth_user.site_id) — ใหม่แยก Shelter กับ Warehouse เป็น 2 models ไม่เกี่ยวกัน
3. **Soft-delete + uuid + ownership ทุกตาราง** — ลบจริงไม่ได้ (S3Deletion set `deleted=true` + เคลียร์ FK อย่างมีร่องรอย), uuid ทำให้ sync ข้ามระบบได้, `owned_by_user/owned_by_group/realm_entity` เป็นฐานของ record-level ACL, `approved_by` เป็น workflow อนุมัติ — ใหม่ลบแบบ hard delete และไม่มี ownership
4. **gis_location hierarchy** — `level` L0–L5 + self-FK `parent` + materialised `path` + คอลัมน์ denormalized L0–L5 (เก็บชื่อบรรทัดบนไว้ในแถวเองเพื่อรายงานเร็ว) + `inherited` (ไม่มีพิกัดเอง ดึงจาก parent) + geometry (lat/lon/radius/**wkt polygon**/bbox) — ใหม่มี level 3 ระดับ + parent + lat/lng (จุดเท่านั้น)
5. **Component REST** — REST ของ Eden เข้าถึงตารางลูกผ่านพ่อได้อัตโนมัติ (`/pr/person/<id>/contact`) — ใหม่ทำ API ลูกแยกเองเมื่อจำเป็น

### 6.3 เทียบ field-level ราย entity หลัก

#### (1) บุคคล — `pr_person` + components (Eden) vs `Person` (ใหม่)

| หัวข้อมูล | Eden (ตาราง/field) | ใหม่ (field) | ประเมิน |
|---|---|---|---|
| ชื่อ | first_name, **middle_name**, last_name | firstName, lastName | ขาด middle name (สำคัญน้อยในบริบทไทย) |
| เพศ | gender (options) | gender (male/female/other/unknown) | ✅ เท่ากัน |
| อายุ | **date_of_birth** (date) + age เป็น virtual | age (Int) — เก็บตัวเลขตายตัว | ⚠️ ควรเปลี่ยนเป็น DOB (ข้อมูลไม่หมดอายุตามเวลา) |
| เอกสารยืนยันตัว | **pr_identity**: type (passport/บัตร ปชช./ใบขับขี่), value, valid_from/until, หน่วยออก, รูปสแกน | nationalId (string เดียว) | ⚠️ พอใช้แบบเบา; ต้นฉบับลึกกว่ามาก |
| ช่องทางติดต่อ | **pr_contact**: method (SMS/EMAIL/FACEBOOK/TWITTER/...), value, priority, access, ได้หลายรายการ | phone (string เดียว) | ⚠️ ขาด email ของบุคคล, ขาด multiplicity |
| ที่อยู่ | **pr_address**: type (บ้านปัจจุบัน/ทะเบียนบ้าน/ที่ทำงาน), location_id → GIS | address (string เดียว) | ⚠️ พอสำหรับสาธิต |
| **สถานะสูญหาย/พบตัว** | **pr_presence**: presence_condition (Seen/Transit/Check-In/Confirmed/Deceased/Lost/Transfer/Check-Out/Missing), observer (ใครพบ), datetime, location_id, orig_id (ต้นทาง) | status (missing/found/safe/injured/deceased/evacuated) + lastSeenLocation + lastSeenAt | ⚠️ ใหม่สรุปเป็นสถานะปัจจุบัน — **ไม่มี trail ประวัติการพบตัว** (สำคัญมากกับงานค้นหาสูญหาย) |
| รูปถ่าย | pr_image (profile/upload/url) | ไม่มี | ❌ |
| รายละเอียดเพิ่ม | **pr_person_details 27 fields** (สัญชาติ, marital_status, ชื่อบิดา/มารดา, ศาสนา, อาชีพ, missing flag, disabled, literacy...) | notes (free text) | ⚠️ ใหม่ใช้ free text แทนโครงสร้าง |
| ครอบครัว/กลุ่ม | pr_group (Family/Case/Relief Team) + membership + **pr_person_relation** (ความสัมพันธ์) | ไม่มี (มี shelterId ผูกที่พักพิงแทน) | ❌ — งานสูญหายมักค้นเป็นครอบครัว |
| ผูกเหตุการณ์ | (ผ่าน presence/trackable ของ Eden เต็ม) | incidentId (FK ตรง) | ✅ ใหม่ชัดกว่าในบริบทนี้ |

#### (2) องค์กร — `org_organisation` (+links) vs `Organization`

| หัวข้อ | Eden | ใหม่ | ประเมิน |
|---|---|---|---|
| ชื่อ/ชื่อย่อ | name, **acronym**, **org_organisation_name (ชื่อท้องถิ่น)** | name | ⚠️ ขาด acronym |
| ประเภท | **org_organisation_type เป็นตาราง** + M2M link + tags | type (enum-string เดียว) | ⚠️ องค์กรหนึ่งแห่งมีได้หลายบทบาทในจริง |
| Sector/Cluster | **org_sector เป็นตาราง** + M2M + subsector | sector (string เดียว) | ⚠️ เช่นเดียวกัน |
| ติดต่อ | phone, website, logo, year ก่อตั้ง, country | contactPerson, phone, email, address, website, status | ✅ ใหม่มี contact person ชัดเจน / ขาด logo |
| สาขา/หน่วยงานลูก | org_organisation_branch + root_organisation (โครงสร้างต้นสังกัด) | ไม่มี | ❌ |
| บริการ/ทรัพยากร | org_service, org_resource + capacity assessment | ไม่มี | ❌ (P2–P3) |
| ผูกกับบุคลากร/คลัง | ผ่าน FK organisation_id | ✅ resources[], warehouses[] relation | ✅ เทียบเท่าในระดับใช้งาน |

#### (3) บุคลากร — `hrm_human_resource` (+catalog) vs `HumanResource`

| หัวข้อ | Eden | ใหม่ | ประเมิน |
|---|---|---|---|
| ตัวตน | **person_id → pr_person** (HR คือ instance ของคนจริง 1 คน) + type (Staff/Volunteer) | name (string อิสระ) + type (staff/volunteer/trainee) | ⚠️ ใหม่ไม่ผูกกับทะเบียนบุคคล — เกิดข้อมูลคนซ้ำซ้อนได้ |
| ตำแหน่ง | job_title_id → **ตาราง hrm_job_title** + department | jobTitle (string) | ⚠️ |
| สถานะ | status (Active/Resigned/Terminated/Died) + start/end_date + **sit_trackable + sit_presence (GPS trail ภาคสนาม)** | status (available/assigned/on_mission/unavailable) | ✅ ใหม่ออกแบบสถานะเชิงปฏิบัติการตรงงานกว่า (มาจาก domain ใหม่) / ขาดช่วงเวลาสังกัด |
| ทักษะ | **hrm_skill_type + hrm_skill (catalog)** + competency rating | skills (comma-separated string) | ⚠️ ค้นหาได้แบบคร่าว ไม่มีมาตรฐาน |
| อบรม/ใบรับรอง | hrm_course → hrm_training_event → hrm_training (รายบุคคล+เกรด) → hrm_certification | ไม่มี | ❌ P3 |
| มอบหมายที่ตั้ง | site_id → **org_site** (ทุกชนิด) | baseLocation (string) | ⚠️ |

#### (4) ศูนย์พักพิง — (Eden core ไม่มี; Eden เต็มมี cr_shelter + org_site) vs `Shelter`

| หัวข้อ | Eden | ใหม่ | ประเมิน |
|---|---|---|---|
| ตัวตน/ที่ตั้ง | เป็น instance ของ **org_site** (code, location_id, organisation_id) + gis_location | name/type/address/locationId/lat/lng | ✅ ใหม่มีครบเชิงใช้งาน |
| ความจุ/ผู้อยู่ | cr_shelter capacity + **cr_shelter_occupancy เป็นประวัติ (log)** | capacity + **currentOccupancy (ตัวเลขปัจจุบันเดียว)** | ⚠️ ไม่มีประวัติเข้า/ออก — P1 ที่ราคาถูก |
| สิ่งอำนวยความสะดวก | (ผ่าน component/facility ของ Eden เต็ม) | facilities (comma string: water/electricity/medical/...) | ⚠️ |
| เจ้าของ/ผู้ดูแล | organisation_id (FK) | contactPerson + phone (string) | ⚠️ ควรมี organizationId FK |

#### (5) คลังสินค้า — (Eden core ไม่มี inv; Eden เต็มมี) vs `Warehouse` + `InventoryItem`

| หัวข้อ | Eden เต็ม (อ้างอิง domain) | ใหม่ | ประเมิน |
|---|---|---|---|
| คลัง | inv_warehouse = org_site instance | Warehouse (name/purpose/address/manager/capacity/organizationId) | ✅ พอใช้ |
| สินค้า | inv_item (catalog) + inv_inv_item (stock ต่อ site: quantity, pack, currency, ...) | InventoryItem (name/category/type/size/unit/quantity/**minQuantity/expiryDate**) | ✅ ใหม่มี min-stock + expiry ตรงงานบรรเทาทุพภิกขภัย |
| **การเคลื่อนไหวสต๊อก** | **inv_send / inv_recv — ledger รับ-จ่าย-โอน ระหว่าง site พร้อม tracking** | ไม่มี (แก้ quantity ตรง ๆ) | ❌ **ช่องว่างสำคัญ** — ตรวจสอบย้อนหลังไม่ได้ (P1–P2) |

#### (6) เหตุการณ์ + SITREP — (Eden core: cms_post; Eden เต็ม: event/irs) vs `Incident` + `IncidentReport`

| หัวข้อ | Eden | ใหม่ | ประเมิน |
|---|---|---|---|
| เหตุการณ์ | eden-core: โมดูล event ถูกปิดใน template (ไม่มี s3db/event.py) — Eden เต็มมี event_event | Incident (code/title/type/severity/status/affected/injured/deceased/startDate/endDate/location) | ✅ ใหม่ออกแบบตรงภารกิจ + มีตัวเลขผลกระทบในตัว |
| SITREP | **cms_post** ใน series (title/body/date/location_id/priority Info-Important-Critical/status/expired/roles_permitted/comments) | IncidentReport (title/content/status draft-published/author/incidentId) | ✅ โครงสร้างตรงงานกว่า / ขาด priority + expired + ผูก location |
| SITREP ผูกเหตุการณ์ | ผ่าน cms_post_module (ยืดหยุ่น แต่ indirect) | incidentId FK ตรง | ✅ ใหม่ชัดกว่า |

#### (7) แจ้งเตือน — `msg_message` + channels (Eden) vs `Alert` (ใหม่)

| หัวข้อ | Eden | ใหม่ | ประเมิน |
|---|---|---|---|
| โครงสร้างข้อความ | msg_message (super) → msg_email/sms/facebook/twitter/rss instances + msg_outbox (รายผู้รับ, status Unsent/Sent/Draft/Invalid/Failed, **retries**) | Alert (title/message/channel เดียว/severity/audience/status draft-scheduled-sent/scheduledAt/sentAt) | ⚠️ ใหม่เป็น "ประกาศ" 1 ทิศทาง — ไม่มีรายผู้รับ |
| ช่องทาง | **11 ชนิดจริง** (email, GSM modem, SMTP-SMS, Twilio, Tropo, WebAPI, Mobile Commons, GCM, RSS, Twitter, Facebook) | channel เป็น label (sms/email/broadcast/app) | ❌ ไม่มีการส่งจริง — P2 |
| รับข้อความกลับ | inbox 5 media + parser/keyword automation + twitter search | ไม่มี | ❌ |
| ผูกระบบ | ส่งถึง person/group/org ผ่าน pe_id + subscription | audience เป็น enum (all/area/volunteers/officers) | ⚠️ |

#### (8) ตำแหน่ง — `gis_location` vs `Location` / `MapLayer` vs `gis_layer_*`

| หัวข้อ | Eden | ใหม่ | ประเมิน |
|---|---|---|---|
| ลำดับชั้น | level L0–L5 + parent + **path (materialised)** + **L0–L5 denormalized names** | level (province/district/subdistrict) + parentId | ✅ แกนเดียวกัน — ขาด denorm (ผลกระทบเฉพาะ performance รายงานใหญ่) |
| พิกัด | lat/lon + **radius + wkt (polygon/line) + bbox** + inherited + elevation | lat/lng (จุดเท่านั้น) | ⚠️ **พื้นที่น้ำท่วม/เขตอพยพต้องใช้ polygon** — P2 |
| ชั้นแผนที่ | **17 ชนิด layer** + gis_config ต่อผู้ใช้ + style/marker/projection/opacity | MapLayer (GeoJSON string + color + visible) | ⚠️ พอสำหรับ SVG map ปัจจุบัน |
| geocode | ในตัว (geopy + manual) | ไม่มี | ❌ P2 — กรอกชื่อ ตจว. แล้วหาพิกัดอัตโนมัติจะเพิ่มคุณค่ามาก |

#### (9) ผู้ใช้/สิทธิ์ — `auth_*` vs `User` + `AuditLog` + `Setting`

| หัวข้อ | Eden | ใหม่ | ประเมิน |
|---|---|---|---|
| บัญชี | auth_user (ผูก pe_id → person จริง, organisation_id, site_id) + login + OAuth 4 เจ้า | User (email/name/role/status/lastLoginAt) — ไม่มี password/login | ❌ P1 |
| บทบาท | auth_group + auth_membership + **auth_permission (ตารางสิทธิ์)** + realm/entity ACL | role เป็น string 1 ค่า/คน | ❌ P1–P2 |
| Consent (GDPR) | auth_consent* 3 ตาราง | ไม่มี | ➖ ตามบริบท PDPA ไทยอาจจำเป็นภายหลัง |
| Audit | S3Audit อัตโนมัติทุกตาราง | AuditLog ที่ API เรียกเอง | ⚠️ P1 |

### 6.4 แผนที่ความสัมพันธ์ระหว่าง Entity หลัก (Person / Org / HR / Shelter / Inventory / Incident / Alert / Location / Auth)

เพิ่มเติมจากการเทียบ "ต่อตาราง" ใน §6.3 — คุณค่าเชิงระบบอยู่ที่ **เส้นเชื่อมระหว่าง entity** ซึ่งเป็นตัวกำหนดว่า workflow จริง (รับแจ้งสูญหาย → ค้นพบ → ย้ายเข้าพักพิง → เบิกของจากคลัง → รายงาน/แจ้งเตือน) จะเดินต่อเนื่องได้แค่ไหน

#### 6.4.1 Eden — เชื่อมผ่าน Super-entity hub (สกัดจาก field จริงใน modules/s3db + modules/s3/s3aaa.py)

```mermaid
erDiagram
    pr_pentity ||--o{ pr_person : instance_type
    pr_pentity ||--o{ org_organisation : instance_type
    pr_pentity ||--o{ pr_group : instance_type
    pr_pentity ||--o{ pr_contact : pe_id
    pr_pentity ||--o{ pr_address : pe_id
    pr_pentity ||--o{ pr_identity : pe_id
    pr_pentity ||--o{ pr_image : pe_id
    pr_pentity ||--o{ pr_presence : pe_id
    pr_pentity ||--o{ msg_outbox : pe_id
    auth_user }o--|| pr_pentity : pe_id
    auth_user }o--|| org_organisation : organisation_id
    auth_user }o--|| org_site : site_id
    hrm_human_resource }o--|| pr_person : person_id
    hrm_human_resource }o--|| org_organisation : organisation_id
    hrm_human_resource }o--|| org_site : site_id
    org_site }o--|| org_organisation : organisation_id
    org_site }o--|| gis_location : location_id
    gis_location ||--o{ gis_location : parent_L0_L5
    cms_post }o--|| gis_location : location_id
    sit_presence }o--|| gis_location : location_id
    sit_presence }o--|| pr_person : trackable
```

กลไกที่ต้องเข้าใจก่อนตัดสิน:

- **pr_pentity = hub ที่ 1** ("entity ที่ติดต่อได้" ทุกชนิด): person/org/group เป็น instance โดยมี `instance_type` แยกชนิด → component กลาง (contact/address/identity/image/presence) และ `msg_outbox` อ้างผู้รับ "ใครก็ได้" ด้วย FK เดียว (`pe_id` — ยืนยันจาก `super_link("pe_id", "pr_pentity")` ใน s3db/msg.py)
- **org_site = hub ที่ 2** ("สถานที่ปฏิบัติงาน"): office/facility/(shelter/warehouse เมื่อเปิดโมดูล) ล้วนเป็น instance → `site_id` ตัวเดียวใช้ผูกทั้ง hrm/auth/inv (ยืนยัน `super_link("site_id", "org_site")` ใน s3db/hrm.py 4 จุด)
- **sit_presence** ผูกแบบ polymorphic (`trackable_table` + `trackable_id`) → เก็บ trail การพบตัว + GPS (direction/speed/accuracy) ของ person หรือ human_resource
- **gis_location = hub ที่ 3 เชิงพื้นที่**: self-ref `parent` (L0–L5) และถูกอ้างจากทุก entity ที่มีที่ตั้ง (address, site, cms_post, presence)
- **auth_user ผูกครบ 3 ฝั่ง**: `pe_id` (ตัวตนคนจริง) + `organisation_id` (หน่วยงาน) + `site_id` (ฐานปฏิบัติงาน) — ทำ record-level scope ได้ตั้งแต่โครงสร้าง

#### 6.4.2 EDEN DMS — FK ตรงแบบ relational (สกัดจาก prisma/schema.prisma)

```mermaid
erDiagram
    Location ||--o{ Location : parentId
    Location ||--o{ Incident : locationId
    Location ||--o{ Shelter : locationId
    Incident ||--o{ IncidentReport : incidentId
    Incident ||--o{ Person : incidentId
    Incident ||--o{ AidRequest : incidentId
    Incident ||--o{ Alert : incidentId
    Shelter ||--o{ Person : shelterId
    Organization ||--o{ HumanResource : organizationId
    Organization ||--o{ Warehouse : organizationId
    Warehouse ||--o{ InventoryItem : warehouseId
```

> สังเกต 2 จุด: (1) Person/AidRequest/HumanResource **ไม่มีเส้นเชื่อมกับ Location เชิง FK** (ใช้ string: `address` / `locationName` / `baseLocation`) (2) **User ไม่มีเส้นเชื่อมกับสิ่งใดเลย** — ไม่ผูก Person/Org/Shelter

#### 6.4.3 เทียบเส้นเชื่อมรายคู่ 14 เส้น (R1–R14)

| # | เส้นเชื่อม | Eden (กลไกจริง + field ใน source) | EDEN DMS | ประเมิน |
|---|---|---|---|---|
| R1 | Person ↔ Location | `pr_address.location_id` (หลายที่อยู่ต่อคน) + `pr_presence.location_id` (ที่พบ) | `Person.address` และ `lastSeenLocation` เป็น string | ⚠️ กรอง/ค้นตามพื้นที่เชิงภูมิศาสตร์ไม่ได้ |
| R2 | Person ↔ Incident | ผ่าน presence/trackable (Eden เต็มผูก event) | `incidentId` FK ตรง | ✅ ใหม่ตรงงานกว่า |
| R3 | Person ↔ Shelter | Eden เต็ม: `cr_shelter_occupancy` (log เข้า-ออก) | `shelterId` FK จุดเดียว (ไม่มีประวัติ) | ⚠️ ชัดแต่ตื้น — ดู G4 |
| R4 | Person ↔ HR | `hrm_human_resource.person_id` | ไม่มี — `HumanResource.name` เป็น string อิสระ | ❌ คนเดียวถูกกรอกซ้ำเป็น 2 ข้อมูลได้ |
| R5 | Person ↔ Auth | `auth_user.pe_id` (บัญชีผูกคนจริง) | ไม่มี — `User` ไม่ผูก Person | ❌ ไม่รู้ใครบันทึกข้อมูลใคร (แกนของ G1) |
| R6 | HR ↔ Org | `hrm_human_resource.organisation_id` (default root_org) | `organizationId` FK | ✅ เทียบเท่า |
| R7 | HR ↔ สถานที่ปฏิบัติงาน | `hrm_human_resource.site_id` → org_site (site ใดก็ได้) | `baseLocation` string | ⚠️ กรองตามฐานปฏิบัติงานไม่ได้ |
| R8 | Org ↔ Shelter | ผ่าน `org_site.organisation_id` (Eden เต็ม) | ไม่มี — `Shelter.contactPerson` string (ขณะที่ Warehouse ผูก organizationId แล้ว — ไม่สม่ำเสมอ) | ⚠️ |
| R9 | Org ↔ Warehouse/สต๊อก | org_site (inv_warehouse) + `inv_inv_item.site_id` (Eden เต็ม) | `organizationId` FK + `items[]` | ✅ เทียบเท่า |
| R10 | Shelter ↔ Inventory | `inv_send`/`inv_recv` — ledger รับ-จ่าย-โอนระหว่าง site (Eden เต็ม) | ไม่มีทั้งสองฝั่ง | ❌ เบิกของเข้าพักพิงไม่มีต้นทาง-ปลายทาง (ดู G4) |
| R11 | Incident ↔ Alert/Request | (Eden เต็ม: event_incident_type) | `aidRequests[]` + `alerts[]` FK ตรง | ✅ ใหม่ชัดกว่า |
| R12 | Alert ↔ ผู้รับ | `msg_outbox.pe_id` **รายคน** + status Unsent/Sent/Failed + retries | `audience` เป็น enum กลุ่มเดียว (all/area/volunteers/officers) | ❌ ไม่มีรายผู้รับ — "ส่งแล้ว" พิสูจน์ไม่ได้ |
| R13 | Incident ↔ Location | gis_location + **wkt polygon/bbox** | `locationId` + lat/lng จุดเดียว + `locationName` string | ⚠️ เขตน้ำท่วม/เขตอพยพเป็น polygon ไม่ได้ (G7) |
| R14 | Auth ↔ Org/Site | `auth_user.organisation_id` + `site_id` | ไม่มี | ❌ จำกัดขอบเขตข้อมูลต่อหน่วยงาน (scope) ไม่ได้ |

**ข้อสังเคราะห์ 3 ข้อ:**

1. Eden สร้างเส้นเชื่อมใหม่ได้โดยไม่แก้ตารางเดิม (พึ่ง 2–3 hub กลาง) — DMS ต้อง migration ทุกครั้งที่เพิ่มเส้น แต่อ่าน/สอน/debug ง่ายกว่าอย่างชัดเจน
2. เส้นที่ DMS **ขาดและกระทบ workflow จริง** = R4, R5, R8, R10, R12, R14 → เป็นต้นทางของ Gap G1–G4 และงาน P1 ทั้งหมดใน §8
3. เส้นที่ใหม่ทำได้ดีหรือเทียบเท่า (R2, R6, R9, R11) = **หลักฐานว่าไม่ต้องถอยไปทำ super-entity** — ใช้ FK ตรงต่อไป

---

## 7. ช่องว่างเชิงสถาปัตยกรรมที่กระทบการใช้งานจริง (Gap Analysis G1–G10)

แต่ละช่องว่างระบุ: สถานการณ์ที่เจอจริง / ต้นตอเชิงสถาปัตยกรรม / เส้นเชื่อมที่เกี่ยวข้อง (อ้าง R1–R14 จาก §6.4.3) / วิธีปิด (อ้างงานใน §8) และเกณฑ์ว่าถือว่า "ปิดแล้ว" เมื่ออะไร

#### G1 — ไม่มี accountability รอบข้อมูล 🔴 P1
- **สถานการณ์จริง:** กรรมการถามว่า "ใครกรอกสถานะผู้สูญหายว่าพบตัว / ใครอนุมัติคำขอ" — ระบบตอบไม่ได้ เพราะไม่มีบัญชีผู้ใช้จริงและไม่มีบันทึกผู้ทำรายการ
- **ต้นตอเชิงสถาปัตยกรรม:** ไม่มี login + ไม่มี createdBy/updatedBy + AuditLog บันทึกเฉพาะจุดที่ API เขียนเอง (ไม่ครบทุก mutation)
- **เส้นเชื่อมเกี่ยวข้อง:** R5 (Person↔Auth), R14 (Auth↔Org/Site)
- **ปิดด้วย:** งาน 1.1 + 1.2 + 1.3 — **เกณฑ์ปิด:** ทุก mutation มี createdBy/updatedBy, AuditLog เขียนอัตโนมัติครบ, เรียก API ใดก็ต้อง login

#### G2 — ไม่มี soft-delete / uuid / ownership 🔴 P1
- **สถานการณ์จริง:** เจ้าหน้าที่ลบ Person ผิดคน (ชื่อซ้ำกัน) ข้อมูลหายถาวรทันที; เมื่อจะแลกข้อมูลกับหน่วยงานอื่นในอนาคต sync ไม่ได้เพราะไม่มี id กลาง
- **ต้นตอเชิงสถาปัตยกรรม:** ไม่มี meta fields กลางแบบ Eden ที่มีทุกตาราง (deleted, uuid, owned_by_user/owned_by_group, realm_entity — 13 ตัว)
- **เส้นเชื่อมเกี่ยวข้อง:** ทุกเส้น (เป็นโครงสร้างรองรับ)
- **ปิดด้วย:** งาน 1.1 (ส่วน ownership ตามมากับ 1.2) — **เกณฑ์ปิด:** DELETE = soft-delete (API filter `deleted=true` เสมอ), ทุกแถวมี uuid, มีตารางร่องรอยการลบ

#### G3 — Person แบนเกินไปสำหรับงานสูญหาย 🔴 P1
- **สถานการณ์จริง:** พิสูจน์ตัวตนว่า "บิดามารดาชื่ออะไร อายุเท่าไหร่ บัตรเลขไหน" และดูประวัติการพบตัว 3 ครั้งล่าสุดของผู้สูญหาย — ทำไม่ได้; ค้นครอบครัวเป็นชุดไม่ได้; ติดต่อครอบครัวได้ทางเดียว (phone ตัวเดียว)
- **ต้นตอเชิงสถาปัตยกรรม:** Person เป็นแบน 16 fields แทนโครงสร้าง Person + components แบบ Eden (pr_identity / pr_contact หลายรายการ / pr_presence เป็น trail / pr_group ครอบครัว) และเก็บ `age` เป็นตัวเลขตายตัวแทน `date_of_birth`
- **เส้นเชื่อมเกี่ยวข้อง:** R1 (Person↔Location เป็น string)
- **ปิดด้วย:** งาน 1.4 — **เกณฑ์ปิด:** DOB เป็นวันที่, ติดต่อได้หลายช่องทางพร้อมลำดับความสำคัญ, เห็น timeline การพบตัวรายคน (สถานะ+เวลา+ที่+ผู้สังเกต)

#### G4 — ไม่มีประวัติ movement (occupancy + stock) 🔴 P1
- **สถานการณ์จริง:** เช้า currentOccupancy=320 บ่ายเหลือ 305 — ใครย้ายเข้า/ย้ายออกทำไม; จ่ายน้ำดื่ม 1,000 ขวดจากคลังไหน ใครเบิก ไปที่ไหน — ตอบไม่ได้ ตรวจของหายไม่ได้
- **ต้นตอเชิงสถาปัตยกรรม:** ใช้ตัวเลขปัจจุบันเขียนทับ (`currentOccupancy`, `InventoryItem.quantity`) แทน ledger/log แบบ Eden (cr_shelter_occupancy, inv_send/inv_recv — และสังเกตว่า Eden เต็มก็ใช้ ledger เหมือนกัน ไม่ใช่แก้ตัวเลขตรง)
- **เส้นเชื่อมเกี่ยวข้อง:** R3 (Person↔Shelter), R10 (Shelter↔Inventory — เส้นที่ **ทั้งสองระบบไม่มีให้คลิกต่อกันใน UI** แต่ Eden มีหลักฐานธุรกรรมในตาราง)
- **ปิดด้วย:** งาน 1.5 — **เกณฑ์ปิด:** ทุกการเข้า/ออกพักพิงและทุกการรับ/จ่าย/โอน/ปรับสต๊อกมีแถว log พร้อมผู้บันทึก + ตัวเลขปัจจุบัน derive จาก log

#### G5 — Alert ไม่ส่งจริง 🟠 P2
- **สถานการณ์จริง:** ตั้ง alert "น้ำท่วมวัด X ขอให้อพยพ" สถานะเปลี่ยนเป็น sent แต่ไม่มีอะไรถูกส่งออกไปไหน — ผู้ใช้เข้าใจว่าแจ้งแล้ว = **ความเสี่ยงชีวิต**
- **ต้นตอเชิงสถาปัตยกรรม:** Alert เป็น record 1 ทิศทาง ไม่มี outbox รายผู้รับ ไม่มีช่องทางจริง ไม่มี retry (Eden: `msg_outbox` ต่อผู้รับพร้อม status Unsent/Sent/Failed + retries + ส่งผ่าน GSM modem/SMTP/Twilio จริง)
- **เส้นเชื่อมเกี่ยวข้อง:** R12 (Alert↔ผู้รับ)
- **ปิดด้วย:** งาน 2.1 — **เกณฑ์ปิด:** สร้าง alert → ระบบสร้าง outbox รายผู้รับ → ส่ง email/Line จริง → เห็น sentAt/failed/retries ต่อราย

#### G6 — ไม่มีไฟล์แนบ 🟠 P2
- **สถานการณ์จริง:** รายงานเหตุการณ์ต้องแนบรูปน้ำท่วม, คำขอควรแนบหนังสือราชการ, ผู้สูญหายควรมีรูปให้ทีมค้นหาใช้
- **ต้นตอเชิงสถาปัตยกรรม:** ไม่มี model Document (Eden: `doc_entity`/`doc_document` — แนบกับ entity ใดก็ได้ + bulk photo upload)
- **เส้นเชื่อมเกี่ยวข้อง:** Incident/IncidentReport/Person/AidRequest ทั้งหมด
- **ปิดด้วย:** งาน 2.2 — **เกณฑ์ปิด:** แนบไฟล์ที่ incident/person/sitrep/request ได้ + เปิดดูจากหน้ารายละเอียด + รู้ว่าใครอัปโหลด

#### G7 — GIS จุดเท่านั้น + ไม่มี geocode 🟠 P2
- **สถานการณ์จริง:** เขตน้ำท่วม/เขตอพยพเป็น "พื้นที่" (polygon) แต่ระบบเก็บ lat/lng จุดเดียว; กรอก "ต.บางพูด อ.ปากเกร็ด" ต้องหาพิกัดเองจากแผนที่ในเว็บอื่น
- **ต้นตอเชิงสถาปัตยกรรม:** Location/Incident ไม่มี geometry แบบ area (Eden gis_location มี `wkt` polygon/line + bbox + radius + geocode ในตัวผ่าน geopy)
- **เส้นเชื่อมเกี่ยวข้อง:** R13 (Incident↔Location), R1 (Person↔Location)
- **ปิดด้วย:** งาน 2.3 — **เกณฑ์ปิด:** วาด/นำเข้าเขตพื้นที่แสดงบนแผนที่ได้ + พิมพ์ชื่อพื้นที่ในฟอร์มแล้วได้พิกัดอัตโนมัติ

#### G8 — ไม่มี export / pivot 🟠 P2
- **สถานการณ์จริง:** ประชุม ECC ต้องส่งตารางผู้ประสบภัย/สต๊อกเป็นไฟล์ Excel ให้ต่อเนื่องประเทศทุกวัน — ต้อง copy จากหน้าจอมือ
- **ต้นตอเชิงสถาปัตยกรรม:** API คืน JSON เท่านั้น (Eden S3Request คืน resource เดียวเป็น html/json/xml/csv/xls/pdf/geojson/shp ได้ทันที)
- **เส้นเชื่อมเกี่ยวข้อง:** ทุกโมดูล
- **ปิดด้วย:** งาน 2.4 — **เกณฑ์ปิด:** ปุ่ม export CSV/XLS ทุกตารางหลัก + PDF รายงานเหตุการณ์

#### G9 — Catalog เป็น free string 🟡 P2–P3
- **สถานการณ์จริง:** กรอก sector ทั้ง "สาธารณสุข"/"Public Health"/"health" ปนกัน — สถิติ/กรอง/รายงานไม่แน่น ข้อมูลเขียนไม่ตรงกัน
- **ต้นตอเชิงสถาปัตยกรรม:** ใช้ free string แทนตาราง catalog + M2M แบบ Eden (`org_organisation_type`, `org_sector`+subsector, `hrm_skill_type`) — องค์กรหนึ่งแห่งในจริงมีได้หลายบทบาท
- **เส้นเชื่อมเกี่ยวข้อง:** R6 (HR↔Org), R7, R8 (Org↔Shelter), R9
- **ปิดด้วย:** งาน 2.5 (+P3 skill catalog) — **เกณฑ์ปิด:** เลือกจากรายการมาตรฐานเท่านั้น + Shelter มี organizationId ครบ

#### G10 — ไม่มี i18n / ODK / sync / consent 🟡 P3
- **สถานการณ์จริง:** ขยายผู้ใช้ต่างชาติ / เจ้าหน้าที่ภาคสนามใช้ ODK Collect / แลกข้อมูลข้ามหน่วยงาน / ความต้องการตาม PDPA — ยังเดินไม่ได้ทั้ง 4 อย่าง
- **ต้นตอเชิงสถาปัตยกรรม:** ยังไม่ใช่ความต้องการรอบปัจจุบัน (Eden มีทั้ง 4 ส่วน: T() 48 ภาษา, xforms/OpenRosa, S3Sync dataset/uuid, auth_consent 3 ตาราง)
- **เส้นเชื่อมเกี่ยวข้อง:** ข้ามโดเมน
- **ปิดด้วย:** P3 backlog (ตัวเลขใน §8.3) — ทำงาน 1.1 (uuid) ก่อนจะทำให้ sync ในอนาคตถูกที่สุด
- **เกณฑ์ปิด:** แยกเป็นโครงการย่อยเมื่อบริบทเปิด

---

## 8. ข้อเสนอแนะเพื่อยกระดับการออกแบบ (Action Plan พร้อมประมาณความพยายาม)

> หน่วยประมาณการ: **PD (person-day)** = นักพัฒนา full-stack ที่คุ้นเคย Next.js/Prisma ทำงานวันละ 1 วันเต็ม — รวม schema + API + UI + ทดสอบพื้นฐานของงานนั้นแล้วเสร็จภายในตัวเอง (ไม่รวม QA หลายอุปกรณ์/UAT) กรอบบน–กรอบล่างคิดจากความแน่นอนของ UX และจำนวน route ที่ต้อง retrofit

### 8.1 P1 — โครงสร้างพื้นฐานความน่าเชื่อถือ (รวม ~17.5–22 PD — ทำก่อน)

| งาน | สิ่งที่ทำ | งานย่อย | ประมาณการ | ปิด Gap |
|---|---|---|---|---|
| 1.1 Meta fields กลาง | เพิ่มทุก model: `deleted Boolean` (soft-delete ที่ API filter เอง), `uuid String @unique @default(uuid())`, `createdBy/updatedBy String?` + helper `withMeta()` | schema 0.5 / helper 0.5 / retrofit API 17 กลุ่ม 1.5 / seed+regression 0.5 | **3–4 PD** | G2 |
| 1.2 Login จริง | NextAuth (credentials พอ) + middleware บังคับ login ทุก route + หน้า login + ผูก createdBy อัตโนมัติ + หน้า admin จัดการ user เดิมต่อยอด | config+page 1.5 / middleware+session 0.5 / UI admin 1 / ทดสอบ role 0.5 | **4–5 PD** | G1 |
| 1.3 Audit ครบทุก mutation | helper `withAudit()` ครอบ POST/PUT/DELETE ทุก route (บันทึก action/module/detail/user อัตโนมัติ) | route group ละ 0.15 ประมาณ | **2–3 PD** | G1 |
| 1.4 Person ลึกขึ้น | เปลี่ยน `age` → `dateOfBirth` + `PersonContact {type, value, priority}` + `emergencyContact` + `PersonEvent {status, at, location, observer}` (presence trail) + timeline UI ในหน้า person | schema+API 1.5 / form+table+timeline 1.5 / migrate seed 0.5 | **3.5–4.5 PD** | G3 |
| 1.5 Movement ledger | `ShelterOccupancy {shelterId, count, delta, at, note, by}` + `StockMovement {itemId, type: receive/issue/transfer/adjust, qty, fromWarehouseId?, toWarehouseId?, ref, at, by}` + หน้าบันทึกเข้า-ออก + เบิก-จ่าย-โอน + ผูก low-stock alert กับ ledger | schema+API 2 / UI 2.5 / ผูก alert ต่ำสุด 0.5 | **5–6 PD** | G4 |
| **รวม P1** | | | **~17.5–22 PD** | G1–G4 |

### 8.2 P2 — ความสามารถเชิงปฏิบัติการ (รวม ~19–27 PD)

| งาน | สิ่งที่ทำ | ประมาณการ | ปิด Gap |
|---|---|---|---|
| 2.1 Alert pipeline จริง | `AlertChannel {type: email/line_notify/webhook, config}` + `AlertOutbox {alertId, target, status, retries, sentAt}` + worker (cron route หรือ mini-service) + สร้าง outbox จาก audience อัตโนมัติ | **6–8 PD** | G5 |
| 2.2 ไฟล์แนบ | `Document {entity, entityId, file, mime, name, uploadedBy}` + upload API + UI แนบใน incident/person/sitrep/request | **4–5 PD** | G6 |
| 2.3 GIS polygon + geocode | เพิ่ม `area String?` (GeoJSON polygon) ให้ Incident/Location + วาด/แสดงบนแผนที่ + geocode (Nominatim) ในฟอร์ม | **4–6 PD** | G7 |
| 2.4 Export | `GET /api/<res>?format=csv\|xls` ทุก resource + ปุ่ม export ทุกตาราง + PDF รายงานเหตุการณ์ | **3–5 PD** | G8 |
| 2.5 Org catalog | `OrganisationType`, `Sector` เป็นตาราง (หรือเริ่มที่ enum validation) + `organizationId` ให้ Shelter + UI เลือกจาก catalog | **2–3 PD** | G9 |
| **รวม P2** | | **~19–27 PD** | G5–G9 |

### 8.3 P3 — Backlog เชิงลึก (เลือกทำตามบริบท — รวม ~42–50 PD)

| กลุ่มงาน | ประมาณการ |
|---|---|
| PersonGroup (ครอบครัว/เคส) + PersonRelation | 4–5 PD |
| HRM skill/training/certification catalog | 5–6 PD |
| SITREP priority + expires_on | 1–2 PD |
| i18n (th/en) | 6–8 PD |
| ODK/OpenRosa intake | 10–12 PD |
| Sync ข้ามหน่วยงาน (uuid-based exchange) | 8–10 PD |
| Pivot report | 5–7 PD |
| PDPA consent records | 3–4 PD |

### 8.4 ลำดับและ dependency

1. **1.1 → 1.2 → 1.3** เกาะกัน: meta fields ต้องมี login จึงเติม createdBy ได้ และ audit ต้องรู้ว่าใครทำ
2. **1.4 และ 1.5** ทำขนานกันได้ (คนละโดเมน) หลัง 1.1 เสร็จ
3. **2.1** ต้องมี 1.2 (รู้ว่าใครสั่งส่ง) + แนะนำให้มี 1.1 (uuid เก็บร่องรอยรายผู้รับ)
4. **2.2–2.5** อิสระต่อกัน เลือกตามความเร่งด่วนของภารกิจ
5. **P3** รอเปิดบริบท — แต่ 1.1 ทำให้ต้นทุน P3 ที่เกี่ยวกับ sync ถูกลง

**รวม P1+P2 ≈ 37–49 PD** (~2 เดือนด้วย dev 1 คนเต็มเวลา หรือ 3–4 สัปดาห์ด้วย 2 คน)

### สิ่งที่**ไม่แนะนำ**ให้ทำตามต้นฉบับ

- Super-entity polymorphic แบบ Eden — ใน Prisma/TypeScript มีต้นทุนความซับซ้อนสูง คุ้มเฉพาะเมื่อ entity types โตหลายเท่า (แนะนำ "site entity เบา ๆ": ตาราง `Site` เดียวที่ Shelter/Warehouse/Office อ้างถึง หากจะรวม)
- 21 ชนิด map layer — เหลือ KML/GeoJSON/XYZ tiles พอ
- 11 message channels — เหลือ email + Line Notify + webhook ครอบคลุมบริบทไทยแล้ว
- Setup wizard/cloud provisioning — ไม่เกี่ยวกับภารกิจ

---

## 9. Scorecard สรุป (1–5)

### 9.1 ต่อ Entity หลัก 9 โดเมน (เชื่อมกับ §6.3–6.4 และ Gap G1–G10)

| Entity หลัก | eden-core | DMS ปัจจุบัน | หลัง P1 | หลัง P1+P2 | ช่องว่างหลัก |
|---|---|---|---|---|---|
| Person | 5 | 2.5 | 4 | 4.5 | trail พบตัว/หลายช่องทาง/ครอบครัว (G3) |
| Organization | 4.5 | 2.5 | 2.5 | 4 | catalog M2M + ผูก shelter (G9) |
| HumanResource | 4.5 | 2 | 2.5 | 2.5 | ไม่ผูก person/catalog (R4 — งาน P3) |
| Shelter | 4 (Eden เต็ม) | 3 | 4.5 | 4.5 | ledger เข้า-ออก (G4) |
| Inventory | 4 (Eden เต็ม) | 3 | 4.5 | 4.5 | ledger สต๊อก (G4) |
| Incident/SITREP | 3.5 | 4 | 4 | 4.5 | polygon + แนบไฟล์ (G6–G7) |
| Alert/Messaging | 5 | 2 | 2 | 4.5 | pipeline ส่งจริง (G5) |
| Location/GIS | 5 | 3 | 3 | 4.5 | polygon/geocode (G7) |
| Auth/Accountability | 5 | 1.5 | 4 | 4.5 | login/audit/ownership (G1–G2) |

> หมายเหตุ: Shelter/Inventory ให้คะแนน eden-core เทียบ Eden เต็ม (ใน eden-core ไม่มีโมดูลนี้เลย) — งาน 1.5 ทำให้ Shelter+Inventory ของ DMS ไปไกลกว่า eden-core ต้นฉบับ และ Alert จะก้าวข้ามต้นฉบับเมื่อทำ 2.1 เพราะเลือกช่องทางที่ใช้จริงในไทย (email/Line) แทน 11 ช่องทางที่ดูแลไม่ไหว

### 9.2 ต่อมิติระบบ 6 มิติ (พร้อม projection)

| มิติ | eden-core | DMS ปัจจุบัน | หลัง P1 | หลัง P1+P2 | หมายเหตุ |
|---|---|---|---|---|---|
| ความครบถ้วน workflow DMS หลัก | 5 | 4 | 4.5 | 4.5 | messaging จริง/ไฟล์แนบมาที่ P2 |
| ความลึกของข้อมูล (granularity) | 5 | 2.5 | 4 | 4.5 | 299 vs 15 ตาราง; meta 13 vs 2; R1–R14 |
| ความง่ายในการใช้งาน (ผู้ใช้ไทย) | 2.5 | 5 | 5 | 5 | ภาษาไทยแท้ + UX สมัยใหม่ |
| ความน่าเชื่อถือเชิงระบบ (audit/auth/integrity) | 5 | 2 | 4 | 4.5 | P1 ครบ → 4; ledger+export → 4.5 |
| ความสามารถขยาย/บูรณาการ | 4.5 | 2.5 | 3 | 4 | export (P2) / sync-ODK-i18n (P3) |
| การบำรุงรักษา/พัฒนาต่อ | 1.5 (web2py legacy) | 5 | 5 | 5 | TypeScript + Prisma + stack มาตรฐาน |
| **เฉลี่ยรวม 6 มิติ** | **3.92** | **3.50** | **4.25** | **4.58** | |

**อ่านตัวเลขอย่างเป็นระบบ:** DMS ปัจจุบัน (3.50) ยังตามหลัง Eden เฉลี่ย (3.92) — แพ้เรื่องความลึกข้อมูล/ความน่าเชื่อถือ แต่ชนะ UX/การบำรุงรักษา → **ลงทุน P1 ~17.5–22 PD พอทำให้เกิน (4.25)** และทำ P2 ต่ออีก ~19–27 PD จะได้ 4.58 ซึ่งชนะ Eden ทุกมิติ ยกเว้น "ขยาย/บูรณาการ" ที่ยังตามหลังเล็กน้อย (รอ P3)

---

## ภาคผนวก — วิธีการตรวจสอบ

- แตกไฟล์ต้นฉบับเต็ม `eden-core-master.zip` (8,022 ไฟล์) → สำรวจ controllers (17 ไฟล์/373 functions), modules/s3 (46 ไฟล์/111,195 LOC), modules/s3db (13 ไฟล์/299 ตาราง/52,674 LOC), models (infrastructure), views (173), languages (48 ไฟล์/ไทย 6,603 บรรทัด), cron/templates
- สกัด field จาก `define_table(...)` จริงใน s3db + pattern super_link/add_components/s3_meta_fields
- เทียบกับ `prisma/schema.prisma` (15 models) + API routes (17 กลุ่ม) + โมดูล UI 13 โมดูล ของ repo นี้
- แผนที่ความสัมพันธ์ (§6.4): ตรวจจาก field จริง — `person_id/organisation_id` ใน s3db/hrm.py, `super_link("site_id", "org_site")` 4 จุดใน hrm.py, `pe_id/organisation_id/site_id` ของ auth_user ใน modules/s3/s3aaa.py, `super_link("pe_id", "pr_pentity")` ใน s3db/msg.py, `series_id/gis_location_id/priority` ใน s3db/cms.py, `trackable_table/trackable_id/direction/speed/accuracy` ใน s3db/sit.py, และ relation ทั้งหมดใน `prisma/schema.prisma` (11 เส้น FK)
- ประมาณการ PD คิดจาก: จำนวน route ที่ต้อง retrofit (17 กลุ่ม), จำนวน model ใหม่ต่องาน, และขนาด UI ของโมดูลที่เกี่ยวข้องตามที่วัดจากงานที่ผ่านมาใน worklog
- ข้อจำกัด: eden-core ที่ได้มา**ไม่รวมโมดูล inv/req/asset/event** (ถูกปิดใน template ของ eden-core — อยู่ใน Eden เต็ม) การเทียบส่วนนั้นอ้างอิง domain model ที่ทราบจาก controller references (เช่น `sit_situation.instance_type` ระบุ rms_req) และเอกสารชุมชน Eden
