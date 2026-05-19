import {useId, useMemo, useState} from "react";
import type React from "react";
import {Button, Segmented} from "antd";
import {max, scaleBand, scaleLinear, scaleOrdinal, schemeTableau10} from "d3";
import type {
  FetchInteractionDataResponse,
  InteractionTaskUser,
  SubmissionRow,
  TaskRow,
} from "../../../../../types/dataTypes";

type GroupMode = "pair" | "user" | "system" | "task" | "taskGroup" | "all";

type DurationBarchartViewProps = {
  data: FetchInteractionDataResponse | null;
  dataSelector?: React.ReactNode;
  onOpenDataManipulator: () => void;
  snapshotActions?: React.ReactNode;
};

type ChartDatum = {
  abstractType: string;
  durationSeconds: number;
};

type ChartPanel = {
  id: string;
  title: string;
  rowKey?: string;
  columnKey?: string;
  values: ChartDatum[];
};

type TimelineEvent = {
  timestamp: number;
  abstractType: string;
  rank: number;
  order: number;
};

const CHART_WIDTH = 300;
const CHART_ROW_HEIGHT = 18;
const CHART_MARGIN = {
  top: 10,
  right: 44,
  bottom: 24,
  left: 112,
};
const LABEL_PADDING_LEFT = 4;
const LABEL_GAP = 8;

const ANSWERS_ACTION = "Answers";
const TASK_END_ACTION = "Task End";

const groupOptions: Array<{label: string; value: GroupMode}> = [
  {label: "User x Task", value: "pair"},
  {label: "User", value: "user"},
  {label: "System", value: "system"},
  {label: "Task", value: "task"},
  {label: "Task Category", value: "taskGroup"},
  {label: "All", value: "all"},
];

const secondsFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

const pairKey = (user: string, task: string): string => JSON.stringify([user, task]);

const addDuration = (
  durations: Map<string, number>,
  abstractType: string,
  durationMilliseconds: number,
): void => {
  if (durationMilliseconds <= 0) {
    return;
  }

  durations.set(
    abstractType,
    (durations.get(abstractType) ?? 0) + durationMilliseconds / 1000,
  );
};

const formatSeconds = (seconds: number): string => {
  return `${secondsFormatter.format(seconds)}s`;
};

const getTaskByName = (data: FetchInteractionDataResponse): Map<string, TaskRow> => {
  return new Map(data.tasks.tasks.map((task) => [task.name, task]));
};

const getTaskNameBySubmissionTaskId = (
  data: FetchInteractionDataResponse,
): Map<string, string> => {
  return new Map(
    data.tasks.tasks.flatMap((task) => [
      [task.name, task.name],
      [task.task_id, task.name],
    ]),
  );
};

const getSubmissionsByPair = (
  data: FetchInteractionDataResponse,
): Map<string, SubmissionRow[]> => {
  const submissionsByPair = new Map<string, SubmissionRow[]>();
  const taskNameBySubmissionTaskId = getTaskNameBySubmissionTaskId(data);

  data.submissions.submissions.forEach((submission) => {
    const taskName = taskNameBySubmissionTaskId.get(submission.task_id) ?? submission.task_id;
    const key = pairKey(submission.user, taskName);
    submissionsByPair.set(key, [...(submissionsByPair.get(key) ?? []), submission]);
  });

  return submissionsByPair;
};

const getFirstCorrectSubmissionTimestamp = (
  submissions: SubmissionRow[],
): number | null => {
  const correctSubmissionTimestamps = submissions
    .filter((submission) => submission.status === 1)
    .map((submission) => submission.timestamp);

  return correctSubmissionTimestamps.length
    ? Math.min(...correctSubmissionTimestamps)
    : null;
};

const getEndTimestamp = (
  task: TaskRow,
  submissions: SubmissionRow[],
): {timestamp: number | null; endsWithCorrectAnswer: boolean} => {
  const firstCorrectSubmissionTimestamp = getFirstCorrectSubmissionTimestamp(submissions);

  if (task.finished_after_correct_answer && firstCorrectSubmissionTimestamp !== null) {
    return {
      timestamp: firstCorrectSubmissionTimestamp,
      endsWithCorrectAnswer: true,
    };
  }

  return {
    timestamp: task.ended,
    endsWithCorrectAnswer: false,
  };
};

