import React, { useEffect, useState } from "react";
import { Alert, Button, Input, notification } from "antd";
import "../../../../style/general.css";
import "./dataLoader.css";
import {
  InspectDresLogsResponse,
  LoadDataResponse,
  ValidJsonFile,
} from "../../../../../types/dataTypes";
import { useDataRefresh } from "../../../flex-layout-context/DataRefreshContext";
import JsonUploadBox from "./JsonUploadBox";

type LoadTarget = "demo" | "tasks" | "answers" | "interactionLogs" | "dresLogs";
type RealDataTarget = "tasks" | "answers" | "interactionLogs";

type UploadPayload = {
  filename: string;
  data: unknown;
};

const REAL_DATA_ENDPOINTS: Record<RealDataTarget, string> = {
  tasks: "/api/data/load-tasks",
  answers: "/api/data/load-answers",
  interactionLogs: "/api/data/load-interaction-logs",
};

const responseMetrics = [
  { label: "New tasks", key: "loadedTasks" },
  { label: "New users", key: "loadedUsers" },
  { label: "New answers", key: "loadedAnswers" },
  { label: "New logs", key: "loadedLogs" },
  { label: "Total tasks", key: "totalTasks" },
  { label: "Total users", key: "totalUsers" },
  { label: "Total answers", key: "totalAnswers" },
  { label: "Total logs", key: "totalLogs" },
] as const;

const emptyLoadDataResponse = (errorMessage: string | null = null): LoadDataResponse => ({
  loadedTasks: 0,
  loadedUsers: 0,
  loadedLogs: 0,
  loadedAnswers: 0,
  totalTasks: 0,
  totalUsers: 0,
  totalLogs: 0,
  totalAnswers: 0,
  sourceFiles: [],
  errorMessage,
});

const formatSummaryNumber = (value: number): string => {
  const absoluteValue = Math.abs(value);
  const formatter = new Intl.NumberFormat("en", {
    maximumSignificantDigits: 3,
  });

  if (absoluteValue >= 1_000_000_000) {
    return `${formatter.format(value / 1_000_000_000)}b`;
  }

  if (absoluteValue >= 1_000_000) {
    return `${formatter.format(value / 1_000_000)}m`;
  }

  if (absoluteValue >= 1_000) {
    return `${formatter.format(value / 1_000)}k`;
  }

  return formatter.format(value);
};

const readLoadDataResponse = async (res: Response): Promise<LoadDataResponse> => {
  const data = await res.json() as Partial<LoadDataResponse>;

  if (!res.ok) {
    return {
      ...emptyLoadDataResponse(),
      ...data,
      errorMessage: data?.errorMessage ?? `Request failed with ${res.status}`,
    };
  }

  return {
    ...emptyLoadDataResponse(),
    ...data,
  };
};

const readInspectDresLogsResponse = async (res: Response): Promise<InspectDresLogsResponse> => {
  const data = await res.json() as Partial<InspectDresLogsResponse>;

  return {
    taskGroups: [],
    users: [],
    taskCount: 0,
    submissionCount: 0,
    errorMessage: res.ok ? null : `Request failed with ${res.status}`,
    ...data,
  };
};

