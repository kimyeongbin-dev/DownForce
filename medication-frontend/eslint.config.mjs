import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // [TECH DEBT / TODO] React 19 시대에 새로 도입된 React Compiler 지향 preview 규칙
    // (effect 내 setState 금지 등). 기존 코드베이스 전반의 관용 패턴(mount 가드, 파생상태 동기화)이
    // 걸리므로 error -> warn 으로 강등해 가시성만 유지한다.
    // 실제 effect 리팩터(22건) 후 이 override 를 제거하고 error 로 복구할 것.
    // 상세 목록·처리 조건: docs/tech-debt/frontend-react-hooks-effect-refactor.md
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
