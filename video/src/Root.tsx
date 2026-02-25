import { Composition } from "remotion";
import { DemoVideo } from "./DemoVideo";
import { DemoVideoV2 } from "./DemoVideoV2";
import { FPS, TOTAL_FRAMES, TOTAL_FRAMES_V2, WIDTH, HEIGHT } from "./lib/constants";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="SOCDemo"
        component={DemoVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="SOCDemoV2"
        component={DemoVideoV2}
        durationInFrames={TOTAL_FRAMES_V2}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
