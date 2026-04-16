import type { ArtworkVariant } from "@/lib/pack-art-types";

const SIGNAL = "#122033";
const LINE = "rgba(18, 32, 51, 0.16)";
const PANEL = "rgba(255,255,255,0.76)";
const PANEL_SOFT = "rgba(255,255,255,0.58)";

export function PackArtwork({
  variant,
  compact = false,
}: {
  variant: ArtworkVariant;
  compact?: boolean;
}) {
  const width = compact ? 320 : 640;
  const height = compact ? 180 : 320;
  const scale = compact ? 0.5 : 1;

  return (
    <div className={`pack-art-shell ${compact ? "pack-art-shell-compact" : ""}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="pack-art-svg" role="img" aria-hidden="true">
        <defs>
          <linearGradient id={`bg-${variant}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.92)" />
            <stop offset="52%" stopColor="rgba(255,248,240,0.72)" />
            <stop offset="100%" stopColor="rgba(229,244,241,0.7)" />
          </linearGradient>
          <linearGradient id={`card-${variant}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.62)" />
          </linearGradient>
          <linearGradient id={`accent-${variant}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(23,37,84,0.82)" />
            <stop offset="100%" stopColor="rgba(13,148,136,0.72)" />
          </linearGradient>
          <linearGradient id={`soft-accent-${variant}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(14,165,233,0.16)" />
            <stop offset="100%" stopColor="rgba(245,158,11,0.14)" />
          </linearGradient>
          <filter id={`blur-${variant}`}>
            <feGaussianBlur stdDeviation={compact ? 18 : 26} />
          </filter>
          <pattern id={`grid-${variant}`} width={compact ? 20 : 28} height={compact ? 20 : 28} patternUnits="userSpaceOnUse">
            <path d={`M ${compact ? 20 : 28} 0 L 0 0 0 ${compact ? 20 : 28}`} fill="none" stroke="rgba(18,32,51,0.05)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width={width} height={height} rx={compact ? 24 : 36} fill={`url(#bg-${variant})`} />
        <rect width={width} height={height} rx={compact ? 24 : 36} fill={`url(#grid-${variant})`} />

        <circle
          cx={compact ? 72 : 154}
          cy={compact ? 52 : 88}
          r={compact ? 44 : 92}
          fill="rgba(255, 206, 150, 0.42)"
          filter={`url(#blur-${variant})`}
        />
        <circle
          cx={compact ? 254 : 510}
          cy={compact ? 136 : 250}
          r={compact ? 58 : 116}
          fill="rgba(129, 230, 217, 0.2)"
          filter={`url(#blur-${variant})`}
        />

        <rect
          x={compact ? 14 : 24}
          y={compact ? 14 : 24}
          width={width - (compact ? 28 : 48)}
          height={height - (compact ? 28 : 48)}
          rx={compact ? 20 : 30}
          fill="rgba(255,255,255,0.42)"
          stroke="rgba(255,255,255,0.58)"
        />

        <g transform={`scale(${scale})`}>
          {variant === "directory" ? <DirectoryArtwork /> : null}
          {variant === "operator-chat-rail" ? <GroundedOperatorRailArtwork /> : null}
          {variant === "planning-and-worker-flow" ? <PlannerWorkersSynthesizerArtwork /> : null}
          {variant === "answer-review-and-quality-checks" ? <AnswerPacketsArtwork /> : null}
          {variant === "workflow-elicitation" ? <ElicitationArtwork /> : null}
          {variant === "hybrid-runtime" ? <HybridArtwork /> : null}
          {variant === "durable-streaming" ? <StreamingArtwork /> : null}
        </g>
      </svg>
    </div>
  );
}

function Frame({ x, y, width, height, radius }: { x: number; y: number; width: number; height: number; radius: number }) {
  return <rect x={x} y={y} width={width} height={height} rx={radius} fill={PANEL} stroke={LINE} />;
}

function SoftFrame({ x, y, width, height, radius }: { x: number; y: number; width: number; height: number; radius: number }) {
  return <rect x={x} y={y} width={width} height={height} rx={radius} fill={PANEL_SOFT} stroke={LINE} />;
}

function Bar({ x, y, width, opacity = 0.12 }: { x: number; y: number; width: number; opacity?: number }) {
  return <rect x={x} y={y} width={width} height={12} rx={6} fill={`rgba(18,32,51,${opacity})`} />;
}

function Node({ cx, cy, radius = 10, fill = SIGNAL }: { cx: number; cy: number; radius?: number; fill?: string }) {
  return <circle cx={cx} cy={cy} r={radius} fill={fill} />;
}

function DirectoryArtwork() {
  return (
    <>
      <Frame x={54} y={58} width={194} height={122} radius={30} />
      <SoftFrame x={272} y={94} width={140} height={96} radius={26} />
      <Frame x={430} y={48} width={154} height={170} radius={34} />
      <Bar x={82} y={88} width={118} />
      <Bar x={82} y={114} width={146} opacity={0.09} />
      <Bar x={82} y={140} width={96} opacity={0.08} />
      <Bar x={298} y={122} width={82} />
      <Bar x={298} y={148} width={102} opacity={0.09} />
      <Bar x={456} y={82} width={94} />
      <Bar x={456} y={110} width={72} opacity={0.09} />
      <Bar x={456} y={138} width={108} opacity={0.08} />
      <path
        d="M118 216C170 180 208 176 262 182C318 188 352 222 406 222C464 222 494 184 548 160"
        fill="none"
        stroke="url(#accent-directory)"
        strokeWidth={11}
        strokeLinecap="round"
      />
      <Node cx={118} cy={216} radius={11} />
      <Node cx={262} cy={182} radius={11} />
      <Node cx={406} cy={222} radius={11} />
      <Node cx={548} cy={160} radius={11} />
    </>
  );
}

function GroundedOperatorRailArtwork() {
  return (
    <>
      <Frame x={42} y={52} width={248} height={126} radius={30} />
      <Frame x={308} y={34} width={126} height={226} radius={34} />
      <SoftFrame x={452} y={84} width={150} height={154} radius={30} />
      <Bar x={70} y={82} width={146} />
      <Bar x={70} y={110} width={170} opacity={0.09} />
      <Bar x={70} y={138} width={114} opacity={0.08} />
      <Bar x={334} y={66} width={68} />
      <rect x={334} y={100} width={72} height={54} rx={18} fill="rgba(255,255,255,0.84)" stroke={LINE} />
      <rect x={334} y={166} width={72} height={54} rx={18} fill="rgba(255,255,255,0.84)" stroke={LINE} />
      <Bar x={478} y={110} width={96} />
      <Bar x={478} y={138} width={74} opacity={0.09} />
      <Bar x={478} y={166} width={110} opacity={0.08} />
      <path d="M290 102H308" stroke={SIGNAL} strokeWidth={6} strokeLinecap="round" />
      <path d="M434 134H452" stroke={SIGNAL} strokeWidth={6} strokeLinecap="round" />
      <Node cx={300} cy={102} radius={11} />
      <Node cx={444} cy={134} radius={11} />
    </>
  );
}

function PlannerWorkersSynthesizerArtwork() {
  return (
    <>
      <Frame x={254} y={34} width={132} height={64} radius={24} />
      <SoftFrame x={90} y={144} width={132} height={82} radius={26} />
      <SoftFrame x={254} y={144} width={132} height={82} radius={26} />
      <SoftFrame x={418} y={144} width={132} height={82} radius={26} />
      <Frame x={232} y={248} width={176} height={52} radius={22} />
      <path d="M320 98V126" stroke={SIGNAL} strokeWidth={6} strokeLinecap="round" />
      <path d="M320 126L156 144" stroke={SIGNAL} strokeWidth={4} strokeLinecap="round" />
      <path d="M320 126L320 144" stroke={SIGNAL} strokeWidth={4} strokeLinecap="round" />
      <path d="M320 126L484 144" stroke={SIGNAL} strokeWidth={4} strokeLinecap="round" />
      <path d="M156 226L320 248" stroke={SIGNAL} strokeWidth={4} strokeLinecap="round" />
      <path d="M320 226L320 248" stroke={SIGNAL} strokeWidth={4} strokeLinecap="round" />
      <path d="M484 226L320 248" stroke={SIGNAL} strokeWidth={4} strokeLinecap="round" />
      <Node cx={320} cy={126} radius={11} />
      <Node cx={156} cy={226} radius={11} />
      <Node cx={320} cy={226} radius={11} />
      <Node cx={484} cy={226} radius={11} />
      <Bar x={276} y={56} width={88} />
      <Bar x={112} y={172} width={88} opacity={0.09} />
      <Bar x={276} y={172} width={88} opacity={0.09} />
      <Bar x={440} y={172} width={88} opacity={0.09} />
      <Bar x={258} y={268} width={124} opacity={0.1} />
    </>
  );
}

function AnswerPacketsArtwork() {
  return (
    <>
      <Frame x={72} y={52} width={188} height={216} radius={32} />
      <SoftFrame x={288} y={78} width={132} height={84} radius={24} />
      <SoftFrame x={442} y={78} width={132} height={84} radius={24} />
      <Frame x={288} y={182} width={286} height={88} radius={28} />
      <Bar x={112} y={100} width={112} />
      <Bar x={112} y={130} width={122} opacity={0.09} />
      <Bar x={112} y={158} width={96} opacity={0.08} />
      <path d="M328 120L348 140L378 106" fill="none" stroke={SIGNAL} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M488 116H534" stroke={SIGNAL} strokeWidth={8} strokeLinecap="round" />
      <path d="M488 140H518" stroke={SIGNAL} strokeWidth={8} strokeLinecap="round" />
      <Bar x={324} y={216} width={214} />
      <Bar x={324} y={244} width={166} opacity={0.09} />
    </>
  );
}

function ElicitationArtwork() {
  return (
    <>
      <Frame x={70} y={78} width={190} height={172} radius={32} />
      <SoftFrame x={232} y={42} width={178} height={122} radius={28} />
      <Frame x={394} y={122} width={186} height={132} radius={30} />
      <path d="M260 164L394 164" stroke={SIGNAL} strokeWidth={5} strokeLinecap="round" />
      <Node cx={260} cy={164} radius={11} />
      <Node cx={394} cy={164} radius={11} />
      <Bar x={110} y={114} width={104} />
      <Bar x={110} y={142} width={88} opacity={0.09} />
      <Bar x={262} y={80} width={84} />
      <Bar x={262} y={110} width={102} opacity={0.09} />
      <Bar x={426} y={156} width={108} />
      <Bar x={426} y={186} width={82} opacity={0.09} />
    </>
  );
}

function HybridArtwork() {
  return (
    <>
      <Frame x={74} y={62} width={212} height={188} radius={32} />
      <Frame x={354} y={62} width={212} height={188} radius={32} />
      <path d="M320 48V262" stroke={SIGNAL} strokeWidth={8} strokeLinecap="round" strokeDasharray="12 14" opacity={0.9} />
      <Bar x={112} y={108} width={108} />
      <Bar x={112} y={140} width={122} opacity={0.09} />
      <Bar x={112} y={170} width={92} opacity={0.08} />
      <circle cx={170} cy={214} r={28} fill={SIGNAL} />
      <path
        d="M396 118C438 84 508 84 544 118C582 154 578 210 520 222C462 234 408 198 396 118Z"
        fill="rgba(255,255,255,0.74)"
        stroke={LINE}
      />
      <path d="M432 150H520" stroke={SIGNAL} strokeWidth={8} strokeLinecap="round" />
      <path d="M432 178H490" stroke={SIGNAL} strokeWidth={8} strokeLinecap="round" />
    </>
  );
}

function StreamingArtwork() {
  return (
    <>
      <Frame x={52} y={64} width={536} height={182} radius={36} />
      <path
        d="M96 184C122 184 128 118 154 118C182 118 184 214 212 214C240 214 242 96 270 96C298 96 300 194 328 194C356 194 360 136 388 136C416 136 418 170 446 170C474 170 476 108 504 108C532 108 534 156 560 156"
        fill="none"
        stroke="url(#accent-durable-streaming)"
        strokeWidth={12}
        strokeLinecap="round"
      />
      {[154, 212, 270, 328, 388, 446, 504, 560].map((x, index) => (
        <Node
          key={`${x}-${index}`}
          cx={x}
          cy={[118, 214, 96, 194, 136, 170, 108, 156][index]}
          radius={13}
        />
      ))}
      <Bar x={110} y={90} width={98} opacity={0.1} />
      <Bar x={448} y={198} width={94} opacity={0.08} />
    </>
  );
}
