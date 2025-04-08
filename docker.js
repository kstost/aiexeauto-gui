import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import { getToolCode, getToolData, getToolList, getAbsolutePath, getAppPath, isWindows, getConfiguration, getHomePath, pathSanitizing } from './system.js';
import chalk from 'chalk';
import { setHandler, removeHandler } from './sigintManager.js';
import { linuxStyleRemoveDblSlashes, ensureAppsHomePath } from './dataHandler.js';
import { virtualPython, preparePythonRunningSpace, is_file, is_dir, virtualPlaywright } from './codeExecution.js';
import { loadConfiguration } from './system.js';
import { writeEnsuredFile } from './dataHandler.js';
import singleton from './singleton.js';
import { indention } from './makeCodePrompt.js';
import { runPythonCodeInRealWorld, runNodeCodeInRealWorld, prepareNodeRunningSpace, isInstalledNodeModuleInRealWorld, isInstalledPythonModuleInRealWorld, installNodeModulesInRealWorld, installPythonModulesInRealWorld } from './codeExecution.js';
import open from 'open';
import { getNodePath } from './executableFinder.js';
export async function executeInContainer(containerId, command, streamGetter = null) {
    if (command.includes('"')) {
        return {
            output: '',
            stdout: '',
            stderr: '쌍따옴표는 허용되지 않습니다',
            code: 1,
            error: new Error('쌍따옴표는 허용되지 않습니다')
        };
    }
    return await executeCommand('\'' + (await getDockerCommand()) + '\' exec "' + containerId + '" /bin/sh -c "' + command + '"', streamGetter)
}
async function getDockerCommand() {
    const dockerPath = await getConfiguration('dockerPath');
    if (dockerPath) return dockerPath;
    // return 'docker';
    // if (!commandDocker) commandDocker = await whereCommand('docker');
    // return commandDocker;
}
async function getPowershellCommand() {
    if (!isWindows()) return '';
    if (!commandPowershell) commandPowershell = await whereCommand('powershell');
    return commandPowershell;
}

function parseCommandLine(cmdline) {
    let args = [];
    let currentArg = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escapeNext = false;

    for (let i = 0; i < cmdline.length; i++) {
        let c = cmdline[i];

        if (escapeNext) {
            currentArg += c;
            escapeNext = false;
        } else if (c === '\\' && !inSingleQuote) {
            escapeNext = true;
        } else if (c === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            // Do not include the quote in the argument
        } else if (c === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            // Do not include the quote in the argument
        } else if (/\s/.test(c) && !inSingleQuote && !inDoubleQuote) {
            if (currentArg.length > 0) {
                args.push(currentArg);
                currentArg = '';
            }
        } else {
            currentArg += c;
        }
    }

    if (escapeNext) {
        throw new Error('Invalid command line: Ends with a single backslash');
    }

    if (inSingleQuote || inDoubleQuote) {
        throw new Error('Invalid command line: Mismatched quotes');
    }

    if (currentArg.length > 0) {
        args.push(currentArg);
    }

    if (args.length === 0) {
        throw new Error('No command found');
    }

    let command = args.shift();
    return { command, args };
}

export function executeCommandSync(command, args = []) {
    const result = spawnSync(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
        shell: true
    });

    return {
        output: result.stderr + '\n\n' + result.stdout,
        stdout: result.stdout,
        stderr: result.stderr,
        code: result.status,
        error: result.error
    };
}
let commandPowershell;
let commandDocker;
export async function executeCommand(command, streamGetter = null, workingDirectory = undefined) {
    const khongLog = true;
    return new Promise(async (resolve, reject) => {
        let result;
        if (!isWindows()) result = parseCommandLine(command);
        if (isWindows()) result = {
            command: await getPowershellCommand(),
            args: ['-Command', '& ' + command]
        }
        const child = spawn(result.command, result.args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,
            cwd: workingDirectory,
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
            }
        });
        let stdout = '';
        let stderr = '';
        let output = '';
        const broadCaster = async (str, type) => {
            if (killed) return;
            if (!streamGetter) return;
            if (streamGetter.constructor.name !== 'AsyncFunction') return;
            await streamGetter(JSON.stringify({ str, type }));
        }

        // Ctrl+C 핸들러 추가
        let killed = false;
        const handleCtrlC = () => {
            if (killed) return;
            killed = true;
            child.kill('SIGINT'); // 자식 프로세스에 SIGINT 시그널 전송
            reject({
                stdout: `${stdout}\n---\nOperation interrupted by user.`,
                stderr: `${stderr}\n---\nOperation interrupted by user.`,
                output: `${output}\n---\nOperation interrupted by user.`,
                code: 130, // SIGINT 시그널의 표준 종료 코드
                error: null
            });
        };
        setHandler(handleCtrlC);

        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');

        child.stdout.on('data', async (data) => {
            if (!khongLog) console.log('execution_stdout', data.toString());
            const str = data.toString();
            stdout += str;
            output += str;
            await broadCaster(str, 'stdout');
        });

        child.stderr.on('data', async (data) => {
            if (!khongLog) console.log('execution_stderr', data.toString());
            const str = data.toString();
            stderr += str;
            output += str;
            await broadCaster(str, 'stderr');
        });

        child.on('error', (error) => {
            if (!khongLog) console.log('execution_error', error);
            removeHandler(handleCtrlC);
            reject(error);
        });
        child.on('exit', (code) => {
            if (!khongLog) console.log('execution_exit', code);
        });

        child.on('close', (code) => {
            if (!khongLog) console.log('execution_close', code);
            removeHandler(handleCtrlC);
            resolve({
                stdout,
                stderr,
                output,
                code,
                error: code !== 0 ? new Error('Command failed') : null
            });
        });
    });
}

