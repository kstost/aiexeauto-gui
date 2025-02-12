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
import { join } from 'path';
import singleton from './singleton.js';
import { installProcess, shell_exec } from './codeExecution.js';
import { fileURLToPath } from 'url';
import { linuxStyleRemoveDblSlashes, ensureAppsHomePath } from './dataHandler.js';
import { is_dir } from './codeExecution.js';
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
    console.log('1.0.34');
    process.exit(0);
} else if (prompt === 'config') {
    let configKey = process.argv[3];
    let configValue = process.argv[4];
    (async () => {
        await setConfiguration(configKey, configValue);
        console.log(`${chalk.cyan(configKey)} ${chalk.green('설정이 완료되었습니다.')}`);
        process.exit(0);
    })();
} else {
    if (false) {
        await installProcess(false);
        let resutl = await shell_exec('print(json)');
        console.log(resutl);
    }

    const apiMethods = {
        async clear_output_data(body) {
            let outputPath = getAppPath('outputs');
            if (fs.existsSync(outputPath)) {
                // [remove.001] rm - /Users/kst/.aiexeauto/workspace/outputs
                if ((ensureAppsHomePath(outputPath)) && linuxStyleRemoveDblSlashes(outputPath).includes('/.aiexeauto/workspace/') && await is_dir(outputPath) && outputPath.startsWith(getHomePath('.aiexeauto/workspace'))) {
                    console.log(`[remove.001] rm - ${outputPath}`);
                    await fs.promises.rm(outputPath, { recursive: true });
                } else {
                    console.log(`[remove.001!] rm - ${outputPath}`);
                }

            }
        },
        async open_output_folder(body) {
            let outputPath = getAppPath('outputs');
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
            const currentVersion = app.getVersion();
            try {
                const packageUrl = `https://raw.githubusercontent.com/kstost/aiexeauto-gui/refs/heads/main/package.json`;
                const response = await fetch(packageUrl);
                const data = await response.json();
                return { latest: data.version, client: currentVersion };
            } catch (err) {
                return null;
            }
        },
        async ve1nppvpath(body) {
            // ㅊ...
            console.log(body);
            return await application(body.prompt, body.inputFolderPath, body.outputFolderPath);
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
    async function application(prompt, dataSourcePath, dataOutputPath) {
        const taskId = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${Math.random().toString(36).substring(2, 15)}`;
        singleton.missionAborting = false;
        const interfaces = {
            async operation_done(body) {
                await reqRenderer('operation_done', body)
            },
            async out_stream(body) {
                console.log('out_stream....', body);
                await reqRenderer('out_stream', body)
            },
            async out_print(data) {
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
                // console.log(...data);
                let labelId = await reqRenderer('out_state', { stateLabel: data })
                return {
                    async dismiss() {
                        await reqRenderer('dismiss', { labelId: labelId })
                    },
                    async succeed(data) {
                        await reqRenderer('succeed', { stateLabel: data, labelId: labelId })
                    },
                    async fail(data) {
                        await reqRenderer('fail', { stateLabel: data, labelId: labelId })
                    },
                }
            }
        };
        console.log('dataSourcePath', dataSourcePath);
        console.log('dataOutputPath', dataOutputPath);
        dataOutputPath = await getOutputPath(taskId);
        let dataSourceNotAssigned = !dataSourcePath;
        let dataOutputNotAssigned = !dataOutputPath;
        let odrPath = dataOutputPath;
        if (dataSourceNotAssigned) {
            dataSourcePath = await prepareOutputDir(path.join(getAppPath('.tempwork'), 'data'), false);
        }
        dataOutputPath = await prepareOutputDir(path.join(getAppPath('.tempwork'), 'output'), false);
        let resultPath;
        try {
            await solveLogic({ taskId, multiLineMission: prompt, dataSourcePath, dataOutputPath, interfaces, odrPath });
        } catch (err) {
        } finally {
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
                    if (files.length > 0) {
                        await open(outputPath);
                        resultPath = outputPath;
                    }
                } catch (err) {
                }
            }
        }
        return resultPath;
        // })();

    }
    if (true) {

        const devmode = false;
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
