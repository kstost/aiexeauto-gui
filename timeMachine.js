import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { getAppPath } from './system.js';
import { chatCompletion } from './aiFeatures.js';
import { setConfiguration } from './system.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app3 = express();
const staticPath = __dirname + '/timeMachineRes';
app3.use(express.json({ limit: '50mb' }));
app3.use(express.urlencoded({ extended: true, limit: '50mb' }));

app3.use(express.static(staticPath));

app3.get('/', (req, res) => {
    // res.send('Hello World');
    // timemachine html
    res.sendFile(staticPath + '/timeMachine.html');
});

// app3.get('/', (req, res) => {

// });
app3.get('/logs', (req, res) => {
    const aiLogFolder = getAppPath('logs_txt');
    const files = fs.readdirSync(aiLogFolder);
    // const file = files.find(file => file.includes('2025-03-17'));
    // const content = fs.readFileSync(aiLogFolder + '/' + file, 'utf8');
    res.send(files);
});

app3.get('/logs/:filename', async (req, res) => {
    const filename = req.params.filename;
    const aiLogFolder = getAppPath('logs_txt');
    const content = await fs.promises.readFile(aiLogFolder + '/' + filename, 'utf8');
    res.send(content);
});

app3.post('/request', async (req, res) => {
    // console.log(req.body); // undefined
    // [ 'systemPrompt', 'model', 'tool', 'messages' ]
    let { systemPrompt, model, llm, tool, messages, callMode } = req.body;
    await setConfiguration('llm', llm);
    await setConfiguration('model', model);
    //
    // if (tool && tool.constructor === String) tool = tool.trim();
    if (!tool) tool = {};
    let toolExists = Object.keys(tool).length > 0;

    if (toolExists) {
        if (llm === 'claude') {
            tool.tool_choice = tool.tool_config;
            delete tool.tool_config;
        }
    }
    if (tool && Object.keys(tool).length === 0) {
        tool = null;
    }
    // function getTool() {
    // }

    // console.log(callMode, tool);
    try {
        const asdf = await chatCompletion(
            systemPrompt,
            messages,
            callMode,
            {
                out_state() {
                    return {
                        fail: () => {
                        },
                        dismiss: () => {
                        },
                        success: () => {
                        },
                        update: () => {
                        }
                    }
                }
            },
            '',
            true,
            tool
        )
        res.send(asdf);
    } catch (e) {
        console.log(e);
        res.send({ error: e.message });
    }
    // const filename = req.body.filename;
    // const aiLogFolder = getAppPath('logs_txt');
    // const content = await fs.promises.readFile(aiLogFolder + '/' + filename, 'utf8');
    // res.send(content);
});

app3.listen(3200, () => {
    console.log('Server is running on port 3200');
}); 