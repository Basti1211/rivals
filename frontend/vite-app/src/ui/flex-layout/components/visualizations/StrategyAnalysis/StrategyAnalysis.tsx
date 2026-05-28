import React, { useEffect, useState } from "react";
import type { FetchInteractionDataResponse, FetchUsersAndTasks, InteractionRequestRow } from "../../../../../types/dataTypes";
import { fetchInteractions, fetchUsersAndTasks, getErrorMessage } from "../../../../../api-handler/Requests";
import StrategyAnalysisView from "./StrategyAnalysisView";
import DataManipulator from "../common/DataManipulator";
import Information from "../common/Information";

type StrategyAnalysisProps = {
    visualizationId: string;
    initialData: FetchInteractionDataResponse | null;
};

const strategyAnalysisInformation = "This analysis explores search strategies from user action sequences. It can train a Random Forest classifier on action frequencies and optional 2-grams to predict task success, then shows model accuracy and the most indicative features. It also compares action-frequency differences between successful and unsuccessful queries to help explain user behavior and support search tool design decisions.";

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
        <div style={{ height: "100%", overflow: "auto" }}>
            <StrategyAnalysisView
                data={data}
                dataSelector={isManipulatorOpen ? (
                    <DataManipulator
                        displayedData={data}
                        availableData={availableData}
                        isLoadingAvailableData={isLoadingAvailable}
                        errorMessage={error}
                        isUpdatingData={isUpdating}
                        onUpdateData={handleUpdateData}
                        onClose={data ? () => setIsManipulatorOpen(false) : undefined}
                    />
                ) : null}
                onOpenDataManipulator={() => setIsManipulatorOpen(true)}
                informationAction={<Information information={strategyAnalysisInformation} />}
            />
        </div>
    );
};

export default StrategyAnalysis;
