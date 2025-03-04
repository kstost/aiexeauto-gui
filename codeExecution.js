import { chatCompletion } from './aiFeatures.js';
//---------------------
import singleton from './singleton.js';
import chalk from 'chalk';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import os from 'os';
import { spawn, exec } from 'child_process';
import pyModuleTable from './pyModuleTable.js';
import { getCodePath, findAvailablePort, getAbsolutePath, validatePath, prepareOutputDir, getAppPath, getConfiguration, setConfiguration, flushFolder, pathSanitizing } from './system.js';
import { ensureAppsHomePath, writeEnsuredFile } from './dataHandler.js';
import { getNPMPath, getDockerPath, getNodePath, getPythonPath } from './executableFinder.js'
import { executeCommand } from './docker.js';
import envConst from './envConst.js';
//---------------------
export async function prepareNodeRunningSpace() {
    if ((await getConfiguration('useDocker'))) return;
    let workdir = getAppPath('coderun');
    let packageJson = getAppPath('coderun/package.json');
    if (!fs.existsSync(workdir)) {
        await fs.promises.mkdir(workdir, { recursive: true });
    }
    if (!(await is_file(packageJson))) {
        const npmPath = await getConfiguration('npmPath');
        if (npmPath) {
            if (isWindows()) {
                const result = await executeCommand(`'${npmPath}' init -y`, null, workdir);
                return result.code === 0 && await is_file(packageJson);
            } else {
                const nodePath = await getConfiguration('nodePath');
                const result = await executeCommand(`'/bin/bash' -c "'${nodePath}' '${npmPath}' init -y"`, null, workdir);
                return result.code === 0 && await is_file(packageJson);
            }
        };
    } else {
        return true;
    }
    return false;
}
export async function preparePythonRunningSpace() {
    if ((await getConfiguration('useDocker'))) return;
    let workdir = getAppPath('coderun');
    let venvFolderName = envConst.venvName;
    let venvPath = getAppPath(venvFolderName);
    let venv = venvPath;//getAppPath('coderun/' + venvFolderName);
    if (!fs.existsSync(workdir)) {
        await fs.promises.mkdir(workdir, { recursive: true });
    }
    if (!(await is_dir(venv))) {
        const pythonPath = await getConfiguration('pythonPath');
        if (pythonPath) await executeCommand(`'${pythonPath}' -m venv ${venvFolderName}`, null, getAppPath(''));
    }
    return await is_dir(venv);
}
export async function virtualPython() {
    if ((await getConfiguration('useDocker'))) return;
    await preparePythonRunningSpace();
    return getAppPath(isWindows() ? '' + envConst.venvName + '/Scripts/python' : '' + envConst.venvName + '/bin/python');
}
export async function virtualPip() {
    if ((await getConfiguration('useDocker'))) return;
    await preparePythonRunningSpace();
    return getAppPath(isWindows() ? '' + envConst.venvName + '/Scripts/pip' : '' + envConst.venvName + '/bin/pip');
}
export async function isInstalledNodeModuleInRealWorld(packageName) {
    if ((await getConfiguration('useDocker'))) return;
    if (!(await prepareNodeRunningSpace())) return;
    let packageJson = getAppPath('coderun/package.json');
    const data = await fs.promises.readFile(packageJson, 'utf8');
    const json = JSON.parse(data);
    return !!(json?.dependencies?.[packageName]);
}
export async function isInstalledPythonModuleInRealWorld(packageName) {
    if ((await getConfiguration('useDocker'))) return;
    await preparePythonRunningSpace();
    let workdir = getAppPath('coderun');
    const stdout = (await executeCommand(`'${await virtualPython()}' -m pip list --format=json`, null, workdir)).stdout;
    const list = JSON.parse(stdout);
    return !!(list.filter(item => item.name.toLowerCase() === packageName.toLowerCase())[0]);
}
export async function installNodeModulesInRealWorld(packageName) {
    if ((await getConfiguration('useDocker'))) return;
    if (!(await prepareNodeRunningSpace())) return;
    let workdir = getAppPath('coderun');
    const npmPath = await getConfiguration('npmPath');
    if (isWindows()) {
        if (npmPath) return await executeCommand(`'${npmPath}' install ${packageName}`, null, workdir);
    } else {
        const nodePath = await getConfiguration('nodePath');
        if (npmPath) return await executeCommand(`'/bin/bash' -c "'${nodePath}' '${npmPath}' install ${packageName}"`, null, workdir);
    }
}
export async function installPythonModulesInRealWorld(packageName) {
    if ((await getConfiguration('useDocker'))) return;
    await preparePythonRunningSpace();
    let workdir = getAppPath('coderun');
    return (await executeCommand(`'${await virtualPython()}' -m pip install ${packageName}`, null, workdir));
}

