// test/test-flow.js

const DeviceVerifier = artifacts.require("DeviceVerifier");
const DeviceRegistry = artifacts.require("DeviceRegistry");
const ProofGenerator = require('../scripts/generate-proof');
const chai = require('chai');
const assert = chai.assert;
const circomlibjs = require('circomlibjs');
const snarkjs = require('snarkjs');  // Import snarkjs for offchain verification

contract('Device Authentication Flow', (accounts) => {
    let verifier;
    let registry;
    let proofGenerator;
    let poseidon;

    before(async () => {
        // Initialize contracts
        verifier = await DeviceVerifier.new();
        registry = await DeviceRegistry.new(accounts[0], verifier.address);
        proofGenerator = new ProofGenerator();
        
        // Initialize circomlib and poseidon
        poseidon = await circomlibjs.buildPoseidon();
        
        await proofGenerator.setup();
    });

    it('should register and authenticate device', async () => {
        const input = {
            deviceId: "167187242023213709790752988836059498562277881928506182497546456141543281514",
            challenge: "53252479149983696040782982834539845211935550546231631847320157353769477342",
            response: "248973139977937129022338975194145376389814876831038167540701197051279463615"
        };

        // Compute expectedHash using Poseidon hash function
        const hash = poseidon.F.toString(
            poseidon([
                BigInt(input.response),
                BigInt(input.challenge)
            ])
        );

        // Update input with computed expectedHash
        input.expectedHash = hash;
        console.log('Computed expectedHash:', hash);

        const result = await proofGenerator.generateProof(input);

        assert.isTrue(result.success, "Proof generation failed");

        // Verify that publicSignals match input
        console.log('Public Signals:', result.publicSignals);

        // Ensure publicSignals[0] == deviceId
        assert.equal(result.publicSignals[0], input.deviceId, "Public deviceId does not match input");
        assert.equal(result.publicSignals[1], input.challenge, "Public challenge does not match input");
        assert.equal(result.publicSignals[2], input.expectedHash, "Public expectedHash does not match computed hash");

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

        // Offchain verification
        console.log('Verifying proof offchain...');
        const verificationKey = require('../circuits/build/verification_key.json');
        const offchainVerification = await snarkjs.groth16.verify(
            verificationKey,
            result.publicSignals,
            result.proof
        );
        console.log('Offchain verification result:', offchainVerification);
        assert.isTrue(offchainVerification, "Offchain verification failed");

        // Print the proof and public signals for debugging
        console.log('Proof:', result.proof);
        console.log('Public Signals:', result.publicSignals);

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

        console.log('Formatted Proof for Contract:', {
            a: proofForContract.a.map(x => x.toString()),
            b: proofForContract.b.map(pair => pair.map(x => x.toString())),
            c: proofForContract.c.map(x => x.toString())
        });

        console.log('Public Signals for Contract:', publicSignals.map(s => s.toString()));

        // On-chain verification
        console.log('Verifying proof on-chain...');
        const tx = await registry.authenticate(
            deviceIdBytes32,
            proofForContract.a,
            proofForContract.b,
            proofForContract.c,
            publicSignals
        );

        // Extract the 'AuthenticationAttempt' event
        const event = tx.logs.find(log => log.event === 'AuthenticationAttempt');

        // Print the event for debugging
        console.log('AuthenticationAttempt event:', event);

        assert.isTrue(event.args.success, "Device authentication failed");

        console.log('Authentication successful!');
    });
});
