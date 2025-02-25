async function remove_file(input) {
    const { file_path } = input;
    const fs = require('fs');
    const exists = fs.existsSync(file_path);
    if (!exists) { console.error('❌ File does not exist to delete: ' + file_path + ''); process.exit(1); }
    fs.unlinkSync(file_path);
    const result = fs.existsSync(file_path);
    if (result) {
        console.error('❌ File still exists: ' + file_path + '');
        process.exit(1);
    } else {
        console.log('✅ File successfully deleted');
        console.log('Deleted file: ' + file_path + '');
    }
}