export async function runNodeCodeInRealWorld(code, streamGetter = null) {
    if ((await getConfiguration('useDocker'))) return;
    if (!(await prepareNodeRunningSpace())) return;
    let workdir = getAppPath('coderun');
    let fileName = `testcode_${Math.random()}.js`;
    const absPath = pathSanitizing(getAppPath('coderun/' + fileName));
    code = [`{const fs = require('fs');fs.unlinkSync('${absPath}');}`, code].join('\n');
    if (ensureAppsHomePath(absPath)) await fs.promises.writeFile(absPath, code);
    const nodePath = await getConfiguration('nodePath');
    if (nodePath) {
        let result = await executeCommand(`'${nodePath}' ${fileName}`, streamGetter, workdir);
        return result;
    }
}
export async function runPythonCodeInRealWorld(code, streamGetter = null) {
    if ((await getConfiguration('useDocker'))) return;
    await preparePythonRunningSpace();
    let workdir = getAppPath('coderun');
    let fileName = `testcode_${Math.random()}.py`;
    const absPath = pathSanitizing(getAppPath('coderun/' + fileName));
    code = [
        `import os`,
        `os.path.exists('${absPath}') and os.remove('${absPath}')`,
        code
    ].join('\n');
    if (ensureAppsHomePath(absPath)) await fs.promises.writeFile(absPath, code);
    const pythonPath = await virtualPython();
    if (pythonPath) return await executeCommand(`'${pythonPath}' ${fileName}`, streamGetter, workdir);
}

export function checkValidSyntaxJavascript(code) {
    try {
        new Function(code);
        return {
            isValid: true,
            error: null
        };
    } catch (err) {
        return {
            isValid: false,
            error: {
                name: err.name,
                message: err.message,
                line: err.lineNumber,
                column: err.columnNumber
            }
        };
    }
}

export function stripFencedCodeBlocks(content) {
    const lines = content.split('\n');
    let inCodeBlock = false;
    let code = '';
    let hasCodeBlocks = false;

    for (let line of lines) {
        if (line.startsWith('```')) {
            inCodeBlock = !inCodeBlock; // inCodeBlock 상태를 토글합니다.
            hasCodeBlocks = true; // 펜스 코드 블록이 있음을 표시합니다.
            continue; // ```가 있는 라인은 건너뜁니다.
        }

        if (inCodeBlock) {
            code += line + '\n'; // 코드를 누적합니다.
        }
    }

    if (!hasCodeBlocks) {
        // 펜스 코드 블록이 없는 경우 전체 내용을 코드로 취급합니다.
        code = content;
    }

    return code.trim(); // 앞뒤 공백을 제거합니다.
}


const installHistory = {};
let npmInit = false;
export function isInstalledNpmPackage(packageName) {
    return !!installHistory[packageName];
}
export async function installNpmPackage(page, packageName) {
    const result = await page.evaluate(async (packageName, npmInit, installHistory) => {
        if (!npmInit) {
            await window._electrons.spawn('npm', ['init', '-y']);
            npmInit = true;
        }
        if (!installHistory[packageName]) {
            await window._electrons.spawn('npm', ['install', packageName]);
            installHistory[packageName] = true;
        }
        return { npmInit, installHistory };
    }, packageName, npmInit, installHistory);
    Object.keys(result.installHistory).forEach(name => installHistory[name] = true);
    npmInit = result.npmInit;
}
export async function runCode(page, code, requiredPackageNames) {
    const result = await page.evaluate(async (code, requiredPackageNames) => {
        for (let packageName of requiredPackageNames) await installNpmPackage(page, packageName);
        const operation = `
        try{
            {
                const fs = require('fs');
                const path = require('path');
                const prefixName = 'AIEXE-data-handling-';
                const tempFiles = fs.readdirSync('.');
                for (const file of tempFiles) {
                    if (file.startsWith(prefixName)) {
                        fs.unlinkSync(file);
                    }
                }
            }
            ${code}
        }catch(err){
            console.error(err.name+'::: '+err.message);
            process.exit(1);
        }`;
        await window._electrons.mount('AIEXE-data-handling-operation.js', operation);
        return await window._electrons.spawn('node', ['AIEXE-data-handling-operation.js']);
    }, code, requiredPackageNames);
    return result;
}




















































































//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------
//--------------



export const preprocessing = `preprocessing`;






