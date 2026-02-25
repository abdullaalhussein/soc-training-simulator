import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { SplitScreen } from "../components/SplitScreen";
import { COLORS, CLIPS_V2 } from "../lib/constants";

/** Sub-overlay label data: [startFrame, endFrame, text] */
const SUB_LABELS: [number, number, string][] = [
  [0, 250, "REAL-TIME MONITORING"],
  [250, 500, "EVIDENCE → ACTIVITY FEED"],
  [500, 700, "BROADCAST ALERT"],
  [700, 1050, "TRAINER-TRAINEE DISCUSSION"],
];

/**
 * Act 4: Split-screen view — trainer on left, trainee on right,
 * with timed sub-overlays describing the real-time interaction.
 * ~35 seconds (1050 frames at 30fps).
 */
export const Act4SplitScreen: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <SplitScreen
        leftClip={CLIPS_V2.splitTrainer}
        rightClip={CLIPS_V2.splitTrainee}
        leftLabel="TRAINER"
        rightLabel="TRAINEE"
      />

      {/* Timed sub-labels at bottom center */}
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
              backgroundColor: `${COLORS.darkBg}ee`,
              border: `1px solid ${COLORS.cyanAccent}80`,
              borderRadius: 8,
              color: COLORS.cyanAccent,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: 3,
              fontFamily: "'Inter', 'SF Pro Display', sans-serif",
              textTransform: "uppercase" as const,
              boxShadow: `0 0 12px ${COLORS.cyanAccent}30`,
              zIndex: 10,
            }}
          >
            {text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
