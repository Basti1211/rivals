# RIVALS

**Retrieval Interaction Visualization and Analytics of Log Sequences**

RIVALS is a visual analytics platform for analyzing interaction logs from video retrieval systems. It is designed for logs collected at academic competitions such as the Video Browser Showdown, the Lifelog Search Challenge, and CASTLE.

## Quick Start

RIVALS is fully Dockerized. From the project root, start the frontend and backend with:

```bash
docker compose up --build
```

After the containers are running, open the visual interface at:

<http://localhost:3000/>

## Requirements

- Docker
- Docker Compose

If you experience any problems, contact [bastian.jaeckl@uni-konstanz.de](mailto:bastian.jaeckl@uni-konstanz.de) or create an issue on GitHub.

## Input Formats

RIVALS requires four types of input data:

1. Task metadata
2. Task answers
3. System-specific interaction logs
4. Interaction abstraction hierarchy

The expected formats are described below.

### Task Metadata

Task metadata describes the retrieval tasks that should be available in RIVALS. The upload can be either a JSON array of task objects or an object with a top-level `tasks` array.

```json
{
  "tasks": [
    {
      "task_id": "876b47c6-58d1-4435-85d1-00b5557c7e44",
      "name": "vbs26-kis-t4",
      "dataset": "V3C",
      "taskGroup": "KIST",
      "finished_after_correct_answer": true,

      "hint_text": "A textual description, question, or search hint shown to the participant.",
      "hint_video": null,
      "hint_video_path": null,
      "hint_video_start_time": null,
      "hint_video_end_time": null,

      "target_text": null,
      "target_video": "23197",
      "target_video_path": "http://example.org/videos/V3C/23197.mp4",
      "target_video_start_time": 61070,
      "target_video_end_time": 69650,

      "started": 1769698964826,
      "ended": 1769699264826
    }
  ]
}
```

Required fields:

- `task_id`: Unique task identifier.
- `name`: Human-readable task name, for example `vbs26-kis-t4`.
- `dataset`: Dataset associated with the task, for example `V3C`.
- `taskGroup`: Task group or benchmark category, for example `KIST`, `AVS`, or `QA`.
- `finished_after_correct_answer`: Whether the task should be considered finished for a user after their first correct answer.
- `started` / `ended`: Task start and end timestamps as Unix timestamps in milliseconds. Both fields are required because they define the time window used to retrieve matching submissions and interaction logs.

Optional fields can be set to `null` when they are not available:

- `hint_text`: Textual task description, question, or search hint.
- `hint_video`: Video identifier used as a hint.
- `hint_video_path`: Path or URL to the hint video.
- `hint_video_start_time` / `hint_video_end_time`: Hint video segment boundaries in milliseconds.
- `target_text`: Expected textual target or answer.
- `target_video`: Target video identifier.
- `target_video_path`: Path or URL to the target video.
- `target_video_start_time` / `target_video_end_time`: Target video segment boundaries in milliseconds.

### Task Answers

Task answers describe submitted answers for each task and user. The upload can be either a JSON array of answer objects or an object with a top-level `submissions` array.

```json
{
  "submissions": [
    {
      "task_id": "2f7bdaff-34cf-4b8d-b01c-00fe9384a7f3",
      "user": "prak2",
      "timestamp": 1769699103920,
      "status": 1,

      "answer_text": "fish, onion, green chilli",
      "answer_video": null,
      "answer_video_start_time": null,
      "answer_video_end_time": null
    }
  ]
}
```

Required fields:

- `task_id`: Identifier of the task this answer belongs to. This should match the `task_id` from the task metadata.
- `user`: Name of the user or system that submitted the answer. This must match the corresponding user name used in the interaction logs.
- `timestamp`: Unix timestamp in milliseconds when the answer was submitted.
- `status`: Submission status. Use `1` for correct, `0` for undecided, and `-1` for wrong.

Optional fields can be set to `null` when they are not available:

- `answer_text`: Submitted textual answer.
- `answer_video`: Submitted video identifier.
- `answer_video_start_time` / `answer_video_end_time`: Submitted video segment boundaries in milliseconds.

### System-Specific Interaction Logs

System-specific interaction logs describe the actions performed by users in one retrieval system. Each uploaded system export contains the system name, its interaction abstraction hierarchy, and a mapping from users to their individual interaction events.

The upload can be either a JSON array of system log objects or an object with a top-level `interaction_logs` array.

```json
{
  "interaction_logs": [
    {
      "Name": "PraK",
      "Hierarchy": [
        {
          "Name": "Querying",
          "Visualize": true,
          "Children": [
            {
              "Name": "textQuery",
              "Visualize": false,
              "Children": []
            }
          ]
        }
      ],
      "Logs": {
        "prak1": [
          {
            "timestamp": 1769691313000,
            "action": "textQuery",
            "frameRank": 0,
            "videoRank": 0,
            "metadata": "a textual query"
          }
        ],
        "prak2": [
          {
            "timestamp": 1769691320000,
            "action": "selectImage",
            "frameRank": 5,
            "videoRank": 2,
            "metadata": {
              "video_id": "23197",
              "frame": 30
            }
          }
        ]
      }
    }
  ]
}
```

Required fields for each system export:

- `Name`: Name of the retrieval system or logging source.
- `Hierarchy`: Interaction abstraction hierarchy for this system. See [Interaction Abstraction Hierarchy](#interaction-abstraction-hierarchy).
- `Logs`: Object mapping user names to arrays of interaction events. These user names, for example `prak1`, must match the `user` values in the task answers.

Required fields for each interaction event:

- `timestamp`: Unix timestamp in milliseconds when the interaction occurred.
- `action`: System-specific interaction action type. Leaf action names should match entries in the interaction hierarchy.

Optional fields can be set to `null` when they are not available:

- `frameRank`: Rank of the associated frame.
- `videoRank`: Rank of the associated video.
- `metadata`: Additional event-specific payload. This can be a string, object, array, number, boolean, or `null`.

### Interaction Abstraction Hierarchy

The interaction abstraction hierarchy groups system-specific action names into higher-level interaction categories used by the visualizations. It is embedded in each system-specific interaction log under the `Hierarchy` field.

Each hierarchy is an array of recursive hierarchy nodes:

```json
[
  {
    "Name": "Querying",
    "Visualize": true,
    "Cancelled": false,
    "Children": [
      {
        "Name": "Textually-Constrained Visual Queries",
        "Visualize": false,
        "Cancelled": false,
        "Children": [
          {
            "Name": "textQuery",
            "Visualize": false,
            "Cancelled": false,
            "Children": []
          }
        ]
      }
    ]
  }
]
```

Required fields for each hierarchy node:

- `Name`: Human-readable hierarchy node name. Leaf node names should match the `action` values used in the interaction logs.
- `Children`: Child hierarchy nodes. Use an empty array for leaf actions.

Optional fields:

- `Visualize`: Whether this node should be used as an abstraction level in visualizations. If omitted, it defaults to `false`.
- `Cancelled`: Whether this node and its descendants should be excluded from selected analyses. If omitted, it defaults to `false`.

## Project Structure

- [Frontend](frontend/README.md)
- [Backend](backend/README.md)
- [Kubernetes deployment](k8s/README.md)
