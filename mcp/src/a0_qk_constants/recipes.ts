/** Tier a0 — static refactor recipe data. */

export interface Recipe {
  name: string;
  description: string;
  steps: string[];
}

export const RECIPES: Record<string, Recipe> = {
  "split-module": {
    name: "split-module",
    description: "Split an oversized module into correctly-tiered files",
    steps: [
      "1. Identify the dominant responsibility of the module (pure function, stateful class, or feature).",
      "2. Run `recon` to find all callers of the module's symbols.",
      "3. Move pure helpers to an a1 file matching the naming pattern *_helpers.ts or *_utils.ts.",
      "4. Move stateful classes to an a2 file matching *_client.ts or *_store.ts.",
      "5. Move feature logic to an a3 file matching *_feature.ts or *_service.ts.",
      "6. Update all import sites to point to the new split files.",
      "7. Run `wire` to confirm no upward imports were introduced.",
      "8. Run `certify` to verify score did not decrease.",
    ],
  },
  "add-tier": {
    name: "add-tier",
    description: "Introduce a missing tier directory to a project",
    steps: [
      "1. Run `recon` to confirm which tier is missing.",
      "2. Create the tier directory with the correct name (a0_qk_constants, a1_at_functions, etc.).",
      "3. Add an index file with the tier docstring.",
      "4. Move any misplaced files into the new tier.",
      "5. Run `enforce` to confirm the violation count dropped.",
      "6. Run `certify` to verify the score improved.",
    ],
  },
  "fix-upward-import": {
    name: "fix-upward-import",
    description: "Fix a forbidden upward import between tiers",
    steps: [
      "1. Run `wire` to get the full violation list.",
      "2. For each upward import, identify the symbol being imported.",
      "3. Move the symbol to the lower tier where it logically belongs.",
      "4. Update the importing file to import from the new location.",
      "5. Run `wire` again to confirm the violation is gone.",
    ],
  },
  "add-docstrings": {
    name: "add-docstrings",
    description: "Add missing tier module docstrings to all files",
    steps: [
      "1. Run `recon` with verbose=true to find files missing docstrings.",
      "2. For each file, add the module docstring as the very first string literal.",
      "3. Use the pattern: `/** Tier a<N> — <one-line description>. */`",
      "4. Run `certify` to verify the docstring score component improved.",
    ],
  },
  "rename-to-convention": {
    name: "rename-to-convention",
    description: "Rename files to match Atomadic tier naming conventions",
    steps: [
      "1. Run `enforce` to list files with non-conforming names.",
      "2. For each file, identify its tier from its directory.",
      "3. Rename using the tier pattern: a0→*_constants.ts, a1→*_utils.ts, a2→*_client.ts, a3→*_feature.ts, a4→index.ts or *_cli.ts.",
      "4. Update all import sites.",
      "5. Run `certify` to confirm naming score improved.",
    ],
  },
};
