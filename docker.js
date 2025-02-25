import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import { getAbsolutePath, getAppPath, isWindows, getConfiguration, getHomePath } from './system.js';
import chalk from 'chalk';
import { setHandler, removeHandler } from './sigintManager.js';
import { linuxStyleRemoveDblSlashes, ensureAppsHomePath } from './dataHandler.js';
import { is_file, is_dir } from './codeExecution.js';
import { writeEnsuredFile } from './dataHandler.js';
import singleton from './singleton.js';
import open from 'open';
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
export async function executeCommand(command, streamGetter = null) {
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
            shell: false
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
    let result = await executeInContainer(containerId, 'mkdir -p ' + workDir);
    if (result.code !== 0) throw new Error('작업 디렉토리 생성 실패');

    result = await executeCommand('\'' + (await getDockerCommand()) + '\' cp "' + inputDir + '/." "' + containerId + ':' + workDir + '"');
    if (result.code !== 0) throw new Error('input 폴더 복사 실패');
}
export async function backupWorkspace(containerId, workDir) {
    const removeList = ['node_modules', 'package.json'];
    const commandList = [];
    commandList.push(`rm -rf /backupWorkspace/`);
    commandList.push(`mkdir -p /backupWorkspace/`);
    for (const item of removeList) commandList.push(`mv ${workDir}/${item} /backupWorkspace/${item}`);
    await executeInContainer(containerId, commandList.join(' && '));
}
export async function restoreWorkspace(containerId, workDir) {
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
    const removeList = ['node_modules', 'package.json'];
    const commandList = [];
    commandList.push(`ls -1 ${workDir}`);
    let { code, stdout } = await executeInContainer(containerId, commandList.join(' && '));
    if (code !== 0) return false;
    return stdout.trim().split('\n').filter(item => removeList.includes(item.trim())).length === removeList.length;
}
export async function exportFromDocker(containerId, workDir, outputDir, directoryStructureBeforeOperation) {
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

export async function initNodeProject(containerId, workDir) {
    if (await isNodeInitialized(containerId, workDir)) return;
    const commandList = [];
    commandList.push(`rm -rf ${workDir}`);
    commandList.push(`mkdir -p ${workDir}`);
    commandList.push(`cd ${workDir}`);
    commandList.push(`npm init -y && mkdir -p node_modules`);
    let result = await executeInContainer(containerId, commandList.join(' && '));
    return result.code === 0;
}

export async function isInstalledNodeModule(containerId, workDir, moduleName) {
    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && npm list --json');
    const json = JSON.parse(result.stdout);
    const installed = json.dependencies?.[moduleName];
    return !!installed;
}
export async function installNodeModules(containerId, workDir, moduleName) {
    moduleName = moduleName.trim();
    if (!moduleName) return;
    if (await isInstalledNodeModule(containerId, workDir, moduleName)) return;
    await initNodeProject(containerId, workDir);
    // if (!(await isInstalledNodeModule(containerId, workDir, moduleName))) {
    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && npm install ' + moduleName + '');
    // if (result.code === 0) singleton.installedPackages[moduleName.toLowerCase()] = true;
    return result.code === 0;
    // }
}
export async function isInstalledPythonModule(containerId, workDir, moduleName) {
    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && pip list --format=json');
    const json = JSON.parse(result.stdout);
    return !!(json.filter(info => info.name === moduleName).length);
}
export async function installPythonModules(containerId, workDir, moduleName) {
    moduleName = moduleName.trim();
    if (!moduleName) return;
    if (await isInstalledPythonModule(containerId, workDir, moduleName)) return true;
    if (!await isInstalledPythonModule(containerId, workDir, moduleName)) {
        let result = await executeInContainer(containerId, 'cd ' + workDir + ' && pip install ' + moduleName + '');
        // if (result.code === 0) singleton.installedPackages[moduleName.toLowerCase()] = true;
        return result.code === 0;
    }
}

export async function checkSyntax(containerId, code) {
    const isValid = (result) => { return result.code === 0; }
    const tmpPyFile = getAppPath('.code_' + Math.random() + ('.code'));
    const pyFileName = 'AIEXE-data-handling-operation' + ('.code');
    await writeEnsuredFile(tmpPyFile, code);
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
export async function runPythonCode(containerId, workDir, code, requiredPackageNames = [], streamGetter = null) {
    for (const packageName of requiredPackageNames) await installPythonModules(containerId, workDir, packageName);
    const tmpPyFile = getAppPath('.code_' + Math.random() + '.py');
    const pyFileName = 'AIEXE-data-handling-operation.py';

    const threespaces = ' '.repeat(3);
    if (false) {
        // const venv_path = await getPythonVenvPath();
        // if (!venv_path) return;
        // const importsScriptPath = `${venv_path}/${preprocessing}.py`;
        // if (await isItem(importsScriptPath)) return;
        // await writeEnsuredFile(importsScriptPath, [
        // ].join('\n'));

    }
    const warninglist = ["DeprecationWarning", "UserWarning", "FutureWarning", "ImportWarning", "RuntimeWarning", "SyntaxWarning", "PendingDeprecationWarning", "ResourceWarning", "InsecureRequestWarning", "InsecurePlatformWarning"];
    const modulelist = ["abc", "argparse", "array", "ast", "asyncio", "atexit", "base64", "bdb", "binascii", "bisect", "builtins", "bz2", "calendar", "cmath", "cmd", "code", "codecs", "codeop", "collections", "colorsys", "compileall", "concurrent", "configparser", "contextlib", "contextvars", "copy", "copyreg", "cProfile", "csv", "ctypes", "dataclasses", "datetime", "dbm", "decimal", "difflib", "dis", "doctest", "email", "encodings", "ensurepip", "enum", "errno", "faulthandler", "filecmp", "fileinput", "fnmatch", "fractions", "ftplib", "functools", "gc", "getopt", "getpass", "gettext", "glob", "graphlib", "gzip", "hashlib", "heapq", "hmac", "html", "http", "imaplib", "importlib", "inspect", "io", "ipaddress", "itertools", "json", "keyword", "linecache", "locale", "logging", "lzma", "mailbox", "mailcap", "marshal", "math", "mimetypes", "mmap", "modulefinder", "multiprocessing", "netrc", "nntplib", "numbers", "operator", "optparse", "os", "pathlib", "pdb", "pickle", "pickletools", "pkgutil", "platform", "plistlib", "poplib", "posixpath", "pprint", "profile", "pstats", "pty", "pwd", "py_compile", "pyclbr", "pydoc", "queue", "quopri", "random", "re", "reprlib", "rlcompleter", "runpy", "sched", "secrets", "select", "selectors", "shelve", "shlex", "shutil", "signal", "site", "smtpd", "smtplib", "sndhdr", "socket", "socketserver", "sqlite3", "ssl", "stat", "statistics", "string", "stringprep", "struct", "subprocess", "sunau", "symtable", "sys", "sysconfig", "syslog", "tabnanny", "tarfile", "telnetlib", "tempfile", "test", "textwrap", "threading", "time", "timeit", "token", "tokenize", "trace", "traceback", "tracemalloc", "tty", "turtle", "types", "typing", "unicodedata", "unittest", "urllib", "uu", "uuid", "venv", "warnings", "wave", "weakref", "webbrowser", "wsgiref", "xdrlib", "xml", "xmlrpc", "zipapp", "zipfile", "zipimport", "zlib", "zoneinfo", "numpy", "pandas", "matplotlib", "seaborn", "scipy", "tensorflow", "keras", "torch", "statsmodels", "xgboost", "lightgbm", "gensim", "nltk", "pillow", "requests", "beautifulsoup4", "mahotas", "simplecv", "pycairo", "pyglet", "openpyxl", "xlrd", "xlwt", "pyexcel", "PyPDF2", "reportlab", "moviepy", "vidgear", "imutils", "pytube", "pafy"];
    code = [
        `import os`,
        `os.remove('${pyFileName}')`,
        `# ${'-'.repeat(80)}`,
        `# Please understand that the code is quite long. AI often omits necessary modules when executing code. To address this, I have prepared code at the top that imports commonly used module packages. The main logic of the code created by the AI can be found at the bottom of this code.`,
        `# ${'-'.repeat(80)}`,
        `${warninglist.map(name => `try:\n${threespaces}import warnings\n${threespaces}warnings.filterwarnings("ignore", category=${name})\nexcept Exception as e:\n${threespaces}pass`).join('\n')}`,
        `${modulelist.map(name => `try:\n${threespaces}import ${name}\nexcept Exception as e:\n${threespaces}pass`).join('\n')}`,
        `# ${'-'.repeat(80)}`,
        `def guider(tool_name, *args, **kwargs):`,
        `    args_str = ', '.join([f'{k}={v}' for k,v in kwargs.items()])`,
        `    print(f'"{tool_name}" tool을 이용하여 다음 입력으로({args_str}) 디렉토리 목록을 조회합니다.')`,
        `    return ''`,
        `class default_api:`,
        `    @staticmethod`,
        `    def generate_nodejs_code(*args, **kwargs):`,
        `        return guider('generate_nodejs_code', *args, **kwargs)`,
        `    @staticmethod`,
        `    def generate_nodejs_code_for_puppeteer(*args, **kwargs):`,
        `        return guider('generate_nodejs_code_for_puppeteer', *args, **kwargs)`,
        `    @staticmethod`,
        `    def generate_python_code(*args, **kwargs):`,
        `        return guider('generate_python_code', *args, **kwargs)`,
        `    @staticmethod`,
        `    def list_directory(*args, **kwargs):`,
        `        return guider('list_directory', *args, **kwargs)`,
        `    @staticmethod`,
        `    def apt_install(*args, **kwargs):`,
        `        return guider('apt_install', *args, **kwargs)`,
        `    @staticmethod`,
        `    def which_command(*args, **kwargs):`,
        `        return guider('which_command', *args, **kwargs)`,
        `    @staticmethod`,
        `    def run_command(*args, **kwargs):`,
        `        return guider('run_command', *args, **kwargs)`,
        `    @staticmethod`,
        `    def read_file(*args, **kwargs):`,
        `        return guider('read_file', *args, **kwargs)`,
        `    @staticmethod`,
        `    def remove_file(*args, **kwargs):`,
        `        return guider('remove_file', *args, **kwargs)`,
        `    @staticmethod`,
        `    def remove_directory_recursively(*args, **kwargs):`,
        `        return guider('remove_directory_recursively', *args, **kwargs)`,
        `    @staticmethod`,
        `    def rename_file_or_directory(*args, **kwargs):`,
        `        return guider('rename_file_or_directory', *args, **kwargs)`,
        `    @staticmethod`,
        `    def read_url(*args, **kwargs):`,
        `        return guider('read_url', *args, **kwargs)`,
        `    @staticmethod`,
        `    def cdnjs_finder(*args, **kwargs):`,
        `        return guider('cdnjs_finder', *args, **kwargs)`,
        `# ${'-'.repeat(80)}`,
        code
    ].join('\n');

    await writeEnsuredFile(tmpPyFile, code);

    {
        let result = await executeCommand('\'' + (await getDockerCommand()) + '\' cp "' + tmpPyFile + '" "' + containerId + ':' + workDir + '/' + pyFileName + '"');

        if (result.code !== 0) throw new Error('임시 PY 파일 복사 실패');
    }
    // [remove.003] unlink - /Users/kst/.aiexeauto/workspace/.code_0.7196721389583982.py
    if ((ensureAppsHomePath(tmpPyFile)) && linuxStyleRemoveDblSlashes(tmpPyFile).includes('/.aiexeauto/workspace/') && await is_file(tmpPyFile) && tmpPyFile.startsWith(getHomePath('.aiexeauto/workspace'))) {
        console.log(`[remove.003] unlink - ${tmpPyFile}`);
        await fs.promises.unlink(tmpPyFile);
    } else {
        console.log(`[remove.003!] unlink - ${tmpPyFile}`);
    }


    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && python -u ' + pyFileName, streamGetter);
    result.output = `${result.stderr}\n\n${result.stdout}`;
    return result;

}
export async function runNodeJSCode(containerId, workDir, code, requiredPackageNames = [], streamGetter = null) {
    for (const packageName of requiredPackageNames) await installNodeModules(containerId, workDir, packageName);
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
    await executeCommand(`'${await getDockerCommand()}' kill "${containerId}"`);
}
export async function runDockerContainerDemon(dockerImage) {
    let result = await executeCommand(`'${await getDockerCommand()}' run -d --rm --platform linux/x86_64 "${dockerImage}" tail -f /dev/null`);
    if (result.code !== 0) throw new Error('컨테이너 시작 실패');
    return result.stdout.trim();
}
export async function isDockerContainerRunning(containerId) {
    let result = await executeCommand(`'${await getDockerCommand()}' ps -q --filter "id=${containerId}"`);
    return result.code === 0 && result.stdout.trim().length > 0;
}

export async function cleanContainer(containerId) {
    const dockerWorkDir = await getConfiguration('dockerWorkDir');
    const workDir = dockerWorkDir;
    await executeInContainer(containerId, 'rm -rf ' + workDir + ' ', null);
    await executeInContainer(containerId, 'rm -rf /nodework/ ', null);
}
export async function runDockerContainer(dockerImage, inputDir, outputDir) {
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
