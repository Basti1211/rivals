import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "antd";
import type { TaskRow } from "../../../../../types/dataTypes";

type TaskVideoProps = {
  label: string;
  name: string | null;
  path: string | null;
  startTime: number | null;
  endTime: number | null;
};

type TaskVisualizationProps = {
  task: TaskRow;
};

const toSeconds = (milliseconds: number): number => milliseconds / 1000;

const formatSeconds = (milliseconds: number): string => {
  const seconds = toSeconds(milliseconds);
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(2)}s`;
};

const getVideoName = (name: string | null, path: string): string => {
  if (name && name.trim() !== "") {
    return name;
  }

  const pathWithoutQuery = path.split(/[?#]/)[0];
  return pathWithoutQuery.split("/").pop() || path;
};

const TaskVideo: React.FC<TaskVideoProps> = ({ label, name, path, startTime, endTime }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const segment = useMemo(() => {
    if (path === null || startTime === null || endTime === null || endTime <= startTime) {
      return null;
    }

    return {
      src: path,
      start: toSeconds(startTime),
      end: toSeconds(endTime),
      label: getVideoName(name, path),
      startLabel: formatSeconds(startTime),
      endLabel: formatSeconds(endTime),
    };
  }, [name, path, startTime, endTime]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || segment === null) {
      return;
    }

    video.currentTime = segment.start;
    video.pause();
    setIsPlaying(false);
  }, [segment]);

  if (segment === null) {
    return null;
  }

  const handleLoadedMetadata = (): void => {
    if (videoRef.current) {
      videoRef.current.currentTime = segment.start;
    }
  };

  const togglePlayback = async (): Promise<void> => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      if (video.currentTime < segment.start || video.currentTime >= segment.end) {
        video.currentTime = segment.start;
      }

      await video.play();
      setIsPlaying(true);
      return;
    }

    video.pause();
    setIsPlaying(false);
  };

  const handleTimeUpdate = (): void => {
    const video = videoRef.current;

    if (!video || video.currentTime < segment.end) {
      return;
    }

    video.pause();
    video.currentTime = segment.start;
    setIsPlaying(false);
  };

  return (
    <div className="task-media-block">
      <span className="task-field-label">{label}</span>
      <span className="task-video-meta">
        {segment.label} ({segment.startLabel} - {segment.endLabel})
      </span>
      <video
        ref={videoRef}
        className="task-video"
        preload="metadata"
        src={segment.src}
        onLoadedMetadata={handleLoadedMetadata}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={handleTimeUpdate}
      />
      <Button className="task-video-toggle" size="small" onClick={() => void togglePlayback()}>
        {isPlaying ? "Pause" : "Play"}
      </Button>
    </div>
  );
};

const TaskText: React.FC<{ label: string; value: string | null }> = ({ label, value }) => {
  if (value === null || value.trim() === "") {
    return null;
  }

  return (
    <p className="task-text-row">
      <span className="task-field-label">{label}</span>
      <span>{value}</span>
    </p>
  );
};

const TaskVisualization: React.FC<TaskVisualizationProps> = ({ task }) => (
  <article className="task-visualization-card">
    <h2>
      {task.name} <span>({task.taskGroup})</span>
    </h2>

    <div className="task-visualization-content">
      <TaskText label="Hint Text:" value={task.hint_text} />
      <TaskVideo
        label="Hint Video:"
        name={task.hint_video}
        path={task.hint_video_path}
        startTime={task.hint_video_start_time}
        endTime={task.hint_video_end_time}
      />

      <TaskText label="Target Text:" value={task.target_text} />
      <TaskVideo
        label="Target Video:"
        name={task.target_video}
        path={task.target_video_path}
        startTime={task.target_video_start_time}
        endTime={task.target_video_end_time}
      />
    </div>
  </article>
);

export default TaskVisualization;
