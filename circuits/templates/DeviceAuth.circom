// circuits/templates/DeviceAuth.circom

pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

template DeviceAuth() {
    // Public inputs
    signal input deviceId;      // Field element
    signal input challenge;     // Field element
    signal input expectedHash;  // Field element from Poseidon hash

    // Private inputs
    signal input response;      // Field element

    // Intermediate signals
    signal computedHash;

    // Components
    component hasher = Poseidon(2);  // Hash response and challenge

    // Convert inputs to bits for range checks
    component deviceIdCheck = Num2Bits(254);  // Use 254 bits instead of 256
    component challengeCheck = Num2Bits(254);
    component responseCheck = Num2Bits(254);

    // Range checks
    deviceIdCheck.in <== deviceId;
    challengeCheck.in <== challenge;
    responseCheck.in <== response;

    // Hash the response with challenge
    hasher.inputs[0] <== response;
    hasher.inputs[1] <== challenge;
    computedHash <== hasher.out;

    // Check if computed hash matches expected hash
    computedHash === expectedHash;
}

component main { public [deviceId, challenge, expectedHash] } = DeviceAuth();
