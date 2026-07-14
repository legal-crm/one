# Project Rules

## 배포 규칙
- 사용자가 "배포해"라고 하면 **Vercel 배포**와 **GitHub 배포(git add, commit, push)** 를 **둘 다** 수행한다.
- 순서: GitHub push → Vercel 프로덕션 배포 (또는 동시 진행)
- **git push 시 반드시** `$env:GITHUB_TOKEN = "";` 를 앞에 붙여 실행한다. (Antigravity 세션의 더미 토큰이 gh CLI 인증을 덮어쓰는 문제 방지)
