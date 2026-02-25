import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, ADMIN_COMP, CLIPS_V2, SCREENSHOTS } from "./lib/constants";
import { SceneTitle } from "./components/SceneTitle";
import { VideoSceneContainer } from "./components/VideoSceneContainer";
import { RoleBadge } from "./components/RoleBadge";
import { SceneOutro } from "./scenes/SceneOutro";

export const DemoAdmin: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.darkBg }}>
    <Sequence from={ADMIN_COMP.title.from} durationInFrames={ADMIN_COMP.title.duration} name="Title">
      <SceneTitle actNumber={1} title="ADMINISTRATION" subtitle="Scenarios, AI generation, audit, users" />
    </Sequence>
    <Sequence from={ADMIN_COMP.clip.from} durationInFrames={ADMIN_COMP.clip.duration} name="Clip">
      <VideoSceneContainer clipPath={CLIPS_V2.admin} fallbackScreenshot={SCREENSHOTS.scenarios}>
        <RoleBadge role="ADMIN" />
      </VideoSceneContainer>
    </Sequence>
    <Sequence from={ADMIN_COMP.outro.from} durationInFrames={ADMIN_COMP.outro.duration} name="Outro">
      <SceneOutro />
    </Sequence>
  </AbsoluteFill>
);
