import React, { useEffect, useState } from "react";
import "../../../../style/general.css";
import "./taskAndAnswers.css";
import { fetchTasksAndAnswers, getErrorMessage } from "../../../../../api-handler/Requests";
import type { FetchTasksAndAnswers } from "../../../../../types/dataTypes";
import { useDataRefresh } from "../../../flex-layout-context/DataRefreshContext";
import TaskVisualization from "./TaskVisualization";

type TaskAndAnswersRefreshState = {
  revision: number;
  lastChangedAt: number | null;
};

const TaskAndAnswers: React.FC = () => {
  const { dataRevision } = useDataRefresh();
  const [refreshState, setRefreshState] = useState<TaskAndAnswersRefreshState>({
    revision: dataRevision,
    lastChangedAt: null,
  });
  const [tasksAndAnswers, setTasksAndAnswers] = useState<FetchTasksAndAnswers | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setRefreshState({
      revision: dataRevision,
      lastChangedAt: dataRevision > 0 ? Date.now() : null,
    });

    const controller = new AbortController();

    const loadTasksAndAnswers = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await fetchTasksAndAnswers(controller.signal);
        setTasksAndAnswers(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setErrorMessage(getErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadTasksAndAnswers();

    return () => {
      controller.abort();
    };
  }, [dataRevision]);

  return (
    <div
      className="task-visualization-sidebar"
      data-data-revision={refreshState.revision}
      data-last-data-change-at={refreshState.lastChangedAt ?? undefined}
      data-task-count={tasksAndAnswers?.tasks.tasks.length ?? 0}
      data-answer-count={tasksAndAnswers?.submissions.submissions.length ?? 0}
      data-is-loading={isLoading}
      data-error-message={errorMessage ?? undefined}
    >
      <h1>Tasks</h1>

      {errorMessage ? (
        <p className="task-visualization-status is-error">{errorMessage}</p>
      ) : isLoading && tasksAndAnswers === null ? (
        <p className="task-visualization-status">Loading tasks...</p>
      ) : tasksAndAnswers && tasksAndAnswers.tasks.tasks.length > 0 ? (
        <div className="task-visualization-list">
          {tasksAndAnswers.tasks.tasks.map((task) => (
            <TaskVisualization key={task.name} task={task} />
          ))}
        </div>
      ) : (
        <p className="task-visualization-status">No tasks loaded yet.</p>
      )}
    </div>
  );
};

export default TaskAndAnswers;
