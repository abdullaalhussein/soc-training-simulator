import { Composition } from "remotion";
import { DemoVideo } from "./DemoVideo";
import { DemoAdmin } from "./DemoAdmin";
import { DemoTrainer } from "./DemoTrainer";
import { DemoTrainee } from "./DemoTrainee";
import { DemoVideoV2 } from "./DemoVideoV2";
import {
  FPS, TOTAL_FRAMES, WIDTH, HEIGHT,
  ADMIN_COMP, TRAINER_COMP, TRAINEE_COMP, COMBINED_COMP,
} from "./lib/constants";

export const Root: React.FC = () => {
  return (
    <>
      {/* V1 — static screenshots */}
      <Composition
        id="SOCDemo"
        component={DemoVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      {/* V2 — per-role */}
      <Composition
        id="SOCAdmin"
        component={DemoAdmin}
        durationInFrames={ADMIN_COMP.total}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="SOCTrainer"
        component={DemoTrainer}
        durationInFrames={TRAINER_COMP.total}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="SOCTrainee"
        component={DemoTrainee}
        durationInFrames={TRAINEE_COMP.total}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      {/* V2 — all roles combined */}
      <Composition
        id="SOCDemoV2"
        component={DemoVideoV2}
        durationInFrames={COMBINED_COMP.total}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
