import React, { useMemo } from "react";
import type { SubmissionRow, TaskRow } from "../../../../../types/dataTypes";

type TaskPerformanceHeatmapProps = {
  tasks: TaskRow[];
  submissions: SubmissionRow[];
  onTaskClick: (taskName: string) => void;
};

type HeatmapCell = {
  task: TaskRow;
  user: string;
  submissions: SubmissionRow[];
  wrongCount: number;
  correctCount: number;
  timeToCorrectMs: number | null;
};

type HeatmapModel = {
  users: string[];
  cells: Map<string, HeatmapCell>;
  maxTimeToCorrectMsByTask: Map<string, number>;
  maxCorrectCountByTask: Map<string, number>;
};

const DEFAULT_CELL_COLOR = "#cbd5e1";
const CELL_WIDTH_PX = 42;

const cellKey = (user: string, taskName: string): string => `${user}::${taskName}`;

const makeTaskNameLookup = (tasks: TaskRow[]): Map<string, string> => {
  const lookup = new Map<string, string>();

  tasks.forEach((task) => {
    lookup.set(task.name, task.name);
    lookup.set(task.task_id, task.name);
  });

  return lookup;
};

const getFirstCorrectSubmission = (submissions: SubmissionRow[]): SubmissionRow | null => {
  return submissions
    .filter((submission) => submission.status === 1)
    .sort((a, b) => a.timestamp - b.timestamp)[0] ?? null;
};

const getTimeToCorrectMs = (task: TaskRow, submissions: SubmissionRow[]): number | null => {
  const firstCorrectSubmission = getFirstCorrectSubmission(submissions);

  if (!firstCorrectSubmission) {
    return null;
  }

  const firstSubmissionTimestamp = submissions
    .map((submission) => submission.timestamp)
    .sort((a, b) => a - b)[0];
  const startTime = task.started ?? firstSubmissionTimestamp;

  if (startTime === undefined) {
    return null;
  }

  return Math.max(0, firstCorrectSubmission.timestamp - startTime);
};

const getTaskDurationMs = (task: TaskRow): number | null => {
  if (task.started === null || task.ended === null || task.ended <= task.started) {
    return null;
  }

  return task.ended - task.started;
};

const buildHeatmapModel = (tasks: TaskRow[], submissions: SubmissionRow[]): HeatmapModel => {
  const taskNameLookup = makeTaskNameLookup(tasks);
  const submissionsByCell = new Map<string, SubmissionRow[]>();
  const usersWithKnownTaskSubmission = new Set<string>();

  submissions.forEach((submission) => {
    const taskName = taskNameLookup.get(submission.task_id);

    if (!taskName) {
      return;
    }

    usersWithKnownTaskSubmission.add(submission.user);

    const key = cellKey(submission.user, taskName);
    submissionsByCell.set(key, [...(submissionsByCell.get(key) ?? []), submission]);
  });

  const users = Array.from(usersWithKnownTaskSubmission).sort();
  const cells = new Map<string, HeatmapCell>();
  const maxTimeToCorrectMsByTask = new Map<string, number>();
  const maxCorrectCountByTask = new Map<string, number>();

  tasks.forEach((task) => {
    maxTimeToCorrectMsByTask.set(task.name, getTaskDurationMs(task) ?? 0);
    maxCorrectCountByTask.set(task.name, 0);
  });

  users.forEach((user) => {
    tasks.forEach((task) => {
      const key = cellKey(user, task.name);
      const cellSubmissions = submissionsByCell.get(key) ?? [];
      const correctCount = cellSubmissions.filter((submission) => submission.status === 1).length;
      const wrongCount = cellSubmissions.filter((submission) => submission.status === -1).length;
      const timeToCorrectMs = task.finished_after_correct_answer
        ? getTimeToCorrectMs(task, cellSubmissions)
        : null;

      if (timeToCorrectMs !== null) {
        maxTimeToCorrectMsByTask.set(
          task.name,
          Math.max(maxTimeToCorrectMsByTask.get(task.name) ?? 0, timeToCorrectMs),
        );
      }

      if (!task.finished_after_correct_answer) {
        maxCorrectCountByTask.set(
          task.name,
          Math.max(maxCorrectCountByTask.get(task.name) ?? 0, correctCount),
        );
      }

      cells.set(key, {
        task,
        user,
        submissions: cellSubmissions,
        wrongCount,
        correctCount,
        timeToCorrectMs,
      });
    });
  });

  return { users, cells, maxTimeToCorrectMsByTask, maxCorrectCountByTask };
};

