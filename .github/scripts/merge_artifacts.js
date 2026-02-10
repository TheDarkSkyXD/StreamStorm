const fs = require('fs');
const path = require('path');
// We need to install js-yaml in the workflow before running this script
const yaml = require('js-yaml');

const artifactsDir = 'artifacts';
const outputDir = 'release-assets';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Map to store yaml files for merging: filename -> [paths]
const yamlFiles = {};
// Set to track copied binaries to avoid duplicates
const processedFiles = new Set();

function processDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            processDir(fullPath);
        } else {
            const filename = entry.name;

            // Check if it's one of the manifest files we want to merge
            if (filename.endsWith('.yml') && (filename.startsWith('latest') || filename.startsWith('builder-debug'))) {
                if (!yamlFiles[filename]) yamlFiles[filename] = [];
                yamlFiles[filename].push(fullPath);
            } else {
                // For binaries and other files, just link/copy them
                // If we encounter the same filename again, we assume it's identical (e.g. from a re-run or overlap)
                // or effectively the same artifact. We skip duplicates to avoid 'file exists' errors or race conditions.
                if (!processedFiles.has(filename)) {
                    fs.copyFileSync(fullPath, path.join(outputDir, filename));
                    processedFiles.add(filename);
                    console.log(`Copied ${filename}`);
                } else {
                    console.log(`Skipping duplicate binary: ${filename}`);
                }
            }
        }
    }
}

console.log('Processing artifacts...');
processDir(artifactsDir);

// Merge YAML manifests
for (const [filename, paths] of Object.entries(yamlFiles)) {
    if (paths.length === 0) continue;

    if (paths.length === 1) {
        fs.copyFileSync(paths[0], path.join(outputDir, filename));
        console.log(`Copied ${filename}`);
        continue;
    }

    console.log(`Merging ${paths.length} versions of ${filename}...`);
    let mergedDoc = null;

    for (const p of paths) {
        try {
            const content = fs.readFileSync(p, 'utf8');
            const doc = yaml.load(content);

            if (!mergedDoc) {
                mergedDoc = doc;
            } else {
                // Merge 'files' array which contains the actual asset info for auto-updater
                if (doc.files && Array.isArray(doc.files)) {
                    if (!mergedDoc.files) mergedDoc.files = [];

                    doc.files.forEach(f => {
                        // Deduplicate based on 'url' (filename)
                        const exists = mergedDoc.files.some(existing => existing.url === f.url);
                        if (!exists) {
                            mergedDoc.files.push(f);
                        }
                    });
                }
                // If releaseDate differs, we keep the one from first file (effectively random or first processed)
            }
        } catch (e) {
            console.error(`Error parsing YAML ${p}:`, e);
        }
    }

    if (mergedDoc) {
        fs.writeFileSync(path.join(outputDir, filename), yaml.dump(mergedDoc));
        console.log(`Created merged ${filename}`);
    }
}
console.log('Artifact processing complete.');
