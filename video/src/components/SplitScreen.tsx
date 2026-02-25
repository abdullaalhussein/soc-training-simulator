import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fadeEnvelope } from "../lib/animations";
import { COLORS } from "../lib/constants";

interface SplitScreenProps {
  /** Left video clip path (relative to public/) */
  leftClip: string;
  /** Right video clip path (relative to public/) */
  rightClip: string;
  /** Label for left side */
  leftLabel?: string;
  /** Label for right side */
  rightLabel?: string;
  /** Color for left label */
  leftColor?: string;
  /** Color for right label */
  rightColor?: string;
}

/**
 * Side-by-side split-screen of two video clips.
 * Each full 1920x1080 recording is center-cropped into a 960x1080 half.
 * A glowing cyan divider separates the two halves.
 */
export const SplitScreen: React.FC<SplitScreenProps> = ({
  leftClip,
  rightClip,
  leftLabel = "TRAINER",
  rightLabel = "TRAINEE",
  leftColor = COLORS.cyanAccent,
  rightColor = COLORS.greenAccent,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = fadeEnvelope(frame, durationInFrames, 15);

  const halfStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    width: "50%",
    height: "100%",
    overflow: "hidden",
  };

  const videoStyle: React.CSSProperties = {
    width: "200%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
  };

  const labelStyle = (color: string, side: "left" | "right"): React.CSSProperties => ({
    position: "absolute",
    top: 20,
    [side === "left" ? "left" : "right"]: 20,
    padding: "6px 16px",
    backgroundColor: `${COLORS.darkBg}cc`,
    border: `1px solid ${color}`,
    borderRadius: 6,
    color,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 2,
    fontFamily: "'Inter', 'SF Pro Display', sans-serif",
    textTransform: "uppercase" as const,
    boxShadow: `0 0 12px ${color}40`,
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Left half */}
      <div style={{ ...halfStyle, left: 0 }}>
        <OffthreadVideo
          src={staticFile(leftClip)}
          style={videoStyle}
        />
        <div style={labelStyle(leftColor, "left")}>{leftLabel}</div>
      </div>

      {/* Right half */}
      <div style={{ ...halfStyle, left: "50%" }}>
        <OffthreadVideo
          src={staticFile(rightClip)}
          style={videoStyle}
        />
        <div style={labelStyle(rightColor, "right")}>{rightLabel}</div>
      </div>

      {/* Glowing center divider */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 2,
          height: "100%",
          backgroundColor: COLORS.cyanAccent,
          boxShadow: `0 0 8px ${COLORS.cyanAccent}, 0 0 20px ${COLORS.cyanAccent}60`,
          transform: "translateX(-50%)",
        }}
      />
    </AbsoluteFill>
  );
};
