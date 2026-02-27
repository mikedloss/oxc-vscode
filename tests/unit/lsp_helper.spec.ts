import { strictEqual } from "assert";
import { __test__, runExecutable } from "../../client/tools/lsp_helper";

suite("runExecutable", () => {
  const originalPlatform = process.platform;
  const originalEnv = process.env;
  const tool = "oxlint";

  teardown(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    process.env = originalEnv;
    __test__.reset();
  });

  test("should create Node.js executable for .js files", () => {
    const result = runExecutable("/path/to/server.js", tool);

    strictEqual(result.command, "node");
    strictEqual(result.args?.[0], "/path/to/server.js");
    strictEqual(result.args?.[1], "--lsp");
  });

  test("should create Node.js executable for .cjs files", () => {
    const result = runExecutable("/path/to/server.cjs", tool);

    strictEqual(result.command, "node");
    strictEqual(result.args?.[0], "/path/to/server.cjs");
    strictEqual(result.args?.[1], "--lsp");
  });

  test("should create Node.js executable for .mjs files", () => {
    const result = runExecutable("/path/to/server.mjs", tool);

    strictEqual(result.command, "node");
    strictEqual(result.args?.[0], "/path/to/server.mjs");
    strictEqual(result.args?.[1], "--lsp");
  });

  test("should create binary executable for non-Node files", () => {
    const result = runExecutable("/path/to/oxc-language-server", tool);

    let expectedCommand = "/path/to/oxc-language-server";
    if (process.platform === "win32") {
      expectedCommand = `"${expectedCommand}"`;
    }

    strictEqual(result.command, expectedCommand);
    strictEqual(result.args?.[0], "--lsp");
    strictEqual(result.options?.shell, process.platform === "win32");
  });

  test("should use shell on Windows for binary executables", () => {
    Object.defineProperty(process, "platform", { value: "win32" });

    const result = runExecutable("/path/to/oxc-language-server", tool);

    strictEqual(result.options?.shell, true);
  });

  test("should prepend nodePath to PATH", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    process.env.PATH = "/usr/bin:/bin";

    const result = runExecutable("/path/to/server", tool, "/custom/node/bin/node");

    strictEqual(result.options?.env?.PATH, "/custom/node/bin:/usr/bin:/bin");
  });

  test("should set path in quotes on Windows for binary executables", () => {
    Object.defineProperty(process, "platform", { value: "win32" });

    const result = runExecutable("C:\\Path With Spaces\\oxc-language-server", tool);

    strictEqual(result.command, '"C:\\Path With Spaces\\oxc-language-server"');
  });

  test("should use the provided node path for Node.js executables", () => {
    const result = runExecutable("/path/to/server.js", tool, "/custom/node/bin/node");

    strictEqual(result.command, "/custom/node/bin/node");
    strictEqual(result.args?.[0], "/path/to/server.js");
    strictEqual(result.args?.[1], "--lsp");
  });

  test("should fall back to searching node in login shell when not in PATH", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    process.env.PATH = "/usr/bin:/bin";
    process.env.SHELL = "/bin/zsh";

    __test__.setSpawnSyncForTests(((command: string, args: readonly string[], options: any) => {
      if (command === "node") {
        strictEqual(options?.timeout, 5000);
        return { status: 1, stdout: "", stderr: "", error: undefined } as any;
      }
      if (command === "/bin/zsh") {
        strictEqual(args[0], "-ilc");
        strictEqual(options?.timeout, 5000);
        return { status: 0, stdout: "noise\n/opt/homebrew/bin/node\n", stderr: "", error: undefined } as any;
      }
      return { status: 1, stdout: "", stderr: "", error: undefined } as any;
    }) as any);

    const result = runExecutable("/path/to/server.js", tool);
    strictEqual(result.command, "/opt/homebrew/bin/node");
    strictEqual(result.options?.env?.PATH, "/opt/homebrew/bin:/usr/bin:/bin");
  });

  test("should set ELECTRON_RUN_AS_NODE when falling back to process.execPath", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    process.env.PATH = "/usr/bin:/bin";
    process.env.SHELL = "/bin/zsh";

    __test__.setSpawnSyncForTests((() => {
      // Make both PATH lookup and login-shell lookup fail.
      return { status: 1, stdout: "", stderr: "", error: undefined } as any;
    }) as any);

    const result = runExecutable("/path/to/server.js", tool);
    strictEqual(result.command, process.execPath);
    strictEqual(result.options?.env?.ELECTRON_RUN_AS_NODE, "1");
  });
});
