import {TabNode} from 'flexlayout-react';
import DataLoader from "./components/sidebars/Left/DataLoader.js";
import CountBarchart from './components/visualizations/CountBarchart/CountBarchart.tsx';
import DurationBarchart from './components/visualizations/DurationBarchart/DurationBarchart.tsx';
import SearchLines2 from './components/visualizations/SearchLines2/SearchLines2.tsx';
import type {FetchInteractionDataResponse} from "../../types/dataTypes.tsx";

type VisualizationTabConfig = {
    initialData?: FetchInteractionDataResponse | null;
};

const getInitialData = (node: TabNode): FetchInteractionDataResponse | null => {
    const config = node.getConfig() as VisualizationTabConfig | undefined;

    return config?.initialData ? structuredClone(config.initialData) : null;
};


/**
 * Function used by WindowManagerLayout (Flexlayout) to create new windows using the component field as identifier.
 * Here we define what each component shall entail and return the corresponding div to be inserted
 * **/
export const factory = (node: TabNode) => {
    const component = node.getComponent();
    switch (component) {
        case 'data-loader':
            return <DataLoader/>;
        case "countBarchart":
            return <CountBarchart visualizationId={node.getId()} initialData={getInitialData(node)}/>
        case "durationBarchart":
            return <DurationBarchart visualizationId={node.getId()} initialData={getInitialData(node)}/>
        case "searchLines2":
            return <SearchLines2 visualizationId={node.getId()} initialData={getInitialData(node)}/>
        default:
            return null;

    }

};
