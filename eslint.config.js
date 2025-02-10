import globals from "globals";
import js from "@eslint/js";

const config = [
  {
    languageOptions: {
      globals: {
        ...globals.node,
        window: true,  // window 변수 허용
        document: true,  // document 변수 허용
        CodeMirror: true,
        mdc: true,
        AsyncFunction: true,
        confirm: true,
        alert: true,
      },  // Node.js 환경 글로벌 변수 설정
    },
    rules: {
      "no-undef": "error",  // 선언되지 않은 변수 사용 시 에러
      "no-unused-vars": "warn",  // 사용하지 않는 변수에 대해 경고
      "no-empty": "off",  // 빈 블록을 허용
      "no-constant-condition": "off", // 상수 조건문 허용
      "no-control-regex": "off" // 정규식의 제어 문자 허용
    },
  },
  {
    ...js.configs.recommended,  // 권장 설정 추가
    rules: {
      ...js.configs.recommended.rules,  // 기존 권장 규칙 가져오기
      "no-empty": "off",  // 빈 블록을 허용
      "no-unused-vars": "off",  // 사용하지 않는 변수에 대해 경고
      "no-constant-condition": "off", // 상수 조건문 허용
      "no-control-regex": "off", // 정규식의 제어 문자 허용
      "no-async-promise-executor": "off" // 비동기 프로미스 실행자 허용
    }
  }
];

export default config;
