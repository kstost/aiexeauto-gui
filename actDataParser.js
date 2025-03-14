import axios from 'axios';
import puppeteer from 'puppeteer';
import { caption } from './system.js';
// import marked from 'marked';
import TurndownService from 'turndown';
import { getToolCode, getToolData, convertJsonToResponseFormat, sortKeyOfObject } from './system.js';
export async function actDataParser({ actData, processTransactions, out_state }) {
    console.log('actDataParser!!!!!!!!!!!!!!!!!!!!!!', actData);
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
    async function loadToolCode(actData) {
        const code = await getToolCode(actData.name);
        if (!code) return '';
        return [
            // code,
            `(async()=>{try{await (${code})(${JSON.stringify(actData.input)});}catch{}})();`,
        ].join('\n');
    }
    let javascriptCode, requiredPackageNames, pythonCode, javascriptCodeBack;
    try {
        function formatToolCode(actData) {
            let input = actData.input;
            let keys = Object.keys(input);
            let values = Object.values(input);
            let formattedInput = keys.map((key, index) => `${key}="${values[index]}"`).join(',');
            return `default_api.${actData.name}(${formattedInput})`;
        }


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
            javascriptCode = formatToolCode(actData);
            javascriptCodeBack = await loadToolCode(actData);
        } else if (actData.name === 'apt_install') {
            if (is_none_data(actData?.input?.package_name)) throw null;
            javascriptCode = formatToolCode(actData);
            javascriptCodeBack = shellCommander(`apt install -y ${actData.input.package_name}`);
        } else if (actData.name === 'which_command') {
            if (is_none_data(actData?.input?.command)) throw null;
            javascriptCode = formatToolCode(actData);
            javascriptCodeBack = await loadToolCode(actData);
        } else if (actData.name === 'run_command') {
            if (is_none_data(actData?.input?.command)) throw null;
            javascriptCode = [
                actData.input.command,
            ].join('\n');
            javascriptCodeBack = shellCommander(actData.input.command);
        } else if (actData.name === 'retrieve_from_file') {
            if (is_none_data(actData?.input?.file_path)) throw null;
            if (is_none_data(actData?.input?.question)) throw null;
            javascriptCode = formatToolCode(actData);
            javascriptCodeBack = await loadToolCode(actData);
        } else if (actData.name === 'remove_file') {
            if (is_none_data(actData?.input?.file_path)) throw null;
            javascriptCode = formatToolCode(actData);
            javascriptCodeBack = await loadToolCode(actData);
        } else if (actData.name === 'remove_directory_recursively') {
            if (is_none_data(actData?.input?.directory_path)) throw null;
            javascriptCode = formatToolCode(actData);
            javascriptCodeBack = await loadToolCode(actData);
        } else if (actData.name === 'rename_file_or_directory') {
            if (is_none_data(actData?.input?.old_path)) throw null;
            if (is_none_data(actData?.input?.new_path)) throw null;
            javascriptCode = formatToolCode(actData);
            javascriptCodeBack = await loadToolCode(actData);
        } else if (actData.name === 'show_output_range') {
            if (is_none_data(actData?.input?.outputDataId)) throw null;
            if (is_none_data(actData?.input?.startLineNumber)) throw null;
            if (is_none_data(actData?.input?.endLineNumber)) throw null;
            actData = JSON.parse(JSON.stringify(actData));
            actData.input.startLineNumber = Number(actData.input.startLineNumber);
            actData.input.endLineNumber = Number(actData.input.endLineNumber);
            const theLine = processTransactions.filter(transaction => {
                const data1 = transaction?.outputDataId?.toUpperCase();
                const data2 = actData?.input?.outputDataId?.toUpperCase();
                if (!data2 || !data1) return false;
                return data1 === data2;
            })[0];
            let data = theLine ? theLine.data.split('\n').slice(actData.input.startLineNumber, actData.input.endLineNumber).join('\n') : '';
            javascriptCode = formatToolCode(actData);
            // console.log('emoji 🔎');
            data = `🔎 Part of the output from the outputDataId: ${actData.input.outputDataId} (Range: ${actData.input.startLineNumber} - ${actData.input.endLineNumber})\n---\n${data}`;
            // console.log(data);
            const base64 = Buffer.from(data).toString('base64');
            javascriptCodeBack = [`console.log('${base64}');`].join('\n');
        } else if (actData.name === 'retrieve_from_webpage') {
            const p12 = await out_state(caption('retrievingFromWebpage'));
            console.log('retrieve_from_webpage!!!!!!!!!!!!!!......................!!!!!!!!');
            if (is_none_data(actData?.input?.url)) throw null;
            if (is_none_data(actData?.input?.question)) {
                actData.input.question = 'Summary of the webpage';
            }
            const url = actData.input.url;
            const question = actData.input.question;
            let result;
            let data;
            let fail = false;
            if (false && !fail && !data && typeof result.data !== 'string') {
                data = JSON.stringify(result.data);
            } else if (!fail && !data) {
                let htmldata = '';
                const browser = await puppeteer.launch({ headless: 'new' });
                try {
                    // null.dd;
                    console.log('puppeteer launch');
                    const page = await browser.newPage();
                    await page.goto(url, { waitUntil: 'networkidle0' });
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    htmldata = await page.evaluate(() => {
                        {
                            const elements = document.querySelectorAll('style, script, link');
                            elements.forEach(element => {
                                element.remove();
                            });
                        }
                        {
                            const elements = document.querySelectorAll('*');
                            elements.forEach(element => {
                                element.removeAttribute('style');
                                element.removeAttribute('class');
                                element.removeAttribute('id');
                                element.removeAttribute('name');
                            });
                        }
                        return document.documentElement.innerHTML;
                    });
                } catch {
                    fail = true;
                }
                await browser.close();
                // htmldata = htmldata.replace(/<style>.*?<\/style>/g, '');
                data = new TurndownService().turndown(htmldata);
                // ignore style sheet with turndown ability
            }
            let ob = { data, question, url };
            const base64 = Buffer.from(JSON.stringify(ob)).toString('base64');
            javascriptCode = formatToolCode(actData);
            javascriptCodeBack = [
                `console.log('${!fail ? base64 : `["${url}"]`}');`,
            ].join('\n');
            await p12.dismiss();
            // console.log('javascriptCodeBack!!!!!!!!!!!!!!!!!!!!!!', javascriptCodeBack);
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
            javascriptCode = formatToolCode(actData);
            javascriptCodeBack = [
                `console.log('🌏 CDN Library URL of ${actData.input.package_name}');`,
                `console.log((${JSON.stringify({ printData })}).printData);`,
            ].join('\n');
        } else {
            // other tool
            const name = actData.name;
            const input = JSON.parse(JSON.stringify(actData.input));
            const { spec, npm_package_list } = await getToolData(name);
            const rule = spec.input_schema[0];
            const desc = spec.input_schema[1];
            const structure1 = JSON.stringify(convertJsonToResponseFormat(sortKeyOfObject(rule), desc))
            const structure2 = JSON.stringify(convertJsonToResponseFormat(sortKeyOfObject(input), desc))
            if (structure1 === structure2) {
                // let pp3 = null;
                // console.log('actData.name!!!!!!!!!!!!!!!!!!!!!!!!!!!', name, caption('webSearch'));
                // if (name === 'web_search') {
                // pp3 = await out_state(caption('webSearch'));
                // console.log('pp3!!!!!!!!!!!!!!!!!!!!!!!!!!!', pp3);
                // }
                javascriptCode = formatToolCode(actData);
                javascriptCodeBack = await loadToolCode(actData);
                if (npm_package_list) requiredPackageNames = npm_package_list;
                // if (pp3) {
                // await pp3.dismiss();
                // console.log('pp3 dismissed!!!!!!!!!!!!!!!!!!!!!!!!!!!');
                // }
            }
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