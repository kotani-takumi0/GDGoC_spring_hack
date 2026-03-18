import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-[#0A0A0B]/90 backdrop-blur-md border-b border-white/10 shadow-sm relative z-50">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-indigo-500 group-hover:from-emerald-300 group-hover:to-indigo-400 transition-all">リアサポ</span>
        </Link>
      </div>
    </header>
  );
}
