const filesystem = require("fs");
let currentdir = process.cwd();

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
module.exports = {
  cdir,
  loadJson,
  dumpJson,
};