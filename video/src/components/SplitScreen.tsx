import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fadeEnvelope, kenBurns } from "../lib/animations";
import { COLORS } from "../lib/constants";
import { SafeVideo } from "./SafeVideo";

interface SplitScreenProps {
  /** Left video clip path (relative to public/) */
  leftClip: string;
  /** Right video clip path (relative to public/) */
  rightClip: string;
  /** Screenshot fallback for left side */
  leftFallback: string;
  /** Screenshot fallback for right side */
  rightFallback: string;
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
 * Screenshot fallback for one half of the split screen.
 */
const HalfScreenFallback: React.FC<{ screenshotPath: string }> = ({
  screenshotPath,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = kenBurns(frame, durationInFrames, 1.04);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          width: "100%",
          height: "100%",
        }}
      >
        <Img
          src={staticFile(screenshotPath)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${COLORS.overlayStart} 0%, ${COLORS.overlayEnd} 40%, ${COLORS.overlayStart} 100%)`,
        }}
      />
    </div>
  );
};

/**
 * Side-by-side split-screen of two video clips.
 * Each full 1920x1080 recording is center-cropped into a 960x1080 half.
 * A glowing cyan divider separates the two halves.
 * Falls back to Ken Burns screenshots if clips haven't been recorded yet.
 */
export const SplitScreen: React.FC<SplitScreenProps> = ({
  leftClip,
  rightClip,
  leftFallback,
  rightFallback,
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

  // Clips are pre-cropped to 960x1080 by collect-clips.js — no CSS cropping needed
  const videoStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
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
        <SafeVideo
          src={leftClip}
          fallback={<HalfScreenFallback screenshotPath={leftFallback} />}
          style={videoStyle}
        />
        <div style={labelStyle(leftColor, "left")}>{leftLabel}</div>
      </div>

      {/* Right half */}
      <div style={{ ...halfStyle, left: "50%" }}>
        <SafeVideo
          src={rightClip}
          fallback={<HalfScreenFallback screenshotPath={rightFallback} />}
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
