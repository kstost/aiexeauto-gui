async function rename_file_or_directory(input) {
    const { old_path, new_path } = input
    const fs = require('fs');
    const exists = fs.existsSync(old_path);
    if (!exists) { console.error('❌ File or directory does not exist to rename: ' + old_path + ''); process.exit(1); }
    fs.renameSync(old_path, new_path);
    const result = fs.existsSync(new_path);
    if (result) {
        console.log('✅ File or directory successfully renamed');
    } else {
        console.error('❌ File or directory failed to rename: ' + old_path + '');
        // process.exit(1);
    }
    /*
    One line explanation of the return data:
    Boolean value indicating whether the file or directory was successfully renamed.
    */
    return result;
}