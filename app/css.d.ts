// A stylesheet is imported for its side effect and exports nothing. TypeScript 6
// refuses a side-effect import it cannot resolve to a module (TS2882), so this
// declaration is what makes `import './global.css'` legal — Metro is what
// actually handles the file.
declare module '*.css';
