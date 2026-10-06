// EDEN DMS — ค่าคงที่และป้ายกำกับภาษาไทยสำหรับทุกโมดูล
// ทุกโมดูลใช้ label/color map จากไฟล์นี้เพื่อความสม่ำเสมอ

export interface Option {
  value: string
  label: string
  badge?: string // tailwind classes สำหรับ badge
}

export const INCIDENT_TYPES: Option[] = [
  { value: 'flood', label: 'น้ำท่วม' },
  { value: 'earthquake', label: 'แผ่นดินไหว' },
  { value: 'fire', label: 'ไฟป่า/อัคคีภัย' },
  { value: 'landslide', label: 'ดินโคลนถล่ม' },
  { value: 'storm', label: 'พายุ' },
  { value: 'drought', label: 'ภัยแล้ง' },
  { value: 'epidemic', label: 'โรคระบาด' },
  { value: 'other', label: 'อื่น ๆ' },
]

export const SEVERITIES: Option[] = [
  { value: 'low', label: 'ต่ำ', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'medium', label: 'ปานกลาง', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'high', label: 'สูง', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'critical', label: 'วิกฤต', badge: 'bg-red-100 text-red-800 border-red-200' },
]

export const INCIDENT_STATUS: Option[] = [
  { value: 'active', label: 'กำลังดำเนินการ', badge: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'monitoring', label: 'เฝ้าระวัง', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'resolved', label: 'ควบคุมได้', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'closed', label: 'ปิดเหตุการณ์', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
]

export const PERSON_STATUS: Option[] = [
  { value: 'missing', label: 'สูญหาย', badge: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'found', label: 'พบตัวแล้ว', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  { value: 'safe', label: 'ปลอดภัย', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'injured', label: 'บาดเจ็บ', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'deceased', label: 'เสียชีวิต', badge: 'bg-slate-200 text-slate-700 border-slate-300' },
  { value: 'evacuated', label: 'อพยพแล้ว', badge: 'bg-violet-100 text-violet-800 border-violet-200' },
]

export const GENDERS: Option[] = [
  { value: 'male', label: 'ชาย' },
  { value: 'female', label: 'หญิง' },
  { value: 'other', label: 'อื่น ๆ' },
  { value: 'unknown', label: 'ไม่ระบุ' },
]

export const ORG_TYPES: Option[] = [
  { value: 'government', label: 'หน่วยงานราชการ', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  { value: 'ngo', label: 'องค์กรเอกชน/มูลนิธิ', badge: 'bg-violet-100 text-violet-800 border-violet-200' },
  { value: 'international', label: 'องค์กรระหว่างประเทศ', badge: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
  { value: 'private', label: 'ภาคเอกชน', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'community', label: 'ชุมชน', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
]

export const SECTORS: Option[] = [
  { value: 'health', label: 'สาธารณสุข' },
  { value: 'water', label: 'น้ำสะอาด' },
  { value: 'food', label: 'อาหาร' },
  { value: 'education', label: 'การศึกษา' },
  { value: 'logistics', label: 'โลจิสติกส์' },
  { value: 'search_rescue', label: 'ค้นหาและกู้ภัย' },
  { value: 'other', label: 'อื่น ๆ' },
]

export const HR_TYPES: Option[] = [
  { value: 'staff', label: 'เจ้าหน้าที่', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  { value: 'volunteer', label: 'อาสาสมัคร', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'trainee', label: 'ผู้ฝึกอบรม', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
]

export const HR_STATUS: Option[] = [
  { value: 'available', label: 'พร้อมปฏิบัติงาน', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'assigned', label: 'ได้รับมอบหมาย', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'on_mission', label: 'ปฏิบัติภารกิจ', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'unavailable', label: 'ไม่พร้อม', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
]

export const SHELTER_TYPES: Option[] = [
  { value: 'school', label: 'โรงเรียน' },
  { value: 'temple', label: 'วัด' },
  { value: 'community_center', label: 'ศูนย์ชุมชน' },
  { value: 'stadium', label: 'สนามกีฬา' },
  { value: 'tent', label: 'เต็นท์พักพิง' },
  { value: 'hotel', label: 'โรงแรม' },
]

export const SHELTER_STATUS: Option[] = [
  { value: 'open', label: 'เปิดรับ', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'full', label: 'เต็มความจุ', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'preparing', label: 'กำลังเตรียมการ', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'closed', label: 'ปิด', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
]

export const SHELTER_FACILITIES: Option[] = [
  { value: 'water', label: 'น้ำสะอาด' },
  { value: 'electricity', label: 'ไฟฟ้า' },
  { value: 'medical', label: 'การแพทย์' },
  { value: 'food', label: 'อาหาร' },
  { value: 'toilet', label: 'ห้องน้ำ' },
]

export const ITEM_CATEGORIES: Option[] = [
  { value: 'food', label: 'อาหาร', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'water', label: 'น้ำดื่ม', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  { value: 'medical', label: 'เวชภัณฑ์', badge: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'tools', label: 'เครื่องมือ/อุปกรณ์', badge: 'bg-sky-100 text-sky-800 border-sky-200' },
  { value: 'fuel', label: 'เชื้อเพลิง', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'relief', label: 'สิ่งของบรรเทาทุกข์', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'clothing', label: 'เครื่องนุ่งห่ม', badge: 'bg-violet-100 text-violet-800 border-violet-200' },
  { value: 'shelter', label: 'ที่พักพิง', badge: 'bg-lime-100 text-lime-800 border-lime-200' },
  { value: 'hygiene', label: 'สุขอนามัย', badge: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
  { value: 'other', label: 'อื่น ๆ', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
]

export const REQUEST_TYPES: Option[] = [
  { value: 'food', label: 'อาหาร' },
  { value: 'water', label: 'น้ำดื่ม' },
  { value: 'medical', label: 'การแพทย์' },
  { value: 'shelter', label: 'ที่พักพิง' },
  { value: 'evacuation', label: 'อพยพ' },
  { value: 'search_rescue', label: 'ค้นหากู้ภัย' },
  { value: 'other', label: 'อื่น ๆ' },
]

export const REQUEST_PRIORITIES: Option[] = [
  { value: 'low', label: 'ต่ำ', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'medium', label: 'ปานกลาง', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'high', label: 'สูง', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'urgent', label: 'ด่วนที่สุด', badge: 'bg-red-100 text-red-800 border-red-200' },
]

export const REQUEST_STATUS: Option[] = [
  { value: 'pending', label: 'รอพิจารณา', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'approved', label: 'อนุมัติแล้ว', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  { value: 'in_progress', label: 'กำลังดำเนินการ', badge: 'bg-violet-100 text-violet-800 border-violet-200' },
  { value: 'fulfilled', label: 'สำเร็จ', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'rejected', label: 'ปฏิเสธ', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
]

export const ALERT_CHANNELS: Option[] = [
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'อีเมล' },
  { value: 'broadcast', label: 'ประกาศ' },
  { value: 'app', label: 'แอปพลิเคชัน' },
]

export const ALERT_SEVERITIES: Option[] = [
  { value: 'info', label: 'ข้อมูล', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  { value: 'warning', label: 'เตือนภัย', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'critical', label: 'ฉุกเฉิน', badge: 'bg-red-100 text-red-800 border-red-200' },
]

export const ALERT_AUDIENCES: Option[] = [
  { value: 'all', label: 'ทุกคน' },
  { value: 'area', label: 'พื้นที่เสี่ยง' },
  { value: 'volunteers', label: 'อาสาสมัคร' },
  { value: 'officers', label: 'เจ้าหน้าที่' },
]

export const ALERT_STATUS: Option[] = [
  { value: 'draft', label: 'ฉบับร่าง', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'scheduled', label: 'กำหนดส่ง', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'sent', label: 'ส่งแล้ว', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
]

export const USER_ROLES: Option[] = [
  { value: 'admin', label: 'ผู้ดูแลระบบ', badge: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'coordinator', label: 'ผู้ประสานงาน', badge: 'bg-violet-100 text-violet-800 border-violet-200' },
  { value: 'officer', label: 'เจ้าหน้าที่', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  { value: 'volunteer', label: 'อาสาสมัคร', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
]

export const USER_STATUS: Option[] = [
  { value: 'active', label: 'ใช้งาน', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'inactive', label: 'ระงับ', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
]

export const AUDIT_ACTIONS: Option[] = [
  { value: 'create', label: 'สร้าง', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'update', label: 'แก้ไข', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'delete', label: 'ลบ', badge: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'send', label: 'ส่ง', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  { value: 'approve', label: 'อนุมัติ', badge: 'bg-violet-100 text-violet-800 border-violet-200' },
  { value: 'login', label: 'เข้าสู่ระบบ', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
]

// ===== Helper =====
export function optLabel(options: Option[], value: string | null | undefined): string {
  if (!value) return '-'
  return options.find((o) => o.value === value)?.label ?? value
}

export function optBadge(options: Option[], value: string | null | undefined): string {
  if (!value) return 'bg-slate-100 text-slate-600 border-slate-200'
  return options.find((o) => o.value === value)?.badge ?? 'bg-slate-100 text-slate-600 border-slate-200'
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '-'
  const date = new Date(d)
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '-'
  const date = new Date(d)
  return date.toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
}

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0'
  return n.toLocaleString('th-TH')
}
