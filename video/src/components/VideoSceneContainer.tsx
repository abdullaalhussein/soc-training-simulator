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

interface VideoSceneContainerProps {
  /** Path relative to public/, e.g. "/clips/act1-admin.webm" */
  clipPath: string;
  /** Optional dark overlay opacity for text readability (0–1) */
  overlayOpacity?: number;
  children?: React.ReactNode;
}

/**
 * Wraps an OffthreadVideo clip with a fade envelope and optional
 * dark overlay for text/badge readability.
 */
export const VideoSceneContainer: React.FC<VideoSceneContainerProps> = ({
  clipPath,
  overlayOpacity = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = fadeEnvelope(frame, durationInFrames, 15);

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Video background */}
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile(clipPath)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </AbsoluteFill>

      {/* Optional dark overlay */}
      {overlayOpacity > 0 && (
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(8, 13, 26, ${overlayOpacity})`,
          }}
        />
      )}

      {/* Children (badges, sub-overlays) */}
      {children}
    </AbsoluteFill>
  );
};
