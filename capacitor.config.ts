import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.siuwing.app",
  appName: "燒雞翼",
  webDir: "dist",
  backgroundColor: "#110c09",
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "Siu Wing",
  },
};

export default config;
