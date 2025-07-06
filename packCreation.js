const lodash = require("lodash");
const filesystem = require("fs");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { execSync } = require("child_process");
const { cdir, loadJson, dumpJson } = require("./helperFunctions.js");
function makePackRequest(req, res, type) {
  const packName = req.headers.packname.replace(/[^a-zA-Z0-9\-_]/g, "");
  const selectedPacks = req.body;
  const mcVersion = req.headers.mcversion;
  const zipPath = createPack(selectedPacks, packName, type, mcVersion);

  res.download(zipPath, `${path.basename(zipPath)}`, (err) => {
    if (err) {
      console.error("Error downloading the file:", err);
      try {
        res.status(500).send("Error downloading the file.");
      } catch (e) {
        console.log(e);
      }
    }
    try {
      filesystem.unlinkSync(zipPath);
    } catch (e) {
      console.log(e);
    }
  });

  let downloadTotals ={};
  if (filesystem.existsSync(`downloadTotals${type}.json`))
    downloadTotals = loadJson(`downloadTotals${type}.json`);
  if (!Object.hasOwn(downloadTotals, "total")) {
    downloadTotals["total"] = 0;
  }
  downloadTotals["total"] += 1;
  for (var i in selectedPacks.raw) {
    if (!Object.hasOwn(downloadTotals, selectedPacks.raw[i])) {
      downloadTotals[selectedPacks.raw[i]] = 0;
    }
    downloadTotals[selectedPacks.raw[i]] += 1;
  }
  const sortedDownloadTotals = Object.entries(downloadTotals);
  sortedDownloadTotals.sort((a, b) => b[1] - a[1]);
  const sortedData = Object.fromEntries(sortedDownloadTotals);
  dumpJson(`downloadTotals${type}.json`, sortedData);
}

function zipFolder(directory) {
  execSync(`python ${cdir("base")}/zip.py ${directory}`, { stdio: "inherit" });
  if (directory.endsWith("\\")) {
    directory = directory.slice(0, -1);
  }
}

function lsdir(directory) {
  let folderList = [];

  function traverseDir(currentDir) {
    const entries = filesystem.readdirSync(currentDir, { withFileTypes: true });
    entries.forEach((entry) => {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path
        .relative(directory, fullPath)
        .replace(/\\/g, "/");
      if (entry.isDirectory()) {
        folderList.push(relativePath + "/");
        traverseDir(fullPath);
      } else {
        folderList.push(relativePath);
      }
    });
  }

  traverseDir(directory);
  return folderList;
}


function createPack(selectedPacks, packName, type, mcVersion) {
  let realManifest;
  if (type == "behaviour") {
    realManifest = generateManifest(selectedPacks, packName, type, mcVersion, "bp");
    generateManifest(selectedPacks, packName, type, mcVersion, "rp");
  } else {
    realManifest = generateManifest(selectedPacks, packName, type, mcVersion);
  }
  console.log(`Generated default files for ${packName}`);
  const [fromDir, priorities] = listOfFromDirectories(selectedPacks, type);
  if (process.argv.includes('--dev')) console.log([fromDir, priorities]);
  console.log(`Obtained list of directories and priorities`);
  console.log(
    `Exporting at ${cdir()}${path.sep}${realManifest.header.name}...`,
  );
  addFilesToPack(fromDir, priorities, type == "behaviour", realManifest);
  console.log(`Copied tweaks`);
  console.log(`${realManifest.header.name}.zip 1/2`);
  let extension;
  if (type == "behaviour") {
    // check if pack needs rp
    if (lsdir(`${cdir()}/${realManifest.header.name}/rp`).length > 3) {
      // requires rp
      extension = "mcaddon";
      // 'link' as dependencies
      const bpManifest = loadJson(`${cdir()}/${packName}/bp/manifest.json`);
      const rpManifest = loadJson(`${cdir()}/${packName}/rp/manifest.json`);
      if (bpManifest.dependencies === undefined) {
        bpManifest.dependencies = [];
      }
      if (rpManifest.dependencies === undefined) {
        rpManifest.dependencies = [];
      }
      // add the dependencies to the manifest
      bpManifest.dependencies.push({
        uuid: rpManifest.header.uuid,
        version: [1, 0, 0],
      });
      rpManifest.dependencies.push({
        uuid: bpManifest.header.uuid,
        version: [1, 0, 0],
      });
      dumpJson(`${cdir()}/${packName}/bp/manifest.json`, bpManifest);
      dumpJson(`${cdir()}/${packName}/rp/manifest.json`, rpManifest);
      if (process.argv.includes('--dev')) console.log(bpManifest.dependencies);
      if (process.argv.includes('--dev')) console.log(rpManifest.dependencies);
    } else {
      // does not require rp
      extension = "mcpack";
      filesystem.rmSync(`${cdir()}/${realManifest.header.name}/rp/`, {
        recursive: true,
      });
    }
  } else {
    extension = "mcpack";
  }
  zipFolder(`${cdir()}/${realManifest.header.name}`);
  console.log(`${realManifest.header.name}.${extension} 2/2`);
  filesystem.renameSync(
    `${path.join(cdir(), realManifest.header.name)}.zip`,
    `${path.join(cdir(), realManifest.header.name)}.${extension}`,
  );
  filesystem.rmSync(`${cdir()}/${realManifest.header.name}`, {
    recursive: true,
  });
  console.log(
    `Exported at ${cdir()}${path.sep}${realManifest.header.name}.${extension}`,
  );
  return `${path.join(cdir(), realManifest.header.name)}.${extension}`;
}

