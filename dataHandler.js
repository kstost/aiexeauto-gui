import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as tar from 'tar';
import ora from 'ora';
import { runDockerContainer, getDockerInfo, importToDocker, exportFromDocker } from './docker.js';
import { getAppPath, getOSPathSeparator } from './system.js';
export async function validateAndCreatePaths(dataSourcePath) {
    // Validate data source path
    try {
        const sourceStats = fs.statSync(dataSourcePath);
        if (!sourceStats.isDirectory()) {
            throw new Error(`Data source path is not a directory: ${dataSourcePath}`);
        }
    } catch (err) {
        throw new Error(`Data source path does not exist: ${dataSourcePath}`);
    }
}
export async function getOutputPath(taskId) {
    let outputMotherDir = getAppPath('outputs');
    if (!fs.existsSync(outputMotherDir)) fs.mkdirSync(outputMotherDir, { recursive: true });
    return path.join(outputMotherDir, taskId);
}

export async function serializeFolder(folderPath) {
    const CHUNK_SIZE = 1024 * 1024;
    const chunks = [];
    const tempTarPath = getAppPath('AIEXE-data-handling-tmpfile.tar');
    try {
        await tar.create({ file: tempTarPath, cwd: path.dirname(folderPath) }, [path.basename(folderPath)]);
        const tarContent = await fs.promises.readFile(tempTarPath);
        for (let i = 0; i < tarContent.length; i += CHUNK_SIZE) {
            const chunk = tarContent.subarray(i, i + CHUNK_SIZE);
            chunks.push(chunk.toString('base64'));
        }
        await fs.promises.unlink(tempTarPath);
        return chunks;
    } catch (error) {
        try { await fs.promises.unlink(tempTarPath); } catch (cleanupError) { }
        throw error;
    }
}

export async function importData(page, dataSourcePath) {
    const spinner = ora('데이터 준비 중...').start();

    try {
        spinner.text = '데이터 직렬화 중...';
        const serializedData = await serializeFolder(dataSourcePath);

        spinner.text = '데이터 청크 생성 중...';
        const dataSourceName = getLastDirectoryName(dataSourcePath);
        const chunkedNames = [];
        for (let i = 0; i < serializedData.length; i++) {
            await page.evaluate(async (chunk, index) => {
                await window._electrons.mount(`data_${index}.base64.chunked`, chunk);
            }, serializedData[i], i);
            chunkedNames.push(`data_${i}.base64.chunked`);
        }
        const folderName = `${Math.random()}`;
        await page.evaluate(async (chunkedNames, dataSourceName, folderName) => {
            await window._electrons.spawn('npm', ['init', '-y']);
            await window._electrons.spawn('npm', ['install', 'tar']);
            await window._electrons.mount('join.js', `
                const fs = require('fs');
                const path = require('path');
                const tar = require('tar');

                // base64 청크들을 하나의 tar 파일로 결합
                fs.writeFileSync('data.tar', '');
                for (const name of ${JSON.stringify(chunkedNames)}) {
                    const chunk = fs.readFileSync(name, 'utf8');
                    const buffer = Buffer.from(chunk, 'base64');
                    fs.appendFileSync('data.tar', buffer);
                }

                // tar 파일 압축 해제
                tar.x({
                    file: 'data.tar',
                    sync: true
                });

                // 임시 파일 정리
                fs.unlinkSync('data.tar');
                for (const name of ${JSON.stringify(chunkedNames)}) {
                    fs.unlinkSync(name);
                }
                process.exit(0);
            `);
            await window._electrons.spawn('node', ['join.js']);

            await window._electrons.spawn('rm', ['join.js']);
            await window._electrons.spawn('rm', ['.*']);
            await window._electrons.spawn('mv', [dataSourceName, folderName]);
            const tmpJsFile = `code_${Math.random()}.js`;
            await window._electrons.mount(tmpJsFile, `
                const fs = require('fs');
                const path = require('path');
                (async()=>{
                    const items = await fs.promises.readdir('${folderName}');
                    const removeList = ['node_modules', '.git', '.vscode', 'AIEXE-data-handling-tmpfile.tar', 'package-lock.json', 'package.json'];
                    for (const item of removeList) {
                        const fullPath = '${folderName}/'+item;
                        if (fs.existsSync(fullPath)) { await fs.promises.rm(fullPath, { recursive: true, force: true }); }
                    }
                    {
                        const items = await fs.promises.readdir('${folderName}');
                        for (const item of items) {
                            await fs.promises.rename(path.join('${folderName}', item), item);
                        }
                    }                
                })();
            `);
            await window._electrons.spawn('node', [tmpJsFile]);
            await window._electrons.spawn('rm', [tmpJsFile]);
        }, chunkedNames, dataSourceName, folderName);

        await page.evaluate(async (folderName) => await window._electrons.spawn('rm', ['-rf', folderName]), folderName);

        spinner.text = '데이터 압축 해제 중...';
        // 압축 해제 로직...

        spinner.succeed('데이터 가져오기 완료');
    } catch (error) {
        spinner.fail('데이터 가져오기 실패');
        throw error;
    }
}