const DataLoader: React.FC = () => {
  const { notifyDataChanged } = useDataRefresh();
  const [loadResponse, setLoadResponse] = useState<LoadDataResponse>(emptyLoadDataResponse());
  const [activeLoadTarget, setActiveLoadTarget] = useState<LoadTarget | null>(null);
  const [deletingSourceFileIds, setDeletingSourceFileIds] = useState<Set<number>>(() => new Set());
  const [dresUpload, setDresUpload] = useState<UploadPayload | null>(null);
  const [dresInspect, setDresInspect] = useState<InspectDresLogsResponse | null>(null);
  const [dresTaskGroupDatasets, setDresTaskGroupDatasets] = useState<Record<string, string>>({});
  const [dresDatasetRoots, setDresDatasetRoots] = useState<Record<string, string>>({});

  const showInvalidJsonNotification = (): void => {
    notification.error({
      message: "Not a valid JSON",
      description: "Please upload only valid .json files.",
    });
  };

  useEffect(() => {
    const loadSummary = async (): Promise<void> => {
      try {
        const res = await fetch("/api/data/get-load-summary");
        const data = await readLoadDataResponse(res);

        setLoadResponse(data);
      } catch (error) {
        setLoadResponse(
          emptyLoadDataResponse(
            error instanceof Error ? error.message : "Failed to fetch load summary.",
          ),
        );
      }
    };

    void loadSummary();
  }, []);

  const handleUseDemo = async (): Promise<void> => {
    setActiveLoadTarget("demo");

    try {
      const res = await fetch("/api/data/initialize-demo-data", {
        method: "POST",
      });
      const data = await readLoadDataResponse(res);

      setLoadResponse(data);
      if (res.ok) {
        notifyDataChanged();
      }
    } catch (error) {
      setLoadResponse(
        emptyLoadDataResponse(
          error instanceof Error ? error.message : "Failed to load demo data.",
        ),
      );
    } finally {
      setActiveLoadTarget(null);
    }
  };

  const handleRealDataUpload = async (
    validJsonFiles: ValidJsonFile[],
    target: RealDataTarget,
  ): Promise<void> => {
    setActiveLoadTarget(target);

    try {
      const payload = validJsonFiles.length === 1
        ? toUploadPayload(validJsonFiles[0])
        : validJsonFiles.map(toUploadPayload);

      const res = await fetch(REAL_DATA_ENDPOINTS[target], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await readLoadDataResponse(res);

      setLoadResponse(data);
      if (res.ok) {
        notifyDataChanged();
      }
    } catch (error) {
      setLoadResponse(
        emptyLoadDataResponse(
          error instanceof Error ? error.message : "Failed to load real data.",
        ),
      );
    } finally {
      setActiveLoadTarget(null);
    }
  };

  const toUploadPayload = ({ file, data }: ValidJsonFile): UploadPayload => ({
    filename: file.name,
    data,
  });

  const handleInteractionsUpload = (validJsonFiles: ValidJsonFile[]): void => {
    void handleRealDataUpload(validJsonFiles, "interactionLogs");
  };

  const handleDresLogsUpload = async (validJsonFiles: ValidJsonFile[]): Promise<void> => {
    const dresFile = validJsonFiles[0];
    if (!dresFile) {
      return;
    }

    if (validJsonFiles.length > 1) {
      notification.warning({
        message: "Only one DRES file selected",
        description: "Using the first JSON file for this import.",
      });
    }

    setActiveLoadTarget("dresLogs");

    try {
      const payload = toUploadPayload(dresFile);
      const res = await fetch("/api/data/inspect-dres-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await readInspectDresLogsResponse(res);
      const nextTaskGroupDatasets = data.taskGroups.reduce<Record<string, string>>(
        (datasets, taskGroup) => ({
          ...datasets,
          [taskGroup.taskGroup]: dresTaskGroupDatasets[taskGroup.taskGroup] ?? "",
        }),
        {},
      );

      setDresUpload(payload);
      setDresInspect(data);
      setDresTaskGroupDatasets(nextTaskGroupDatasets);

      if (data.errorMessage) {
        setLoadResponse(emptyLoadDataResponse(data.errorMessage));
      }
    } catch (error) {
      setDresUpload(null);
      setDresInspect(null);
      setLoadResponse(
        emptyLoadDataResponse(
          error instanceof Error ? error.message : "Failed to inspect DRES logs.",
        ),
      );
    } finally {
      setActiveLoadTarget(null);
    }
  };

  const handleAnswersUpload = (validJsonFiles: ValidJsonFile[]): void => {
    void handleRealDataUpload(validJsonFiles, "answers");
  };

  const handleTasksUpload = (validJsonFiles: ValidJsonFile[]): void => {
    void handleRealDataUpload(validJsonFiles, "tasks");
  };

  const handleDresTaskGroupDatasetChange = (taskGroup: string, dataset: string): void => {
    setDresTaskGroupDatasets((currentMappings) => ({
      ...currentMappings,
      [taskGroup]: dataset,
    }));
  };

  const handleDresDatasetRootChange = (dataset: string, root: string): void => {
    setDresDatasetRoots((currentRoots) => ({
      ...currentRoots,
      [dataset]: root,
    }));
  };

  const handleLoadDresLogs = async (): Promise<void> => {
    if (!dresUpload) {
      return;
    }

    setActiveLoadTarget("dresLogs");

    try {
      const res = await fetch("/api/data/load-dres-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: dresUpload.filename,
          data: dresUpload.data,
          taskGroupDatasets: dresTaskGroupDatasets,
          datasetRoots: dresDatasetRoots,
        }),
      });
      const data = await readLoadDataResponse(res);

      setLoadResponse(data);
      if (res.ok && !data.errorMessage) {
        setDresUpload(null);
        setDresInspect(null);
        setDresTaskGroupDatasets({});
        setDresDatasetRoots({});
        notifyDataChanged();
      }
    } catch (error) {
      setLoadResponse(
        emptyLoadDataResponse(
          error instanceof Error ? error.message : "Failed to load DRES logs.",
        ),
      );
    } finally {
      setActiveLoadTarget(null);
    }
  };

  const handleDeleteSourceFile = async (sourceFileId: number): Promise<void> => {
    setDeletingSourceFileIds((currentIds) => new Set(currentIds).add(sourceFileId));

    try {
      const res = await fetch(`/api/data/source-files/${sourceFileId}`, {
        method: "DELETE",
      });
      const data = await readLoadDataResponse(res);

      setLoadResponse(data);
      if (res.ok) {
        notifyDataChanged();
      }
    } catch (error) {
      setLoadResponse((currentResponse) => ({
        ...currentResponse,
        errorMessage: error instanceof Error ? error.message : "Failed to delete source file data.",
      }));
    } finally {
      setDeletingSourceFileIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(sourceFileId);
        return nextIds;
      });
    }
  };

  const hasNewRows = loadResponse.loadedTasks
    + loadResponse.loadedUsers
    + loadResponse.loadedLogs
    + loadResponse.loadedAnswers > 0;
  const dresSelectedDatasets = Array.from(
    new Set(
      Object.values(dresTaskGroupDatasets)
        .map((dataset) => dataset.trim())
        .filter(Boolean),
    ),
  ).sort();
  const isDresImportReady = Boolean(
    dresUpload
    && dresInspect
    && !dresInspect.errorMessage
    && dresInspect.taskGroups.length > 0
    && dresInspect.taskGroups.every(({ taskGroup }) => dresTaskGroupDatasets[taskGroup]?.trim())
    && dresSelectedDatasets.every((dataset) => dresDatasetRoots[dataset]?.trim()),
  );

  return (
    <div className="data-loader">
      <h1>Load Data</h1>

      <section className="data-loader-section summary-section">
        <h2>Summary</h2>

        <div className="summary-content">
          <div className="summary-grid">
            {responseMetrics.map(({ label, key }) => (
              <div className="summary-metric" key={key}>
                <span>{label}</span>
                <strong>{formatSummaryNumber(loadResponse[key])}</strong>
              </div>
            ))}
          </div>

          {loadResponse.errorMessage ? (
            <Alert
              className="summary-alert"
              type="error"
              showIcon
              title="Load error"
              description={loadResponse.errorMessage}
            />
          ) : (
            <Alert
              className="summary-alert"
              type="success"
              showIcon
              title={hasNewRows ? "Data loaded successfully" : "Current data summary"}
            />
          )}

          <div className="summary-files">
            <h3>Loaded Files</h3>

            {loadResponse.sourceFiles.length ? (
              <ul className="summary-file-list">
                {loadResponse.sourceFiles.map((sourceFile) => (
                  <li key={sourceFile.id}>
                    <span>{sourceFile.filename}</span>
                    <div className="summary-file-actions">
                      <small>#{sourceFile.id}</small>
                      <Button
                        aria-label={`Delete ${sourceFile.filename}`}
                        className="summary-file-delete"
                        danger
                        disabled={activeLoadTarget !== null}
                        loading={deletingSourceFileIds.has(sourceFile.id)}
                        size="small"
                        type="text"
                        onClick={() => void handleDeleteSourceFile(sourceFile.id)}
                      >
                        x
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="summary-empty">No files loaded yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="data-loader-section use-demo-section">
        <h2>Load Demo Data</h2>

        <Button
          type="primary"
          loading={activeLoadTarget === "demo"}
          onClick={handleUseDemo}
        >
          Load Demo Data
        </Button>
      </section>

      <section className="data-loader-section upload-data-section">
        <h2>Load Real Data</h2>

        <div className="upload-group tasks-upload">
          <h3>Load Tasks</h3>

          <JsonUploadBox
            label="Load Tasks"
            onValidJsonFiles={handleTasksUpload}
            onInvalidJson={showInvalidJsonNotification}
          />
        </div>

        <div className="upload-group answers-upload">
          <h3>Load Answers</h3>

          <JsonUploadBox
            label="Load Answers"
            onValidJsonFiles={handleAnswersUpload}
            onInvalidJson={showInvalidJsonNotification}
          />
        </div>

        <div className="upload-group interactions-upload">
          <h3>Load Interaction Logs</h3>

          <JsonUploadBox
            label="Load Interaction Logs"
            onValidJsonFiles={handleInteractionsUpload}
            onInvalidJson={showInvalidJsonNotification}
          />
        </div>

        <div className="upload-group dres-logs-upload">
          <h3>Load DRES Logs</h3>

          <JsonUploadBox
            label="Load DRES Logs"
            onValidJsonFiles={(files) => void handleDresLogsUpload(files)}
            onInvalidJson={showInvalidJsonNotification}
          />

          {dresInspect ? (
            <div className="dres-import-config">
              {dresInspect.errorMessage ? (
                <Alert
                  type="error"
                  showIcon
                  title="DRES inspection failed"
                  description={dresInspect.errorMessage}
                />
              ) : (
                <>
                  <div className="dres-import-summary">
                    <span>{formatSummaryNumber(dresInspect.taskCount)} tasks</span>
                    <span>{formatSummaryNumber(dresInspect.submissionCount)} submissions</span>
                    <span>{formatSummaryNumber(dresInspect.users.length)} users</span>
                  </div>

                  <div className="dres-config-section">
                    <h4>Task Groups</h4>

                    {dresInspect.taskGroups.map((taskGroup) => (
                      <label className="dres-config-row" key={taskGroup.taskGroup}>
                        <span>
                          <strong>{taskGroup.taskGroup}</strong>
                          <small>{formatSummaryNumber(taskGroup.taskCount)} tasks</small>
                        </span>
                        <Input
                          value={dresTaskGroupDatasets[taskGroup.taskGroup] ?? ""}
                          placeholder="Dataset"
                          onChange={(event) => handleDresTaskGroupDatasetChange(
                            taskGroup.taskGroup,
                            event.target.value,
                          )}
                        />
                      </label>
                    ))}
                  </div>

                  {dresSelectedDatasets.length ? (
                    <div className="dres-config-section">
                      <h4>Video Roots</h4>

                      {dresSelectedDatasets.map((dataset) => (
                        <label className="dres-config-row" key={dataset}>
                          <span>
                            <strong>{dataset}</strong>
                          </span>
                          <Input
                            value={dresDatasetRoots[dataset] ?? ""}
                            placeholder="Video root"
                            onChange={(event) => handleDresDatasetRootChange(
                              dataset,
                              event.target.value,
                            )}
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}

                  <Button
                    type="primary"
                    disabled={!isDresImportReady}
                    loading={activeLoadTarget === "dresLogs"}
                    onClick={() => void handleLoadDresLogs()}
                  >
                    Import DRES Logs
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default DataLoader;