export async function importToDocker(containerId, workDir, inputDir) {
    if (!(await getConfiguration('useDocker'))) return;
    let result = await executeInContainer(containerId, 'mkdir -p ' + workDir);
    if (result.code !== 0) throw new Error('작업 디렉토리 생성 실패');

    result = await executeCommand('\'' + (await getDockerCommand()) + '\' cp "' + inputDir + '/." "' + containerId + ':' + workDir + '"');
    if (result.code !== 0) throw new Error('input 폴더 복사 실패');
}
export async function backupWorkspace(containerId, workDir) {
    if (!(await getConfiguration('useDocker'))) return;
    const removeList = ['node_modules', 'package.json'];
    const commandList = [];
    commandList.push(`rm -rf /backupWorkspace/`);
    commandList.push(`mkdir -p /backupWorkspace/`);
    for (const item of removeList) commandList.push(`mv ${workDir}/${item} /backupWorkspace/${item}`);
    await executeInContainer(containerId, commandList.join(' && '));
}
export async function restoreWorkspace(containerId, workDir) {
    if (!(await getConfiguration('useDocker'))) return;
    const removeList = ['node_modules', 'package.json'];
    const commandList = [];
    commandList.push(`rm -rf ${workDir}`);
    commandList.push(`mkdir -p ${workDir}`);
    for (const item of removeList) commandList.push(`mv /backupWorkspace/${item} ${workDir}/${item}`);
    commandList.push(`ls -1 ${workDir}`);
    let { code, stdout } = await executeInContainer(containerId, commandList.join(' && '));
    if (code !== 0) return false;
    return stdout.trim().split('\n').filter(item => removeList.includes(item.trim())).length === removeList.length;
}
export async function isNodeInitialized(containerId, workDir) {
    if (!(await getConfiguration('useDocker'))) return;
    const removeList = ['node_modules', 'package.json'];
    const commandList = [];
    commandList.push(`ls -1 ${workDir}`);
    let { code, stdout } = await executeInContainer(containerId, commandList.join(' && '));
    if (code !== 0) return false;
    return stdout.trim().split('\n').filter(item => removeList.includes(item.trim())).length === removeList.length;
}
export async function exportFromDocker(containerId, workDir, outputDir, directoryStructureBeforeOperation) {
    if (!(await getConfiguration('useDocker'))) return;
    {
        await backupWorkspace(containerId, workDir);
    }
    {
        const prefixName = 'AIEXE-data-handling-';
        const removeList = [
            'node_modules', '.git', '.vscode',
            'AIEXE-data-handling-tmpfile.tar',
            'AIEXE-data-handling-exportData.js',
            'AIEXE-data-handling-operation.js',
            'package-lock.json', 'package.json'
        ];
        const commandList = [];
        commandList.push(`mkdir -p /nodework/`);
        for (const item of removeList) commandList.push(`rm -rf ${workDir}/${item}`);
        commandList.push(`rm -rf ${workDir}/${prefixName}*`);
        await executeInContainer(containerId, commandList.join(' && '));
    }
    let structure;
    {
        const tmpJsFile = getAppPath('.code_' + Math.random() + '.js');
        const jsFileName = 'AIEXE-data-handling-operation.js';
        let code = [
            `
            const fs = require('fs');
            const path = require('path');
            async function getDetailDirectoryStructure(directoryPath, basePath = directoryPath) {
                let fsPromise = fs.promises;
                const entries = await fsPromise.readdir(directoryPath);
                entries.sort((a, b) => a.localeCompare(b));
                const result = [];

                for (const entry of entries) {
                    const fullPath = path.join(directoryPath, entry);
                    const stats = await fsPromise.stat(fullPath);

                    if (stats.isFile()) {
                        // 파일인 경우
                        result.push({
                            type: 'file',
                            // 최상위 directoryPath 로부터의 상대 경로
                            path: path.relative(basePath, fullPath),
                            size: stats.size,
                        });
                    } else if (stats.isDirectory()) {
                        // 디렉터리인 경우 재귀적으로 children 생성
                        const children = await getDetailDirectoryStructure(fullPath, basePath);
                        result.push({
                            type: 'directory',
                            path: path.relative(basePath, fullPath),
                            children,
                        });
                    }
                }
                return result;
            }
            (async()=>{
                console.log(JSON.stringify(await getDetailDirectoryStructure('${workDir}')));
            })();
            `
        ].join('\n');
        await writeEnsuredFile(tmpJsFile, code);
        {

            let result = await executeCommand('\'' + (await getDockerCommand()) + '\' cp "' + tmpJsFile + '" "' + containerId + ':' + '/nodework/' + '/' + jsFileName + '"');
            if (result.code !== 0) throw new Error('임시 JS 파일 복사 실패');
        }
        // [remove.004] unlink - /Users/kst/.aiexeauto/workspace/.code_0.10591924509577666.js
        if ((ensureAppsHomePath(tmpJsFile)) && linuxStyleRemoveDblSlashes(tmpJsFile).includes('/.aiexeauto/workspace/') && await is_file(tmpJsFile) && tmpJsFile.startsWith(getHomePath('.aiexeauto/workspace'))) {
            console.log(`[remove.004] unlink - ${tmpJsFile}`);
            await fs.promises.unlink(tmpJsFile);
        } else {
            console.log(`[remove.004!] unlink - ${tmpJsFile}`);
        }
        let result = await executeInContainer(containerId, 'cd ' + '/nodework/' + ' && node ' + jsFileName);
        structure = (result.stdout || '').trim();
    }
    if (directoryStructureBeforeOperation && JSON.stringify(directoryStructureBeforeOperation) !== structure) {
        let result = await executeCommand('\'' + (await getDockerCommand()) + '\' cp "' + containerId + ':' + workDir + '/." "' + outputDir + '"');
        if (result.code !== 0) throw new Error('output 폴더로 복사 실패');
        return true;
    }
    return false;
}
export async function waitingForDataCheck(out_state) {
    if (!(await getConfiguration('useDocker'))) return;
    if (!singleton.beingDataCheck || singleton.missionAborting) return;
    const pid11 = await out_state(`Waiting for data exporting...`);
    try {
        while (singleton.beingDataCheck && !singleton.missionAborting) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    } catch { } finally {
        await pid11.dismiss();
    }
}
export async function exportFromDockerForDataCheck(containerId, dataOutputPath) {
    if (!(await getConfiguration('useDocker'))) return;
    singleton.beingDataCheck = true;
    try {
        async function _exportFromDockerForDataCheck(containerId, workDir, outputDir) {
            let outputDirPreview = outputDir;
            while (outputDirPreview.endsWith('/') || outputDirPreview.endsWith('\\')) {
                outputDirPreview = outputDirPreview.slice(0, -1);
            }
            let count = 0;
            let candidate = `${outputDirPreview}-preview`;
            while (await is_dir(candidate)) {
                count++;
                candidate = `${outputDirPreview}-${count}`;
                if (ensureAppsHomePath(candidate) && !(await is_dir(candidate))) break;
            }
            let result = await executeCommand('\'' + (await getDockerCommand()) + '\' cp "' + containerId + ':' + workDir + '/." "' + candidate + '"');
            // console.log('***command', '\'' + (await getDockerCommand()) + '\' cp "' + containerId + ':' + workDir + '/." "' + candidate + '"');
            // console.log('***result', result);
            return result.code === 0 ? candidate : null;
        }
        if (containerId) {
            if (await getConfiguration('useDocker')) {
                const exported = await _exportFromDockerForDataCheck(containerId, await getConfiguration('dockerWorkDir'), dataOutputPath);
                return exported;
            }
        }

    } catch {
    } finally {
        singleton.beingDataCheck = false;
    }
    return null;
}

