async function read_file(input) {
    const fs = require('fs').promises;
    const path = require('path');

    const pathSanitizer = (filePath) => {
        return path.normalize(filePath.split('\\').join('/')).replace(/\/+/g, '/');
    };
    if (!input || typeof input.file_path !== 'string') {
        console.error('❌ Invalid input values.');
        return false;
    }

    let { file_path } = input;
    file_path = pathSanitizer(file_path);

    try {
        const content = await fs.readFile(file_path, 'utf8');
        console.log('✅ File read successfully: ' + file_path);
        console.log(content);
        return content;
    } catch (err) {
        console.error('❌ Error reading file: ' + file_path, err);
        return false;
    }
}