const isWithinTaskWindow = (
  timestamp: number,
  task: TaskRow,
  endTimestamp: number | null,
): boolean => {
  return (task.started === null || timestamp >= task.started)
    && (endTimestamp === null || timestamp <= endTimestamp);
};

const getTimelineEvents = (
  interactionGroup: InteractionTaskUser,
  tasksByName: Map<string, TaskRow>,
  submissionsByPair: Map<string, SubmissionRow[]>,
): {events: TimelineEvent[]; task: TaskRow | null} => {
  const task = tasksByName.get(interactionGroup.task) ?? null;

  if (!task) {
    return {
      events: [],
      task: null,
    };
  }

  const submissions = submissionsByPair.get(pairKey(interactionGroup.user, interactionGroup.task)) ?? [];
  const {timestamp: endTimestamp, endsWithCorrectAnswer} = getEndTimestamp(task, submissions);
  const hasSelectionFilter = interactionGroup.interactions.some((interaction) => interaction.selected === false)
    || submissions.some((submission) => submission.selected === false);

  let order = 0;

  const events: TimelineEvent[] = [
    ...interactionGroup.interactions
      .filter((interaction) =>
        interaction.task_is_active
        && interaction.selected !== false
        && isWithinTaskWindow(interaction.timestamp, task, endTimestamp),
      )
      .map((interaction) => ({
        timestamp: interaction.timestamp,
        abstractType: interaction.abstract_type,
        rank: 1,
        order: order++,
      })),

    ...submissions
      .filter((submission) =>
        submission.selected !== false && isWithinTaskWindow(submission.timestamp, task, endTimestamp),
      )
      .map((submission) => ({
        timestamp: submission.timestamp,
        abstractType: ANSWERS_ACTION,
        rank: 2,
        order: order++,
      })),
  ];

  if (
    !hasSelectionFilter
    && endTimestamp !== null
    && !endsWithCorrectAnswer
    && isWithinTaskWindow(endTimestamp, task, endTimestamp)
  ) {
    events.push({
      timestamp: endTimestamp,
      abstractType: TASK_END_ACTION,
      rank: 3,
      order: order++,
    });
  }

  events.sort((first, second) =>
    first.timestamp - second.timestamp
    || first.rank - second.rank
    || first.order - second.order,
  );

  return {
    events,
    task,
  };
};

const sumDurationByAction = (
  interactionGroups: InteractionTaskUser[],
  data: FetchInteractionDataResponse,
): Map<string, number> => {
  const durations = new Map<string, number>();
  const tasksByName = getTaskByName(data);
  const submissionsByPair = getSubmissionsByPair(data);

  interactionGroups.forEach((interactionGroup) => {
    const {events, task} = getTimelineEvents(interactionGroup, tasksByName, submissionsByPair);

    if (!events.length || !task) {
      return;
    }

    const submissions = submissionsByPair.get(pairKey(interactionGroup.user, interactionGroup.task)) ?? [];
    const hasSelectionFilter = interactionGroup.interactions.some((interaction) => interaction.selected === false)
      || submissions.some((submission) => submission.selected === false);

    if (!hasSelectionFilter && task.started !== null) {
      addDuration(durations, events[0].abstractType, events[0].timestamp - task.started);
    }

    events.slice(1).forEach((event, index) => {
      addDuration(durations, event.abstractType, event.timestamp - events[index].timestamp);
    });
  });

  return durations;
};

const getOrderedAbstractTypes = (data: FetchInteractionDataResponse | null): string[] => {
  if (!data) {
    return [];
  }

  return Array.from(sumDurationByAction(data.interactions, data).entries())
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .map(([abstractType]) => abstractType);
};

const toChartValues = (
  durations: Map<string, number>,
  orderedAbstractTypes: string[],
): ChartDatum[] => {
  return orderedAbstractTypes.map((abstractType) => ({
    abstractType,
    durationSeconds: durations.get(abstractType) ?? 0,
  }));
};

