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
  /** Top video clip path (relative to public/) */
  topClip: string;
  /** Bottom video clip path (relative to public/) */
  bottomClip: string;
  /** Screenshot fallback for top half */
  topFallback: string;
  /** Screenshot fallback for bottom half */
  bottomFallback: string;
  /** Label for top half */
  topLabel?: string;
  /** Label for bottom half */
  bottomLabel?: string;
  /** Color for top label */
  topColor?: string;
  /** Color for bottom label */
  bottomColor?: string;
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
 * Top/bottom split-screen of two video clips.
 * Full 1920x1080 recordings are scaled to fit each half (1920x540).
 * A glowing cyan horizontal divider separates the two halves.
 * Falls back to Ken Burns screenshots if clips haven't been recorded yet.
 */
export const SplitScreen: React.FC<SplitScreenProps> = ({
  topClip,
  bottomClip,
  topFallback,
  bottomFallback,
  topLabel = "TRAINER",
  bottomLabel = "TRAINEE",
  topColor = COLORS.cyanAccent,
  bottomColor = COLORS.greenAccent,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = fadeEnvelope(frame, durationInFrames, 15);

  const halfStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    width: "100%",
    height: "50%",
    overflow: "hidden",
    backgroundColor: COLORS.darkBg,
  };

  const videoStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  };

  const labelStyle = (color: string): React.CSSProperties => ({
    position: "absolute",
    top: 8,
    left: 20,
    padding: "4px 14px",
    backgroundColor: `${COLORS.darkBg}cc`,
    border: `1px solid ${color}`,
    borderRadius: 6,
    color,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 2,
    fontFamily: "'Inter', 'SF Pro Display', sans-serif",
    textTransform: "uppercase" as const,
    boxShadow: `0 0 12px ${color}40`,
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Top half — Trainer */}
      <div style={{ ...halfStyle, top: 0 }}>
        <SafeVideo
          src={topClip}
          fallback={<HalfScreenFallback screenshotPath={topFallback} />}
          style={videoStyle}
        />
        <div style={labelStyle(topColor)}>{topLabel}</div>
      </div>

      {/* Bottom half — Trainee */}
      <div style={{ ...halfStyle, top: "50%" }}>
        <SafeVideo
          src={bottomClip}
          fallback={<HalfScreenFallback screenshotPath={bottomFallback} />}
          style={videoStyle}
        />
        <div style={labelStyle(bottomColor)}>{bottomLabel}</div>
      </div>

      {/* Glowing horizontal divider */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          width: "100%",
          height: 2,
          backgroundColor: COLORS.cyanAccent,
          boxShadow: `0 0 8px ${COLORS.cyanAccent}, 0 0 20px ${COLORS.cyanAccent}60`,
          transform: "translateY(-50%)",
        }}
      />
    </AbsoluteFill>
  );
};
