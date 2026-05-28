import {useEffect, useState} from "react";
import type React from "react";
import {fetchInteractions, fetchUsersAndTasks} from "../../../../../api-handler/Requests";
import type {
  FetchInteractionDataResponse,
  FetchUsersAndTasks,
  InteractionRequestRow,
} from "../../../../../types/dataTypes";
import DataManipulator from "../common/DataManipulator";
import Information from "../common/Information";
import VisualizationSnapshotMenu from "../common/VisualizationSnapshotMenu";
import CountBarchartView from "./CountBarchartView";
import "../../../../style/general.css";
import "./countBarchart.css";

type CountBarchartProps = {
  visualizationId?: string;
  initialData?: FetchInteractionDataResponse | null;
};

const cloneInteractionData = (
  data: FetchInteractionDataResponse | null,
): FetchInteractionDataResponse | null => {
  return data ? structuredClone(data) : null;
};

const countBarchartInformation = "This visualization shows how often selected interaction actions occur. Use the Data panel to choose users, tasks, hierarchy levels, and cancelled actions, then group the bars by user-task pair, user, system, task, task category, or all selected data.";

const CountBarchart: React.FC<CountBarchartProps> = ({
  visualizationId,
  initialData = null,
}) => {
  // This is the data that the chart currently visualizes.
  // It is local React state, so every mounted CountBarchart tab has its own copy.
  const [displayedData, setDisplayedData] = useState<FetchInteractionDataResponse | null>(() =>
    cloneInteractionData(initialData),
  );

  // This is metadata about data that exists in the backend and could be displayed.
  // It is fetched when the user opens the DataManipulator.
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

  return (
    <div>
      <CountBarchartView
        data={displayedData}
        dataSelector={isManipulatorOpen ? (
          <DataManipulator
            displayedData={displayedData}
            availableData={availableData}
            isLoadingAvailableData={isLoadingAvailableData}
            errorMessage={errorMessage}
            isUpdatingData={isUpdatingData}
            hierarchyOptions={{allowCancel: true}}
            onUpdateData={handleUpdateData}
            onClose={displayedData ? () => setIsManipulatorOpen(false) : undefined}
          />
        ) : null}
        onOpenDataManipulator={handleOpenDataManipulator}
        informationAction={<Information information={countBarchartInformation} />}
        snapshotActions={(
          <VisualizationSnapshotMenu
            currentData={displayedData}
            sourceVisualizationId={visualizationId}
            sourceVisualizationType="countBarchart"
          />
        )}
      />
    </div>
  );
};

export default CountBarchart;
