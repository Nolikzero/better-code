import { describe, expect, test } from "bun:test";

const indexHtmlPath = new URL("./index.html", import.meta.url);

describe("renderer Content Security Policy", () => {
  test("allows same-origin blob workers without widening script-src", async () => {
    const html = await Bun.file(indexHtmlPath).text();

    expect(html).toContain("worker-src 'self' blob:");
    expect(html).not.toContain("script-src 'self' blob:");
  });
});
