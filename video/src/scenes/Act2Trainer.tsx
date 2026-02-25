import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { VideoSceneContainer } from "../components/VideoSceneContainer";
import { RoleBadge } from "../components/RoleBadge";
import { COLORS, CLIPS_V2, SCREENSHOTS } from "../lib/constants";

/** Sub-overlay label data: [startFrame, endFrame, text] */
const SUB_LABELS: [number, number, string][] = [
  [60,  190, "TRAINER CONSOLE"],
  [200, 520, "SESSION CREATION"],
  [530, 700, "LIVE MONITOR"],
  [710, 879, "SCENARIO GUIDE"],
];

/**
 * Act 2: Trainer clip with role badge and timed sub-overlays.
 * 879 frames (29.3s at 30fps).
 */
export const Act2Trainer: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <VideoSceneContainer clipPath={CLIPS_V2.trainer} fallbackScreenshot={SCREENSHOTS.trainer}>
      <RoleBadge role="TRAINER" />

      {/* Timed sub-labels */}
      {SUB_LABELS.map(([start, end, text]) => {
        if (frame < start || frame > end) return null;

        const localFrame = frame - start;
        const duration = end - start;
        const opacity = Math.min(
          interpolate(localFrame, [0, 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          interpolate(localFrame, [duration - 15, duration], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        );

        return (
          <div
            key={text}
            style={{
              position: "absolute",
              bottom: 40,
              left: "50%",
              transform: "translateX(-50%)",
              opacity,
              padding: "10px 28px",
              backgroundColor: `${COLORS.darkBg}dd`,
              border: `1px solid ${COLORS.cyanAccent}80`,
              borderRadius: 8,
              color: COLORS.cyanAccent,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: 3,
              fontFamily: "'Inter', 'SF Pro Display', sans-serif",
              textTransform: "uppercase" as const,
              boxShadow: `0 0 12px ${COLORS.cyanAccent}30`,
            }}
          >
            {text}
          </div>
        );
      })}
    </VideoSceneContainer>
  );
};
