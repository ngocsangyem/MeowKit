import {
  __name,
  select_default
} from "./chunk-SLFIXXXK.js";

// node_modules/.pnpm/mermaid@11.13.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-55IACEB6.mjs
var getDiagramElement = __name((id, securityLevel) => {
  let sandboxElement;
  if (securityLevel === "sandbox") {
    sandboxElement = select_default("#i" + id);
  }
  const root = securityLevel === "sandbox" ? select_default(sandboxElement.nodes()[0].contentDocument.body) : select_default("body");
  const svg = root.select(`[id="${id}"]`);
  return svg;
}, "getDiagramElement");

export {
  getDiagramElement
};
//# sourceMappingURL=chunk-JGQ6FMWC.js.map
