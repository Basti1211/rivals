import {useState} from "react";
import type React from "react";
import type {FetchInteractionLogRow, SubmissionRow, TaskRow} from "../../../../../types/dataTypes";
import type {
  MarkerConfig,
  MarkerShape,
  OverlayOption,
  OverlaySelection,
  RankField,
  TimelineBandData,
} from "./SearchLines2View";

type TimelineBounds = {
  start: number;
  scaleEnd: number;
  lineEnd: number;
};

type LassoSelection = {
  startY: number;
  currentY: number;
};

type DetailRange = {
  start: number;
  end: number;
};

type SearchLines2ZoomPanelProps = {
  band: TimelineBandData;
  rankField: RankField;
  overlaySelections: OverlaySelection[];
  overlayOptionById: Map<string, OverlayOption>;
  cancelledOverlayGroupIds: Set<string>;
  includeDescendantMarkers: boolean;
  topLevelColorsByUser: Map<string, Map<string, string>>;
  topLevelGroupIdsByUser: Map<string, Map<string, string>>;
  onClose: () => void;
};

const ZOOM_WIDTH = 320;
const ZOOM_HEIGHT = 680;
const ZOOM_MARGIN_TOP = 42;
const ZOOM_MARGIN_BOTTOM = 34;
const TIMELINE_X = 150;
const RANK_MAX = 1000;
const RANK_BACKGROUND_COLOR = "rgb(22, 163, 74)";
const MIN_LASSO_HEIGHT = 10;
const MARKER_SHAPES: MarkerShape[] = [
  "circle",
  "triangle",
  "diamond",
  "square",
  "cross",
  "plus",
  "invertedTriangle",
];

const elapsedSecondsFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const formatElapsedSeconds = (timestamp: number, taskStartTimestamp: number): string => {
  const elapsedSeconds = Math.max(0, timestamp - taskStartTimestamp) / 1000;

  return `${elapsedSecondsFormatter.format(elapsedSeconds)}s`;
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

const ZoomMarkerSymbol: React.FC<{
  config: MarkerConfig;
  x: number;
  y: number;
}> = ({config, x, y}) => {
  const size = 12;
  const commonProps = {
    className: "search-lines-2-zoom-marker",
    fill: config.color,
    stroke: "#ffffff",
    strokeWidth: 1.1,
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

const SearchLines2ZoomPanel: React.FC<SearchLines2ZoomPanelProps> = ({
  band,
  rankField,
  overlaySelections,
  overlayOptionById,
  cancelledOverlayGroupIds,
  includeDescendantMarkers,
  topLevelColorsByUser,
  topLevelGroupIdsByUser,
  onClose,
}) => {
  const [lassoSelection, setLassoSelection] = useState<LassoSelection | null>(null);
  const [detailRange, setDetailRange] = useState<DetailRange | null>(null);
  const sortedInteractions = [...band.interactions].sort((first, second) => first.timestamp - second.timestamp);
  const bounds = getTimelineBounds(band.task, sortedInteractions, band.submissions);

  if (!bounds) {
    return (
      <aside className="search-lines-2-zoom-panel">
        <div className="search-lines-2-zoom-header">
          <div>
            <h2>{band.user}</h2>
            <span>{band.taskName}</span>
          </div>
          <button type="button" onClick={onClose}>x</button>
        </div>
        <div className="task-barchart-empty">No task timing</div>
      </aside>
    );
  }

  const scaleStart = detailRange?.start ?? bounds.start;
  const scaleEnd = detailRange?.end ?? bounds.scaleEnd;
  const yScale = (timestamp: number): number => {
    const clampedTimestamp = Math.min(Math.max(timestamp, scaleStart), scaleEnd);

    return ZOOM_MARGIN_TOP
      + ((clampedTimestamp - scaleStart) / (scaleEnd - scaleStart))
      * (ZOOM_HEIGHT - ZOOM_MARGIN_TOP - ZOOM_MARGIN_BOTTOM);
  };
  const yToTimestamp = (y: number): number => {
    const minY = ZOOM_MARGIN_TOP;
    const maxY = ZOOM_HEIGHT - ZOOM_MARGIN_BOTTOM;
    const clampedY = Math.min(Math.max(y, minY), maxY);
    const normalizedY = (clampedY - minY) / (maxY - minY);

    return bounds.start + normalizedY * (bounds.scaleEnd - bounds.start);
  };
  const getSvgY = (event: React.PointerEvent<SVGSVGElement>): number => {
    const rect = event.currentTarget.getBoundingClientRect();

    return ((event.clientY - rect.top) / rect.height) * ZOOM_HEIGHT;
  };
  const firstInactiveInteraction = sortedInteractions.find((interaction) =>
    !interaction.task_is_active
    && interaction.timestamp >= bounds.start
    && interaction.timestamp <= bounds.lineEnd,
  );
  const timelineEnd = firstInactiveInteraction
    ? firstInactiveInteraction.timestamp
    : bounds.lineEnd;
  const visibleInteractions = sortedInteractions.filter((interaction) =>
    interaction.task_is_active
    && interaction.timestamp >= bounds.start
    && interaction.timestamp <= timelineEnd,
  );
  const activeStart = detailRange?.start ?? bounds.start;
  const activeEnd = Math.min(detailRange?.end ?? timelineEnd, timelineEnd);
  const visibleDetailInteractions = visibleInteractions.filter((interaction) =>
    interaction.timestamp >= activeStart
    && interaction.timestamp <= activeEnd,
  );
  const interactionsBeforeActiveStart = visibleInteractions.filter((interaction) =>
    interaction.timestamp <= activeStart,
  );
  const previousInteraction = activeStart === bounds.start || !interactionsBeforeActiveStart.length
    ? null
    : interactionsBeforeActiveStart[interactionsBeforeActiveStart.length - 1];
  const points = [
    activeStart,
    ...visibleDetailInteractions.map((interaction) => interaction.timestamp),
    activeEnd,
  ];
  const segments = points.slice(0, -1).map((startTimestamp, index) => ({
    id: `${startTimestamp}-${points[index + 1]}-${index}`,
    startTimestamp,
    endTimestamp: points[index + 1],
    sourceInteraction: index === 0 ? previousInteraction : visibleDetailInteractions[index - 1],
  }));
  const taskEnd = band.task?.ended ?? null;
  const lassoTop = lassoSelection
    ? Math.min(lassoSelection.startY, lassoSelection.currentY)
    : 0;
  const lassoHeight = lassoSelection
    ? Math.abs(lassoSelection.currentY - lassoSelection.startY)
    : 0;
  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (detailRange) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const y = Math.min(Math.max(getSvgY(event), yScale(bounds.start)), yScale(timelineEnd));
    setLassoSelection({startY: y, currentY: y});
  };
  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (!lassoSelection || detailRange) {
      return;
    }

    const y = Math.min(Math.max(getSvgY(event), yScale(bounds.start)), yScale(timelineEnd));
    setLassoSelection({...lassoSelection, currentY: y});
  };
  const handlePointerUp = (): void => {
    if (!lassoSelection) {
      return;
    }

    if (lassoHeight >= MIN_LASSO_HEIGHT) {
      const start = Math.max(bounds.start, Math.min(yToTimestamp(lassoTop), timelineEnd));
      const end = Math.max(bounds.start, Math.min(yToTimestamp(lassoTop + lassoHeight), timelineEnd));

      if (end > start) {
        setDetailRange({start, end});
      }
    }

    setLassoSelection(null);
  };
  const handlePointerCancel = (): void => {
    setLassoSelection(null);
  };

  return (
    <aside className="search-lines-2-zoom-panel">
      <div className="search-lines-2-zoom-header">
        <div>
          <h2>{band.user}</h2>
          <span>
            {detailRange
              ? `${band.taskName} / ${formatElapsedSeconds(detailRange.start, bounds.start)}-${formatElapsedSeconds(detailRange.end, bounds.start)}`
              : band.taskName}
          </span>
        </div>
        <button
          type="button"
          aria-label={detailRange ? "Close detail selection" : "Close zoom"}
          onClick={detailRange ? () => setDetailRange(null) : onClose}
        >
          x
        </button>
      </div>
      <svg
        className={detailRange ? "search-lines-2-zoom-svg is-detail" : "search-lines-2-zoom-svg"}
        viewBox={`0 0 ${ZOOM_WIDTH} ${ZOOM_HEIGHT}`}
        role="img"
        aria-label={`${band.user} ${band.taskName} zoomed search line`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {!detailRange && (
          <rect
            className="search-lines-2-lasso-hitbox"
            x={0}
            y={yScale(bounds.start)}
            width={ZOOM_WIDTH}
            height={Math.max(1, yScale(timelineEnd) - yScale(bounds.start))}
          />
        )}
        <text className="search-lines-2-zoom-axis-label" x={TIMELINE_X - 72} y={yScale(bounds.start) + 4}>
          {detailRange ? formatElapsedSeconds(activeStart, bounds.start) : "start"}
        </text>
        <text className="search-lines-2-zoom-axis-label" x={TIMELINE_X - 72} y={yScale(activeEnd) + 4}>
          {detailRange ? formatElapsedSeconds(activeEnd, bounds.start) : "end"}
        </text>
        <line
          className="search-lines-2-zoom-line"
          x1={TIMELINE_X}
          x2={TIMELINE_X}
          y1={yScale(activeStart)}
          y2={yScale(activeEnd)}
        />
        {segments.map((segment) => {
          const opacity = getRankOpacity(getRankValue(segment.sourceInteraction, rankField));

          if (opacity <= 0) {
            return null;
          }

          return (
            <rect
              className="search-lines-2-zoom-rank-band"
              key={segment.id}
              x={TIMELINE_X - 58}
              y={yScale(segment.startTimestamp)}
              width={116}
              height={Math.max(1, yScale(segment.endTimestamp) - yScale(segment.startTimestamp))}
              fill={RANK_BACKGROUND_COLOR}
              opacity={opacity}
            >
              <title>{getSegmentTooltip(segment.sourceInteraction, segment.startTimestamp, bounds.start)}</title>
            </rect>
          );
        })}
        {taskEnd !== null && taskEnd >= activeStart && taskEnd <= activeEnd && (
          <line
            className="search-lines-2-zoom-task-end"
            x1={TIMELINE_X - 84}
            x2={TIMELINE_X + 84}
            y1={yScale(taskEnd)}
            y2={yScale(taskEnd)}
          >
            <title>{`${band.taskName} scheduled end: ${formatElapsedSeconds(taskEnd, bounds.start)}`}</title>
          </line>
        )}
        {visibleDetailInteractions.map((interaction, interactionIndex) => {
          const markerConfigs = getMarkerConfigs(
            interaction,
            overlaySelections,
            overlayOptionById,
            includeDescendantMarkers,
            bounds.start,
          );
          const y = yScale(interaction.timestamp);
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
              <g key={`${interaction.timestamp}-${interaction.action}-${interactionIndex}`}>
                {markerConfigs.map((config, markerIndex) => (
                  <ZoomMarkerSymbol
                    key={`${config.optionId}-${config.symbolMode}-${config.symbolType}-${markerIndex}`}
                    config={config}
                    x={TIMELINE_X + (markerIndex - (markerConfigs.length - 1) / 2) * 16}
                    y={y}
                  />
                ))}
              </g>
            );
          }

          return (
            <circle
              className="search-lines-2-zoom-dot"
              key={`${interaction.timestamp}-${interaction.action}-${interactionIndex}`}
              cx={TIMELINE_X}
              cy={y}
              r={4}
              fill={getInteractionColor(interaction, band.user, topLevelColorsByUser)}
            >
              <title>{getMarkerTooltip(interaction, bounds.start, "Event", interaction.abstract_type)}</title>
            </circle>
          );
        })}
        {lassoSelection && (
          <rect
            className="search-lines-2-lasso-selection"
            x={TIMELINE_X - 96}
            y={lassoTop}
            width={192}
            height={Math.max(1, lassoHeight)}
          />
        )}
      </svg>
    </aside>
  );
};

export default SearchLines2ZoomPanel;
