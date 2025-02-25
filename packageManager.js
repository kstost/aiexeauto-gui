import puppeteer from 'puppeteer';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { highlight } from 'cli-highlight';
import ora from 'ora';
import boxen from 'boxen';
import axios from 'axios';

import { importData, exportData } from './dataHandler.js';
import { chatCompletion, getModel } from './aiFeatures.js';
import { isInstalledNpmPackage, installNpmPackage, checkValidSyntaxJavascript, stripFencedCodeBlocks, runCode, getRequiredPackageNames } from './codeExecution.js';
import { getLastDirectoryName } from './dataHandler.js';
import { getDockerInfo, runDockerContainer, killDockerContainer, runDockerContainerDemon, importToDocker, exportFromDocker, isInstalledNodeModule, installNodeModules, runNodeJSCode, runPythonCode, doesDockerImageExist, isInstalledPythonModule, installPythonModules } from './docker.js';
import { getToolList, getToolData, getAppPath } from './system.js';
import { getUseDocker } from './system.js';
import fs from 'fs';
import { getConfiguration } from './system.js';
import { actDataParser } from './actDataParser.js';
import { makeCodePrompt } from './makeCodePrompt.js';
import { makeRealTransaction } from './makeRealTransaction.js';
import singleton from './singleton.js';
// singleton
// getAppPath

function ignorePackages(packageList) {
    if (!packageList) return [];
    const ignorePackages = [
        // ...Object.keys(singleton.installedPackages),
        `listDirectory`,
        `aptInstall`,
        `child_process`,
        `whichCommand`,
        `fs`,
        `runCommand`,
        `readFile`,
        `removeFile`,
        `removeDirectory`,
        `renameFileOrDirectory`,
    ];
    return packageList.filter(packageName => !ignorePackages.includes(packageName));
}
export async function installPackages(requiredPackageNames, pythonCode, javascriptCode, useDocker, containerId, dockerWorkDir, spinners, out_state, createSpinner, await_prompt) {
    if (!requiredPackageNames) requiredPackageNames = [];
    if (requiredPackageNames && requiredPackageNames.constructor === Array) {
        requiredPackageNames = ignorePackages(requiredPackageNames);
        for (const packageName of requiredPackageNames) {
            console.log('패키지 설치 시작:', packageName);
            console.log('현재 상태 - pythonCode:', !!pythonCode, 'javascriptCode:', !!javascriptCode);

            if (!pythonCode && javascriptCode) {
                console.log('JavaScript 패키지 설치 흐름 진입');
                const pid8 = await out_state(`${packageName} 패키지 확인 중...`);
                let installed = useDocker ? await isInstalledNodeModule(containerId, dockerWorkDir, packageName) : isInstalledNpmPackage(packageName);
                console.log('패키지 설치 여부:', installed, 'Docker 사용:', useDocker);
                await pid8.dismiss();
                if (!installed) {
                    // spinners.iter = createSpinner(`${packageName} 설치중.....`);
                    const pid7 = await out_state(`${packageName} 설치중.....`);

                    if (await getUseDocker()) {
                        console.log('Docker 환경에서 Node 모듈 설치 시작');
                        // let confirmed = await await_prompt({ mode: 'install_node_modules', containerId, dockerWorkDir, packageName });
                        // console.log('Docker Node 설치 확인:', confirmed);
                        await installNodeModules(containerId, dockerWorkDir, packageName);
                        console.log('Docker Node 모듈 설치 완료');
                    } else {
                        // Local Environment
                    }

                    // if (spinners.iter) {
                    // spinners.iter.succeed(`${packageName} 설치 완료`);
                    await pid7.succeed(`${packageName} 설치 완료`);
                    // console.log('스피너 상태 업데이트 완료');
                    // }
                }
            } else if (!javascriptCode && pythonCode) {
                console.log('Python 패키지 설치 흐름 진입');
                // let confirmed = await await_prompt({ mode: 'install_python_module', containerId, dockerWorkDir, packageName });
                // console.log('Python 설치 확인:', confirmed);

                const pid8 = await out_state(`${packageName} 패키지 확인 중...`);
                let installed = await isInstalledPythonModule(containerId, dockerWorkDir, packageName);
                console.log('Python 패키지 설치 여부:', installed);
                await pid8.dismiss();

                if (!installed) {
                    // spinners.iter = createSpinner(`${packageName} 설치중...`);
                    const pid8 = await out_state(`${packageName} 설치중...`);

                    if (await getUseDocker()) {
                        console.log('Docker 환경에서 Python 모듈 설치 시작');
                        // let confirmed = await await_prompt({ mode: 'install_python_module', containerId, dockerWorkDir, packageName });
                        // console.log('Docker Python 설치 확인:', confirmed);
                        await installPythonModules(containerId, dockerWorkDir, packageName);
                        console.log('Docker Python 모듈 설치 완료');
                    } else {
                        // Local Environment
                    }

                    // if (spinners.iter) {
                    // spinners.iter.succeed(`${packageName} 설치 완료`);
                    await pid8.succeed(`${packageName} 설치 완료`);
                    // console.log('스피너 상태 업데이트 완료');
                    // }
                }
            }
            console.log('패키지 설치 완료:', packageName);
        }
    }
    return requiredPackageNames;
}