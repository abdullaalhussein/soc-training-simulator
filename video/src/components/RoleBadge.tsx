import React from "react";
import { COLORS } from "../lib/constants";

interface RoleBadgeProps {
  /** Role label: ADMIN, TRAINER, or TRAINEE */
  role: "ADMIN" | "TRAINER" | "TRAINEE";
  /** Badge position */
  position?: "top-left" | "top-right";
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "#ff6b6b",
  TRAINER: COLORS.cyanAccent,
  TRAINEE: COLORS.greenAccent,
};

/**
 * Persistent corner badge showing current role during clip playback.
 */
export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  position = "top-left",
}) => {
  const color = ROLE_COLORS[role] || COLORS.cyanAccent;

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        [position === "top-left" ? "left" : "right"]: 20,
        padding: "8px 20px",
        backgroundColor: `${COLORS.darkBg}dd`,
        border: `1px solid ${color}`,
        borderRadius: 8,
        color,
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: 3,
        fontFamily: "'Inter', 'SF Pro Display', sans-serif",
        textTransform: "uppercase" as const,
        boxShadow: `0 0 15px ${color}30`,
        zIndex: 10,
      }}
    >
      {role}
    </div>
  );
};
