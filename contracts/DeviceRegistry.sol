// contracts/DeviceRegistry.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./DeviceVerifier.sol";

contract DeviceRegistry is Ownable, Pausable {
    DeviceVerifier public verifier;

    struct Device {
        bytes32 deviceId;
        bytes32 pubKeyHash;
        bytes helperData;
        uint256 registeredAt;
        bool isActive;
        address owner;
    }

    struct EncryptedTransaction {
        bytes32 deviceId;
        bytes32 dataHash;
        bytes encryptedData;
        uint256 timestamp;
    }

    mapping(bytes32 => Device) private devices;
    mapping(bytes32 => EncryptedTransaction[]) private transactions;
    uint256 public totalDevices;

    event DeviceRegistered(bytes32 indexed deviceId, uint256 timestamp);
    event DeviceDeactivated(bytes32 indexed deviceId, uint256 timestamp);
    event AuthenticationAttempt(bytes32 indexed deviceId, bool success);
    event TransactionRecorded(
        bytes32 indexed deviceId,
        bytes32 dataHash,
        uint256 timestamp
    );

    // Updated constructor to accept initialOwner
    constructor(address initialOwner, address verifierAddress) Ownable(initialOwner) {
        verifier = DeviceVerifier(verifierAddress);
    }

    function registerDevice(
        bytes32 deviceId,
        bytes32 pubKeyHash,
        bytes calldata helperData
    ) external whenNotPaused returns (bool) {
        require(devices[deviceId].registeredAt == 0, "Device already registered");
        require(deviceId != bytes32(0), "Invalid device ID");
        require(pubKeyHash != bytes32(0), "Invalid public key hash");

        devices[deviceId] = Device({
            deviceId: deviceId,
            pubKeyHash: pubKeyHash,
            helperData: helperData,
            registeredAt: block.timestamp,
            isActive: true,
            owner: msg.sender
        });

        totalDevices++;

        emit DeviceRegistered(deviceId, block.timestamp);
        return true;
    }

    function authenticate(
        bytes32 deviceId,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[3] calldata input  // Use 3 public inputs as per circuit
    ) external whenNotPaused returns (bool) {
        require(devices[deviceId].isActive, "Device not active");

        // Convert deviceId to uint256 for comparison
        uint256 deviceIdNum = uint256(deviceId);
        require(input[0] == deviceIdNum, "Device ID mismatch");

        bool isValid = verifier.verifyProof(a, b, c, input);

        emit AuthenticationAttempt(deviceId, isValid);
        return isValid;
    }

    function recordTransaction(
        bytes32 deviceId,
        bytes32 dataHash,
        bytes calldata encryptedData,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[3] calldata input
    ) external whenNotPaused returns (bool) {
        require(devices[deviceId].isActive, "Device not active");
        require(input[0] == uint256(deviceId), "Device ID mismatch");

        // Verify the proof
        bool isValid = verifier.verifyProof(a, b, c, input);
        require(isValid, "Invalid proof");

        // Store the encrypted transaction
        transactions[deviceId].push(EncryptedTransaction({
            deviceId: deviceId,
            dataHash: dataHash,
            encryptedData: encryptedData,
            timestamp: block.timestamp
        }));

        emit TransactionRecorded(deviceId, dataHash, block.timestamp);
        return true;
    }

    function getTransactionCount(bytes32 deviceId) external view returns (uint256) {
        return transactions[deviceId].length;
    }

    function isDeviceRegistered(bytes32 deviceId) external view returns (bool) {
        return devices[deviceId].registeredAt != 0;
    }

    function isDeviceActive(bytes32 deviceId) external view returns (bool) {
        return devices[deviceId].isActive;
    }
}
