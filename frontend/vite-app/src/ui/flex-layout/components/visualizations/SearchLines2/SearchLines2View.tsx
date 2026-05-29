import {useEffect, useMemo, useState} from "react";
import type React from "react";
import {Button, Dropdown, Select, Switch} from "antd";
import type {MenuProps} from "antd";
import type {
  FetchInteractionDataResponse,
  FetchInteractionLogRow,
  InteractionHierarchyNode,
  InteractionTaskUser,
  SubmissionRow,
  TaskRow,
  UserRow,
} from "../../../../../types/dataTypes";
import {useLayout} from "../../../flex-layout-context/LayoutManagerContext";
import SearchLines2ZoomPanel from "./SearchLines2ZoomPanel";

export type RankField = "frameRank" | "videoRank";
type ColumnMode = "task" | "user" | "taskGroup";
type SelectionSnapshotTarget = "countBarchart" | "durationBarchart";

type SearchLines2ViewProps = {
  data: FetchInteractionDataResponse | null;
  dataSelector?: React.ReactNode;
  onOpenDataManipulator: () => void;
  informationAction?: React.ReactNode;
  snapshotActions?: React.ReactNode;
};

type SearchLines2Model = {
  users: string[];
  tasks: string[];
  taskGroups: string[];
  tasksByName: Map<string, TaskRow>;
  panelsByCell: Map<string, InteractionTaskUser>;
  submissionsByCell: Map<string, SubmissionRow[]>;
};

type TimelineBounds = {
  start: number;
  scaleEnd: number;
  lineEnd: number;
};

export type TimelineBandData = {
  id: string;
  label: string;
  detail: string;
  user: string;
  taskName: string;
  interactions: FetchInteractionLogRow[];
  submissions: SubmissionRow[];
  task: TaskRow | undefined;
};

type TimelineColumn = {
  id: string;
  label: string;
  subtitle: string;
  bands: TimelineBandData[];
};

type TimeRangeSelection = {
  id: string;
  bandId: string;
  user: string;
  taskName: string;
  start: number;
  end: number;
};

type ActiveTimeRangeDrag = {
  startX: number;
  currentX: number;
  startY: number;
  currentY: number;
};

type MutableHierarchyNode = {
  name: string;
  children: MutableHierarchyNode[];
};

export type OverlayOption = {
  id: string;
  name: string;
  depth: number;
  groupId: string;
  path: string[];
  color: string;
  descendantNames: string[];
  leafNames: string[];
};

type OverlayGroup = {
  id: string;
  name: string;
  color: string;
  options: OverlayOption[];
};

export type OverlaySelection = {
  optionId: string;
  useLeafSymbols: boolean;
};

export type MarkerConfig = {
  optionId: string;
  symbolMode: "one" | "leaves";
  symbolType: string;
  color: string;
  shape: MarkerShape;
  tooltip: string;
};

export type MarkerShape = "circle" | "triangle" | "diamond" | "square" | "cross" | "plus" | "invertedTriangle";

const CHART_WIDTH = 380;
const CHART_MARGIN_X = 18;
const BAND_LABEL_WIDTH = 82;
const BAND_HEIGHT = 18;
const BAND_GAP = 4;
const COLUMN_HEADER_HEIGHT = 18;
const COLUMN_FOOTER_HEIGHT = 12;
const RANK_MAX = 1000;
const RANK_BACKGROUND_COLOR = "rgb(22, 163, 74)";
const SUBMISSION_CORRECT_COLOR = "#16a34a";
const SUBMISSION_UNEVALUATED_COLOR = "#9ca3af";
const SUBMISSION_WRONG_COLOR = "#dc2626";
const MISSING_GROUP_LABEL = "No task group";
const MIN_MAIN_SELECTION_WIDTH = 10;
const OVERLAY_COLORS = [
  "#377eb8",
  "#ff7f00",
  "#984ea3",
  "#e41a1c",
  "#a65628",
  "#f781bf",
  "#999999",
  "#ffff33",
  "#6a3d9a",
  "#b15928",
];
const MARKER_SHAPES: MarkerShape[] = [
  "circle",
  "triangle",
  "diamond",
  "square",
  "cross",
  "plus",
  "invertedTriangle",
];

const cellKey = (user: string, task: string): string => JSON.stringify([user, task]);

const createSelectionId = (bandId: string, start: number, end: number): string => (
  `${bandId}:${start}:${end}:${Date.now()}:${Math.random().toString(36).slice(2)}`
);

const getRankValue = (
  interaction: FetchInteractionLogRow | null,
  rankField: RankField,
): number | null => {
  return interaction?.[rankField] ?? null;
};

const getRankOpacity = (rank: number | null): number => {
  if (rank === null) {
    return 0;
  }

  const normalizedRank = Math.log1p(Math.min(Math.max(rank, 0), RANK_MAX)) / Math.log1p(RANK_MAX);

  return Math.max(0, 1 - normalizedRank);
};

const formatRank = (rank: number | null): string => {
  return rank === null ? "null" : String(rank);
};

const formatMetadata = (metadata: unknown): string => {
  if (metadata === null || metadata === undefined) {
    return "null";
  }

  if (typeof metadata === "string") {
    return metadata;
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return String(metadata);
  }
};

const elapsedSecondsFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const formatElapsedSeconds = (timestamp: number, taskStartTimestamp: number): string => {
  const elapsedSeconds = Math.max(0, timestamp - taskStartTimestamp) / 1000;

  return `${elapsedSecondsFormatter.format(elapsedSeconds)}s`;
};

const getSegmentTooltip = (
  sourceInteraction: FetchInteractionLogRow | null,
  startTimestamp: number,
  taskStartTimestamp: number,
): string => {
  if (!sourceInteraction) {
    return [
      "Action: Task Start",
      `Time: ${formatElapsedSeconds(startTimestamp, taskStartTimestamp)}`,
      "Metadata: null",
      "Frame rank: null",
      "Video rank: null",
    ].join("\n");
  }

  return [
    `Action: ${sourceInteraction.action}`,
    `Time: ${formatElapsedSeconds(startTimestamp, taskStartTimestamp)}`,
    `Metadata: ${formatMetadata(sourceInteraction.metadata)}`,
    `Frame rank: ${formatRank(sourceInteraction.frameRank ?? null)}`,
    `Video rank: ${formatRank(sourceInteraction.videoRank ?? null)}`,
  ].join("\n");
};

const getMarkerTooltip = (
  interaction: FetchInteractionLogRow,
  taskStartTimestamp: number,
  selectedType: string,
  symbolType: string,
): string => {
  return [
    `Selected type: ${selectedType}`,
    `Symbol type: ${symbolType}`,
    `Action: ${interaction.action}`,
    `Abstract type: ${interaction.abstract_type}`,
    `Time: ${formatElapsedSeconds(interaction.timestamp, taskStartTimestamp)}`,
    `Metadata: ${formatMetadata(interaction.metadata)}`,
    `Frame rank: ${formatRank(interaction.frameRank ?? null)}`,
    `Video rank: ${formatRank(interaction.videoRank ?? null)}`,
  ].join("\n");
};

const getSubmissionStatusLabel = (status: SubmissionRow["status"]): string => {
  if (status === 1) {
    return "Correct";
  }

  if (status === -1) {
    return "Wrong";
  }

  return "Not evaluated";
};

const getSubmissionColor = (status: SubmissionRow["status"]): string => {
  if (status === 1) {
    return SUBMISSION_CORRECT_COLOR;
  }

  if (status === -1) {
    return SUBMISSION_WRONG_COLOR;
  }

  return SUBMISSION_UNEVALUATED_COLOR;
};

const getSubmissionTooltip = (
  submission: SubmissionRow,
  taskStartTimestamp: number,
): string => {
  return [
    "Submission",
    `Status: ${getSubmissionStatusLabel(submission.status)}`,
    `Time: ${formatElapsedSeconds(submission.timestamp, taskStartTimestamp)}`,
    `Answer text: ${submission.answer_text ?? "null"}`,
    `Answer video: ${submission.answer_video ?? "null"}`,
  ].join("\n");
};

