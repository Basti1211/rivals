import React, {createContext, useContext, useRef, useState} from "react";
import {Action, Actions, DockLocation, IJsonTabNode, Model} from "flexlayout-react";
import {createNewNode, findNodeById, getActiveTabsetSafe, initialLayout} from "./LayoutManagerHelper.ts";


export interface ILayoutContext {
    currLayoutModel: Model;
    addTabToActiveTabSet: (newName: string, newType: string, config?: unknown) => string;
    changeName: (nodeID: string, newName: string) => void;
    changeTabComponent: (nodeId: string, newType: string) => void;
    handleModelChange: (mode: Model, action: Action) => Action | undefined;
    version: number;
}


const LayoutManagerContext = createContext<ILayoutContext | undefined>(undefined);

export const useLayout = () => {
    const context = useContext(LayoutManagerContext);
    if (!context) {
        throw new Error('useLayout must be used within a LayoutProvider');
    }
    return context;
};

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({children}) => {

    // load the initial layout
    const currLayoutModelRef = useRef(
        Model.fromJson(initialLayout)
    );

    // State for triggering React re-renders in the component containing the library handler (Fleylayout)
    const [version, setVersion] = useState<number>(0);


    /**
     * Explicit change handler to apply changes coming internally from the library to our reference state
     * We do not force update here otherwise the re-render would trouble dragging etc. functionality
     * @param _ model
     * @param action
     */
    const handleModelChange = (_: Model, action: Action): Action | undefined => {
        console.log("recieved Change", action)
        //localStorage.setItem('layoutModel', JSON.stringify(currLayoutModelRef.current.toJson()));
        return action; // Propagate Action to the library, even though it's applied by now
    };

    /**
     * update function using the version state to force consuming react components to update
     */
    const forceUpdateLayout = () => setVersion((v) => v + 1);


    /**
     * Function to add a new tab to the active TabSet (safely).
     * Enables new components to be added to the layout.
     * @param newName - The new name to apply.
     * @param newType - The new component type to render, described by the factory.
     * @returns {string} - The ID of the newly added tab.
     */
    const addTabToActiveTabSet = (newName: string, newType: string, config?: unknown): string => {
        // Get the active TabSet safely
        const activeTabset = getActiveTabsetSafe(currLayoutModelRef.current);
        if (!activeTabset) {
            console.error("No active TabSet found. Cannot add a new tab. Maybe the model is broken");
            return ""; // Fallback, no active TabSet, should never occur in safe but here we are
        }

        // Create a new tab node
        const newNode: IJsonTabNode = createNewNode(newName, newType, config);

        // Add the new tab node to the active TabSet using the addNode action
        const addedNode = currLayoutModelRef.current.doAction(
            Actions.addNode(
                newNode,                   // New node configuration
                activeTabset.getId(),      // TabSet ID
                DockLocation.CENTER,       // Dock location, not used but necessary
                -1                   // Add to the end of the TabSet
            )
        ) as {getId?: () => string} | undefined;

        if (addedNode?.getId) {
            return addedNode.getId();
        }

        // Get the newly added tab's ID
        const newChildren = activeTabset.getChildren();
        if (newChildren.length > 0) {
            const newTab = newChildren[newChildren.length - 1]; // Last child is the newly added tab
            return newTab.getId();
        }

        console.error("Tab was added, but could not retrieve the new tab ID.");
        return ""; // Fallback, should never happen but
    };


    /**
     * Function to change the name of the component/node
     * @param nodeId - The ID of the node to update.
     * @param newName - The new name to apply.
     */
    const changeName = (nodeId: string, newName: string): void => {
        const jsonModel = currLayoutModelRef.current.toJson(); // Copy the model as JSON
        const jsonNode = findNodeById(jsonModel.layout, nodeId);

        if (jsonNode) {
            jsonNode.name = newName;

            // Apply the change using FlexLayout's built-in `updateNodeAttributes` action
            currLayoutModelRef.current.doAction(
                Actions.updateNodeAttributes(nodeId, {name: newName})
            );
            // Trigger React component re-render
            forceUpdateLayout();

        } else {
            console.error(`Failed to rename node with id ${nodeId}. Node not found.`);
        }
    };


    /**
     * Function to change the rendered component (type) of a specific node.
     * @param nodeId - The ID of the node to update.
     * @param newType - The new component type to render, described by the factory.
     */
    const changeTabComponent = (nodeId: string, newType: string): void => {
        const node = currLayoutModelRef.current.getNodeById(nodeId);

        if (node) {
            // Use FlexLayout's built-in action to update the component type
            currLayoutModelRef.current.doAction(
                Actions.updateNodeAttributes(nodeId, {component: newType})
            );
            // Trigger React component re-render
            forceUpdateLayout();
        } else {
            console.error(`Failed to change component type on node ${nodeId}. Node not found.`);
        }
    };


    // Provide the context value
    const contextValue: ILayoutContext = {
        currLayoutModel: currLayoutModelRef.current,
        addTabToActiveTabSet,
        changeName,
        changeTabComponent,
        handleModelChange,
        version
    };

    return (
        <LayoutManagerContext.Provider value={contextValue}>
            {children}
        </LayoutManagerContext.Provider>
    );
};
