import axios from 'axios';
export async function actDataParser({ actData }) {
    let javascriptCode, requiredPackageNames, pythonCode, javascriptCodeBack;

    if (actData.name === 'generate_nodejs_code') {
        javascriptCode = actData.input.nodejs_code;
        requiredPackageNames = actData.input.npm_package_list;
    } else if (actData.name === 'generate_nodejs_code_for_puppeteer') {
        javascriptCode = actData.input.nodejs_code;
        requiredPackageNames = actData.input.npm_package_list;
    } else if (actData.name === 'generate_python_code') {
        pythonCode = actData.input.python_code;
        requiredPackageNames = actData.input.pip_package_list;
    } else if (actData.name === 'list_directory') {
        javascriptCode = [
            `const listDirectory = require('listDirectory');`,
            `console.log(await listDirectory('${actData.input.directory_path}'));`,
        ].join('\n');
        javascriptCodeBack = [
            `const fs = require('fs');`,
            `const exists = fs.existsSync('${actData.input.directory_path}');`,
            `if(!exists){console.error('❌ ${actData.input.directory_path} 조회할 디렉토리가 존재하지 않습니다');process.exit(1);}`,
            `let result = fs.readdirSync('${actData.input.directory_path}');`,
            `result = result.filter(item => !['node_modules', 'package.json', 'package-lock.json'].includes(item));`,
            `console.log('## Directory Contents of ${actData.input.directory_path}');`,
            `if(result.length === 0){console.log('⚠️ 디렉토리가 비어있습니다');process.exit(0);}`,
            `// 폴더 먼저 출력`,
            `for(let item of result) {`,
            `    const isDirectory = fs.statSync('${actData.input.directory_path}/'+item).isDirectory();`,
            `    if(isDirectory) console.log('📁 ' + '${actData.input.directory_path}/'+item+'/');`,
            `}`,
            `// 파일 출력`,
            `for(let item of result) {`,
            `    const isDirectory = fs.statSync('${actData.input.directory_path}/'+item).isDirectory();`,
            `    if(!isDirectory) console.log('📄 ' + '${actData.input.directory_path}/'+item);`,
            `}`,
        ].join('\n');
    } else if (actData.name === 'apt_install') {
        javascriptCode = [
            `const aptInstall = require('aptInstall');`,
            `console.log(await aptInstall('${actData.input.package_name}'));`,
        ].join('\n');
        javascriptCodeBack = [
            `const { spawnSync } = require('child_process');`,
            `const result = spawnSync('apt', ['install', '-y', '${actData.input.package_name}'], { stdio: ['pipe', 'pipe', 'pipe'], shell: true, encoding: 'utf-8' });`,
            `const output = result.stderr.toString() + result.stdout.toString();`,
            `const outputExists = output.trim().length>0;`,
            `if (result.status === 0) console.log(outputExists?output:'(출력결과는 없지만 문제없이 설치되었습니다)');`,
            `if (result.status !== 0) console.error('❌ 설치수행 실행 실패'+(outputExists?String.fromCharCode(10)+output:''));`,
            `process.exit(result.status);`,
        ].join('\n');
    } else if (actData.name === 'which_command') {
        javascriptCode = [
            `const whichCommand = require('whichCommand');`,
            `console.log(await whichCommand('${actData.input.command}'));`,
        ].join('\n');
        javascriptCodeBack = [
            `const { spawnSync } = require('child_process');`,
            `const result = spawnSync('which', ['${actData.input.command}'], { stdio: ['pipe', 'pipe', 'pipe'], shell: true, encoding: 'utf-8' });`,
            `const output = result.stderr.toString() + result.stdout.toString();`,
            `const outputExists = output.trim().length>0;`,
            `const notFound = '(❌ ${actData.input.command} 명령어가 존재하지 않습니다)';`,
            `if (result.status === 0) console.log(outputExists?'${actData.input.command} 명령어가 존재합니다.'+String.fromCharCode(10)+'명령어의 경로: '+output:notFound);`,
            `if (result.status !== 0) console.error('❌ which 명령어 실행 실패'+(outputExists?String.fromCharCode(10)+output:''));`,
            `process.exit(result.status);`,
        ].join('\n');
    } else if (actData.name === 'run_command') {
        javascriptCode = [
            `const runCommand = require('runCommand');`,
            `console.log(await runCommand('${actData.input.command}'));`,
        ].join('\n');
        javascriptCodeBack = [
            `const { spawnSync } = require('child_process');`,
            `const result = spawnSync('${actData.input.command}', [], { stdio: ['pipe', 'pipe', 'pipe'], shell: true, encoding: 'utf-8' });`,
            `const output = result.stderr.toString() + result.stdout.toString();`,
            `const outputExists = output.trim().length>0;`,
            `if (result.status === 0) console.log(outputExists?output:'(출력결과는 없지만 문제없이 실행되었습니다)');`,
            `if (result.status !== 0) console.error(output);`,
            `process.exit(result.status);`,
        ].join('\n');
    } else if (actData.name === 'read_file') {
        javascriptCode = [
            `const readFile = require('readFile');`,
            `console.log(await readFile('${actData.input.file_path}'));`,
        ].join('\n');
        javascriptCodeBack = [
            `const fs = require('fs');`,
            `const exists = fs.existsSync('${actData.input.file_path}');`,
            `if(!exists){console.error('❌ ${actData.input.file_path} 읽을 파일이 존재하지 않습니다');process.exit(1);}`,
            `const result = fs.readFileSync('${actData.input.file_path}', 'utf8');`,
            `const trimmed = result.trim();`,
            `if (trimmed.length === 0||fs.statSync('${actData.input.file_path}').size === 0) {`,
            `    console.log('⚠️ ${actData.input.file_path} 파일이 비어있습니다 (0 bytes)');`,
            `    process.exit(0);`,
            `}`,
            `console.log('📄 Contents of ${actData.input.file_path}');`,
            `console.log(result);`,
        ].join('\n');
    } else if (actData.name === 'remove_file') {
        javascriptCode = [
            `const removeFile = require('removeFile');`,
            `console.log(await removeFile('${actData.input.file_path}'));`,
        ].join('\n');
        javascriptCodeBack = [
            `const fs = require('fs');`,
            `const exists = fs.existsSync('${actData.input.file_path}');`,
            `if(!exists){console.error('❌ ${actData.input.file_path} 삭제할 파일이 존재하지 않습니다');process.exit(1);}`,
            `fs.unlinkSync('${actData.input.file_path}');`,
            `const result = fs.existsSync('${actData.input.file_path}');`,
            `if (result) {`,
            `    console.error('❌ 파일이 여전히 존재합니다: ${actData.input.file_path}');`,
            `    process.exit(1);`,
            `} else {`,
            `    console.log('✅ 파일이 성공적으로 삭제되었습니다');`,
            `}`,
        ].join('\n');
    } else if (actData.name === 'remove_directory_recursively') {
        javascriptCode = [
            `const removeDirectory = require('removeDirectory');`,
            `console.log(await removeDirectory('${actData.input.file_path}'));`,
        ].join('\n');
        javascriptCodeBack = [
            `const fs = require('fs');`,
            `const exists = fs.existsSync('${actData.input.directory_path}');`,
            `if(!exists){console.error('❌ ${actData.input.directory_path} 삭제할 디렉토리가 존재하지 않습니다');process.exit(1);}`,
            `fs.rmSync('${actData.input.directory_path}', { recursive: true, force: true });`,
            `const result = fs.existsSync('${actData.input.directory_path}');`,
            `if (result) {`,
            `    console.error('❌ 디렉토리가 여전히 존재합니다: ${actData.input.directory_path}');`,
            `    process.exit(1);`,
            `} else {`,
            `    console.log('✅ 디렉토리가 성공적으로 삭제되었습니다');`,
            `}`,
        ].join('\n');
    } else if (actData.name === 'rename_file_or_directory') {
        javascriptCode = [
            `const renameFileOrDirectory = require('renameFileOrDirectory');`,
            `console.log(await renameFileOrDirectory('${actData.input.old_path}', '${actData.input.new_path}'));`,
        ].join('\n');
        javascriptCodeBack = [
            `const fs = require('fs');`,
            `const exists = fs.existsSync('${actData.input.old_path}');`,
            `if(!exists){console.error('❌ ${actData.input.old_path} 이름을 변경할 파일 또는 디렉토리가 존재하지 않습니다');process.exit(1);}`,
            `fs.renameSync('${actData.input.old_path}', '${actData.input.new_path}');`,
            `const result = fs.existsSync('${actData.input.new_path}');`,
            `if (result) {`,
            `    console.log('✅ 파일 또는 디렉토리가 성공적으로 이름이 변경되었습니다');`,
            `} else {`,
            `    console.error('❌ 파일 또는 디렉토리가 이름 변경에 실패했습니다');`,
            `    process.exit(1);`,
            `}`,
        ].join('\n');
    } else if (actData.name === 'read_url') {
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
    }
    return { javascriptCode, requiredPackageNames, pythonCode, javascriptCodeBack };
}