/**
 * RealWorld Compatible
 * 
 * @param {*} containerId 
 * @param {*} workDir 
 * @returns 
 */
export async function initNodeProject(containerId, workDir) {
    const useDocker = await getConfiguration('useDocker');
    if (!useDocker) {
        return await prepareNodeRunningSpace();
    }
    if (await isNodeInitialized(containerId, workDir)) return;
    const commandList = [];
    commandList.push(`rm -rf ${workDir}`);
    commandList.push(`mkdir -p ${workDir}`);
    commandList.push(`cd ${workDir}`);
    commandList.push(`npm init -y && mkdir -p node_modules`);
    let result = await executeInContainer(containerId, commandList.join(' && '));
    return result.code === 0;
}

/**
 * RealWorld Compatible
 * 
 * @param {*} containerId 
 * @param {*} workDir 
 * @param {*} moduleName 
 * @returns 
 */
export async function isInstalledNodeModule(containerId, workDir, moduleName) {
    const useDocker = await getConfiguration('useDocker');
    if (!useDocker) {
        return await isInstalledNodeModuleInRealWorld(moduleName);
    }
    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && npm list --json');
    const json = JSON.parse(result.stdout);
    const installed = json?.dependencies?.[moduleName];
    return !!installed;
}
/**
 * RealWorld Compatible
 * 
 * @param {*} containerId 
 * @param {*} workDir 
 * @param {*} moduleName 
 * @returns 
 */
export async function installNodeModules(containerId, workDir, moduleName) {
    moduleName = moduleName.trim();
    if (!moduleName) return;
    const useDocker = await getConfiguration('useDocker');
    if (await isInstalledNodeModule(containerId, workDir, moduleName)) return;
    if (!useDocker) {
        let result = await installNodeModulesInRealWorld(moduleName);
        return result.code === 0;
    }
    await initNodeProject(containerId, workDir);
    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && npm install ' + moduleName + '');
    return result.code === 0;
}

/**
 * RealWorld Compatible
 * 
 * @param {*} containerId 
 * @param {*} workDir 
 * @param {*} moduleName 
 * @returns 
 */
export async function isInstalledPythonModule(containerId, workDir, moduleName) {
    const useDocker = await getConfiguration('useDocker');
    if (!useDocker) {
        return await isInstalledPythonModuleInRealWorld(moduleName);
    }
    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && pip list --format=json');
    const json = JSON.parse(result.stdout);
    return !!(json.filter(info => info.name === moduleName).length);
}

