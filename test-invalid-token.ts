import { sendEmail } from "./server/services/email-service.ts";
import "dotenv/config";

// Force token to have quotes like someone might paste in Railway
process.env.ZEPTOMAIL_TOKEN = '"' + process.env.ZEPTOMAIL_TOKEN + '"';

async function run() {
  console.log("Testing with extra quotes in token...");
  try {
    await sendEmail({
      to: "test@example.com",
      subject: "Test",
      textBody: "Test",
    });
  } catch (error) {
    console.log("Error caught:", error.message);
  }
}
run();
