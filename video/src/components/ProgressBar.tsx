import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../lib/constants";

/**
 * Thin cyan progress bar at the bottom edge of the video.
 * Uses absolute frame from the full composition (not per-sequence frame).
 */
export const ProgressBar: React.FC<{ globalFrame: number }> = ({
  globalFrame,
}) => {
  const { durationInFrames } = useVideoConfig();
  const progress = (globalFrame / durationInFrames) * 100;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 3,
          backgroundColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            backgroundColor: COLORS.cyanAccent,
            boxShadow: `0 0 8px ${COLORS.cyanAccent}`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