/**
 * RealWorld Compatible
 * 
 * @param {*} containerId 
 * @param {*} workDir 
 * @param {*} moduleName 
 */
export async function installPythonModules(containerId, workDir, moduleName) {
    const useDocker = await getConfiguration('useDocker');
    if (!useDocker) {
        let result = await installPythonModulesInRealWorld(moduleName);
        return result.code === 0;
    }
    moduleName = moduleName.trim();
    if (!moduleName) return;
    if (await isInstalledPythonModule(containerId, workDir, moduleName)) return true;
    if (!await isInstalledPythonModule(containerId, workDir, moduleName)) {
        let result = await executeInContainer(containerId, 'cd ' + workDir + ' && pip install ' + moduleName + '');
        // if (result.code === 0) singleton.installedPackages[moduleName.toLowerCase()] = true;
        return result.code === 0;
    }
}
/**
 * RealWorld Compatible
 * 
 * @param {*} containerId 
 * @param {*} code 
 * @returns 
 */
export async function checkSyntax(containerId, code) {
    const isValid = (result) => { return result.code === 0; }
    const filename = '.code_' + Math.random() + ('.code');
    const tmpPyFile = getAppPath(filename);
    const pyFileName = 'AIEXE-data-handling-operation' + ('.code');
    await writeEnsuredFile(tmpPyFile, code);
    const useDocker = await getConfiguration('useDocker');
    if (!useDocker) {
        let validated = { json: false, py: false, js: false, bash: false, }
        let isJson = false;
        try { JSON.parse(code); isJson = true; } catch { }
        if (isJson) { validated.json = true; return validated; }
        await preparePythonRunningSpace();
        let workdir = getAppPath('coderun');
        let workdirFile = getAppPath('coderun/' + filename);
        await writeEnsuredFile(workdirFile, code);
        validated.py = isValid(await executeCommand(`'${await virtualPython()}' -m py_compile ${filename}`, null, workdir));
        validated.js = isValid(await executeCommand(`'${await getConfiguration('nodePath')}' --check ${filename}`, null, workdir));
        validated.bash = false;
        if (ensureAppsHomePath(workdirFile)) {
            await fs.promises.unlink(workdirFile);
        }
        return validated;
    }
    //----------------------
    {
        await executeInContainer(containerId, 'mkdir -p /chksyntax');
        let result = await executeCommand('\'' + (await getDockerCommand()) + '\' cp "' + tmpPyFile + '" "' + containerId + ':/chksyntax/' + pyFileName + '"');
    }
    if ((ensureAppsHomePath(tmpPyFile)) && linuxStyleRemoveDblSlashes(tmpPyFile).includes('/.aiexeauto/workspace/') && await is_file(tmpPyFile) && tmpPyFile.startsWith(getHomePath('.aiexeauto/workspace'))) {
        await fs.promises.unlink(tmpPyFile);
    }
    let validated = {
        json: false,
        py: false,
        js: false,
        bash: false,
    }
    let isJson = false;// = isValid(await executeInContainer(containerId, 'cd /chksyntax && python -m json.tool ' + pyFileName));
    try {
        JSON.parse(code);
        isJson = true;
    } catch {

    }
    if (isJson) {
        validated.json = true;
        return validated;
    }
    validated.py = isValid(await executeInContainer(containerId, 'cd /chksyntax && python -m py_compile ' + pyFileName));
    validated.js = isValid(await executeInContainer(containerId, 'cd /chksyntax && node --check ' + pyFileName));
    validated.bash = isValid(await executeInContainer(containerId, 'cd /chksyntax && bash -n ' + pyFileName));
    return validated;
}

/**
 * RealWorld Compatible
 * 
 * @param {*} containerId 
 * @param {*} workDir 
 * @param {*} code 
 * @param {*} requiredPackageNames 
 */
