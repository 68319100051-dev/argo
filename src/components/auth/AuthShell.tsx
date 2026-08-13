import { Boxes } from "lucide-react";

interface AuthShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

const features = [
  { title: "จัดการสต็อกอัจฉริยะ", desc: "ติดตามยอดสินค้าตามล็อต พร้อมระบบเตือนสต็อกต่ำ" },
  { title: "สแกน QR ได้ทันที", desc: "เบิกจ่ายสินค้าด้วยป้าย QR ต่อล็อต รวดเร็วแม่นยำ" },
  { title: "รายงานครบถ้วน", desc: "ดูภาพรวมคลังได้ในหน้าเดียว ใช้ตัดสินใจได้ทันที" },
];

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen bg-[#f6f7f9]">
      {/* Brand panel (desktop) */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-slate-900 p-10 lg:flex xl:p-14">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.12),transparent_50%)]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
            <Boxes className="h-6 w-6 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-bold tracking-widest text-white">ARGO</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
              Inventory System
            </span>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-bold leading-tight text-white xl:text-4xl">
            ระบบบริหารคลังสินค้า
            <br />
            ที่เรียบง่ายสำหรับธุรกิจคุณ
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            บริหารสต็อก รับเข้า-เบิกออก-โอนย้าย พร้อม AI ช่วยวิเคราะห์ให้ทั้งระบบอยู่ในที่เดียว
          </p>

          <ul className="mt-8 space-y-4">
            {features.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-indigo-400 to-violet-500" />
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs leading-relaxed text-slate-500">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-600">© {new Date().getFullYear()} ARGO Inventory</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          {/* Brand (mobile) */}
          <div className="mb-6 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
              <Boxes className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-widest text-slate-900">ARGO</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_40px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="mb-6 text-center lg:text-left">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