export async function currentLatestVersionOfGitHub() {
    try {
        let res = await axios.get(`https://raw.githubusercontent.com/kstost/aiexe/main/package.json`);
        return (res.data.version);
    } catch (e) { printError(e); }
    return null;
}
export function isElectron() {
    return !!(process?.versions?.electron);
}
export function printError(e) {
    return;
}
export function isBadStr(ppath) {
    if (ppath.indexOf(`"`) > -1) return !false;
    if (ppath.indexOf(`'`) > -1) return !false;
    return !true;
}
export function addslashes(str) { return str.replace(/[\\"]/g, '\\$&').replace(/\u0000/g, '\\0'); }
export function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}_${milliseconds}`;
}
export async function is_dir(path) {
    try {
        const stat = await fsPromises.stat(path);
        return stat.isDirectory();
    } catch (error) {
        printError(error);
        return false;
    }
}
export async function is_file(path) {
    try {
        const stat = await fsPromises.stat(path);
        return stat.isFile();
    } catch (error) {
        printError(error);
        return false;
    }
}
export async function isItem(itemPath) {
    try {
        await fsPromises.access(itemPath, fsPromises.constants.F_OK);
        return true;
    } catch (e) {
        printError(e);
        return false;
    }
}

export function splitStringIntoTokens(inputString) {
    return inputString.split(/(\w+|\S)/g).filter(token => token.trim() !== '');
}

export function measureColumns(min = 2) {
    const terminallWidth = process.stdout.columns;
    return terminallWidth - min;
}

export function isWindows() { return process.platform === 'win32'; }















export function repld(mn) { return mn.split('_').join('-'); }
export function asPyModuleName(mname) {
    return repld(`${pyModuleTable[mname] ? pyModuleTable[mname] : mname}`);
}


export async function makePreprocessingCode() {
    const threespaces = ' '.repeat(3);
    const venv_path = await getPythonVenvPath();
    if (!venv_path) return;
    const importsScriptPath = `${venv_path}/${preprocessing}.py`;
    if (await isItem(importsScriptPath)) return;
    const warninglist = ["DeprecationWarning", "UserWarning", "FutureWarning", "ImportWarning", "RuntimeWarning", "SyntaxWarning", "PendingDeprecationWarning", "ResourceWarning", "InsecureRequestWarning", "InsecurePlatformWarning"];
    const modulelist = ["abc", "argparse", "array", "ast", "asyncio", "atexit", "base64", "bdb", "binascii", "bisect", "builtins", "bz2", "calendar", "cmath", "cmd", "code", "codecs", "codeop", "collections", "colorsys", "compileall", "concurrent", "configparser", "contextlib", "contextvars", "copy", "copyreg", "cProfile", "csv", "ctypes", "dataclasses", "datetime", "dbm", "decimal", "difflib", "dis", "doctest", "email", "encodings", "ensurepip", "enum", "errno", "faulthandler", "filecmp", "fileinput", "fnmatch", "fractions", "ftplib", "functools", "gc", "getopt", "getpass", "gettext", "glob", "graphlib", "gzip", "hashlib", "heapq", "hmac", "html", "http", "imaplib", "importlib", "inspect", "io", "ipaddress", "itertools", "json", "keyword", "linecache", "locale", "logging", "lzma", "mailbox", "mailcap", "marshal", "math", "mimetypes", "mmap", "modulefinder", "multiprocessing", "netrc", "nntplib", "numbers", "operator", "optparse", "os", "pathlib", "pdb", "pickle", "pickletools", "pkgutil", "platform", "plistlib", "poplib", "posixpath", "pprint", "profile", "pstats", "pty", "pwd", "py_compile", "pyclbr", "pydoc", "queue", "quopri", "random", "re", "reprlib", "rlcompleter", "runpy", "sched", "secrets", "select", "selectors", "shelve", "shlex", "shutil", "signal", "site", "smtpd", "smtplib", "sndhdr", "socket", "socketserver", "sqlite3", "ssl", "stat", "statistics", "string", "stringprep", "struct", "subprocess", "sunau", "symtable", "sys", "sysconfig", "syslog", "tabnanny", "tarfile", "telnetlib", "tempfile", "test", "textwrap", "threading", "time", "timeit", "token", "tokenize", "trace", "traceback", "tracemalloc", "tty", "turtle", "types", "typing", "unicodedata", "unittest", "urllib", "uu", "uuid", "venv", "warnings", "wave", "weakref", "webbrowser", "wsgiref", "xdrlib", "xml", "xmlrpc", "zipapp", "zipfile", "zipimport", "zlib", "zoneinfo", "numpy", "pandas", "matplotlib", "seaborn", "scipy", "tensorflow", "keras", "torch", "statsmodels", "xgboost", "lightgbm", "gensim", "nltk", "pillow", "requests", "beautifulsoup4", "mahotas", "simplecv", "pycairo", "pyglet", "openpyxl", "xlrd", "xlwt", "pyexcel", "PyPDF2", "reportlab", "moviepy", "vidgear", "imutils", "pytube", "pafy"];
    await writeEnsuredFile(importsScriptPath, [
        `# Please understand that the code is quite long. AI often omits necessary modules when executing code. To address this, I have prepared code at the top that imports commonly used module packages. The main logic of the code created by the AI can be found at the bottom of this code.`,
        `# ${'-'.repeat(80)}`,
        `${warninglist.map(name => `try:\n${threespaces}import warnings\n${threespaces}warnings.filterwarnings("ignore", category=${name})\nexcept Exception as e:\n${threespaces}pass`).join('\n')}`,
        `${modulelist.map(name => `try:\n${threespaces}import ${name}\nexcept Exception as e:\n${threespaces}pass`).join('\n')}`,
        `# ${'-'.repeat(80)}`,
    ].join('\n'));
}
export async function shell_exec(python_code, taskId) {
    const threespaces = ' '.repeat(3);
    const abortResult = { python_code, code: -1, stderr: 'aborted by user', stdout: '' };
    if (isTaskAborted(taskId)) return abortResult;
    const venv_path = await getPythonVenvPath();
    if (!venv_path) return;
    return new Promise(async resolve => {
        await makePreprocessingCode();
        if (isTaskAborted(taskId)) { resolve(abortResult); return; }
        const scriptPath = `${venv_path}/._code.py`;
        await writeEnsuredFile(scriptPath, [
            `try:\n${threespaces}from ${preprocessing} import *\nexcept Exception:\n${threespaces}pass`,
            `# ${'-'.repeat(80)}`,
            `${python_code}`
        ].join('\n'));
        if (isTaskAborted(taskId)) { resolve(abortResult); return; }
        const python_interpreter_ = await getPythonPipPath();
        if (!python_interpreter_) throw new Error('Python Interpreter Not Found');
        if (isTaskAborted(taskId)) { resolve(abortResult); return; }
        const pythonCmd = `'${python_interpreter_}' -u '${scriptPath}'`;
        const arg = await makeVEnvCmd(pythonCmd, true);
        const env = Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' });
        if (singleton?.options?.debug === 'shellexe') {
            await singleton.debug(arg, 'shellexe');
            await strout(chalk.blueBright(python_code));
        }
        let windowsHide;
        let cwd;
        if (isElectron()) {
            cwd = `${venv_path}/working/`;
            try {
                if (!await is_dir(cwd)) {
                    await fsPromises.mkdir(cwd)
                }
            } catch { }
        }
        if (isWindows() && isElectron()) windowsHide = true
        const child = spawn(...arg, { windowsHide, env, stdio: (isWindows() && isElectron()) ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'], cwd });
        attatchWatcher(child, resolve, python_code, taskId, abortResult);
    });
}
export function attatchWatcher(child, resolve, python_code, taskId, abortResult) {
    let childDone = false;
    const stdout = [];
    const stderr = [];
    (isWindows() && isElectron()) && child.stdin.end();
    child.stdout.on('data', function (data) {
        stdout.push(data);
        process.stdout.write(chalk.greenBright(data));
    });
    child.stderr.on('data', function (data) {
        if (data.indexOf(`warnings.warn("`) > -1 && data.indexOf(`Warning: `) > -1) return;
        if (data.indexOf(`WARNING: `) > -1 && data.indexOf(`Secure coding is automatically enabled for restorable state`) > -1) return;
        if (data.indexOf(`AdjustCapsLockLEDForKeyTransitionHandling`) > -1 && data.indexOf(`Secure coding is automatically enabled for restorable state`) > -1) return;
        if (data.indexOf(`NotOpenSSLWarning`) > -1 && data.indexOf(`warnings.warn(`) > -1) return;
        stderr.push(data);
        process.stderr.write(chalk.red(data));
    });
    child.on('exit', (code, signal) => {
        if (!isElectron()) return;
        console.log(`Child process exited with code ${code} and signal ${signal}`);
        child.stdout.destroy();
        child.stderr.destroy();
    });

    child.on('close', function (code, signal) {
        if (isElectron()) console.log(`Child process closed all stdio with code ${code} and signal ${signal}`);
        childDone = true;
        if (signal === 'SIGKILL' && abortResult) {
            resolve(abortResult);
        } else {
            resolve({ code, stdout: stdout.join(''), stderr: stderr.join(''), python_code });
        }
    });
    if (taskId) {
        (async () => {
            while (!childDone) {
                if (isTaskAborted(taskId)) {
                    child.kill('SIGKILL');
                    childDone = true;
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        })();
    }
}
export async function shelljs_exec(cmd, opt, callback) {
    exec(cmd, (error, stdout, stderr) => {
        let code = 0;
        if (error) code = error.code
        callback(code, stdout, stderr);
    });
}
export async function execPlain(cmd) {
    return new Promise(resolve => {
        shelljs_exec(cmd, { silent: true, }, (code, stdout, stderr) => {
            resolve({ code, stdout, stderr });
        })
    })
}

let __powershellPath;
export async function getPowerShellPath() {
    try {
        if (!isWindows()) return;
        if (__powershellPath) return __powershellPath;
        let testCommands = [
            '(Get-Command powershell).Source',
            'where.exe powershell',
            'C:\\Windows\\System32\\where.exe powershell',
        ];
        let powershellPath;
        for (let i = 0; i < testCommands.length; i++) {
            let result = await execPlain(testCommands[i]);
            if (result.code) continue;
            let _powershellPath = result.stdout.trim().split('\n')[0].trim();
            if (!await is_file(_powershellPath)) continue;
            powershellPath = _powershellPath;
        }
        let hardpath = `C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
        if (!powershellPath && await is_file(hardpath)) powershellPath = hardpath;
        if (isBadStr(powershellPath)) powershellPath = null;
        if (!powershellPath) {
            process.exit(1);
            return;
        }
        __powershellPath = powershellPath;
        return powershellPath;
    } catch (e) { printError(e); }
}

export async function execAdv(cmd, mode = true, opt = {}) {
    if (isWindows()) {
        const powershell = await getPowerShellPath();
        return new Promise(resolve => {
            shelljs_exec(mode ? `"${powershell}" -Command "${cmd}"` : cmd, { silent: true, ...opt }, (code, stdout, stderr) => {
                resolve({ code, stdout, stderr });
            })
        })
    } else {
        return await new Promise(function (resolve) {
            shelljs_exec(cmd, { silent: true, ...opt }, function (code, stdout, stderr) {
                resolve({ code, stdout, stderr });
            });
        });
    }
};



export async function createPythonVENV(silent = false) {
    const pythonPath = await checkPythonForTermination();
    if (!pythonPath) return;
    const venv_path = await getPythonVenvPath();
    if (venv_path) return true;
    const venvCandidate = await pythonVenvCandidatePath();
    if (!silent) await oraStart('Creating virtual environment for Python');
    if (!silent) if (false) await oraStop();
    let res;
    if (isWindows()) res = await execAdv(`& '${pythonPath}' -m venv \\"${venvCandidate}\\"`); //dt
    else res = await execAdv(`"${pythonPath}" -m venv "${venvCandidate}"`)
    if (res.code === 0) {
        await setVarVal('PYTHON_VENV_PATH', venvCandidate);
        if (!silent) await oraSucceed(chalk.greenBright('Creating virtual environment for Python successed'));
        return true;
    } else {
        if (!silent) await oraFail(chalk.redBright('Creating VENV fail'));
        if (!silent) console.error(chalk.yellowBright(res.stdout))
        throw new Error('Creating VENV fail');
    }
}
export async function createNodeVENV() {
    const nodePath = await realworld_which_node();
    if (!nodePath) return;
    const venv_path = await getNodeVenvPath();
    if (venv_path) return true;
    const venvCandidate = await nodeVenvCandidatePath();
    await setVarVal('NODE_VENV_PATH', venvCandidate);
}























export async function getRCPath() {
    async function innerWork() {
        if (isWindows()) {
            const pathd = `${os.homedir()}/.aiexe.configuration`;
            try { fs.mkdirSync(pathd); } catch (errorInfo) { printError(errorInfo); }
            if (!fs.existsSync(pathd)) return '';
            const filepath = `${pathd}/configuration`;
            try { fs.readFileSync(filepath); } catch (errorInfo) { printError(errorInfo); fs.appendFileSync(filepath, ''); }
            return filepath;
        } else {
            const shell = process.env.SHELL;
            let filePath;
            const lastName = shell.split('/').at(-1);
            if (lastName === ('zsh')) {
                filePath = path.join(os.homedir(), '.zshrc');
            } else if (lastName === ('bash')) {
                const bashProfilePath = path.join(os.homedir(), '.bash_profile');
                const bashrcPath = path.join(os.homedir(), '.bashrc');
                async function checkFilePath(bashProfilePath, bashrcPath) {
                    let filePath;
                    try {
                        await fsPromises.access(bashProfilePath, fsPromises.constants.F_OK);
                        filePath = bashProfilePath;
                    } catch (errorInfo) {
                        printError(errorInfo);
                        filePath = bashrcPath;
                    }
                    return filePath;
                }
                filePath = await checkFilePath(bashProfilePath, bashrcPath);
            } else {
                return;
            }
            return filePath;
        }
    }
    let rcPath = await innerWork();
    if (!rcPath) rcPath = '';
    if (rcPath && !await is_file(rcPath)) rcPath = '';
    if (!rcPath) {
        const pathd = `${os.homedir()}/.aiexe.configuration`;
        try { fs.mkdirSync(pathd); } catch (errorInfo) { printError(errorInfo); }
        if (!fs.existsSync(pathd)) return '';
        const filepath = `${pathd}/configuration`;
        try { fs.readFileSync(filepath); } catch (errorInfo) { printError(errorInfo); fs.appendFileSync(filepath, ''); }
        return filepath;
    }
    return rcPath;
}
export async function readRCDaata() {
    let currentContents = '';
    try {
        const path = await getRCPath();
        if (path) currentContents = await fsPromises.readFile(path, 'utf8');
    } catch (err) {
        printError(err);
        currentContents = '';
    }
    if (!currentContents) currentContents = '';
    return currentContents;
}


export async function getVarVal(key) {
    return await getConfiguration(key);
}

export async function findMissingVars(envConfig) {
    let currentContents = await readRCDaata();
    const list = [];
    currentContents = currentContents.split('\n');
    for (const [key, value] of Object.entries(envConfig)) {
        const pattern = new RegExp(`^\\s*export\\s+${key}\\s*=\\s*['"]?([^'"\n]+)['"]?`, 'm');
        if (!currentContents.some(line => pattern.test(line))) list.push(key);
    }
    return list;
}

export async function isKeyInConfig(keyname) {
    const list = await findMissingVars({ [keyname]: true });
    return list[0] !== keyname;
}



export async function setVarVal(key, value) {
    await setConfiguration(key, value);
}






export async function makeVEnvCmd(pythonCmd, spawn = false) {
    const activateCmd = await getPythonActivatePath();
    pythonCmd = pythonCmd.split(`"`).join(`\\"`);
    if (spawn) {
        if (isWindows()) {
            let nulluse = isElectron();// && false;
            const powershell = await getPowerShellPath();
            // return [`${powershell}`, [`${powershell}`, `-NoProfile`, `-ExecutionPolicy`, `Bypass`, `-Command`, `"& '${activateCmd}'; & ${pythonCmd}${nulluse ? ` < nul` : ''}"`]];
            return [
                `${powershell}`,
                [
                    `${powershell}`,
                    `-NoProfile`,
                    `-ExecutionPolicy`,
                    `Bypass`,
                    `-Command`,
                    `"& '${activateCmd}'; & ${pythonCmd}"${false ? `; $null = [System.Console]::In.Close()` : ''}`
                ]
            ];
            // return [`${powershell}`, [`${powershell}`, `-NoProfile`, `-ExecutionPolicy`, `Bypass`, `-Command`, `"& '${activateCmd}'; & ${pythonCmd}${nulluse ? ` < nul` : ''}"`]];
        } else {
            let nulluse = isElectron();// && false;
            const bash_path = !isWindows() ? await which(`bash`) : null;
            return [`${bash_path}`, ['-c', `"${bash_path}" -c "source '${activateCmd}' && ${pythonCmd}${nulluse ? ` < /dev/null` : ''}"`]]
        }
    } else {
        if (isWindows()) {
            const powershell = await getPowerShellPath();
            return `"${powershell}" -NoProfile -ExecutionPolicy Bypass -Command "& {$env:PYTHONIOENCODING='utf-8'; & '${activateCmd}'}; & ${pythonCmd}" < nul`;
        } else {
            const bash_path = !isWindows() ? await which(`bash`) : null;
            return `"${bash_path}" -c "source '${activateCmd}' && ${pythonCmd} < /dev/null"`;
        }
    }
}



export async function installProcess() {
    if (!await isKeyInConfig('PYTHON_VENV_PATH')) {
        await createPythonVENV();
    }
    if (!await isKeyInConfig('NODE_VENV_PATH')) {
        await createNodeVENV();
    }
}
export async function realworld_which_python() {
    await singleton.debug({ head: '-'.repeat(10) }, 'realworld_which_python');
    let list = ['python', 'python3'];

    if (isWindows()) list = ['python', 'python3', '.python', '.python3'];
    if (singleton?.options?.debug === 'pmode1') list = ['python', 'python3'];
    if (singleton?.options?.debug === 'pmode2') list = ['.python', '.python3'];
    if (singleton?.options?.debug === 'pmode3') list = ['.python', '.python3', 'python', 'python3'];

    const python_detect_result = [];
    for (let i = 0; i < list.length; i++) {
        const name = list[i];
        await singleton.debug({ name }, 'realworld_which_python');
        const ppath = name[0] === '.' ? name.substring(1, Infinity) : await which(name);
        await singleton.debug({ path: ppath }, 'realworld_which_python');
        if (!ppath) continue;
        if (isBadStr(ppath)) throw ppath;
        const str = `${Math.random()}`;
        let rfg;
        if (isWindows()) rfg = await execAdv(`& '${ppath}' -c \\"print('${str}')\\"`);
        else rfg = await execAdv(`"${ppath}" -c "print('${str}')"`);
        let { stdout } = rfg;
        await singleton.debug({ result: stdout.trim(), source: str, comparison: stdout.trim() === str }, 'realworld_which_python');
        if (stdout.trim() === str) return ppath;
        python_detect_result.push({
            path: ppath,
            ...rfg
        })
    }
    if (isWindows()) {
        let commandList = [
            `Where.exe python`,
            `Where.exe python3`,
            `Where python`,
            `Where python3`,
        ];
        try {
            let python_path = await getVarVal('PYTHON_PATH');
            if (python_path && python_path.trim()) return python_path.trim();
        } catch { }
        try {
            for (let i = 0; i < commandList.length; i++) {
                let pythonList = await execPlain(commandList[i]);
                let pathList = pythonList.stdout.split('\n').map(line => line.trim()).filter(Boolean);
                for (let i = 0; i < pathList.length; i++) {
                    const ppath = pathList[i];
                    if (ppath.endsWith('\\python.exe') || ppath.endsWith('\\python3.exe')) { } else { continue }
                    const str = `${Math.random()}`;
                    let rfg;
                    if (isWindows()) rfg = await execAdv(`& '${ppath}' -c \\"print('${str}')\\"`);
                    else rfg = await execAdv(`"${ppath}" -c "print('${str}')"`);
                    let { stdout } = rfg;
                    await singleton.debug({ result: stdout.trim(), source: str, comparison: stdout.trim() === str }, 'realworld_which_python');
                    if (stdout.trim() === str) return ppath;
                }
            }
        } catch { }
    }

    return python_detect_result;
}
export async function realworld_which_node() {
    await singleton.debug({ head: '-'.repeat(10) }, 'realworld_which_node');
    let list = ['node'];

    if (isWindows()) list = ['node', '.node'];
    if (singleton?.options?.debug === 'pmode1') list = ['node'];
    if (singleton?.options?.debug === 'pmode2') list = ['.node'];
    if (singleton?.options?.debug === 'pmode3') list = ['.node', 'node'];

    const node_detect_result = [];
    for (let i = 0; i < list.length; i++) {
        const name = list[i];
        await singleton.debug({ name }, 'realworld_which_node');
        const ppath = name[0] === '.' ? name.substring(1, Infinity) : await which(name);
        await singleton.debug({ path: ppath }, 'realworld_which_node');
        if (!ppath) continue;
        if (isBadStr(ppath)) throw ppath;
        const str = `${Math.random()}`;
        let rfg;
        if (isWindows()) rfg = await execAdv(`& '${ppath}' -e \\"console.log('${str}')\\"`);
        else rfg = await execAdv(`"${ppath}" -e "console.log('${str}')"`);
        let { stdout } = rfg;
        await singleton.debug({ result: stdout.trim(), source: str, comparison: stdout.trim() === str }, 'realworld_which_node');
        if (stdout.trim() === str) return ppath;
        node_detect_result.push({
            path: ppath,
            ...rfg
        })
    }
    if (isWindows()) {
        let commandList = [
            `Where.exe node`,
            `Where node`,
        ];
        try {
            let node_path = await getVarVal('NODE_PATH');
            if (node_path && node_path.trim()) return node_path.trim();
        } catch { }
        try {
            for (let i = 0; i < commandList.length; i++) {
                let nodeList = await execPlain(commandList[i]);
                let pathList = nodeList.stdout.split('\n').map(line => line.trim()).filter(Boolean);
                for (let i = 0; i < pathList.length; i++) {
                    const ppath = pathList[i];
                    if (ppath.endsWith('\\node.exe')) { } else { continue }
                    const str = `${Math.random()}`;
                    let rfg;
                    if (isWindows()) rfg = await execAdv(`& '${ppath}' -e \\"console.log('${str}')\\"`);
                    else rfg = await execAdv(`"${ppath}" -e "console.log('${str}')"`);
                    let { stdout } = rfg;
                    await singleton.debug({ result: stdout.trim(), source: str, comparison: stdout.trim() === str }, 'realworld_which_node');
                    if (stdout.trim() === str) return ppath;
                }
            }
        } catch { }
    }

    return node_detect_result;
}
export async function realworld_which_npm() {
    let list = ['npm'];

    if (isWindows()) list = ['npm', '.npm'];
    if (singleton?.options?.debug === 'pmode1') list = ['npm'];
    if (singleton?.options?.debug === 'pmode2') list = ['.npm'];
    if (singleton?.options?.debug === 'pmode3') list = ['.npm', 'npm'];

    const node_detect_result = [];
    for (let i = 0; i < list.length; i++) {
        const name = list[i];
        await singleton.debug({ name }, 'realworld_which_node');
        const ppath = name[0] === '.' ? name.substring(1, Infinity) : await which(name);
        await singleton.debug({ path: ppath }, 'realworld_which_node');
        if (!ppath) continue;
        if (isBadStr(ppath)) throw ppath;
        return ppath;
    }
    if (isWindows()) {
        let commandList = [
            `Where.exe npm`,
            `Where npm`,
        ];
        try {
            let node_path = await getVarVal('NODE_PATH');
            if (node_path && node_path.trim()) return node_path.trim();
        } catch { }
        try {
            for (let i = 0; i < commandList.length; i++) {
                let nodeList = await execPlain(commandList[i]);
                let pathList = nodeList.stdout.split('\n').map(line => line.trim()).filter(Boolean);
                for (let i = 0; i < pathList.length; i++) {
                    const ppath = pathList[i];
                    if (ppath.endsWith('\\npm.exe')) { } else { continue }
                    return ppath;
                }
            }
        } catch { }
    }

    return node_detect_result;
}
export async function which(cmd) {
    if (cmd.indexOf(' ') > -1) process.exit(1);
    if (isWindows()) {
        const { stdout } = await execAdv(`(Get-Command ${cmd}).Source`)
        return stdout.trim();
    } else {
        return await new Promise(resolve => {
            shelljs_exec(`which ${cmd}`, { silent: true }, function (code, stdout, stderr) {
                if (code === 0) {
                    resolve(stdout.trim())
                } else {
                    resolve('')
                }
            });
        });
    }
};

export async function getPythonVenvPath() {
    const venv_path = await getVarVal('PYTHON_VENV_PATH');
    if (venv_path && await is_dir(venv_path)) {
        return venv_path;
    } else {
        return null;
    }
}
export async function getNodeVenvPath() {
    const venv_path = await getVarVal('NODE_VENV_PATH');
    if (venv_path && await is_dir(venv_path)) {
        return venv_path;
    } else {
        return null;
    }
}

export async function getPythonActivatePath() {
    const venv_path = await getVarVal('PYTHON_VENV_PATH');
    if (isWindows()) {
        return `${venv_path}\\Scripts\\Activate.ps1`;
    } else {
        return `${venv_path}/bin/activate`;
    }
}

export async function getPythonPipPath(app = 'python', venv = true) {
    await singleton.debug({ head: '-'.repeat(10) }, 'getPythonPipPath');
    const venv_path = await getVarVal('PYTHON_VENV_PATH');
    async function pythonPath() {
        try { return await realworld_which_python(); } catch (errorInfo) {
            await singleton.debug({ error: errorInfo, inside: true }, 'getPythonPipPath');
            printError(errorInfo);
        }
    }
    function getValue(result) {
        if (result?.constructor === String) return result;
    }
    await singleton.debug({ venv, app, win32: isWindows() }, 'getPythonPipPath');
    await singleton.debug({ venv_path }, 'getPythonPipPath');
    if (!venv) {
        const rwp = (await pythonPath());
        await singleton.debug({ rwp }, 'getPythonPipPath');
        return rwp;
    }
    let foundPath = ''
    try {
        const python = ['python', 'python3'].includes(app);
        const pip = ['pip', 'pip3'].includes(app);
        if (isWindows()) {
            if (python) foundPath = ([
                `${venv_path}\\Scripts\\python.exe`,
                `${venv_path}\\Scripts\\python3.exe`,
            ]).find(fs.existsSync) || getValue(await pythonPath());
            else if (pip) foundPath = ([
                `${venv_path}\\Scripts\\pip.exe`,
                `${venv_path}\\Scripts\\pip3.exe`,
            ]).find(fs.existsSync);
        } else {
            if (python) foundPath = ([
                `${venv_path}/bin/python`,
                `${venv_path}/bin/python3`,
            ]).find(fs.existsSync) || getValue(await pythonPath());
            else if (pip) foundPath = ([
                `${venv_path}/bin/pip`,
                `${venv_path}/bin/pip3`,
            ]).find(fs.existsSync);
        }
    } catch (errorInfo) {
        await singleton.debug({ error: errorInfo }, 'getPythonPipPath');
        printError(errorInfo);
    }
    await singleton.debug({ foundPath }, 'getPythonPipPath');
    return foundPath || '';
}


export async function pythonVenvCandidatePath() {
    let count = 0;
    let _path;
    while (true) {
        try {
            _path = `${os.homedir()}/.aiexe_python_venv${count ? `_${count}` : ''}`;
            if (await is_dir(_path)) { count++; continue; }
            await fsPromises.mkdir(_path)
            break;
        } catch (errorInfo) {
            printError(errorInfo);
            count++;
        }
    }
    return _path;
}
export async function nodeVenvCandidatePath() {
    let count = 0;
    let _path;
    while (true) {
        try {
            _path = `${os.homedir()}/.aiexe_node_venv${count ? `_${count}` : ''}`;
            if (await is_dir(_path)) { count++; continue; }
            await fsPromises.mkdir(_path)
            break;
        } catch (errorInfo) {
            printError(errorInfo);
            count++;
        }
    }
    return _path;
}
function containsUnicode(text) {
    const regex = /[^\u0000-\u007F]/;
    return regex.test(text);
}
function findStr(str, find) {
    return str.indexOf(find) === -1;
}

let _python_interpreter;
export async function checkPythonForTermination() {
    if (_python_interpreter) return _python_interpreter;
    let python_interpreter;
    try {
        python_interpreter = await getPythonPipPath('python', false);
    } catch (errorInfo) {
        // rare possibility
        await singleton.debug({ error: errorInfo }, 'checkPythonForTermination');
        printError(errorInfo);
    }
    if (python_interpreter && python_interpreter?.constructor === String && !isBadStr(python_interpreter)) {
        _python_interpreter = python_interpreter;
    }
    else if (python_interpreter && python_interpreter?.constructor === String && isBadStr(python_interpreter)) {
        return;
    }
    else if (python_interpreter && python_interpreter?.constructor === Array) {
        python_interpreter.forEach(candidate => {
            candidate.path = candidate.path.split('\\').join('/');
            candidate.unicode = candidate.path.split('/').filter(part => containsUnicode(part)).length > 0;
        });
        if (true) {
            const picked = python_interpreter.filter(candidate => findStr(candidate.path, '/'));
            const proper_candidate = picked.filter(candidate => !findStr(candidate.path, 'Microsoft/WindowsApps'));
            const placeHolders = picked.filter(candidate => findStr(candidate.path, 'Microsoft/WindowsApps'));
            if (proper_candidate.length) {
                for (let i = 0; i < proper_candidate.length; i++) {
                    const candidate = proper_candidate[i];
                    if (candidate.unicode) {
                    } else {
                        await strout(`${candidate.path} found but it couldn't pass the test`);
                    }
                }
            } else if (placeHolders.length) {
            }
        }
        return;
    }
    else if (!python_interpreter) {
        // rare possibility
        return;
    } else {
        // rare possibility
        return;
    }
    // if (true) _python_interpreter = python_interpreter;
    return _python_interpreter;
}


function oraStop() { }
function oraSucceed() { }
function oraStart() { }
function oraFail() { }
function strout() { }
function isTaskAborted() { }


export function getRequiredPackageNames(javascriptCode, prompts) { }