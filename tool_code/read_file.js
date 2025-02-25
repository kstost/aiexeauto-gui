async function read_file(input) {
    const { file_path } = input
    const fs = require('fs');
    const exists = fs.existsSync(input);
    if (!exists) { console.error('❌ File does not exist to read: ' + input + ''); process.exit(1); }
    const result = fs.readFileSync(input, 'utf8');
    const trimmed = result.trim();
    if (trimmed.length === 0 || fs.statSync(input).size === 0) {
        console.log('⚠️ ' + input + ' is empty (0 bytes)');
        process.exit(0);
    }
    console.log('📄 Contents of ' + input + '');
    console.log(result);
}