function generateManifest(selectedPacks, packName, type, mcVersion, extra_dir = undefined) {
  // generate the manifest
  const regex =
    /^\d\.\d\d$|^\d\.\d\d\.\d$|^\d\.\d\d\.\d\d$|^\d\.\d\d\.\d\d\d$/gm;
  // check if manifest exists in pack alr
  let templateManifest
  if (extra_dir !== undefined) {
    // this means that pack is bp
    templateManifest = loadJson(
      `${cdir(type)}/jsons/${extra_dir}manifest.json`,
    );
  } else {
    templateManifest = loadJson(`${cdir(type)}/jsons/manifest.json`);
  }
  templateManifest.header.name = packName;
  let description = "";
  for (let i in selectedPacks) {
    if (i !== "raw" && selectedPacks[i].length !== 0) {
      description += `\n${i}`;
      selectedPacks[i].forEach((p) => {
        description += `\n\t${p}`;
      });
    }
  }
  templateManifest.header.description = description.slice(1);
  if (regex.test(mcVersion)) {
    let splitMCVersion = [];
    console.log(`min_engine_version set to ${mcVersion}`);
    for (var i = 0; i < 3; i++) {
      if (mcVersion.split(".")[i])
        splitMCVersion[i] = parseInt(mcVersion.split(".")[i]);
      else splitMCVersion[i] = 0;
    }
    templateManifest.header.min_engine_version = splitMCVersion;
  } else templateManifest.header.min_engine_version = [1, 21, 0];
  templateManifest.header.uuid = uuidv4();
  templateManifest.modules[0].uuid = uuidv4();
  let packDir;
  if (extra_dir !== undefined) {
    packDir = `${cdir()}/${packName}/${extra_dir}`;
  } else {
    packDir = `${cdir()}/${templateManifest.header.name}`;
  }
  if (!filesystem.existsSync(packDir)) {
    filesystem.mkdirSync(packDir, { recursive: true });
  }
  //templateManifest.modules[0].description = "The most ass filler description ever";
  dumpJson(`${packDir}/manifest.json`, templateManifest);
  let realManifest = templateManifest;

  // add the pack icon
  filesystem.copyFileSync(
    `${cdir(type)}/pack_icons/pack_icon.png`,
    `${packDir}/pack_icon.png`,
  );
  // add the selected packs for the easy selecting from site
  dumpJson(`${packDir}/selected_packs.json`, selectedPacks);
  return realManifest
}

function listOfFromDirectories(selectedPacks, type) {
  let addedPacks = [];
  let addedPacksPriority = []; // mapped priority of the fromDir
  let fromDir = [];
  let addedCompatibilitiesPacks = []; // doesnt require priority, just exists for checking purposes

  const nameToJson = loadJson(`${cdir(type)}/jsons/map/name_to_json.json`);
  const priorityMap = loadJson(`${cdir(type)}/jsons/map/priority.json`);
  const compatibilities = loadJson(
    `${cdir(type)}/jsons/map/compatibility.json`,
  );
  const comp_file = loadJson(`${cdir(type)}/jsons/packs/compatibilities.json`);
  const max_comps = comp_file["max_simultaneous"];

  for (let n = max_comps; n >= 2; n--) {
    // for the love of god, change the key
    compatibilities[`${n}way`].forEach((compatibility) => {
      // check for compatibilities
      let useThisCompatibility = true;
      compatibility.forEach((packToCheck) => {
        if (
          !selectedPacks.raw.includes(packToCheck) ||
          addedCompatibilitiesPacks.includes(packToCheck)
        ) {
          useThisCompatibility = false;
        }
      });
      if (useThisCompatibility) {
        // get index in defs
        const thisDefinedCompatibility =
          comp_file[`${n}way`][
          compatibilities[`${n}way`].indexOf(compatibility)
          ];
        console.log(thisDefinedCompatibility);
        // check if you should overwrite
        if (thisDefinedCompatibility.overwrite) {
          // ignore adding respective packs
          addedPacks.push(...compatibility);
        }
        addedCompatibilitiesPacks.push(...compatibility);
        addedPacksPriority.push(999); // compatibilities shouldnt be affected by priorities
        fromDir.push(
          `${cdir(type)}/packs/${thisDefinedCompatibility.location}`,
        );
      }
    });
  }

  const categoryKeys = Object.keys(selectedPacks);
  categoryKeys.forEach((category) => {
    if (category === "raw") {
      return;
    } else {
      const currentCategoryJSON = loadJson(
        `${cdir(type)}/jsons/packs/${nameToJson[category]}`,
      );
      let location;
      if (currentCategoryJSON.location === undefined) {
        location = currentCategoryJSON.topic;
        location = location.toLowerCase();
      } else {
        location = currentCategoryJSON.location;
      }
      selectedPacks[category].forEach((pack) => {
        if (addedPacks.includes(pack)) {
          return;
        }
        addedPacks.push(pack);
        fromDir.push(`${cdir(type)}/packs/${location}/${pack}/files`);
        addedPacksPriority.push(priorityMap[pack]);
      });
    }
  });

  return [fromDir, addedPacksPriority];
}

