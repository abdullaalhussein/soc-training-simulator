import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, COMBINED_COMP, CLIPS_V2, SCREENSHOTS } from "./lib/constants";
import { SceneIntro } from "./scenes/SceneIntro";
import { VideoSceneContainer } from "./components/VideoSceneContainer";
import { RoleBadge } from "./components/RoleBadge";
import { Act4SplitScreen } from "./scenes/Act4SplitScreen";
import { SceneOutro } from "./scenes/SceneOutro";

/**
 * Combined demo — all roles back-to-back with intro + outro.
 * ~1:22 total (2444 frames at 30fps).
 */
export const DemoVideoV2: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.darkBg }}>
    <Sequence from={COMBINED_COMP.intro.from} durationInFrames={COMBINED_COMP.intro.duration} name="Intro">
      <SceneIntro />
    </Sequence>

    <Sequence from={COMBINED_COMP.admin.from} durationInFrames={COMBINED_COMP.admin.duration} name="Admin">
      <VideoSceneContainer clipPath={CLIPS_V2.admin} fallbackScreenshot={SCREENSHOTS.scenarios}>
        <RoleBadge role="ADMIN" />
      </VideoSceneContainer>
    </Sequence>

    <Sequence from={COMBINED_COMP.trainer.from} durationInFrames={COMBINED_COMP.trainer.duration} name="Trainer">
      <VideoSceneContainer clipPath={CLIPS_V2.trainer} fallbackScreenshot={SCREENSHOTS.trainer}>
        <RoleBadge role="TRAINER" />
      </VideoSceneContainer>
    </Sequence>

    <Sequence from={COMBINED_COMP.trainee.from} durationInFrames={COMBINED_COMP.trainee.duration} name="Trainee">
      <VideoSceneContainer clipPath={CLIPS_V2.trainee} fallbackScreenshot={SCREENSHOTS.investigation}>
        <RoleBadge role="TRAINEE" />
      </VideoSceneContainer>
    </Sequence>

    <Sequence from={COMBINED_COMP.split.from} durationInFrames={COMBINED_COMP.split.duration} name="Split Screen">
      <Act4SplitScreen />
    </Sequence>

    <Sequence from={COMBINED_COMP.outro.from} durationInFrames={COMBINED_COMP.outro.duration} name="Outro">
      <SceneOutro />
    </Sequence>
  </AbsoluteFill>
);