const mergeHierarchyNodes = (
  targetNodes: MutableHierarchyNode[],
  sourceNodes: InteractionHierarchyNode[],
): void => {
  sourceNodes.forEach((sourceNode) => {
    let targetNode = targetNodes.find((candidate) => candidate.name === sourceNode.Name);

    if (!targetNode) {
      targetNode = {
        name: sourceNode.Name,
        children: [],
      };
      targetNodes.push(targetNode);
    }

    mergeHierarchyNodes(targetNode.children, sourceNode.Children ?? []);
  });
};

const getDescendantNames = (node: MutableHierarchyNode): string[] => {
  return [
    node.name,
    ...node.children.flatMap(getDescendantNames),
  ];
};

const getLeafNames = (node: MutableHierarchyNode): string[] => {
  if (!node.children.length) {
    return [node.name];
  }

  return node.children.flatMap(getLeafNames);
};

const getOptionsByDepth = (
  rootNode: MutableHierarchyNode,
  groupId: string,
  color: string,
): OverlayOption[] => {
  const optionsByDepth = new Map<number, OverlayOption[]>();

  const visit = (node: MutableHierarchyNode, path: string[], depth: number): void => {
    const nextPath = [...path, node.name];
    const option: OverlayOption = {
      id: JSON.stringify(nextPath),
      name: node.name,
      depth,
      groupId,
      path: nextPath,
      color,
      descendantNames: getDescendantNames(node),
      leafNames: getLeafNames(node),
    };

    optionsByDepth.set(depth, [...(optionsByDepth.get(depth) ?? []), option]);
    node.children.forEach((child) => visit(child, nextPath, depth + 1));
  };

  visit(rootNode, [], 1);

  return Array.from(optionsByDepth.entries())
    .sort(([firstDepth], [secondDepth]) => firstDepth - secondDepth)
    .flatMap(([, options]) => options);
};

const buildOverlayGroups = (data: FetchInteractionDataResponse | null): OverlayGroup[] => {
  if (!data) {
    return [];
  }

  const displayedUsers = new Set(data.interactions.map((interactionGroup) => interactionGroup.user));
  const mergedRoots: MutableHierarchyNode[] = [];

  data.users.users
    .filter((user) => displayedUsers.has(user.user))
    .forEach((user) => mergeHierarchyNodes(mergedRoots, user.hierarchy));

  return mergedRoots.map((rootNode, index) => {
    const color = OVERLAY_COLORS[index % OVERLAY_COLORS.length];
    const id = JSON.stringify([rootNode.name]);

    return {
      id,
      name: rootNode.name,
      color,
      options: getOptionsByDepth(rootNode, id, color),
    };
  });
};

const getOverlayOptionById = (overlayGroups: OverlayGroup[]): Map<string, OverlayOption> => {
  return new Map(
    overlayGroups.flatMap((group) =>
      group.options.map((option) => [option.id, option] as const),
    ),
  );
};

const getShapeByIndex = (index: number): MarkerShape => {
  return MARKER_SHAPES[index % MARKER_SHAPES.length];
};

const getLeafSymbolName = (
  interaction: FetchInteractionLogRow,
  option: OverlayOption,
): string => {
  if (option.leafNames.includes(interaction.action)) {
    return interaction.action;
  }

  if (option.leafNames.includes(interaction.abstract_type)) {
    return interaction.abstract_type;
  }

  return option.name;
};

const isSameHierarchyBranch = (
  firstOption: OverlayOption,
  secondOption: OverlayOption,
): boolean => {
  if (firstOption.groupId !== secondOption.groupId) {
    return false;
  }

  const shorterPathLength = Math.min(firstOption.path.length, secondOption.path.length);

  return firstOption.path
    .slice(0, shorterPathLength)
    .every((pathPart, index) => pathPart === secondOption.path[index]);
};

const getMarkerConfigs = (
  interaction: FetchInteractionLogRow,
  overlaySelections: OverlaySelection[],
  overlayOptionById: Map<string, OverlayOption>,
  includeDescendants: boolean,
  taskStartTimestamp: number,
): MarkerConfig[] => {
  return overlaySelections.flatMap((selection, selectionIndex) => {
    const option = overlayOptionById.get(selection.optionId);

    if (!option) {
      return [];
    }

    const isMatch = interactionMatchesOverlayOption(interaction, option, includeDescendants);

    if (!isMatch) {
      return [];
    }

    const leafSymbolName = getLeafSymbolName(interaction, option);
    const leafSymbolIndex = Math.max(0, option.leafNames.indexOf(leafSymbolName));
    const shape = selection.useLeafSymbols
      ? getShapeByIndex(leafSymbolIndex)
      : getShapeByIndex(selectionIndex);

    return [{
      optionId: option.id,
      symbolMode: selection.useLeafSymbols ? "leaves" : "one",
      symbolType: selection.useLeafSymbols ? leafSymbolName : option.name,
      color: option.color,
      shape,
      tooltip: getMarkerTooltip(
        interaction,
        taskStartTimestamp,
        option.name,
        selection.useLeafSymbols ? leafSymbolName : option.name,
      ),
    }];
  });
};

const interactionMatchesOverlayOption = (
  interaction: FetchInteractionLogRow,
  option: OverlayOption,
  includeDescendants: boolean,
): boolean => {
  return includeDescendants
    ? option.descendantNames.includes(interaction.action)
      || option.descendantNames.includes(interaction.abstract_type)
    : interaction.abstract_type === option.name;
};

const MarkerSymbol: React.FC<{
  config: MarkerConfig;
  x: number;
  y: number;
}> = ({config, x, y}) => {
  const size = 4.2;
  const commonProps = {
    className: "search-lines-2-marker",
    fill: config.color,
    stroke: "#ffffff",
    strokeWidth: 0.9,
  };

  return (
    <g transform={`translate(${x} ${y})`}>
      <title>{config.tooltip}</title>
      {config.shape === "circle" && (
        <circle {...commonProps} r={size} />
      )}
      {config.shape === "triangle" && (
        <path {...commonProps} d={`M0 ${-size} L${size} ${size} L${-size} ${size} Z`} />
      )}
      {config.shape === "invertedTriangle" && (
        <path {...commonProps} d={`M${-size} ${-size} L${size} ${-size} L0 ${size} Z`} />
      )}
      {config.shape === "diamond" && (
        <path {...commonProps} d={`M0 ${-size} L${size} 0 L0 ${size} L${-size} 0 Z`} />
      )}
      {config.shape === "square" && (
        <rect {...commonProps} x={-size} y={-size} width={size * 2} height={size * 2} />
      )}
      {config.shape === "cross" && (
        <path
          {...commonProps}
          d={`M${-size} ${-size / 2} L${-size / 2} ${-size} L0 ${-size / 2} L${size / 2} ${-size} L${size} ${-size / 2} L${size / 2} 0 L${size} ${size / 2} L${size / 2} ${size} L0 ${size / 2} L${-size / 2} ${size} L${-size} ${size / 2} L${-size / 2} 0 Z`}
        />
      )}
      {config.shape === "plus" && (
        <path
          {...commonProps}
          d={`M${-size} ${-size / 3} L${-size / 3} ${-size / 3} L${-size / 3} ${-size} L${size / 3} ${-size} L${size / 3} ${-size / 3} L${size} ${-size / 3} L${size} ${size / 3} L${size / 3} ${size / 3} L${size / 3} ${size} L${-size / 3} ${size} L${-size / 3} ${size / 3} L${-size} ${size / 3} Z`}
        />
      )}
    </g>
  );
};

const SubmissionStar: React.FC<{
  submission: SubmissionRow;
  taskStartTimestamp: number;
  x: number;
  y: number;
}> = ({submission, taskStartTimestamp, x, y}) => {
  const size = 4;

  return (
    <g
      className="search-lines-2-submission-star"
      transform={`translate(${x} ${y}) scale(${size})`}
    >
      <title>{getSubmissionTooltip(submission, taskStartTimestamp)}</title>
      <path
        d="M0 -1 L0.225 -0.309 L0.951 -0.309 L0.363 0.118 L0.588 0.809 L0 0.382 L-0.588 0.809 L-0.363 0.118 L-0.951 -0.309 L-0.225 -0.309 Z"
        fill={getSubmissionColor(submission.status)}
      />
    </g>
  );
};

const getVisibleSubmissions = (
  submissions: SubmissionRow[],
  start: number,
  end: number,
): SubmissionRow[] => (
  [...submissions]
    .sort((first, second) => first.timestamp - second.timestamp)
    .filter((submission) =>
      submission.timestamp >= start
      && submission.timestamp <= end,
    )
);

