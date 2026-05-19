import {useEffect, useMemo, useState} from "react";
import type React from "react";
import {Alert, Button} from "antd";
import {hierarchy as d3Hierarchy, tree as d3Tree} from "d3";
import type {HierarchyPointNode} from "d3";
import type {InteractionHierarchyNode} from "../../../../../types/dataTypes";
import "./HierarchySelector.css";

type HierarchySelectorProps = {
  title: string;
  hierarchy: InteractionHierarchyNode[];
  selectedNodeNames: string[];
  cancelledNodeNames?: string[];
  allowCancel?: boolean;
  onApply: (
    updatedHierarchy: InteractionHierarchyNode[],
    selectedNodeNames: string[],
    cancelledNodeNames: string[],
  ) => void;
  onClose: () => void;
};

type TreeNode = {
  Name: string;
  Children: TreeNode[];
  isRoot?: boolean;
};

const ROOT_NAME = "Root";
const NODE_RADIUS = 3.5;
const WIDTH = 560;
const NODE_X_GAP = 14;
const NODE_Y_GAP = 88;
const MARGIN_X = 28;
const MARGIN_Y = 14;

export const getDefaultHierarchySelection = (
  nodes: InteractionHierarchyNode[],
): string[] => {
  return nodes
    .filter((node) => !node.Cancelled && !hasVisualizedDescendant(node))
    .map((node) => node.Name);
};

export const getVisualizedHierarchySelection = (
  nodes: InteractionHierarchyNode[],
): string[] => {
  const selectedNames: string[] = [];

  const collect = (hierarchyNodes: InteractionHierarchyNode[]): void => {
    hierarchyNodes.forEach((node) => {
      if (node.Visualize && !node.Cancelled) {
        selectedNames.push(node.Name);
      }

      collect(node.Children ?? []);
    });
  };

  collect(nodes);

  return selectedNames.length ? selectedNames : getDefaultHierarchySelection(nodes);
};

const hasVisualizedDescendant = (node: InteractionHierarchyNode): boolean => {
  return (node.Children ?? []).some((child) =>
    !child.Cancelled && (child.Visualize || hasVisualizedDescendant(child)),
  );
};

export const applyHierarchySelection = (
  nodes: InteractionHierarchyNode[],
  selectedNodeNames: Iterable<string>,
  cancelledNodeNames: Iterable<string> = [],
  ancestorCancelled = false,
): InteractionHierarchyNode[] => {
  const selectedNames = new Set(selectedNodeNames);
  const cancelledNames = new Set(cancelledNodeNames);

  return nodes.map((node) => ({
    ...node,
    Visualize: selectedNames.has(node.Name) && !ancestorCancelled && !cancelledNames.has(node.Name),
    Cancelled: ancestorCancelled || cancelledNames.has(node.Name),
    Children: applyHierarchySelection(
      node.Children ?? [],
      selectedNames,
      cancelledNames,
      ancestorCancelled || cancelledNames.has(node.Name),
    ),
  }));
};

export const getCancelledHierarchySelection = (
  nodes: InteractionHierarchyNode[],
): string[] => {
  const cancelledNames: string[] = [];

  const collect = (hierarchyNodes: InteractionHierarchyNode[]): void => {
    hierarchyNodes.forEach((node) => {
      if (node.Cancelled) {
        cancelledNames.push(node.Name);
      }

      collect(node.Children ?? []);
    });
  };

  collect(nodes);

  return cancelledNames;
};

const toTreeRoot = (nodes: InteractionHierarchyNode[]): TreeNode => {
  return {
    Name: ROOT_NAME,
    isRoot: true,
    Children: nodes.map(toTreeNode),
  };
};

const toTreeNode = (node: InteractionHierarchyNode): TreeNode => {
  return {
    Name: node.Name,
    Children: (node.Children ?? []).map(toTreeNode),
  };
};