export async function runPythonCode(containerId, workDir, code, requiredPackageNames = [], streamGetter = null) {
    for (const packageName of requiredPackageNames) await installPythonModules(containerId, workDir, packageName);
    const tmpPyFile = getAppPath('.code_' + Math.random() + '.py');
    const pyFileName = 'AIEXE-data-handling-operation.py';
    // console.log(pyFileName);
    const threespaces = ' '.repeat(3);
    if (false) {
        // const venv_path = await getPythonVenvPath();
        // if (!venv_path) return;
        // const importsScriptPath = `${venv_path}/${preprocessing}.py`;
        // if (await isItem(importsScriptPath)) return;
        // await writeEnsuredFile(importsScriptPath, [
        // ].join('\n'));

    }
    async function implementTool() {
        const toolList = await getToolList();
        let codeData = [];
        for (const toolName of toolList) {
            const { code, kind } = await getToolCode(toolName);
            if (!code) {
                const code_ = [
                    '..' === '..' && `# ---`,
                    '..' === '..' && `    @staticmethod`,
                    '..' === '..' && `    def ${toolName}(*args, **kwargs):`,
                    '..' === '..' && `        print('${toolName} is only available as Tool Calling.')`,
                    '..' === '..' && `        return ('${toolName} is only available as Tool Calling.')`,
                    '..' === '..' && `# ---`,
                ].filter(Boolean);
                codeData.push(code_.join('\n'));
                continue;
            }
            let data = await getToolData(toolName);
            if (!data) continue;
            let { prompt, spec, npm_package_list, pip_package_list } = data;
            if (spec) spec.input = spec.input_schema;
            npm_package_list = npm_package_list || [];
            pip_package_list = pip_package_list || [];
            const sourcecodeBase64Encoded = Buffer.from(code || '').toString('base64');
            const inputNames = Object.keys(spec.input[0])
            let nodePath = await getConfiguration('nodePath');
            const useDocker = await getConfiguration('useDocker');
            if (useDocker) nodePath = '/usr/bin/node';
            nodePath = pathSanitizing(nodePath);
            const code_ = [
                '..' === '..' && `# ---`,
                '..' === '..' && `    @staticmethod`,
                '..' === '..' && `    def ${toolName}(*args, **kwargs):`,
                '..' === '..' && `        parameters = None`,
                '..' === '..' && `        environment_variables = json.loads('${JSON.stringify(data?.environment_variables || {})}')`,
                '..' === '..' && `        aiexe_configuration = json.loads('${JSON.stringify(await loadConfiguration()).replace(/\\/g, '\\\\')}')`,
                '..' === '..' && `        virtual_playwright = '${(await virtualPlaywright()).replace(/\\/g, '\\\\')}'`,
                '..' === '..' && `        inputSpec = ${JSON.stringify(spec.input[0])}`,
                '..' === '..' && `        inputNames = ${JSON.stringify(inputNames)}`,
                '..' === '..' && `        kwargs_key_list = list(kwargs.keys())`,
                '..' === '..' && `        if len(args) == len(inputNames):`,
                '..' === '..' && `            parameters = {}`,
                '..' === '..' && `            counter = 0`,
                '..' === '..' && `            for arg in args:`,
                '..' === '..' && `                parameters[inputNames[counter]] = arg`,
                '..' === '..' && `                counter += 1`,
                '..' === '..' && `        elif len(kwargs_key_list) == len(inputNames):`,
                '..' === '..' && `            check_counter = 0`,
                '..' === '..' && `            for key in kwargs_key_list:`,
                '..' === '..' && `                if key in inputSpec:`,
                '..' === '..' && `                    check_counter += 1`,
                '..' === '..' && `            if check_counter == len(inputNames):`,
                '..' === '..' && `                parameters = kwargs`,
                '..' === '..' && `        code_kind = '${kind}'`,
                kind === 'py' && `        if code_kind == 'py':`,
                kind === 'py' && `            try:`,
                kind === 'py' && `                pip_package_list = ${JSON.stringify(pip_package_list)}`,
                kind === 'py' && `                for package_name in pip_package_list:`,
                kind === 'py' && `                    subprocess.check_call([sys.executable, "-m", "pip", "install", package_name, "--quiet"])`,
                kind === 'py' && `                `.trim() + `${indention(4, code, 4)}`,
                kind === 'py' && `                return ${toolName}(parameters)`,
                kind === 'py' && `                pass`,
                kind === 'py' && `            except BaseException as e:`,
                kind === 'py' && `                pass`,
                kind === 'js' && `        if code_kind == 'js':`,
                kind === 'js' && `            try:`,
                kind === 'js' && `                npm_package_list = ${JSON.stringify(npm_package_list)}`,
                kind === 'js' && `                for package_name in npm_package_list:`,
                kind === 'js' && `                    install_npm_package(package_name)`,
                kind === 'js' && `                if parameters:`,
                kind === 'js' && `                    nodejsCodeBase64Encoded = '${sourcecodeBase64Encoded}'`,
                kind === 'js' && `                    decodedNodeJSCode = base64.b64decode(nodejsCodeBase64Encoded).decode('utf-8')`,
                kind === 'js' && `                    randomJSFileName = '${Math.random()}.js'`,
                kind === 'js' && `                    with open(randomJSFileName, 'w') as f:`,
                kind === 'js' && `                        f.write('const fs=require("fs");fs.unlinkSync("'+randomJSFileName+'");(async()=>{                         const result = JSON.stringify((await (' + decodedNodeJSCode + ')(' + json.dumps(parameters) + '))||null);   await new Promise(resolve=>setTimeout(resolve, 100));console.log(String.fromCharCode(10)+"824395784357837378287348723475788687546"+String.fromCharCode(10));await new Promise(resolve=>setTimeout(resolve, 100));       console.log(result);                                                                       })();')`,
                kind === 'js' && `                    process = subprocess.Popen(`,
                kind === 'js' && `                        ["${nodePath}", randomJSFileName],`,
                kind === 'js' && `                        stdout=subprocess.PIPE,`,
                kind === 'js' && `                        stderr=subprocess.PIPE,`,
                kind === 'js' && `                        text=True`,
                kind === 'js' && `                    )`,
                kind === 'js' && `                    stderr_lines = []`,
                kind === 'js' && `                    stdout_lines = []`,
                kind === 'js' && `                    t_stdout = threading.Thread(target=stream_output, args=(process.stdout, stdout_lines))`,
                kind === 'js' && `                    t_stderr = threading.Thread(target=stream_output, args=(process.stderr, stderr_lines))`,
                kind === 'js' && `                    t_stdout.start()`,
                kind === 'js' && `                    t_stderr.start()`,
                kind === 'js' && `                    process.wait()`,
                kind === 'js' && `                    t_stdout.join()`,
                kind === 'js' && `                    t_stderr.join()`,
                kind === 'js' && `                    loaded = json.loads(''.join(stdout_lines))`,
                kind === 'js' && `                    return loaded`,
                kind === 'js' && `            except BaseException as e:`,
                kind === 'js' && `                pass`,
                '..' === '..' && `# ---`,
            ].filter(Boolean);
            codeData.push(code_.join('\n'));
        }
        return codeData.join('\n').trim();
    }


    const warninglist = ["DeprecationWarning", "UserWarning", "FutureWarning", "ImportWarning", "RuntimeWarning", "SyntaxWarning", "PendingDeprecationWarning", "ResourceWarning", "InsecureRequestWarning", "InsecurePlatformWarning"];
    const modulelist = ["abc", "argparse", "array", "ast", "asyncio", "atexit", "base64", "bdb", "binascii", "bisect", "builtins", "bz2", "calendar", "cmath", "cmd", "code", "codecs", "codeop", "collections", "colorsys", "compileall", "concurrent", "configparser", "contextlib", "contextvars", "copy", "copyreg", "cProfile", "csv", "ctypes", "dataclasses", "datetime", "dbm", "decimal", "difflib", "dis", "doctest", "email", "encodings", "ensurepip", "enum", "errno", "faulthandler", "filecmp", "fileinput", "fnmatch", "fractions", "ftplib", "functools", "gc", "getopt", "getpass", "gettext", "glob", "graphlib", "gzip", "hashlib", "heapq", "hmac", "html", "http", "imaplib", "importlib", "inspect", "io", "ipaddress", "itertools", "json", "keyword", "linecache", "locale", "logging", "lzma", "mailbox", "mailcap", "marshal", "math", "mimetypes", "mmap", "modulefinder", "multiprocessing", "netrc", "nntplib", "numbers", "operator", "optparse", "os", "pathlib", "pdb", "pickle", "pickletools", "pkgutil", "platform", "plistlib", "poplib", "posixpath", "pprint", "profile", "pstats", "pty", "pwd", "py_compile", "pyclbr", "pydoc", "queue", "quopri", "random", "re", "reprlib", "rlcompleter", "runpy", "sched", "secrets", "select", "selectors", "shelve", "shlex", "shutil", "signal", "site", "smtpd", "smtplib", "sndhdr", "socket", "socketserver", "sqlite3", "ssl", "stat", "statistics", "string", "stringprep", "struct", "subprocess", "sunau", "symtable", "sys", "sysconfig", "syslog", "tabnanny", "tarfile", "telnetlib", "tempfile", "test", "textwrap", "threading", "time", "timeit", "token", "tokenize", "trace", "traceback", "tracemalloc", "tty", "turtle", "types", "typing", "unicodedata", "unittest", "urllib", "uu", "uuid", "venv", "warnings", "wave", "weakref", "webbrowser", "wsgiref", "xdrlib", "xml", "xmlrpc", "zipapp", "zipfile", "zipimport", "zlib", "zoneinfo", "numpy", "pandas", "matplotlib", "seaborn", "scipy", "tensorflow", "keras", "torch", "statsmodels", "xgboost", "lightgbm", "gensim", "nltk", "pillow", "requests", "beautifulsoup4", "mahotas", "simplecv", "pycairo", "pyglet", "openpyxl", "xlrd", "xlwt", "pyexcel", "PyPDF2", "reportlab", "moviepy", "vidgear", "imutils", "pytube", "pafy"];
    let tools = await implementTool();
    // try {
    // } catch (e) {
    //     // console.log(e);
    //     // process.exit(0);
    // }
    const pathSanitizer = (path) => {
        path = path.split('\\').join('/');
        while (true) {
            if (path.indexOf('//') === -1) break;
            path = path.split('//').join('/');
        }
        return path;
    };

    const useDocker = await getConfiguration('useDocker');
    let nodePath = await getConfiguration('nodePath');
    let npmPath = await getConfiguration('npmPath');
    nodePath = pathSanitizer(nodePath);
    npmPath = pathSanitizer(npmPath);
    if (useDocker) {
        nodePath = '/usr/bin/node';
        npmPath = '/usr/bin/npm';
    }
    code = [
        `import os`,
        useDocker ? `os.remove('${pyFileName}')` : ``,
        `# ${'-'.repeat(80)}`,
        `# Please understand that the code is quite long. AI often omits necessary modules when executing code. To address this, I have prepared code at the top that imports commonly used module packages. The main logic of the code created by the AI can be found at the bottom of this code.`,
        `# ${'-'.repeat(80)}`,
        `${warninglist.map(name => `try:\n${threespaces}import warnings\n${threespaces}warnings.filterwarnings("ignore", category=${name})\nexcept Exception as e:\n${threespaces}pass`).join('\n')}`,
        `${modulelist.map(name => `try:\n${threespaces}import ${name}\nexcept Exception as e:\n${threespaces}pass`).join('\n')}`,
        `# ${'-'.repeat(80)}`,
        ``,
        `def install_npm_package(package_name: str) -> bool:`,
        `    try:`,
        `        subprocess.run(`,
        isWindows() ? `            ["${npmPath}", "install", package_name],` : `            ["${nodePath}", "${npmPath}", "install", package_name],`,
        `            stdout=subprocess.DEVNULL,   # 표준 출력 숨기기`,
        `            stderr=subprocess.DEVNULL,   # 에러 출력 숨기기`,
        `            check=True                   # 오류 발생 시 예외`,
        `        )`,
        `        return True`,
        `    except subprocess.CalledProcessError:`,
        `        return False`,
        ``,
        `def stream_output(pipe, capture_list):`,
        `    # pipe.readline()을 통해 줄 단위로 스트리밍`,
        `    # 더 이상 읽을 줄이 없으면 빈 문자열을 반환`,
        `    seperator = '824395784357837378287348723475788687546'`,
        `    mode = False`,
        `    for line in iter(pipe.readline, ''):`,
        `        if line.strip() == seperator:`,
        `            mode = True`,
        `        if not mode:`,
        `            print(line, end='')`,
        `        elif mode and (not line.strip() == seperator):`,
        `            capture_list.append(line)`,
        `def guider(tool_name, *args, **kwargs):`,
        `    args_str = ', '.join([f'{k}={v}' for k,v in kwargs.items()])`,
        `    print(f'"{tool_name}" tool을 이용하여 다음 입력으로({args_str}) 디렉토리 목록을 조회합니다.')`,
        `    return ''`,
        tools ? `class default_api:` : '',
        tools ? tools : '',
        `# ${'-'.repeat(80)}`,
        code
    ].join('\n');

    if (!(await getConfiguration('useDocker'))) {
        let result = await runPythonCodeInRealWorld(code, streamGetter);
        result.output = `${result.stderr}\n\n${result.stdout}`;
        return result;
    } else {
    }

    await writeEnsuredFile(tmpPyFile, code);

    {
        let result = await executeCommand('\'' + (await getDockerCommand()) + '\' cp "' + tmpPyFile + '" "' + containerId + ':' + workDir + '/' + pyFileName + '"');

        if (result.code !== 0) throw new Error('임시 PY 파일 복사 실패');
    }
    // [remove.003] unlink - /Users/kst/.aiexeauto/workspace/.code_0.7196721389583982.py
    if ((ensureAppsHomePath(tmpPyFile)) && linuxStyleRemoveDblSlashes(tmpPyFile).includes('/.aiexeauto/workspace/') && await is_file(tmpPyFile) && tmpPyFile.startsWith(getHomePath('.aiexeauto/workspace'))) {
        console.log(`[remove.003] unlink - ${tmpPyFile}`);
        if (!false) await fs.promises.unlink(tmpPyFile);
        else console.log('not removed!!!!!!!!', tmpPyFile);
    } else {
        console.log(`[remove.003!] unlink - ${tmpPyFile}`);
    }


    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && python -u ' + pyFileName, streamGetter);
    result.output = `${result.stderr}\n\n${result.stdout}`;
    return result;

}
/**
 * RealWorld Compatible
 * 
 * @param {*} containerId 
 * @param {*} workDir 
 * @param {*} code 
 * @param {*} requiredPackageNames 
 * @param {*} streamGetter 
 * @returns 
 */
