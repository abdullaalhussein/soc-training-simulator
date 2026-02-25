import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { COLORS, SCENES_V2 } from "./lib/constants";
import { ProgressBar } from "./components/ProgressBar";
import { ScanLine } from "./components/ScanLine";
import { SceneIntro } from "./scenes/SceneIntro";
import { SceneTitle } from "./components/SceneTitle";
import { Act1Admin } from "./scenes/Act1Admin";
import { Act2Trainer } from "./scenes/Act2Trainer";
import { Act3Trainee } from "./scenes/Act3Trainee";
import { Act4SplitScreen } from "./scenes/Act4SplitScreen";
import { SceneOutro } from "./scenes/SceneOutro";

/**
 * Demo V2 — Main orchestrator.
 * 10 sequences: intro → 4 acts (title + content each) → outro.
 * Total ~3:30 (6300 frames at 30fps).
 */
export const DemoVideoV2: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.darkBg }}>
      {/* 1. Opening title card */}
      <Sequence
        from={SCENES_V2.intro.from}
        durationInFrames={SCENES_V2.intro.duration}
        name="Intro"
      >
        <SceneIntro />
      </Sequence>

      {/* 2. ACT 1 title */}
      <Sequence
        from={SCENES_V2.act1Title.from}
        durationInFrames={SCENES_V2.act1Title.duration}
        name="Act 1 Title"
      >
        <SceneTitle
          actNumber={1}
          title="ADMINISTRATION"
          subtitle="Scenarios, AI generation, audit, users"
        />
      </Sequence>

      {/* 3. ACT 1 content — Admin clip */}
      <Sequence
        from={SCENES_V2.act1Content.from}
        durationInFrames={SCENES_V2.act1Content.duration}
        name="Act 1 Content"
      >
        <Act1Admin />
      </Sequence>

      {/* 4. ACT 2 title */}
      <Sequence
        from={SCENES_V2.act2Title.from}
        durationInFrames={SCENES_V2.act2Title.duration}
        name="Act 2 Title"
      >
        <SceneTitle
          actNumber={2}
          title="TRAINER"
          subtitle="Session creation, scenario guide"
        />
      </Sequence>

      {/* 5. ACT 2 content — Trainer clip */}
      <Sequence
        from={SCENES_V2.act2Content.from}
        durationInFrames={SCENES_V2.act2Content.duration}
        name="Act 2 Content"
      >
        <Act2Trainer />
      </Sequence>

      {/* 6. ACT 3 title */}
      <Sequence
        from={SCENES_V2.act3Title.from}
        durationInFrames={SCENES_V2.act3Title.duration}
        name="Act 3 Title"
      >
        <SceneTitle
          actNumber={3}
          title="INVESTIGATION"
          subtitle="Full trainee walkthrough"
        />
      </Sequence>

      {/* 7. ACT 3 content — Trainee clip */}
      <Sequence
        from={SCENES_V2.act3Content.from}
        durationInFrames={SCENES_V2.act3Content.duration}
        name="Act 3 Content"
      >
        <Act3Trainee />
      </Sequence>

      {/* 8. ACT 4 title */}
      <Sequence
        from={SCENES_V2.act4Title.from}
        durationInFrames={SCENES_V2.act4Title.duration}
        name="Act 4 Title"
      >
        <SceneTitle
          actNumber={4}
          title="REAL-TIME"
          subtitle="Trainer + trainee side-by-side"
        />
      </Sequence>

      {/* 9. ACT 4 content — Split-screen */}
      <Sequence
        from={SCENES_V2.act4Content.from}
        durationInFrames={SCENES_V2.act4Content.duration}
        name="Act 4 Content"
      >
        <Act4SplitScreen />
      </Sequence>

      {/* 10. Closing card */}
      <Sequence
        from={SCENES_V2.outro.from}
        durationInFrames={SCENES_V2.outro.duration}
        name="Outro"
      >
        <SceneOutro />
      </Sequence>

      {/* Global overlays */}
      <ScanLine />
      <ProgressBar globalFrame={frame} />
    </AbsoluteFill>
  );
};
