/**
 * migrate_keys.js
 *
 * Description:
 * This script migrates old keys in user answer JSON files to the new key format based on choise_rand.json.
 * It reads choise_rand.json and all .json files in the answer/ directory, replaces old keys with new keys,
 * and overwrites the original answer files with the updated data.
 *
 * Usage:
 * Ensure Node.js is installed. Navigate to the json directory and run:
 * node migrate_keys.js
 */

const fs = require('fs');
const path = require('path');

// Path to choise_rand.json
const CHOISE_RAND_PATH = path.join(__dirname, 'choise_rand.json');

// Path to answer directory
const ANSWER_DIR = path.join(__dirname, 'answer');

// Function to read and parse JSON file
function readJSON(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error reading or parsing JSON file at ${filePath}:`, err);
        process.exit(1);
    }
}

// Function to write JSON data to file
function writeJSON(filePath, data) {
    try {
        const jsonString = JSON.stringify(data, null, 2); // Pretty print with 2-space indentation
        fs.writeFileSync(filePath, jsonString, 'utf8');
    } catch (err) {
        console.error(`Error writing JSON data to file at ${filePath}:`, err);
        process.exit(1);
    }
}

// Function to get all .json files in a directory
function getJSONFiles(dirPath) {
    try {
        const files = fs.readdirSync(dirPath);
        return files.filter(file => path.extname(file).toLowerCase() === '.json');
    } catch (err) {
        console.error(`Error reading directory at ${dirPath}:`, err);
        process.exit(1);
    }
}

// Function to detect if any old keys exist in the answers
function detectOldKeys(answers, fileToIndexMap) {
    return Object.keys(answers).some(key => {
        return fileToIndexMap.hasOwnProperty(key);
    });
}

// Main migration function
function migrateKeys() {
    console.log('Starting key migration process...');

    // Step 1: Read choise_rand.json
    console.log(`Reading choise_rand.json from ${CHOISE_RAND_PATH}...`);
    const choiseRandData = readJSON(CHOISE_RAND_PATH);

    // Create a mapping from file name to its index in choise_rand.json
    const fileToIndexMap = {};
    const fileToIncrementMap = {};
    choiseRandData.forEach((entry, index) => {
        if (entry.file) {
            if (!fileToIncrementMap.hasOwnProperty(entry.file)) {
                fileToIncrementMap[entry.file] = 0;
            }
            fileToIndexMap[`${entry.file}_${fileToIncrementMap[entry.file]}`] = index;
            fileToIncrementMap[entry.file]++;
        } else {
            console.warn(`Entry at index ${index} in choise_rand.json does not have a 'file' property.`);
        }
    });

    // Step 2: Get all user answer files
    console.log(`Fetching all .json files in the answer directory: ${ANSWER_DIR}...`);
    const answerFiles = getJSONFiles(ANSWER_DIR);
    if (answerFiles.length === 0) {
        console.log('No answer JSON files found. Migration not required.');
        return;
    }
    // Step 3: Iterate through each answer file and migrate keys if necessary
    answerFiles.forEach(file => {
        const filePath = path.join(ANSWER_DIR, file);
        console.log(`\nProcessing answer file: ${filePath}`);

        // Read user answers
        const userAnswers = readJSON(filePath);

        // Check if old keys exist
        const hasOldKeys = detectOldKeys(userAnswers, fileToIndexMap);
        if (!hasOldKeys) {
            console.log('No old keys detected. Skipping migration for this file.');
            return;
        }

        console.log('Old keys detected. Starting migration to new keys...');

        const migratedAnswers = {};

        // Migrate each key
        Object.keys(userAnswers).forEach(oldKey => {
            const [f1, f2, f3, id] = oldKey.split('_');
            if (!f1 || !f2 || !f3 || !id) {
                console.warn(`Invalid key format '${oldKey}'. Skipping this key.`);
                return;
            }

            const newIndex = fileToIndexMap[oldKey];
            if (newIndex === undefined) {
                console.warn(`Index not found for key '${oldKey}'. Skipping this key.`);
                return;
            }
            const newKey = `${f1}_${f2}_${f3}_${newIndex}`;

            // Check if the new key already exists to prevent overwriting
            if (migratedAnswers.hasOwnProperty(newKey)) {
                console.warn(`New key '${newKey}' already exists. Overwriting with the latest value from '${oldKey}'.`);
            }

            // Assign the value to the new key
            migratedAnswers[newKey] = {...userAnswers[oldKey]};
        });


        // Step 4: Overwrite the original answer file with migrated answers
        writeJSON(filePath, migratedAnswers);
        console.log(`Migration completed and file '${filePath}' has been updated with new keys.`);
    });

    console.log('\nKey migration process completed successfully.');

    //    choiseRandDataにあるデータ件数を表示
    console.log(`choiseRandData.length: ${choiseRandData.length}`);
}

// Execute the migration
migrateKeys();