export async function runNodeJSCode(containerId, workDir, code, requiredPackageNames = [], streamGetter = null) {
    for (const packageName of requiredPackageNames) await installNodeModules(containerId, workDir, packageName);

    if (!(await getConfiguration('useDocker'))) {
        let result = await runNodeCodeInRealWorld(code, streamGetter);
        result.output = `${result.stderr}\n\n${result.stdout}`;
        return result;
    }

    const tmpJsFile = getAppPath('.code_' + Math.random() + '.js');
    const jsFileName = 'AIEXE-data-handling-operation.js';

    code = [
        `{`,
        `const fs = require('fs');`,
        `fs.rmSync('${jsFileName}', { recursive: true, force: true });`,
        `}`,
        code
    ].join('\n');

    await writeEnsuredFile(tmpJsFile, code);

    {
        let result = await executeCommand('\'' + (await getDockerCommand()) + '\' cp "' + tmpJsFile + '" "' + containerId + ':' + workDir + '/' + jsFileName + '"');

        if (result.code !== 0) throw new Error('임시 JS 파일 복사 실패');
    }
    // [remove.004] unlink - /Users/kst/.aiexeauto/workspace/.code_0.10591924509577666.js
    if ((ensureAppsHomePath(tmpJsFile)) && linuxStyleRemoveDblSlashes(tmpJsFile).includes('/.aiexeauto/workspace/') && await is_file(tmpJsFile) && tmpJsFile.startsWith(getHomePath('.aiexeauto/workspace'))) {
        console.log(`[remove.004] unlink - ${tmpJsFile}`);
        await fs.promises.unlink(tmpJsFile);
    } else {
        console.log(`[remove.004!] unlink - ${tmpJsFile}`);
    }



    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && node ' + jsFileName, streamGetter);
    result.output = `${result.stderr}\n\n${result.stdout}`;
    return result;
}
export async function killDockerContainer(containerId) {
    if (!(await getConfiguration('useDocker'))) return;
    await executeCommand(`'${await getDockerCommand()}' kill "${containerId}"`);
}
export async function runDockerContainerDemon(dockerImage) {
    if (!(await getConfiguration('useDocker'))) return;
    let result = await executeCommand(`'${await getDockerCommand()}' run -d --rm --platform linux/x86_64 "${dockerImage}" tail -f /dev/null`);
    if (result.code !== 0) throw new Error('컨테이너 시작 실패');
    return result.stdout.trim();
}
export async function isDockerContainerRunning(containerId) {
    if (!(await getConfiguration('useDocker'))) return;
    let result = await executeCommand(`'${await getDockerCommand()}' ps -q --filter "id=${containerId}"`);
    return result.code === 0 && result.stdout.trim().length > 0;
}

