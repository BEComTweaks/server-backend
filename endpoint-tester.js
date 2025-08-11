const axios = require("axios");
const fs = require("fs");
const path = require("path");

// --- Configuration ---

const BASE_URL = "http://localhost:80";
const DOWNLOAD_DIR = path.join(__dirname, "endpoint-tester-downloads"); // Directory to save downloaded files

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR);
}

const UPDATE_SERVER_KEY = JSON.parse(fs.readFileSync(path.join(__dirname, "secretstuff.json"), "utf-8"),).key;

// Array to store test results
const testResults = [];

// Define all your endpoints and their test configurations
// Each `testCases` array defines different scenarios or expected responses for an endpoint
const endpoints = [
  {
    name: "Export Resource Pack",
    path: "/exportResourcePack",
    method: "POST",
    payload: {
      Aesthetic: ["UnbundledHayBales"],
      "More Zombies": [],
      Terrain: [],
      "Lower and Sides": [],
      Variation: [],
      "Peace and Quiet": [],
      Mobs: [],
      Utility: [],
      Directional: [],
      "Growth Stages": [],
      Unobtrusive: [],
      "3D": [],
      GUI: [],
      Fonts: [],
      Crosshairs: [],
      Hearts: [],
      "LGBTQ+ Pride": [],
      "Hunger Bars": [],
      "Hotbar Selector": [],
      "Menu Panoramas": [],
      "Xisuma's Hermitcraft Bases": [],
      Retro: [],
      Fun: [],
      "World of Color": [],
      "Colorful Slime": [],
      Elytra: [],
      "Enchantment Glints": [],
      Parity: [],
      "Fixes and Consistency": [],
      raw: ["UnbundledHayBales"],
    },
    headers: {
      "Content-Type": "application/json",
      packname: "ResourcePack",
      mcversion: "1.21.0",
    },
    testCases: [
      {
        description: "Successful file download",
        responseTypeExpected: "file",
        outputFileName: "resource_pack.mcpack",
        headers: {
          // Headers specific to this test case if different from top-level
          Accept: "application/zip, application/octet-stream",
        },
        expectedStatus: 200,
      },
    ],
  },
  {
    name: "Export Behaviour Pack",
    path: "/exportBehaviourPack",
    method: "POST",
    payload: {
      "Anti Grief": ["AntiGhastGrief"],
      Drops: [],
      Fun: [],
      Utility: [],
      raw: ["AntiGhastGrief"],
    },
    headers: {
      "Content-Type": "application/json",
      packname: "BehaviourPack",
      mcversion: "1.21.0",
    },
    testCases: [
      {
        description: "Successful file download",
        responseTypeExpected: "file",
        outputFileName: "behaviour_pack.mcpack",
        headers: { Accept: "application/zip, application/octet-stream" },
        expectedStatus: 200,
      },
    ],
  },
  {
    name: "Export Crafting Tweak",
    path: "/exportCraftingTweak",
    method: "POST",
    payload: {
      Craftables: [],
      "More Blocks": [],
      "Quality of Life": ["CharcoaltoBlackDye"],
      Unpackables: [],
      raw: ["CharcoaltoBlackDye"],
    },
    headers: {
      "Content-Type": "application/json",
      packname: "CraftingTweaks",
      mcversion: "1.21.0",
    },
    testCases: [
      {
        description: "Successful file download",
        responseTypeExpected: "file",
        outputFileName: "crafting_tweak.mcpack",
        headers: { Accept: "application/zip, application/octet-stream" },
        expectedStatus: 200,
      },
    ],
  },
  {
    name: "Download Totals",
    path: "/downloadTotals", // Base path, query param handled in testCases
    method: "GET",
    testCases: [
      {
        description: "Existing resource type (JSON response)",
        pathOverride: "?type=resource", // Override path for this case
        responseTypeExpected: "json", // Now explicitly expecting JSON
        outputFileName: "downloadTotalsResource.json", // This will still save the raw content
        headers: { Accept: "application/json, text/plain" },
        expectedStatus: 200,
        expectedContentPartial: '"total":',
      },
      {
        description: "Non-existent type",
        pathOverride: "?type=nonExistent",
        responseTypeExpected: "text",
        headers: { Accept: "text/plain" },
        expectedStatus: 404, // Server sends 404 for non-existent resource
        expectedContentPartial: "There is no such file",
        expectedContentExact:
          "There is no such file called downloadTotalsnonExistent.json at the root directory",
      },
      {
        description: "no type",
        pathOverride: "",
        responseTypeExpected: "text",
        headers: { Accept: "text/plain" },
        expectedStatus: 400, // Server sends 400 for bad request
        expectedContentPartial: "You need a specified query.",
        expectedContentExact:
          "You need a specified query. The only query available is `type`.",
      },
    ],
  },
  {
    name: "Update Server",
    path: "/update", // Base path, query param handled in testCases
    method: "POST",
    payload: {}, // No specific payload needed according to your server code
    headers: {
      "Content-Type": "application/json",
    },
    testCases: [
      {
        description: "Correct Key",
        pathOverride: `?key=${UPDATE_SERVER_KEY}`,
        responseTypeExpected: "text", // Server sends formatted text/HTML
        headers: { Accept: "text/html, text/plain" },
        expectedStatus: 200,
        expectedContentPartial: "Update Successful",
      },
      {
        description: "Wrong Key",
        pathOverride: `?key=WRONG_KEY`,
        responseTypeExpected: "text", // Server sends plain text error
        headers: { Accept: "text/plain" },
        expectedStatus: 403, // Server sends 403 for wrong key
        expectedContentPartial: "Wrong key!",
        expectedContentExact: "Wrong key!", // Exact match for this simple error
      },
      {
        description: "No Key",
        responseTypeExpected: "text",
        headers: { Accept: "text/plain" },
        expectedStatus: 400,
        expectedContentPartial: "You need a key to update the server.",
        expectedContentExact: "You need a key to update the server.",
      },
    ],
  },
  {
    name: "Check Online",
    path: "/checkOnline",
    method: "GET",
    testCases: [
      {
        description: "Standard Check Online",
        responseTypeExpected: "text", // Server sends HTML
        headers: { Accept: "text/html" },
        expectedStatus: 200,
        expectedContentPartial: "<h1>Server is online</h1>",
        // Exact match not feasible here due to dynamic git info
      },
    ],
  },
  {
    name: "Ping",
    path: "/ping",
    method: "GET",
    testCases: [
      {
        description: "Basic Ping response",
        responseTypeExpected: "text", // Server sends plain text "Pong!"
        headers: { Accept: "text/plain" },
        expectedStatus: 200,
        expectedContentPartial: "Pong!",
        expectedContentExact: "Pong!", // Exact match for a simple response
      },
    ],
  },
  {
    name: "Splat Redirect",
    path: "/some/random/path", // This should hit the /{*splat} endpoint
    method: "GET",
    testCases: [
      {
        description: "Expected Redirect",
        responseTypeExpected: "redirect", // Custom type for redirects
        headers: { Accept: "text/html" },
        expectedStatus: 302,
        expectedLocation: "https://becomtweaks.github.io",
      },
    ],
  },
];