const getLeafPaths = (nodes: InteractionHierarchyNode[]): string[][] => {
  const paths: string[][] = [];

  const visit = (node: InteractionHierarchyNode, path: string[]): void => {
    const nextPath = [...path, node.Name];
    const children = node.Children ?? [];

    if (!children.length) {
      paths.push(nextPath);
      return;
    }

    children.forEach((child) => visit(child, nextPath));
  };

  nodes.forEach((node) => visit(node, []));

  return paths;
};

const isSelectionValid = (
  nodes: InteractionHierarchyNode[],
  selectedNodeNames: Set<string>,
  cancelledNodeNames: Set<string>,
): boolean => {
  const leafPaths = getLeafPaths(nodes).filter((path) =>
    !path.some((nodeName) => cancelledNodeNames.has(nodeName)),
  );

  return leafPaths.every((path) =>
    path.some((nodeName) => selectedNodeNames.has(nodeName)),
  );
};

const getAncestorNames = (node: HierarchyPointNode<TreeNode>): string[] => {
  return node.ancestors()
    .filter((ancestor) => !ancestor.data.isRoot && ancestor.data.Name !== node.data.Name)
    .map((ancestor) => ancestor.data.Name);
};

const getDescendantNames = (node: HierarchyPointNode<TreeNode>): string[] => {
  return node.descendants()
    .filter((descendant) => descendant.data.Name !== node.data.Name)
    .map((descendant) => descendant.data.Name);
};

const getEffectiveCancelledNames = (
  node: HierarchyPointNode<TreeNode>,
  cancelledNodeNames: Set<string>,
): string[] => {
  return node.ancestors()
    .filter((ancestor) => !ancestor.data.isRoot && cancelledNodeNames.has(ancestor.data.Name))
    .map((ancestor) => ancestor.data.Name);
};

const getCurvedLinkPath = (
  source: HierarchyPointNode<TreeNode>,
  target: HierarchyPointNode<TreeNode>,
): string => {
  const midY = (source.y + target.y) / 2;

  return [
    `M${source.y},${source.x}`,
    `C${midY},${source.x}`,
    `${midY},${target.x}`,
    `${target.y},${target.x}`,
  ].join(" ");
};

const getTreeLayout = (
  nodes: InteractionHierarchyNode[],
): {
  descendants: HierarchyPointNode<TreeNode>[];
  links: Array<{source: HierarchyPointNode<TreeNode>; target: HierarchyPointNode<TreeNode>}>;
  height: number;
} => {
  const root = d3Hierarchy(toTreeRoot(nodes), (node) => node.Children);
  const leafCount = Math.max(1, root.leaves().length);
  const maxDepth = Math.max(1, root.height);
  const height = Math.max(90, leafCount * NODE_X_GAP + MARGIN_Y * 2);
  const layout = d3Tree<TreeNode>().size([height - MARGIN_Y * 2, maxDepth * NODE_Y_GAP]);
  const laidOutRoot = layout(root);

  return {
    descendants: laidOutRoot.descendants(),
    links: laidOutRoot.links(),
    height,
  };
};

