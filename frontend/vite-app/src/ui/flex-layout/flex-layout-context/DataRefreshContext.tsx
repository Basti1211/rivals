import React, {createContext, useCallback, useContext, useMemo, useState} from "react";

type DataRefreshContextValue = {
    dataRevision: number;
    notifyDataChanged: () => void;
};

const DataRefreshContext = createContext<DataRefreshContextValue | undefined>(undefined);

export const useDataRefresh = (): DataRefreshContextValue => {
    const context = useContext(DataRefreshContext);

    if (!context) {
        throw new Error("useDataRefresh must be used within a DataRefreshProvider");
    }

    return context;
};

export const DataRefreshProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const [dataRevision, setDataRevision] = useState(0);

    const notifyDataChanged = useCallback((): void => {
        setDataRevision((revision) => revision + 1);
    }, []);

    const contextValue = useMemo(
        () => ({
            dataRevision,
            notifyDataChanged,
        }),
        [dataRevision, notifyDataChanged],
    );

    return (
        <DataRefreshContext.Provider value={contextValue}>
            {children}
        </DataRefreshContext.Provider>
    );
};
