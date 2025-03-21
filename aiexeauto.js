#!/usr/bin/env node
// node server.js "make three folders named folder_0, folder_1, folder_2"

import { solveLogic } from './solveLogic.js';
import { getCodePath, findAvailablePort, getAbsolutePath, validatePath, prepareOutputDir, getAppPath, getConfiguration, setConfiguration, flushFolder, getHomePath } from './system.js';
import { validateAndCreatePaths, getOutputPath } from './dataHandler.js';
import fs from 'fs';
import boxen from 'boxen';
import chalk from 'chalk';
import path from 'path';
import { app, BrowserWindow, ipcMain, globalShortcut, Menu, dialog } from 'electron';
import open from 'open';
import { connectAllServers, closeAllServers, convertToolsInfoToAIEXEStyle, getAllToolNames, getToolsClientByToolName, getToolsInfoByToolName, getMCPNameByToolName } from './mcp.js';
import { join } from 'path';
import singleton from './singleton.js';
import { installProcess, shell_exec } from './codeExecution.js';
import { fileURLToPath } from 'url';
import { linuxStyleRemoveDblSlashes, ensureAppsHomePath } from './dataHandler.js';
import { is_dir } from './codeExecution.js';
import { exportFromDockerForDataCheck } from './docker.js';
import { cloneCustomTool, getToolList, supportLanguage, toolSupport, getCustomToolList, getMCPToolList } from './system.js';
import envConst from './envConst.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function reqRenderer(mode, arg) {
    if (!singleton?.reqsAPI) return;
    return await singleton?.reqsAPI(mode, arg);
}

export function isTaskAborted(taskId) {
    if (!taskId) return false;
    return !!(singleton.abortQueue[taskId]);
}

