import { build } from "rolldown";
await build({
  input: "scripts/profile-domain.ts",
  platform: "node",
  output: { file: ".qa/profile-domain.mjs", format: "esm" },
});
await import("../.qa/profile-domain.mjs");