const buildPanels = (
  data: FetchInteractionDataResponse | null,
  groupMode: GroupMode,
  orderedAbstractTypes: string[],
): ChartPanel[] => {
  if (!data || !orderedAbstractTypes.length) {
    return [];
  }

  if (groupMode === "pair") {
    return data.interactions.map((interactionGroup) => ({
      id: pairKey(interactionGroup.user, interactionGroup.task),
      title: "",
      rowKey: interactionGroup.user,
      columnKey: interactionGroup.task,
      values: toChartValues(sumDurationByAction([interactionGroup], data), orderedAbstractTypes),
    }));
  }

  if (groupMode === "all") {
    return [{
      id: "all",
      title: "All data",
      values: toChartValues(sumDurationByAction(data.interactions, data), orderedAbstractTypes),
    }];
  }

  const groupedInteractions = new Map<string, InteractionTaskUser[]>();
  const tasksByName = new Map(data.tasks.tasks.map((task) => [task.name, task]));

  data.interactions.forEach((interactionGroup) => {
    const user = data.users.users.find((candidate) => candidate.user === interactionGroup.user);
    const task = tasksByName.get(interactionGroup.task);
    const key = groupMode === "user"
      ? interactionGroup.user
      : groupMode === "task"
        ? interactionGroup.task
        : groupMode === "taskGroup"
          ? task?.taskGroup ?? "Unknown task category"
          : user?.system ?? "Unknown system";

    groupedInteractions.set(key, [...(groupedInteractions.get(key) ?? []), interactionGroup]);
  });

  return Array.from(groupedInteractions.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, interactionGroups]) => ({
      id: key,
      title: key,
      values: toChartValues(sumDurationByAction(interactionGroups, data), orderedAbstractTypes),
    }));
};

const getPanelMaxDuration = (panels: ChartPanel[]): number => {
  return max(panels.flatMap((panel) => panel.values.map((value) => value.durationSeconds))) ?? 0;
};

const panelHasData = (panel: ChartPanel): boolean => {
  return panel.values.some((value) => value.durationSeconds > 0);
};

