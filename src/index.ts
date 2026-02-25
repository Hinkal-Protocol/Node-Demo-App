import { processBatch } from "./services/processBatch";
import { loadConfig } from "./services/loadConfig";
import { initializeLogger } from "./utils/logger";

initializeLogger();

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
