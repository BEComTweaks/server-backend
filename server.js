const { execSync } = require('child_process');
const requiredPackages = [
    'express',
    'body-parser',
    'fs',
    'path',
    'uuid',
    'cors',
    'https'
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
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const https = require('https');
const httpsPort = 443;
const httpPort = 80;
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
        const packName = req.headers.packname
        const selectedPacks = req.body;
        const zipPath = exportPack(selectedPacks, packName, 'resource');
    
        res.download(zipPath, `${path.basename(zipPath)}`, err => {
            if (err) {
                console.error('Error downloading the file:', err);
                res.status(500).send('Error downloading the file.');
            }
            fs.unlinkSync(zipPath);
        });
    });
    httpsApp.post('/exportBehaviourPack', (req, res) => {
        const packName = req.headers.packname
        const selectedPacks = req.body;
        const zipPath = exportPack(selectedPacks, packName, 'behaviour');
    
        res.download(zipPath, `${path.basename(zipPath)}`, err => {
            if (err) {
                console.error('Error downloading the file:', err);
                res.status(500).send('Error downloading the file.');
            }
            fs.unlinkSync(zipPath);
        });
    });
    httpsApp.post('/exportCraftingTweak', (req, res) => {
        const packName = req.headers.packname
        const selectedPacks = req.body;
        const zipPath = exportPack(selectedPacks, packName, 'crafting');
    
        res.download(zipPath, `${path.basename(zipPath)}`, err => {
            if (err) {
                console.error('Error downloading the file:', err);
                res.status(500).send('Error downloading the file.');
            }
            fs.unlinkSync(zipPath);
        });
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
    else return currentdir+'/makePacks'
}


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
function manifestGenerator(selectedPacks, packName, type) {
    mf = loadJson(`${cdir(type)}/jsons/others/manifest.json`);
    mf.header.name = packName
    let description = "";
    for (let i in selectedPacks) {
        if (i !== "raw") {
            description += `\n${i}`;
            selectedPacks[i].packs.forEach(p => {
                description += `\n\t${p}`;
            });
        }
    }
    mf.header.description = description.slice(1);
    mf.header.uuid = uuidv4();
    mf.modules[0].uuid = uuidv4();
    const packDir = `${cdir()}/${mf.header.name}`;
    if (!fs.existsSync(packDir)) {
        fs.mkdirSync(packDir);
    }
    dumpJson(`${packDir}/manifest.json`, mf);
    fs.copyFileSync(`${cdir(type)}/pack_icons/template_82x.png`, `${packDir}/pack_icon.png`);
}

function listOfFromDirectories(selectedPacks, type) {
    selPacks = selectedPacks;
    let addedPacks = [];
    let fromDir = [];

    for (let category in selPacks) {
        if (category !== "raw") {
            const ctopic = loadJson(`${cdir(type)}/jsons/packs/${category.replace(' ', '_').replace(' ', '_').toLowerCase()}.json`);
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
                    Object.assign(toJson, fromJson);
                    dumpJson(targetPath, toJson);
                } else if (item.endsWith('.lang')) {
                    const fromLang = fs.readFileSync(path.join(fromDir, item), 'utf-8');
                    fs.appendFileSync(targetPath, `\n${fromLang}`);
                } else {
                    throw new Error(`${path.join(fromDir, item)} cannot be copied to ${targetPath} as it cannot be merged`);
                }
            } else {
                fs.copyFileSync(path.join(fromDir, item), targetPath);
            }
        }
    });
}

function exportPack(selectedPacks, packName, type) {
    console.log(type)
    manifestGenerator(selectedPacks, packName, type);
    const fromDir = listOfFromDirectories(selectedPacks, type);
    console.log(`Exporting at ${cdir()}${path.sep}${mf.header.name}...`);
    fromDir.forEach(from => mainCopyFile(from));
    const targetPackDir = `${cdir()}/${mf.header.name}`;
    console.log(`selected_packs.json 1/1`);
    fs.writeFileSync(path.join(targetPackDir, 'selected_packs.json'), JSON.stringify(selectedPacks))
    console.log(`${mf.header.name}.zip 1/2`);
    let command;
    if (process.platform === "win32") {
        command = `cd ${cdir()} && powershell Compress-Archive -Path ${mf.header.name} -DestinationPath ${mf.header.name}.zip`;
    } else {
        command = `cd "${cdir()}";zip -r "${mf.header.name}.zip" "${mf.header.name}"`;
    }
    execSync(command);
    console.log(`${mf.header.name}.mcpack 2/2`);
    fs.renameSync(`${path.join(cdir(), mf.header.name)}.zip`, `${path.join(cdir(), mf.header.name)}.mcpack`);
    fs.rmSync(targetPackDir, { recursive: true });
    console.log(`Finished exporting the pack!`);
    console.log("It is now available at", `${path.sep}${mf.header.name}.mcpack`);
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
    const packName = req.headers.packname
    const selectedPacks = req.body;
    const zipPath = exportPack(selectedPacks, packName, 'resource');

    res.download(zipPath, `${path.basename(zipPath)}`, err => {
        if (err) {
            console.error('Error downloading the file:', err);
            res.status(500).send('Error downloading the file.');
        }
        fs.unlinkSync(zipPath);
    });
});
httpApp.post('/exportBehaviourPack', (req, res) => {
    const packName = req.headers.packname
    const selectedPacks = req.body;
    const zipPath = exportPack(selectedPacks, packName, 'behaviour');

    res.download(zipPath, `${path.basename(zipPath)}`, err => {
        if (err) {
            console.error('Error downloading the file:', err);
            res.status(500).send('Error downloading the file.');
        }
        fs.unlinkSync(zipPath);
    });
});
httpApp.post('/exportCraftingTweak', (req, res) => {
    const packName = req.headers.packname
    const selectedPacks = req.body;
    const zipPath = exportPack(selectedPacks, packName, 'crafting');

    res.download(zipPath, `${path.basename(zipPath)}`, err => {
        if (err) {
            console.error('Error downloading the file:', err);
            res.status(500).send('Error downloading the file.');
        }
        fs.unlinkSync(zipPath);
    });
});