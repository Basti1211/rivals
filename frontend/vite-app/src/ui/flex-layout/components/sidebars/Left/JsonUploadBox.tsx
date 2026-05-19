import React, { ChangeEvent, DragEvent, useRef, useState } from "react";
import { Button } from "antd";
import {ValidJsonFile} from "../../../../../types/dataTypes";
import { validateJsonFiles } from "./helpers";

interface JsonUploadBoxProps {
  label: string;
  onValidJsonFiles: (files: ValidJsonFile[]) => void;
  onInvalidJson: () => void;
}

const JsonUploadBox: React.FC<JsonUploadBoxProps> = ({
  label,
  onValidJsonFiles,
  onInvalidJson,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleFiles = async (files: FileList): Promise<void> => {
    const validJsonFiles = await validateJsonFiles(files);

    if (!validJsonFiles) {
      onInvalidJson();
      return;
    }

    onValidJsonFiles(validJsonFiles);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files.length > 0) {
      void handleFiles(event.dataTransfer.files);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (): void => {
    setIsDragging(false);
  };

  const handleBrowseClick = (): void => {
    inputRef.current?.click();
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = event.target.files;

    if (files && files.length > 0) {
      void handleFiles(files);
    }

    event.target.value = "";
  };

  return (
    <div className="json-upload-box">
      <div
        className={`drag-drop-field ${isDragging ? "is-dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p>{label}</p>
        <p>Drag and drop .json files here</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        multiple
        hidden
        onChange={handleFileInputChange}
      />

      <Button type="default" onClick={handleBrowseClick}>
        Browse JSON Files
      </Button>
    </div>
  );
};

export default JsonUploadBox;