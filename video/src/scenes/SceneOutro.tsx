import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { fadeEnvelope, staggerFadeIn, slideUp, pulseGlow } from "../lib/animations";
import { COLORS } from "../lib/constants";

const FEATURES = [
  { label: "13 Scenarios", color: COLORS.cyanAccent },
  { label: "AI Mentor", color: COLORS.cyanAccent },
  { label: "AI Scoring", color: COLORS.greenAccent },
  { label: "YARA Rules", color: COLORS.greenAccent },
  { label: "Real-Time", color: COLORS.cyanAccent },
  { label: "Open Source", color: COLORS.cyanAccent },
];

/**
 * Closing card with GitHub URL and feature badges.
 * ~6 seconds (180 frames at 30fps).
 */
export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const opacity = fadeEnvelope(frame, durationInFrames, 20);

  const titleScale = spring({
    frame: frame - 8,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.7 },
  });

  const glow = pulseGlow(frame, 0.06);
  const glowSize = 15 + glow * 25;

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
      {/* Subtle grid background */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(${COLORS.cyanAccent}08 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.cyanAccent}08 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Title */}
      <div
        style={{
          transform: `scale(${titleScale})`,
          fontSize: 52,
          fontWeight: 700,
          letterSpacing: 2,
          color: COLORS.primaryText,
          fontFamily: "'Inter', 'SF Pro Display', sans-serif",
          textShadow: `0 0 ${glowSize}px ${COLORS.cyanAccent}40`,
          textAlign: "center",
          zIndex: 1,
        }}
      >
        SOC Training Simulator
      </div>

      {/* Feature badges */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "center",
          marginTop: 30,
          maxWidth: 800,
          zIndex: 1,
        }}
      >
        {FEATURES.map((feat, i) => {
          const delay = 20 + i * 6;
          const badgeOpacity = staggerFadeIn(frame, 0, delay);
          const yOffset = slideUp(frame, delay, 12);
          return (
            <div
              key={feat.label}
              style={{
                opacity: badgeOpacity,
                transform: `translateY(${yOffset}px)`,
                padding: "6px 18px",
                border: `1px solid ${feat.color}60`,
                borderRadius: 16,
                color: feat.color,
                fontSize: 15,
                fontWeight: 500,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: 1,
              }}
            >
              {feat.label}
            </div>
          );
        })}
      </div>

      {/* GitHub URL */}
      <div
        style={{
          opacity: staggerFadeIn(frame, 0, 55),
          transform: `translateY(${slideUp(frame, 55, 10)}px)`,
          fontSize: 22,
          color: COLORS.cyanAccent,
          fontFamily: "'Inter', sans-serif",
          fontWeight: 500,
          marginTop: 36,
          textShadow: `0 0 12px ${COLORS.cyanAccent}50`,
          zIndex: 1,
        }}
      >
        github.com/abdullaalhussein/soc-training-simulator
      </div>

      {/* MIT license note */}
      <div
        style={{
          opacity: staggerFadeIn(frame, 0, 65),
          fontSize: 16,
          color: COLORS.mutedText,
          fontFamily: "'Inter', sans-serif",
          marginTop: 14,
          zIndex: 1,
        }}
      >
        MIT License — Free & Open Source
      </div>
    </AbsoluteFill>
  );
};
