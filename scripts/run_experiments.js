// scripts/run_experiments.js

const DeviceVerifier = artifacts.require("DeviceVerifier");
const DeviceRegistry = artifacts.require("DeviceRegistry");
const ProofGenerator = require('../scripts/generate-proof');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const circomlibjs = require('circomlibjs');
const crypto = require('crypto');

class ProofCache {
    constructor(timeoutMs = 300000) { // 5-minute cache timeout
        this.cache = new Map();
        this.timeout = timeoutMs;
    }

    getKey(deviceId, challenge) {
        return `${deviceId}-${challenge}`;
    }

    set(deviceId, challenge, proof, publicSignals) {
        const key = this.getKey(deviceId, challenge);
        this.cache.set(key, {
            proof,
            publicSignals,
            timestamp: Date.now()
        });
    }

    get(deviceId, challenge) {
        const key = this.getKey(deviceId, challenge);
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > this.timeout) {
            this.cache.delete(key);
            return null;
        }

        return entry;
    }
}

module.exports = async function(callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        let verifier;
        let registry;
        let proofGenerator;
        let poseidon;

        // Experiment parameters
        const deviceCount = 10;  // Number of devices per noise level
        const noiseLevels = [0, 0.01, 0.05, 0.1];
        const resultsDir = path.join(__dirname, '../results');
        const resultsFiles = {
            performance: path.join(resultsDir, 'performance_results.csv'),
            reliability: path.join(resultsDir, 'reliability_results.csv'),
            memory: path.join(resultsDir, 'memory_results.csv'),
            transactions: path.join(resultsDir, 'transaction_results.csv')
        };

        // Initialize contracts and dependencies
        verifier = await DeviceVerifier.new();
        registry = await DeviceRegistry.new(accounts[0], verifier.address);
        proofGenerator = new ProofGenerator();
        poseidon = await circomlibjs.buildPoseidon();
        await proofGenerator.setup();

        // Initialize proof cache
        const proofCache = new ProofCache();

        // Ensure results directory exists
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir);
        }

        // Initialize results files with headers
        fs.writeFileSync(resultsFiles.performance,
            'Timestamp,DeviceID,NoiseLevel,ProofGenTime,VerifyTime,GasUsed,TotalTime\n');
        fs.writeFileSync(resultsFiles.reliability,
            'Timestamp,DeviceID,NoiseLevel,Success,ErrorType\n');
        fs.writeFileSync(resultsFiles.memory,
            'Timestamp,DeviceID,HeapUsed,HeapTotal,External,ArrayBuffers\n');
        fs.writeFileSync(resultsFiles.transactions,
            'Timestamp,DeviceID,NoiseLevel,TransactionTime,ProofTime,EncryptionTime,GasUsed\n');

        // Helper function to properly format deviceId
        const formatDeviceId = (deviceId) => {
            let hexString = deviceId.startsWith('0x') ? deviceId.slice(2) : deviceId;
            hexString = hexString.padStart(64, '0');
            return '0x' + hexString;
        };

        // Helper function to generate device input
        const generateDeviceInput = () => {
            const deviceId = '0x' + crypto.randomBytes(16).toString('hex');
            const challenge = '0x' + crypto.randomBytes(32).toString('hex');
            const response = '0x' + crypto.randomBytes(32).toString('hex');

            return { deviceId, challenge, response };
        };

        // Helper function to add noise to response
        const addNoiseToResponse = (response, noiseLevel) => {
            const responseBigInt = BigInt(response);
            const responseBits = responseBigInt.toString(2).split('');
            const numBitsToFlip = Math.floor(responseBits.length * noiseLevel);

            for (let i = 0; i < numBitsToFlip; i++) {
                const index = Math.floor(Math.random() * responseBits.length);
                responseBits[index] = responseBits[index] === '0' ? '1' : '0';
            }

            return '0x' + BigInt('0b' + responseBits.join('')).toString(16);
        };

        // Function to simulate encrypted data
        const generateEncryptedData = (data) => {
            // In a real implementation, this would use the recipient's public key
            return web3.utils.soliditySha3(data);
        };

        // Helper function to log memory usage
        const logMemoryUsage = (deviceId) => {
            const usage = process.memoryUsage();
            fs.appendFileSync(resultsFiles.memory,
                `${new Date().toISOString()},${deviceId},${usage.heapUsed},${usage.heapTotal},${usage.external},${usage.arrayBuffers}\n`);
        };

        console.log('Starting experiments...');

        for (const noiseLevel of noiseLevels) {
            console.log(`Testing with noise level: ${noiseLevel}`);

            for (let i = 0; i < deviceCount; i++) {
                try {
                    const experimentStart = performance.now();
                    const input = generateDeviceInput();

                    // Try to get proof from cache
                    let cacheEntry = proofCache.get(input.deviceId, input.challenge);
                    let result;
                    let proofGenTime = 0;

                    if (cacheEntry) {
                        // Proof is cached
                        result = {
                            proof: cacheEntry.proof,
                            publicSignals: cacheEntry.publicSignals
                        };
                    } else {
                        // Add noise if specified
                        if (noiseLevel > 0) {
                            input.response = addNoiseToResponse(input.response, noiseLevel);
                        }

                        // Calculate expected hash
                        const hash = poseidon.F.toString(
                            poseidon([
                                BigInt(input.response),
                                BigInt(input.challenge)
                            ])
                        );
                        input.expectedHash = hash;

                        console.log(`Processing device ${i + 1}/${deviceCount} with noise level ${noiseLevel}`);

                        // Generate proof and measure time
                        const proofStartTime = performance.now();
                        result = await proofGenerator.generateProof(input);
                        proofGenTime = performance.now() - proofStartTime;

                        // Cache the proof
                        proofCache.set(input.deviceId, input.challenge, result.proof, result.publicSignals);
                    }

                    // Format deviceId and register device
                    const deviceIdBytes32 = formatDeviceId(input.deviceId);
                    await registry.registerDevice(
                        deviceIdBytes32,
                        web3.utils.keccak256("test-pubkey"),
                        "0x00",
                        { from: accounts[0] }
                    );

                    // Format proof for contract
                    const proofForContract = {
                        a: [result.proof.pi_a[0], result.proof.pi_a[1]],
                        b: [
                            [result.proof.pi_b[0][1], result.proof.pi_b[0][0]],
                            [result.proof.pi_b[1][1], result.proof.pi_b[1][0]]
                        ],
                        c: [result.proof.pi_c[0], result.proof.pi_c[1]]
                    };

                    // Verify proof and measure time
                    const verifyStartTime = performance.now();
                    const tx = await registry.authenticate(
                        deviceIdBytes32,
                        proofForContract.a,
                        proofForContract.b,
                        proofForContract.c,
                        result.publicSignals,
                        { from: accounts[0] }
                    );
                    const verifyTime = performance.now() - verifyStartTime;

                    // Get authentication result
                    const authEvent = tx.logs.find(log => log.event === 'AuthenticationAttempt');
                    const success = authEvent.args.success;

                    // Proceed to record transaction
                    const txData = "Test transaction data";
                    const encryptStartTime = performance.now();
                    const encryptedData = generateEncryptedData(txData);
                    const dataHash = web3.utils.soliditySha3(txData);
                    const encryptTime = performance.now() - encryptStartTime;

                    const txStartTime = performance.now();
                    const txResult = await registry.recordTransaction(
                        deviceIdBytes32,
                        dataHash,
                        encryptedData,
                        proofForContract.a,
                        proofForContract.b,
                        proofForContract.c,
                        result.publicSignals,
                        { from: accounts[0] }
                    );
                    const txTime = performance.now() - txStartTime;

                    // Log transaction results
                    fs.appendFileSync(resultsFiles.transactions,
                        `${new Date().toISOString()},${input.deviceId},${noiseLevel},${txTime},` +
                        `${proofGenTime},${encryptTime},${txResult.receipt.gasUsed}\n`);

                    // Calculate total time
                    const totalTime = performance.now() - experimentStart;

                    // Log performance results
                    fs.appendFileSync(resultsFiles.performance,
                        `${new Date().toISOString()},${input.deviceId},${noiseLevel},${proofGenTime},${verifyTime},${tx.receipt.gasUsed},${totalTime}\n`);

                    // Log reliability results
                    fs.appendFileSync(resultsFiles.reliability,
                        `${new Date().toISOString()},${input.deviceId},${noiseLevel},${success},none\n`);

                    // Log memory usage
                    logMemoryUsage(input.deviceId);

                    // Add delay between operations
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (error) {
                    console.error(`Error in device ${i} with noise ${noiseLevel}:`, error.message);
                    fs.appendFileSync(resultsFiles.reliability,
                        `${new Date().toISOString()},${i},${noiseLevel},false,${error.message}\n`);
                }
            }
        }

        console.log('Experiments completed successfully.');
        console.log('Results saved in:', resultsDir);

        callback();
    } catch (error) {
        console.error('Fatal error during experiments:', error);
        callback(error);
    }
};
