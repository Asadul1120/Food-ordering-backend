import app from "./app.js";
import { config } from "./config/index.ts";
import { prisma } from "./lib/prisma.ts";
import { startOtpCleanup } from "./utils/otpCleanup.cron.ts";

export async function startServer(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("Connected to the database");
    startOtpCleanup()
    app.listen(config.port, () => {
      console.log(`Server is running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  }
}
