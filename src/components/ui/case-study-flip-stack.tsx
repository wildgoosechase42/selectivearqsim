import React, { useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

export interface CaseStudyFlipItem {
  id?: string;
  number?: string;
  eyebrow: string;
  title: string;
  badge?: string;
  background: string;
  foreground?: string;
  content: React.ReactNode;
}

export interface CaseStudyFlipStackProps {
  items: CaseStudyFlipItem[];
  className?: string;
}

function FlipCard({
  item,
  index,
  total,
  progress,
  reduceMotion,
}: {
  item: CaseStudyFlipItem;
  index: number;
  total: number;
  progress: MotionValue<number>;
  reduceMotion: boolean;
}) {
  const numTransitions = Math.max(total - 1, 1);
  const step = 1 / numTransitions;
  const isLast = index === total - 1;
  const sliceStart = index * step;
  const exitStart = isLast ? 1 : sliceStart + step * 0.35;
  const exitEnd = isLast ? 1.0001 : (index + 1) * step;
  const prevFlipStart = (index - 1) * step + step * 0.35;
  const stackedCardGap = Math.min(20, 60 / numTransitions);
  const stackedOffset = index * stackedCardGap;

  const exitYPercent = useTransform(
    progress,
    [exitStart, exitEnd],
    reduceMotion || isLast ? [0, 0] : [0, -118],
  );
  const exitStackOffset = useTransform(
    progress,
    [exitStart, exitEnd],
    reduceMotion || isLast ? [0, 0] : [0, stackedOffset],
  );
  const exitY = useMotionTemplate`calc(${exitYPercent}% + ${exitStackOffset}px)`;
  const rotateX = useTransform(
    progress,
    [exitStart, exitEnd],
    reduceMotion || isLast ? [0, 0] : [0, 22],
  );

  const opacity = useTransform(progress, (p) => {
    if (reduceMotion) {
      if (index === 0) return p >= exitEnd ? 0 : 1;
      if (isLast) return p < prevFlipStart ? 0 : 1;
      if (p < prevFlipStart) return 0;
      if (p >= exitEnd) return 0;
      return 1;
    }
    if (index === 0) {
      if (p < exitStart) return 1;
      if (p >= exitEnd) return 0;
      return 1 - (p - exitStart) / (exitEnd - exitStart);
    }
    if (p < prevFlipStart) return 0;
    if (isLast) return 1;
    if (p < exitStart) return 1;
    if (p >= exitEnd) return 0;
    return 1 - (p - exitStart) / (exitEnd - exitStart);
  });

  const pointerEvents = useTransform(progress, (p) => {
    if (index === 0) {
      return p < exitStart ? "auto" : "none";
    }
    const activationPoint = (index - 1) * step + step * 0.7;
    if (isLast) {
      return p >= activationPoint ? "auto" : "none";
    }
    return p >= activationPoint && p < exitStart ? "auto" : "none";
  });

  return (
    <motion.article
      id={item.id}
      className="cs-flip-card absolute inset-0 w-full h-full will-change-transform"
      style={{
        y: exitY,
        rotateX,
        opacity,
        zIndex: total - index,
        transformOrigin: "50% 100%",
        transformStyle: "preserve-3d",
        backfaceVisibility: "hidden",
        pointerEvents,
      }}
    >
      <motion.div
        className="cs-flip-card-inner flex flex-col h-full w-full overflow-hidden rounded-[20px] sm:rounded-[26px] shadow-[0_24px_70px_rgba(0,0,0,0.7)] border border-white/10"
        style={{
          backgroundColor: item.background,
          color: item.foreground ?? "#f5f5f5",
          transformOrigin: "50% 100%",
        }}
      >
        <div className="cs-flip-card-header shrink-0 flex items-center justify-between px-5 sm:px-8 py-3.5 border-b border-white/10 bg-black/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="font-mono text-base sm:text-lg font-bold text-[#d4af35]">
              {item.number ?? String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-white/30 text-sm">/</span>
            <span className="text-xs font-mono tracking-[0.2em] uppercase text-white/80 font-semibold">
              {item.eyebrow}
            </span>
          </div>
          <span className="text-[11px] font-mono tracking-widest uppercase px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
            {item.badge ?? `MODULE ${String(index + 1).padStart(2, "0")} / 06`}
          </span>
        </div>

        <div className="cs-flip-card-body flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8">
          {item.content}
        </div>
      </motion.div>
    </motion.article>
  );
}

export function CaseStudyFlipStack({
  items,
  className,
}: CaseStudyFlipStackProps) {
  const stackRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const safeItems = items && items.length > 0 ? items : [];
  const { scrollYProgress } = useScroll({
    target: stackRef,
    offset: ["start start", "end end"],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 22,
    mass: 0.8,
    restDelta: 0.0005,
  });
  const cardProgress = reduceMotion ? scrollYProgress : smoothProgress;

  return (
    <div
      className={cn("cs-flip-stack relative bg-transparent font-sans text-foreground", className)}
    >
      <div
        ref={stackRef}
        className="cs-flip-scroll-track relative"
        style={{ height: `${(Math.max(safeItems.length, 1) + 0.6) * 100}vh` }}
      >
        <div className="cs-flip-sticky sticky top-0 flex h-screen flex-col justify-center overflow-hidden px-[clamp(10px,3vw,40px)] py-4">
          <div className="cs-flip-deck relative mx-auto w-full max-w-[1240px] h-[86vh] min-h-[600px] max-h-[900px] [perspective:1400px]">
            {[...safeItems].reverse().map((item, reverseIndex) => {
              const index = safeItems.length - reverseIndex - 1;
              return (
                <FlipCard
                  key={`${item.title}-${index}`}
                  item={item}
                  index={index}
                  total={safeItems.length}
                  progress={cardProgress}
                  reduceMotion={reduceMotion}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