// --- Request Function ---
async function testEndpoint(endpointConfig) {
  const {
    name,
    path: baseEndpointPath,
    method,
    payload,
    headers: baseHeaders,
    testCases,
  } = endpointConfig;

  console.log(`\n--- Running tests for: ${name} ---`);

  for (const testCase of testCases) {
    const {
      description,
      pathOverride,
      responseTypeExpected,
      outputFileName,
      headers: testCaseHeaders,
      expectedStatus,
      expectedContentPartial, // For text/JSON responses
      expectedContentExact, // NEW: For exact text comparison
      expectedLocation, // For redirects
    } = testCase;

    // Combine base path with path override for this specific test case
    const currentPath = pathOverride
      ? baseEndpointPath + pathOverride
      : baseEndpointPath;
    const fullUrl = `${BASE_URL}${currentPath}`;
    const localFilePath = outputFileName
      ? path.join(DOWNLOAD_DIR, outputFileName)
      : null;

    // Combine base headers with test case specific headers
    const combinedHeaders = { ...baseHeaders, ...testCaseHeaders };

    console.log(`\n  --- Test Case: ${description} ---`);
    console.log(`  URL: ${fullUrl}`);
    console.log(`  Method: ${method}`);
    console.log(`  Headers: ${JSON.stringify(combinedHeaders)}`);
    if (method !== "GET" && payload) {
      console.log(`  Payload: ${JSON.stringify(payload)}`);
    }

    let status = "FAIL";
    let message = "An unexpected error occurred.";
    let receivedStatus = "N/A";
    let receivedDataPreview = ""; // For text/json responses
    let receivedFullContent = ""; // Store full content for exact match

    try {
      const requestOptions = {
        method: method,
        url: fullUrl,
        headers: combinedHeaders,
        data: payload,
        // Set responseType based on expected type for Axios to handle initial parsing
        responseType: responseTypeExpected === "file" ? "stream" : "text",
        maxRedirects: 0, // Prevent axios from following redirects automatically
        // Validate all 2xx statuses, 302, AND 4xx codes
        validateStatus: (status) =>
          (status >= 200 && status < 300) ||
          (status >= 400 && status < 500) ||
          status === 302,
        timeout: 10000, // 10 seconds timeout
      };

      const response = await axios(requestOptions);

      receivedStatus = response.status;
      console.log(`  Status: ${response.status} ${response.statusText}`);
      console.log(`  Response Headers:`, response.headers);

      // Check status code first
      if (response.status !== expectedStatus) {
        status = "FAIL";
        message = `Expected status ${expectedStatus}, but got ${response.status}`;
        if (response.data && typeof response.data.trim === "function") {
          receivedDataPreview = response.data.trim().slice(0, 500);
        } else if (response.data) {
          // For stream data that failed validation earlier, try to consume if possible
          let dataAccumulator = "";
          if (typeof response.data.on === "function") {
            response.data.on("data", (chunk) => (dataAccumulator += chunk.toString()));
            await new Promise((resolve) => response.data.on("end", resolve));
            receivedDataPreview = dataAccumulator.trim().slice(0, 500);
          }
        }
        testResults.push({
          name,
          description,
          status,
          message,
          receivedStatus,
          receivedDataPreview,
          fullUrl,
        });
        continue; // Move to next test case
      }

      // Handle different expected response types
      switch (responseTypeExpected) {
        case "file":
          if (
            response.data &&
            typeof response.data.pipe === "function" &&
            localFilePath
          ) {
            const writer = fs.createWriteStream(localFilePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
              writer.on("finish", () => {
                console.log(`  SUCCESS: File saved to ${localFilePath}`);
                status = "PASS";
                message = `File saved successfully to ${outputFileName}`;
                resolve();
              });
              writer.on("error", (err) => {
                console.error(
                  `  ERROR: Failed to write file to ${localFilePath}:`,
                  err.message,
                );
                status = "FAIL";
                message = `Error writing file: ${err.message}`;
                reject(err);
              });
            });
          } else {
            status = "FAIL";
            message =
              "Expected a file stream but didn't receive one or localFilePath was null.";
            // Try to log unexpected non-stream data if it exists
            if (response.data && typeof response.data.trim === "function") {
              receivedDataPreview = response.data.trim().slice(0, 500);
              message += ` Received data preview: "${receivedDataPreview}"`;
            }
          }
          break;

        case "text":
        case "json": // JSON is typically received as text by axios unless parsed
          receivedFullContent = response.data ? String(response.data).trim() : "";
          receivedDataPreview = receivedFullContent.slice(0, 500);
          console.log(`  Response Data Preview:\n${receivedDataPreview}`);
          if (receivedFullContent.length > 500) {
            console.log("  ...(truncated)");
          }

          let contentMatch = true;
          let contentMessage = "Received expected content.";

          if (responseTypeExpected === "json") {
            try {
              JSON.parse(receivedFullContent);
              contentMessage = "Received valid JSON.";
            } catch (jsonError) {
              contentMatch = false;
              contentMessage = `Invalid JSON received: ${jsonError.message}`;
            }
          }

          // If content is valid JSON (or not expecting JSON), proceed with content checks
          if (contentMatch) {
            // Check for exact match first if specified
            if (expectedContentExact !== undefined) {
              if (receivedFullContent === expectedContentExact) {
                contentMessage = "Received exact content match.";
              } else {
                contentMatch = false;
                contentMessage = `Exact content mismatch. Expected: "${expectedContentExact}", Received: "${receivedFullContent}"`;
              }
            }
            // If no exact match specified or exact match passed, check partial
            else if (expectedContentPartial !== undefined) {
              if (!receivedFullContent.includes(expectedContentPartial)) {
                contentMatch = false;
                contentMessage = `Expected content to include "${expectedContentPartial}" but it did not.`;
              }
            }
          }

          if (contentMatch) {
            status = "PASS";
            message = contentMessage;
          } else {
            status = "FAIL";
            message = contentMessage;
          }
          break;

        case "redirect":
          const receivedLocation = response.headers.location;
          if (response.status === 302 && receivedLocation === expectedLocation) {
            console.log(
              `  SUCCESS: Redirected to expected location: ${receivedLocation}`,
            );
            status = "PASS";
            message = `Successfully redirected to ${expectedLocation}`;
          } else {
            status = "FAIL";
            message = `Expected redirect to ${expectedLocation}, but got ${receivedLocation} (Status: ${response.status})`;
          }
          break;

        default:
          status = "FAIL";
          message = `Unknown responseTypeExpected: ${responseTypeExpected}`;
      }
    } catch (error) {
      status = "FAIL";
      message = `Request error: ${error.message}`;
      if (error.response) {
        receivedStatus = error.response.status;
        message = `Server error: Status ${error.response.status}`;
        if (error.response.data && typeof error.response.data.on === "function") {
          let errorData = "";
          error.response.data.on("data", (chunk) => {
            errorData += chunk.toString();
          });
          await new Promise((resolve) => error.response.data.on("end", resolve));
          receivedFullContent = errorData.trim(); // Store full content for error logging
          receivedDataPreview = receivedFullContent.slice(0, 500);
          message += `. Body: "${receivedDataPreview}"`;
        } else if (error.response.data) {
          receivedFullContent = String(error.response.data).trim(); // Store full content
          receivedDataPreview = receivedFullContent.slice(0, 500);
          message += `. Body: "${receivedDataPreview}"`;
        }
      } else if (error.request) {
        message = "No response received (network error).";
      }
    } finally {
      // Add receivedFullContent to results for debugging exact matches
      testResults.push({
        name,
        description,
        status,
        message,
        receivedStatus,
        receivedDataPreview,
        receivedFullContent: receivedFullContent, // Store full content
        fullUrl,
      });
      console.log(`  Result: ${status} - ${message}`);
    }
  }
}
// --- Main execution loop ---
async function runAllTests() {
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  console.log("\n--- All endpoint tests completed ---");

  // --- Summary ---
  console.log("\n======================================");
  console.log("          TEST SUMMARY");
  console.log("======================================");

  const totalTests = testResults.length;
  const passedTests = testResults.filter((r) => r.status === "PASS").length;
  const failedTests = testResults.filter((r) => r.status === "FAIL").length;

  testResults.forEach((result, index) => {
    console.log(
      `\n${index + 1}. [${result.status}] ${result.name} - ${result.description}`,
    );
    console.log(`   URL: ${result.fullUrl}`);
    console.log(`   Status: ${result.receivedStatus}`);
    console.log(`   Message: ${result.message}`);
    if (result.receivedDataPreview) {
      console.log(`   Data Preview: "${result.receivedDataPreview}"`);
    }
    // Only show full content in summary if it was a text mismatch and not too long
    if (
      result.status === "FAIL" &&
      result.receivedFullContent &&
      result.receivedFullContent.length < 1000 && // Limit length for summary
      (result.message.includes("Exact content mismatch") ||
        result.message.includes("Expected content to include") ||
        result.message.includes("Invalid JSON received"))
    ) {
      console.log(`   Full Received Content: "${result.receivedFullContent}"`);
    }
  });

  console.log("\n======================================");
  console.log(`Total Tests Run: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log("======================================");

  if (failedTests > 0) {
    process.exit(1); // Exit with a non-zero code to indicate failures
  } else {
    process.exit(0); // Exit with zero code on success
  }
}

runAllTests();