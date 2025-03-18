const devmode = false; // 배포시에는 false로 설정
const whether_to_tool_use_in_gemini = true; // gemini에서 툴 사용 여부
const venvName = 'pythonVirtualEnv';
const defaultConfig = {
    claudeApiKey: "",
    groqApiKey: "",
    deepseekApiKey: "",
    openaiApiKey: "",
    ollamaApiKey: "",
    geminiApiKey: "",
    geminiModel: "gemini-2.0-flash", // 원하는 모델 e.g. gemini-2.0-flash, gemini-2.0-flash-latest
    model: "claude-3-5-haiku-20241022",
    deepseekModel: "deepseek-chat",
    openaiModel: "gpt-4o-mini",
    ollamaModel: "qwen2.5:14b",
    groqModel: "llama-3.3-70b-versatile",
    llm: "gemini",
    maxIterations: 0,
    dockerImage: 'my-node-ubuntu',
    useDocker: false, // Docker 사용 여부 (false: 도커 아닌 웹컨테이너 사용, true: 도커 사용함)
    keepDockerContainer: true,
    dockerPath: '', // 도커 경로
    dockerWorkDir: '/home/ubuntu/work',
    overwriteOutputDir: false, // 덮어쓰기 여부 (false: 덮어쓰지 않음, true: 덮어씀)
    trackLog: false,
    ollamaEndpoint: 'http://localhost:11434',
    autoCodeExecution: false, // 자동 코드 실행 여부 (false: 자동 실행 안함, true: 자동 실행함)
    planEditable: false, // AI가 판단한 계획 수정 가능 여부 (false: 수정 불가능, true: 수정 가능)
    captionLanguage: 'en', // 캡션 언어 (ko: 한국어, en: 영어)
    customRulesForCodeGenerator: '', // 사용자 정의 규칙
    customRulesForEvaluator: '', // 사용자 정의 규칙
    nodePath: '', // Node.js 경로
    npmPath: '', // npm 경로
    pythonPath: '', // Python 경로
    latestMemoryDepth: 30,
};
export default {
    devmode,
    whether_to_tool_use_in_gemini,
    venvName,
    defaultConfig
};