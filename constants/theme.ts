export const colors = {
  background: "#161618",
  surface: "#1C1C1E",
  primary: "#6366F1",
  secondary: "#818CF8",
  paid: "#34D399",
  overdue: "#F87171",
  border: "rgba(255,255,255,0.07)",
  text: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.5)",
  textSecondary: "rgba(255,255,255,0.65)",
} as const;

// Slices draw in this order, so neighbors (last back to first too) were validated apart: dataviz validate_palette.js --surface "#161618".
export const chartHues = ["#6366F1", "#C98500", "#D55181", "#2F9FD6", "#8F9130", "#C06CC4"];
export const chartRest = "#636366";
