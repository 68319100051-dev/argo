import Link from "next/link";
import { Boxes, Lock } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_8px_40px_rgba(15,23,42,0.08)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
          <Boxes className="h-6 w-6 text-white" />
        </div>
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
          <Lock className="h-5 w-5 text-slate-500" />
        </div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">
          การสมัครสมาชิกถูกปิดใช้งาน
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          ระบบนี้ใช้งานเฉพาะสมาชิกของบริษัท
          <br />
          หากต้องการบัญชีผู้ใช้ กรุณาติดต่อผู้ดูแลระบบเพื่อขอสร้างบัญชี
        </p>
        <Link
          href="/auth/login"
          className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-gradient-to-b from-indigo-600 to-indigo-700 px-4 text-sm font-semibold text-white shadow-sm shadow-indigo-600/25 transition-all hover:from-indigo-500 hover:to-indigo-600"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
}
