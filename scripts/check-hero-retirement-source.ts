import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Hero retirement assertion failed: ${message}`);
}

const workflow = await readFile("src/lib/cms-workflow.ts", "utf8");
const mediaService = await readFile("src/lib/media-service.ts", "utf8");
const actions = await readFile("src/app/admin/actions.ts", "utf8");
const retireBlock = workflow.slice(workflow.indexOf('draft.operation === CmsDraftOperation.RETIRE'));

assert(retireBlock.includes("tx.homeHeroSlide.deleteMany"), "editor-approved MEDIA retirement deletes Hero slots");
assert(!retireBlock.includes("homeHeroSlide.updateMany"), "editor-approved MEDIA retirement does not null Hero media IDs");
assert(mediaService.includes("tx.homeHeroSlide.deleteMany"), "direct media retirement also deletes Hero slots");
assert(actions.includes('mediaAssetId: { not: null }') && actions.includes('A maximum of four Hero images is allowed.'), "Administrator Hero create enforces total four-image limit");
assert(workflow.includes('const creating = operation === CmsDraftOperation.CREATE') && workflow.includes('if (creating && total >= 4)'), "draft Hero CREATE enforces total four-image limit");
console.info("Hero retirement source assertions passed.");