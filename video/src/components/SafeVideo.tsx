import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  delayRender,
  continueRender,
} from "remotion";

interface SafeVideoProps {
  /** Path relative to public/, e.g. "/clips/act1-admin.webm" */
  src: string;
  /** Fallback rendered when the clip doesn't exist */
  fallback: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Probes whether a video clip exists via HEAD request before rendering
 * OffthreadVideo. If the clip is missing, renders the fallback instead.
 * Uses delayRender/continueRender so Remotion waits for the check.
 */
export const SafeVideo: React.FC<SafeVideoProps> = ({
  src,
  fallback,
  style,
}) => {
  const [exists, setExists] = useState<boolean | null>(null);
  const [handle] = useState(() =>
    delayRender("Checking if video clip exists")
  );

  useEffect(() => {
    const url = staticFile(src);
    fetch(url, { method: "HEAD" })
      .then((res) => {
        setExists(res.ok);
        continueRender(handle);
      })
      .catch(() => {
        setExists(false);
        continueRender(handle);
      });
  }, [src, handle]);

  if (exists === null) return null;

  if (!exists) return <>{fallback}</>;

  return (
    <OffthreadVideo
      src={staticFile(src)}
      style={style}
    />
  );
};
