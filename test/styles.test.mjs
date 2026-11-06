import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compile } from "@tailwindcss/node";
import postcss from "postcss";

const stylesheet = new URL("../runtime/cms.css", import.meta.url);
const compiler = await compile(await readFile(stylesheet, "utf8"), {
  base: new URL("../runtime/", import.meta.url).pathname,
  from: stylesheet.pathname,
  onDependency() {},
});
const output = compiler.build([
  "flex",
  "fixed",
  "h-auto",
  "font-body",
  "font-heading",
  "gap-4",
  "text-neutral-400",
  "md:flex",
  "hover:bg-white/10",
]);
const css = postcss.parse(output);

test("normal utilities are scoped and CMS fonts come from the host site", () => {
  assert.match(output, /\.cms-admin \.flex\s*\{/);
  assert.match(output, /\.cms-admin \.fixed\s*\{/);
  assert.match(output, /\.cms-admin \.h-auto\s*\{/);
  assert.match(output, /\.cms-admin \.font-body\s*\{/);
  assert.match(output, /font-family: var\(--font-body, inherit\)/);
  assert.match(
    output,
    /font-family: var\(--font-heading, var\(--font-body, inherit\)\)/,
  );
  assert(
    !/(?:^|\n)\s*\.(?:flex|fixed|font-body|font-heading)\s*\{/.test(output),
  );
  assert(!/--(?:color|font|spacing)-[\w-]*:/.test(output));
  assert(!/var\(--(?:color|spacing)-/.test(output));
});

test("CMS form and base styles stay inside the CMS container without global preflight", () => {
  const baseLayers = [];
  css.walkAtRules("layer", (rule) => {
    if (rule.params === "base") baseLayers.push(rule);
  });
  assert(baseLayers.length > 0);
  for (const base of baseLayers) {
    for (const rule of base.nodes.filter((node) => node.type === "rule")) {
      assert.equal(rule.selector, ".cms-admin");
    }
  }
  css.walkRules((rule) => {
    if (!/^(?:html|body|\*)[,\s]/.test(rule.selector)) return;
    // Tailwind's browser fallback initializes internal variables globally;
    // it must not reset margins, borders or other host layout properties.
    rule.walkDecls((declaration) =>
      assert(declaration.prop.startsWith("--tw-")),
    );
  });
  assert.match(output, /& input, & \.input/);
  assert.match(output, /box-sizing: border-box/);
  assert.match(output, /font-weight: inherit/);
  assert.match(output, /text-transform: none/);
});

test("the standard stylesheet imports include the datepicker and CMS sources", async () => {
  assert.match(output, /\.dp--menu/);
  const source = await readFile(stylesheet, "utf8");
  assert.match(source, /@config "\.\.\/tailwind\.config\.js"/);
  assert.match(source, /@source "\.\/components"/);
  assert.match(source, /@source "\.\/pages"/);
  assert(!source.includes("preflight.css"));
});
