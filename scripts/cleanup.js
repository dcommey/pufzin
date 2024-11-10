const fs = require('fs');
const path = require('path');

function cleanup() {
    const circuitsDir = path.join(__dirname, '../circuits');
    const buildDir = path.join(circuitsDir, 'build');
    const keysDir = path.join(buildDir, 'keys');

    // Directories to clean
    const dirsToClean = [keysDir];

    for (const dir of dirsToClean) {
        if (fs.existsSync(dir)) {
            console.log(`Cleaning directory: ${dir}`);
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }

    console.log('Cleanup completed');
}

if (require.main === module) {
    cleanup();
}

module.exports = cleanup;