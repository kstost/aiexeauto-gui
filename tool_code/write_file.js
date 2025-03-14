async function write_file(input) {
    const fs = require('fs').promises;
    const path = require('path');

    const pathSanitizer = (filePath) => {
        return path.normalize(filePath.split('\\').join('/')).replace(/\/+/g, '/');
    };
    if (!input || typeof input.file_path !== 'string' || typeof input.content !== 'string') {
        console.error('❌ Invalid input values.');
        return false;
    }

    let { file_path, content } = input;
    file_path = pathSanitizer(file_path);

    try {
        const dir = path.dirname(file_path);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(file_path, content);
        console.log('✅ File saved successfully: ' + file_path);
        return true;
    } catch (err) {
        console.error('❌ Error saving file: ' + file_path, err);
        return false;
    }
}