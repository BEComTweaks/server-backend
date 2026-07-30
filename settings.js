const filesystem = require("fs");
const path = require("path");

const settingsPath = path.join(__dirname, "settings.json");

const defaultSettings = {
  httpPorts: [80, 8080, 8000],
  httpsPorts: [443, 8443, 8444],
  noRebuild: false,
  venv: null,
  noFormat: false,
  dev: false,
  exitOnUpdate: false
};

function loadSettings() {
  let fileSettings = {};
  if (filesystem.existsSync(settingsPath)) {
    try {
      fileSettings = JSON.parse(filesystem.readFileSync(settingsPath, "utf8"));
      if (!fileSettings || typeof fileSettings !== "object" || Array.isArray(fileSettings)) {
        throw new Error("settings must contain a JSON object");
      }
    } catch (e) {
      console.warn(`Could not parse ${settingsPath}: ${e.message}. Falling back to default settings.`);
      fileSettings = {};
    }
  } else {
    try {
      filesystem.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), "utf8");
      console.log(`Generated default settings file at ${settingsPath}`);
    } catch (e) {
      console.warn(`Could not create ${settingsPath}: ${e.message}`);
    }
  }

  const args = process.argv.slice(2);
  const cliFlags = {};
  if (args.includes("--no-rebuild")) cliFlags.noRebuild = true;
  if (args.includes("--no-format")) cliFlags.noFormat = true;
  if (args.includes("--dev")) cliFlags.dev = true;
  if (args.includes("--exit-on-update")) cliFlags.exitOnUpdate = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--venv" && i + 1 < args.length) {
      cliFlags.venv = args[i + 1];
      break;
    }
  }

  const settings = { ...defaultSettings, ...fileSettings, ...cliFlags };
  if (!Array.isArray(settings.httpPorts) || settings.httpPorts.length === 0) {
    settings.httpPorts = defaultSettings.httpPorts;
  }
  if (!Array.isArray(settings.httpsPorts) || settings.httpsPorts.length === 0) {
    settings.httpsPorts = defaultSettings.httpsPorts;
  }
  return settings;
}

module.exports = {
  loadSettings
};
