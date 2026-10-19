import { Tabs } from "expo-router";
import { FloatingTabBar } from "@/components/FloatingTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="expenses" options={{ title: "Activity" }} />
      <Tabs.Screen name="recurring" options={{ title: "Recurring" }} />
      <Tabs.Screen name="accounts" options={{ title: "Accounts" }} />
    </Tabs>
  );
}
