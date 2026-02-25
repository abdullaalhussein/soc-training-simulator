import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { fadeEnvelope, pulseGlow, staggerFadeIn, slideUp } from "../lib/animations";
import { COLORS } from "../lib/constants";

/**
 * Opening title card — "SOC Training Simulator" with animated
 * tagline and pulsing glow. ~4 seconds (120 frames at 30fps).
 */
export const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const opacity = fadeEnvelope(frame, durationInFrames, 20);

  const titleScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.8 },
  });

  const glow = pulseGlow(frame, 0.06);
  const glowSize = 20 + glow * 30;

  const tags = ["Open-source", "AI-powered", "Self-hosted"];

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

      {/* Main title */}
      <div
        style={{
          transform: `scale(${titleScale})`,
          fontSize: 76,
          fontWeight: 700,
          letterSpacing: 3,
          color: COLORS.primaryText,
          fontFamily: "'Inter', 'SF Pro Display', sans-serif",
          textShadow: `0 0 ${glowSize}px ${COLORS.cyanAccent}50`,
          textAlign: "center",
          zIndex: 1,
        }}
      >
        SOC Training Simulator
      </div>

      {/* Tagline badges */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 30,
          zIndex: 1,
        }}
      >
        {tags.map((tag, i) => {
          const delay = 30 + i * 10;
          const tagOpacity = staggerFadeIn(frame, 0, delay);
          const yOffset = slideUp(frame, delay, 15);
          return (
            <div
              key={tag}
              style={{
                opacity: tagOpacity,
                transform: `translateY(${yOffset}px)`,
                padding: "8px 24px",
                border: `1px solid ${COLORS.cyanAccent}60`,
                borderRadius: 20,
                color: COLORS.cyanAccent,
                fontSize: 18,
                fontWeight: 500,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: 1,
              }}
            >
              {tag}
            </div>
          );
        })}
      </div>

      {/* Subtitle */}
      <div
        style={{
          opacity: staggerFadeIn(frame, 0, 55),
          transform: `translateY(${slideUp(frame, 55, 10)}px)`,
          fontSize: 24,
          color: COLORS.mutedText,
          fontFamily: "'Inter', sans-serif",
          marginTop: 28,
          textAlign: "center",
          zIndex: 1,
        }}
      >
        Prepares SOC analysts for real incidents before they face one.
      </div>
    </AbsoluteFill>
  );
};
