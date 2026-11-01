export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const iconSize = size === "lg" ? 32 : size === "md" ? 26 : 20;
  const textCls =
    size === "lg"
      ? "text-2xl tracking-tight"
      : size === "md"
      ? "text-lg tracking-tight"
      : "text-sm tracking-tight";

  return (
    <div className={`flex items-center gap-2 font-semibold ${textCls} select-none`}>
      <svg
        width={iconSize}
        height={Math.round(iconSize * 0.85)}
        viewBox="0 0 32 27"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 23 L2 14 Q16 2 30 14 L30 23"
          stroke="#173F6B"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <line x1="2" y1="23" x2="30" y2="23" stroke="#173F6B" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="9" y1="23" x2="9" y2="15" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="23" x2="16" y2="10" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
        <line x1="23" y1="23" x2="23" y2="15" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>
        <span style={{ color: "#173F6B" }}>FundBridge</span>
        <span style={{ color: "#2563EB" }}> AI</span>
      </span>
    </div>
  );
}
