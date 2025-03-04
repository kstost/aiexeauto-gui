async function read_file(input) {
    const pathSanitizer = (path) => {
        path = path.split('\\').join('/');
        while (true) {
            if (path.indexOf('//') === -1) break;
            path = path.split('//').join('/');
        }
        return path;
    };

    let { file_path } = input;
    const fs = require('fs');
    file_path = pathSanitizer(file_path);
    const exists = fs.existsSync(file_path);
    if (!exists) { console.error('❌ File does not exist to read: ' + file_path + ''); process.exit(1); }
    const result = fs.readFileSync(file_path, 'utf8');
    const trimmed = result.trim();
    if (trimmed.length === 0 || fs.statSync(file_path).size === 0) {
        console.log('⚠️ ' + file_path + ' is empty (0 bytes)');
        process.exit(0);
    }
    console.log('📄 Contents of ' + file_path + '');
    console.log(result);
    /*
    One line explanation of the return data:
    String of the contents of the file.
    */
    return result;
}