export async function cleanContainer(containerId) {
    if (!(await getConfiguration('useDocker'))) return;
    const dockerWorkDir = await getConfiguration('dockerWorkDir');
    const workDir = dockerWorkDir;
    await executeInContainer(containerId, 'rm -rf ' + workDir + ' ', null);
    await executeInContainer(containerId, 'rm -rf /nodework/ ', null);
}
export async function runDockerContainer(dockerImage, inputDir, outputDir) {
    if (!(await getConfiguration('useDocker'))) return;
    const containerId = await runDockerContainerDemon(dockerImage);
    const dockerWorkDir = await getConfiguration('dockerWorkDir');
    const workDir = dockerWorkDir;

    try {
        await importToDocker(containerId, workDir, inputDir);
        await initNodeProject(containerId, workDir);
        await installNodeModules(containerId, workDir, 'express');
        await runNodeJSCode(containerId, workDir, `console.log('Hello, World!');`);
        await exportFromDocker(containerId, workDir, outputDir);
    } finally {
        await killDockerContainer(containerId);
    }
}


export async function doesDockerImageExist(imageName) {
    if (!(await getConfiguration('useDocker'))) return;
    if (isWindows()) {
        try {
            const execAsync = promisify(exec);
            let command = ``;
            if (isWindows()) command = `& '${await getDockerCommand()}'` + " images --format '{{json .}}'";
            if (isWindows()) command = `"${await getPowershellCommand()}" -Command "${command}"`;

            let result;
            if (!isWindows()) {
                result = await execAsync(command);
            } else {
                try { result = await runCommandWithTimeout(command); } catch { }
            }
            let stdout = result?.stdout;
            if (!stdout) {
                throw new Error('도커 이미지 정보를 가져올 수 없습니다.');
            }
            // const dockerInfo = JSON.parse(stdout);


            const images = stdout.split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));

            return images.some(image => image.Repository === imageName);


            // const images = result.stdout.split('\n')
            // .filter(line => line.trim())
            // .map(line => JSON.parse(line));

            // return images.some(image => image.Repository === imageName);

            // const isRunning = !dockerInfo.ServerErrors || dockerInfo.ServerErrors.length === 0;
            // return {
            //     ...dockerInfo,
            //     isRunning
            // };
        } catch (error) {
            return {
                isRunning: false,
                error: error.message
            };
        }

    } else {
        try {
            if (!imageName) return false;
            if (imageName.includes('"')) return false;
            const result = await executeCommand(`'${await getDockerCommand()}' images --format '{{json .}}'`);
            if (result.code !== 0) return false;
            const images = result.stdout.split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));

            return images.some(image => image.Repository === imageName);
        } catch (err) {
            return false;
        }
    }
}

































