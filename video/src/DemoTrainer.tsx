import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, TRAINER_COMP, CLIPS_V2, SCREENSHOTS } from "./lib/constants";
import { SceneTitle } from "./components/SceneTitle";
import { VideoSceneContainer } from "./components/VideoSceneContainer";
import { RoleBadge } from "./components/RoleBadge";
import { SceneOutro } from "./scenes/SceneOutro";

export const DemoTrainer: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.darkBg }}>
    <Sequence from={TRAINER_COMP.title.from} durationInFrames={TRAINER_COMP.title.duration} name="Title">
      <SceneTitle actNumber={2} title="TRAINER" subtitle="Session creation, scenario guide" />
    </Sequence>
    <Sequence from={TRAINER_COMP.clip.from} durationInFrames={TRAINER_COMP.clip.duration} name="Clip">
      <VideoSceneContainer clipPath={CLIPS_V2.trainer} fallbackScreenshot={SCREENSHOTS.trainer}>
        <RoleBadge role="TRAINER" />
      </VideoSceneContainer>
    </Sequence>
    <Sequence from={TRAINER_COMP.outro.from} durationInFrames={TRAINER_COMP.outro.duration} name="Outro">
      <SceneOutro />
    </Sequence>
  </AbsoluteFill>
);
