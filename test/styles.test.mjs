import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import { transform } from "lightningcss";

const source = await readFile(
  new URL("../runtime/cms.css", import.meta.url),
  "utf8",
);
const css = postcss.parse(source);

test("every style selector requires the CMS container", () => {
  css.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name))
      return;
    selectorParser((selectors) => {
      for (const selector of selectors.nodes) {
        const firstCompound = selector.nodes.slice(
          0,
          selector.nodes.findIndex((node) => node.type === "combinator") === -1
            ? selector.nodes.length
            : selector.nodes.findIndex((node) => node.type === "combinator"),
        );
        assert(
          firstCompound.some(
            (node) => node.type === "class" && node.value === "cms-admin",
          ),
          rule.selector,
        );
      }
    }).processSync(rule.selector);
  });
  // A real CSS parser also rejects malformed root selectors such as `.cms-admin*`.
  assert.doesNotThrow(() =>
    transform({ filename: "cms.css", code: Buffer.from(source) }),
  );
});

test("utilities cover the container itself and include the datepicker", () => {
  const rules = [];
  css.walkRules((rule) => rules.push(rule.selector));
  assert(rules.some((selector) => selector.includes(".cms-admin.flex")));
  assert(rules.some((selector) => selector.includes(".cms-admin .flex")));
  assert(rules.some((selector) => selector.includes(".cms-admin .dp--menu")));
  assert(
    !source.includes("@layer"),
    "host cascade layers must not suppress CMS styles",
  );
});

test("Tailwind theme variables and animations cannot change the host theme", () => {
  css.walkDecls((declaration) => {
    if (declaration.prop.startsWith("--")) {
      assert.match(declaration.prop, /^--(?:framecore-cms-|dp-)/);
    }
  });
  css.walkAtRules("property", (rule) =>
    assert.match(rule.params, /^--framecore-cms-/),
  );
  css.walkAtRules(/keyframes$/, (rule) =>
    assert.match(rule.params, /^framecore-cms-/),
  );
  assert(!/var\(--(?:color|font|spacing|tw)-/.test(source));
  assert.match(
    source,
    /--framecore-cms-font-body: ui-sans-serif, system-ui, sans-serif/,
  );
});
