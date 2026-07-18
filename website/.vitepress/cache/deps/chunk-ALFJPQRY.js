import {
  insertEdge,
  insertEdgeLabel,
  markers_default,
  positionEdgeLabel
} from "./chunk-MUNCBI6H.js";
import {
  insertCluster,
  insertNode,
  labelHelper
} from "./chunk-DSAEPBMD.js";
import {
  interpolateToCurve
} from "./chunk-AIADRZUY.js";
import {
  common_default,
  getConfig
} from "./chunk-B3X6RWPD.js";
import {
  __name,
  log
} from "./chunk-SLFIXXXK.js";

// node_modules/.pnpm/mermaid@11.13.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-GLR3WWYH.mjs
var internalHelpers = {
  common: common_default,
  getConfig,
  insertCluster,
  insertEdge,
  insertEdgeLabel,
  insertMarkers: markers_default,
  insertNode,
  interpolateToCurve,
  labelHelper,
  log,
  positionEdgeLabel
};
var layoutAlgorithms = {};
var registerLayoutLoaders = __name((loaders) => {
  for (const loader of loaders) {
    layoutAlgorithms[loader.name] = loader;
  }
}, "registerLayoutLoaders");
var registerDefaultLayoutLoaders = __name(() => {
  registerLayoutLoaders([
    {
      name: "dagre",
      loader: __name(async () => await import("./dagre-KLK3FWXG-CVPCNPPX.js"), "loader")
    },
    ...true ? [
      {
        name: "cose-bilkent",
        loader: __name(async () => await import("./cose-bilkent-S5V4N54A-7JCHVZMD.js"), "loader")
      }
    ] : []
  ]);
}, "registerDefaultLayoutLoaders");
registerDefaultLayoutLoaders();
var render = __name(async (data4Layout, svg) => {
  if (!(data4Layout.layoutAlgorithm in layoutAlgorithms)) {
    throw new Error(`Unknown layout algorithm: ${data4Layout.layoutAlgorithm}`);
  }
  const layoutDefinition = layoutAlgorithms[data4Layout.layoutAlgorithm];
  const layoutRenderer = await layoutDefinition.loader();
  return layoutRenderer.render(data4Layout, svg, internalHelpers, {
    algorithm: layoutDefinition.algorithm
  });
}, "render");
var getRegisteredLayoutAlgorithm = __name((algorithm = "", { fallback = "dagre" } = {}) => {
  if (algorithm in layoutAlgorithms) {
    return algorithm;
  }
  if (fallback in layoutAlgorithms) {
    log.warn(`Layout algorithm ${algorithm} is not registered. Using ${fallback} as fallback.`);
    return fallback;
  }
  throw new Error(`Both layout algorithms ${algorithm} and ${fallback} are not registered.`);
}, "getRegisteredLayoutAlgorithm");

export {
  registerLayoutLoaders,
  render,
  getRegisteredLayoutAlgorithm
};
//# sourceMappingURL=chunk-ALFJPQRY.js.map
