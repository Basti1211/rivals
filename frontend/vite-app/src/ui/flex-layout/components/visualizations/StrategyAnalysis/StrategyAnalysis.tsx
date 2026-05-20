import React, { useEffect, useState } from "react";
import type { FetchInteractionDataResponse, FetchUsersAndTasks, InteractionRequestRow } from "../../../../../types/dataTypes";
import { fetchInteractions, fetchUsersAndTasks, getErrorMessage } from "../../../../../api-handler/Requests";
import StrategyAnalysisView from "./StrategyAnalysisView";
import DataManipulator from "../common/DataManipulator";

type StrategyAnalysisProps = {
    visualizationId: string;
    initialData: FetchInteractionDataResponse | null;
};

const StrategyAnalysis: React.FC<StrategyAnalysisProps> = ({ initialData }) => {
    const [data, setData] = useState<FetchInteractionDataResponse | null>(initialData);
    const [availableData, setAvailableData] = useState<FetchUsersAndTasks | null>(null);
    const [isManipulatorOpen, setIsManipulatorOpen] = useState<boolean>(!initialData);
    const [isLoadingAvailable, setIsLoadingAvailable] = useState<boolean>(false);
    const [isUpdating, setIsUpdating] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch the global user/task pool for the DataManipulator when opened
    useEffect(() => {
        if (isManipulatorOpen && !availableData && !isLoadingAvailable) {
            setIsLoadingAvailable(true);
            fetchUsersAndTasks()
                .then(setAvailableData)
                .catch((err) => setError(getErrorMessage(err)))
                .finally(() => setIsLoadingAvailable(false));
        }
    }, [isManipulatorOpen, availableData, isLoadingAvailable]);

    const handleUpdateData = async (interactions: InteractionRequestRow[]) => {
        setIsUpdating(true);
        setError(null);
        try {
            const newData = await fetchInteractions({ interactions });
            setData(newData);
            setIsManipulatorOpen(false);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div style={{ height: "100%", position: "relative", overflow: "auto" }}>
            <StrategyAnalysisView
                data={data}
                onOpenDataManipulator={() => setIsManipulatorOpen(true)}
            />

            {isManipulatorOpen && (
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
                    background: "var(--bg-color, #fff)", borderBottom: "1px solid #ccc", padding: "16px"
                }}>
                    <DataManipulator
                        displayedData={data}
                        availableData={availableData}
                        isLoadingAvailableData={isLoadingAvailable}
                        errorMessage={error}
                        isUpdatingData={isUpdating}
                        onUpdateData={handleUpdateData}
                        onClose={data ? () => setIsManipulatorOpen(false) : undefined}
                    />
                </div>
            )}
        </div>
    );
};

export default StrategyAnalysis;