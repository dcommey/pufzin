# PUFZIN: Physical Unclonable Functions and Zero-Knowledge Proofs for IoT Networks

PUFZIN is a framework that combines Physical Unclonable Functions (PUFs) and Zero-Knowledge Proofs (ZKPs) for secure IoT device authentication and privacy-preserving transactions on blockchain networks.

## Features
- PUF-based device authentication
- Zero-knowledge proof verification
- Privacy-preserving transactions
- Proof caching for performance optimization
- Scalability testing support

## Requirements
- Node.js v16+
- Truffle Suite
- Ganache
- Python 3.8+ (for visualization)
- Solidity 0.8.20

## Installation
```bash
# Clone the repository
git clone https://github.com/dcommey/pufzin.git
cd pufzin

# Install Node.js dependencies
npm install

# Install Python dependencies (for visualization)
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Running Tests
```bash
# Start Ganache
ganache

# Run experiments
truffle exec scripts/run_experiments.js
truffle exec scripts/run_scalability.js

# Generate visualizations
python scripts/visualize_experiments.py
python scripts/visualize_scalability.py
```

## Project Structure
```
pufzin/
├── circuits/          # ZKP circuit definitions
├── contracts/         # Smart contracts
├── migrations/        # Truffle migrations
├── scripts/          # Test and experiment scripts
├── test/             # Contract test files
└── results/          # Experiment results
```

## License
MIT License
