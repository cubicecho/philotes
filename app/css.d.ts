// Makes `import './global.css'` legal: TypeScript 6 refuses a side-effect import it cannot resolve (TS2882).
// Metro handles the file itself.
declare module '*.css';
