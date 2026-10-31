// Vite '?url' 가져오기(파일 주소 문자열) — pdf.js 작업 파일 주소 등
declare module '*?url' {
  const src: string;
  export default src;
}
