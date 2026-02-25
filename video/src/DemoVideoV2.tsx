import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, COMBINED_COMP } from "./lib/constants";
import { SceneIntro } from "./scenes/SceneIntro";
import { Act1Admin } from "./scenes/Act1Admin";
import { Act2Trainer } from "./scenes/Act2Trainer";
import { Act3Trainee } from "./scenes/Act3Trainee";
import { Act4SplitScreen } from "./scenes/Act4SplitScreen";
import { SceneOutro } from "./scenes/SceneOutro";

/**
 * Combined demo V3 — all roles back-to-back with intro + outro.
 * ~90s total (2700 frames at 30fps).
 */
export const DemoVideoV2: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.darkBg }}>
    <Sequence from={COMBINED_COMP.intro.from} durationInFrames={COMBINED_COMP.intro.duration} name="Intro">
      <SceneIntro />
    </Sequence>

    <Sequence from={COMBINED_COMP.admin.from} durationInFrames={COMBINED_COMP.admin.duration} name="Admin">
      <Act1Admin />
    </Sequence>

    <Sequence from={COMBINED_COMP.trainer.from} durationInFrames={COMBINED_COMP.trainer.duration} name="Trainer">
      <Act2Trainer />
    </Sequence>

    <Sequence from={COMBINED_COMP.trainee.from} durationInFrames={COMBINED_COMP.trainee.duration} name="Trainee">
      <Act3Trainee />
    </Sequence>

    <Sequence from={COMBINED_COMP.split.from} durationInFrames={COMBINED_COMP.split.duration} name="Split Screen">
      <Act4SplitScreen />
    </Sequence>

    <Sequence from={COMBINED_COMP.outro.from} durationInFrames={COMBINED_COMP.outro.duration} name="Outro">
      <SceneOutro />
    </Sequence>
  </AbsoluteFill>
);
