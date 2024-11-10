// test/experiments.js

const DeviceVerifier = artifacts.require("DeviceVerifier");
const DeviceRegistry = artifacts.require("DeviceRegistry");
const ProofGenerator = require('../scripts/generate-proof');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const circomlibjs = require('circomlibjs');
const snarkjs = require('snarkjs');
const crypto = require('crypto'); // Added this line

contract('PUFZIN Experiments', async (accounts) => {
    let verifier;
    let registry;
    let proofGenerator;
    let poseidon;

    // Experiment parameters
    const deviceCounts = [10, 50, 100]; // Number of devices to test with
    const noiseLevels = [0, 0.01, 0.05, 0.1]; // Noise levels for PUF responses
    const resultsFilePath = path.join(__dirname, '../results/experiment_results.csv');

    before(async () => {
        // Initialize contracts
        verifier = await DeviceVerifier.new();
        registry = await DeviceRegistry.new(accounts[0], verifier.address);
        proofGenerator = new ProofGenerator();

        // Initialize circomlib and poseidon
        poseidon = await circomlibjs.buildPoseidon();

        await proofGenerator.setup();

        // Ensure the results directory exists
        if (!fs.existsSync(path.join(__dirname, '../results'))) {
            fs.mkdirSync(path.join(__dirname, '../results'));
        }

        // Write CSV header
        fs.writeFileSync(resultsFilePath, 'DeviceID,ProofGenTime(ms),VerifyTime(ms),GasUsed,Success,NoiseLevel,Timestamp\n');
    });

    it('should perform experiments', async () => {
        for (const deviceCount of deviceCounts) {
            console.log(`Starting experiments with ${deviceCount} devices...`);

            for (let i = 0; i < deviceCount; i++) {
                for (const noiseLevel of noiseLevels) {
                    // Generate unique deviceId and input
                    const deviceId = (BigInt('0x' + crypto.randomBytes(16).toString('hex'))).toString();
                    const challenge = (BigInt('0x' + crypto.randomBytes(16).toString('hex'))).toString();
                    const response = (BigInt('0x' + crypto.randomBytes(16).toString('hex'))).toString();

                    // Initialize input object
                    const input = {
                        deviceId,
                        challenge,
                        response,
                        expectedHash: null  // We'll set this later
                    };

                    // Add noise to response
                    if (noiseLevel > 0) {
                        input.response = addNoiseToResponse(BigInt(response), noiseLevel).toString();
                    }

                    // Recompute expectedHash after adding noise
                    const hash = poseidon.F.toString(
                        poseidon([
                            BigInt(input.response),
                            BigInt(challenge)
                        ])
                    );
                    input.expectedHash = hash;

                    console.log('Generating proof with inputs:', input);

                    // Measure proof generation time
                    const proofGenStart = performance.now();
                    const result = await proofGenerator.generateProof(input);
                    const proofGenEnd = performance.now();
                    const proofGenTime = proofGenEnd - proofGenStart;

                    if (!result.success) {
                        console.error('Proof generation failed for device:', deviceId);
                        continue;
                    }

                    // Convert deviceId to bytes32
                    const deviceIdHex = web3.utils.padLeft(
                        web3.utils.toBN(result.publicSignals[0]).toString(16),
                        64
                    );
                    const deviceIdBytes32 = '0x' + deviceIdHex;

                    // Register device if not already registered
                    const isRegistered = await registry.isDeviceRegistered(deviceIdBytes32);
                    if (!isRegistered) {
                        await registry.registerDevice(
                            deviceIdBytes32,
                            web3.utils.keccak256("test-pubkey"),
                            "0x00"
                        );
                    }

                    // Format proof and public signals for on-chain verification
                    const proofForContract = {
                        a: [
                            web3.utils.toBN(result.proof.pi_a[0]),
                            web3.utils.toBN(result.proof.pi_a[1])
                        ],
                        b: [
                            [
                                web3.utils.toBN(result.proof.pi_b[0][1]), // Swapped indices
                                web3.utils.toBN(result.proof.pi_b[0][0])
                            ],
                            [
                                web3.utils.toBN(result.proof.pi_b[1][1]), // Swapped indices
                                web3.utils.toBN(result.proof.pi_b[1][0])
                            ]
                        ],
                        c: [
                            web3.utils.toBN(result.proof.pi_c[0]),
                            web3.utils.toBN(result.proof.pi_c[1])
                        ]
                    };

                    const publicSignals = result.publicSignals.map(s => web3.utils.toBN(s));

                    // Measure proof verification time
                    const verifyStart = performance.now();
                    const tx = await registry.authenticate(
                        deviceIdBytes32,
                        proofForContract.a,
                        proofForContract.b,
                        proofForContract.c,
                        publicSignals
                    );
                    const verifyEnd = performance.now();
                    const verifyTime = verifyEnd - verifyStart;

                    // Get gas used
                    const gasUsed = tx.receipt.gasUsed;

                    // Extract the 'AuthenticationAttempt' event
                    const event = tx.logs.find(log => log.event === 'AuthenticationAttempt');
                    const success = event.args.success;

                    // Log results to CSV file
                    const logData = {
                        deviceId,
                        proofGenTime: proofGenTime.toFixed(2),
                        verifyTime: verifyTime.toFixed(2),
                        gasUsed,
                        success,
                        noiseLevel,
                        timestamp: new Date().toISOString()
                    };

                    const logLine = `${logData.deviceId},${logData.proofGenTime},${logData.verifyTime},${logData.gasUsed},${logData.success},${logData.noiseLevel},${logData.timestamp}\n`;

                    fs.appendFileSync(resultsFilePath, logLine);

                    console.log(`Experiment completed for device ${i + 1}/${deviceCount} at noise level ${noiseLevel}`);
                }
            }
        }
    });

    // Helper function to add noise to the response
    function addNoiseToResponse(responseBigInt, noiseLevel) {
        const responseBits = responseBigInt.toString(2).split('');
        const numBitsToFlip = Math.floor(responseBits.length * noiseLevel);

        for (let i = 0; i < numBitsToFlip; i++) {
            const index = Math.floor(Math.random() * responseBits.length);
            responseBits[index] = responseBits[index] === '0' ? '1' : '0';
        }

        return BigInt('0b' + responseBits.join(''));
    }
});
