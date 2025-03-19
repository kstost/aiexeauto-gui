from openai import OpenAI

def language_translator(input):
    # OpenAI 클라이언트 초기화
    openai = OpenAI(api_key=aiexe_configuration["openaiApiKey"])

    # 번역 프롬프트 생성
    prompt = f"Translate the following text to {input['target_language']}: \"{input['text']}\""

    # OpenAI API 호출
    response = openai.chat.completions.create(
        model=aiexe_configuration["openaiModel"],
        messages=[
            {
                "role": "system",
                "content": """
                    You are a helpful translation assistant.
                    Return only the translated text.
                """
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.3  # 번역 결과의 일관성을 위해 낮은 온도를 사용
    )

    # 번역된 텍스트 추출 및 반환
    translation = response.choices[0].message.content.strip()
    print("번역된 결과:", translation);
    return translation
