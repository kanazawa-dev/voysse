const assert = require("node:assert/strict");
const path = require("node:path");

// GHSA-4mjr-xmp4-gh2g: parsing untrusted keys must not crash serialization.
for (const app of ["web", "marketing"]) {
  const qs = require(path.resolve(__dirname, "../../apps", app, "node_modules/qs"));
  for (const options of [{ plainObjects: true }, { allowPrototypes: true }]) {
    const parsed = qs.parse("filter[constructor][isBuffer]=not-a-function", options);
    assert.doesNotThrow(() => qs.stringify(parsed), app + " unsafe constructor");
  }
  assert.equal(qs.stringify({ search: "hello world" }), "search=hello%20world");
}
console.log("PASS qs: both frontends serialize hostile constructor keys safely.");
