import {useEffect, useState} from "react";
import type React from "react";
import {Alert, Spin} from "antd";
import {fetchInteractions, fetchUsersAndTasks} from "../../../../../api-handler/Requests";
import type {
  FetchInteractionDataResponse,
  InteractionHierarchyNode,
  InteractionRequestRow,
  TaskRow,
  UserRow,
} from "../../../../../types/dataTypes";
import {useDataRefresh} from "../../../flex-layout-context/DataRefreshContext";
import Information from "../common/Information";
import CountBarchartView from "../CountBarchart/CountBarchartView";
import DurationBarchartView from "../DurationBarchart/DurationBarchartView";
import "../../../../style/general.css";
import "./summary.css";

const selectFirstHierarchyLevel = (
  hierarchy: InteractionHierarchyNode[],
  depth = 0,
): InteractionHierarchyNode[] => {
  return hierarchy.map((node) => ({
    ...node,
    Visualize: depth === 0,
    Cancelled: false,
    Children: selectFirstHierarchyLevel(node.Children ?? [], depth + 1),
  }));
};

const buildAllInteractionRequests = (
  users: UserRow[],
  tasks: TaskRow[],
): InteractionRequestRow[] => {
  return users.flatMap((user) =>
    tasks.map((task) => ({
      user: user.user,
      task: task.name,
      hierarchy: selectFirstHierarchyLevel(user.hierarchy),
    })),
  );
};

const summaryInformation = "This visualization summarizes all loaded interaction data across all users and tasks. It combines a count bar chart and a duration bar chart so the overall action distribution and measured time distribution can be compared at a glance.";
const summaryCountInformation = "This chart summarizes how often each action occurs across all loaded user-task pairs. Use the grouping control to compare counts by pair, user, system, task, task category, or all data.";
const summaryDurationInformation = "This chart summarizes the measured task time associated with each action across all loaded user-task pairs. Use the grouping control to compare durations by pair, user, system, task, task category, or all data.";

const Summary: React.FC = () => {
  const {dataRevision} = useDataRefresh();
  const [displayedData, setDisplayedData] = useState<FetchInteractionDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const loadSummaryData = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const availableData = await fetchUsersAndTasks();

        if (abortController.signal.aborted) {
          return;
        }

        const interactions = buildAllInteractionRequests(
          availableData.users.users,
          availableData.tasks.tasks,
        );

        if (!interactions.length) {
          setDisplayedData({
            tasks: availableData.tasks,
            users: availableData.users,
            submissions: {submissions: []},
            interactions: [],
          });
          return;
        }

        const fetchedData = await fetchInteractions({interactions});

        if (!abortController.signal.aborted) {
          setDisplayedData(structuredClone(fetchedData));
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to fetch summary data.");
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadSummaryData();

    return () => {
      abortController.abort();
    };
  }, [dataRevision]);

  return (
    <div className="summary-view">
      <div className="summary-view-header">
        <h1>Summary</h1>
        <div className="summary-view-actions">
          <Information information={summaryInformation} />
          {isLoading && (
            <div className="summary-view-loading">
              <Spin size="small" />
              <span>Loading all interaction data</span>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <Alert
          className="summary-view-alert"
          type="error"
          showIcon
          message={errorMessage}
        />
      )}

      <div className="summary-view-charts">
        <DurationBarchartView
          data={displayedData}
          informationAction={<Information information={summaryDurationInformation} />}
        />
        <CountBarchartView
          data={displayedData}
          informationAction={<Information information={summaryCountInformation} />}
        />
      </div>
    </div>
  );
};

export default Summary;
