// scripts/circuit-setup.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

async function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destination);
        https.get(url, response => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }

            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded: ${destination}`);
                resolve();
            });
        }).on('error', error => {
            fs.unlink(destination, () => {}); // Delete the file on error
            reject(error);
        });

        file.on('error', error => {
            fs.unlink(destination, () => {}); // Delete the file on error
            reject(error);
        });
    });
}

async function setupCircuit() {
    try {
        const circuitsDir = path.join(__dirname, '../circuits');
        const buildDir = path.join(circuitsDir, 'build');
        const keysDir = path.join(buildDir, 'keys');
        
        // Create directories if they don't exist
        fs.mkdirSync(buildDir, { recursive: true });
        fs.mkdirSync(keysDir, { recursive: true });

        // Download Powers of Tau file if it doesn't exist
        const ptauPath = path.join(buildDir, 'powersOfTau28_hez_final_10.ptau');
        if (!fs.existsSync(ptauPath)) {
            console.log('Downloading Powers of Tau file...');
            await downloadFile(
                'https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau',
                ptauPath
            );
        }

        // Compile circuit if needed
        const circuitPath = path.join(circuitsDir, 'templates/DeviceAuth.circom');
        if (!fs.existsSync(path.join(buildDir, 'DeviceAuth.r1cs'))) {
            console.log('Compiling circuit...');
            execSync(`circom "${circuitPath}" --r1cs --wasm --sym --c --output "${buildDir}"`, {
                stdio: 'inherit'
            });
        }

        console.log('Circuit setup completed');
        return {
            buildDir,
            keysDir,
            ptauPath,
            circuitPath
        };

    } catch (error) {
        console.error('Circuit setup failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    setupCircuit().catch(console.error);
}

module.exports = setupCircuit;