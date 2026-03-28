import {
  parse
} from "./chunk-T5ZWBESF.js";
import "./chunk-N6UMXJNK.js";
import "./chunk-M3V6V7OD.js";
import "./chunk-SPHTS4QK.js";
import "./chunk-ETB65RLZ.js";
import "./chunk-I3USWZBJ.js";
import "./chunk-4UCS3BFI.js";
import "./chunk-IQUP2HR6.js";
import "./chunk-BK5FCJGH.js";
import "./chunk-EBUQOA3O.js";
import {
  selectSvgElement
} from "./chunk-JAORB6LP.js";
import {
  configureSvgSize
} from "./chunk-B3X6RWPD.js";
import {
  __name,
  log
} from "./chunk-SLFIXXXK.js";
import "./chunk-C5XFBDFB.js";
import "./chunk-TETQMF2E.js";
import "./chunk-FOQIPI7F.js";

// node_modules/.pnpm/mermaid@11.13.0/node_modules/mermaid/dist/chunks/mermaid.core/infoDiagram-LFFYTUFH.mjs
var parser = {
  parse: __name(async (input) => {
    const ast = await parse("info", input);
    log.debug(ast);
  }, "parse")
};
var DEFAULT_INFO_DB = {
  version: "11.13.0" + (true ? "" : "-tiny")
};
var getVersion = __name(() => DEFAULT_INFO_DB.version, "getVersion");
var db = {
  getVersion
};
var draw = __name((text, id, version) => {
  log.debug("rendering info diagram\n" + text);
  const svg = selectSvgElement(id);
  configureSvgSize(svg, 100, 400, true);
  const group = svg.append("g");
  group.append("text").attr("x", 100).attr("y", 40).attr("class", "version").attr("font-size", 32).style("text-anchor", "middle").text(`v${version}`);
}, "draw");
var renderer = { draw };
var diagram = {
  parser,
  db,
  renderer
};
export {
  diagram
};
//# sourceMappingURL=infoDiagram-LFFYTUFH-D4GO3X7X.js.map
