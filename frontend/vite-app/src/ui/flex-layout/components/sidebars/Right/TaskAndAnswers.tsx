import React, { useEffect, useRef, useState } from "react";
import "../../../../style/general.css";
import "./taskAndAnswers.css";
import { fetchTasksAndAnswers, getErrorMessage } from "../../../../../api-handler/Requests";
import type { FetchTasksAndAnswers } from "../../../../../types/dataTypes";
import { useDataRefresh } from "../../../flex-layout-context/DataRefreshContext";
import TaskPerformanceHeatmap from "./TaskPerformanceHeatmap";
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
  const taskElements = useRef(new Map<string, HTMLDivElement>());

  const handleTaskClick = (taskName: string): void => {
    taskElements.current.get(taskName)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const setTaskElement = (taskName: string) => (element: HTMLDivElement | null): void => {
    if (element) {
      taskElements.current.set(taskName, element);
      return;
    }

    taskElements.current.delete(taskName);
  };

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
      <h1>Performance</h1>

      {errorMessage ? (
        <p className="task-visualization-status is-error">{errorMessage}</p>
      ) : isLoading && tasksAndAnswers === null ? (
        <p className="task-visualization-status">Loading tasks...</p>
      ) : tasksAndAnswers && tasksAndAnswers.tasks.tasks.length > 0 ? (
        <>
          <TaskPerformanceHeatmap
            tasks={tasksAndAnswers.tasks.tasks}
            submissions={tasksAndAnswers.submissions.submissions}
            onTaskClick={handleTaskClick}
          />

          <h1 className="task-list-heading">Tasks</h1>
          <div className="task-visualization-list">
            {tasksAndAnswers.tasks.tasks.map((task) => (
              <div
                className="task-visualization-anchor"
                key={task.name}
                ref={setTaskElement(task.name)}
              >
                <TaskVisualization task={task} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="task-visualization-status">No tasks loaded yet.</p>
      )}
    </div>
  );
};

export default TaskAndAnswers;
