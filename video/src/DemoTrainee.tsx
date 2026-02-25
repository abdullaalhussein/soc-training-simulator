import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, TRAINEE_COMP, CLIPS_V2, SCREENSHOTS } from "./lib/constants";
import { SceneTitle } from "./components/SceneTitle";
import { VideoSceneContainer } from "./components/VideoSceneContainer";
import { RoleBadge } from "./components/RoleBadge";
import { SceneOutro } from "./scenes/SceneOutro";

export const DemoTrainee: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.darkBg }}>
    <Sequence from={TRAINEE_COMP.title.from} durationInFrames={TRAINEE_COMP.title.duration} name="Title">
      <SceneTitle actNumber={3} title="INVESTIGATION" subtitle="Full trainee walkthrough" />
    </Sequence>
    <Sequence from={TRAINEE_COMP.clip.from} durationInFrames={TRAINEE_COMP.clip.duration} name="Clip">
      <VideoSceneContainer clipPath={CLIPS_V2.trainee} fallbackScreenshot={SCREENSHOTS.investigation}>
        <RoleBadge role="TRAINEE" />
      </VideoSceneContainer>
    </Sequence>
    <Sequence from={TRAINEE_COMP.outro.from} durationInFrames={TRAINEE_COMP.outro.duration} name="Outro">
      <SceneOutro />
    </Sequence>
  </AbsoluteFill>
);
