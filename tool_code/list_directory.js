async function list_directory(input) {
    const { directory_path } = input;
    const fs = require('fs');
    let returnData = [];
    const exists = fs.existsSync(directory_path);
    if (!exists) { console.error('❌ Directory does not exist to list: ' + directory_path + ''); process.exit(1); }
    let result = fs.readdirSync(directory_path);
    result = result.filter(item => !['node_modules', 'package.json', 'package-lock.json'].includes(item));
    console.log('## Directory Contents of ' + directory_path + '');
    if (result.length === 0) { console.log('⚠️ Directory is empty'); process.exit(0); }
    // 폴더 먼저 출력
    for (let item of result) {
        const isDirectory = fs.statSync(directory_path + item).isDirectory();
        if (isDirectory) console.log('📁 ' + directory_path + item + '/');
        returnData.push({
            type: 'directory',
            name: item,
        });
    }
    // 파일 출력
    for (let item of result) {
        const isDirectory = fs.statSync(directory_path + item).isDirectory();
        if (isDirectory) continue;
        let fileSize = fs.statSync(directory_path + item).size;
        let fileSizeUnit = 'bytes';
        if (fileSize > 1024) { fileSize = fileSize / 1024; fileSizeUnit = 'KB'; }
        if (fileSize > 1024) { fileSize = fileSize / 1024; fileSizeUnit = 'MB'; }
        if (fileSize > 1024) { fileSize = fileSize / 1024; fileSizeUnit = 'GB'; }
        console.log('📄 ' + directory_path + item + ' (' + fileSize.toFixed(1) + ' ' + fileSizeUnit + ') ');
        returnData.push({
            type: 'file',
            name: item,
            size: fileSize,
        });
    }
    /*
    One line explanation of the return data:
    Array of objects with type, name, and size. type is 'directory' or 'file'. size is the size of the file in bytes. name is the name of the file or directory.
    */
    return returnData;
}

