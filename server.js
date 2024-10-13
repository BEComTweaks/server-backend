const { execSync } = require('child_process');
const requiredPackages = [
    'express',
    'body-parser',
    'fs',
    'path',
    'uuid',
    'cors',
    'https',
    'nodemon'
];

function checkAndInstallPackages(packages) {
    packages.forEach(pkg => {
        try {
            require.resolve(pkg);
            console.log(`${pkg} is already installed.`);
        } catch (e) {
            console.log(`${pkg} is not installed. Installing...`);
            execSync(`npm install ${pkg}`, { stdio: 'inherit' });
        }
    });
}

checkAndInstallPackages(requiredPackages);
if (process.env.npm_lifecycle_script !== 'nodemon') {
    console.warn('Use nodemon to run the server.');
    console.warn('Command: `npx nodemon server.js`');
    process.exit(0);
}
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const https = require('https');
const httpsPort = 443;
const httpPort = 80;
const funnyurl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
try {
    const privateKey = fs.readFileSync('private.key', 'utf8');
    const certificate = fs.readFileSync('certificate.crt', 'utf8');
    const ca = fs.readFileSync('ca_bundle.crt', 'utf8');
    const credentials = { key: privateKey, cert: certificate, ca: ca };
    const httpsApp = express();
    const httpsServer = https.createServer(credentials, httpsApp);
    httpsServer.listen(httpsPort, () => {
        console.log(`Https server is running at https://localhost:${httpsPort}`);
    });
    httpsApp.use(cors());
    httpsApp.use(bodyParser.json());

    httpsApp.post('/exportResourcePack', (req, res) => {
        makePackRequest(req, res, 'resource')
    });
    httpsApp.post('/exportBehaviourPack', (req, res) => {
        makePackRequest(req, res, 'behaviour')
    });
    httpsApp.post('/exportCraftingTweak', (req, res) => {
        makePackRequest(req, res, 'crafting')
    });
    httpsApp.get('*', (req, res) => {
        res.redirect(funnyurl);
        console.log("Someone accesssed the IP. Rickrolled them instead.")
    });
    
    httpsApp.post('', (req, res) => {
        res.redirect(funnyurl);
        console.log("Rick Roll attempt, but POST request meant they know what they are doing.")
    });
    httpsApp.post('/update', (req, res) => {
        const key = req.query.key;
        if (!key) {
            return res.status(400).send('Missing key parameter.');
        }
        if (!fs.existsSync(secretStuffPath)) {
            const newkey = uuidv4();
            const secretStuff = { key: newkey };
            dumpJson(secretStuffPath, secretStuff);
            return res.status(500).send('Secret stuff file not found. Made a new one.');
        }
        const secretStuff = loadJson(secretStuffPath);
        const storedkey = secretStuff.key;
        if (key === storedkey) {
            console.log('Pulling from git...');
            execSync('git pull');
            console.log('Pulled from git.');
            console.log('Updating Submodules')
            execSync('git submodule update')
            console.log('Updated Submodules')
            return res.status(200).send('Pulled from git.');
        } else {
            console.log("Someone tried to bruteforce the key.");
            console.log(storedkey, secretStuffPath);
            return res.status(401).send("Invalid key. Don't try to bruteforce it.");
        }
    });
}
catch (e) {
    console.log(`error with https\n ${e}`);
}

const httpApp = express();

httpApp.use(cors());
httpApp.use(bodyParser.json());

let currentdir = process.cwd();
function cdir(type) {
    if (type == 'resource') return currentdir + '/resource-packs';
    else if (type == 'behaviour') return currentdir + '/behaviour-packs';
    else if (type == 'crafting') return currentdir + '/crafting-tweaks'
    else return currentdir + '/makePacks'
}

const secretStuffPath = path.join(currentdir,'secretstuff.json');

function lsdir(directory) {
    let folderList = [];

    function traverseDir(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        entries.forEach(entry => {
            const fullPath = path.join(currentDir, entry.name);
            const relativePath = path.relative(directory, fullPath).replace(/\\/g, '/');
            if (entry.isDirectory()) {
                folderList.push(relativePath + '/');
                traverseDir(fullPath);
            } else {
                folderList.push(relativePath);
            }
        });
    }

    traverseDir(directory);
    return folderList;
}

