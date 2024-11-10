// scripts/compile-circuit.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // Create build directory if it doesn't exist
        const buildDir = path.join(__dirname, '../circuits/build');
        fs.mkdirSync(buildDir, { recursive: true });

        const circuitPath = path.join(__dirname, '../circuits/templates/DeviceAuth.circom');
        
        // Compile the circuit
        console.log('Compiling circuit...');
        execSync(`circom "${circuitPath}" --r1cs --wasm --sym --c --output "${buildDir}"`, {
            stdio: 'inherit'
        });

        // Generate witness generator
        console.log('Setting up witness generator...');
        const wasmDir = path.join(buildDir, 'DeviceAuth_js');
        
        // Verify outputs
        const expectedFiles = [
            path.join(buildDir, 'DeviceAuth.r1cs'),
            path.join(wasmDir, 'DeviceAuth.wasm'),
            path.join(wasmDir, 'witness_calculator.js')
        ];

        expectedFiles.forEach(file => {
            if (!fs.existsSync(file)) {
                throw new Error(`Expected output file not found: ${file}`);
            }
        });

        console.log('Circuit compilation completed successfully');
        
    } catch (error) {
        console.error('Circuit compilation failed:', error);
        process.exit(1);
    }
}

main().catch(console.error);