const getTimeColor = (cell: HeatmapCell, maxTimeToCorrectMs: number): string => {
  if (cell.timeToCorrectMs === null) {
    return DEFAULT_CELL_COLOR;
  }

  if (maxTimeToCorrectMs <= 0) {
    return "#22c55e";
  }

  const ratio = Math.min(1, cell.timeToCorrectMs / maxTimeToCorrectMs);
  const hue = 142 - (ratio * 94);
  const lightness = 48 + (ratio * 22);
  return `hsl(${hue}, 78%, ${lightness}%)`;
};

const getCorrectCountColor = (cell: HeatmapCell, maxCorrectCount: number): string => {
  if (cell.correctCount <= 0 || maxCorrectCount <= 0) {
    return DEFAULT_CELL_COLOR;
  }

  const ratio = cell.correctCount / maxCorrectCount;
  const lightness = 92 - (ratio * 45);
  return `hsl(142, 68%, ${lightness}%)`;
};

const formatTime = (milliseconds: number): string => {
  const seconds = milliseconds / 1000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
};

const getCellLabel = (cell: HeatmapCell): string => {
  if (cell.task.finished_after_correct_answer) {
    return cell.timeToCorrectMs === null ? "" : formatTime(cell.timeToCorrectMs);
  }

  return cell.correctCount > 0 ? String(cell.correctCount) : "";
};

const getCellTitle = (cell: HeatmapCell): string => {
  if (cell.task.finished_after_correct_answer) {
    const performance = cell.timeToCorrectMs === null
      ? "not solved"
      : `time to correct: ${formatTime(cell.timeToCorrectMs)}`;
    return `${cell.user} / ${cell.task.name}: ${performance}, ${cell.wrongCount} wrong`;
  }

  return `${cell.user} / ${cell.task.name}: ${cell.correctCount} correct, ${cell.wrongCount} wrong`;
};

const getCrossCenter = (index: number): { x: number; y: number } => {
  const columns = 3;
  const column = index % columns;
  const row = Math.floor(index / columns);

  return {
    x: 10 + (column * 11),
    y: 7 + ((row % 3) * 8),
  };
};

const WrongAnswerMarks: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) {
    return null;
  }

  return (
    <svg className="performance-wrong-marks" viewBox={`0 0 ${CELL_WIDTH_PX} 30`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => {
        const { x, y } = getCrossCenter(index);

        return (
          <g key={index} stroke="#dc2626" strokeLinecap="round" strokeWidth="1.5">
            <line x1={x - 2.5} y1={y - 2.5} x2={x + 2.5} y2={y + 2.5} />
            <line x1={x - 2.5} y1={y + 2.5} x2={x + 2.5} y2={y - 2.5} />
          </g>
        );
      })}
    </svg>
  );
};

const TaskPerformanceHeatmap: React.FC<TaskPerformanceHeatmapProps> = ({
  tasks,
  submissions,
  onTaskClick,
}) => {
  const model = useMemo(
    () => buildHeatmapModel(tasks, submissions),
    [tasks, submissions],
  );
  const gridStyle = {
    gridTemplateColumns: `88px repeat(${tasks.length}, ${CELL_WIDTH_PX}px)`,
  };

  if (model.users.length === 0) {
    return (
      <p className="task-visualization-status">
        No submissions loaded yet.
      </p>
    );
  }

  return (
    <div className="performance-heatmap-wrap">
      <div className="performance-heatmap" role="table">
        <div className="performance-heatmap-row performance-heatmap-header" role="row" style={gridStyle}>
          <div className="performance-user-heading" role="columnheader">User</div>
          {tasks.map((task) => (
            <div className="performance-task-heading" key={task.name} role="columnheader">
              <button
                className="performance-task-button"
                type="button"
                title={task.name}
                onClick={() => onTaskClick(task.name)}
              >
                {task.name}
              </button>
            </div>
          ))}
        </div>

        {model.users.map((user) => (
          <div className="performance-heatmap-row" key={user} role="row" style={gridStyle}>
            <div className="performance-user-label" role="rowheader" title={user}>
              {user}
            </div>

            {tasks.map((task) => {
              const cell = model.cells.get(cellKey(user, task.name));

              if (!cell) {
                return <div className="performance-cell" key={task.name} role="cell" />;
              }

              const backgroundColor = task.finished_after_correct_answer
                ? getTimeColor(cell, model.maxTimeToCorrectMsByTask.get(task.name) ?? 0)
                : getCorrectCountColor(cell, model.maxCorrectCountByTask.get(task.name) ?? 0);

              return (
                <div
                  className="performance-cell"
                  key={task.name}
                  role="cell"
                  style={{ backgroundColor }}
                  title={getCellTitle(cell)}
                >
                  <span className="performance-cell-value">{getCellLabel(cell)}</span>
                  <WrongAnswerMarks count={cell.wrongCount} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskPerformanceHeatmap;
