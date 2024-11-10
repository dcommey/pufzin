// scripts/generate-proof.js

const path = require('path');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

class ProofGenerator {
    constructor() {
        const circuitsDir = path.join(__dirname, '../circuits');
        this.buildDir = path.join(circuitsDir, 'build');

        // Set up file paths
        this.wasmPath = path.join(this.buildDir, 'DeviceAuth_js/DeviceAuth.wasm');
        this.zkeyPath = path.join(this.buildDir, 'circuit_final.zkey');
        this.proofPath = path.join(this.buildDir, 'proof.json');
        this.publicPath = path.join(this.buildDir, 'public.json');
        this.witnessPath = path.join(this.buildDir, 'witness.wtns');
        this.inputPath = path.join(this.buildDir, 'input.json');
    }

    async setup() {
        // Assume setup is complete
    }

    async generateProof(inputs) {
        try {
            console.log('Generating proof with inputs:', inputs);

            // Save inputs to file
            await fs.promises.writeFile(
                this.inputPath,
                JSON.stringify(inputs, null, 2)
            );

            // Generate witness
            console.log('Calculating witness...');
            const witnessCommand = `snarkjs wtns calculate "${this.wasmPath}" "${this.inputPath}" "${this.witnessPath}"`;
            await exec(witnessCommand);

            // Generate proof
            console.log('Generating proof...');
            const proofCommand = `snarkjs groth16 prove "${this.zkeyPath}" "${this.witnessPath}" "${this.proofPath}" "${this.publicPath}"`;
            await exec(proofCommand);

            // Read the generated proof and public signals
            const proof = JSON.parse(await fs.promises.readFile(this.proofPath, 'utf8'));
            const publicSignals = JSON.parse(await fs.promises.readFile(this.publicPath, 'utf8'));

            // Return the proof and public signals
            return {
                success: true,
                proof: proof,
                publicSignals: publicSignals
            };
        } catch (error) {
            console.error('Proof generation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = ProofGenerator;
