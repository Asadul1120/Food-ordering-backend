import cron from "node-cron";
import { deleteExpiredOtps } from "./otp.utils.ts";

export const startOtpCleanup = () => {
  return cron.schedule("* * * * *", async () => {
    try {
      const result = await deleteExpiredOtps();

      if (result.count > 0) {
        console.log(`Deleted ${result.count} expired OTPs`);
      }
    } catch (error) {
      console.error("OTP cleanup failed:", error);
    }
  });
};