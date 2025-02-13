/*
이 파일은 그냥 페이로드 테스트해보는것입니다.
*/
import fs from 'fs';
const filePath = '/Users/kst/.aiexeauto/workspace/logs/2025-02-13T08-16-17-468Z-1739434577468.json';
const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const openaiApiKey = '';
const url = "https://api.openai.com/v1/chat/completions";

async function sendRequest() {
    try {
        delete payload.callMode;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error occurred:', error.message);
    }
}

sendRequest();
