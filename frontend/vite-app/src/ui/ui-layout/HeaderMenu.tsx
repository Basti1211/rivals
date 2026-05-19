import React from 'react';
import {Button, Layout} from 'antd';
import {useLayout} from "../flex-layout/flex-layout-context/LayoutManagerContext.tsx";
import "./HeaderMenu.css";

const {Header} = Layout;

const HeaderMenu: React.FC = () => {

    const {addTabToActiveTabSet} = useLayout();

     const handleCountBarchart = () => {
        addTabToActiveTabSet("Count Barchart", "countBarchart");
    };
     const handleDurationBarchart = () => {
        addTabToActiveTabSet("Duration Barchart", "durationBarchart");
    };
     const handleSearchLines2 = () => {
        addTabToActiveTabSet("Search Lines", "searchLines2");
    };

    return (
        <Header className="app-header">
            <div className="app-header__brand">
                <div>
                    <p className="app-header__eyebrow">Data Analysis and Visualization</p>
                    <h1 className="app-header__title">RIVALS: Visualizing Interaction Logs</h1>
                </div>
            </div>

            <div className="app-header__actions">

                <Button
                    className="app-header__summary-button"
                    type="primary"
                    onClick={handleCountBarchart}
                >
                    Count Barchart
                </Button>
                <Button
                    className="app-header__summary-button"
                    type="primary"
                    onClick={handleDurationBarchart}
                >
                    Duration Barchart
                </Button>
                <Button
                    className="app-header__summary-button"
                    type="primary"
                    onClick={handleSearchLines2}
                >
                    Search Lines
                </Button>
            
            </div>
        </Header>
    );
};

export default HeaderMenu;