const ShapeIcon: React.FC<{
  shape: MarkerShape;
  color: string;
  title: string;
  className?: string;
}> = ({shape, color, title, className = "search-lines-2-symbol-key-icon"}) => {
  const size = 4.2;
  const commonProps = {
    fill: color,
    stroke: "#ffffff",
    strokeWidth: 0.9,
  };

  return (
    <svg
      className={className}
      viewBox="-6 -6 12 12"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {shape === "circle" && (
        <circle {...commonProps} r={size} />
      )}
      {shape === "triangle" && (
        <path {...commonProps} d={`M0 ${-size} L${size} ${size} L${-size} ${size} Z`} />
      )}
      {shape === "invertedTriangle" && (
        <path {...commonProps} d={`M${-size} ${-size} L${size} ${-size} L0 ${size} Z`} />
      )}
      {shape === "diamond" && (
        <path {...commonProps} d={`M0 ${-size} L${size} 0 L0 ${size} L${-size} 0 Z`} />
      )}
      {shape === "square" && (
        <rect {...commonProps} x={-size} y={-size} width={size * 2} height={size * 2} />
      )}
      {shape === "cross" && (
        <path
          {...commonProps}
          d={`M${-size} ${-size / 2} L${-size / 2} ${-size} L0 ${-size / 2} L${size / 2} ${-size} L${size} ${-size / 2} L${size / 2} 0 L${size} ${size / 2} L${size / 2} ${size} L0 ${size / 2} L${-size / 2} ${size} L${-size} ${size / 2} L${-size / 2} 0 Z`}
        />
      )}
      {shape === "plus" && (
        <path
          {...commonProps}
          d={`M${-size} ${-size / 3} L${-size / 3} ${-size / 3} L${-size / 3} ${-size} L${size / 3} ${-size} L${size / 3} ${-size / 3} L${size} ${-size / 3} L${size} ${size / 3} L${size / 3} ${size / 3} L${size / 3} ${size} L${-size / 3} ${size} L${-size / 3} ${size / 3} L${-size} ${size / 3} Z`}
        />
      )}
    </svg>
  );
};

const SelectionSymbolIcon: React.FC<{
  selection: OverlaySelection;
  option: OverlayOption;
  selectionIndex: number;
}> = ({selection, option, selectionIndex}) => {
  if (selection.useLeafSymbols) {
    const previewLeafNames = option.leafNames.slice(0, 3);

    return (
      <span
        className="search-lines-2-overlay-symbol-cluster"
        aria-label={`${option.name} leaf symbols`}
        title={`${option.name} leaf symbols`}
      >
        {previewLeafNames.map((leafName, leafIndex) => (
          <ShapeIcon
            key={`${option.id}-${leafName}`}
            shape={getShapeByIndex(leafIndex)}
            color={option.color}
            title={`${leafName} symbol`}
            className="search-lines-2-overlay-symbol-icon"
          />
        ))}
      </span>
    );
  }

  return (
    <ShapeIcon
      shape={getShapeByIndex(selectionIndex)}
      color={option.color}
      title={`${option.name} symbol`}
      className="search-lines-2-overlay-symbol-icon"
    />
  );
};

const SymbolKey: React.FC<{
  option: OverlayOption;
}> = ({option}) => {
  const items = option.leafNames.map((leafName, leafIndex) => ({
    name: leafName,
    shape: getShapeByIndex(leafIndex),
  }));

  return (
    <div className="search-lines-2-symbol-key" aria-label={`${option.name} symbol key`}>
      {items.map((item) => (
        <span className="search-lines-2-symbol-key-item" key={`${option.id}-${item.name}`}>
          <ShapeIcon
            shape={item.shape}
            color={option.color}
            title={`${item.name} symbol`}
          />
          <span>{item.name}</span>
        </span>
      ))}
    </div>
  );
};

const getOrderedUsers = (data: FetchInteractionDataResponse): string[] => {
  const selectedUsers = new Set(data.interactions.map((interactionGroup) => interactionGroup.user));
  const orderedUsers = data.users.users
    .map((user) => user.user)
    .filter((user) => selectedUsers.has(user));

  data.interactions.forEach((interactionGroup) => {
    if (!orderedUsers.includes(interactionGroup.user)) {
      orderedUsers.push(interactionGroup.user);
    }
  });

  return orderedUsers;
};

const getOrderedTasks = (data: FetchInteractionDataResponse): string[] => {
  const selectedTasks = new Set(data.interactions.map((interactionGroup) => interactionGroup.task));
  const orderedTasks = data.tasks.tasks
    .map((task) => task.name)
    .filter((task) => selectedTasks.has(task));

  data.interactions.forEach((interactionGroup) => {
    if (!orderedTasks.includes(interactionGroup.task)) {
      orderedTasks.push(interactionGroup.task);
    }
  });

  return orderedTasks;
};

const getOrderedTaskGroups = (tasks: string[], tasksByName: Map<string, TaskRow>): string[] => {
  const taskGroups: string[] = [];

  tasks.forEach((taskName) => {
    const taskGroup = tasksByName.get(taskName)?.taskGroup || MISSING_GROUP_LABEL;

    if (!taskGroups.includes(taskGroup)) {
      taskGroups.push(taskGroup);
    }
  });

  return taskGroups;
};

const getTaskNameBySubmissionTaskId = (
  data: FetchInteractionDataResponse,
): Map<string, string> => {
  return new Map(data.tasks.tasks.map((task) => [task.task_id, task.name]));
};

const getSubmissionsByCell = (
  data: FetchInteractionDataResponse,
): Map<string, SubmissionRow[]> => {
  const submissionsByCell = new Map<string, SubmissionRow[]>();
  const taskNameBySubmissionTaskId = getTaskNameBySubmissionTaskId(data);

  data.submissions.submissions.forEach((submission) => {
    const taskName = taskNameBySubmissionTaskId.get(submission.task_id) ?? submission.task_id;
    const key = cellKey(submission.user, taskName);

    submissionsByCell.set(key, [...(submissionsByCell.get(key) ?? []), submission]);
  });

  return submissionsByCell;
};

const getSelectionRangesByBand = (
  selections: TimeRangeSelection[],
): Map<string, TimeRangeSelection[]> => {
  const rangesByBand = new Map<string, TimeRangeSelection[]>();

  selections.forEach((selection) => {
    rangesByBand.set(selection.bandId, [...(rangesByBand.get(selection.bandId) ?? []), selection]);
  });

  return rangesByBand;
};

const isWithinAnySelectionRange = (
  timestamp: number,
  ranges: TimeRangeSelection[],
): boolean => (
  ranges.some((range) => timestamp >= range.start && timestamp <= range.end)
);

const selectTopLevelHierarchy = (
  hierarchy: InteractionHierarchyNode[],
): InteractionHierarchyNode[] => {
  const normalizeChildren = (nodes: InteractionHierarchyNode[]): InteractionHierarchyNode[] =>
    nodes.map((node) => ({
      ...node,
      Visualize: false,
      Cancelled: false,
      Children: normalizeChildren(node.Children ?? []),
    }));

  return hierarchy.map((node) => ({
    ...node,
    Visualize: true,
    Cancelled: false,
    Children: normalizeChildren(node.Children ?? []),
  }));
};

const getAbstractTypeByAction = (
  hierarchy: InteractionHierarchyNode[],
): Map<string, string> => {
  const abstractTypeByAction = new Map<string, string>();

  const visit = (node: InteractionHierarchyNode, activeAbstractType: string | null): void => {
    const nextAbstractType = node.Visualize ? node.Name : activeAbstractType;
    abstractTypeByAction.set(node.Name, nextAbstractType ?? node.Name);

    (node.Children ?? []).forEach((child) => {
      visit(child, nextAbstractType);
    });
  };

  hierarchy.forEach((node) => {
    visit(node, null);
  });

  return abstractTypeByAction;
};

