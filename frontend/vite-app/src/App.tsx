import {Layout as AntLayout} from "antd";
import HeaderMenu from "./ui/ui-layout/HeaderMenu.tsx";

// Flexlayout stuff
import {DataRefreshProvider} from "./ui/flex-layout/flex-layout-context/DataRefreshContext.tsx";
import {LayoutProvider} from "./ui/flex-layout/flex-layout-context/LayoutManagerContext.tsx";
import 'flexlayout-react/style/underline.css';
import MainFlexLayout from "./ui/flex-layout/MainLayout.tsx";

const {Content} = AntLayout;


function App() {


    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            transition: "min-height 0.5s ease-in-out",
            minHeight: "100vh"
        }}>
            <div style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
            }}>
                <DataRefreshProvider>
                    <LayoutProvider>
                        <AntLayout style={{height: "100vh"}}>
                            <HeaderMenu/>
                            <Content style={{padding: 0, overflow: "hidden"}}>
                                <div style={{height: "100%", position: "relative"}}>
                                    <MainFlexLayout/>
                                </div>
                            </Content>
                        </AntLayout>
                    </LayoutProvider>
                </DataRefreshProvider>
            </div>
        </div>
    )
}

export default App
