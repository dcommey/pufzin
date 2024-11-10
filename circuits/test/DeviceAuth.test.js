const path = require("path");
const wasm_tester = require("circom_tester").wasm;
const F1Field = require("ffjavascript").F1Field;
const Scalar = require("ffjavascript").Scalar;
const p = Scalar.fromString("21888242871839275222246405745257275088548364400416034343698204186575808495617");
const Fr = new F1Field(p);

describe("DeviceAuth Circuit", function() {
    let circuit;
    
    before(async function() {
        circuit = await wasm_tester(path.join(__dirname, "../templates", "DeviceAuth.circom"));
    });
    
    it("should generate valid proof for correct inputs", async function() {
        const input = {
            deviceId: "123456789",
            challenge: "987654321",
            responseCommitment: "5678901234",
            response: "1234567890",
            helperData: "4321098765",
            privateKey: "9876543210"
        };
        
        const witness = await circuit.calculateWitness(input);
        await circuit.checkConstraints(witness);
        
        const output = witness[circuit.getSignalIdx("main.valid")];
        assert.equal(output, 1);
    });
    
    // More tests to be added...
});