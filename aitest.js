/*
이 파일은 그냥 페이로드 테스트해보는것입니다.
*/
import fs from 'fs';
if (false) {
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
}
if (true) {
    //for gemini

    const filePath = '/Users/kst/.aiexeauto/workspace/logs/2025-02-14T04-08-25-041Z-1739506105041.json';
    let payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const geminiApiKey = '';
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + geminiApiKey;

    async function sendRequest() {
        try {
            delete payload.callMode;
            // Gemini API 형식에 맞게 변환
            // const geminiPayload = {
            //     contents: payload.messages.map(msg => ({
            //         role: msg.role === 'assistant' ? 'model' : msg.role,
            //         parts: [{ text: msg.content }]
            //     }))
            // };

            const response = await fetch(`${url}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
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
}