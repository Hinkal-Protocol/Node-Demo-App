import { processBatch } from "./functions/processBatch";
import { loadConfig } from "./functions/loadConfig";

if (typeof globalThis.addEventListener === "undefined") {
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.dispatchEvent = () => true;
  if (typeof globalThis.Worker === "undefined") {
    globalThis.Worker = class {
      constructor() {}
      postMessage() {}
      terminate() {}
      addEventListener() {}
      removeEventListener() {}
    } as any;
  }
}

const main = async () => {
  const input = loadConfig();
  if (!input) process.exit(1);

  try {
    const result = await processBatch(input);

    if (result.success) {
      console.log("Batch processing complete!");
      process.exit(0);
    } else {
      console.error(`Processing failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("Fatal error during execution:", error);
    process.exit(1);
  }
};

main();
