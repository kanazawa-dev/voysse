// Framework-free contract and isolated-app parity checks. Uses existing TypeScript.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const ts = require("../../apps/web/node_modules/typescript");
const root = path.resolve(__dirname, "../..");
const web = path.join(root, "apps/web/lib/bloub/vendor");
const marketing = path.join(root, "apps/marketing/lib/bloub/vendor");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "voysse-bloub-test-"));
try {
  for (const file of fs.readdirSync(web)) {
    assert.equal(
      fs.readFileSync(path.join(web, file), "utf8"),
      fs.readFileSync(path.join(marketing, file), "utf8"),
      `vendor drift: ${file}`,
    );
    if (!file.endsWith(".ts")) continue;
    const compiled = ts.transpileModule(
      fs.readFileSync(path.join(web, file), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      },
    );
    fs.writeFileSync(
      path.join(out, file.replace(/\.ts$/, ".js")),
      compiled.outputText,
    );
  }
  assert.equal(
    fs.readFileSync(
      path.join(root, "apps/web/components/bloub-avatar.tsx"),
      "utf8",
    ),
    fs.readFileSync(
      path.join(root, "apps/marketing/components/bloub-avatar.tsx"),
      "utf8",
    ),
    "React adapter drift",
  );
  const { BotEngine } = require(path.join(out, "engine.js"));
  const { STATES } = require(path.join(out, "states.js"));
  const { SHAPES } = require(path.join(out, "skins.js"));
  let count = 0;
  for (const state of STATES)
    for (const shape of SHAPES) {
      const engine = new BotEngine(100, state.id, shape.radii);
      for (const t of [0, 0.3, 1.2, 3, 10]) {
        const frame = engine.sample(t);
        const json = JSON.stringify(frame);
        assert(frame.bodyPath.length > 0);
        assert(!/NaN|Infinity/.test(json), `${state.id}/${shape.id}`);
        const other = new BotEngine(100, state.id, shape.radii);
        assert.equal(
          json,
          JSON.stringify(other.sample(t)),
          "SSR must be deterministic",
        );
        count++;
      }
    }
  const engine = new BotEngine(100, "idle");
  for (const [i, state] of STATES.entries()) {
    engine.setState(state.id, i * 0.2);
    assert(!/NaN|Infinity/.test(JSON.stringify(engine.sample(i * 0.2 + 0.1))));
  }
  console.log(
    `PASS: ${count} deterministic finite frames, rapid state changes, vendor and React adapter parity.`,
  );
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}
