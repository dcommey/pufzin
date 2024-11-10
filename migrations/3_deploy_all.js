// migrations/3_deploy_all.js

const DeviceVerifier = artifacts.require("DeviceVerifier");
const DeviceRegistry = artifacts.require("DeviceRegistry");

module.exports = async function(deployer, network, accounts) {
    // Deploy DeviceVerifier without parameters
    await deployer.deploy(DeviceVerifier);
    const verifier = await DeviceVerifier.deployed();

    // Deploy DeviceRegistry with initialOwner and verifier address
    await deployer.deploy(DeviceRegistry, accounts[0], verifier.address);
};
