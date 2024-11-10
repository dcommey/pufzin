// utils/PUFSimulator.js

const crypto = require('crypto');
const circomlibjs = require('circomlibjs');
const path = require('path');

class PUFSimulator {
    constructor(seed = crypto.randomBytes(32)) {
        this.seed = seed;
        this.responseMap = new Map();
        this.poseidon = null;
        this.circuitPath = path.join(__dirname, '../circuits/templates/DeviceAuth.circom');
    }

    async initialize() {
        try {
            // Initialize poseidon hash function
            this.poseidon = await circomlibjs.buildPoseidon();
            console.log('Poseidon initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Poseidon:', error);
            throw error;
        }
    }

    generateChallenge() {
        // Generate a challenge that fits within the field size
        const maxField = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
        const challenge = BigInt('0x' + crypto.randomBytes(31).toString('hex'));
        return challenge % maxField;
    }

    // Simulate PUF response using a deterministic but unpredictable function
    generateResponse(deviceId, challenge) {
        const key = `${deviceId.toString()}-${challenge.toString()}`;
        
        if (this.responseMap.has(key)) {
            return this.responseMap.get(key);
        }

        // Create a deterministic but random-looking response within the field size
        const buffer = Buffer.concat([
            Buffer.from(this.seed),
            Buffer.from(key)
        ]);
        
        const maxField = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
        const response = BigInt('0x' + crypto.createHash('sha256')
            .update(buffer)
            .digest('hex')) % maxField;

        this.responseMap.set(key, response);
        return response;
    }

    // Generate the expected hash for a given device and challenge
    async generateExpectedHash(deviceId, challenge) {
        if (!this.poseidon) {
            throw new Error('PUFSimulator not initialized. Call initialize() first.');
        }

        const response = this.generateResponse(deviceId, challenge);
        const hash = this.poseidon.F.toString(
            this.poseidon([response, challenge])
        );
        return hash;
    }

    // Generate input for the circuit
    async generateCircuitInput(deviceId) {
        const challenge = this.generateChallenge();
        const response = this.generateResponse(deviceId, challenge);
        const expectedHash = await this.generateExpectedHash(deviceId, challenge);

        return {
            deviceId: deviceId.toString(),
            challenge: challenge.toString(),
            response: response.toString(),
            expectedHash: expectedHash.toString()
        };
    }

    // Generate helper data for device registration
    generateHelperData(deviceId) {
        // In a real implementation, this would generate actual helper data
        // For simulation, we'll just create a random byte string
        return '0x' + crypto.randomBytes(32).toString('hex');
    }

    // Generate device ID from "physical" characteristics
    generateDeviceId() {
        return BigInt('0x' + crypto.randomBytes(31).toString('hex'));
    }
}

// Example usage
async function test() {
    const puf = new PUFSimulator();
    await puf.initialize();
    
    // Generate a new device ID
    const deviceId = puf.generateDeviceId();
    
    // Generate circuit inputs
    const circuitInput = await puf.generateCircuitInput(deviceId);
    
    console.log('Device ID:', deviceId.toString());
    console.log('Circuit Input:', circuitInput);
    
    // Generate helper data for registration
    const helperData = puf.generateHelperData(deviceId);
    console.log('Helper Data:', helperData);

    return {
        deviceId,
        circuitInput,
        helperData
    };
}

if (require.main === module) {
    test().catch(console.error);
}

module.exports = PUFSimulator;