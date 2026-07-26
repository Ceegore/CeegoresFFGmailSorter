// Ambient declarations for Vite-style asset imports used in src.
// `?raw` imports return the file contents as a string at build time.
declare module "*.css?raw" {
  const content: string;
  export default content;
}

declare module "*?raw" {
  const content: string;
  export default content;
}