let mf = loadJson(`${cdir('resource')}/jsons/others/manifest.json`);
function manifestGenerator(selectedPacks, packName, type, mcVersion) {
    const regex = /^\d\.\d\d$|^\d\.\d\d\.\d$|^\d\.\d\d\.\d\d$|^\d\.\d\d\.\d\d\d$/gm;
    mf = loadJson(`${cdir(type)}/jsons/others/manifest.json`);
    mf.header.name = packName
    let description = "";
    for (let i in selectedPacks) {
        if (i !== "raw" && selectedPacks[i]["packs"].length !== 0) {
            description += `\n${i}`;
            selectedPacks[i].packs.forEach(p => {
                description += `\n\t${p}`;
            });
        }
    }
    mf.header.description = description.slice(1);
    if (regex.test(mcVersion)) {
        let splitMCVersion = []
        console.log(`min_engine_version set to ${mcVersion.split(".")[1]}`)
        for (var i = 0; i < 3; i++) {
            if (mcVersion.split(".")[i]) splitMCVersion[i] = parseInt(mcVersion.split(".")[i])
            else splitMCVersion[i] = 0
        }
        mf.header.min_engine_version = (splitMCVersion)
    }
    else mf.header.min_engine_version = [1, 21, 0]
    mf.header.uuid = uuidv4();
    mf.modules[0].uuid = uuidv4();
    const packDir = `${cdir()}/${mf.header.name}`;
    if (!fs.existsSync(packDir)) {
        fs.mkdirSync(packDir, { recursive: true });
    }
    dumpJson(`${packDir}/manifest.json`, mf);
    fs.copyFileSync(`${cdir(type)}/pack_icons/pack_icon.png`, `${packDir}/pack_icon.png`);
}

function listOfFromDirectories(selectedPacks, type) {
    selPacks = selectedPacks;
    let addedPacks = [];
    let fromDir = [];

    for (let category in selPacks) {
        if (category !== "raw") {
            const nameToJson = loadJson(`${cdir(type)}/jsons/others/name_to_json.json`);
            const ctopic = loadJson(`${cdir(type)}/jsons/packs/${nameToJson[category]}`);
            selPacks[category].packs.forEach((pack, index) => {
                let compatible = false;
                if (addedPacks.includes(ctopic.packs[selPacks[category].index[index]].pack_id)) {
                    compatible = true;
                }
                if (!compatible) {
                    ctopic.packs[selPacks[category].index[index]].compatibility.forEach(k => {
                        if (selPacks.raw && selPacks.raw.includes(k)) {
                            fromDir.push(`${cdir(type)}/packs/${category.toLowerCase()}/${pack}/${k}`);
                            addedPacks.push(pack, k);
                            compatible = true;
                        }
                    });
                }
                if (!compatible) {
                    fromDir.push(`${cdir(type)}/packs/${category.toLowerCase()}/${pack}/default`);
                    addedPacks.push(pack);
                }
            });
        }
    }
    return fromDir;
}

function mainCopyFile(fromDir) {
    const fromListDir = lsdir(fromDir);
    const toDir = `${cdir()}/${mf.header.name}`;
    const toListDir = lsdir(toDir);

    fromListDir.forEach((item, index) => {
        const progress = `${fromDir.split('/').slice(-2, -1)[0]} ${index + 1}/${fromListDir.length}`;
        process.stdout.write(`\r${progress}${' '.repeat(process.stdout.columns - progress.length)}`);

        if (item === './') {
            return;
        }
        const targetPath = path.join(toDir, item);
        if (item.endsWith('/')) {
            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath);
            }
        } else {
            if (toListDir.includes(item)) {
                if (item.endsWith('.json')) {
                    const toJson = loadJson(targetPath);
                    const fromJson = loadJson(path.join(fromDir, item));
                    const mergedJson = deepMerge(toJson, fromJson);
                    dumpJson(targetPath, mergedJson);
                } else if (item.endsWith('.lang')) {
                    const fromLang = fs.readFileSync(path.join(fromDir, item), 'utf-8');
                    fs.appendFileSync(targetPath, `\n${fromLang}`);
                }
            } else {
                fs.copyFileSync(path.join(fromDir, item), targetPath);
            }
        }
    });
}

