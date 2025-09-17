const filesystem = require("fs");
let currentdir = process.cwd();
const { execSync } = require("child_process");

function cdir(type) {
  if (type == "resource") return currentdir + "/resource-packs";
  else if (type == "behaviour") return currentdir + "/behaviour-packs";
  else if (type == "crafting") return currentdir + "/crafting-tweaks";
  else if (type == "base") return currentdir;
  else return currentdir + "/makePacks";
}
function loadJson(path) {
  try {
    return JSON.parse(filesystem.readFileSync(path, "utf8"));
  } catch (error) {
    console.log(error.stack);
    process.exit(1);
  }
}

function dumpJson(path, dictionary) {
  const data = JSON.stringify(dictionary, null, 4);
  filesystem.writeFileSync(path, data, "utf-8");
}

function isBashInstalled() {
  try {
    // Try a simple bash command that would fail if bash isn't working
    execSync("bash -c 'echo test'", { stdio: "pipe", encoding: "utf8" });
    return true;
  } catch (error) {
    return false;
  }
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (input) {
    var random = Math.floor(Math.random() * 16);
    if (input == "x") value = random; // Use the random value directly for 'x'
    if (input == "y") value = (random % 4) + 8; // Ensure 'y' is one of 8, 9, A, or B
    return value.toString(16);
  });
}

module.exports = {
  cdir,
  loadJson,
  dumpJson,
  isBashInstalled,
  uuidv4,
};