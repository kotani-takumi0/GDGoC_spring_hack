"use client";

import { useEffect, useRef, useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// =============================================================================
// 型定義
// =============================================================================

interface HighlightRange {
  readonly nodeId: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly color: string;
  readonly label?: string;
}

interface CodePanelProps {
  readonly code: string;
  readonly language: string;
  readonly highlightRanges: readonly HighlightRange[];
  readonly activeRange?: HighlightRange;
}

// =============================================================================
// ヘルパー
// =============================================================================

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface LineStyle {
  readonly bg: string;
  readonly borderColor: string;
  readonly isActive: boolean;
  readonly label?: string;
  readonly labelColor?: string;
}

function buildLineStyleMap(
  highlightRanges: readonly HighlightRange[],
  activeRange?: HighlightRange
): Map<number, LineStyle> {
  const map = new Map<number, LineStyle>();

  for (const range of highlightRanges) {
    for (let line = range.startLine; line <= range.endLine; line++) {
      map.set(line, {
        bg: hexToRgba(range.color, 0.08),
        borderColor: hexToRgba(range.color, 0.4),
        isActive: false,
        label: line === range.startLine ? range.label : undefined,
        labelColor: range.color,
      });
    }
  }

  if (activeRange) {
    for (let line = activeRange.startLine; line <= activeRange.endLine; line++) {
      map.set(line, {
        bg: hexToRgba(activeRange.color, 0.25),
        borderColor: activeRange.color,
        isActive: true,
        label: line === activeRange.startLine ? activeRange.label : undefined,
        labelColor: activeRange.color,
      });
    }
  }

  return map;
}

// =============================================================================
// 拡張子 → SyntaxHighlighter言語名
// =============================================================================

function resolveLanguage(lang: string): string {
  switch (lang) {
    case "markup":
    case "html":
      return "markup";
    case "css":
      return "css";
    case "javascript":
    case "js":
      return "javascript";
    default:
      return "typescript";
  }
}

// =============================================================================
// Plain行レンダラー（wrapLinesが効かない言語用）
// =============================================================================

function PlainCodeView({
  code,
  lineStyleMap,
  containerRef,
}: {
  readonly code: string;
  readonly lineStyleMap: Map<number, LineStyle>;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const lines = code.split("\n");

  return (
    <pre
      style={{
        margin: 0,
        padding: "1rem",
        fontSize: "0.85rem",
        lineHeight: "1.6",
        background: "transparent",
        fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
        overflowX: "auto",
      }}
    >
      {lines.map((line, i) => {
        const lineNum = i + 1;
        const info = lineStyleMap.get(lineNum);
        return (
          <div
            key={lineNum}
            data-line-number={lineNum}
            style={{
              display: "flex",
              backgroundColor: info?.bg ?? "transparent",
              borderLeft: info
                ? `3px solid ${info.borderColor}`
                : "3px solid transparent",
              position: "relative",
              transition: "all 0.2s ease",
            }}
          >
            <span
              style={{
                display: "inline-block",
                minWidth: "2.5em",
                paddingRight: "1em",
                textAlign: "right",
                color: "#555",
                userSelect: "none",
                flexShrink: 0,
              }}
            >
              {lineNum}
            </span>
            <code style={{ color: "#abb2bf", flex: 1 }}>
              {line || " "}
            </code>
            {info?.label && info.labelColor && (
              <span
                className="concept-label-badge"
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 9999,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  backgroundColor: info.isActive
                    ? info.labelColor
                    : hexToRgba(info.labelColor, 0.15),
                  color: info.isActive ? "#fff" : info.labelColor,
                  boxShadow: info.isActive
                    ? `0 0 8px ${hexToRgba(info.labelColor, 0.4)}`
                    : "none",
                }}
              >
                {info.label}
              </span>
            )}
          </div>
        );
      })}
    </pre>
  );
}

// =============================================================================
// メインコンポーネント
// =============================================================================

export default function CodePanel({
  code,
  language,
  highlightRanges,
  activeRange,
}: CodePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resolvedLang = resolveLanguage(language);
  // markup/html/css はwrapLinesが壊れるのでPlainCodeViewを使う
  const usePlainView = resolvedLang === "markup" || resolvedLang === "css";

  const lineStyleMap = useMemo(
    () => buildLineStyleMap(highlightRanges, activeRange),
    [highlightRanges, activeRange]
  );

  const lineProps = useMemo(() => {
    return (lineNumber: number) => {
      const info = lineStyleMap.get(lineNumber);
      return {
        style: {
          backgroundColor: info?.bg ?? "transparent",
          display: "block",
          borderLeft: info
            ? `3px solid ${info.borderColor}`
            : "3px solid transparent",
          transition: "all 0.2s ease",
          position: "relative" as const,
        },
        "data-line-number": String(lineNumber),
      } as React.HTMLProps<HTMLElement>;
    };
  }, [lineStyleMap]);

  // activeRange変更時にスクロール
  useEffect(() => {
    if (!activeRange || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-line-number="${activeRange.startLine}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeRange]);

  // TS/JSの場合: SyntaxHighlighterのDOMにラベルを注入
  useEffect(() => {
    if (usePlainView || !containerRef.current) return;

    containerRef.current
      .querySelectorAll(".concept-label-badge")
      .forEach((el) => el.remove());

    for (const [lineNum, info] of lineStyleMap) {
      if (!info.label || !info.labelColor) continue;

      const lineEl = containerRef.current.querySelector(
        `[data-line-number="${lineNum}"]`
      ) as HTMLElement | null;
      if (!lineEl) continue;

      lineEl.style.position = "relative";

      const badge = document.createElement("span");
      badge.className = "concept-label-badge";
      badge.textContent = info.label;
      badge.style.cssText = [
        "position: absolute",
        "right: 12px",
        "top: 50%",
        "transform: translateY(-50%)",
        "font-size: 10px",
        "font-weight: 700",
        "padding: 2px 8px",
        "border-radius: 9999px",
        "white-space: nowrap",
        "pointer-events: none",
        "z-index: 5",
        `background-color: ${info.isActive ? info.labelColor : hexToRgba(info.labelColor, 0.15)}`,
        `color: ${info.isActive ? "#fff" : info.labelColor}`,
        info.isActive ? `box-shadow: 0 0 8px ${hexToRgba(info.labelColor, 0.4)}` : "",
      ].join("; ");

      lineEl.appendChild(badge);
    }

    return () => {
      containerRef.current
        ?.querySelectorAll(".concept-label-badge")
        .forEach((el) => el.remove());
    };
  }, [lineStyleMap, usePlainView]);

  return (
    <div ref={containerRef} className="h-full overflow-auto relative bg-[#282c34]">
      {usePlainView ? (
        <PlainCodeView
          code={code}
          lineStyleMap={lineStyleMap}
          containerRef={containerRef}
        />
      ) : (
        <SyntaxHighlighter
          language={resolvedLang}
          style={oneDark}
          showLineNumbers
          wrapLines
          lineProps={lineProps}
          customStyle={{
            margin: 0,
            padding: "1rem",
            fontSize: "0.85rem",
            lineHeight: "1.6",
            background: "transparent",
            minHeight: "100%",
          }}
          lineNumberStyle={{
            minWidth: "2.5em",
            paddingRight: "1em",
            color: "#555",
            userSelect: "none",
          }}
        >
          {code}
        </SyntaxHighlighter>
      )}
    </div>
  );
}

export type { HighlightRange, CodePanelProps };