const HierarchySelector: React.FC<HierarchySelectorProps> = ({
  title,
  hierarchy,
  selectedNodeNames,
  cancelledNodeNames = [],
  allowCancel = false,
  onApply,
  onClose,
}) => {
  const [selectedNames, setSelectedNames] = useState<Set<string>>(
    () => new Set(selectedNodeNames),
  );
  const [cancelledNames, setCancelledNames] = useState<Set<string>>(
    () => new Set(cancelledNodeNames),
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const layout = useMemo(() => getTreeLayout(hierarchy), [hierarchy]);

  useEffect(() => {
    setSelectedNames(new Set(selectedNodeNames));
    setCancelledNames(new Set(cancelledNodeNames));
    setValidationMessage(null);
  }, [cancelledNodeNames, selectedNodeNames, title]);

  const toggleNode = (node: HierarchyPointNode<TreeNode>): void => {
    if (node.data.isRoot || getEffectiveCancelledNames(node, cancelledNames).length) {
      return;
    }

    setValidationMessage(null);
    setSelectedNames((currentNames) => {
      const nextNames = new Set(currentNames);

      if (nextNames.has(node.data.Name)) {
        nextNames.delete(node.data.Name);
      } else {
        nextNames.add(node.data.Name);
        getAncestorNames(node).forEach((ancestorName) => {
          nextNames.delete(ancestorName);
        });
        getDescendantNames(node).forEach((descendantName) => {
          nextNames.delete(descendantName);
        });
      }

      return nextNames;
    });
  };

  const toggleCancelledNode = (
    event: React.MouseEvent,
    node: HierarchyPointNode<TreeNode>,
  ): void => {
    event.stopPropagation();

    if (node.data.isRoot) {
      return;
    }

    setValidationMessage(null);
    setCancelledNames((currentNames) => {
      const nextNames = new Set(currentNames);
      const cancelledAncestors = getEffectiveCancelledNames(node, nextNames);

      if (cancelledAncestors.length) {
        cancelledAncestors.forEach((cancelledName) => {
          nextNames.delete(cancelledName);
        });
        getDescendantNames(node).forEach((descendantName) => {
          nextNames.delete(descendantName);
        });
        nextNames.delete(node.data.Name);
      } else {
        nextNames.add(node.data.Name);
        getDescendantNames(node).forEach((descendantName) => {
          nextNames.delete(descendantName);
        });
      }

      return nextNames;
    });
    setSelectedNames((currentNames) => {
      const nextNames = new Set(currentNames);

      nextNames.delete(node.data.Name);
      getDescendantNames(node).forEach((descendantName) => {
        nextNames.delete(descendantName);
      });

      return nextNames;
    });
  };

  const handleApply = (): void => {
    if (!isSelectionValid(hierarchy, selectedNames, cancelledNames)) {
      setValidationMessage("Select at least one node on every path from the root to a leaf.");
      return;
    }

    onApply(
      applyHierarchySelection(hierarchy, selectedNames, cancelledNames),
      Array.from(selectedNames),
      Array.from(cancelledNames),
    );
  };

  return (
    <div className="hierarchy-selector">
      <div className="hierarchy-selector-toolbar">
        <div>
          <h3>{title}</h3>
          <div className="hierarchy-selector-meta">
            {selectedNames.size} nodes selected
          </div>
        </div>

        <div className="hierarchy-selector-actions">
          <Button onClick={onClose}>
            Close
          </Button>
          <Button type="primary" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>

      {validationMessage && (
        <Alert
          type="error"
          showIcon
          title={validationMessage}
        />
      )}

      <div className="hierarchy-selector-canvas">
        <svg
          viewBox={`0 0 ${WIDTH} ${layout.height}`}
          role="img"
          aria-label={title}
        >
          <g transform={`translate(${MARGIN_X} ${MARGIN_Y})`}>
            {layout.links.map((link) => (
              <path
                key={`${link.source.data.Name}-${link.target.data.Name}`}
                className="hierarchy-selector-link"
                d={getCurvedLinkPath(link.source, link.target)}
              />
            ))}

            {layout.descendants.map((node) => {
              const selected = selectedNames.has(node.data.Name);
              const cancelled = getEffectiveCancelledNames(node, cancelledNames).length > 0;

              return (
                <g
                  key={node.data.Name}
                  className={[
                    "hierarchy-selector-node",
                    selected ? "is-selected" : "",
                    cancelled ? "is-cancelled" : "",
                    node.data.isRoot ? "is-root" : "",
                  ].join(" ")}
                  transform={`translate(${node.y} ${node.x})`}
                  onClick={() => toggleNode(node)}
                >
                  <circle r={node.data.isRoot ? NODE_RADIUS + 0.75 : NODE_RADIUS} />
                  <text
                    x={6}
                    y={2.5}
                  >
                    {node.data.Name}
                  </text>
                  {allowCancel && !node.data.isRoot && (
                    <text
                      className="hierarchy-selector-cancel"
                      x={-10}
                      y={3}
                      onClick={(event) => toggleCancelledNode(event, node)}
                    >
                      {cancelled ? "+" : "x"}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default HierarchySelector;
