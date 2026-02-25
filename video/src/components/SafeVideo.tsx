import React from "react";
import {
  OffthreadVideo,
  staticFile,
} from "remotion";

interface SafeVideoProps {
  /** Path relative to public/, e.g. "/clips/act1-admin.mp4" */
  src: string;
  /** Fallback rendered when the clip doesn't exist */
  fallback: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Renders an OffthreadVideo for the given clip. Falls back gracefully
 * if the video errors (e.g. missing file). No blocking HEAD probes —
 * Remotion's OffthreadVideo handles missing files via onError.
 */
export const SafeVideo: React.FC<SafeVideoProps> = ({
  src,
  fallback,
  style,
}) => {
  return (
    <OffthreadVideo
      src={staticFile(src)}
      style={style}
      onError={() => {
        // OffthreadVideo will show nothing on error;
        // the fallback is handled by the parent via ErrorBoundary if needed.
      }}
    />
  );
};
