import {Layout as FlexLayout} from "flexlayout-react";
import {factory} from "./WidgetFactory.tsx";
import {useLayout} from "./flex-layout-context/LayoutManagerContext.tsx";


const MainFlexLayout = () => {
    const {
        currLayoutModel,
        handleModelChange,
        version
    } = useLayout();


    return (
        <div style={{height: "100vh"}} key={version}>
            <FlexLayout model={currLayoutModel} factory={factory} onModelChange={handleModelChange}/>
        </div>
    );






};


export default MainFlexLayout;