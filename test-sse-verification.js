#!/usr/bin/env node

/**
 * Manual test script for SSE Email Verification
 * Run with: node test-sse-verification.js
 */

const EventSource = require("eventsource");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function testSseVerification() {
  console.log("🔧 SSE Email Verification Test Script");
  console.log("=====================================\n");

  // Get test email from user
  const email = await new Promise((resolve) => {
    rl.question("Enter test email: ", resolve);
  });

  console.log(`\n📡 Opening SSE stream for: ${email}`);
  console.log(
    `🌐 URL: http://localhost:4000/api/V2/sse/verify?email=${encodeURIComponent(email)}`,
  );

  try {
    const eventSource = new EventSource(
      `http://localhost:4000/api/V2/sse/verify?email=${encodeURIComponent(email)}`,
    );

    eventSource.addEventListener("verification", (event) => {
      const data = JSON.parse(event.data);
      console.log("\n✅ Verification Event Received:");
      console.log("   Status:", data.status);
      console.log("   Email:", data.email);
      console.log("   Verified:", data.verified);
      console.log("   Timestamp:", data.timestamp);
      console.log("   Correlation ID:", data.correlationId);

      if (data.status === "verified") {
        console.log("   Token:", data.token ? "Present" : "Missing");
        console.log("   User Data:", data.user ? "Present" : "Missing");
        console.log("\n🎉 Verification successful! You can now login.");
        eventSource.close();
        rl.close();
      } else if (data.status === "timeout") {
        console.log("   Reason:", data.reason);
        console.log("\n⏰ Verification timed out. Please try again.");
        eventSource.close();
        rl.close();
      } else if (data.status === "pending") {
        console.log("   Message:", data.message);
        console.log("\n⏳ Waiting for verification...");
      }
    });

    eventSource.addEventListener("ping", (event) => {
      const data = JSON.parse(event.data);
      console.log("💓 Heartbeat:", new Date(data.ts).toLocaleTimeString());
    });

    eventSource.onopen = () => {
      console.log("🔗 SSE Connection established");
      console.log(
        "\n📧 Now check your email and click the verification link...",
      );
      console.log(
        '   Or test with: curl "http://localhost:4000/api/V2/auth/admin/verifyLogin?token=YOUR_TOKEN"',
      );
      console.log("\n⌨️  Press Ctrl+C to exit\n");
    };

    eventSource.onerror = (error) => {
      console.error("\n❌ SSE Error:", error);
      console.log("   This might be due to:");
      console.log("   - Invalid email address");
      console.log("   - User not found in system");
      console.log("   - Network connectivity issues");
      eventSource.close();
      rl.close();
    };

    // Handle Ctrl+C
    process.on("SIGINT", () => {
      console.log("\n\n👋 Closing connection...");
      eventSource.close();
      rl.close();
    });
  } catch (error) {
    console.error("❌ Failed to create EventSource:", error.message);
    rl.close();
  }
}

// Check connection status function
async function checkConnectionStatus(email) {
  console.log(`\n🔍 Checking connection status for: ${email}`);

  try {
    const response = await fetch(
      `http://localhost:4000/api/V2/sse/status?email=${encodeURIComponent(email)}`,
    );
    const data = await response.json();

    console.log("📊 Status:", data.status);
    if (data.status === "connected") {
      console.log("📧 Email:", data.email);
      console.log("🆔 Correlation ID:", data.correlationId);
      console.log(
        "⏰ Connected At:",
        new Date(data.connectedAt).toLocaleString(),
      );
    }
  } catch (error) {
    console.error("❌ Failed to check status:", error.message);
  }
}

// Main menu
async function showMenu() {
  console.log("\n📋 Test Menu:");
  console.log("1. Test SSE Verification");
  console.log("2. Check Connection Status");
  console.log("3. Exit");

  const choice = await new Promise((resolve) => {
    rl.question("\nSelect option (1-3): ", resolve);
  });

  switch (choice) {
    case "1":
      await testSseVerification();
      break;
    case "2":
      const email = await new Promise((resolve) => {
        rl.question("Enter email to check: ", resolve);
      });
      await checkConnectionStatus(email);
      await showMenu();
      break;
    case "3":
      console.log("\n👋 Goodbye!");
      rl.close();
      break;
    default:
      console.log("❌ Invalid option");
      await showMenu();
  }
}

// Start the application
if (require.main === module) {
  showMenu().catch(console.error);
}

module.exports = { testSseVerification, checkConnectionStatus };
