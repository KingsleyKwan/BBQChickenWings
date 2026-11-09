/** Always-on build stamp so Safari users can confirm the deploy. */
export const BUILD_VERSION = "v2026.11.09-ux5";

if (typeof console !== "undefined") {
  console.info(`[BBQChickenWings] ${BUILD_VERSION}`);
}
