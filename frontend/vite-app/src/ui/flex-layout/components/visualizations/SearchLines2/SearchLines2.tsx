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

const searchLinesInformation = "This visualization shows each selected user-task interaction sequence as a timeline. You can arrange columns by task, user, or task group, switch between frame and video rank opacity, add hierarchy overlays, zoom into a band, and select time ranges to open as count or duration bar charts.";

const SearchLines2: React.FC<SearchLines2Props> = ({
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
            onClose={displayedData ? () => setIsManipulatorOpen(false) : undefined}
          />
        ) : null}
        onOpenDataManipulator={handleOpenDataManipulator}
        informationAction={<Information information={searchLinesInformation} />}
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
