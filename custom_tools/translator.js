async function main({ text, targetLanguage }) {
    const OpenAI = require("openai");

    // OpenAI 클라이언트 초기화
    const openai = new OpenAI({
        apiKey: '',
    });

    async function translate(text, targetLanguage) {
        // 번역 프롬프트 생성 (예: "Translate the following text to Korean: "hello world"")
        const prompt = `Translate the following text to ${targetLanguage}: "${text}"`;

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { role: "system", content: "You are a helpful translation assistant." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3, // 번역 결과의 일관성을 위해 낮은 온도를 사용
            });

            // 번역된 텍스트 추출 및 반환
            const translation = response.choices[0].message.content.trim();
            return translation;
        } catch (error) {
            console.error("번역 중 에러 발생:", error);
            throw error;
        }
    }

    // 사용 예시:
    try {
        const translatedText = await translate(text, targetLanguage);
        console.log("Translated Text:", translatedText);
    } catch (error) {
        console.error(error);
    }
}
