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

interface VideoSceneContainerProps {
  /** Path relative to public/, e.g. "/clips/act1-admin.webm" */
  clipPath: string;
  /** Screenshot path used as fallback when clip isn't available */
  fallbackScreenshot: string;
  /** Optional dark overlay opacity for text readability (0–1) */
  overlayOpacity?: number;
  children?: React.ReactNode;
}

/**
 * Screenshot fallback — replicates V1's SceneContainer look
 * (Ken Burns zoom + gradient overlay) when the video clip is missing.
 */
const ScreenshotFallback: React.FC<{ screenshotPath: string }> = ({
  screenshotPath,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = kenBurns(frame, durationInFrames);

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <Img
          src={staticFile(screenshotPath)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${COLORS.overlayStart} 0%, ${COLORS.overlayEnd} 40%, ${COLORS.overlayStart} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Wraps a video clip with a fade envelope and optional dark overlay.
 * Falls back to a Ken Burns screenshot if the clip isn't recorded yet.
 */
export const VideoSceneContainer: React.FC<VideoSceneContainerProps> = ({
  clipPath,
  fallbackScreenshot,
  overlayOpacity = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = fadeEnvelope(frame, durationInFrames, 15);

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Video background with screenshot fallback */}
      <AbsoluteFill>
        <SafeVideo
          src={clipPath}
          fallback={<ScreenshotFallback screenshotPath={fallbackScreenshot} />}
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
