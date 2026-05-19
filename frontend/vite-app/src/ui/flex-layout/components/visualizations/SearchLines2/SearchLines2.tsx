import {useState} from "react";
import type React from "react";
import {fetchInteractions, fetchUsersAndTasks} from "../../../../../api-handler/Requests";
import type {
  FetchInteractionDataResponse,
  FetchUsersAndTasks,
  InteractionRequestRow,
} from "../../../../../types/dataTypes";
import DataManipulator from "../common/DataManipulator";
import VisualizationSnapshotMenu from "../common/VisualizationSnapshotMenu";
import SearchLines2View from "./SearchLines2View";
import "../../../../style/general.css";
import "../CountBarchart/countBarchart.css";
import "./searchLines2.css";

type SearchLines2Props = {
  visualizationId?: string;
  initialData?: FetchInteractionDataResponse | null;
};

const cloneInteractionData = (
  data: FetchInteractionDataResponse | null,
): FetchInteractionDataResponse | null => {
  return data ? structuredClone(data) : null;
};

const SearchLines2: React.FC<SearchLines2Props> = ({
  visualizationId,
  initialData = null,
}) => {
  const [displayedData, setDisplayedData] = useState<FetchInteractionDataResponse | null>(() =>
    cloneInteractionData(initialData),
  );
  const [availableData, setAvailableData] = useState<FetchUsersAndTasks | null>(null);
  const [isManipulatorOpen, setIsManipulatorOpen] = useState(false);
  const [isLoadingAvailableData, setIsLoadingAvailableData] = useState(false);
  const [isUpdatingData, setIsUpdatingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpenDataManipulator = async () => {
    setIsManipulatorOpen(true);
    await handleFetchAvailableData();
  };

  const handleFetchAvailableData = async () => {
    setIsLoadingAvailableData(true);
    setErrorMessage(null);

    try {
      const fetchedData = await fetchUsersAndTasks();
      setAvailableData(structuredClone(fetchedData));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to fetch available data.");
    } finally {
      setIsLoadingAvailableData(false);
    }
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
      <SearchLines2View
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
            onClose={() => setIsManipulatorOpen(false)}
          />
        ) : null}
        onOpenDataManipulator={handleOpenDataManipulator}
        snapshotActions={(
          <VisualizationSnapshotMenu
            currentData={displayedData}
            sourceVisualizationId={visualizationId}
            sourceVisualizationType="searchLines2"
          />
        )}
      />
    </div>
  );
};

export default SearchLines2;
