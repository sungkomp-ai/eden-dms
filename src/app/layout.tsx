import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EDEN DMS — ระบบจัดการภัยพิบัติ",
  description: "ระบบจัดการภัยพิบัติครบวงจร ดัดแปลงจากสถาปัตยกรรม Sahana Eden (eden-core) — เหตุการณ์ภัยพิบัติ รายงานสถานการณ์ ทะเบียนบุคคล องค์กร อาสาสมัคร ศูนย์พักพิง คลังสินค้า คำขอความช่วยเหลือ แผนที่ GIS และระบบแจ้งเตือน",
  keywords: ["disaster management", "ระบบจัดการภัยพิบัติ", "EDEN DMS", "Sahana Eden", "emergency"],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
