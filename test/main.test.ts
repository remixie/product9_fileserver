import { expectTypeOf, test } from "vitest";
test("my types work properly", () => {
  expectTypeOf("String").toBeString();
});