export async function whereCommand(name) {
    const execAsync = promisify(exec);
    const commands = isWindows() ? [
        `Where.exe ${name}`,
        `Where.exe ${name}.exe`,
    ] : [
        `which ${name}`,
    ];
    for (const command of commands) {
        const result = await execAsync(command);
        let picked = result?.stdout?.trim();
        if (!picked) picked = '';
        picked = picked.trim();
        picked = picked.split('\n')[0];
        picked = picked.trim();
        if (picked) {
            return picked;
        }
    }
    return name;
}


async function runCommandWithTimeout(command, timeoutMs = 10000) {
    const execAsync = promisify(exec);
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Command timed out after ${timeoutMs / 1000} seconds`)), timeoutMs)
    );
    const executionPromise = (async () => {
        return await execAsync(command);
    })();
    return await Promise.race([executionPromise, timeoutPromise]);
}


export async function getDockerInfo() {
    if (!(await getConfiguration('useDocker'))) return;
    try {
        const execAsync = promisify(exec);
        let command = `${await getDockerCommand()}` + " info --format '{{json .}}' 2>/dev/null";
        if (isWindows()) command = `& '${await getDockerCommand()}'` + " info --format '{{json .}}'";
        if (isWindows()) command = `"${await getPowershellCommand()}" -Command "${command}"`;

        let result;
        if (!isWindows()) {
            result = await execAsync(command);
        } else {
            try { result = await runCommandWithTimeout(command); } catch { }
        }
        let stdout = result?.stdout;
        if (!stdout) {
            throw new Error('도커 정보를 가져올 수 없습니다.');
        }
        const dockerInfo = JSON.parse(stdout);
        const isRunning = !dockerInfo.ServerErrors || dockerInfo.ServerErrors.length === 0;
        return {
            ...dockerInfo,
            isRunning
        };
    } catch (error) {
        return {
            isRunning: false,
            error: error.message
        };
    }
}
