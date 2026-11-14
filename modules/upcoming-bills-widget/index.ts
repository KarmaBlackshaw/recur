import { requireOptionalNativeModule } from "expo";

interface UpcomingBillsWidgetModule {
  setSnapshot(json: string): Promise<void>;
}

// Null off Android and in Expo Go, where the native module isn't built in.
const nativeModule = requireOptionalNativeModule<UpcomingBillsWidgetModule>("UpcomingBillsWidget");

export async function setUpcomingBillsSnapshot(json: string): Promise<void> {
  await nativeModule?.setSnapshot(json);
}
