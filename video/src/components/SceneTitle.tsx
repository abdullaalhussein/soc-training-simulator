import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { fadeEnvelope } from "../lib/animations";
import { COLORS } from "../lib/constants";

interface SceneTitleProps {
  /** Act number (e.g. 1, 2, 3, 4) */
  actNumber: number;
  /** Main title text */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
}

/**
 * Reusable act intro card: dark background, "ACT N" muted label,
 * spring-animated title with glow, optional subtitle.
 * Designed for ~2.5 second sequences (75 frames at 30fps).
 */
export const SceneTitle: React.FC<SceneTitleProps> = ({
  actNumber,
  title,
  subtitle,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const opacity = fadeEnvelope(frame, durationInFrames, 12);

  const titleScale = spring({
    frame: frame - 8,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.7 },
  });

  const subtitleOpacity = spring({
    frame: frame - 20,
    fps,
    config: { damping: 20, stiffness: 80, mass: 1 },
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundColor: COLORS.darkBg,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* ACT N label */}
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: 6,
          color: COLORS.mutedText,
          fontFamily: "'Inter', 'SF Pro Display', sans-serif",
          marginBottom: 16,
          textTransform: "uppercase",
        }}
      >
        ACT {actNumber}
      </div>

      {/* Main title with spring + glow */}
      <div
        style={{
          transform: `scale(${titleScale})`,
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: 4,
          color: COLORS.primaryText,
          fontFamily: "'Inter', 'SF Pro Display', sans-serif",
          textShadow: `0 0 30px ${COLORS.cyanAccent}60, 0 0 60px ${COLORS.cyanAccent}30`,
          textAlign: "center",
        }}
      >
        {title}
      </div>

      {/* Optional subtitle */}
      {subtitle && (
        <div
          style={{
            opacity: subtitleOpacity,
            fontSize: 22,
            color: COLORS.mutedText,
            fontFamily: "'Inter', 'SF Pro Display', sans-serif",
            marginTop: 20,
            letterSpacing: 1,
          }}
        >
          {subtitle}
        </div>
      )}

      {/* Accent line under title */}
      <div
        style={{
          width: 80,
          height: 2,
          backgroundColor: COLORS.cyanAccent,
          marginTop: 24,
          boxShadow: `0 0 10px ${COLORS.cyanAccent}`,
          opacity: subtitleOpacity,
        }}
      />
    </AbsoluteFill>
  );
};
