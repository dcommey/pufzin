const ProofGenerator = require('./generate-proof');
const PUFSimulator = require('../utils/PUFSimulator');
const path = require('path');
const fs = require('fs');

async function testProofGeneration() {
    try {
        console.log('\n=== Initializing Components ===');
        const proofGen = new ProofGenerator();
        const puf = new PUFSimulator();

        console.log('\n=== Setting up PUF Simulator ===');
        await puf.initialize();

        console.log('\n=== Setting up Proof Generator ===');
        await proofGen.setup();

        console.log('\n=== Generating Test Data ===');
        const deviceId = puf.generateDeviceId();
        const challenge = puf.generateChallenge();
        const response = puf.generateResponse(deviceId, challenge);
        const expectedHash = await puf.generateExpectedHash(deviceId, challenge);

        const inputs = {
            deviceId: deviceId.toString(),
            challenge: challenge.toString(),
            response: response.toString(),
            expectedHash: expectedHash.toString()
        };

        // Save inputs for debugging
        const debugDir = path.join(__dirname, '../debug');
        fs.mkdirSync(debugDir, { recursive: true });
        fs.writeFileSync(
            path.join(debugDir, 'test_inputs.json'),
            JSON.stringify(inputs, null, 2)
        );

        console.log('Generated inputs:', JSON.stringify(inputs, null, 2));

        console.log('\n=== Generating Proof ===');
        const result = await proofGen.generateProof(inputs);

        if (result.success) {
            console.log('\nProof generated successfully!');
            
            // Save proof and public signals for debugging
            fs.writeFileSync(
                path.join(debugDir, 'proof.json'),
                JSON.stringify(result.proof, null, 2)
            );
            fs.writeFileSync(
                path.join(debugDir, 'public_signals.json'),
                JSON.stringify(result.publicSignals, null, 2)
            );

            console.log('\n=== Verifying Proof ===');
            const verificationResult = await proofGen.verifyProof(
                result.proof,
                result.publicSignals
            );

            if (verificationResult.success && verificationResult.isValid) {
                console.log('\nProof verified successfully!');
            } else {
                console.error('\nProof verification failed:', verificationResult.error);
            }
        } else {
            console.error('\nFailed to generate proof:', result.error);
        }

    } catch (error) {
        console.error('\nTest failed:', error.message);
        console.error('Error details:', error.stack);
    }
}

if (require.main === module) {
    testProofGeneration().catch(console.error);
}

module.exports = testProofGeneration;