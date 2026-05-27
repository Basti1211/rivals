import {Actions, IJsonModel, IJsonRowNode, IJsonTabNode, IJsonTabSetNode, Model, TabSetNode} from "flexlayout-react";


/**
 * Function to give a new, typed node to add to the model
 * @param newName
 * @param component
 */
export const createNewNode = (newName: string, component: string = "default", config?: unknown): IJsonTabNode => {
    return {
        // define new node
        type: 'tab',
        name: newName,
        component: component,
        ...(config !== undefined ? {config} : {}),
    };
}


/**
 * Function to crawl through the tabs to find the Node with the matching ID (recursively)
 * @param root - The current starting point from which to traverse the subtrees.
 * @param id - The ID of the node to find.
 */
export const findNodeById = (root: IJsonRowNode | IJsonTabSetNode | IJsonTabNode, id: string): IJsonTabNode | null => {
    // Check if the current node is the one we're looking for
    if (root.id === id) {
        return root;
    }

    // If the current node has children, search them recursively
    if ('children' in root) {
        for (const child of root.children) {
            const found = findNodeById(child, id);
            if (found) {
                return found; // Node found in the subtree
            }
        }
    }

    // Node not found in this subtree
    return null;
}


/**
 * Function which returns the active tabset-node safely, meaning even if the flexlayout isn't in focus.
 * Regularly this uses the built-in function but checks if that is invalid and otherwise returns the first tabset it finds.
 * @param layoutModel
 */
export const getActiveTabsetSafe = (layoutModel: Model): TabSetNode => {
    let activeTabset = layoutModel.getActiveTabset();
    if (!activeTabset) {
        // Find the first tabset in the model
        const firstTabsetID = (layoutModel.getFirstTabSet()).getId()
        //layoutModel.getRoot().getChildren().find(node => node.getType() === "tabset").getId();

        // set it as active, although this is async and won't be in time to do "getActiveTabset()" immediately after
        layoutModel.doAction(Actions.setActiveTabset(firstTabsetID));

        // so we just return the first found tabset, which must exist for the model to be valid.
        activeTabset = layoutModel.getNodeById(firstTabsetID) as TabSetNode;
    }
    return activeTabset
}


export const initialLayout: IJsonModel = {
    global: {
        tabEnablePopout: false,
        tabSetMinWidth: 300,
        tabSetMinHeight: 300,
    },
    borders: [
    {
      type: "border",
      location: "left",
      size: 500,          // width when open
      selected: -1,       // 0=open first tab; -1=collapsed
      show: true,
      children: [
        {
          type: "tab",
          id: "LEFT_SIDEBAR_TAB",
          name: "Load Data",
          component: "data-loader",
          enableClose: false, // cannot be deleted
          enableDrag: false,  // cannot be dragged out
        },
      ],
    },
    {
      type: "border",
      location: "right",
      size: 500,          // width when open
      selected: -1,       // 0=open first tab; -1=collapsed
      show: true,
      children: [
        {
          type: "tab",
          id: "RIGHT_SIDEBAR_TAB",
          name: "Task Visualization",
          component: "task-visualization",
          enableClose: false, // cannot be deleted
          enableDrag: false,  // cannot be dragged out
        },
      ],
    }
  ],

    layout: {
        type: "row",
        id: "#horizontal",
        children: [
            {
                type: "tabset",
                weight: 35,
                children: [
                    {
                        type: "tab",
                        name: "Summary",
                        component: "summary",
                    }
                ],
            },
        ],
    },
};
