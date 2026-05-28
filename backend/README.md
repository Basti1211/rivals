# RIVALS Backend

The RIVALS backend is a FastAPI service that loads retrieval tasks, submitted answers, system interaction logs, and DRES exports into a local SQLite database. It exposes these data through API endpoints used by the frontend visualizations and provides analysis endpoints for classifier, motif, and efficiency calculations.

## Useful URLs:

After starting RIVALS, you can accesss following useful URLs:

- Frontend proxy: <http://localhost:3000/api/health>
- Backend directly: <http://localhost:5001/health>
- Backend Swagger UI: <http://localhost:5001/docs>

## Data Storage

The backend uses SQLite and creates the required tables automatically when the database is first accessed. The main tables are:

- `SourceFiles`: Uploaded source files.
- `Tasks`: Retrieval task metadata.
- `Answers`: Submitted task answers.
- `Interactions`: User interaction events.
- `Users`: User and system metadata, including interaction hierarchies.

In the Docker Compose development setup the default database path is `/data/app.db` inside the backend container. For local non-Docker development, set `DB_PATH` to a writable path such as `./app.db`.

## API Overview

The API is also documented in the Backend Swagger UI at: <http://localhost:5001/docs>

Direct backend paths start at `http://localhost:5001`. Through the frontend proxy, prefix the same paths with `/api`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/data/initialize-demo-data` | Load bundled demo tasks, answers, and interaction logs. |
| `POST` | `/data/load-tasks` | Load task metadata JSON. |
| `POST` | `/data/load-answers` | Load answer/submission JSON. |
| `POST` | `/data/load-interaction-logs` | Load system-specific interaction logs. |
| `POST` | `/data/inspect-dres-logs` | Inspect an official DRES JSON export before importing it. |
| `POST` | `/data/load-dres-logs` | Convert and load task and answer data from an official DRES JSON export. |
| `DELETE` | `/data/source-files/{source_file_id}` | Delete all data loaded from one source file. |
| `GET` | `/data/get-load-summary` | Return row counts and loaded source files. |
| `POST` | `/data/get-user-and-tasks` | Return available users and tasks. |
| `GET` | `/data/get-tasks-and-answers` | Return available tasks and answers. |
| `POST` | `/data/get-interactions` | Return interaction data for selected user/task/hierarchy combinations. |
| `POST` | `/data/analysis/classifier` | Train a classifier and return SHAP explanations. |
| `POST` | `/data/analysis/motif` | Identify discriminative behavior motifs. |
| `POST` | `/data/analysis/efficiency` | Compute iteration and persistence metrics. |
| `GET` | `/health` | Health check endpoint. |

For exact request and response schemas, use the Swagger UI at `/docs`.

## Input Formats

The detailed input formats are documented in the root [README.md](../README.md#input-formats). In short, the backend accepts:

- Task metadata as a JSON array, an object with a top-level `tasks` array, or an official DRES JSON export via the DRES endpoints.
- Task answers as a JSON array, an object with a top-level `submissions` array, or an official DRES JSON export via the DRES endpoints.
- Interaction logs as a JSON array or an object with a top-level `interaction_logs` array.
- Interaction abstraction hierarchies embedded in each uploaded interaction log export.

## Project Structure

- `app/asgi.py`: FastAPI application setup.
- `app/api/routers/`: API route definitions.
- `app/dataManager/loadData/`: Data loading, demo import, DRES import, and source-file deletion.
- `app/dataManager/fetchData/`: Data retrieval and request shaping for the frontend.
- `app/dataManager/database/`: SQLite connection, schema, and insert/fetch helpers.
- `app/analysis/`: Classifier, motif, and efficiency analysis modules.
- `app/types/responses/`: Pydantic request and response models.
- `sample_data/`: Bundled demo and example data.
- `dev.Dockerfile`: Local development image.
- `entrypoint.sh`: Starts Uvicorn in development mode or Gunicorn in production mode.
