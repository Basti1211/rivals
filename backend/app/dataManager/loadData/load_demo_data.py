import json

from pydantic import ValidationError

from app.config.base_paths import PATH_DATA_DIR
from app.dataManager.database.connection import count_database_rows
from app.dataManager.database.handleData.interactionManager import insert as insert_interaction
from app.dataManager.database.handleData.sourceFileManager import fetch_all as fetch_source_files
from app.dataManager.database.handleData.sourceFileManager import insert as insert_source_file
from app.dataManager.database.handleData.submissionManager import insert as insert_submission
from app.dataManager.database.handleData.taskManager import insert as insert_task
from app.types.responses.model_requests import InteractionLogList, SubmissionList, TaskList
from app.types.responses.model_responses import LoadDataResponse


def read_sample_json(filename: str):
    path = PATH_DATA_DIR / filename
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _update_response_counts(
    response: LoadDataResponse,
    before_counts: dict[str, int],
    after_counts: dict[str, int],
) -> None:
    response.loadedTasks = after_counts["tasks"] - before_counts["tasks"]
    response.loadedUsers = after_counts["users"] - before_counts["users"]
    response.loadedLogs = after_counts["logs"] - before_counts["logs"]
    response.loadedAnswers = after_counts["answers"] - before_counts["answers"]

    response.totalTasks = after_counts["tasks"]
    response.totalUsers = after_counts["users"]
    response.totalLogs = after_counts["logs"]
    response.totalAnswers = after_counts["answers"]


def _format_validation_error(error: ValidationError) -> str:
    details = error.errors()[0]
    location = ".".join(str(part) for part in details["loc"])
    return f"Validation error at {location}: {details['msg']}"


def load_demo_data() -> LoadDataResponse:
    # This function is used to initialize the database with demo data.
    response = LoadDataResponse()
    before_counts = {
        "tasks": 0,
        "users": 0,
        "logs": 0,
        "answers": 0,
        "sourceFiles": 0,
    }

    try:
        before_counts = count_database_rows()
        # Load the Tasks (e.g. from DRES)
        tasks = TaskList(tasks=read_sample_json("demo_tasks.json"))
        insert_task(tasks, insert_source_file("demo_tasks.json"))

        # Load the Answers (e.g. from DRES)
        submissions = SubmissionList(submissions=read_sample_json("demo_submissions.json"))
        insert_submission(submissions, insert_source_file("demo_submissions.json"))

        # Load the Interaction Logs (from systems)
        interaction_logs_prak = read_sample_json("master_interaction_log_mm_submission.json")
        interaction_logs = InteractionLogList(
            interaction_logs=[interaction_logs_prak[0]]
        )
        insert_interaction(
            interaction_logs,
            insert_source_file("master_interaction_log_mm_submission.json"),
        )

        interaction_logs_exquisitor = read_sample_json("exquisitor_master_interaction_log_mm_submission.json")
        interaction_logs = InteractionLogList(
            interaction_logs=[interaction_logs_exquisitor[0]]
        )
        insert_interaction(
            interaction_logs,
            insert_source_file("exquisitor_master_interaction_log_mm_submission.json"),
        )
    except ValidationError as error:
        response.errorMessage = _format_validation_error(error)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        response.errorMessage = str(error)
    except Exception as error:
        response.errorMessage = f"Failed to load demo data: {error}"
    finally:
        try:
            after_counts = count_database_rows()
            print(f"Database row counts before loading: {before_counts}")
            print(f"Database row counts after loading: {after_counts}")
            _update_response_counts(response, before_counts, after_counts)
            response.sourceFiles = fetch_source_files()
        except Exception as error:
            response.errorMessage = f"Failed to count database rows: {error}"
    print(f"Load demo data response: {response.json()}")
    return response