const normalizeSelectionSnapshotForTarget = (
  data: FetchInteractionDataResponse,
  targetComponent: SelectionSnapshotTarget,
): FetchInteractionDataResponse => {
  const snapshot = structuredClone(data);

  if (targetComponent === "countBarchart") {
    return snapshot;
  }

  const abstractTypeByUser = new Map(
    snapshot.users.users.map((user) => {
      user.hierarchy = selectTopLevelHierarchy(user.hierarchy);

      return [user.user, getAbstractTypeByAction(user.hierarchy)];
    }),
  );

  snapshot.interactions = snapshot.interactions.map((interactionGroup) => {
    const abstractTypeByAction = abstractTypeByUser.get(interactionGroup.user);

    return {
      ...interactionGroup,
      interactions: interactionGroup.interactions.map((interaction) => ({
        ...interaction,
        abstract_type: abstractTypeByAction?.get(interaction.action) ?? interaction.action,
        cancelled: false,
      })),
    };
  });

  return snapshot;
};

const buildSelectionSnapshot = (
  data: FetchInteractionDataResponse | null,
  selections: TimeRangeSelection[],
  targetComponent: SelectionSnapshotTarget,
): FetchInteractionDataResponse | null => {
  if (!data || !selections.length) {
    return null;
  }

  const rangesByBand = getSelectionRangesByBand(selections);
  let selectedInteractionCount = 0;
  const taskNameByTaskId = new Map(data.tasks.tasks.map((task) => [task.task_id, task.name]));
  const snapshot: FetchInteractionDataResponse = structuredClone(data);

  snapshot.interactions = snapshot.interactions.map((interactionGroup) => {
    const key = cellKey(interactionGroup.user, interactionGroup.task);
    const ranges = rangesByBand.get(key) ?? [];
    const interactions = interactionGroup.interactions.map((interaction) => {
      const selected = ranges.length > 0 && isWithinAnySelectionRange(interaction.timestamp, ranges);

      if (selected) {
        selectedInteractionCount += 1;
      }

      return {
        ...interaction,
        selected,
      };
    });

    return {
      ...interactionGroup,
      interactions,
    };
  });

  if (!selectedInteractionCount) {
    return null;
  }

  snapshot.submissions.submissions = snapshot.submissions.submissions.map((submission) => {
    const taskName = taskNameByTaskId.get(submission.task_id) ?? submission.task_id;
    const ranges = rangesByBand.get(cellKey(submission.user, taskName)) ?? [];

    return {
      ...submission,
      selected: ranges.length > 0 && isWithinAnySelectionRange(submission.timestamp, ranges),
    };
  });

  return normalizeSelectionSnapshotForTarget(snapshot, targetComponent);
};

