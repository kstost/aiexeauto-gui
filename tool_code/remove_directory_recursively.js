async function remove_directory_recursively(input) {
    const { directory_path } = input;
    const fs = require('fs');
    const exists = fs.existsSync(directory_path);
    if (!exists) { console.error('❌ Directory does not exist to delete: ' + directory_path + ''); process.exit(1); }
    fs.rmSync(directory_path, { recursive: true, force: true });
    const result = fs.existsSync(directory_path);
    if (result) {
        console.error('❌ Directory still exists: ' + directory_path + '');
        process.exit(1);
    } else {
        console.log('✅ Directory successfully deleted');
    }
}