import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { debugLog, getConfiguration } from './system.js';
import { isWindows } from './codeExecution.js';
export async function findExecutable(list) {
    list = list.filter(item => item.startsWith(process.platform === 'win32' ? item.match(/^[A-Z]:\\/) ? item : '' : '/'));
    list = list.map(item => item.trim());
    list = [...new Set(list)];
    for (const path of list) {
        try {
            await fs.promises.access(path, fs.constants.X_OK);
            return path;
        } catch (error) { }
    }
    return '';
}
export async function getDockerPath() {
    return await findExecutable([
        'C:\\Program Files\\Docker\\Docker\\docker.exe',
        'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
        'C:\\Program Files\\Docker\\Docker\\resources\\docker.exe',
        'C:\\Program Files (x86)\\Docker\\Docker\\docker.exe',
        'C:\\Program Files\\Docker\\docker.exe',
        'C:\\Docker\\Docker\\docker.exe',
        'C:\\Program Files\\Docker\\Docker\\cli\\docker.exe',
        'C:\\Program Files\\Docker\\docker\\resources\\bin\\docker.exe',
        'C:\\Program Files (x86)\\Docker\\docker.exe',
        '/usr/bin/docker',
        '/opt/homebrew/bin/docker',
        '/opt/local/bin/docker',
        '/usr/local/bin/docker',
        '/usr/local/sbin/docker',
        '/usr/sbin/docker',
        '/usr/local/docker/bin/docker',
        '/usr/local/share/docker/docker',
        '/Applications/Docker.app/Contents/Resources/bin/docker',
        '/var/lib/docker/bin/docker',
        '/usr/local/lib/docker/bin/docker',
        '/usr/local/docker/docker',
        '/usr/local/opt/docker/bin/docker',
        '/opt/bin/docker',
        '/usr/local/etc/docker/bin/docker',
    ]);
}
export async function getPythonPath() {
    const homePath = os.homedir();
    const list = [
        `${homePath}\\AppData\\Local\\Programs\\Python\\Python313\\python.exe`,
        `${homePath}\\AppData\\Local\\Programs\\Python\\Python312\\python.exe`,
        `${homePath}\\AppData\\Local\\Programs\\Python\\Python311\\python.exe`,
        `${homePath}\\AppData\\Local\\Programs\\Python\\Python310\\python.exe`,
        'C:\\Python\\python.exe',
        'C:\\Python27\\python.exe',
        'C:\\Python36\\python.exe',
        'C:\\Python37\\python.exe',
        'C:\\Python38\\python.exe',
        'C:\\Python39\\python.exe',
        'C:\\Python310\\python.exe',
        'C:\\Program Files\\Python\\python.exe',
        'C:\\Program Files\\Python27\\python.exe',
        'C:\\Program Files\\Python36\\python.exe',
        'C:\\Program Files\\Python37\\python.exe',
        'C:\\Program Files\\Python38\\python.exe',
        'C:\\Program Files\\Python39\\python.exe',
        'C:\\Program Files\\Python310\\python.exe',
        'C:\\Program Files (x86)\\Python\\python.exe',
        '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3',
        '/Library/Frameworks/Python.framework/Versions/3.13/bin/python3',
        '/Library/Frameworks/Python.framework/Versions/3.12/bin/python3',
        '/Library/Frameworks/Python.framework/Versions/3.11/bin/python3',
        '/Library/Frameworks/Python.framework/Versions/3.10/bin/python3',
        '/usr/bin/python3',
        '/usr/bin/python',
        '/usr/local/bin/python3',
        '/usr/local/bin/python',
        '/opt/homebrew/bin/python3',
        '/opt/homebrew/bin/python',
        '/opt/local/bin/python3',
        '/opt/local/bin/python',
        '/usr/local/bin/python',
        '/usr/bin/python',
        '/opt/homebrew/bin/python',
        '/opt/local/bin/python',
        '/usr/local/bin/python3',
        '/usr/bin/python3',
        '/opt/homebrew/bin/python3',
        '/opt/local/bin/python3',
    ];
    for (const path of list) {
        const candidate_path = await findExecutable([path]);
        if (candidate_path) {
            const result = await execAsync(`"${candidate_path}" -c "print(str('A'*5));"`);
            if (result.trim() === 'AAAAA') return candidate_path;
        }
    }
    return '';
}

export async function getNodePath() {
    const homePath = os.homedir();
    const list = [
        `${homePath}\\AppData\\Local\\Programs\\nodejs\\node.exe`,
        'C:\\Program Files\\nodejs\\node.exe',
        'C:\\Program Files (x86)\\nodejs\\node.exe',
        'C:\\ProgramData\\chocolatey\\bin\\node.exe',
        '/usr/bin/node',
        '/usr/local/bin/node',
        '/opt/homebrew/bin/node',
        '/opt/local/bin/node',
        '/usr/bin/node',
        '/usr/local/bin/node',
        '/opt/homebrew/bin/node',
        '/opt/local/bin/node',
        '/usr/bin/node',
        '/usr/local/bin/node',
        '/opt/homebrew/bin/node',
        '/opt/local/bin/node',
    ];
    for (const path of list) {
        const candidate_path = await findExecutable([path]);
        if (candidate_path) {
            const result = await execAsync(`"${candidate_path}" -e "console.log(String('A'.repeat(5)));"`);
            if (result.trim() === 'A'.repeat(5)) return candidate_path;
        }
    }
    return '';
}

export async function getNPMPath() {
    const homePath = os.homedir();
    const list = [
        `${homePath}\\AppData\\Roaming\\npm\\npm.cmd`,
        `${homePath}\\AppData\\Roaming\\npm\\npm.exe`,
        `${homePath}\\AppData\\Local\\Programs\\nodejs\\npm.cmd`,
        `${homePath}\\AppData\\Local\\Programs\\nodejs\\npm.exe`,
        `${homePath}\\AppData\\Local\\Programs\\nodejs\\npm.cmd`,
        `${homePath}\\AppData\\Local\\Programs\\nodejs\\npm.exe`,
        'C:\\Program Files\\nodejs\\npm.cmd',
        'C:\\Program Files\\nodejs\\npm.exe',
        'C:\\Program Files (x86)\\nodejs\\npm.cmd',
        'C:\\Program Files (x86)\\nodejs\\npm.exe',
        'C:\\ProgramData\\chocolatey\\bin\\npm.cmd',
        '/usr/bin/npm',
        '/usr/local/bin/npm',
        '/opt/homebrew/bin/npm',
        '/opt/local/bin/npm',
        '/usr/bin/npm',
        '/usr/local/bin/npm',
        '/opt/homebrew/bin/npm',
        '/opt/local/bin/npm',
    ];
    for (const path of list) {
        const candidate_path = await findExecutable([path]);
        if (candidate_path) {
            try {
                let command;
                if (isWindows()) {
                    command = `"${candidate_path}" -v`;
                } else {
                    const nodePath = await getNodePath();
                    command = `"${nodePath}" "${candidate_path}" -v`;
                }
                const result = await execAsync(command);
                const version = result.toString().trim().match(/(\d+)\.(\d+)\.(\d+)/);
                if (version) {
                    return candidate_path;
                }
            } catch (error) {
                // 오류 무시
            }
        }
    }
    return '';
}

async function execAsync(command) {
    const homePath = os.homedir();
    return await new Promise((resolve, reject) => {
        exec(command, { cwd: homePath }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            if (stderr) {
            }
            resolve(stdout);
        });
    });
}