let prompt = process.argv[2];
if (prompt === 'version') {
    process.exit(0);
} else if (prompt === 'config') {
    let configKey = process.argv[3];
    let configValue = process.argv[4];
    (async () => {
        await setConfiguration(configKey, configValue);
        process.exit(0);
    })();
} else {
    if (false) {
        await installProcess(false);
        let resutl = await shell_exec('print(json)');
    }

    const apiMethods = {
        async clear_output_data(body) {
            let list = [
                getAppPath('outputs'),
                getAppPath('preview'),
                getAppPath('.tempwork'),
                getAppPath('logs_txt'),
                getAppPath('retrival'),
                getAppPath('coderun'),
                getAppPath('list'),
            ];
            for (let i = 0; i < list.length; i++) {
                let outputPath = list[i];
                if (fs.existsSync(outputPath)) {
                    // [remove.001] rm - /Users/kst/.aiexeauto/workspace/outputs
                    if ((ensureAppsHomePath(outputPath)) && linuxStyleRemoveDblSlashes(outputPath).includes('/.aiexeauto/workspace/') && await is_dir(outputPath) && outputPath.startsWith(getHomePath('.aiexeauto/workspace'))) {
                        console.log(`[remove.001] rm - ${outputPath}`);
                        await fs.promises.rm(outputPath, { recursive: true });
                    } else {
                        console.log(`[remove.001!] rm - ${outputPath}`);
                    }
                }
            }
        },
        async open_output_folder(body) {
            const useDocker = await getConfiguration('useDocker');
            let outputPath = useDocker ? getAppPath('outputs') : getAppPath('coderun');
            if (fs.existsSync(outputPath)) {
                await open(outputPath);
                return true;
            }
            return false;
        },
        async selector_folder(body) {
            const window = singleton.electronWindow;
            const result = await dialog.showOpenDialog(window, {
                properties: ['openDirectory']  // 폴더 선택 전용 다이얼로그
            });
            if (!result.canceled && result.filePaths.length > 0) {
                return result.filePaths[0];
            }
            return null;
        },
        // async raise_sigint_aborting(body) {
        //     return;
        //     // console.log('aborting......');
        //     // process.kill(process.pid, 'SIGINT');
        //     // console.log('aborting...................');
        //     // return true;
        // },
        async get_version() {
            singleton.lang = await getConfiguration('captionLanguage');
            const currentVersion = app.getVersion();
            try {
                if (Math.random() > 0.1) return { latest: currentVersion, client: currentVersion };
                const packageUrl = `https://raw.githubusercontent.com/kstost/aiexeauto-gui/refs/heads/main/package.json`;
                const response = await fetch(packageUrl);
                const data = await response.json();
                return { latest: data.version, client: currentVersion };
            } catch (err) {
                return null;
            }
        },
        async toolList(body) {
            await cloneCustomTool();
            if (body.open) {
                const customPath = '.aiexeauto/custom_tools';
                const workspace = getHomePath(customPath);
                await open(workspace);
            }
            return await getToolList();
        },
        async saveWork(body) {
            let { filename, data } = body;
            let path = getAppPath('list/' + filename);
            if (ensureAppsHomePath(path)) {
                await fs.promises.writeFile(path, JSON.stringify(data, null, 2));
                return true;
            } else {
            }

            return false;
        },
        async loadWork(body) {
            let { filename } = body;
            let path = getAppPath('list/' + filename);
            if (fs.existsSync(path)) {
                return JSON.parse(fs.readFileSync(path, 'utf8'));
            }
        },
        // async getNewFileName(body) {
        //     const path = getAppPath('list');
        //     if (!fs.existsSync(path)) {
        //         await fs.promises.mkdir(path, { recursive: true });
        //     }
        //     let resultPath;
        //     while (true) {
        //         let randomName = Math.random().toString();
        //         resultPath = randomName + '.json';
        //         if (!fs.existsSync(path + '/' + resultPath)) {
        //             break;
        //         }
        //         await new Promise(resolve => setTimeout(resolve, 10)); // 약간의 딜레이
        //     }
        //     if (ensureAppsHomePath(path + '/' + resultPath)) {
        //         await fs.promises.writeFile(path + '/' + resultPath, '{}');
        //         return { filename: resultPath };
        //     }
        //     return null;
        // },
        async worklist(body) {
            const path = getAppPath('list');
            if (!fs.existsSync(path)) {
                await fs.promises.mkdir(path, { recursive: true });
            }
            let list = await fs.promises.readdir(path);
            list.sort((a, b) => {
                let aTime = fs.statSync(getAppPath('list/' + a)).mtime.getTime();
                let bTime = fs.statSync(getAppPath('list/' + b)).mtime.getTime();
                return bTime - aTime;
            });
            list = list.map(item => {
                try {
                    const filepath = getAppPath('list/' + item);
                    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                    return data;
                } catch { }
            }).filter(item => item);
            return { list };
        },
        async openFolder(body) {
            await open(body.resultPath);
            return true;
        },
        async ve1nppvpath(body) {
            // ㅊ...
            // console.log(body);
            return await application(body.prompt, body.inputFolderPath, body.outputFolderPath, body.containerIdToUse, body.processTransactions, body.talktitle, body.reduceLevel);
        },
        async ve1nvpath(body) {
            if (false) if (isTaskAborted(body.__taskId)) return;
            return [[[await reqRenderer('errnotify', body)]]];
        },
        async getconfig(body) {
            return await getConfiguration(body.key);
        },
        async setconfig(body) {
            return await setConfiguration(body.key, body.value);
        },
        async openwebsite(body) {
            return await open(body.url);
        }
    }
    async function application(prompt, dataSourcePath, dataOutputPath, containerIdToUse, processTransactions, talktitle, reduceLevel) {
        if (!reduceLevel) reduceLevel = 0;
        const taskId = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${Math.random().toString(36).substring(2, 15)}`;
        // console.log('taskId', taskId);
        singleton.missionAborting = false;
        const interfaces = {
            async operation_done(body) {
                await reqRenderer('operation_done', body)
            },
            async out_stream(body) {
                await reqRenderer('out_stream', body)
            },
            async out_print(data) {
                // ㅑㄹ 
                // if(!data.data)
                // console.log('out_print....', data);
                // console.log(...data);
                await reqRenderer('out_print', data)
            },
            async percent_bar(data) {
                // console.log(...data);
                let labelId = await reqRenderer('percent_bar', data)

                // destroy() {
                //     percentBar[id].destroy();
                //     delete percentBar[id];
                // },
                // onetick() {
                //     // await new Promise(resolve => setTimeout(resolve, 1000));
                //     waitTime--;
                //     percentBar[id].update({ second: waitTime });
                //     if (waitTime <= 0) {
                //         this.destroy();
                //         return false;
                //     }
                //     return true;
                // }

                return {
                    async onetick() {
                        return await reqRenderer('onetick', { labelId: labelId })
                    },
                    async destroypercentbar() {
                        await reqRenderer('destroypercentbar', { labelId: labelId })
                    }
                }
            },
            async await_prompt(body) {
                // return await prompt(data);
                return await reqRenderer('await_prompt', body)

            },
            async out_state(data) {
                let labelId = await reqRenderer('out_state', { stateLabel: data })
                // let ticket = singleton.addState(labelId);
                return {
                    async dismiss() {
                        await reqRenderer('dismiss', { labelId: labelId })
                        // singleton.removeState(ticket);
                    },
                    async succeed(data) {
                        await reqRenderer('succeed', { stateLabel: data, labelId: labelId })
                        // singleton.removeState(ticket);
                    },
                    async fail(data) {
                        await reqRenderer('fail', { stateLabel: data, labelId: labelId })
                        // singleton.removeState(ticket);
                    },
                }
            }
        };
        dataOutputPath = await getOutputPath(taskId);
        let dataSourceNotAssigned = !dataSourcePath;
        let dataOutputNotAssigned = !dataOutputPath;
        let odrPath = dataOutputPath;
        if (dataSourceNotAssigned) {
            dataSourcePath = await prepareOutputDir(path.join(getAppPath('.tempwork'), 'data'), false);
        }
        dataOutputPath = await prepareOutputDir(path.join(getAppPath('.tempwork'), 'output'), false);
        let resultPath;
        let exported;
        let containerId;
        // let processTransactions;

        // getToolsClientByToolName
        // await get
        try {
            let solved = await solveLogic({ taskId, multiLineMission: prompt, dataSourcePath, dataOutputPath, interfaces, odrPath, containerIdToUse, processTransactions, talktitle, reduceLevel });
            exported = solved.exported;
            containerId = solved.containerId;
            processTransactions = solved.processTransactions;
            talktitle = solved.talktitle;
            reduceLevel = solved.reduceLevel;
        } catch (err) {
        } finally {
            await closeAllServers();
            if (dataSourceNotAssigned) {
                await flushFolder([dataSourcePath]);
            }
            if (dataOutputNotAssigned) {
                await flushFolder([dataOutputPath]);
            }
            if (fs.existsSync(dataOutputPath)) {
                let over = false;
                let outputCandidate = odrPath;
                let outputPath = await prepareOutputDir(outputCandidate, over, true);
                try {
                    await fs.promises.rename(dataOutputPath, outputPath);
                } catch (err) {
                    if (err.code === 'EXDEV') {
                        if (ensureAppsHomePath(dataOutputPath) && ensureAppsHomePath(outputPath)) {
                            console.log(`[remove.002] cp,rm - ${dataOutputPath}`);
                            await fs.promises.cp(dataOutputPath, outputPath, { recursive: true });
                            await fs.promises.rm(dataOutputPath, { recursive: true });
                        } else {
                            console.log(`[remove.002!] cp,rm - ${dataOutputPath}`);
                        }
                    }
                }
                try {
                    await fs.promises.access(outputPath);
                    const files = await fs.promises.readdir(outputPath);
                    if (files.length > 0 && exported) {
                        // await open(outputPath);
                        resultPath = outputPath;
                    }
                } catch (err) {
                }
            }
        }
        return { resultPath, containerId, processTransactions, talktitle, reduceLevel };
        // })();

    }
    if (false) {
        singleton.serverClients = await connectAllServers();
        // Add result raw: { content: [ { type: 'text', text: '8' } ] }
        const client = await getToolsClientByToolName(singleton.serverClients, 'md5hash1');
        const toolInfo = await getToolsInfoByToolName(singleton.serverClients, 'md5hash1');
        console.log('client', client);
        console.log('toolInfo', toolInfo);
        // await get
        process.exit(0);
    }
    if (true) {

        const devmode = envConst.devmode;
        function createWindow() {
            const win = new BrowserWindow({
                show: false, // 처음에 창을 숨깁니다.
                webPreferences: {
                    preload: join(__dirname, 'static/preload.mjs'),
                    sandbox: false,
                    contextIsolation: true,
                },
                icon: path.join(__dirname, 'assets', 'icon.png') // 경로를 올바르게 설정

            });

            win.loadFile('index.html');
            if (true) win.once('ready-to-show', () => {
                win.maximize(); // 창을 최대화합니다.
                win.show(); // 창을 보여줍니다.
                if (devmode) win.webContents.openDevTools(); // 개발자 도구 열기
                // if (process.env.NODE_ENV === 'development') {
                // }
            });

            // View 메뉴 재설정
            const menuTemplate = [
                {
                    label: 'App',
                    submenu: [
                        {
                            label: 'About AIEXEAUTO',
                            click: async () => {
                                await open('https://youtu.be/dvx-gFx6nUw?si=o3w0knQXdQ_H3q8H');
                            }
                        },
                        { type: 'separator' },
                        {
                            role: 'quit',
                            accelerator: 'CommandOrControl+Q'
                        }
                    ]
                },
                {
                    label: 'Edit',
                    submenu: [
                        { role: 'undo', accelerator: 'CommandOrControl+Z' },
                        { role: 'redo', accelerator: 'Shift+CommandOrControl+Z' },
                        { type: 'separator' },
                        { role: 'cut', accelerator: 'CommandOrControl+X' },
                        { role: 'copy', accelerator: 'CommandOrControl+C' },
                        { role: 'paste', accelerator: 'CommandOrControl+V' },
                        { role: 'pasteandmatchstyle' },
                        { role: 'delete' },
                        { role: 'selectall', accelerator: 'CommandOrControl+A' }
                    ]
                },

                {
                    label: 'View',
                    submenu: devmode ? [
                        {
                            role: 'reload',
                            accelerator: 'CommandOrControl+R'
                        },
                        {
                            role: 'toggledevtools',
                            accelerator: 'Alt+CommandOrControl+I'
                        },
                        { role: 'resetzoom' },
                        { role: 'zoomin' },
                        { role: 'zoomout' },
                        { type: 'separator' },
                        { role: 'togglefullscreen' }
                    ] : [
                        { role: 'resetzoom' },
                        { role: 'zoomin' },
                        { role: 'zoomout' },
                        { type: 'separator' },
                        { role: 'togglefullscreen' }
                    ]
                },

                // 다른 메뉴 항목 추가
            ];

            const menu = Menu.buildFromTemplate(menuTemplate);
            Menu.setApplicationMenu(menu);



            singleton.electronWindow = win;
        }

        app.whenReady().then(createWindow);

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });

        ipcMain.on('request', async (event, arg) => {
            try { arg.arg.__taskId = arg.taskId; } catch { }
            const result = await apiMethods[arg.mode](arg.arg)
            if (singleton.abortQueue[arg.taskId]) {
                if (false) delete singleton.abortQueue[arg.taskId];
                event.reply('response', { arg: null, abortedByRenderer: true, taskId: arg.taskId });
            } else {
                event.reply('response', { arg: result, taskId: arg.taskId });
            }
        });
        ipcMain.on('onewayreq', async (event, arg) => {
            try {
                const data = arg.arg;
                const mode = arg.mode;
                if (mode === 'planEditable') {
                    await setConfiguration('planEditable', data.checked);
                }
                if (mode === 'autoCodeExecution') {
                    await setConfiguration('autoCodeExecution', data.checked);
                }
                if (mode === 'modify_mission') {
                    // singleton.modifiedMission = data;
                }
                if (mode === 'data_check') {
                    const dataOutputPath = getAppPath('preview/previewData');
                    await fs.promises.mkdir(dataOutputPath, { recursive: true });
                    if (!singleton.currentWorkingContainerId) throw null;
                    let prepared = await exportFromDockerForDataCheck(singleton.currentWorkingContainerId, dataOutputPath)
                    if (prepared) {
                        await open(prepared);
                    }
                }
            } catch {

            } finally {
                event.reply('onewayreqres', arg);
            }
        });

        ipcMain.on('aborting', async (event, arg) => {
            singleton.abortQueue[arg.taskId] = true;
            // arg.taskIds.forEach(taskId => {
            // });
            event.reply('aborting_queued', arg);
        });
        ipcMain.on('raise_sigint_aborting', async (event, arg) => {
            process.emit('SIGINT');
            event.reply('raise_sigint_aborting_response', arg);
        });
        ipcMain.on('mission_aborting', async (event, arg) => {
            process.emit('SIGINT');
            singleton.missionAborting = true;
            singleton.abortController.forEach(c => c.abort());
            singleton.abortController = [];
            event.reply('mission_aborting_response', arg);
        });
        ipcMain.on('openwebsite', async (event, arg) => {
            await open(arg.url);
            // event.reply('openwebsite_response', arg);
        });

        // ipcMain.on('select-directory', async (event, arg) => {
        //     const window = singleton.electronWindow;
        //     // console.log('select-directory', window);
        //     const result = await dialog.showOpenDialog(window, {
        //         properties: ['openDirectory']  // 폴더 선택 전용 다이얼로그
        //     });
        //     if (!result.canceled && result.filePaths.length > 0) {
        //         // 선택한 폴더의 절대 경로를 renderer 프로세스로 전송
        //         // event.reply('selected-folder', result.filePaths[0]);
        //         await reqRenderer('selected_folder', result.filePaths[0])

        //     }

        //     // const result = await window.showDirectoryPicker();
        //     // event.reply('select-directory', result);
        // });





        let counter = 0;
        let queue = {};
        function getUnique() { return ++counter; }
        async function reqsAPI(mode, arg) {
            if (!singleton?.electronWindow) return;
            const mainWindow = singleton?.electronWindow;
            let taskId = getUnique();
            let _resolve;
            let promise = new Promise(resolve => _resolve = resolve);
            queue[taskId] = _resolve;
            // console.log('requesting', { mode, taskId, arg });
            mainWindow.webContents.send('requesting', { mode, taskId, arg });
            let dt = await promise;
            return dt;
        }
        ipcMain.on('resolving', async (event, arg) => {
            let fn = queue[arg.taskId];
            delete queue[arg.taskId];
            fn(arg.arg);
        });
        singleton.reqsAPI = reqsAPI;
        // setTimeout(async () => {
        //     console.log(await reqRenderer('errnotify', 123));
        //     //     // win.webContents.send('response1', { message: 'Hello from Main Process!' });
        //     //     console.log(await singleton?.reqsAPI('namee', { aaa: 33 }));
        // }, 1000)


    } else { }
}
