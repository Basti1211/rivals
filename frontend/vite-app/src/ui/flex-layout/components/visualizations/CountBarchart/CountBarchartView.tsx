import {useId, useMemo, useState} from "react";
import type React from "react";
import {Button, Segmented} from "antd";
import {max, scaleBand, scaleLinear, scaleOrdinal, schemeTableau10} from "d3";
import type {FetchInteractionDataResponse, InteractionTaskUser} from "../../../../../types/dataTypes";

type GroupMode = "pair" | "user" | "system" | "task" | "taskGroup" | "all";

type CountBarchartViewProps = {
  data: FetchInteractionDataResponse | null;
  dataSelector?: React.ReactNode;
  onOpenDataManipulator?: () => void;
  informationAction?: React.ReactNode;
  snapshotActions?: React.ReactNode;
};

type ChartDatum = {
  abstractType: string;
  count: number;
};

type ChartPanel = {
  id: string;
  title: string;
  rowKey?: string;
  columnKey?: string;
  values: ChartDatum[];
};

const CHART_WIDTH = 260;
const CHART_ROW_HEIGHT = 18;
const CHART_MARGIN = {
  top: 10,
  right: 12,
  bottom: 24,
  left: 92,
};
const LABEL_PADDING_LEFT = 4;
const LABEL_GAP = 8;

const groupOptions: Array<{label: string; value: GroupMode}> = [
  {label: "User x Task", value: "pair"},
  {label: "User", value: "user"},
  {label: "System", value: "system"},
  {label: "Task", value: "task"},
  {label: "Task Category", value: "taskGroup"},
  {label: "All", value: "all"},
];

const countActiveAbstractTypes = (
  interactionGroups: InteractionTaskUser[],
): Map<string, number> => {
  const counts = new Map<string, number>();

  interactionGroups.forEach((interactionGroup) => {
    interactionGroup.interactions.forEach((interaction) => {
      if (!interaction.task_is_active || interaction.cancelled || interaction.selected === false) {
        return;
      }

      counts.set(interaction.abstract_type, (counts.get(interaction.abstract_type) ?? 0) + 1);
    });
  });

  return counts;
};

const getOrderedAbstractTypes = (data: FetchInteractionDataResponse | null): string[] => {
  if (!data) {
    return [];
  }

  return Array.from(countActiveAbstractTypes(data.interactions).entries())
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .map(([abstractType]) => abstractType);
};

const toChartValues = (
  counts: Map<string, number>,
  orderedAbstractTypes: string[],
): ChartDatum[] => {
  return orderedAbstractTypes.map((abstractType) => ({
    abstractType,
    count: counts.get(abstractType) ?? 0,
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
      id: `${interactionGroup.user}-${interactionGroup.task}`,
      title: "",
      rowKey: interactionGroup.user,
      columnKey: interactionGroup.task,
      values: toChartValues(countActiveAbstractTypes([interactionGroup]), orderedAbstractTypes),
    }));
  }

  if (groupMode === "all") {
    return [{
      id: "all",
      title: "All data",
      values: toChartValues(countActiveAbstractTypes(data.interactions), orderedAbstractTypes),
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
      values: toChartValues(countActiveAbstractTypes(interactionGroups), orderedAbstractTypes),
    }));
};

const getPanelMaxCount = (panels: ChartPanel[]): number => {
  return max(panels.flatMap((panel) => panel.values.map((value) => value.count))) ?? 0;
};

const panelHasData = (panel: ChartPanel): boolean => {
  return panel.values.some((value) => value.count > 0);
};

const BarplotPanel: React.FC<{
  panel: ChartPanel;
  orderedAbstractTypes: string[];
  maxCount: number;
}> = ({panel, orderedAbstractTypes, maxCount}) => {
  const labelClipId = useId();
  const innerWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const innerHeight = Math.max(24, orderedAbstractTypes.length * CHART_ROW_HEIGHT);
  const chartHeight = innerHeight + CHART_MARGIN.top + CHART_MARGIN.bottom;
  const labelX = -CHART_MARGIN.left + LABEL_PADDING_LEFT;
  const labelClipWidth = CHART_MARGIN.left - LABEL_PADDING_LEFT - LABEL_GAP;
  const xScale = scaleLinear()
    .domain([0, Math.max(1, maxCount)])
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
  const hasData = panel.values.some((value) => value.count > 0);

  return (
    <div className="task-barchart-panel">
      {panel.title && <h3>{panel.title}</h3>}
      {hasData ? (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
          role="img"
          aria-label={panel.title || "User task barplot"}
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
                  {tick}
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
                    width={xScale(value.count)}
                    height={barHeight}
                    fill={colorScale(value.abstractType)}
                  />
                  {value.count > 0 && (
                    <text
                      className="task-barchart-value"
                      x={xScale(value.count) + 4}
                      y={y + barHeight / 2 + 3}
                    >
                      {value.count}
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

const CountBarchartView: React.FC<CountBarchartViewProps> = ({
  data,
  dataSelector,
  onOpenDataManipulator,
  informationAction,
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
  const maxCount = useMemo(() => getPanelMaxCount(visiblePanels), [visiblePanels]);
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
  const activeInteractionCount = data?.interactions.reduce(
    (sum, interactionTaskUser) =>
      sum + interactionTaskUser.interactions.filter((interaction) =>
        interaction.task_is_active && !interaction.cancelled && interaction.selected !== false,
      ).length,
    0,
  ) ?? 0;
  const panelsByCell = new Map(
    panels.map((panel) => [`${panel.rowKey}-${panel.columnKey}`, panel]),
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
        <h1>Count Barchart</h1>
        <div className="task-barchart-actions">
          {informationAction}
          {onOpenDataManipulator && (
            <Button type="primary" onClick={onOpenDataManipulator}>
              Data
            </Button>
          )}
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
          {selectedPairCount} user-task pairs, {activeInteractionCount} active interactions
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
                    const panel = panelsByCell.get(`${user}-${task}`);

                    return (
                      <td key={`${user}-${task}`}>
                        {panel ? (
                          <BarplotPanel
                            panel={panel}
                            orderedAbstractTypes={orderedAbstractTypes}
                            maxCount={maxCount}
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
              maxCount={maxCount}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CountBarchartView;