const BarplotPanel: React.FC<{
  panel: ChartPanel;
  orderedAbstractTypes: string[];
  maxDurationSeconds: number;
}> = ({panel, orderedAbstractTypes, maxDurationSeconds}) => {
  const labelClipId = useId();
  const innerWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const innerHeight = Math.max(24, orderedAbstractTypes.length * CHART_ROW_HEIGHT);
  const chartHeight = innerHeight + CHART_MARGIN.top + CHART_MARGIN.bottom;
  const labelX = -CHART_MARGIN.left + LABEL_PADDING_LEFT;
  const labelClipWidth = CHART_MARGIN.left - LABEL_PADDING_LEFT - LABEL_GAP;
  const xScale = scaleLinear()
    .domain([0, Math.max(1, maxDurationSeconds)])
    .range([0, innerWidth])
    .nice();
  const yScale = scaleBand<string>()
    .domain(orderedAbstractTypes)
    .range([0, innerHeight])
    .paddingInner(0.22)
    .paddingOuter(0.12);
  const colorScale = scaleOrdinal<string, string>()
    .domain(orderedAbstractTypes)
    .range(schemeTableau10);
  const ticks = xScale.ticks(4);
  const hasData = panel.values.some((value) => value.durationSeconds > 0);

  return (
    <div className="task-barchart-panel">
      {panel.title && <h3>{panel.title}</h3>}
      {hasData ? (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
          role="img"
          aria-label={panel.title || "User task duration barplot"}
        >
          <defs>
            <clipPath id={labelClipId}>
              <rect
                x={labelX}
                y={0}
                width={labelClipWidth}
                height={innerHeight}
              />
            </clipPath>
          </defs>
          <g transform={`translate(${CHART_MARGIN.left} ${CHART_MARGIN.top})`}>
            {ticks.map((tick) => (
              <g key={tick} transform={`translate(${xScale(tick)} 0)`}>
                <line className="task-barchart-gridline" y2={innerHeight} />
                <text className="task-barchart-axis-text" y={innerHeight + 14} textAnchor="middle">
                  {formatSeconds(tick)}
                </text>
              </g>
            ))}
            {panel.values.map((value) => {
              const y = yScale(value.abstractType) ?? 0;
              const barHeight = yScale.bandwidth();

              return (
                <g key={value.abstractType}>
                  <text
                    className="task-barchart-label"
                    x={labelX}
                    y={y + barHeight / 2 + 3}
                    clipPath={`url(#${labelClipId})`}
                  >
                    <title>{value.abstractType}</title>
                    {value.abstractType}
                  </text>
                  <rect
                    className="task-barchart-bar"
                    x={0}
                    y={y}
                    width={xScale(value.durationSeconds)}
                    height={barHeight}
                    fill={colorScale(value.abstractType)}
                  />
                  {value.durationSeconds > 0 && (
                    <text
                      className="task-barchart-value"
                      x={xScale(value.durationSeconds) + 4}
                      y={y + barHeight / 2 + 3}
                    >
                      {formatSeconds(value.durationSeconds)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      ) : (
        <div className="task-barchart-empty">No data</div>
      )}
    </div>
  );
};

const DurationBarchartView: React.FC<DurationBarchartViewProps> = ({
  data,
  dataSelector,
  onOpenDataManipulator,
  snapshotActions,
}) => {
  const [groupMode, setGroupMode] = useState<GroupMode>("pair");
  const orderedAbstractTypes = useMemo(() => getOrderedAbstractTypes(data), [data]);
  const panels = useMemo(
    () => buildPanels(data, groupMode, orderedAbstractTypes),
    [data, groupMode, orderedAbstractTypes],
  );
  const visiblePanels = useMemo(
    () => panels.filter(panelHasData),
    [panels],
  );
  const maxDurationSeconds = useMemo(() => getPanelMaxDuration(visiblePanels), [visiblePanels]);
  const totalDurationSeconds = useMemo(() => {
    if (!data) {
      return 0;
    }

    return Array.from(sumDurationByAction(data.interactions, data).values())
      .reduce((sum, duration) => sum + duration, 0);
  }, [data]);
  const users = useMemo(() => {
    if (!data) {
      return [];
    }

    return Array.from(new Set([
      ...data.users.users.map((user) => user.user),
      ...data.interactions.map((interactionGroup) => interactionGroup.user),
    ]));
  }, [data]);
  const tasks = useMemo(() => {
    if (!data) {
      return [];
    }

    return Array.from(new Set([
      ...data.tasks.tasks.map((task) => task.name),
      ...data.interactions.map((interactionGroup) => interactionGroup.task),
    ]));
  }, [data]);
  const selectedPairCount = data?.interactions.length ?? 0;
  const panelsByCell = new Map(
    panels.map((panel) => [pairKey(panel.rowKey ?? "", panel.columnKey ?? ""), panel]),
  );
  const visibleUsers = useMemo(() => {
    if (groupMode !== "pair") {
      return users;
    }

    return users.filter((user) =>
      panels.some((panel) => panel.rowKey === user && panelHasData(panel)),
    );
  }, [groupMode, panels, users]);
  const visibleTasks = useMemo(() => {
    if (groupMode !== "pair") {
      return tasks;
    }

    return tasks.filter((task) =>
      panels.some((panel) => panel.columnKey === task && panelHasData(panel)),
    );
  }, [groupMode, panels, tasks]);

  return (
    <div className="task-barchart">
      <div className="task-barchart-header">
        <h1>Duration Barchart</h1>
        <div className="task-barchart-actions">
          <Button type="primary" onClick={onOpenDataManipulator}>
            Data
          </Button>
          {snapshotActions}
        </div>
      </div>

      {dataSelector}

      <section className="task-barchart-options">
        <Segmented<GroupMode>
          options={groupOptions}
          value={groupMode}
          onChange={setGroupMode}
        />
        <div className="task-barchart-summary">
          {selectedPairCount} user-task pairs, {formatSeconds(totalDurationSeconds)} measured
        </div>
      </section>

      {!data ? (
        <div className="task-barchart-empty task-barchart-empty-state">No data</div>
      ) : !visiblePanels.length ? (
        <div className="task-barchart-empty task-barchart-empty-state">No data</div>
      ) : groupMode === "pair" ? (
        <div className="task-barchart-matrix-wrap">
          <table className="task-barchart-matrix">
            <thead>
              <tr>
                <th>User</th>
                {visibleTasks.map((task) => (
                  <th key={task}>{task}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user}>
                  <th>{user}</th>
                  {visibleTasks.map((task) => {
                    const panel = panelsByCell.get(pairKey(user, task));

                    return (
                      <td key={pairKey(user, task)}>
                        {panel ? (
                          <BarplotPanel
                            panel={panel}
                            orderedAbstractTypes={orderedAbstractTypes}
                            maxDurationSeconds={maxDurationSeconds}
                          />
                        ) : (
                          <div className="task-barchart-empty">No data</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={[
          "task-barchart-panel-grid",
          groupMode === "all" ? "is-single" : "",
        ].join(" ")}>
          {visiblePanels.map((panel) => (
            <BarplotPanel
              key={panel.id}
              panel={panel}
              orderedAbstractTypes={orderedAbstractTypes}
              maxDurationSeconds={maxDurationSeconds}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DurationBarchartView;
