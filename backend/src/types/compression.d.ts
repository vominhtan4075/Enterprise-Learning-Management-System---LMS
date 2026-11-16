declare module 'compression' {
  function compression(
    options?: Record<string, unknown>,
  ): (req: unknown, res: unknown, next: (err?: unknown) => void) => void;
  export default compression;
}

