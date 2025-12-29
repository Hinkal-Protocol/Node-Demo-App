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
  try {
    const input = await loadConfig();
    if (!input) {
      console.error("Failed to load configuration");
      process.exit(1);
    }
    const result = await processBatch(input);

    if (result.success) {
      console.log("Batch processing complete!");
      process.exit(0);
    } else {
      console.error(`Processing failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(
      "Fatal error:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
};

main();
