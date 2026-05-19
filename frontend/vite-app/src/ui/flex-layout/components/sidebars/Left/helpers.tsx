import { ValidJsonFile } from "../../../../../types/dataTypes";

export async function validateJsonFiles(
  files: FileList | File[]
): Promise<ValidJsonFile[] | null> {
  const fileArray = Array.from(files);
  const validJsonFiles: ValidJsonFile[] = [];

  for (const file of fileArray) {
    const hasJsonExtension = file.name.toLowerCase().endsWith(".json");

    if (!hasJsonExtension) {
      return null;
    }

    try {
      const text = await file.text();
      const parsedJson: unknown = JSON.parse(text);

      validJsonFiles.push({
        file,
        data: parsedJson,
      });
    } catch {
      return null;
    }
  }

  return validJsonFiles;
}