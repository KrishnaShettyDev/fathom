declare module "robots-parser" {
  // robots-parser 3.0.1 uses module.exports, while its bundled declaration uses an
  // ESM default. Describe the actual CommonJS API for NodeNext resolution.
  function robotsParser(
    url: string,
    contents: string,
  ): {
    isAllowed(url: string, userAgent?: string): boolean | undefined;
    getCrawlDelay(userAgent?: string): number | undefined;
  };
  export = robotsParser;
}
