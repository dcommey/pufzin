// utils/AuthenticationService.js

const { Web3 } = require('web3');
const path = require('path');
const fs = require('fs');
const ProofGenerator = require('../scripts/generate-proof');
const PUFSimulator = require('./PUFSimulator');
const crypto = require('crypto');

class AuthenticationService {
    constructor(config = {}) {
        this.web3 = new Web3(config.providerUrl || 'http://localhost:8545');
        this.registryAddress = config.registryAddress;
        const contractsPath = path.join(__dirname, '../build/contracts');
        
        // Initialize PUF simulator and proof generator
        this.pufSimulator = new PUFSimulator();
        this.proofGenerator = new ProofGenerator();
        
        try {
            // Load contract ABIs
            const registryJson = JSON.parse(
                fs.readFileSync(path.join(contractsPath, 'DeviceRegistry.json'))
            );
            const verifierJson = JSON.parse(
                fs.readFileSync(path.join(contractsPath, 'DeviceVerifier.json'))
            );
            
            this.registryABI = registryJson.abi;
            this.verifierABI = verifierJson.abi;
            this.verifierAddress = config.verifierAddress;

            // Initialize contracts
            this.registry = new this.web3.eth.Contract(
                this.registryABI,
                this.registryAddress,
            );
            
            this.verifier = new this.web3.eth.Contract(
                this.verifierABI,
                this.verifierAddress,
            );

            console.log('Contracts initialized successfully');
            console.log('Registry address:', this.registryAddress);
            console.log('Verifier address:', this.verifierAddress);

        } catch (error) {
            console.error('Failed to initialize contracts:', error);
            throw error;
        }
    }

    convertToBytes32(value) {
        // Convert BigInt to hex string and ensure it's 32 bytes
        let hexString = BigInt(value).toString(16);
        // Pad to 64 characters (32 bytes)
        hexString = hexString.padStart(64, '0');
        return '0x' + hexString;
    }

    async registerDevice(account) {
        try {
            await this.pufSimulator.initialize();
            
            // Generate device parameters
            const deviceId = this.pufSimulator.generateDeviceId();
            const helperData = '0x' + crypto.randomBytes(32).toString('hex');
            
            // Convert deviceId to proper bytes32 format
            const deviceIdBytes32 = this.convertToBytes32(deviceId);
            const pubKeyHash = this.web3.utils.keccak256(deviceIdBytes32);
            
            console.log('Registering device with parameters:');
            console.log('Device ID (original):', deviceId.toString());
            console.log('Device ID (bytes32):', deviceIdBytes32);
            console.log('Public Key Hash:', pubKeyHash);

            // Register device on chain
            const tx = await this.registry.methods
                .registerDevice(deviceIdBytes32, pubKeyHash, helperData)
                .send({ 
                    from: account,
                    gas: 500000,
                    maxFeePerGas: await this.web3.eth.getGasPrice()
                });

            return {
                deviceId: deviceIdBytes32,
                helperData,
                pubKeyHash,
                transactionHash: tx.transactionHash,
                originalDeviceId: deviceId.toString()
            };

        } catch (error) {
            console.error('Device registration failed:', error);
            throw error;
        }
    }

    async authenticate(deviceId, account) {
        try {
            // Initialize required components
            await this.pufSimulator.initialize();
            await this.proofGenerator.setup();

            // Convert deviceId back to BigInt if it's in bytes32 format
            const deviceIdBigInt = deviceId.startsWith('0x') 
                ? BigInt(deviceId)
                : BigInt(deviceId);

            console.log('Generating circuit inputs...');
            const challenge = this.pufSimulator.generateChallenge();
            const response = this.pufSimulator.generateResponse(deviceIdBigInt, challenge);
            const expectedHash = await this.pufSimulator.generateExpectedHash(deviceIdBigInt, challenge);

            const circuitInputs = {
                deviceId: deviceIdBigInt.toString(),
                challenge: challenge.toString(),
                response: response.toString(),
                expectedHash: expectedHash.toString()
            };

            console.log('Circuit inputs:', circuitInputs);

            // Generate proof
            console.log('Generating proof...');
            const { proof, publicSignals } = await this.proofGenerator.generateProof(circuitInputs);

            if (!proof || !publicSignals) {
                throw new Error('Failed to generate proof');
            }

            // Format proof for contract
            const proofData = {
                a: proof.pi_a.slice(0, 2),
                b: [
                    proof.pi_b[0].slice(0, 2),
                    proof.pi_b[1].slice(0, 2)
                ],
                c: proof.pi_c.slice(0, 2),
                input: publicSignals
            };

            // Convert deviceId to bytes32 for contract call
            const deviceIdBytes32 = this.convertToBytes32(deviceIdBigInt);
            
            console.log('Authenticating device:', deviceIdBytes32);
            
            // Send authentication transaction
            const tx = await this.registry.methods
                .authenticate(
                    deviceIdBytes32,
                    proofData.a,
                    proofData.b,
                    proofData.c,
                    proofData.input
                )
                .send({ 
                    from: account,
                    gas: 500000,
                    maxFeePerGas: await this.web3.eth.getGasPrice()
                });

            return {
                success: true,
                transactionHash: tx.transactionHash,
                proof: proofData
            };

        } catch (error) {
            console.error('Authentication failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async verifyDeviceStatus(deviceId) {
        try {
            // Ensure deviceId is in bytes32 format
            const deviceIdBytes32 = deviceId.startsWith('0x') 
                ? deviceId 
                : this.convertToBytes32(deviceId);

            const [isRegistered, isActive] = await Promise.all([
                this.registry.methods.isDeviceRegistered(deviceIdBytes32).call(),
                this.registry.methods.isDeviceActive(deviceIdBytes32).call()
            ]);

            return { isRegistered, isActive };
        } catch (error) {
            console.error('Status verification failed:', error);
            throw error;
        }
    }
}

module.exports = AuthenticationService;