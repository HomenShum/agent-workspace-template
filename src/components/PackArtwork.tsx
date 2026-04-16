export type ArtworkVariant =
  | "directory"
  | "grounded-operator-rail"
  | "planner-workers-synthesizer"
  | "answer-packets-quality-gates"
  | "elicitation-first-operating-system"
  | "deterministic-plus-llm-hybrid"
  | "durable-streaming-events";

export type PackArtworkVariant = Exclude<ArtworkVariant, "directory">;

export function PackArtwork({
  variant,
  compact = false,
}: {
  variant: ArtworkVariant;
  compact?: boolean;
}) {
  const viewBox = compact ? "0 0 320 180" : "0 0 640 320";
  const stroke = "rgba(30, 41, 59, 0.18)";
  const node = "rgba(15, 23, 42, 0.82)";
  const soft = "rgba(255,255,255,0.88)";

  return (
    <div className={`pack-art-shell ${compact ? "pack-art-shell-compact" : ""}`}>
      <svg viewBox={viewBox} className="pack-art-svg" role="img" aria-hidden="true">
        <defs>
          <linearGradient id={`panel-${variant}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.55)" />
          </linearGradient>
          <linearGradient id={`signal-${variant}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(15,23,42,0.15)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.55)" />
          </linearGradient>
        </defs>
        {variant === "directory" ? (
          <>
            <rect x="42" y="52" width="182" height="110" rx="26" fill={soft} stroke={stroke} />
            <rect x="247" y="88" width="156" height="86" rx="24" fill="rgba(255,255,255,0.7)" stroke={stroke} />
            <rect x="430" y="46" width="154" height="126" rx="30" fill="url(#panel-directory)" stroke={stroke} />
            <path
              d="M119 196C170 162 197 156 255 162C313 168 347 208 398 208C452 208 480 170 540 148"
              fill="none"
              stroke="url(#signal-directory)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <circle cx="119" cy="196" r="12" fill={node} />
            <circle cx="255" cy="162" r="12" fill={node} />
            <circle cx="398" cy="208" r="12" fill={node} />
            <circle cx="540" cy="148" r="12" fill={node} />
            <rect x="72" y="80" width="124" height="16" rx="8" fill="rgba(15,23,42,0.1)" />
            <rect x="72" y="108" width="102" height="14" rx="7" fill="rgba(15,23,42,0.08)" />
            <rect x="266" y="112" width="88" height="14" rx="7" fill="rgba(15,23,42,0.1)" />
            <rect x="266" y="138" width="110" height="14" rx="7" fill="rgba(15,23,42,0.08)" />
            <rect x="456" y="76" width="104" height="16" rx="8" fill="rgba(15,23,42,0.1)" />
            <rect x="456" y="106" width="86" height="14" rx="7" fill="rgba(15,23,42,0.08)" />
          </>
        ) : null}
        {variant === "grounded-operator-rail" ? (
          <>
            <rect x="34" y="36" width="248" height="112" rx="28" fill={soft} stroke={stroke} />
            <rect x="304" y="26" width="120" height="220" rx="32" fill="url(#panel-grounded-operator-rail)" stroke={stroke} />
            <rect x="444" y="68" width="156" height="150" rx="30" fill="rgba(255,255,255,0.72)" stroke={stroke} />
            <path d="M282 92H304" stroke={node} strokeWidth="6" strokeLinecap="round" />
            <path d="M424 128H444" stroke={node} strokeWidth="6" strokeLinecap="round" />
            <circle cx="292" cy="92" r="11" fill={node} />
            <circle cx="434" cy="128" r="11" fill={node} />
            <rect x="64" y="64" width="138" height="16" rx="8" fill="rgba(15,23,42,0.1)" />
            <rect x="64" y="94" width="168" height="14" rx="7" fill="rgba(15,23,42,0.08)" />
            <rect x="64" y="120" width="104" height="14" rx="7" fill="rgba(15,23,42,0.08)" />
            <rect x="332" y="58" width="64" height="12" rx="6" fill="rgba(15,23,42,0.1)" />
            <rect x="332" y="90" width="60" height="56" rx="18" fill="rgba(255,255,255,0.86)" stroke={stroke} />
            <rect x="332" y="156" width="62" height="56" rx="18" fill="rgba(255,255,255,0.86)" stroke={stroke} />
            <rect x="474" y="96" width="94" height="14" rx="7" fill="rgba(15,23,42,0.1)" />
            <rect x="474" y="124" width="76" height="14" rx="7" fill="rgba(15,23,42,0.08)" />
            <rect x="474" y="152" width="104" height="14" rx="7" fill="rgba(15,23,42,0.08)" />
          </>
        ) : null}
        {variant === "planner-workers-synthesizer" ? (
          <>
            <rect x="258" y="28" width="124" height="62" rx="22" fill={soft} stroke={stroke} />
            <rect x="86" y="134" width="132" height="74" rx="24" fill="rgba(255,255,255,0.72)" stroke={stroke} />
            <rect x="252" y="134" width="132" height="74" rx="24" fill="rgba(255,255,255,0.72)" stroke={stroke} />
            <rect x="418" y="134" width="132" height="74" rx="24" fill="rgba(255,255,255,0.72)" stroke={stroke} />
            <rect x="236" y="248" width="168" height="46" rx="20" fill="url(#panel-planner-workers-synthesizer)" stroke={stroke} />
            <path d="M320 90V118" stroke={node} strokeWidth="6" strokeLinecap="round" />
            <path d="M320 118L152 134" stroke={node} strokeWidth="4" strokeLinecap="round" />
            <path d="M320 118L318 134" stroke={node} strokeWidth="4" strokeLinecap="round" />
            <path d="M320 118L484 134" stroke={node} strokeWidth="4" strokeLinecap="round" />
            <path d="M152 208L320 248" stroke={node} strokeWidth="4" strokeLinecap="round" />
            <path d="M318 208L320 248" stroke={node} strokeWidth="4" strokeLinecap="round" />
            <path d="M484 208L320 248" stroke={node} strokeWidth="4" strokeLinecap="round" />
            <circle cx="320" cy="118" r="11" fill={node} />
            <circle cx="152" cy="208" r="11" fill={node} />
            <circle cx="318" cy="208" r="11" fill={node} />
            <circle cx="484" cy="208" r="11" fill={node} />
          </>
        ) : null}
        {variant === "answer-packets-quality-gates" ? (
          <>
            <rect x="76" y="46" width="184" height="214" rx="30" fill={soft} stroke={stroke} />
            <rect x="286" y="74" width="130" height="80" rx="24" fill="rgba(255,255,255,0.72)" stroke={stroke} />
            <rect x="440" y="74" width="130" height="80" rx="24" fill="rgba(255,255,255,0.72)" stroke={stroke} />
            <rect x="286" y="178" width="284" height="82" rx="28" fill="url(#panel-answer-packets-quality-gates)" stroke={stroke} />
            <path d="M122 96H214" stroke="rgba(15,23,42,0.12)" strokeWidth="14" strokeLinecap="round" />
            <path d="M122 126H224" stroke="rgba(15,23,42,0.08)" strokeWidth="10" strokeLinecap="round" />
            <path d="M122 154H204" stroke="rgba(15,23,42,0.08)" strokeWidth="10" strokeLinecap="round" />
            <path d="M328 118L348 138L378 106" fill="none" stroke={node} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M486 114H532" stroke={node} strokeWidth="8" strokeLinecap="round" />
            <path d="M486 136H516" stroke={node} strokeWidth="8" strokeLinecap="round" />
            <path d="M326 220H530" stroke="rgba(15,23,42,0.12)" strokeWidth="14" strokeLinecap="round" />
            <path d="M326 248H484" stroke="rgba(15,23,42,0.08)" strokeWidth="10" strokeLinecap="round" />
          </>
        ) : null}
        {variant === "elicitation-first-operating-system" ? (
          <>
            <rect x="64" y="74" width="194" height="172" rx="32" fill={soft} stroke={stroke} />
            <rect x="228" y="42" width="176" height="118" rx="28" fill="rgba(255,255,255,0.74)" stroke={stroke} />
            <rect x="388" y="120" width="188" height="132" rx="30" fill="url(#panel-elicitation-first-operating-system)" stroke={stroke} />
            <path d="M258 162L388 162" stroke={node} strokeWidth="5" strokeLinecap="round" />
            <circle cx="258" cy="162" r="11" fill={node} />
            <circle cx="388" cy="162" r="11" fill={node} />
            <path d="M112 110H210" stroke="rgba(15,23,42,0.1)" strokeWidth="12" strokeLinecap="round" />
            <path d="M112 138H194" stroke="rgba(15,23,42,0.08)" strokeWidth="10" strokeLinecap="round" />
            <path d="M260 78H336" stroke="rgba(15,23,42,0.1)" strokeWidth="12" strokeLinecap="round" />
            <path d="M260 108H352" stroke="rgba(15,23,42,0.08)" strokeWidth="10" strokeLinecap="round" />
            <path d="M424 154H528" stroke="rgba(15,23,42,0.12)" strokeWidth="14" strokeLinecap="round" />
            <path d="M424 184H502" stroke="rgba(15,23,42,0.08)" strokeWidth="10" strokeLinecap="round" />
          </>
        ) : null}
        {variant === "deterministic-plus-llm-hybrid" ? (
          <>
            <rect x="72" y="58" width="214" height="182" rx="32" fill={soft} stroke={stroke} />
            <rect x="350" y="58" width="214" height="182" rx="32" fill="url(#panel-deterministic-plus-llm-hybrid)" stroke={stroke} />
            <path d="M318 48V250" stroke={node} strokeWidth="8" strokeLinecap="round" strokeDasharray="12 14" />
            <path d="M112 104H214" stroke="rgba(15,23,42,0.12)" strokeWidth="14" strokeLinecap="round" />
            <path d="M112 136H228" stroke="rgba(15,23,42,0.08)" strokeWidth="10" strokeLinecap="round" />
            <path d="M112 168H194" stroke="rgba(15,23,42,0.08)" strokeWidth="10" strokeLinecap="round" />
            <circle cx="168" cy="206" r="26" fill="rgba(15,23,42,0.82)" />
            <path d="M392 116C432 82 502 82 540 118C578 154 576 210 518 220C462 230 404 196 392 116Z" fill="rgba(255,255,255,0.7)" stroke={stroke} />
            <path d="M430 146H516" stroke={node} strokeWidth="8" strokeLinecap="round" />
            <path d="M430 174H486" stroke={node} strokeWidth="8" strokeLinecap="round" />
          </>
        ) : null}
        {variant === "durable-streaming-events" ? (
          <>
            <rect x="54" y="58" width="532" height="170" rx="36" fill={soft} stroke={stroke} />
            <path
              d="M98 172C126 172 126 112 154 112C182 112 182 202 210 202C238 202 238 92 266 92C294 92 294 186 322 186C350 186 350 128 378 128C406 128 406 160 434 160C462 160 462 102 490 102C518 102 518 148 546 148"
              fill="none"
              stroke="url(#signal-durable-streaming-events)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {[154, 210, 266, 322, 378, 434, 490, 546].map((x, index) => (
              <circle
                key={`${x}-${index}`}
                cx={x}
                cy={[112, 202, 92, 186, 128, 160, 102, 148][index]}
                r="13"
                fill={node}
              />
            ))}
            <rect x="108" y="84" width="96" height="14" rx="7" fill="rgba(15,23,42,0.08)" />
            <rect x="438" y="188" width="98" height="14" rx="7" fill="rgba(15,23,42,0.08)" />
          </>
        ) : null}
      </svg>
    </div>
  );
}
