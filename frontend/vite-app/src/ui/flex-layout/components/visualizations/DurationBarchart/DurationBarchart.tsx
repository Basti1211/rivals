import {useEffect, useState} from "react";
import type React from "react";
import {fetchInteractions, fetchUsersAndTasks} from "../../../../../api-handler/Requests";
import type {
  FetchInteractionDataResponse,
  FetchUsersAndTasks,
  InteractionRequestRow,
} from "../../../../../types/dataTypes";
import DataManipulator from "../common/DataManipulator";
import VisualizationSnapshotMenu from "../common/VisualizationSnapshotMenu";
import DurationBarchartView from "./DurationBarchartView";
import "../../../../style/general.css";
import "../CountBarchart/countBarchart.css";

type DurationBarchartProps = {
  visualizationId?: string;
  initialData?: FetchInteractionDataResponse | null;
};

const cloneInteractionData = (
  data: FetchInteractionDataResponse | null,
): FetchInteractionDataResponse | null => {
  return data ? structuredClone(data) : null;
};

const DurationBarchart: React.FC<DurationBarchartProps> = ({
  visualizationId,
  initialData = null,
}) => {
  const [displayedData, setDisplayedData] = useState<FetchInteractionDataResponse | null>(() =>
    cloneInteractionData(initialData),
  );
  const [availableData, setAvailableData] = useState<FetchUsersAndTasks | null>(null);
  const [isManipulatorOpen, setIsManipulatorOpen] = useState(() => !initialData);
  const [isLoadingAvailableData, setIsLoadingAvailableData] = useState(false);
  const [isUpdatingData, setIsUpdatingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isManipulatorOpen && !availableData && !isLoadingAvailableData) {
      setIsLoadingAvailableData(true);
      setErrorMessage(null);

      fetchUsersAndTasks()
        .then((fetchedData) => setAvailableData(structuredClone(fetchedData)))
        .catch((error) => {
          setErrorMessage(error instanceof Error ? error.message : "Failed to fetch available data.");
        })
        .finally(() => setIsLoadingAvailableData(false));
    }
  }, [isManipulatorOpen, availableData, isLoadingAvailableData]);

  const handleOpenDataManipulator = () => {
    setIsManipulatorOpen(true);
  };

  const handleUpdateData = async (interactions: InteractionRequestRow[]) => {
    setIsUpdatingData(true);
    setErrorMessage(null);

    try {
      const fetchedData = await fetchInteractions({interactions});
      setDisplayedData(cloneInteractionData(fetchedData));
      setIsManipulatorOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to fetch interaction data.");
    } finally {
      setIsUpdatingData(false);
    }
  };
  console.log("Displayed Data:", displayedData);
  return (
    <div>
      <DurationBarchartView
        data={displayedData}
        dataSelector={isManipulatorOpen ? (
          <DataManipulator
            displayedData={displayedData}
            availableData={availableData}
            isLoadingAvailableData={isLoadingAvailableData}
            errorMessage={errorMessage}
            isUpdatingData={isUpdatingData}
            hierarchyOptions={{allowCancel: false}}
            onUpdateData={handleUpdateData}
            onClose={displayedData ? () => setIsManipulatorOpen(false) : undefined}
          />
        ) : null}
        onOpenDataManipulator={handleOpenDataManipulator}
        snapshotActions={(
          <VisualizationSnapshotMenu
            currentData={displayedData}
            sourceVisualizationId={visualizationId}
            sourceVisualizationType="durationBarchart"
          />
        )}
      />
    </div>
  );
};

export default DurationBarchart;
