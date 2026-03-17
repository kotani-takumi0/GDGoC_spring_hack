"use client";

import { useMemo, useState, useRef } from "react";
import { RefreshCw, Maximize2, Minimize2 } from "lucide-react";

interface StoredFile {
  filename: string;
  code: string;
}

interface PreviewSandboxProps {
  files: readonly StoredFile[];
}

function escapeScriptClose(code: string): string {
  // </script> をHTMLパーサーに壊されないようエスケープ
  return code.replace(/<\/script>/gi, "<\\/script>");
}

function buildSrcdoc(files: readonly StoredFile[]): string {
  const htmlFile = files.find((f) => f.filename.endsWith(".html"));
  const cssFiles = files.filter((f) => f.filename.endsWith(".css"));
  const tsFiles = files.filter((f) => /\.[jt]sx?$/.test(f.filename));

  let html = htmlFile?.code ?? [
    "<!DOCTYPE html>",
    '<html lang="ja">',
    "<head><meta charset=\"UTF-8\"><title>Preview</title></head>",
    '<body style="font-family:sans-serif;padding:20px;background:#f8fafc;">',
    '<div id="app"></div>',
    "</body>",
    "</html>",
  ].join("\n");

  // 外部script参照を除去（src="*.ts" 等）
  html = html.replace(/<script\s+[^>]*src\s*=\s*["'][^"']*["'][^>]*>\s*<\/script>/gi, "");

  // CSS注入
  const cssBlock = cssFiles
    .map((f) => "<style>\n/* " + f.filename + " */\n" + f.code + "\n</style>")
    .join("\n");

  // TSコードを結合（import/export/require除去）
  const allCode = tsFiles
    .map((f) => {
      const cleaned = f.code
        .replace(/^\s*import\s+.*?from\s+['"].*?['"];?\s*$/gm, "")
        .replace(/^\s*import\s+type\s+.*$/gm, "")
        .replace(/^\s*export\s+(default\s+)?/gm, "")
        .replace(/\brequire\s*\(\s*['"].*?['"]\s*\)/g, "undefined")
        .replace(/\bmodule\.exports\b/g, "");
      return "// ===== " + f.filename + " =====\n" + cleaned;
    })
    .join("\n\n");

  // TSコードをBase64エンコードしてiframe内でデコード→Babelトランスパイル→eval
  // これにより </script> 問題を完全回避
  const codeBase64 = typeof btoa !== "undefined"
    ? btoa(unescape(encodeURIComponent(allCode)))
    : Buffer.from(allCode, "utf-8").toString("base64");

  const injection = [
    cssBlock,
    '<script src="https://unpkg.com/@babel/standalone@7.26.10/babel.min.js"></script>',
    "<script>",
    "(function(){",
    "  var co=document.getElementById('console-output');",
    "  if(!co){co=document.createElement('div');co.id='console-output';",
    "  co.style.cssText='font-family:monospace;font-size:12px;padding:8px;white-space:pre-wrap;color:#334155;max-height:180px;overflow:auto;border-top:1px solid #e2e8f0;margin-top:12px;background:#f8fafc;';",
    "  document.body.appendChild(co);}",
    "  var oL=console.log,oE=console.error;",
    "  function ap(c,a){var d=document.createElement('div');d.style.color=c;",
    "  d.textContent=[].map.call(a,function(x){return typeof x==='object'?JSON.stringify(x,null,2):String(x)}).join(' ');",
    "  co.appendChild(d);co.scrollTop=co.scrollHeight;}",
    "  console.log=function(){oL.apply(console,arguments);ap('#334155',arguments)};",
    "  console.error=function(){oE.apply(console,arguments);ap('#dc2626',arguments)};",
    "  window.onerror=function(m,s,l){ap('#dc2626',['Error: '+m]);return true;};",
    "})();",
    "",
    "// Base64デコード → Babelトランスパイル → eval",
    "try {",
    "  var tsCode = decodeURIComponent(escape(atob('" + codeBase64 + "')));",
    "  var jsCode = Babel.transform(tsCode, { filename: 'app.ts', presets: ['typescript'] }).code;",
    "  eval(jsCode);",
    "} catch(e) {",
    "  console.error(e.message || e);",
    "}",
    "</script>",
  ].join("\n");

  if (html.includes("</body>")) {
    return html.replace("</body>", injection + "\n</body>");
  }
  return html + "\n" + injection;
}

export default function PreviewSandbox({ files }: PreviewSandboxProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcDoc = useMemo(() => buildSrcdoc(files), [files]);

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p className="text-xs">プレビューするファイルがありません</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? "fixed inset-0 z-50 bg-white" : "w-full"}`}>
      <div className="bg-[#1E1E1E] border-b border-black/20 flex items-center justify-between px-3 py-1.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs text-slate-400 font-mono ml-2 font-medium tracking-wide">
            Execution Preview
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setKey((k) => k + 1)}
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="リロード"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen((e) => !e)}
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? "元に戻す" : "全画面表示"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <div className="flex-1 bg-white relative overflow-hidden">
        <iframe
          key={key}
          ref={iframeRef}
          srcDoc={srcDoc}
          title="preview"
          sandbox="allow-scripts allow-same-origin"
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
    </div>
  );
}