function deepMerge(target, source) {
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) {
                target[key] = {};
            }
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

function exportPack(selectedPacks, packName, type, mcVersion) {
    manifestGenerator(selectedPacks, packName, type, mcVersion);
    const fromDir = listOfFromDirectories(selectedPacks, type);
    console.log(`Exporting at ${cdir()}${path.sep}${mf.header.name}...`);
    fromDir.forEach(from => mainCopyFile(from));
    const targetPackDir = `${cdir()}/${mf.header.name}`;
    console.log(`selected_packs.json 1/1`);
    fs.writeFileSync(path.join(targetPackDir, 'selected_packs.json'), JSON.stringify(selectedPacks))
    console.log(`${mf.header.name}.zip 1/2`);
    let command;
    if (process.platform === "win32") {
        command = `cd ${cdir()} && powershell Compress-Archive -Path "${mf.header.name}" -DestinationPath "${mf.header.name}.zip"`;
    } else {
        command = `cd "${cdir()}";zip -r "${mf.header.name}.zip" "${mf.header.name}"`;
    }
    execSync(command);
    console.log(`${mf.header.name}.mcpack 2/2`);
    fs.renameSync(`${path.join(cdir(), mf.header.name)}.zip`, `${path.join(cdir(), mf.header.name)}.mcpack`);
    fs.rmSync(targetPackDir, { recursive: true });
    console.log(`Exported at ${cdir()}${path.sep}${mf.header.name}.mcpack`);
    return `${path.join(cdir(), mf.header.name)}.mcpack`;
}

function loadJson(path) {
    try {
        return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (error) {
        console.log(error.stack, "yellow");
        process.exit(1);
    }
}

function dumpJson(path, dictionary) {
    const data = JSON.stringify(dictionary);
    fs.writeFileSync(path, data, "utf-8");
}

httpApp.listen(httpPort, () => {
    console.log(`Http server is running at http://localhost:${httpPort}`);
});

httpApp.post('/exportResourcePack', (req, res) => {
    makePackRequest(req, res, 'resource')

});
httpApp.post('/exportBehaviourPack', (req, res) => {
    makePackRequest(req, res, 'behaviour')

});
httpApp.post('/exportCraftingTweak', (req, res) => {
    makePackRequest(req, res, 'crafting')
});

httpApp.get('*', (req, res) => {
    res.redirect(funnyurl);
    console.log("Someone accesssed the IP. Rickrolled them instead.")
});

httpApp.post('', (req, res) => {
    res.redirect(funnyurl);
    console.log("Rick Roll attempt, but POST request meant they know what they are doing.")
});

httpApp.post('/update', (req, res) => {
    res.send("Lazy ass, just do it yourself");
    console.log("Hey lazy ass, over here, just press `Ctrl + C` then `git pull`, why the extra steps?")
});

function makePackRequest(req, res, type) {
    const packName = req.headers.packname
    const selectedPacks = req.body;
    const mcVersion = req.headers.mcversion
    const zipPath = exportPack(selectedPacks, packName, type, mcVersion);

    res.download(zipPath, `${path.basename(zipPath)}`, err => {
        if (err) {
            console.error('Error downloading the file:', err);
            try { res.status(500).send('Error downloading the file.'); }
            catch (e) { console.log(e) }
        }
        try { fs.unlinkSync(zipPath); }
        catch (e) { console.log(e) }
    });

    let downloadTotals = JSON.parse('{}')
    if (fs.existsSync(`downloadTotals${type}.json`)) downloadTotals = loadJson(`downloadTotals${type}.json`)
    if (!downloadTotals.hasOwnProperty('total')) {
        downloadTotals['total'] = 0
    }
    downloadTotals['total'] += 1
    for (var i in selectedPacks.raw) {
        if (!downloadTotals.hasOwnProperty(selectedPacks.raw[i])) {
            downloadTotals[selectedPacks.raw[i]] = 0
        }
        downloadTotals[selectedPacks.raw[i]] += 1
    }
    const sortedDownloadTotals = Object.entries(downloadTotals);
    sortedDownloadTotals.sort((a, b) => b[1] - a[1]);
    const sortedData = Object.fromEntries(sortedDownloadTotals);
    dumpJson(`downloadTotals${type}.json`, sortedData)
}