function addFilesToPack(fromDir, priorities, isbehaviour,manifest) {
  var addedFiles, addedFilesPriority;
  if (isbehaviour) {
    addedFiles = [
      "bp/manifest.json",
      "rp/manifest.json",
      "bp/pack_icon.png",
      "rp/pack_icon.png",
    ];
    addedFilesPriority = [1000, 1000, 1000, 1000];
  } else {
    addedFiles = ["manifest.json", "pack_icon.png"];
    addedFilesPriority = [1000, 1000];
  }
  fromDir.forEach((dir, dirIndexed) => {
    const fromDirRecursive = lsdir(dir);
    fromDirRecursive.forEach((item, itemIndexed) => {
      const progress = `${item}`;
      process.stdout.write(
        `\r${progress}${" ".repeat(process.stdout.columns - progress.length)}`,
      );

      // skip the root directory
      if (item === "./") {
        return;
      }
      const targetPath = path.join(cdir(), manifest.header.name, item);
      if (item.endsWith("/")) {
        // create directory if it doesnt exist
        if (!filesystem.existsSync(targetPath)) {
          filesystem.mkdirSync(targetPath, { recursive: true });
        }
      } else {
        // is a file
        if (item.endsWith("manifest.json")) {
          const alreadyExistingJson = loadJson(targetPath);
          const newJson = loadJson(path.join(dir, item));
          // only need modules, dependencies and metadata
          try {
            newJson.modules.forEach((module) => {
              alreadyExistingJson.modules.push(module);
            });
          } catch (error) {
            console.log("No modules found.");
          }
          try {
            if (!Object.hasOwn(alreadyExistingJson, "dependencies")) {
              alreadyExistingJson.dependencies = [];
            }
            newJson.dependencies.forEach((dependency) => {
              alreadyExistingJson.dependencies.push(dependency);
            });
          } catch (error) {
            console.log(`No dependencies found. ${error}`);
          }
          newJson.metadata.authors.forEach((author) => {
            if (!alreadyExistingJson.metadata.authors.includes(author)) {
              alreadyExistingJson.metadata.authors.push(author);
            }
          });
          dumpJson(targetPath, alreadyExistingJson);
        } else if (addedFiles.includes(item)) {
          // already exists
          if (item.endsWith(".json")) {
            // first check if manifest.json
            const alreadyExistingJson = loadJson(targetPath);
            const newJson = loadJson(path.join(dir, item));
            const mergedJson = lodash.merge(newJson, alreadyExistingJson);
            dumpJson(targetPath, mergedJson);
          } else if (
            item.endsWith(".lang") ||
            item.endsWith(".mcfunction") ||
            item.endsWith(".txt") ||
            item.endsWith(".js")
          ) {
            // usually plaintext without needing proper formatting
            const newFileToMerge = filesystem.readFileSync(
              path.join(dir, item),
              "utf-8",
            );
            filesystem.appendFileSync(targetPath, `\n${newFileToMerge}`);
          } else if (
            priorities[dirIndexed] >
            addedFilesPriority[addedFiles.indexOf(item)]
          ) {
            // binary files, usually images
            filesystem.copyFileSync(path.join(dir, item), targetPath);
            addedFilesPriority[addedFiles.indexOf(item)] =
              priorities[dirIndexed];
          }
        } else {
          filesystem.copyFileSync(path.join(dir, item), targetPath);
          priorities.push(priorities[dirIndexed]);
          addedFiles.push(item);
        }
      }
    });
  });
}

module.exports = {
  makePackRequest
}