export async function exportData(page, dataSourcePath, dataOutputPath) {
    const spinner = ora('데이터 내보내기 준비 중...').start();

    try {
        spinner.text = '데이터 수집 중...';
        const dataSourceName = getLastDirectoryName(dataSourcePath);
        const dataOutputName = getLastDirectoryName(dataOutputPath);
        const executeResult = await page.evaluate(async (dataSourceName, dataOutputName) => {

            const exportData = `
            const fs = require('fs');
            const path = require('path');
            const tar = require('tar');

            async function serializeFolder(folderPath) {
                const CHUNK_SIZE = 1024 * 1024 * 10;
                const chunks = [];
                const tempTarPath = 'AIEXE-data-handling-tmpfile.tar';
                try {
                    await tar.create({ file: tempTarPath, cwd: path.dirname(folderPath) }, [path.basename(folderPath)]);
                    const tarContent = await fs.promises.readFile(tempTarPath);
                    for (let i = 0; i < tarContent.length; i += CHUNK_SIZE) {
                        const chunk = tarContent.subarray(i, i + CHUNK_SIZE);
                        chunks.push(chunk.toString('base64'));
                    }
                    await fs.promises.unlink(tempTarPath);
                    return chunks;
                } catch (error) {
                    try { await fs.promises.unlink(tempTarPath); } catch (cleanupError) { }
                    throw error;
                }
            }

            (async ()=>{
                await fs.promises.mkdir('${dataOutputName}');
                const items = await fs.promises.readdir('.');
                const removeList = [
                    'node_modules',
                    '.git',
                    '.vscode',
                    'AIEXE-data-handling-tmpfile.tar',
                    'AIEXE-data-handling-exportData.js',
                    'AIEXE-data-handling-operation.js',
                    'package-lock.json',
                    'package.json'
                ];
                for (const item of removeList) {
                    if (fs.existsSync(item)) {
                        await fs.promises.rm(item, { recursive: true, force: true });
                    }
                }
                for (const item of items) {
                    try { await fs.promises.rename(item, path.join('${dataOutputName}', item)); } catch { }
                }
                const serializedData = await serializeFolder('${dataOutputName}');
                const chunkedNames = [];
                for (let i = 0; i < serializedData.length; i++) {
                    const chunkName = \`.chunk_\${i}.base64.chunked\`;
                    chunkedNames.push(chunkName);
                    fs.writeFileSync(chunkName, serializedData[i]);
                }
                console.log(JSON.stringify(chunkedNames));
                process.exit(0);
            })();
            `;
            await window._electrons.mount('AIEXE-data-handling-exportData.js', exportData);
            const list = await window._electrons.spawn('node', ['AIEXE-data-handling-exportData.js']);
            return list;
        }, dataSourceName, dataOutputName);
        const chunkedNames = JSON.parse(executeResult.output);
        const fileList = [];
        for (const chunkName of chunkedNames) {
            const chunkContentBase64 = await page.evaluate(async (chunkName) => await window._electrons.spawn('cat', [chunkName]), chunkName);
            if (!fs.existsSync(dataOutputPath)) fs.mkdirSync(dataOutputPath, { recursive: true });
            fs.writeFileSync(path.join(dataOutputPath, chunkName), chunkContentBase64.output.trim());
            fileList.push(path.join(dataOutputPath, chunkName));
        }
        // base64 청크들을 하나의 tar 파일로 결합
        const tmpTarFile = 'AIEXE-data-handling-tmpfile.tar';
        fs.writeFileSync(path.join(dataOutputPath, tmpTarFile), '');
        for (const name of fileList) {
            const chunk = fs.readFileSync(name, 'utf8');
            const buffer = Buffer.from(chunk, 'base64');
            fs.appendFileSync(path.join(dataOutputPath, tmpTarFile), buffer);
        }

        // tar 파일 압축 해제
        tar.x({
            file: path.join(dataOutputPath, tmpTarFile),
            cwd: dataOutputPath,
            sync: true
        });

        // 임시 파일 정리
        fs.unlinkSync(path.join(dataOutputPath, tmpTarFile));
        for (const name of fileList) {
            fs.unlinkSync(name);
        }
        const name = getLastDirectoryName(dataOutputPath);
        const resultPath = path.join(dataOutputPath, name);
        let newPath;
        while (true) {
            newPath = path.join(dataOutputPath, `.${Math.random()}`);
            if (!fs.existsSync(newPath)) break;
        }
        await fs.promises.rename(resultPath, newPath);
        const items = await fs.promises.readdir(newPath);
        for (const item of items) {
            const sourcePath = path.join(newPath, item);
            const destPath = path.join(dataOutputPath, item);
            await fs.promises.rename(sourcePath, destPath);
        }
        await fs.promises.rmdir(newPath);

        spinner.text = '파일 생성 중...';
        // 파일 생성 로직...

        spinner.text = '데이터 압축 중...';
        // 압축 로직...

        spinner.succeed('데이터 내보내기 완료');
    } catch (error) {
        spinner.fail('데이터 내보내기 실패');
        throw error;
    }
}

export function getLastDirectoryName(path) {
    const parts = path.split(getOSPathSeparator()).filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : null;
}