const buildModel = (data: FetchInteractionDataResponse | null): SearchLines2Model => {
  if (!data) {
    return {
      users: [],
      tasks: [],
      taskGroups: [],
      tasksByName: new Map(),
      panelsByCell: new Map(),
      submissionsByCell: new Map(),
    };
  }

  const tasksByName = new Map(data.tasks.tasks.map((task) => [task.name, task]));
  const tasks = getOrderedTasks(data);

  return {
    users: getOrderedUsers(data),
    tasks,
    taskGroups: getOrderedTaskGroups(tasks, tasksByName),
    tasksByName,
    panelsByCell: new Map(
      data.interactions.map((interactionGroup) => [
        cellKey(interactionGroup.user, interactionGroup.task),
        interactionGroup,
      ]),
    ),
    submissionsByCell: getSubmissionsByCell(data),
  };
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

const getEffectiveTaskEnd = (
  task: TaskRow,
  submissions: SubmissionRow[],
): number | null => {
  const firstCorrectSubmissionTimestamp = getFirstCorrectSubmissionTimestamp(submissions);

  if (task.finished_after_correct_answer && firstCorrectSubmissionTimestamp !== null) {
    return firstCorrectSubmissionTimestamp;
  }

  return task.ended;
};

const getTimelineBounds = (
  task: TaskRow | undefined,
  interactions: FetchInteractionLogRow[],
  submissions: SubmissionRow[],
): TimelineBounds | null => {
  const timestamps = interactions.map((interaction) => interaction.timestamp);
  const fallbackStart = timestamps.length ? Math.min(...timestamps) : null;
  const fallbackEnd = timestamps.length ? Math.max(...timestamps) : null;
  const start = task?.started ?? fallbackStart;
  const rawScaleEnd = task?.ended ?? fallbackEnd;
  const rawLineEnd = task ? getEffectiveTaskEnd(task, submissions) : fallbackEnd;

  if (start === null || rawScaleEnd === null || rawLineEnd === null) {
    return null;
  }

  const scaleEnd = rawScaleEnd > start ? rawScaleEnd : start + 1;
  const lineEnd = Math.min(Math.max(rawLineEnd, start), scaleEnd);

  return {
    start,
    scaleEnd,
    lineEnd,
  };
};

const getColumnBounds = (bands: TimelineBandData[]): TimelineBounds | null => {
  const scaleDurations: number[] = [];
  const lineDurations: number[] = [];

  bands.forEach((band) => {
    const bounds = getTimelineBounds(band.task, band.interactions, band.submissions);

    if (!bounds) {
      return;
    }

    scaleDurations.push(bounds.scaleEnd - bounds.start);
    lineDurations.push(bounds.lineEnd - bounds.start);
  });

  if (!scaleDurations.length || !lineDurations.length) {
    return null;
  }

  const scaleEnd = Math.max(...scaleDurations);

  return {
    start: 0,
    scaleEnd: scaleEnd > 0 ? scaleEnd : 1,
    lineEnd: Math.max(...lineDurations),
  };
};

const getTopLevelActionColors = (
  users: UserRow[],
  overlayGroups: OverlayGroup[],
): Map<string, Map<string, string>> => {
  const colorByGroupName = new Map(overlayGroups.map((group) => [group.name, group.color]));

  return new Map(users.map((user) => {
    const colorByAction = new Map<string, string>();

    const visit = (node: InteractionHierarchyNode, rootName: string): void => {
      colorByAction.set(node.Name, colorByGroupName.get(rootName) ?? "#4b5563");
      (node.Children ?? []).forEach((child) => visit(child, rootName));
    };

    user.hierarchy.forEach((rootNode) => visit(rootNode, rootNode.Name));

    return [user.user, colorByAction];
  }));
};

const getTopLevelActionGroupIds = (
  users: UserRow[],
  overlayGroups: OverlayGroup[],
): Map<string, Map<string, string>> => {
  const groupIdByGroupName = new Map(overlayGroups.map((group) => [group.name, group.id]));

  return new Map(users.map((user) => {
    const groupIdByAction = new Map<string, string>();

    const visit = (node: InteractionHierarchyNode, rootName: string): void => {
      const groupId = groupIdByGroupName.get(rootName);

      if (groupId) {
        groupIdByAction.set(node.Name, groupId);
      }

      (node.Children ?? []).forEach((child) => visit(child, rootName));
    };

    user.hierarchy.forEach((rootNode) => visit(rootNode, rootNode.Name));

    return [user.user, groupIdByAction];
  }));
};

const getInteractionColor = (
  interaction: FetchInteractionLogRow,
  user: string,
  topLevelColorsByUser: Map<string, Map<string, string>>,
): string => {
  const topLevelColors = topLevelColorsByUser.get(user);

  return topLevelColors?.get(interaction.action)
    ?? topLevelColors?.get(interaction.abstract_type)
    ?? "#4b5563";
};

const shouldDrawInteractionSymbol = (
  interaction: FetchInteractionLogRow,
  user: string,
  cancelledOverlayGroupIds: Set<string>,
  overlaySelections: OverlaySelection[],
  overlayOptionById: Map<string, OverlayOption>,
  includeDescendantMarkers: boolean,
  topLevelGroupIdsByUser: Map<string, Map<string, string>>,
): boolean => {
  const topLevelGroupIds = topLevelGroupIdsByUser.get(user);
  const groupId = topLevelGroupIds?.get(interaction.action)
    ?? topLevelGroupIds?.get(interaction.abstract_type);

  if (!groupId || !cancelledOverlayGroupIds.has(groupId)) {
    return true;
  }

  return overlaySelections.some((selection) => {
    const option = overlayOptionById.get(selection.optionId);

    return option?.groupId === groupId
      && interactionMatchesOverlayOption(interaction, option, includeDescendantMarkers);
  });
};

const getColumnBands = (
  model: SearchLines2Model,
  columnMode: ColumnMode,
): TimelineColumn[] => {
  const makeBand = (user: string, taskName: string, label: string, detail: string): TimelineBandData => {
    const key = cellKey(user, taskName);
    const panel = model.panelsByCell.get(key);

    return {
      id: key,
      label,
      detail,
      user,
      taskName,
      interactions: panel?.interactions ?? [],
      submissions: model.submissionsByCell.get(key) ?? [],
      task: model.tasksByName.get(taskName),
    };
  };

  if (columnMode === "user") {
    return model.users.map((user) => ({
      id: user,
      label: user,
      subtitle: `${model.tasks.length} tasks`,
      bands: model.tasks.map((taskName) => makeBand(user, taskName, taskName, "")),
    }));
  }

  if (columnMode === "taskGroup") {
    return model.taskGroups.map((taskGroup) => {
      const tasksInGroup = model.tasks.filter((taskName) =>
        (model.tasksByName.get(taskName)?.taskGroup || MISSING_GROUP_LABEL) === taskGroup,
      );

      return {
        id: taskGroup,
        label: taskGroup,
        subtitle: `${tasksInGroup.length} tasks`,
        bands: tasksInGroup.flatMap((taskName) =>
          model.users.map((user) => makeBand(user, taskName, `${user} / ${taskName}`, "")),
        ),
      };
    });
  }

  return model.tasks.map((taskName) => ({
    id: taskName,
    label: taskName,
    subtitle: model.tasksByName.get(taskName)?.taskGroup || MISSING_GROUP_LABEL,
    bands: model.users.map((user) => makeBand(user, taskName, user, "")),
  }));
};

const SelectionSnapshotMenu: React.FC<{
  data: FetchInteractionDataResponse | null;
  selections: TimeRangeSelection[];
}> = ({data, selections}) => {
  const {addTabToActiveTabSet} = useLayout();
  const hasSelection = selections.length > 0;
  const items: MenuProps["items"] = [
    {key: "countBarchart", label: "Count Barchart"},
    {key: "durationBarchart", label: "Duration Barchart"},
  ];
  const handleOpenSelectionAs: MenuProps["onClick"] = ({key}) => {
    const targetComponent = key as SelectionSnapshotTarget;
    const initialData = buildSelectionSnapshot(data, selections, targetComponent);

    if (!initialData) {
      return;
    }

    addTabToActiveTabSet(
      targetComponent === "countBarchart" ? "Count Barchart" : "Duration Barchart",
      targetComponent,
      {
        initialData,
        sourceVisualizationType: "searchLines2",
      },
    );
  };

  return (
    <Dropdown
      menu={{items, onClick: handleOpenSelectionAs}}
      trigger={["click"]}
      disabled={!hasSelection}
    >
      <Button disabled={!hasSelection}>
        Open Selection as...
      </Button>
    </Dropdown>
  );
};

const SearchLines2Column: React.FC<{
  column: TimelineColumn;
  rankField: RankField;
  overlaySelections: OverlaySelection[];
  overlayOptionById: Map<string, OverlayOption>;
  cancelledOverlayGroupIds: Set<string>;
  includeDescendantMarkers: boolean;
  topLevelColorsByUser: Map<string, Map<string, string>>;
  topLevelGroupIdsByUser: Map<string, Map<string, string>>;
  selectedBandId: string | null;
  timeRangeSelections: TimeRangeSelection[];
  onSelectBand: (bandId: string) => void;
  onAddTimeRangeSelection: (selection: TimeRangeSelection) => void;
  onRemoveTimeRangeSelection: (selectionId: string) => void;
}> = ({
  column,
  rankField,
  overlaySelections,
  overlayOptionById,
  cancelledOverlayGroupIds,
  includeDescendantMarkers,
  topLevelColorsByUser,
  topLevelGroupIdsByUser,
  selectedBandId,
  timeRangeSelections,
  onSelectBand,
  onAddTimeRangeSelection,
  onRemoveTimeRangeSelection,
}) => {
  const [activeTimeRangeDrag, setActiveTimeRangeDrag] = useState<ActiveTimeRangeDrag | null>(null);
  const columnBounds = getColumnBounds(column.bands);

  if (!columnBounds) {
    return (
      <article className="search-lines-2-column">
        <div className="search-lines-2-column-header">
          <h2>{column.label}</h2>
          <span>{column.subtitle}</span>
        </div>
        <div className="task-barchart-empty">No task timing</div>
      </article>
    );
  }

  const innerWidth = CHART_WIDTH - BAND_LABEL_WIDTH - CHART_MARGIN_X * 2;
  const timelineLeft = BAND_LABEL_WIDTH + CHART_MARGIN_X;
  const xScale = (elapsedTimestamp: number): number => {
    const clampedTimestamp = Math.min(Math.max(elapsedTimestamp, columnBounds.start), columnBounds.scaleEnd);

    return timelineLeft + ((clampedTimestamp - columnBounds.start) / (columnBounds.scaleEnd - columnBounds.start)) * innerWidth;
  };
  const xToElapsedTimestamp = (x: number): number => {
    const clampedX = Math.min(Math.max(x, timelineLeft), timelineLeft + innerWidth);
    const normalizedX = (clampedX - timelineLeft) / innerWidth;

    return columnBounds.start + normalizedX * (columnBounds.scaleEnd - columnBounds.start);
  };
  const chartHeight = COLUMN_HEADER_HEIGHT
    + column.bands.length * BAND_HEIGHT
    + Math.max(0, column.bands.length - 1) * BAND_GAP
    + COLUMN_FOOTER_HEIGHT;
  const selectionAreaTop = COLUMN_HEADER_HEIGHT;
  const selectionAreaBottom = COLUMN_HEADER_HEIGHT
    + column.bands.length * BAND_HEIGHT
    + Math.max(0, column.bands.length - 1) * BAND_GAP;
  const getSvgPoint = (event: React.PointerEvent<SVGSVGElement>): {x: number; y: number} => {
    const rect = event.currentTarget.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * CHART_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * chartHeight,
    };
  };
  const clampSelectionX = (x: number): number => Math.min(Math.max(x, timelineLeft), timelineLeft + innerWidth);
  const clampSelectionY = (y: number): number => Math.min(Math.max(y, selectionAreaTop), selectionAreaBottom);
  const selectionDraftX = activeTimeRangeDrag
    ? Math.min(activeTimeRangeDrag.startX, activeTimeRangeDrag.currentX)
    : 0;
  const selectionDraftY = activeTimeRangeDrag
    ? Math.min(activeTimeRangeDrag.startY, activeTimeRangeDrag.currentY)
    : 0;
  const selectionDraftWidth = activeTimeRangeDrag
    ? Math.abs(activeTimeRangeDrag.currentX - activeTimeRangeDrag.startX)
    : 0;
  const selectionDraftHeight = activeTimeRangeDrag
    ? Math.abs(activeTimeRangeDrag.currentY - activeTimeRangeDrag.startY)
    : 0;
  const handleSelectionPointerDown = (event: React.PointerEvent<SVGSVGElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getSvgPoint(event);

    setActiveTimeRangeDrag({
      startX: clampSelectionX(point.x),
      currentX: clampSelectionX(point.x),
      startY: clampSelectionY(point.y),
      currentY: clampSelectionY(point.y),
    });
  };
  const handleSelectionPointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (!activeTimeRangeDrag) {
      return;
    }

    const point = getSvgPoint(event);

    setActiveTimeRangeDrag({
      ...activeTimeRangeDrag,
      currentX: clampSelectionX(point.x),
      currentY: clampSelectionY(point.y),
    });
  };
  const handleSelectionPointerUp = (): void => {
    if (!activeTimeRangeDrag) {
      return;
    }

    const startX = Math.min(activeTimeRangeDrag.startX, activeTimeRangeDrag.currentX);
    const endX = Math.max(activeTimeRangeDrag.startX, activeTimeRangeDrag.currentX);
    const startY = Math.min(activeTimeRangeDrag.startY, activeTimeRangeDrag.currentY);
    const endY = Math.max(activeTimeRangeDrag.startY, activeTimeRangeDrag.currentY);

    if (endX - startX >= MIN_MAIN_SELECTION_WIDTH) {
      const elapsedStart = xToElapsedTimestamp(startX);
      const elapsedEnd = xToElapsedTimestamp(endX);

      column.bands.forEach((band, bandIndex) => {
        const bandY = COLUMN_HEADER_HEIGHT + bandIndex * (BAND_HEIGHT + BAND_GAP);
        const bandBottom = bandY + BAND_HEIGHT;
        const bandBounds = getTimelineBounds(band.task, band.interactions, band.submissions);

        if (!bandBounds || bandBottom < startY || bandY > endY) {
          return;
        }

        const start = Math.min(bandBounds.start + elapsedStart, bandBounds.scaleEnd);
        const end = Math.min(bandBounds.start + elapsedEnd, bandBounds.scaleEnd);

        if (end <= start) {
          return;
        }

        onAddTimeRangeSelection({
          id: createSelectionId(band.id, start, end),
          bandId: band.id,
          user: band.user,
          taskName: band.taskName,
          start,
          end,
        });
      });
    }

    setActiveTimeRangeDrag(null);
  };
  const handleSelectionPointerCancel = (): void => {
    setActiveTimeRangeDrag(null);
  };
  const renderSelectionOverlay = (
    band: TimelineBandData,
    bandBounds: TimelineBounds | null,
    bandY: number,
  ): React.ReactNode => {
    const centerY = bandY + BAND_HEIGHT / 2;

    return timeRangeSelections
      .filter((selection) => selection.bandId === band.id)
      .map((selection) => {
        if (!bandBounds) {
          return null;
        }

        const selectionX = xScale(selection.start - bandBounds.start);
        const selectionWidth = Math.max(1, xScale(selection.end - bandBounds.start) - selectionX);

        return (
          <g className="search-lines-2-main-selection" key={selection.id}>
            <rect
              x={selectionX}
              y={bandY + 2}
              width={selectionWidth}
              height={BAND_HEIGHT - 4}
            >
              {bandBounds && (
                <title>
                  {`${band.user} / ${band.taskName}: ${formatElapsedSeconds(selection.start, bandBounds.start)}-${formatElapsedSeconds(selection.end, bandBounds.start)}`}
                </title>
              )}
            </rect>
            <g
              className="search-lines-2-main-selection-remove"
              role="button"
              tabIndex={0}
              transform={`translate(${Math.min(selectionX + selectionWidth, CHART_WIDTH - 7)} ${centerY})`}
              onClick={(event) => {
                event.stopPropagation();
                onRemoveTimeRangeSelection(selection.id);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRemoveTimeRangeSelection(selection.id);
                }
              }}
            >
              <circle r={5} />
              <text y={2.5} textAnchor="middle">x</text>
            </g>
          </g>
        );
      });
  };

  return (
    <article className="search-lines-2-column">
      <div className="search-lines-2-column-header">
        <h2>{column.label}</h2>
        <span>{column.subtitle}</span>
      </div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
        role="img"
        aria-label={`${column.label} search processes`}
        onPointerDown={handleSelectionPointerDown}
        onPointerMove={handleSelectionPointerMove}
        onPointerUp={handleSelectionPointerUp}
        onPointerCancel={handleSelectionPointerCancel}
      >
        <line
          className="search-lines-2-scale-line"
          x1={timelineLeft}
          x2={timelineLeft + innerWidth}
          y1={COLUMN_HEADER_HEIGHT - 6}
          y2={COLUMN_HEADER_HEIGHT - 6}
        />
        {column.bands.map((band, bandIndex) => {
          const sortedInteractions = [...band.interactions].sort((first, second) => first.timestamp - second.timestamp);
          const bandBounds = getTimelineBounds(band.task, sortedInteractions, band.submissions);
          const bandY = COLUMN_HEADER_HEIGHT + bandIndex * (BAND_HEIGHT + BAND_GAP);
          const centerY = bandY + BAND_HEIGHT / 2;
          const isSelected = selectedBandId === band.id;
          const handleBandKeyDown = (event: React.KeyboardEvent<SVGElement>): void => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectBand(band.id);
            }
          };

          if (!bandBounds) {
            return (
              <g
                className={`search-lines-2-band ${isSelected ? "is-selected" : ""}`}
                key={band.id}
              >
                <rect
                  className="search-lines-2-band-hitbox"
                  x={0}
                  y={bandY}
                  width={CHART_WIDTH}
                  height={BAND_HEIGHT}
                >
                  <title>{`Zoom ${band.user} / ${band.taskName}`}</title>
                </rect>
                <rect
                  className="search-lines-2-band-selection"
                  x={0.5}
                  y={bandY + 0.5}
                  width={CHART_WIDTH - 1}
                  height={BAND_HEIGHT - 1}
                />
                <text
                  className="search-lines-2-band-label search-lines-2-band-label-button"
                  x={0}
                  y={centerY + 3}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectBand(band.id);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={handleBandKeyDown}
                >
                  {band.label}
                </text>
                <line
                  className="search-lines-2-band-baseline is-muted"
                  x1={timelineLeft}
                  x2={timelineLeft + innerWidth}
                  y1={centerY}
                  y2={centerY}
                />
              </g>
            );
          }

          const firstInactiveInteraction = sortedInteractions.find((interaction) =>
            !interaction.task_is_active
            && interaction.timestamp >= bandBounds.start
            && interaction.timestamp <= bandBounds.lineEnd,
          );
          const timelineEnd = firstInactiveInteraction
            ? firstInactiveInteraction.timestamp
            : bandBounds.lineEnd;
          const visibleInteractions = sortedInteractions.filter((interaction) =>
            interaction.task_is_active
            && interaction.timestamp >= bandBounds.start
            && interaction.timestamp <= timelineEnd,
          );
          const visibleSubmissions = getVisibleSubmissions(
            band.submissions,
            bandBounds.start,
            timelineEnd,
          );
          const points = [
            bandBounds.start,
            ...visibleInteractions.map((interaction) => interaction.timestamp),
            timelineEnd,
          ];
          const segments = points.slice(0, -1).map((startTimestamp, index) => ({
            id: `${band.id}-${startTimestamp}-${points[index + 1]}-${index}`,
            startTimestamp,
            endTimestamp: points[index + 1],
            sourceInteraction: index === 0 ? null : visibleInteractions[index - 1],
          }));
          const taskEnd = band.task?.ended ?? null;

          return (
            <g
              className={`search-lines-2-band ${isSelected ? "is-selected" : ""}`}
              key={band.id}
            >
              <rect
                className="search-lines-2-band-hitbox"
                x={0}
                y={bandY}
                width={CHART_WIDTH}
                height={BAND_HEIGHT}
              >
                <title>{`Zoom ${band.user} / ${band.taskName}`}</title>
              </rect>
              <rect
                className="search-lines-2-band-selection"
                x={0.5}
                y={bandY + 0.5}
                width={CHART_WIDTH - 1}
                height={BAND_HEIGHT - 1}
              />
              <text
                className="search-lines-2-band-label search-lines-2-band-label-button"
                x={0}
                y={centerY + 3}
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectBand(band.id);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={handleBandKeyDown}
              >
                {band.label}
                <title>{[band.user, band.taskName].join(" / ")}</title>
              </text>
              <line
                className="search-lines-2-band-baseline"
                x1={xScale(0)}
                x2={xScale(timelineEnd - bandBounds.start)}
                y1={centerY}
                y2={centerY}
              />
              {segments.map((segment) => {
                const opacity = getRankOpacity(getRankValue(segment.sourceInteraction, rankField));

                if (opacity <= 0) {
                  return null;
                }

                return (
                  <rect
                    className="search-lines-2-rank-band"
                    key={segment.id}
                    x={xScale(segment.startTimestamp - bandBounds.start)}
                    y={bandY + 1}
                    width={Math.max(
                      0.5,
                      xScale(segment.endTimestamp - bandBounds.start) - xScale(segment.startTimestamp - bandBounds.start),
                    )}
                    height={BAND_HEIGHT - 2}
                    fill={RANK_BACKGROUND_COLOR}
                    opacity={opacity}
                  >
                    <title>{getSegmentTooltip(segment.sourceInteraction, segment.startTimestamp, bandBounds.start)}</title>
                  </rect>
                );
              })}
              {taskEnd !== null && taskEnd >= bandBounds.start && taskEnd <= bandBounds.scaleEnd && (
                <line
                  className="search-lines-2-task-end"
                  x1={xScale(taskEnd - bandBounds.start)}
                  x2={xScale(taskEnd - bandBounds.start)}
                  y1={bandY + 1}
                  y2={bandY + BAND_HEIGHT - 1}
                >
                  <title>{`${band.taskName} scheduled end: ${formatElapsedSeconds(taskEnd, bandBounds.start)}`}</title>
                </line>
              )}
              {visibleInteractions.map((interaction, interactionIndex) => {
                const markerConfigs = getMarkerConfigs(
                  interaction,
                  overlaySelections,
                  overlayOptionById,
                  includeDescendantMarkers,
                  bandBounds.start,
                );
                const x = xScale(interaction.timestamp - bandBounds.start);
                const shouldDrawSymbol = shouldDrawInteractionSymbol(
                  interaction,
                  band.user,
                  cancelledOverlayGroupIds,
                  overlaySelections,
                  overlayOptionById,
                  includeDescendantMarkers,
                  topLevelGroupIdsByUser,
                );

                if (!shouldDrawSymbol) {
                  return null;
                }

                if (markerConfigs.length) {
                  return (
                    <g key={`${band.id}-${interaction.timestamp}-${interaction.action}-${interactionIndex}`}>
                      {markerConfigs.map((config, markerIndex) => (
                        <MarkerSymbol
                          key={`${config.optionId}-${config.symbolMode}-${config.symbolType}-${markerIndex}`}
                          config={config}
                          x={x}
                          y={centerY + (markerIndex - (markerConfigs.length - 1) / 2) * 8}
                        />
                      ))}
                    </g>
                  );
                }

                return (
                  <circle
                    className="search-lines-2-dot"
                    key={`${band.id}-${interaction.timestamp}-${interaction.action}-${interactionIndex}`}
                    cx={x}
                    cy={centerY}
                    r={1.45}
                    fill={getInteractionColor(interaction, band.user, topLevelColorsByUser)}
                  >
                    <title>{getMarkerTooltip(interaction, bandBounds.start, "Event", interaction.abstract_type)}</title>
                  </circle>
                );
              })}
              {visibleSubmissions.map((submission, submissionIndex) => (
                <SubmissionStar
                  key={`${band.id}-${submission.timestamp}-${submission.status}-${submissionIndex}`}
                  submission={submission}
                  taskStartTimestamp={bandBounds.start}
                  x={xScale(submission.timestamp - bandBounds.start)}
                  y={centerY - 5}
                />
              ))}
            </g>
          );
        })}
        <g className="search-lines-2-main-selection-layer">
          {column.bands.map((band, bandIndex) => {
            const bandY = COLUMN_HEADER_HEIGHT + bandIndex * (BAND_HEIGHT + BAND_GAP);
            const sortedInteractions = [...band.interactions].sort((first, second) => first.timestamp - second.timestamp);
            const bandBounds = getTimelineBounds(band.task, sortedInteractions, band.submissions);

            return renderSelectionOverlay(band, bandBounds, bandY);
          })}
        </g>
        {activeTimeRangeDrag && (
          <rect
            className="search-lines-2-main-selection-draft"
            x={selectionDraftX}
            y={selectionDraftY}
            width={Math.max(1, selectionDraftWidth)}
            height={Math.max(1, selectionDraftHeight)}
          />
        )}
      </svg>
    </article>
  );
};

