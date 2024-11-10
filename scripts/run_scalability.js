// scripts/run_scalability.js

const DeviceVerifier = artifacts.require("DeviceVerifier");
const DeviceRegistry = artifacts.require("DeviceRegistry");
const ProofGenerator = require('../scripts/generate-proof');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const circomlibjs = require('circomlibjs');
const crypto = require('crypto');

module.exports = async function(callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        let verifier;
        let registry;
        let proofGenerator;
        let poseidon;

        // Experiment parameters
        const deviceCounts = [10, 50, 100];
        const batchSizes = [2, 5, 10];
        const resultsDir = path.join(__dirname, '../results');
        const resultsFile = path.join(resultsDir, 'scalability_results.csv');

        // Initialize contracts and dependencies
        verifier = await DeviceVerifier.new();
        registry = await DeviceRegistry.new(accounts[0], verifier.address);
        proofGenerator = new ProofGenerator();
        poseidon = await circomlibjs.buildPoseidon();
        await proofGenerator.setup();

        // Ensure results directory exists
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir);
        }

        // Initialize results file
        fs.writeFileSync(resultsFile, 
            'Timestamp,DeviceCount,BatchSize,BatchNumber,TotalTime,SuccessfulProofs,FailedProofs,AverageProofTime,AverageVerifyTime,TotalGasUsed\n'
        );

        // Helper function to properly format deviceId
        const formatDeviceId = (deviceId) => {
            // Remove '0x' prefix if present
            let hexString = deviceId.startsWith('0x') ? deviceId.slice(2) : deviceId;
            // Pad to 64 hex characters
            hexString = hexString.padStart(64, '0');
            // Return '0x' prefixed hex string
            return '0x' + hexString;
        };

        // Helper function to generate device input with proper formatting
        const generateDeviceInput = () => {
            // Generate random 16-byte deviceId and 32-byte challenge and response
            const deviceId = '0x' + crypto.randomBytes(16).toString('hex'); // 16 bytes for deviceId
            const challenge = '0x' + crypto.randomBytes(32).toString('hex'); // 32 bytes
            const response = '0x' + crypto.randomBytes(32).toString('hex'); // 32 bytes

            // Calculate expected hash
            const hash = poseidon.F.toString(
                poseidon([
                    BigInt(response),
                    BigInt(challenge)
                ])
            );

            return {
                deviceId,
                challenge,
                response,
                expectedHash: hash
            };
        };

        // Helper function to process single device
        const processDevice = async (input) => {
            const startTime = performance.now();
            try {
                // Generate proof
                const proofResult = await proofGenerator.generateProof(input);
                const proofTime = performance.now() - startTime;

                // Format deviceId for contract
                const deviceIdBytes32 = formatDeviceId(input.deviceId);

                // Register device
                await registry.registerDevice(
                    deviceIdBytes32,
                    web3.utils.keccak256("test-pubkey"),
                    "0x00",
                    { from: accounts[0] }
                );

                // Format proof for contract
                const proofForContract = {
                    a: [proofResult.proof.pi_a[0], proofResult.proof.pi_a[1]],
                    b: [
                        [proofResult.proof.pi_b[0][1], proofResult.proof.pi_b[0][0]],
                        [proofResult.proof.pi_b[1][1], proofResult.proof.pi_b[1][0]]
                    ],
                    c: [proofResult.proof.pi_c[0], proofResult.proof.pi_c[1]]
                };

                const publicSignals = proofResult.publicSignals;

                // Verify proof
                const verifyStart = performance.now();
                const tx = await registry.authenticate(
                    deviceIdBytes32,
                    proofForContract.a,
                    proofForContract.b,
                    proofForContract.c,
                    publicSignals,
                    { from: accounts[0] }
                );
                const verifyTime = performance.now() - verifyStart;

                return {
                    success: true,
                    proofTime,
                    verifyTime,
                    gasUsed: tx.receipt.gasUsed
                };
            } catch (error) {
                console.error('Error processing device:', error.message);
                console.error('Input:', input);
                return {
                    success: false,
                    error: error.message
                };
            }
        };

        console.log('Starting scalability tests...');

        for (const deviceCount of deviceCounts) {
            console.log(`Testing with ${deviceCount} devices...`);

            for (const batchSize of batchSizes) {
                console.log(`  Batch size: ${batchSize}`);
                const totalBatches = Math.ceil(deviceCount / batchSize);
                
                let batchNumber = 0;
                let totalSuccessful = 0;
                let totalFailed = 0;
                let totalGasUsed = 0;
                let totalProofTime = 0;
                let totalVerifyTime = 0;
                
                for (let i = 0; i < deviceCount; i += batchSize) {
                    batchNumber++;
                    const batchStartTime = performance.now();
                    const currentBatchSize = Math.min(batchSize, deviceCount - i);
                    
                    console.log(`    Processing batch ${batchNumber}/${totalBatches}`);

                    // Generate inputs for batch
                    const inputs = Array(currentBatchSize).fill(null).map(() => generateDeviceInput());
                    
                    // Process devices sequentially within batch
                    const results = [];
                    for (const input of inputs) {
                        console.log('Processing device with input:', input);
                        const result = await processDevice(input);
                        results.push(result);
                        
                        // Add small delay between operations
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }

                    // Calculate batch statistics
                    const successful = results.filter(r => r.success).length;
                    const failed = results.filter(r => !r.success).length;
                    
                    totalSuccessful += successful;
                    totalFailed += failed;

                    const successfulResults = results.filter(r => r.success);
                    if (successfulResults.length > 0) {
                        totalGasUsed += successfulResults.reduce((sum, r) => sum + r.gasUsed, 0);
                        totalProofTime += successfulResults.reduce((sum, r) => sum + r.proofTime, 0);
                        totalVerifyTime += successfulResults.reduce((sum, r) => sum + r.verifyTime, 0);
                    }

                    const batchTime = performance.now() - batchStartTime;
                    
                    // Log batch results
                    fs.appendFileSync(resultsFile,
                        `${new Date().toISOString()},${deviceCount},${batchSize},${batchNumber},${batchTime},` +
                        `${successful},${failed},${successful ? totalProofTime/successful : 0},` +
                        `${successful ? totalVerifyTime/successful : 0},${totalGasUsed}\n`
                    );

                    console.log(`    Batch ${batchNumber} completed: ${successful} successful, ${failed} failed`);
                }
                
                console.log(`  Completed batch size ${batchSize}: ` +
                          `${totalSuccessful}/${deviceCount} successful, ` +
                          `Average gas: ${totalSuccessful ? Math.round(totalGasUsed/totalSuccessful) : 0}`);
            }
        }

        console.log('Scalability tests completed.');
        console.log('Results saved in:', resultsFile);
        
        callback();
    } catch (error) {
        console.error('Fatal error during scalability tests:', error);
        callback(error);
    }
};
