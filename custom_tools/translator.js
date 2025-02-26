async function main({ text, targetLanguage }) {
    const OpenAI = require("openai");

    // OpenAI 클라이언트 초기화
    const openai = new OpenAI({
        apiKey: '',
    });

    async function translate(text, targetLanguage) {
        // 번역 프롬프트 생성 (예: "Translate the following text to Korean: "hello world"")
        const prompt = `Translate the following text to ${targetLanguage}: "${text}"`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: `
                    You are a helpful translation assistant.
                    Return only the translated text.
                ` },
                { role: "user", content: prompt }
            ],
            temperature: 0.3, // 번역 결과의 일관성을 위해 낮은 온도를 사용
        });

        // 번역된 텍스트 추출 및 반환
        const translation = response.choices[0].message.content.trim();
        return translation;
    }

    // 사용 예시:
    try {
        const translatedText = await translate(text, targetLanguage);
        console.log("번역된 결과:", translatedText);
        return translatedText;
    } catch (error) {
        console.log('Error Occured', error.message);
    }
}