const OverlayControls: React.FC<{
  overlayGroups: OverlayGroup[];
  overlaySelections: OverlaySelection[];
  overlayOptionById: Map<string, OverlayOption>;
  cancelledOverlayGroupIds: Set<string>;
  onAddSelection: (optionId: string) => void;
  onRemoveSelection: (optionId: string) => void;
  onToggleLeafSymbols: (optionId: string, useLeafSymbols: boolean) => void;
  onToggleCancelledGroup: (groupId: string) => void;
}> = ({
  overlayGroups,
  overlaySelections,
  overlayOptionById,
  cancelledOverlayGroupIds,
  onAddSelection,
  onRemoveSelection,
  onToggleLeafSymbols,
  onToggleCancelledGroup,
}) => {
  if (!overlayGroups.length) {
    return null;
  }

  const selectedOptionIds = new Set(overlaySelections.map((selection) => selection.optionId));
  const selectionIndexByOptionId = new Map(
    overlaySelections.map((selection, selectionIndex) => [selection.optionId, selectionIndex] as const),
  );

  return (
    <section className="search-lines-overlay-controls">
      {overlayGroups.map((group) => {
        const groupSelections = overlaySelections.filter((selection) => {
          const option = overlayOptionById.get(selection.optionId);

          return option?.groupId === group.id;
        });
        const groupCancelled = cancelledOverlayGroupIds.has(group.id);

        return (
          <div className="search-lines-overlay-group" key={group.id}>
            <div className="search-lines-overlay-group-header">
              <span
                className="search-lines-overlay-color"
                style={{backgroundColor: group.color}}
              />
              <span>{group.name}</span>
            </div>
            <div className="search-lines-overlay-select-row">
              <Select
                className="search-lines-overlay-select"
                value={undefined}
                placeholder="Draw symbols for event type"
                popupMatchSelectWidth={false}
                options={group.options.map((option) => ({
                  value: option.id,
                  disabled: selectedOptionIds.has(option.id),
                  label: `${"  ".repeat(Math.max(0, option.depth - 1))}${option.name}`,
                }))}
                onSelect={(optionId) => {
                  if (typeof optionId === "string") {
                    onAddSelection(optionId);
                  }
                }}
              />
              <button
                className={[
                  "search-lines-overlay-cancel-group",
                  groupCancelled ? "is-active" : "",
                ].join(" ")}
                type="button"
                aria-pressed={groupCancelled}
                aria-label={
                  groupCancelled
                    ? `Draw all symbols in ${group.name}`
                    : `Hide unselected symbols in ${group.name}`
                }
                title={
                  groupCancelled
                    ? `Draw all symbols in ${group.name}`
                    : `Hide unselected symbols in ${group.name}`
                }
                onClick={() => onToggleCancelledGroup(group.id)}
              >
                x
              </button>
            </div>
            <div className="search-lines-overlay-chips">
              {groupSelections.map((selection) => {
                const option = overlayOptionById.get(selection.optionId);

                if (!option) {
                  return null;
                }

                return (
                  <div className="search-lines-overlay-chip search-lines-2-overlay-chip" key={selection.optionId}>
                    <div className="search-lines-2-overlay-chip-main">
                      <SelectionSymbolIcon
                        selection={selection}
                        option={option}
                        selectionIndex={selectionIndexByOptionId.get(selection.optionId) ?? 0}
                      />
                      <span>{option.name}</span>
                      <Switch
                        size="small"
                        checked={selection.useLeafSymbols}
                        checkedChildren="Leaves"
                        unCheckedChildren="One"
                        onChange={(checked) => onToggleLeafSymbols(option.id, checked)}
                      />
                      <button
                        className="search-lines-overlay-remove"
                        type="button"
                        aria-label={`Remove ${option.name}`}
                        onClick={() => onRemoveSelection(option.id)}
                      >
                        x
                      </button>
                    </div>
                    {selection.useLeafSymbols && (
                      <SymbolKey option={option} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
};

const SearchLines2View: React.FC<SearchLines2ViewProps> = ({
  data,
  dataSelector,
  onOpenDataManipulator,
  informationAction,
  snapshotActions,
}) => {
  const [rankField, setRankField] = useState<RankField>("frameRank");
  const [columnMode, setColumnMode] = useState<ColumnMode>("task");
  const [stackColumns, setStackColumns] = useState(false);
  const [includeDescendantMarkers, setIncludeDescendantMarkers] = useState(true);
  const [overlaySelections, setOverlaySelections] = useState<OverlaySelection[]>([]);
  const [cancelledOverlayGroupIds, setCancelledOverlayGroupIds] = useState<Set<string>>(() => new Set());
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [timeRangeSelections, setTimeRangeSelections] = useState<TimeRangeSelection[]>([]);
  const model = useMemo(() => buildModel(data), [data]);
  const columns = useMemo(() => getColumnBands(model, columnMode), [model, columnMode]);
  const selectedBand = useMemo(() => (
    selectedBandId
      ? columns.flatMap((column) => column.bands).find((band) => band.id === selectedBandId) ?? null
      : null
  ), [columns, selectedBandId]);
  const overlayGroups = useMemo(() => buildOverlayGroups(data), [data]);
  const overlayOptionById = useMemo(() => getOverlayOptionById(overlayGroups), [overlayGroups]);
  const validOverlaySelections = useMemo(
    () => overlaySelections.filter((selection) => overlayOptionById.has(selection.optionId)),
    [overlayOptionById, overlaySelections],
  );
  const topLevelColorsByUser = useMemo(
    () => getTopLevelActionColors(data?.users.users ?? [], overlayGroups),
    [data, overlayGroups],
  );
  const topLevelGroupIdsByUser = useMemo(
    () => getTopLevelActionGroupIds(data?.users.users ?? [], overlayGroups),
    [data, overlayGroups],
  );
  const selectedPairCount = data?.interactions.length ?? 0;
  const interactionCount = data?.interactions.reduce(
    (sum, interactionGroup) => sum + interactionGroup.interactions.length,
    0,
  ) ?? 0;
  const selectedInteractionCount = useMemo(() => {
    if (!data || !timeRangeSelections.length) {
      return 0;
    }

    const rangesByBand = getSelectionRangesByBand(timeRangeSelections);

    return data.interactions.reduce((sum, interactionGroup) => {
      const ranges = rangesByBand.get(cellKey(interactionGroup.user, interactionGroup.task)) ?? [];

      if (!ranges.length) {
        return sum;
      }

      return sum + interactionGroup.interactions.filter((interaction) =>
        isWithinAnySelectionRange(interaction.timestamp, ranges),
      ).length;
    }, 0);
  }, [data, timeRangeSelections]);

  const handleAddOverlaySelection = (optionId: string): void => {
    setOverlaySelections((currentSelections) => {
      if (currentSelections.some((selection) => selection.optionId === optionId)) {
        return currentSelections;
      }

      const nextOption = overlayOptionById.get(optionId);

      if (!nextOption) {
        return currentSelections;
      }

      return [
        ...currentSelections.filter((selection) => {
          const selectedOption = overlayOptionById.get(selection.optionId);

          return selectedOption ? !isSameHierarchyBranch(selectedOption, nextOption) : false;
        }),
        {optionId, useLeafSymbols: false},
      ];
    });
  };

  const handleRemoveOverlaySelection = (optionId: string): void => {
    setOverlaySelections((currentSelections) =>
      currentSelections.filter((selection) => selection.optionId !== optionId),
    );
  };

  const handleToggleLeafSymbols = (optionId: string, useLeafSymbols: boolean): void => {
    setOverlaySelections((currentSelections) =>
      currentSelections.map((selection) =>
        selection.optionId === optionId
          ? {...selection, useLeafSymbols}
          : selection,
      ),
    );
  };

  const handleToggleCancelledOverlayGroup = (groupId: string): void => {
    setCancelledOverlayGroupIds((currentGroupIds) => {
      const nextGroupIds = new Set(currentGroupIds);

      if (nextGroupIds.has(groupId)) {
        nextGroupIds.delete(groupId);
      } else {
        nextGroupIds.add(groupId);
      }

      return nextGroupIds;
    });
  };

  useEffect(() => {
    const validGroupIds = new Set(overlayGroups.map((group) => group.id));

    setCancelledOverlayGroupIds((currentGroupIds) => {
      const nextGroupIds = new Set(
        Array.from(currentGroupIds).filter((groupId) => validGroupIds.has(groupId)),
      );

      return nextGroupIds.size === currentGroupIds.size ? currentGroupIds : nextGroupIds;
    });
  }, [overlayGroups]);

  const handleAddTimeRangeSelection = (selection: TimeRangeSelection): void => {
    setTimeRangeSelections((currentSelections) => [...currentSelections, selection]);
  };

  const handleRemoveTimeRangeSelection = (selectionId: string): void => {
    setTimeRangeSelections((currentSelections) =>
      currentSelections.filter((selection) => selection.id !== selectionId),
    );
  };

  return (
    <div className="task-barchart">
      <div className="task-barchart-header">
        <h1>Search Lines</h1>
        <div className="task-barchart-actions">
          {informationAction}
          <Button type="primary" onClick={onOpenDataManipulator}>
            Data
          </Button>
          {snapshotActions}
          <SelectionSnapshotMenu
            data={data}
            selections={timeRangeSelections}
          />
        </div>
      </div>

      {dataSelector}

      <section className="task-barchart-options">
        <div className="search-lines-2-options-left">
          <div className="search-lines-rank-switch">
            <span>Columns</span>
            <Select
              value={columnMode}
              popupMatchSelectWidth={false}
              options={[
                {value: "task", label: "Task"},
                {value: "user", label: "User"},
                {value: "taskGroup", label: "Task group"},
              ]}
              onChange={(value) => setColumnMode(value)}
            />
          </div>
          <div className="search-lines-rank-switch">
            <span>Frame Rank</span>
            <Switch
              checked={rankField === "videoRank"}
              checkedChildren="Video"
              unCheckedChildren="Frame"
              onChange={(checked) => setRankField(checked ? "videoRank" : "frameRank")}
            />
            <span>Video Rank</span>
          </div>
          <div className="search-lines-legend" aria-label="Rank opacity legend">
            <span>0</span>
            <div className="search-lines-2-legend-ramp" />
            <span> &gt; 1000</span>
          </div>
        </div>
        <div className="task-barchart-summary">
          {selectedPairCount} user-task pairs, {interactionCount} interactions
        </div>
      </section>

      <section className="task-barchart-options">
        <div className="search-lines-rank-switch">
          <span>Columns</span>
          <Switch
            checked={stackColumns}
            checkedChildren="Rows"
            unCheckedChildren="Columns"
            onChange={setStackColumns}
          />
          <span>Rows</span>
        </div>
        <div className="search-lines-rank-switch">
          <span>Exact symbols</span>
          <Switch
            checked={includeDescendantMarkers}
            checkedChildren="Subtree"
            unCheckedChildren="Exact"
            onChange={setIncludeDescendantMarkers}
          />
          <span>Include descendants</span>
        </div>
        <div className="task-barchart-summary">
          {timeRangeSelections.length} selections, {selectedInteractionCount} selected interactions
        </div>
      </section>

      <OverlayControls
        overlayGroups={overlayGroups}
        overlaySelections={validOverlaySelections}
        overlayOptionById={overlayOptionById}
        cancelledOverlayGroupIds={cancelledOverlayGroupIds}
        onAddSelection={handleAddOverlaySelection}
        onRemoveSelection={handleRemoveOverlaySelection}
        onToggleLeafSymbols={handleToggleLeafSymbols}
        onToggleCancelledGroup={handleToggleCancelledOverlayGroup}
      />

      {!data || !columns.length ? (
        <div className="task-barchart-empty task-barchart-empty-state">No data</div>
      ) : (
        <div className={`search-lines-2-workspace ${selectedBand ? "has-zoom" : ""}`}>
          <div className="search-lines-2-columns-wrap">
            <div className={`search-lines-2-columns ${stackColumns ? "is-stacked" : ""}`}>
              {columns.map((column) => (
                <SearchLines2Column
                  key={column.id}
                  column={column}
                  rankField={rankField}
                  overlaySelections={validOverlaySelections}
                  overlayOptionById={overlayOptionById}
                  cancelledOverlayGroupIds={cancelledOverlayGroupIds}
                  includeDescendantMarkers={includeDescendantMarkers}
                  topLevelColorsByUser={topLevelColorsByUser}
                  topLevelGroupIdsByUser={topLevelGroupIdsByUser}
                  selectedBandId={selectedBandId}
                  timeRangeSelections={timeRangeSelections}
                  onSelectBand={setSelectedBandId}
                  onAddTimeRangeSelection={handleAddTimeRangeSelection}
                  onRemoveTimeRangeSelection={handleRemoveTimeRangeSelection}
                />
              ))}
            </div>
          </div>
          {selectedBand && (
            <SearchLines2ZoomPanel
              key={selectedBand.id}
              band={selectedBand}
              rankField={rankField}
              overlaySelections={validOverlaySelections}
              overlayOptionById={overlayOptionById}
              cancelledOverlayGroupIds={cancelledOverlayGroupIds}
              includeDescendantMarkers={includeDescendantMarkers}
              topLevelColorsByUser={topLevelColorsByUser}
              topLevelGroupIdsByUser={topLevelGroupIdsByUser}
              onClose={() => setSelectedBandId(null)}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default SearchLines2View;
