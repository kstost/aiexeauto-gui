import axios from 'axios';
export async function actDataParser({ actData }) {
    const actDataCloneBackedUp = JSON.parse(JSON.stringify(actData));
    let toolingFailed = false;
    function shellCommander(shellCommand) {
        return [
            `const { spawnSync, spawn } = require('child_process');`,
            `const fs = require('fs');`,
            `const outputPath = '/code.sh';`,
            `fs.writeFileSync(outputPath, '${Buffer.from(shellCommand, 'utf-8').toString('base64')}');`,
            `const code = fs.readFileSync(outputPath, 'utf-8');`,
            `fs.writeFileSync(outputPath, Buffer.from(code, 'base64').toString('utf-8'));`,
            `fs.chmodSync(outputPath, '755');`,
            //-----------------------------------
            `{`,
            `    const child = spawn(outputPath, { shell: true });`,
            `    child.stdout.setEncoding('utf8');`,
            `    child.stderr.setEncoding('utf8');`,
            `    async function main() {`,
            `        let stdout = '';`,
            `        let stderr = '';`,
            `        child.stdout.on('data', (data) => {`,
            `            process.stdout.write(data);`,
            `            stdout += data;`,
            `        });`,
            `        child.stderr.on('data', (data) => {`,
            `            process.stderr.write(data);`,
            `            stderr += data;`,
            `        });`,
            `        child.on('error', (err) => {`,
            `            process.exit(1)`,
            `        });`,
            `        const result = await new Promise((resolve, reject) => {`,
            `            child.on('close', (code) => {`,
            `                resolve({`,
            `                    code,`,
            `                    stdout,`,
            `                    stderr`,
            `                })`,
            `            });`,
            `        });`,
            `        if (stdout.trim().length === 0 && stderr.trim().length === 0) console.log('(No output result)');`,
            `        process.exit(result.code);`,
            `    }`,
            `    main();`,
            `}`,
        ].join('\n');
    }
    function is_none_data(data) {
        if (data === undefined) return true;
        if (data === '') return true;
        return false;
    }
    let javascriptCode, requiredPackageNames, pythonCode, javascriptCodeBack;
    try {


        if (actData.name === 'generate_nodejs_code') {
            if (is_none_data(actData?.input?.nodejs_code)) throw null;
            javascriptCode = actData.input.nodejs_code;
            requiredPackageNames = actData.input.npm_package_list;
        } else if (actData.name === 'generate_nodejs_code_for_puppeteer') {
            if (is_none_data(actData?.input?.nodejs_code)) throw null;
            javascriptCode = actData.input.nodejs_code;
            requiredPackageNames = actData.input.npm_package_list;
        } else if (actData.name === 'generate_python_code') {
            if (is_none_data(actData?.input?.python_code)) throw null;
            pythonCode = actData.input.python_code;
            requiredPackageNames = actData.input.pip_package_list;
        } else if (actData.name === 'list_directory') {
            if (is_none_data(actData?.input?.directory_path)) throw null;
            if (!actData.input.directory_path) actData.input.directory_path = './';
            actData.input.directory_path = `${actData.input.directory_path}/`;
            while (actData.input.directory_path.includes('//')) actData.input.directory_path = actData.input.directory_path.replace('//', '/');
            javascriptCode = [
                `const listDirectory = require('listDirectory');`,
                `console.log(await listDirectory('${actData.input.directory_path}'));`,
            ].join('\n');
            javascriptCodeBack = [
                `const fs = require('fs');`,
                `const exists = fs.existsSync('${actData.input.directory_path}');`,
                `if(!exists){console.error('❌ Directory does not exist to list: ${actData.input.directory_path}');process.exit(1);}`,
                `let result = fs.readdirSync('${actData.input.directory_path}');`,
                `result = result.filter(item => !['node_modules', 'package.json', 'package-lock.json'].includes(item));`,
                `console.log('## Directory Contents of ${actData.input.directory_path}');`,
                `if(result.length === 0){console.log('⚠️ Directory is empty');process.exit(0);}`,
                `// 폴더 먼저 출력`,
                `for(let item of result) {`,
                `    const isDirectory = fs.statSync('${actData.input.directory_path}'+item).isDirectory();`,
                `    if(isDirectory) console.log('📁 ' + '${actData.input.directory_path}'+item+'/');`,
                `}`,
                `// 파일 출력`,
                `for(let item of result) {`,
                `    const isDirectory = fs.statSync('${actData.input.directory_path}'+item).isDirectory();`,
                `    if(isDirectory) continue;`,
                `    let fileSize = fs.statSync('${actData.input.directory_path}'+item).size;`,
                `    let fileSizeUnit = 'bytes';`,
                `    if(fileSize>1024){fileSize=fileSize/1024;fileSizeUnit='KB';}`,
                `    if(fileSize>1024){fileSize=fileSize/1024;fileSizeUnit='MB';}`,
                `    if(fileSize>1024){fileSize=fileSize/1024;fileSizeUnit='GB';}`,
                `    console.log('📄 ' + '${actData.input.directory_path}'+item + ' ('+fileSize.toFixed(1)+' '+fileSizeUnit+') ');`,
                `}`,
            ].join('\n');
        } else if (actData.name === 'apt_install') {
            if (is_none_data(actData?.input?.package_name)) throw null;
            javascriptCode = [
                `const aptInstall = require('aptInstall');`,
                `console.log(await aptInstall('${actData.input.package_name}'));`,
            ].join('\n');
            javascriptCodeBack = shellCommander(`apt install -y ${actData.input.package_name}`);
        } else if (actData.name === 'which_command') {
            if (is_none_data(actData?.input?.command)) throw null;
            javascriptCode = [
                `const whichCommand = require('whichCommand');`,
                `console.log(await whichCommand('${actData.input.command}'));`,
            ].join('\n');
            javascriptCodeBack = [
                `const { spawnSync } = require('child_process');`,
                `const result = spawnSync('which', ['${actData.input.command}'], { stdio: ['pipe', 'pipe', 'pipe'], shell: true, encoding: 'utf-8' });`,
                `const output = result.stderr.toString() + result.stdout.toString();`,
                `const outputExists = output.trim().length>0;`,
                'const backtick = "`";',
                `const notFound = '(❌ ${actData.input.command} Command is not available)';`,
                `if (result.status === 0) console.log(outputExists?backtick+'${actData.input.command}'+backtick+' Command is available.'+String.fromCharCode(10)+'Path: '+output+String.fromCharCode(10).repeat(2)+'You can use this with subprocess in python':notFound);`,
                `if (result.status !== 0) console.error(notFound);`,
                `if (false && result.status !== 0) console.error('❌ Failed to run '+backtick+'which'+backtick+' command'+(outputExists?String.fromCharCode(10)+output:''));`,
                `process.exit(result.status);`,
            ].join('\n');
        } else if (actData.name === 'run_command') {
            if (is_none_data(actData?.input?.command)) throw null;
            javascriptCode = [
                actData.input.command,
            ].join('\n');
            javascriptCodeBack = shellCommander(actData.input.command);
        } else if (actData.name === 'read_file') {
            if (is_none_data(actData?.input?.file_path)) throw null;
            javascriptCode = [
                `const readFile = require('readFile');`,
                `console.log(await readFile('${actData.input.file_path}'));`,
            ].join('\n');
            javascriptCodeBack = [
                `const fs = require('fs');`,
                `const exists = fs.existsSync('${actData.input.file_path}');`,
                `if(!exists){console.error('❌ File does not exist to read: ${actData.input.file_path}');process.exit(1);}`,
                `const result = fs.readFileSync('${actData.input.file_path}', 'utf8');`,
                `const trimmed = result.trim();`,
                `if (trimmed.length === 0||fs.statSync('${actData.input.file_path}').size === 0) {`,
                `    console.log('⚠️ ${actData.input.file_path} is empty (0 bytes)');`,
                `    process.exit(0);`,
                `}`,
                `console.log('📄 Contents of ${actData.input.file_path}');`,
                `console.log(result);`,
            ].join('\n');
        } else if (actData.name === 'remove_file') {
            if (is_none_data(actData?.input?.file_path)) throw null;
            javascriptCode = [
                `const removeFile = require('removeFile');`,
                `console.log(await removeFile('${actData.input.file_path}'));`,
            ].join('\n');
            javascriptCodeBack = [
                `const fs = require('fs');`,
                `const exists = fs.existsSync('${actData.input.file_path}');`,
                `if(!exists){console.error('❌ File does not exist to delete: ${actData.input.file_path}');process.exit(1);}`,
                `fs.unlinkSync('${actData.input.file_path}');`,
                `const result = fs.existsSync('${actData.input.file_path}');`,
                `if (result) {`,
                `    console.error('❌ File still exists: ${actData.input.file_path}');`,
                `    process.exit(1);`,
                `} else {`,
                `    console.log('✅ File successfully deleted');`,
                `    console.log('Deleted file: ${actData.input.file_path}');`,
                `}`,
            ].join('\n');
        } else if (actData.name === 'remove_directory_recursively') {
            if (is_none_data(actData?.input?.directory_path)) throw null;
            javascriptCode = [
                `const removeDirectory = require('removeDirectory');`,
                `console.log(await removeDirectory('${actData.input.directory_path}'));`,
            ].join('\n');
            javascriptCodeBack = [
                `const fs = require('fs');`,
                `const exists = fs.existsSync('${actData.input.directory_path}');`,
                `if(!exists){console.error('❌ Directory does not exist to delete: ${actData.input.directory_path}');process.exit(1);}`,
                `fs.rmSync('${actData.input.directory_path}', { recursive: true, force: true });`,
                `const result = fs.existsSync('${actData.input.directory_path}');`,
                `if (result) {`,
                `    console.error('❌ Directory still exists: ${actData.input.directory_path}');`,
                `    process.exit(1);`,
                `} else {`,
                `    console.log('✅ Directory successfully deleted');`,
                `}`,
            ].join('\n');
        } else if (actData.name === 'rename_file_or_directory') {
            if (is_none_data(actData?.input?.old_path)) throw null;
            if (is_none_data(actData?.input?.new_path)) throw null;
            javascriptCode = [
                `const renameFileOrDirectory = require('renameFileOrDirectory');`,
                `console.log(await renameFileOrDirectory('${actData.input.old_path}', '${actData.input.new_path}'));`,
            ].join('\n');
            javascriptCodeBack = [
                `const fs = require('fs');`,
                `const exists = fs.existsSync('${actData.input.old_path}');`,
                `if(!exists){console.error('❌ File or directory does not exist to rename: ${actData.input.old_path}');process.exit(1);}`,
                `fs.renameSync('${actData.input.old_path}', '${actData.input.new_path}');`,
                `const result = fs.existsSync('${actData.input.new_path}');`,
                `if (result) {`,
                `    console.log('✅ File or directory successfully renamed');`,
                `} else {`,
                `    console.error('❌ File or directory failed to rename: ${actData.input.old_path}');`,
                `    process.exit(1);`,
                `}`,
            ].join('\n');
        } else if (actData.name === 'read_url') {
            if (is_none_data(actData?.input?.url)) throw null;
            const url = actData.input.url;
            const result = await axios.get(url);
            let data = result.data;
            if (typeof data !== 'string') data = JSON.stringify(data);
            let ob = { data };
            javascriptCode = [
                `const axios = require('axios');`,
                `const result = await axios.get('${url}');`,
                `console.log('🌏 Contents of ${url}');`,
                `console.log(result.data);`,
            ].join('\n');
            javascriptCodeBack = [
                `console.log('🌏 Contents of ${url}');`,
                `console.log((${JSON.stringify(ob)}).data);`,
            ].join('\n');
        } else if (actData.name === 'cdnjs_finder') {
            if (is_none_data(actData?.input?.package_name)) throw null;
            const packageName = actData.input.package_name;
            const result = await axios.get('https://api.cdnjs.com/libraries?search=' + packageName + '&fields=description,version');
            let data = result.data;
            if (typeof data === 'string') data = JSON.parse(data);
            let url_list1 = data.results.filter(packageInfo => packageInfo.latest.includes('.umd.') && packageInfo.latest.endsWith('.js'))
            let sum = [...url_list1];
            let printData = sum.map(a => `${a.name} - ${a.latest}`).join('\n');
            if (sum.length === 0) printData = 'NOT FOUND';
            javascriptCode = [
                `const cdnjsFinder = require('cdnjsFinder');`,
                `const cdnLibraryURL = await cdnjsFinder('${actData.input.package_name}');`,
                `console.log('🌏 CDN Library URL of ${actData.input.package_name}');`,
                `console.log(cdnLibraryURL);`,
            ].join('\n');
            javascriptCodeBack = [
                `console.log('🌏 CDN Library URL of ${actData.input.package_name}');`,
                `console.log((${JSON.stringify({ printData })}).printData);`,
            ].join('\n');
        } else {
            // no tool found
        }
        /*
            코드 수행결과 javascriptCode || pythonCode 둘중에 하나는 존재해야해.
            둘다 없다면 LLM이 Tooling 실패했다고 봐야해.
            실패했다면 actData 어떤 모습인지 확인할 수 있도록 actDataCloneBackedUp 준비했어.
        */
        if (!javascriptCode && !pythonCode) toolingFailed = true;
        return { javascriptCode, requiredPackageNames, pythonCode, javascriptCodeBack, toolingFailed, actDataCloneBackedUp };
    } catch {
        return {
            toolingFailed
        }
    }

}